import 'server-only'

import type { Content } from '../content'
import { destinationsByIds } from '../destinations'
import { amountToInput } from '../money'
import { cms } from '../db'

export type FormInitialData = {
  title: string
  body: string
  destinations: { id: string; label: string }[]
  topics: string[]
  style: string | null
  extra: Record<string, string | boolean | null>
}

const s = (value: unknown): string => (value === null || value === undefined ? '' : String(value))

/**
 * Turn stored content into the values the edit form shows. Field names here are the form's
 * field names (see readContributionForm in src/lib/community/actions/contributions.ts).
 */
export async function formInitial(content: Content | null): Promise<FormInitialData> {
  if (!content) return { title: '', body: '', destinations: [], topics: [], style: null, extra: {} }
  const payload = await cms()
  const places = await destinationsByIds(content.destinations, payload)
  const extra: Record<string, string | boolean | null> = {}
  if (content.question) {
    const q = content.question
    Object.assign(extra, { travelMonth: s(q.travelMonth), durationDays: s(q.durationDays), partyType: s(q.partyType), budget: q.budgetMinor !== null && q.budgetCurrency ? amountToInput(q.budgetMinor, q.budgetCurrency) : '', budgetCurrency: s(q.budgetCurrency) })
  }
  if (content.trip) {
    const t = content.trip
    Object.assign(extra, {
      startDate: s(t.startDate), endDate: s(t.endDate), travelMonth: s(t.travelMonth), durationDays: s(t.durationDays), nights: s(t.nights), partySize: s(t.partySize), partyType: s(t.partyType),
      costScope: s(t.costScope), flightsIncluded: t.flightsIncluded, costNotes: t.costNotes, transport: t.transport, recommendations: t.recommendations, mistakes: t.mistakes, permission: t.permission,
      // Lists edited in the browser travel as JSON; amounts go back to the text a person would type.
      costsJson: JSON.stringify((content.tripCosts ?? []).map((c) => ({ ...c, amount: amountToInput(c.amountMinor, c.currency) }))),
      daysJson: JSON.stringify(await Promise.all((content.itineraryDays ?? []).map(async (d) => ({
        ...d,
        stops: await Promise.all(d.stops.map(async (st) => ({
          ...st,
          cost: st.costMinor !== null && st.costCurrency ? amountToInput(st.costMinor, st.costCurrency) : '',
          destinationLabel: st.destination ? (await destinationsByIds([st.destination], payload))[0]?.label ?? '' : '',
        }))),
      })))),
    })
  }
  if (content.trip) {
    // The post's own photos, for the photo editor. Only usable photos are listed; the edit page is
    // only shown to the author, and the service re-checks ownership of every photo on save.
    const ids = content.photos.filter(Boolean)
    const media = ids.length
      ? (await payload.find({ collection: 'media', where: { and: [{ id: { in: ids } }, { state: { in: ['pending', 'approved'] } }] }, limit: ids.length, pagination: false, depth: 0 })).docs
      : []
    const byId = new Map(media.map((m) => [m.id, { id: m.id, thumbUrl: m.sizes?.thumb?.url ?? m.url ?? '', alt: m.alt ?? '', state: m.state }]))
    extra.photosJson = JSON.stringify(ids.map((id) => byId.get(id)).filter(Boolean))
  }
  if (content.activity) {
    const a = content.activity
    Object.assign(extra, {
      category: s(a.category), format: s(a.format), venueName: a.venueName, venueAddress: a.venueAddress, timeZone: s(a.timeZone), allDay: a.allDay,
      startLocal: a.allDay ? '' : s(a.startLocal), endLocal: a.allDay ? '' : s(a.endLocal), startDate: a.allDay ? s(a.startLocal).slice(0, 10) : '', endDate: a.allDay ? s(a.endLocal).slice(0, 10) : '',
      priceState: s(a.priceState), price: a.priceMinor !== null && a.priceCurrency ? amountToInput(a.priceMinor, a.priceCurrency) : '', priceCurrency: s(a.priceCurrency),
      bookingUrl: s(a.bookingUrl), sourceUrl: s(a.sourceUrl), organiserName: a.organiserName, organiserContact: a.organiserContact, disclosure: s(a.disclosure),
      audience: a.audience, accessibility: a.accessibility, capacity: s(a.capacity),
    })
  }
  return { title: content.title, body: content.body, destinations: places.map((p) => ({ id: p.id, label: p.label })), topics: content.topics, style: content.style, extra }
}

/** Published topics members can tag posts with. Empty until editors publish topics in the CMS. */
export async function topicOptions(): Promise<{ id: string; name: string }[]> {
  const payload = await cms()
  const found = await payload.find({ collection: 'topics', sort: 'name', limit: 100, pagination: false, depth: 0, overrideAccess: false, select: { name: true } })
  return found.docs.map((t) => ({ id: t.id, name: t.name }))
}
