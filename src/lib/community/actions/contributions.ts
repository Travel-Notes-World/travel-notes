'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { TYPE_PATH, type ContributionType } from '../constants'
import { deleteDraft, removeOwn, saveContribution, setOwnEventStatus, withdrawSubmission } from '../contributions'
import { hashSubject, hit } from '../ratelimit'
import { search } from '../search'
import { bool, formValues, json, str, strings, toState, type ActionState } from '../next/forms'
import { getViewer, safeReturnPath } from '../next/session'

/**
 * Read a contribution form into the plain object the service checks. Field names match the
 * service's input names. Nothing here decides anything: the service validates every value.
 * Lists edited in the browser (costs, itinerary days) arrive as JSON in a hidden field.
 */
function readContributionForm(type: ContributionType, form: FormData): Record<string, unknown> {
  const input: Record<string, unknown> = {
    title: str(form, 'title'),
    body: str(form, 'body'),
    destinations: strings(form, 'destinations'),
    topics: strings(form, 'topics'),
    style: str(form, 'style'),
    photos: strings(form, 'photos'),
  }
  if (type === 'question') Object.assign(input, { travelMonth: str(form, 'travelMonth'), durationDays: str(form, 'durationDays'), partyType: str(form, 'partyType'), budget: str(form, 'budget'), budgetCurrency: str(form, 'budgetCurrency') })
  if (type === 'trip') {
    Object.assign(input, {
      startDate: str(form, 'startDate'), endDate: str(form, 'endDate'), travelMonth: str(form, 'travelMonth'), durationDays: str(form, 'durationDays'), nights: str(form, 'nights'),
      partySize: str(form, 'partySize'), partyType: str(form, 'partyType'), costScope: str(form, 'costScope'), flightsIncluded: bool(form, 'flightsIncluded'), costNotes: str(form, 'costNotes'),
      transport: str(form, 'transport'), recommendations: str(form, 'recommendations'), mistakes: str(form, 'mistakes'), permission: bool(form, 'permission'),
      costs: json(form, 'costsJson') ?? [], days: json(form, 'daysJson') ?? [],
    })
  }
  if (type === 'activity') {
    Object.assign(input, {
      category: str(form, 'category'), format: str(form, 'format'), venueName: str(form, 'venueName'), venueAddress: str(form, 'venueAddress'), timeZone: str(form, 'timeZone'),
      allDay: bool(form, 'allDay'), startLocal: str(form, bool(form, 'allDay') ? 'startDate' : 'startLocal'), endLocal: str(form, bool(form, 'allDay') ? 'endDate' : 'endLocal'),
      priceState: str(form, 'priceState'), price: str(form, 'price'), priceCurrency: str(form, 'priceCurrency'), bookingUrl: str(form, 'bookingUrl'), sourceUrl: str(form, 'sourceUrl'),
      organiserName: str(form, 'organiserName'), organiserContact: str(form, 'organiserContact'), disclosure: str(form, 'disclosure'), audience: str(form, 'audience'),
      accessibility: str(form, 'accessibility'), capacity: str(form, 'capacity'),
    })
  }
  return input
}

/**
 * Save a draft or submit for review. The type comes from the page the form is on; for an existing
 * post the service ignores it and uses the stored type. The author is the signed-in member.
 */
export async function saveContributionAction(_: ActionState, form: FormData): Promise<ActionState> {
  const typeValue = str(form, 'type')
  const type = (['question', 'trip', 'activity'].includes(typeValue) ? typeValue : 'question') as ContributionType
  const intent = str(form, 'intent') === 'submit' ? 'submit' : 'save'
  const id = str(form, 'id') || null
  let saved: { id: string; editPending: boolean; state: string }
  try {
    const { member } = await getViewer()
    saved = await saveContribution(member!, { id, type, input: readContributionForm(type, form), intent })
  } catch (error) {
    return toState(error, formValues(form))
  }
  if (intent === 'submit') redirect(`/account/posts/${saved.id}?sent=${saved.editPending ? 'edit' : 'new'}`)
  // A brand-new draft moves to its own address, so pressing Save again updates it instead of making a copy.
  if (!id) redirect(`/account/posts/${saved.id}?saved=1`)
  return { ok: true, message: `Draft saved at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC.`, data: { id: saved.id } }
}

/** Quiet background save of an existing draft. Returns only whether it worked. */
export async function autosaveDraftAction(form: FormData): Promise<{ ok: boolean; at?: string; message?: string }> {
  const id = str(form, 'id')
  if (!id) return { ok: false }
  try {
    const { member } = await getViewer()
    const typeValue = str(form, 'type') as ContributionType
    await saveContribution(member!, { id, type: typeValue, input: readContributionForm(typeValue, form), intent: 'save' })
    return { ok: true, at: new Date().toISOString() }
  } catch (error) {
    const state = toState(error)
    return { ok: false, message: state.code === 'validation' ? 'Not saved automatically yet: a field is not valid.' : state.message }
  }
}

export async function withdrawAction(form: FormData): Promise<void> {
  const { member } = await getViewer()
  const id = str(form, 'id')
  await withdrawSubmission(member!, id).catch(() => undefined)
  redirect(`/account/posts/${id}`)
}

export async function deleteDraftAction(form: FormData): Promise<void> {
  const { member } = await getViewer()
  await deleteDraft(member!, str(form, 'id')).catch(() => undefined)
  redirect('/account?deleted=1')
}

export async function removeOwnAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    if (str(form, 'confirm') !== 'yes') return { ok: false, message: 'Tick the box to confirm.' }
    const { member } = await getViewer()
    await removeOwn(member!, str(form, 'id'))
  } catch (error) {
    return toState(error)
  }
  redirect('/account?removed=1')
}

export async function setEventStatusAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { member } = await getViewer()
    await setOwnEventStatus(member!, str(form, 'id'), { status: str(form, 'status'), note: str(form, 'note') })
    revalidatePath(safeReturnPath(str(form, 'returnTo'), '/activities'))
    revalidatePath('/activities')
    return { ok: true, message: 'The status is updated on the public page, and people who responded are being told.' }
  } catch (error) {
    return toState(error)
  }
}

export type SimilarItem = { title: string; path: string; answers: number }

/** Questions that may already answer what the member is about to ask. Approved content only. */
export async function similarQuestionsAction(title: string): Promise<SimilarItem[]> {
  const q = String(title ?? '').trim()
  if (q.length < 12) return []
  // Only offered on the "ask a question" form, so it needs a signed-in member and has a rate limit.
  const { member } = await getViewer()
  if (!member) return []
  if (!(await hit('search_ip', hashSubject(`member:${member.id}`))).allowed) return []
  const found = await search({ q: q.split(/\s+/).filter((w) => w.length > 3).slice(0, 6).join(' or '), type: 'question' }).catch(() => null)
  return (found?.items ?? []).slice(0, 5).map((c) => ({ title: c.title, path: c.path, answers: c.replyCount }))
}

export const typePath = async (type: ContributionType) => TYPE_PATH[type]
