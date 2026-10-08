import type { Payload } from 'payload'

import {
  ACTIVITY_CATEGORIES, ACTIVITY_FORMATS, COMMERCIAL_DISCLOSURES, COST_BASES, COST_CATEGORIES, COST_KINDS, COST_SCOPES, LIMITS, PARTY_TYPES,
  PRICE_STATES, TRAVEL_STYLES, optionValues, type ContributionType,
} from './constants'
import { destinationsByIds, isUuid } from './destinations'
import type { FieldErrors } from './errors'
import { isCurrency, parseAmount } from './money'
import { bodyTooManyLinks, cleanLine, cleanText, safeHttpUrl, validYearMonth } from './text'
import { addDays, eventInstants, inclusiveDays, isLocalDate, isLocalDateTime, isTimeZone } from './time'

/**
 * The content a member can write, in one normalised shape. The same shape is:
 * - written to a contribution while it is a draft,
 * - stored as the immutable snapshot of a revision,
 * - copied onto the contribution when a moderator approves.
 *
 * Nothing in here is ever taken from the browser without being checked first, and nothing that
 * only a moderator may set (state, indexing, verification, counts) is part of it.
 */
export type Content = {
  title: string
  body: string
  language: string
  destinations: string[]
  topics: string[]
  style: string | null
  photos: string[]
  question?: { travelMonth: string | null; durationDays: number | null; partyType: string | null; budgetMinor: number | null; budgetCurrency: string | null }
  trip?: {
    startDate: string | null; endDate: string | null; travelMonth: string | null; durationDays: number | null; nights: number | null
    partySize: number | null; partyType: string | null; costScope: string | null; flightsIncluded: boolean; costNotes: string
    transport: string; recommendations: string; mistakes: string; permission: boolean
  }
  tripCosts?: { category: string; amountMinor: number; currency: string; basis: string; quantity: number; date: string | null; kind: string; note: string }[]
  itineraryDays?: { title: string; date: string | null; stops: { title: string; destination: string | null; place: string; timeNote: string; costMinor: number | null; costCurrency: string | null; description: string }[] }[]
  activity?: {
    category: string | null; format: string | null; venueName: string; venueAddress: string; timeZone: string | null; allDay: boolean
    startLocal: string | null; endLocal: string | null; startsAt: string | null; endsAt: string | null
    priceState: string | null; priceMinor: number | null; priceCurrency: string | null; bookingUrl: string | null; sourceUrl: string | null
    organiserName: string; organiserContact: string; disclosure: string; audience: string; accessibility: string; capacity: number | null
  }
}

type Raw = Record<string, unknown>

const oneOf = (value: unknown, allowed: readonly string[]): string | null => (typeof value === 'string' && allowed.includes(value) ? value : null)
const intIn = (value: unknown, min: number, max: number): number | null => {
  if (value === '' || value === null || value === undefined) return null
  const n = typeof value === 'number' ? value : Number(String(value).trim())
  return Number.isInteger(n) && n >= min && n <= max ? n : NaN
}
const truthy = (value: unknown): boolean => value === true || value === 'on' || value === 'true' || value === '1'
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
const obj = (value: unknown): Raw => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : {})

/** An optional amount with its currency. Returns undefined when the pair is wrong. */
function money(amount: unknown, currency: unknown): { minor: number | null; currency: string | null } | undefined {
  const text = typeof amount === 'number' ? String(amount) : typeof amount === 'string' ? amount.trim() : ''
  const code = typeof currency === 'string' ? currency.trim().toUpperCase() : ''
  if (!text) return { minor: null, currency: null }
  if (!isCurrency(code)) return undefined
  const minor = parseAmount(text, code)
  return minor === null ? undefined : { minor, currency: code }
}

/**
 * Check and normalise what a member sent.
 *
 * `strict` is used when the member submits for review: everything required must be present.
 * A draft save is not strict: fields may be empty, but anything filled in must still be valid.
 * `now` can be passed in tests.
 */
export async function parseContent(
  type: ContributionType,
  input: Raw,
  options: { strict: boolean; payload: Payload; now?: Date; allowPastEvent?: boolean },
): Promise<{ content: Content; errors: FieldErrors }> {
  const { strict } = options
  const errors: FieldErrors = {}
  const need = (field: string, message: string) => { if (strict) errors[field] = message }

  const title = cleanLine(input.title, LIMITS.titleMax)
  if (title.length < LIMITS.titleMin) need('title', `Write a title of at least ${LIMITS.titleMin} characters.`)
  if (/https?:\/\//i.test(title)) errors.title = 'Please do not put a link in the title.'

  const body = cleanText(input.body, LIMITS.bodyMax)
  const minBody = type === 'activity' ? 40 : LIMITS.bodyMin
  if (body.length < minBody) need('body', type === 'question' ? 'Describe your question in a few sentences so others can help.' : 'Add a description of at least a few sentences.')
  if (bodyTooManyLinks(body)) errors.body = `Please use ${LIMITS.maxLinksInBody} links or fewer.`

  const wantedDestinations = [...new Set(list(input.destinations).filter(isUuid))].slice(0, LIMITS.maxDestinations)
  const destinations = (await destinationsByIds(wantedDestinations, options.payload)).map((d) => d.id)
  if (list(input.destinations).length > LIMITS.maxDestinations) errors.destinations = `Choose up to ${LIMITS.maxDestinations} destinations.`
  else if (!destinations.length) need('destinations', 'Choose at least one destination.')

  const wantedTopics = [...new Set(list(input.topics).filter(isUuid))].slice(0, LIMITS.maxTopics)
  const topics = wantedTopics.length
    ? (await options.payload.find({ collection: 'topics', where: { and: [{ id: { in: wantedTopics } }, { _status: { equals: 'published' } }] }, limit: wantedTopics.length, pagination: false, depth: 0, select: {} })).docs.map((t) => t.id)
    : []

  const style = oneOf(input.style, optionValues(TRAVEL_STYLES))
  const photos = [...new Set(list(input.photos).filter(isUuid))].slice(0, LIMITS.maxPhotos)
  if (list(input.photos).length > LIMITS.maxPhotos) errors.photos = `Add up to ${LIMITS.maxPhotos} photos.`

  const content: Content = { title, body, language: 'en', destinations, topics, style, photos: type === 'question' ? [] : photos }

  if (type === 'question') {
    const travelMonth = typeof input.travelMonth === 'string' && input.travelMonth ? input.travelMonth : null
    if (travelMonth && !validYearMonth(travelMonth)) errors.travelMonth = 'Choose a valid month.'
    const durationDays = intIn(input.durationDays, 1, 730)
    if (Number.isNaN(durationDays)) errors.durationDays = 'Enter a whole number of days.'
    const budget = money(input.budget, input.budgetCurrency)
    if (!budget) errors.budget = 'Enter the amount as a number and choose its currency.'
    content.question = {
      travelMonth: travelMonth && validYearMonth(travelMonth) ? travelMonth : null,
      durationDays: Number.isNaN(durationDays) ? null : durationDays,
      partyType: oneOf(input.partyType, optionValues(PARTY_TYPES)),
      budgetMinor: budget?.minor ?? null,
      budgetCurrency: budget?.currency ?? null,
    }
  }

  if (type === 'trip') {
    const today = (options.now ?? new Date()).toISOString().slice(0, 10)
    const startDate = typeof input.startDate === 'string' && input.startDate ? input.startDate : null
    const endDate = typeof input.endDate === 'string' && input.endDate ? input.endDate : null
    const travelMonth = typeof input.travelMonth === 'string' && input.travelMonth ? input.travelMonth : null
    if (startDate && !isLocalDate(startDate)) errors.startDate = 'Enter a valid start date.'
    if (endDate && !isLocalDate(endDate)) errors.endDate = 'Enter a valid end date.'
    if (travelMonth && !validYearMonth(travelMonth)) errors.travelMonth = 'Choose a valid month.'
    const datesOk = !errors.startDate && !errors.endDate
    if (datesOk && startDate && endDate && endDate < startDate) errors.endDate = 'The end date is before the start date.'
    // A trip report is a first-hand account, so the trip must already have started.
    if (datesOk && startDate && startDate > addDays(today, 1)) errors.startDate = 'A trip report is about a trip you have taken. This date is in the future.'
    if (travelMonth && validYearMonth(travelMonth) && travelMonth > today.slice(0, 7)) errors.travelMonth = 'A trip report is about a trip you have taken. This month is in the future.'
    if (!startDate && !travelMonth) need('travelMonth', 'Say when you travelled: the month, or the exact dates.')

    let durationDays = intIn(input.durationDays, 1, 730)
    if (Number.isNaN(durationDays)) { errors.durationDays = 'Enter a whole number of days.'; durationDays = null }
    // Exact dates decide the length, so the two can never disagree.
    if (datesOk && startDate && endDate && !errors.endDate) durationDays = Math.min(730, inclusiveDays(startDate, endDate))
    if (durationDays === null && !errors.durationDays) need('durationDays', 'Enter how many days the trip lasted.')
    let nights = intIn(input.nights, 0, 730)
    if (Number.isNaN(nights)) { errors.nights = 'Enter a whole number of nights.'; nights = null }
    let partySize = intIn(input.partySize, 1, 100)
    if (Number.isNaN(partySize)) { errors.partySize = 'Enter how many people travelled, as a whole number.'; partySize = null }
    if (partySize === null && !errors.partySize) need('partySize', 'Enter how many people travelled.')
    const permission = truthy(input.permission)
    if (!permission) need('permission', 'Please confirm this is your own first-hand account and that it may be published.')

    const tripCosts: NonNullable<Content['tripCosts']> = []
    list(input.costs).slice(0, LIMITS.maxCostLines).forEach((entry, i) => {
      const row = obj(entry)
      const amountText = typeof row.amount === 'number' ? String(row.amount) : typeof row.amount === 'string' ? row.amount.trim() : ''
      if (!amountText && !row.category) return // an empty row left in the form
      const category = oneOf(row.category, optionValues(COST_CATEGORIES))
      const currency = typeof row.currency === 'string' ? row.currency.trim().toUpperCase() : ''
      const amountMinor = isCurrency(currency) ? parseAmount(amountText, currency) : null
      const quantity = intIn(row.quantity === '' || row.quantity == null ? 1 : row.quantity, 1, 1000)
      const date = typeof row.date === 'string' && row.date ? row.date : null
      if (!category || amountMinor === null || !quantity || Number.isNaN(quantity) || (date && !isLocalDate(date))) {
        errors[`costs.${i}`] = !isCurrency(currency) ? 'Choose the currency you paid in.' : 'Check this cost: choose a category and enter the amount as a number in that currency.'
        return
      }
      tripCosts.push({ category, amountMinor, currency, basis: oneOf(row.basis, optionValues(COST_BASES)) ?? 'total', quantity, date, kind: oneOf(row.kind, optionValues(COST_KINDS)) ?? 'measured', note: cleanLine(row.note, 200) })
    })
    if (list(input.costs).length > LIMITS.maxCostLines) errors.costs = `Add up to ${LIMITS.maxCostLines} cost lines.`
    const costScope = oneOf(input.costScope, optionValues(COST_SCOPES))
    // Without knowing whether figures are per person or for the party, costs cannot be compared honestly.
    if (tripCosts.length && !costScope) need('costScope', 'Say whether these costs are per person or for the whole party.')

    const itineraryDays: NonNullable<Content['itineraryDays']> = []
    list(input.days).slice(0, LIMITS.maxItineraryDays).forEach((entry, d) => {
      const day = obj(entry)
      const date = typeof day.date === 'string' && day.date ? day.date : null
      if (date && !isLocalDate(date)) errors[`days.${d}`] = 'Enter a valid date for this day.'
      const stops: NonNullable<Content['itineraryDays']>[number]['stops'] = []
      list(day.stops).slice(0, LIMITS.maxStopsPerDay).forEach((s, i) => {
        const stop = obj(s)
        const stopTitle = cleanLine(stop.title, 140)
        if (!stopTitle) { if (cleanText(stop.description, 10) || cleanLine(stop.place, 10)) errors[`days.${d}.stops.${i}`] = 'Give this stop a name.'; return }
        const cost = money(stop.cost, stop.costCurrency)
        if (!cost) errors[`days.${d}.stops.${i}`] = 'Enter the cost as a number and choose its currency.'
        stops.push({
          title: stopTitle,
          destination: isUuid(stop.destination) ? stop.destination : null,
          place: cleanLine(stop.place, 200),
          timeNote: cleanLine(stop.timeNote, 200),
          costMinor: cost?.minor ?? null,
          costCurrency: cost?.currency ?? null,
          description: cleanText(stop.description, LIMITS.longTextMax),
        })
      })
      const dayTitle = cleanLine(day.title, 140)
      if (dayTitle || stops.length) itineraryDays.push({ title: dayTitle, date: date && isLocalDate(date) ? date : null, stops })
    })
    if (list(input.days).length > LIMITS.maxItineraryDays) errors.days = `Add up to ${LIMITS.maxItineraryDays} days.`
    // A stop may only point at a real destination record.
    const stopDestinations = new Set((await destinationsByIds(itineraryDays.flatMap((d) => d.stops.map((s) => s.destination)), options.payload)).map((d) => d.id))
    itineraryDays.forEach((d) => d.stops.forEach((s) => { if (s.destination && !stopDestinations.has(s.destination)) s.destination = null }))

    content.trip = {
      startDate: startDate && !errors.startDate ? startDate : null,
      endDate: endDate && !errors.endDate ? endDate : null,
      travelMonth: travelMonth && !errors.travelMonth ? travelMonth : startDate && !errors.startDate ? startDate.slice(0, 7) : null,
      durationDays, nights, partySize,
      partyType: oneOf(input.partyType, optionValues(PARTY_TYPES)),
      costScope,
      flightsIncluded: truthy(input.flightsIncluded),
      costNotes: cleanText(input.costNotes, LIMITS.longTextMax),
      transport: cleanText(input.transport, LIMITS.longTextMax),
      recommendations: cleanText(input.recommendations, LIMITS.longTextMax),
      mistakes: cleanText(input.mistakes, LIMITS.longTextMax),
      permission,
    }
    content.tripCosts = tripCosts
    content.itineraryDays = itineraryDays
  }

  if (type === 'activity') {
    const category = oneOf(input.category, ACTIVITY_CATEGORIES.map((c) => c.value))
    if (!category) need('category', 'Choose what kind of activity this is.')
    const format = oneOf(input.format, optionValues(ACTIVITY_FORMATS)) ?? 'in_person'
    const venueName = cleanLine(input.venueName, 200)
    const venueAddress = cleanLine(input.venueAddress, 300)
    if (format === 'in_person' && !venueName && !venueAddress) need('venueName', 'Enter the public venue or meeting point. Never use a private home address.')
    const timeZone = typeof input.timeZone === 'string' && isTimeZone(input.timeZone) ? input.timeZone : null
    if (!timeZone) need('timeZone', 'Choose the time zone of the venue.')
    const allDay = truthy(input.allDay)
    const valid = allDay ? isLocalDate : isLocalDateTime
    const rawStart = typeof input.startLocal === 'string' ? input.startLocal.slice(0, allDay ? 10 : 16) : ''
    const rawEnd = typeof input.endLocal === 'string' ? input.endLocal.slice(0, allDay ? 10 : 16) : ''
    let startLocal: string | null = null
    let endLocal: string | null = null
    if (rawStart && !valid(rawStart)) errors.startLocal = 'Enter a valid start date and time.'
    else if (rawStart) startLocal = rawStart
    else need('startLocal', allDay ? 'Enter the date.' : 'Enter the start date and time.')
    if (rawEnd && !valid(rawEnd)) errors.endLocal = 'Enter a valid end date and time.'
    else if (rawEnd) endLocal = rawEnd
    if (startLocal && endLocal && endLocal < startLocal) { errors.endLocal = 'The end is before the start.'; endLocal = null }

    let startsAt: string | null = null
    let endsAt: string | null = null
    if (startLocal && timeZone) {
      const times = eventInstants({ allDay, startLocal, endLocal, timeZone })
      startsAt = times.startsAt.toISOString()
      endsAt = times.endsAt ? times.endsAt.toISOString() : null
      const over = (times.endsAt ?? new Date(times.startsAt.getTime() + 4 * 3_600_000)).getTime()
      // A listing is reviewed before it appears, so one that is already over cannot be submitted.
      if (strict && !options.allowPastEvent && over <= (options.now ?? new Date()).getTime()) errors.startLocal = 'This activity has already finished. Submit activities that are still to come.'
    }

    const priceState = oneOf(input.priceState, optionValues(PRICE_STATES))
    if (!priceState) need('priceState', 'Say whether it is free, paid or not known.')
    const price = priceState === 'paid' ? money(input.price, input.priceCurrency) : { minor: null, currency: null }
    if (!price) errors.price = 'Enter the price as a number and choose its currency.'

    const urlField = (field: 'bookingUrl' | 'sourceUrl'): string | null => {
      const value = typeof input[field] === 'string' ? (input[field] as string).trim() : ''
      if (!value) return null
      const url = safeHttpUrl(value)
      if (!url) errors[field] = 'Enter a full web address starting with https://'
      return url
    }
    const bookingUrl = urlField('bookingUrl')
    const sourceUrl = urlField('sourceUrl')
    if (category === 'public_event' && !sourceUrl && !bookingUrl) need('sourceUrl', 'Add a link where the event details can be checked.')
    const organiserName = cleanLine(input.organiserName, 140)
    if (!organiserName) need('organiserName', 'Enter who organises it.')
    const organiserContact = cleanLine(input.organiserContact, 200)
    if (!organiserContact) need('organiserContact', 'Enter a contact a moderator can use to check the listing. It is never shown publicly.')
    let capacity = intIn(input.capacity, 1, 100000)
    if (Number.isNaN(capacity)) { errors.capacity = 'Enter the capacity as a whole number, or leave it empty.'; capacity = null }
    let disclosure = oneOf(input.disclosure, optionValues(COMMERCIAL_DISCLOSURES)) ?? 'none'
    // A commercial listing always carries at least the "business" disclosure.
    if (category === 'commercial_activity' && disclosure === 'none') disclosure = 'business'

    content.activity = {
      category, format, venueName, venueAddress, timeZone, allDay, startLocal, endLocal, startsAt, endsAt,
      priceState, priceMinor: price?.minor ?? null, priceCurrency: price?.currency ?? null, bookingUrl, sourceUrl,
      organiserName, organiserContact, disclosure,
      audience: cleanLine(input.audience, 200),
      accessibility: cleanText(input.accessibility, 1000),
      capacity,
    }
  }

  return { content, errors }
}

/** The public text of approved content, joined for full-text search. Private fields are never included. */
export function buildSearchText(content: Content, destinationNames: string[]): string {
  const parts: (string | null | undefined)[] = [content.body, ...destinationNames]
  if (content.trip) parts.push(content.trip.transport, content.trip.recommendations, content.trip.mistakes, content.trip.costNotes)
  for (const day of content.itineraryDays ?? []) {
    parts.push(day.title)
    for (const stop of day.stops) parts.push(stop.title, stop.place, stop.description)
  }
  if (content.activity) parts.push(content.activity.venueName, content.activity.venueAddress, content.activity.organiserName, content.activity.audience, content.activity.accessibility)
  return parts.filter(Boolean).join('\n').slice(0, 60000)
}
