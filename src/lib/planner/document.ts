import type { PlanView } from '../community/plans'
import { FUNDING } from './details'
import type { BudgetGuide, PlaceLeg } from './extras'

/**
 * One description of a plan's printable document, used by both the on-screen preview and the PDF,
 * so what the member checks is exactly what they download.
 *
 * Two layouts:
 * - "holiday" (holiday, family and business plans): readable days with activities, getting around,
 *   overnight places, budget arithmetic and links.
 * - "visa": a restrained proposed itinerary with the trip details and a day table, where every
 *   arrangement is either "Confirmed (provided by the traveller)" or "Proposed – to be confirmed".
 *
 * Nothing is added that the member did not enter or the plan does not hold: no booking references,
 * no prices, no invented arrangements.
 */

export type DocStop = { time: string; title: string; place: string; notes: string; label: string; link: string | null }
export type DocDay = { number: number; date: string | null; dateLabel: string; title: string; overnight: string; overnightStatus: 'confirmed' | 'proposed' | 'none'; transport: string; stops: DocStop[] }
export type DocModel = {
  layout: 'holiday' | 'visa'
  title: string
  subtitle: string
  generatedOn: string
  site: string
  facts: { label: string; value: string }[]
  summary: string[]
  checks: string[]
  days: DocDay[]
  options: { label: string; summary: string; choices: string[] }[]
  budget: string[]
  legs: string[]
  disclaimer: string
}

const PURPOSE_LABEL = { holiday: 'Holiday', visa: 'Visitor visa itinerary', family: 'Visiting family or friends', business: 'Business with some leisure' } as const
const OPTION_LABEL = { budget: 'Budget-friendly', balanced: 'Balanced', premium: 'Premium' } as const
const TIME_LABEL = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' } as const

export const fmtDocDate = (d: string | null): string => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '')
const fmtShort = (d: string | null): string => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '')
const money = (n: number, c: string) => `${c} ${n.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`

export function documentModel(plan: PlanView, extras: { budget: BudgetGuide | null; legs: PlaceLeg[]; site: string; now?: Date }): DocModel {
  const layout = plan.purpose === 'visa' ? 'visa' : 'holiday'
  const generatedOn = (extras.now ?? new Date()).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' })
  const [summaryText, ...rest] = plan.ai.summary.split('\n')
  const checks = rest.map((l) => l.replace(/^•\s*/, '').trim()).filter(Boolean)

  const days: DocDay[] = plan.days.map((d, i) => ({
    number: i + 1,
    date: d.date,
    dateLabel: fmtDocDate(d.date),
    title: d.title,
    overnight: d.overnight,
    overnightStatus: !d.overnight ? 'none' : d.overnightConfirmed ? 'confirmed' : 'proposed',
    transport: d.transport,
    stops: d.stops.map((s) => ({
      time: s.timeOfDay ? TIME_LABEL[s.timeOfDay] : '',
      title: s.title,
      place: s.place,
      notes: s.notes,
      label: s.origin === 'ai_idea' ? 'AI suggestion, not checked by Travel Notes' : s.origin === 'travel_notes' ? 'From Travel Notes' : '',
      link: s.origin === 'travel_notes' && s.sourcePath ? `${extras.site}${s.sourcePath}` : s.saved ? `${extras.site}${s.saved.path}` : null,
    })),
  }))

  const facts: { label: string; value: string }[] = []
  if (layout === 'visa') {
    const v = plan.visa
    if (v.travellerName) facts.push({ label: 'Traveller', value: v.travellerName })
    facts.push({ label: 'Purpose of visit', value: v.visitPurpose || 'Tourism' })
    if (v.arrivalDate) facts.push({ label: 'Planned arrival', value: fmtShort(v.arrivalDate) })
    if (v.departureDate) facts.push({ label: 'Planned departure', value: fmtShort(v.departureDate) })
    if (v.cities) facts.push({ label: 'Cities', value: v.cities })
    if (plan.details.travellers) facts.push({ label: 'Number of travellers', value: String(plan.details.travellers) })
    if (v.funding) facts.push({ label: 'Trip paid for by', value: `${FUNDING.find((f) => f.value === v.funding)?.label ?? v.funding}${v.fundingNote ? ` (${v.fundingNote})` : ''}` })
    if (v.accommodation) facts.push({ label: 'Accommodation (as provided by the traveller)', value: v.accommodation })
    if (v.transport) facts.push({ label: 'Travel arrangements (as provided by the traveller)', value: v.transport })
  } else {
    facts.push({ label: 'Trip', value: PURPOSE_LABEL[plan.purpose] })
    if (plan.startDate) facts.push({ label: 'Dates', value: `${fmtShort(plan.startDate)}${plan.endDate ? ` to ${fmtShort(plan.endDate)}` : ''}` })
    facts.push({ label: 'Days', value: String(plan.days.length) })
    if (plan.details.travellers) facts.push({ label: 'Travellers', value: String(plan.details.travellers) })
    if (plan.details.departFrom) facts.push({ label: 'Travelling from', value: plan.details.departFrom })
  }

  const budget: string[] = []
  if (extras.budget && layout === 'holiday') {
    const b = extras.budget
    budget.push(`Your budget: ${money(b.total, b.currency)} for ${b.days} days, about ${money(b.perDay, b.currency)} a day${b.perPersonPerDay !== null ? ` or ${money(b.perPersonPerDay, b.currency)} per person a day` : ''}.`)
    budget.push('This is your own budget divided by days and people. It is not a quote or a price check.')
  }

  return {
    layout,
    title: layout === 'visa' ? 'Proposed travel itinerary' : plan.title,
    subtitle: layout === 'visa' ? plan.title : PURPOSE_LABEL[plan.purpose],
    generatedOn,
    site: extras.site.replace(/^https?:\/\//, ''),
    facts,
    summary: summaryText ? [summaryText] : [],
    checks,
    days,
    options: layout === 'holiday' ? plan.ai.options.map((o) => ({ label: OPTION_LABEL[o.style], summary: o.summary, choices: o.choices.split('\n').map((c) => c.replace(/^[-•]\s*/, '').trim()).filter(Boolean) })) : [],
    budget,
    legs: extras.legs.map((l) => `${l.from} to ${l.to}: about ${l.km.toLocaleString('en-AU')} km in a straight line (the real journey is longer).`),
    disclaimer: layout === 'visa'
      ? 'This is a proposed travel itinerary prepared by the traveller with the Travel Notes Trip Planner. Only arrangements marked "Confirmed" were provided by the traveller as booked; everything else is proposed and to be confirmed. It is not a booking confirmation or an official document, and it does not guarantee that a visa will be granted. Check the current requirements of the relevant authority before you apply.'
      : 'Suggestions marked "AI suggestion" have not been checked by Travel Notes. Check prices, opening hours, bookings and entry rules with official sources before you travel. This plan does not include any bookings.',
  }
}
