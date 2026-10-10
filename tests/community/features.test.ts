/**
 * Acceptance tests 7 to 15 (brief §19): money, itinerary copies, event times, hostile input and
 * uploads, removal, search, indexing rules, notifications, and account deletion and export.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'
import sharp from 'sharp'

import {
  activityInput, administrator, approvedReply, asUser, captured, moderator, newMember, openCommunity, payload, places, published, questionInput, rejects, setup,
  tripInput, unique, visibleRows, type Any,
} from './helpers'

let author: Any, reader: Any, third: Any
let C: Any, M: Any, Q: Any, R: Any, E: Any, P: Any, S: Any, SEO: Any, MEM: Any, MEDIA: Any, MONEY: Any, TIME: Any, TEXT: Any, OUT: Any, SITEMAP: Any, JOBS: Any

before(async () => {
  await setup()
  C = await import('../../src/lib/community/contributions')
  M = await import('../../src/lib/community/moderation')
  Q = await import('../../src/lib/community/queries')
  R = await import('../../src/lib/community/replies')
  E = await import('../../src/lib/community/engagement')
  P = await import('../../src/lib/community/plans')
  S = await import('../../src/lib/community/search')
  SEO = await import('../../src/lib/community/seo')
  MEM = await import('../../src/lib/community/members')
  MEDIA = await import('../../src/lib/community/media')
  MONEY = await import('../../src/lib/community/money')
  TIME = await import('../../src/lib/community/time')
  TEXT = await import('../../src/lib/community/text')
  OUT = await import('../../src/lib/community/email/outbox')
  SITEMAP = await import('../../src/lib/community/sitemap')
  JOBS = await import('../../src/lib/community/jobs')
  author = await newMember('Author')
  reader = await newMember('Reader')
  third = await newMember('Third')
})

describe('7. trip costs', () => {
  it('amounts are exact whole numbers of the smallest unit, per currency', () => {
    assert.equal(MONEY.parseAmount('1,250.50', 'USD'), 125050)
    assert.equal(MONEY.parseAmount('1250', 'JPY'), 1250)
    assert.equal(MONEY.parseAmount('10.5', 'JPY'), null, 'yen has no decimals: a typing mistake is refused, not rounded')
    assert.equal(MONEY.parseAmount('1.234', 'KWD'), 1234, 'Kuwaiti dinar has three decimals')
    assert.equal(MONEY.parseAmount('1.234', 'USD'), null)
    assert.equal(MONEY.parseAmount('-5', 'USD'), null)
    assert.equal(MONEY.parseAmount('abc', 'USD'), null)
    assert.equal(MONEY.parseAmount('0.10', 'USD')! + MONEY.parseAmount('0.20', 'USD')!, 30, '0.10 + 0.20 is exactly 0.30')
    assert.equal(MONEY.formatMoney(125050, 'USD'), 'USD 1,250.50')
    assert.equal(MONEY.formatMoney(1250, 'JPY'), 'JPY 1,250')
    assert.equal(MONEY.amountToInput(1234, 'KWD'), '1.234')
    assert.equal(MONEY.isCurrency('XXZ'), false)
  })

  it('different currencies are totalled separately and never added together', () => {
    const totals = MONEY.totalsByCurrency([
      { amountMinor: 12050, currency: 'USD', quantity: 4 }, { amountMinor: 9000, currency: 'JPY' }, { amountMinor: 1999, currency: 'USD' }, { amountMinor: 500, currency: 'JPY', quantity: 3 },
    ])
    assert.deepEqual(totals, [{ currency: 'JPY', totalMinor: 10500 }, { currency: 'USD', totalMinor: 50199 }])
    assert.equal(MONEY.perPerson(50199, 2), 25099, 'a per-person figure is a whole number of cents; the odd cent is not invented')
  })

  it('costs need a scope (per person or per party) before a report can be submitted', async () => {
    const costs = [
      { category: 'accommodation', amount: '120.50', currency: 'usd', basis: 'per_night', quantity: 4, kind: 'measured' },
      { category: 'food', amount: '9000', currency: 'JPY', kind: 'estimate', note: 'Roughly, for both of us' },
      { category: '', amount: '' },
    ]
    const error = await rejects(C.saveContribution(author, { type: 'trip', input: tripInput({ costs }), intent: 'submit' }), 'validation')
    assert.ok(error.fields.costScope, 'the form asks whether figures are per person or per party')
    const bad = await rejects(C.saveContribution(author, { type: 'trip', input: tripInput({ costScope: 'per_party', costs: [{ category: 'food', amount: '10.5', currency: 'JPY' }] }), intent: 'submit' }), 'validation')
    assert.ok(bad.fields['costs.0'])
    const noCurrency = await rejects(C.saveContribution(author, { type: 'trip', input: tripInput({ costScope: 'per_party', costs: [{ category: 'food', amount: '10', currency: 'ZZZ' }] }), intent: 'submit' }), 'validation')
    assert.match(noCurrency.fields['costs.0'], /currency/)

    const trip = await published(author, 'trip', tripInput({ title: 'Kyoto with every cost written down', costScope: 'per_party', flightsIncluded: false, nights: 4, costs, costNotes: 'Flights not included.' }))
    const page = await Q.getPublished(trip.shortId)
    assert.equal(page.tripDetail.costs.length, 2, 'the empty row is dropped')
    assert.deepEqual(page.tripDetail.totals, [{ currency: 'JPY', totalMinor: 9000 }, { currency: 'USD', totalMinor: 48200 }])
    assert.equal(page.tripDetail.costScope, 'per_party')
    assert.equal(page.tripDetail.flightsIncluded, false)
    assert.equal(page.tripDetail.hasEstimates, true, 'estimates are told apart from measured spending')
    assert.equal(page.trip.partySize, 2)
  })

  it('a trip report must be about a trip that has happened, with the author’s permission', async () => {
    const future = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10)
    const a = await rejects(C.saveContribution(author, { type: 'trip', input: tripInput({ startDate: future, endDate: future, travelMonth: '' }), intent: 'submit' }), 'validation')
    assert.ok(a.fields.startDate)
    const b = await rejects(C.saveContribution(author, { type: 'trip', input: tripInput({ permission: false }), intent: 'submit' }), 'validation')
    assert.ok(b.fields.permission)
    // Exact dates decide the duration, across a month boundary.
    const saved = await C.saveContribution(author, { type: 'trip', input: tripInput({ startDate: '2026-02-26', endDate: '2026-03-02', travelMonth: '', durationDays: 99 }), intent: 'save' })
    assert.equal((await payload.findByID({ collection: 'contributions', id: saved.id, depth: 0 }) as Any).trip.durationDays, 5)
  })
})

describe('8. copying an itinerary into a private plan', () => {
  it('the copy is the member’s own, credits the source, and never changes the original', async () => {
    const days = [
      { title: 'Arrival and Gion', stops: [{ title: 'Yasaka Shrine', place: 'Gion', timeNote: 'About an hour', description: 'Best after dark.', destination: places.kyoto.id }, { title: 'Dinner in Pontocho' }] },
      { title: 'Arashiyama', date: '2026-04-11', stops: [{ title: 'Bamboo grove', cost: '0', costCurrency: 'JPY' }, { title: '', description: '' }] },
    ]
    const trip = await published(author, 'trip', tripInput({ title: 'Kyoto itinerary to be copied', days }))
    const page = await Q.getPublished(trip.shortId)
    assert.equal(page.tripDetail.days.length, 2)
    assert.equal(page.tripDetail.days[0].stops[0].destination.label, 'Kyoto, Japan')
    assert.equal(page.tripDetail.days[1].stops.length, 1, 'an empty stop row is dropped')

    const { id } = await P.copyItinerary(reader, trip.id)
    const plan = await P.getPlan(reader, id)
    assert.equal(plan.days.length, 2)
    assert.equal(plan.days[0].stops[0].title, 'Yasaka Shrine')
    assert.equal(plan.source.authorName, 'Author')
    assert.equal(plan.source.title, 'Kyoto itinerary to be copied')
    assert.equal(plan.source.path, page.path)

    await P.updatePlan(reader, id, { title: 'My own Kyoto plan', days: [{ title: 'Changed day', stops: [{ title: 'Changed stop', notes: 'my private note' }] }] })
    const original = await Q.getPublished(trip.shortId)
    assert.equal(original.tripDetail.days[0].stops[0].title, 'Yasaka Shrine', 'editing the plan did not touch the report')
    assert.equal(original.title, 'Kyoto itinerary to be copied')
    assert.ok(!JSON.stringify(original).includes('my private note'))

    // The author later changes the report: the reader's snapshot stays as it is, with its credit.
    await C.saveContribution(author, { id: trip.id, type: 'trip', input: tripInput({ title: 'Kyoto itinerary to be copied', days: [{ title: 'Rewritten', stops: [{ title: 'Different stop' }] }] }), intent: 'submit' })
    await M.decideContribution(moderator(), trip.id, { decision: 'approve' })
    const mine = await P.getPlan(reader, id)
    assert.equal(mine.days[0].stops[0].title, 'Changed stop')
    assert.equal(mine.source.authorName, 'Author')

    await rejects(P.getPlan(author, id), 'not_found', 'the report’s author cannot open the reader’s plan')
    await rejects(P.getPlan(third, id), 'not_found')
    assert.equal((await visibleRows('plans', asUser(third, 'members'))).length, 0)
  })

  it('only a published report with an itinerary can be copied', async () => {
    const draft = await C.saveContribution(author, { type: 'trip', input: tripInput({ days: [{ title: 'Day', stops: [{ title: 'Stop' }] }] }), intent: 'save' })
    await rejects(P.copyItinerary(reader, draft.id), 'not_found')
    const noDays = await published(author, 'trip', tripInput({ title: 'A report with no itinerary at all' }))
    await rejects(P.copyItinerary(reader, noDays.id), 'conflict')
  })
})

describe('9. event dates, time zones and status changes', () => {
  it('local times convert to the right instant, including daylight-saving edge cases', () => {
    assert.equal(TIME.zonedToUtc('2026-11-20T18:30', 'Asia/Bangkok').toISOString(), '2026-11-20T11:30:00.000Z')
    // Sydney, 4 October 2026: clocks jump from 02:00 to 03:00, so 02:30 does not exist. It is moved forward to 03:30.
    assert.equal(TIME.zonedToUtc('2026-10-04T02:30', 'Australia/Sydney').toISOString(), '2026-10-03T16:30:00.000Z')
    assert.equal(TIME.toLocalDateTime(new Date('2026-10-03T16:30:00Z'), 'Australia/Sydney'), '2026-10-04T03:30')
    // New York, 1 November 2026: 01:30 happens twice. The first one (daylight time, UTC-4) is used.
    assert.equal(TIME.zonedToUtc('2026-11-01T01:30', 'America/New_York').toISOString(), '2026-11-01T05:30:00.000Z')
    // The day before and after a change are not shifted.
    assert.equal(TIME.zonedToUtc('2026-10-03T12:00', 'Australia/Sydney').toISOString(), '2026-10-03T02:00:00.000Z')
    assert.equal(TIME.zonedToUtc('2026-10-04T12:00', 'Australia/Sydney').toISOString(), '2026-10-04T01:00:00.000Z')
    assert.equal(TIME.isTimeZone('Mars/Olympus'), false)
    assert.equal(TIME.isLocalDate('2026-02-30'), false)
  })

  it('an all-day event covers the whole local day, wherever it is, and across the date line', () => {
    const kiritimati = TIME.eventInstants({ allDay: true, startLocal: '2026-12-31', endLocal: '2027-01-01', timeZone: 'Pacific/Kiritimati' })
    assert.equal(kiritimati.startsAt.toISOString(), '2026-12-30T10:00:00.000Z')
    assert.equal(kiritimati.endsAt.toISOString(), '2027-01-01T10:00:00.000Z')
    const honolulu = TIME.eventInstants({ allDay: true, startLocal: '2026-12-31', timeZone: 'Pacific/Honolulu' })
    assert.equal(honolulu.startsAt.toISOString(), '2026-12-31T10:00:00.000Z')
    assert.equal(honolulu.endsAt.toISOString(), '2027-01-01T10:00:00.000Z')
    // A 23-hour local day (clocks go forward) is still exactly one local day.
    const sydney = TIME.eventInstants({ allDay: true, startLocal: '2026-10-04', timeZone: 'Australia/Sydney' })
    assert.equal((sydney.endsAt.getTime() - sydney.startsAt.getTime()) / 3_600_000, 23)
    assert.equal(TIME.inclusiveDays('2026-02-26', '2026-03-02'), 5)
  })

  it('stores the instant, the local time and the zone, and refuses events that are already over', async () => {
    const event = await published(author, 'activity', activityInput({ title: 'A dated walk stored with its time zone' }))
    const page = await Q.getPublished(event.shortId)
    assert.equal(page.activity.timeZone, 'Asia/Bangkok')
    assert.equal(new Date(page.activity.startsAt).toISOString(), TIME.zonedToUtc(page.activity.startLocal, 'Asia/Bangkok').toISOString())
    assert.equal(page.activity.status, 'scheduled')
    const past = await rejects(C.saveContribution(author, { type: 'activity', input: activityInput({}, -3), intent: 'submit' }), 'validation')
    assert.match(past.fields.startLocal, /already finished/)
    const zone = await rejects(C.saveContribution(author, { type: 'activity', input: activityInput({ timeZone: 'Not/AZone' }), intent: 'submit' }), 'validation')
    assert.ok(zone.fields.timeZone)
    const order = await rejects(C.saveContribution(author, { type: 'activity', input: activityInput({ endLocal: '2020-01-01T10:00' }), intent: 'submit' }), 'validation')
    assert.ok(order.fields.endLocal)
  })

  it('an event that has finished stops being "upcoming" even if the scheduled job never ran', async () => {
    const event = await published(author, 'activity', activityInput({ title: 'A walk that will be over in a moment' }))
    const { run, sql } = await import('../../src/lib/community/db')
    await run(payload, sql`UPDATE "contributions" SET "activity_starts_at" = now() - interval '3 hours', "activity_ends_at" = now() - interval '1 hour' WHERE "id" = ${event.id}::uuid`)
    assert.equal((await payload.findByID({ collection: 'contributions', id: event.id, depth: 0 }) as Any).activity.eventStatus, 'scheduled', 'the stored status has not been touched yet')
    assert.equal((await Q.getPublished(event.shortId)).activity.status, 'ended', 'the page works it out from the clock')
    assert.ok(!(await Q.listPublished({ type: 'activity' })).items.some((c: Any) => c.id === event.id), 'not in upcoming')
    assert.ok((await Q.listPublished({ type: 'activity', when: 'past' })).items.some((c: Any) => c.id === event.id), 'kept as a past event')
    await rejects(E.setRsvp(reader, { activityId: event.id, status: 'going' }), 'conflict')

    const { markEndedEvents } = await import('../../src/lib/community/events')
    assert.ok((await markEndedEvents()) >= 1)
    assert.equal(await markEndedEvents(), 0, 'running the job again changes nothing')
    assert.equal((await payload.findByID({ collection: 'contributions', id: event.id, depth: 0 }) as Any).activity.eventStatus, 'ended')
    assert.equal((await Q.getPublished(event.shortId)).title, 'A walk that will be over in a moment', 'an ended event keeps its page')
  })

  it('date filters mean real overlap with the period', async () => {
    const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
    const festival = await published(author, 'activity', activityInput({ title: 'A three-day festival for overlap tests', allDay: true, startLocal: day(20), endLocal: day(22) }))
    const has = async (from: number, to: number) => (await Q.listPublished({ type: 'activity', when: null, from: new Date(`${day(from)}T00:00:00Z`), to: new Date(`${day(to)}T00:00:00Z`) })).items.some((c: Any) => c.id === festival.id)
    assert.equal(await has(21, 22), true, 'a period inside the festival')
    assert.equal(await has(15, 21), true, 'a period that ends during it')
    assert.equal(await has(22, 30), true, 'a period that starts on its last day')
    assert.equal(await has(10, 19), false, 'a period that ends before it')
    assert.equal(await has(24, 30), false, 'a period that starts after it')
  })

  it('a full activity refuses new "going" responses but still allows interest', async () => {
    const event = await published(author, 'activity', activityInput({ title: 'A small walk with one place', capacity: 1 }))
    await E.setRsvp(reader, { activityId: event.id, status: 'going' })
    await rejects(E.setRsvp(third, { activityId: event.id, status: 'going' }), 'conflict', 'the only place is taken')
    assert.equal((await E.setRsvp(third, { activityId: event.id, status: 'interested' })).going, 1)
    assert.equal((await E.setRsvp(reader, { activityId: event.id, status: 'going', showPublicly: true })).going, 1, 'someone already going can update their response')
    await E.setRsvp(reader, { activityId: event.id, status: null })
    assert.equal((await E.setRsvp(third, { activityId: event.id, status: 'going' })).going, 1, 'a freed place can be taken')
  })

  it('cancelling updates the public page at once and tells people who responded, respecting opt-outs', async () => {
    const event = await published(author, 'activity', activityInput({ title: 'A walk that gets cancelled' }))
    await E.setRsvp(reader, { activityId: event.id, status: 'going', showPublicly: true })
    await E.setRsvp(third, { activityId: event.id, status: 'interested' })
    await MEM.updateEmailPrefs(third, { events: false })
    assert.deepEqual((await E.publicAttendees(event.id)).map((a: Any) => a.displayName), ['Reader'], 'only people who opted in are named')

    await rejects(C.setOwnEventStatus(reader, event.id, { status: 'cancelled', note: 'not mine' }), 'not_found', 'only the organiser can cancel')
    await C.setOwnEventStatus(author, event.id, { status: 'cancelled', note: 'Heavy rain forecast.' })
    const page = await Q.getPublished(event.shortId)
    assert.equal(page.activity.status, 'cancelled')
    assert.equal(page.activity.statusNote, 'Heavy rain forecast.')
    assert.ok(!(await Q.listPublished({ type: 'activity' })).items.some((c: Any) => c.id === event.id), 'a cancelled event is not listed as upcoming')

    const notes = await payload.find({ collection: 'notifications', where: { and: [{ type: { equals: 'event_changed' } }, { path: { like: event.shortId } }] }, depth: 0 })
    assert.deepEqual(notes.docs.map((n: Any) => n.recipient).sort(), [reader.id, third.id].sort(), 'both are told in the app')
    assert.equal((await captured(reader.id, 'event_changed')).filter((m: Any) => m.status === 'captured').length, 1)
    const optedOut = await captured(third.id, 'event_changed')
    assert.ok(optedOut.every((m: Any) => m.status === 'suppressed'), 'no email for the member who switched event email off')

    await C.setOwnEventStatus(author, event.id, { status: 'cancelled', note: 'again' })
    assert.equal((await captured(reader.id, 'event_changed')).length, 1, 'cancelling twice does not notify twice')
    await rejects(E.setRsvp(third, { activityId: event.id, status: 'going' }), 'conflict')
    const log = await payload.find({ collection: 'moderation-actions', where: { and: [{ contribution: { equals: event.id } }, { action: { equals: 'event_status' } }] }, depth: 0 })
    assert.equal(log.totalDocs, 1)
    assert.equal(log.docs[0].actorType, 'member')
  })

  it('a new date is reviewed first, then shown as rescheduled with the original date kept', async () => {
    const event = await published(author, 'activity', activityInput({ title: 'A walk that gets a new date' }, 12))
    const first = (await Q.getPublished(event.shortId)).activity.startLocal
    await E.setRsvp(reader, { activityId: event.id, status: 'going' })
    const newStart = `${new Date(Date.now() + 15 * 86_400_000).toISOString().slice(0, 10)}T18:30`
    await C.saveContribution(author, { id: event.id, type: 'activity', input: activityInput({ title: 'A walk that gets a new date', startLocal: newStart, endLocal: newStart.replace('18:30', '20:30') }), intent: 'submit' })
    assert.equal((await Q.getPublished(event.shortId)).activity.startLocal, first, 'the approved date stays until the change is reviewed')
    assert.equal((await captured(reader.id, 'event_changed')).filter((m: Any) => JSON.stringify(m.data).includes('new date')).length, 0)
    await M.decideContribution(moderator(), event.id, { decision: 'approve' })
    const page = await Q.getPublished(event.shortId)
    assert.equal(page.activity.startLocal, newStart)
    assert.equal(page.activity.status, 'rescheduled')
    assert.equal(page.activity.originalStartLocal, first)
    assert.equal((await captured(reader.id, 'event_changed')).filter((m: Any) => JSON.stringify(m.data).includes('gets a new date')).length, 1)
    // A moderator can also set a status, for example after a report.
    await M.moderateEventStatus(moderator(), event.id, { status: 'postponed', note: 'Organiser confirmed by email.' })
    assert.equal((await Q.getPublished(event.shortId)).activity.status, 'postponed')
  })
})

describe('10. hostile input and uploads', () => {
  const attack = '<script>alert("x")</script><img src=x onerror=alert(1)> Hello </script><!-- and a javascript:alert(1) link plus https://example.org/page.'

  it('member text is stored and returned as plain text, and structured data cannot be broken out of', async () => {
    const post = await published(author, 'question', questionInput({ title: 'Is this <b>title</b> shown as plain text?', body: `${attack} ${'More words so the body is long enough to submit.'}` }))
    const page = await Q.getPublished(post.shortId)
    assert.ok(page.body.includes('<script>'), 'nothing is rendered as HTML, so nothing needs to be stripped: it is text')
    await approvedReply(reader, post.id, 'An answer with </script><script>alert(2)</script> inside it, to test structured data.')
    const answers = (await R.listReplies(post.id)).items
    const json = SEO.jsonLdScript(SEO.questionJsonLd(await Q.getPublished(post.shortId), answers))
    assert.ok(!json.includes('</script>'), 'the closing tag cannot appear inside the JSON-LD block')
    assert.ok(!json.includes('<'), 'every "<" is escaped')
    assert.equal(JSON.parse(json).mainEntity.name, 'Is this <b>title</b> shown as plain text?', 'and it still parses back to the same text')
  })

  it('only real http(s) links become links', () => {
    const parts = TEXT.linkParts('See javascript:alert(1) and data:text/html,<b>x</b> and https://example.org/a?b=1). Or HTTP://EXAMPLE.COM/x.')
    const links = parts.filter((p: Any) => p.kind === 'link').map((p: Any) => p.href)
    assert.deepEqual(links, ['https://example.org/a?b=1', 'http://example.com/x'])
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'vbscript:x', 'file:///etc/passwd', 'https://user:pass@example.org/', '//example.org', 'ftp://example.org/x', 'https://localhost/', '']) {
      assert.equal(TEXT.safeHttpUrl(bad), null, `${bad} is refused`)
    }
    assert.equal(TEXT.cleanText('a\u0000b‮c\r\nd\n\n\n\ne', 100), 'abc\nd\n\ne', 'control and direction-override characters are removed')
  })

  it('links in fields are validated, and the server never fetches a member’s link', async () => {
    const realFetch = globalThis.fetch
    let fetched = 0
    globalThis.fetch = (async () => { fetched++; throw new Error('the server must not fetch member links') }) as Any
    try {
      const bad = await rejects(C.saveContribution(author, { type: 'activity', input: activityInput({ bookingUrl: 'javascript:alert(1)', sourceUrl: 'not a link' }), intent: 'submit' }), 'validation')
      assert.ok(bad.fields.bookingUrl && bad.fields.sourceUrl)
      const inTitle = await rejects(C.saveContribution(author, { type: 'question', input: questionInput({ title: 'Cheap deals at https://spam.example.test today' }), intent: 'submit' }), 'validation')
      assert.ok(inTitle.fields.title)
      const many = await rejects(C.saveContribution(author, { type: 'question', input: questionInput({ body: Array.from({ length: 9 }, (_, i) => `https://spam${i}.example.test`).join(' ') + ' and enough words to be a body.' }), intent: 'submit' }), 'validation')
      assert.ok(many.fields.body)
      // An address that points at an internal network is only ever text and a link for the reader's browser.
      const event = await published(author, 'activity', activityInput({ title: 'An event with an internal-looking link', category: 'public_event', sourceUrl: 'http://169.254.169.254/latest/meta-data/', bookingUrl: 'http://10.0.0.1/admin' }))
      assert.equal((await Q.getPublished(event.shortId)).activity.sourceUrl, 'http://169.254.169.254/latest/meta-data/')
      assert.equal(fetched, 0, 'no outgoing request was made while saving, approving or reading')
    } finally {
      globalThis.fetch = realFetch
    }
  })

  const jpegWithGps = () => sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 30, g: 90, b: 120 } } })
    .withExif({ IFD0: { Make: 'TestCam', Artist: 'Secret Name' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '13/1 45/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '100/1 30/1 0/1' } })
    .jpeg().toBuffer()

  it('refuses files that are not real photos, whatever they are called', async () => {
    const ok = { alt: 'A test photo', rightsConfirmed: true }
    for (const [label, data] of [
      ['plain text', Buffer.from('<?php echo "not an image"; ?>')],
      ['an HTML page', Buffer.from('<html><script>alert(1)</script></html>')],
      ['an SVG with a script', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
      ['a Windows program header', Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200)])],
      ['a GIF', await sharp({ create: { width: 300, height: 300, channels: 3, background: '#fff' } }).gif().toBuffer()],
      ['a photo cut off halfway', (await jpegWithGps()).subarray(0, 300)],
    ] as [string, Buffer][]) {
      const error = await rejects(MEDIA.uploadPhoto(author, { data, ...ok }), 'validation', label)
      assert.ok(error.fields.file, `${label}: ${error.message}`)
    }
    const big = await rejects(MEDIA.uploadPhoto(author, { data: Buffer.alloc(4 * 1024 * 1024 + 1), ...ok }), 'validation')
    assert.match(big.fields.file, /too large/)
    const tiny = await rejects(MEDIA.uploadPhoto(author, { data: await sharp({ create: { width: 50, height: 50, channels: 3, background: '#fff' } }).png().toBuffer(), ...ok }), 'validation')
    assert.match(tiny.fields.file, /too small/)
    assert.ok((await rejects(MEDIA.uploadPhoto(author, { data: await jpegWithGps(), alt: 'A test photo', rightsConfirmed: false }), 'validation')).fields.rights)
    assert.ok((await rejects(MEDIA.uploadPhoto(author, { data: await jpegWithGps(), alt: '', rightsConfirmed: true }), 'validation')).fields.alt)
  })

  it('stored photos have no camera metadata or GPS position, under a random name', async () => {
    const original = await jpegWithGps()
    assert.ok((await sharp(original).metadata()).exif, 'the test photo really carries EXIF data')
    const photo = await MEDIA.uploadPhoto(author, { data: original, alt: 'Blue test card', rightsConfirmed: true })
    const doc: Any = await payload.findByID({ collection: 'media', id: photo.id, depth: 0 })
    assert.equal(doc.mimeType, 'image/webp', 'the main file is a re-encoded copy')
    assert.match(doc.filename, /^[a-z0-9]{16}(-\d+)?\.webp$/, 'nothing from the original file name is kept')
    const dir = path.resolve(process.cwd(), 'media')
    for (const name of [doc.filename, doc.sizes.thumb.filename, doc.sizes.card.filename]) {
      const stored = fs.readFileSync(path.join(dir, name))
      const meta = await sharp(stored).metadata()
      assert.equal(meta.exif, undefined, `${name} has no EXIF block`)
      assert.ok(!stored.includes(Buffer.from('Secret Name')) && !stored.includes(Buffer.from('TestCam')), `${name} does not contain the camera or artist text`)
    }
  })

  it('a photo is public only once approved, and a guessed file address is covered by the same rule', async () => {
    const photo = await MEDIA.uploadPhoto(author, { data: await jpegWithGps(), alt: 'Pending photo', rightsConfirmed: true })
    const doc: Any = await payload.findByID({ collection: 'media', id: photo.id, depth: 0 })
    // This is the lookup the file endpoint makes for /api/media/file/<name>: by file name, with the requester's rights.
    const canOpen = async (who: Any, filename = doc.filename) => (await visibleRows('media', { ...who, where: { or: [{ filename: { equals: filename } }, { 'sizes.thumb.filename': { equals: filename } }] } })).length > 0
    assert.equal(await canOpen(asUser(null, 'members')), false, 'a visitor cannot open a pending photo')
    assert.equal(await canOpen(asUser(reader, 'members')), false, 'nor can another member')
    assert.equal(await canOpen(asUser(null, 'members'), doc.sizes.thumb.filename), false, 'nor its thumbnail')
    assert.equal(await canOpen(asUser(author, 'members')), true, 'its owner can')

    await rejects(C.saveContribution(reader, { type: 'trip', input: tripInput({ photos: [photo.id] }), intent: 'save' }), 'validation', 'another member cannot attach my photo')
    const trip = await C.saveContribution(author, { type: 'trip', input: tripInput({ title: 'A trip report with one photo', photos: [photo.id] }), intent: 'submit' })
    assert.equal(await canOpen(asUser(null, 'members')), false, 'still private while the report is pending')
    await M.decideContribution(moderator(), trip.id, { decision: 'approve' })
    assert.equal(await canOpen(asUser(null, 'members')), true, 'public once the report is approved')
    const row = await payload.findByID({ collection: 'contributions', id: trip.id, depth: 0 })
    const page = await Q.getPublished(row.shortId)
    assert.equal(page.photos.length, 1)
    assert.equal(page.photos[0].alt, 'Pending photo')

    await M.setVisibility(moderator(), trip.id, { action: 'hide', reason: 'Checking a report.' })
    assert.equal(await canOpen(asUser(null, 'members')), false, 'hidden with its report')
    await M.setVisibility(moderator(), trip.id, { action: 'unhide' })
    assert.equal(await canOpen(asUser(null, 'members')), true)
    await M.setVisibility(moderator(), trip.id, { action: 'remove', reason: 'Not the author’s photo.' })
    assert.equal(await canOpen(asUser(null, 'members')), false, 'gone when the report is removed')
  })

  it('uploads are refused honestly where there is no storage', async () => {
    process.env.VERCEL = '1'
    try {
      const error = await rejects(MEDIA.uploadPhoto(author, { data: await jpegWithGps(), alt: 'A test photo', rightsConfirmed: true }), 'unavailable')
      assert.match(error.message, /not available yet/)
    } finally {
      delete process.env.VERCEL
    }
  })

  after(() => { fs.rmSync(path.resolve(process.cwd(), 'media'), { recursive: true, force: true }) })
})

describe('11 and 13. removal, indexing rules, structured data and the sitemap', () => {
  let question: Any, trip: Any

  before(async () => {
    question = await published(author, 'question', questionInput({ title: 'Where can I find vegetarian food near Khao San?' , body: 'ZEBRAWORD I am vegetarian and staying near Khao San road. Where do people recommend eating?' }))
    trip = await published(author, 'trip', tripInput({ title: 'Kyoto with a toddler in autumn', body: 'ZEBRAWORD We took our two-year-old to Kyoto for six days in November. Here is what worked and what did not.' }))
  })

  it('approval and indexing are separate decisions, following the configured policy', async () => {
    const settings = await (await import('../../src/lib/community/settings')).getSettings()
    let page = await Q.getPublished(question.shortId)
    assert.equal(SEO.contributionIndexing(page, settings).index, false, 'an unanswered question is public but not indexed')
    assert.equal(SEO.questionJsonLd(page, []), null, 'and carries no Q&A markup')
    await approvedReply(reader, question.id, 'Try the stalls on Rambuttri: several have clear vegetarian signs.')
    page = await Q.getPublished(question.shortId)
    assert.equal(SEO.contributionIndexing(page, settings).index, true, 'one approved answer makes it eligible')
    assert.equal(SEO.contributionIndexing(page, { ...settings, questionMinAnswers: 2 }).index, false, 'the threshold is configurable')
    assert.equal(SEO.contributionIndexing(page, { ...settings, questionsAuto: false }).index, false)

    const tripPage = await Q.getPublished(trip.shortId)
    assert.equal(SEO.contributionIndexing(tripPage, settings).index, false, 'a trip report waits for an eligibility review')
    await M.setIndexing(administrator(), trip.id, 'allow')
    assert.equal(SEO.contributionIndexing(await Q.getPublished(trip.shortId), settings).index, true)
    await M.setIndexing(administrator(), question.id, 'block')
    assert.equal(SEO.contributionIndexing(await Q.getPublished(question.shortId), settings).index, false, 'a moderator block wins over the policy')
    await M.setIndexing(administrator(), question.id, 'policy')
    assert.deepEqual(SEO.robotsFor({ index: false, reason: '' }), { index: false, follow: true }, 'noindex pages stay crawlable so the directive can be seen')
  })

  it('structured data repeats only what is visible and approved', async () => {
    const page = await Q.getPublished(question.shortId)
    const pendingAnswer = await R.postReply(third, { contributionId: question.id, body: 'PENDING-ANSWER that must not appear in structured data.' })
    const answers = (await R.listReplies(question.id, { acceptedId: page.questionDetail.acceptedAnswerId })).items
    const qa = SEO.questionJsonLd(page, answers)
    assert.equal(qa['@type'], 'QAPage')
    assert.equal(qa.mainEntity.answerCount, 1, 'the real number of approved answers')
    assert.equal(qa.mainEntity.suggestedAnswer.length, 1)
    assert.equal(qa.mainEntity.acceptedAnswer, undefined, 'no accepted answer is invented')
    assert.ok(!JSON.stringify(qa).includes('PENDING-ANSWER'))
    assert.ok(!JSON.stringify(qa).includes('aggregateRating') && !JSON.stringify(qa).includes('ratingValue'), 'no ratings are made up')
    await M.decideReply(moderator(), pendingAnswer.id, { decision: 'reject', reason: 'Not an answer to the question.' })

    await R.setAcceptedAnswer(author, { contributionId: question.id, replyId: answers[0].id })
    const accepted = SEO.questionJsonLd(await Q.getPublished(question.shortId), (await R.listReplies(question.id, { acceptedId: answers[0].id })).items)
    assert.equal(accepted.mainEntity.acceptedAnswer.text, answers[0].body)

    const tripLd = SEO.tripJsonLd(await Q.getPublished(trip.shortId), [])
    assert.equal(tripLd['@type'], 'DiscussionForumPosting')
    assert.equal(tripLd.author.name, 'Author')

    const event = await published(author, 'activity', activityInput({ title: 'A walk with event markup', priceState: 'paid', price: '350', priceCurrency: 'THB', bookingUrl: 'https://tickets.example.org/walk' }))
    let eventLd = SEO.eventJsonLd(await Q.getPublished(event.shortId))
    assert.equal(eventLd['@type'], 'Event')
    assert.match(eventLd.startDate, /T18:30:00\+07:00$/, 'the start time carries the venue’s UTC offset')
    assert.equal(eventLd.eventStatus, 'https://schema.org/EventScheduled')
    assert.deepEqual([eventLd.offers.price, eventLd.offers.priceCurrency], ['350.00', 'THB'])
    assert.equal(eventLd.organizer.name, 'Test organiser', 'the organiser is the one named in the listing, not Travel Notes')
    assert.ok(!JSON.stringify(eventLd).includes('organiser-private'))
    await C.setOwnEventStatus(author, event.id, { status: 'cancelled', note: '' })
    eventLd = SEO.eventJsonLd(await Q.getPublished(event.shortId))
    assert.equal(eventLd.eventStatus, 'https://schema.org/EventCancelled')
  })

  it('the sitemap lists only published, indexable pages, and nothing before launch', async () => {
    assert.deepEqual(await SITEMAP.communitySitemap(), [], 'the site-wide launch switch is off, so nothing is listed')
    let paths = (await SITEMAP.communitySitemap({ ignoreSiteFlag: true })).map((e: Any) => e.path)
    const qPath = (await Q.getPublished(question.shortId)).path
    const tPath = (await Q.getPublished(trip.shortId)).path
    assert.ok(paths.includes(qPath), 'the answered question')
    assert.ok(paths.includes(tPath), 'the trip report an administrator allowed')
    assert.ok(paths.includes('/community/questions') && paths.includes('/community'))
    assert.ok(!paths.some((p: string) => p.startsWith('/account') || p.startsWith('/moderation') || p.includes('/search')), 'no private or search pages')
    assert.ok(!paths.some((p: string) => p.startsWith('/community/thailand')), 'a hub is not listed until an administrator marks it indexable')

    await payload.update({ collection: 'destinations', id: places.thailand.id, data: { hubIndexable: true } as Any })
    paths = (await SITEMAP.communitySitemap({ ignoreSiteFlag: true })).map((e: Any) => e.path)
    assert.ok(paths.includes('/community/thailand'), 'the reviewed hub with content')
    assert.ok(!paths.includes('/community/thailand/bangkok'), 'its city hub was not reviewed')
    assert.ok(paths.includes(`/travellers/${author.handle}`), 'a profile with enough approved contributions')
    assert.ok(!paths.includes(`/travellers/${third.handle}`), 'an empty profile is not listed')

    const entry = (await SITEMAP.communitySitemap({ ignoreSiteFlag: true })).find((e: Any) => e.path === tPath)
    const row: Any = await payload.findByID({ collection: 'contributions', id: trip.id, depth: 0 })
    assert.equal(entry.lastModified, new Date(row.contentUpdatedAt).toISOString(), 'the date is the last approved change, not today')

    await openCommunity({ publicAccess: false })
    assert.deepEqual(await SITEMAP.communitySitemap({ ignoreSiteFlag: true }), [], 'a closed community lists nothing')
    await openCommunity()
  })

  it('removing a post takes it out of search, lists, the sitemap and its page at once', async () => {
    const tPath = (await Q.getPublished(trip.shortId)).path
    assert.equal((await S.search({ q: 'ZEBRAWORD' })).total, 2)
    assert.ok((await S.search({ q: 'toddler' })).items.some((c: Any) => c.id === trip.id))

    await M.setVisibility(moderator(), trip.id, { action: 'hide', reason: 'Under review after a report.' })
    assert.equal(await Q.getPublished(trip.shortId), null)
    assert.equal((await S.search({ q: 'ZEBRAWORD' })).total, 1, 'a hidden post is not in search')
    assert.ok(!(await Q.listPublished({ type: 'trip' })).items.some((c: Any) => c.id === trip.id))
    assert.ok(!(await SITEMAP.communitySitemap({ ignoreSiteFlag: true })).some((e: Any) => e.path === tPath))
    assert.equal(await Q.wasPublished(trip.shortId), true)
    assert.equal((await visibleRows('contributions', { overrideAccess: false, where: { id: { equals: trip.id } } })).length, 0)

    await M.setVisibility(moderator(), trip.id, { action: 'unhide' })
    assert.equal((await S.search({ q: 'ZEBRAWORD' })).total, 2, 'unhiding brings it back')

    await C.removeOwn(author, trip.id)
    assert.equal(await Q.getPublished(trip.shortId), null)
    assert.equal((await S.search({ q: 'ZEBRAWORD' })).total, 1)
    assert.equal((await S.search({ q: 'toddler' })).total, 0)
    assert.ok(!(await SITEMAP.communitySitemap({ ignoreSiteFlag: true })).some((e: Any) => e.path === tPath))
    assert.equal((await payload.findByID({ collection: 'contributions', id: trip.id, depth: 0 }) as Any).searchText, '', 'its text is taken out of the search column')
    await rejects(M.setVisibility(moderator(), trip.id, { action: 'unhide' }), 'conflict', 'a removed post cannot be quietly restored')
  })

  it('a bookmark or plan link to a removed post simply disappears', async () => {
    const post = await published(author, 'question', questionInput({ title: 'A question that is bookmarked and then removed' }))
    await E.setBookmark(reader, { targetType: 'contribution', targetId: post.id, on: true })
    const plan = await P.createPlan(reader, { title: 'Plan with a saved post' })
    await P.addPostToPlan(reader, { planId: plan.id, contributionId: post.id })
    assert.equal((await P.getPlan(reader, plan.id)).days[0].stops[0].saved.title, post.title)
    await M.setVisibility(moderator(), post.id, { action: 'remove', reason: 'Spam.' })
    assert.ok(!(await E.listBookmarks(reader)).posts.some((c: Any) => c.id === post.id))
    assert.equal((await P.getPlan(reader, plan.id)).days[0].stops[0].saved, null, 'the plan keeps the member’s stop but no longer links to the removed post')
  })
})

describe('12. search, filters and pagination with a realistic volume', () => {
  const TOTAL = 130

  before(async () => {
    // Insert approved posts directly: this test is about reading, and 130 moderation round-trips would only slow it down.
    const { withAncestors } = await import('../../src/lib/community/destinations')
    const tree = { bangkok: await withAncestors([places.bangkok.id]), kyoto: await withAncestors([places.kyoto.id]) }
    for (let i = 0; i < TOTAL; i++) {
      const inKyoto = i % 3 === 0
      const type = i % 5 === 0 ? 'trip' : 'question'
      await payload.create({
        collection: 'contributions',
        data: {
          shortId: `vol${String(i).padStart(6, '0')}`, type, author: author.id, title: `Volume post number ${i} about ${inKyoto ? 'temples' : 'markets'}`, slug: `volume-post-${i}`,
          body: 'Generated for the pagination test.', searchText: `QUOKKATERM generated text ${i % 2 === 0 ? 'lantern' : 'tuktuk'}`,
          state: i % 13 === 0 ? 'pending' : 'published', indexing: 'policy', style: i % 4 === 0 ? 'budget' : 'family',
          destinations: [inKyoto ? places.kyoto.id : places.bangkok.id], destinationTree: inKyoto ? tree.kyoto : tree.bangkok,
          publishedAt: new Date(Date.now() - i * 3_600_000).toISOString(),
        } as Any,
      })
    }
  })

  const allPages = async (load: (page: number) => Promise<Any>) => {
    const first = await load(1)
    const items = [...first.items]
    for (let p = 2; p <= first.totalPages; p++) items.push(...(await load(p)).items)
    return { first, items }
  }

  it('pages are complete, do not overlap, and are the same on every request', async () => {
    const expected = Array.from({ length: TOTAL }, (_, i) => i).filter((i) => i % 13 !== 0).length
    const a = await allPages((page) => S.search({ q: 'QUOKKATERM', page }))
    assert.equal(a.first.total, expected, 'every published match, and no pending one')
    assert.equal(a.first.items.length, 20)
    assert.equal(a.first.totalPages, Math.ceil(expected / 20))
    assert.equal(new Set(a.items.map((c: Any) => c.id)).size, expected, 'no post appears on two pages and none is missing')
    const b = await allPages((page) => S.search({ q: 'QUOKKATERM', page }))
    assert.deepEqual(b.items.map((c: Any) => c.id), a.items.map((c: Any) => c.id), 'the order is deterministic')
    assert.equal((await S.search({ q: 'QUOKKATERM', page: 99 })).items.length, 0, 'a page past the end is simply empty')
    assert.ok(a.items.every((c: Any) => !c.title.includes('number 0 ') && !c.title.includes('number 13 ')), 'pending rows are never returned')
  })

  it('filters narrow the results correctly and combine', async () => {
    const published = Array.from({ length: TOTAL }, (_, i) => i).filter((i) => i % 13 !== 0)
    const count = (test: (i: number) => boolean) => published.filter(test).length
    assert.equal((await S.search({ q: 'QUOKKATERM', type: 'trip' })).total, count((i) => i % 5 === 0))
    assert.equal((await S.search({ q: 'QUOKKATERM', destinationId: places.kyoto.id })).total, count((i) => i % 3 === 0))
    assert.equal((await S.search({ q: 'QUOKKATERM', destinationId: places.japan.id })).total, count((i) => i % 3 === 0), 'a country includes its cities')
    assert.equal((await S.search({ q: 'QUOKKATERM', style: 'budget' })).total, count((i) => i % 4 === 0))
    assert.equal((await S.search({ q: 'lantern', type: 'question', destinationId: places.thailand.id, style: 'family' })).total, count((i) => i % 2 === 0 && i % 5 !== 0 && i % 3 !== 0 && i % 4 !== 0))
    assert.equal((await S.search({ q: 'QUOKKATERM', recentDays: 1 })).total, count((i) => i < 24), 'approved in the last day')
    assert.equal((await S.search({ q: 'nothingmatchesthisword' })).total, 0)
    assert.equal((await S.search({ q: 'QUOKKATERM', destinationId: 'not-a-uuid' as Any })).total, count(() => true), 'a malformed filter is ignored, not an error')
    assert.equal((await S.search({ q: "'; DROP TABLE contributions; --" })).total, 0, 'search text is always a parameter')
    assert.ok((await payload.count({ collection: 'contributions' })).totalDocs > 0)
  })

  it('plain lists page the same way and feed the destination hubs', async () => {
    const list = await allPages((page) => Q.listPublished({ type: 'question', destinationId: places.kyoto.id, page }))
    assert.equal(new Set(list.items.map((c: Any) => c.id)).size, list.first.total)
    assert.ok(list.items.every((c: Any) => c.type === 'question' && c.destinations[0].name === 'Kyoto'))
    const dates = list.items.map((c: Any) => c.publishedAt)
    assert.deepEqual(dates, [...dates].sort().reverse(), 'newest first')
    const counts = await Q.countsForDestination(places.japan.id)
    assert.equal(counts.questions, list.first.total)
    const { destinationsWithContent, searchDestinations } = await import('../../src/lib/community/destinations')
    const countries = await destinationsWithContent({ kind: 'country' })
    assert.deepEqual(countries.map((c: Any) => c.name).sort(), ['Japan', 'Thailand'], 'only destinations that have approved posts are listed')
    assert.equal((await searchDestinations('krung'))[0].label, 'Bangkok, Thailand', 'alternative names are searched')
    assert.equal((await searchDestinations('kyo'))[0].name, 'Kyoto')
    assert.equal((await searchDestinations('x')).length, 0)
  })

  it('search counts that a search happened, never what was typed', async () => {
    const rows = await payload.find({ collection: 'metric-counters', where: { event: { equals: 'community_search' } }, limit: 50, depth: 0 })
    assert.ok(rows.docs.length > 0)
    assert.ok(!JSON.stringify(rows.docs).toLowerCase().includes('quokkaterm'))
  })
})

describe('12b. editorial guides found by destination', () => {
  const paragraph = (text: string) => ({ root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', textFormat: 0, textStyle: '', children: [{ type: 'text', text, format: 0, style: '', mode: 'normal', detail: 0, version: 1 }] }] } })
  const guide = async (slug: string, destination: Any, status: 'published' | 'draft', authorId: string) =>
    payload.create({
      collection: 'articles',
      data: { slug, title: slug, deck: 'Deck', excerpt: 'Excerpt', type: 'destination-guide', body: paragraph(slug), primaryAuthor: authorId, primaryDestination: destination.id, seo: { title: slug, description: 'Description' }, _status: status } as Any,
      draft: status === 'draft',
    })

  before(async () => {
    const writer = await payload.create({ collection: 'authors', data: { name: 'Guide writer', slug: unique('guide-writer-'), biography: 'Bio' } as Any })
    await guide(unique('kyoto-guide-'), places.kyoto, 'published', writer.id)
    await guide(unique('kyoto-draft-'), places.kyoto, 'draft', writer.id)
    await guide(unique('bangkok-guide-'), places.bangkok, 'published', writer.id)
  })

  const guidePaths = async (destinationId: string | null) =>
    (await S.search({ type: 'guide', destinationId })).guides.items.map((g: Any) => g.path.replace(/^\/stories\//, '').replace(/-[a-z0-9]+$/, ''))

  it('lists published guides for a destination without any words typed, never drafts', async () => {
    assert.deepEqual(await guidePaths(places.kyoto.id), ['kyoto-guide'])
    assert.deepEqual(await guidePaths(places.bangkok.id), ['bangkok-guide'])
  })
  it('includes guides about places inside the chosen destination', async () => {
    assert.deepEqual(await guidePaths(places.japan.id), ['kyoto-guide'])
    assert.deepEqual(await guidePaths(places.thailand.id), ['bangkok-guide'])
  })
  it('needs words or a destination: an empty guide search returns nothing', async () => {
    assert.deepEqual(await guidePaths(null), [])
  })
})

describe('14. notifications and email', () => {
  it('a member who switched reply email off is told in the app but gets no email', async () => {
    const post = await published(author, 'question', questionInput({ title: 'A question whose author has reply email switched off' }))
    await MEM.updateEmailPrefs(author, { replies: false })
    const before = (await captured(author.id, 'reply_published')).length
    await approvedReply(reader, post.id, 'An answer the author should hear about only in the app.')
    const mail = await captured(author.id, 'reply_published')
    assert.equal(mail.length, before + 1, 'the email was queued')
    assert.equal(mail[0].status, 'suppressed', 'and stopped at delivery time because of the preference')
    const { listNotifications } = await import('../../src/lib/community/notifications')
    assert.ok((await listNotifications(author)).items.some((n: Any) => n.type === 'reply_published' && n.path.includes(post.shortId)))
    await MEM.updateEmailPrefs(author, { replies: true })
  })

  it('unsubscribe links work without signing in and cannot be forged', async () => {
    const { unsubscribeSignature } = await import('../../src/lib/community/email/templates')
    await rejects(MEM.unsubscribe(reader.id, 'replies', 'f'.repeat(40)), 'validation')
    await rejects(MEM.unsubscribe(reader.id, 'replies', unsubscribeSignature(third.id, 'replies')), 'validation', 'a signature for another member')
    await rejects(MEM.unsubscribe(reader.id, 'events', unsubscribeSignature(reader.id, 'replies')), 'validation', 'a signature for another category')
    await MEM.unsubscribe(reader.id, 'replies', unsubscribeSignature(reader.id, 'replies'))
    const prefs = (await payload.findByID({ collection: 'members', id: reader.id, depth: 0 }) as Any).emailPrefs
    assert.deepEqual([prefs.replies, prefs.moderation, prefs.events], [false, true, true], 'only that category is switched off')
    await MEM.updateEmailPrefs(reader, { replies: true })
  })

  it('the rendered email links only to this site and escapes member text', async () => {
    const { renderEmail } = await import('../../src/lib/community/email/templates')
    const mail = renderEmail('reply_published', { title: '<b>Bold</b> & "quoted"', authorName: '<img src=x>', path: '//evil.example.org/phish' }, { id: reader.id, displayName: 'Reader <script>' })
    assert.ok(!mail.html.includes('<b>') && !mail.html.includes('<img') && !mail.html.includes('<script>'))
    assert.ok(!mail.html.includes('evil.example.org') && !mail.text.includes('evil.example.org'), 'a path that is not a site path falls back to the home page')
    assert.ok(mail.unsubscribeUrl?.includes('/account/unsubscribe?m='))
    const security = renderEmail('verify_email', { token: 'abc123' }, { id: reader.id, displayName: 'Reader' })
    assert.equal(security.unsubscribeUrl, undefined, 'security email has no unsubscribe link')
    assert.ok(security.text.includes('/account/verify?token=abc123'))
  })

  it('the capture transport never contacts a mail provider, and is refused on the production deployment', async () => {
    const { emailMode, sendEmail } = await import('../../src/lib/community/email/transport')
    const realFetch = globalThis.fetch
    let calls = 0
    globalThis.fetch = (async () => { calls++; return new Response('{}') }) as Any
    try {
      assert.equal(emailMode(), 'capture')
      assert.deepEqual(await sendEmail({ to: 'someone@example.test', subject: 's', text: 't', html: 'h', idempotencyKey: 'k' }), { ok: true, transport: 'capture' })
      assert.equal(calls, 0)
      process.env.VERCEL_ENV = 'production'
      assert.equal(emailMode(), 'off', 'production never silently keeps email')
      await rejects(MEM.signUp({ email: 'a@example.test', password: 'x'.repeat(12), handle: 'abcdef', displayName: 'A B', acceptTerms: true }, { ip: null }), 'unavailable')
      delete process.env.VERCEL_ENV
      process.env.EMAIL_TRANSPORT = 'resend'
      assert.equal(emailMode(), 'off', '"resend" without a key and sender is off, not a silent success')
    } finally {
      delete process.env.VERCEL_ENV
      process.env.EMAIL_TRANSPORT = 'capture'
      globalThis.fetch = realFetch
    }
  })

  it('a delivery failure is retried with a delay, stays visible, and ends as "failed"', async () => {
    const post = await published(author, 'question', questionInput({ title: 'A question used to test email delivery failures' }))
    const realFetch = globalThis.fetch
    let status = 500
    const seen: Any[] = []
    globalThis.fetch = (async (url: Any, init: Any) => { seen.push({ url: String(url), key: init.headers['Idempotency-Key'], body: JSON.parse(init.body) }); return new Response('{"message":"boom"}', { status }) }) as Any
    process.env.EMAIL_TRANSPORT = 'resend'
    process.env.RESEND_API_KEY = 're_test_not_real'
    process.env.EMAIL_FROM = 'Travel Notes <test@example.test>'
    try {
      await approvedReply(reader, post.id, 'An answer whose notification email fails to send at first.')
      let row = (await captured(author.id, 'reply_published'))[0]
      assert.equal(row.status, 'pending', 'a server error leaves the email queued')
      assert.equal(row.attempts, 1)
      assert.match(row.lastError, /500/)
      assert.ok(new Date(row.nextAttemptAt).getTime() > Date.now(), 'the next attempt is scheduled later')
      assert.equal(seen[0].url, 'https://api.resend.com/emails')
      assert.equal(seen[0].body.to[0], author.email)
      assert.ok(seen[0].key.startsWith('n:reply:'), 'the provider receives an idempotency key')
      assert.equal((await OUT.deliverOutbox()).attempted, 0, 'not retried before its time')
      const health = await OUT.outboxHealth()
      assert.ok(health.pending >= 1, 'the dashboard can see it waiting')

      // Make it due, and let the provider refuse it for good.
      const { run, sql } = await import('../../src/lib/community/db')
      await run(payload, sql`UPDATE "email_outbox" SET "next_attempt_at" = now() - interval '1 minute' WHERE "id" = ${row.id}::uuid`)
      status = 422
      const report = await OUT.deliverOutbox()
      assert.equal(report.failed, 1)
      row = (await captured(author.id, 'reply_published'))[0]
      assert.equal(row.status, 'failed')
      assert.equal(row.attempts, 2)
      assert.ok((await OUT.outboxHealth()).failed >= 1, 'a failed email shows on the dashboard')
      assert.equal(seen[1].key, seen[0].key, 'the retry used the same idempotency key')
    } finally {
      process.env.EMAIL_TRANSPORT = 'capture'
      delete process.env.RESEND_API_KEY
      delete process.env.EMAIL_FROM
      globalThis.fetch = realFetch
    }
  })

  it('the weekly digest is opt-in, sent once a week, and skipped when there is nothing new', async () => {
    const { sendDigests } = await import('../../src/lib/community/digest')
    const monday = new Date('2026-10-12T03:00:00Z')
    const follower = await newMember('Follower')
    await E.setFollow(follower, { destinationId: places.japan.id, on: true })
    assert.equal((await sendDigests(monday)).queued, 0, 'not subscribed: nothing is sent')
    await MEM.updateEmailPrefs(follower, { digest: true })
    await payload.update({ collection: 'members', id: follower.id, data: { lastDigestAt: '2020-01-01T00:00:00.000Z' } })
    assert.equal((await sendDigests(new Date('2026-10-13T03:00:00Z'))).queued, 0, 'only on Mondays')
    assert.equal((await sendDigests(monday)).queued, 1)
    const mail = await captured(follower.id, 'destination_digest')
    assert.equal(mail.length, 1)
    assert.ok(mail[0].data.items.length > 0 && mail[0].data.items.every((i: Any) => i.path.startsWith('/')))
    await sendDigests(monday)
    assert.equal((await captured(follower.id, 'destination_digest')).length, 1, 'running the job again the same day sends nothing more')
  })

  it('scheduled jobs record each run and do not overlap', async () => {
    const results = await JOBS.runDaily()
    assert.deepEqual(results.map((r: Any) => r.job), ['publish', 'outbox', 'events', 'photos', 'rate-limits', 'digest', 'contact', 'newsletter'])
    assert.ok(results.every((r: Any) => r.ok), JSON.stringify(results))
    assert.ok((await payload.count({ collection: 'job-runs' })).totalDocs >= 5)
    const { hit } = await import('../../src/lib/community/ratelimit')
    const subject = `test-${Date.now()}`
    const hits = []
    for (let i = 0; i < 4; i++) hits.push((await hit('vote', subject, { limit: 3, seconds: 60 })).allowed)
    assert.deepEqual(hits, [true, true, true, false], 'the fourth request in the window is refused')
  })
})

describe('15. account export and deletion', () => {
  it('the export contains the member’s own data and nobody else’s', async () => {
    const mine = await newMember('Exporter')
    const post = await published(mine, 'question', questionInput({ title: 'EXPORT-MINE a question in my export' }))
    await approvedReply(reader, post.id, 'SOMEONE-ELSE an answer by another member.')
    await P.createPlan(mine, { title: 'EXPORT-MINE plan', notes: 'private plan note' })
    await E.setFollow(mine, { destinationId: places.kyoto.id, on: true })
    await payload.update({ collection: 'contributions', id: post.id, data: { moderation: { internalNote: 'MODERATOR-ONLY note' } } as Any })
    const data = await MEM.exportAccount(mine)
    const text = JSON.stringify(data)
    assert.equal(data.account.email, mine.email)
    assert.ok(text.includes('EXPORT-MINE a question') && text.includes('private plan note'))
    assert.equal(data.followedDestinations.length, 1)
    assert.ok(!text.includes('SOMEONE-ELSE'), 'other people’s replies are not in my export')
    assert.ok(!text.includes('MODERATOR-ONLY'), 'moderators’ private notes are not included')
    assert.ok(!text.includes(reader.email))
    await rejects(MEM.exportAccount(null as Any), 'auth')
  })

  it('deleting an account erases the person and their private data but keeps the public record honest', async () => {
    const leaver = await newMember('Leaver')
    const post = await published(leaver, 'question', questionInput({ title: 'A question whose author later deletes their account' }))
    const answer = await approvedReply(reader, post.id, 'An answer by someone who stays.')
    const theirAnswer = await approvedReply(leaver, (await published(author, 'question', questionInput({ title: 'A question answered by the member who leaves' }))).id, 'An answer by the member who leaves.')
    const draft = await C.saveContribution(leaver, { type: 'question', input: questionInput({ title: 'LEAVER-DRAFT never published' }), intent: 'save' })
    const pending = await C.saveContribution(leaver, { type: 'question', input: questionInput({ title: 'LEAVER-PENDING never published' }), intent: 'submit' })
    const plan = await P.createPlan(leaver, { title: 'Leaver plan' })
    await E.setBookmark(leaver, { targetType: 'contribution', targetId: post.id, on: true })
    const event = await published(author, 'activity', activityInput({ title: 'An event the leaver said they would attend' }))
    await E.setRsvp(leaver, { activityId: event.id, status: 'going' })
    assert.equal((await MEM.getPublicProfile(leaver.handle)).displayName, 'Leaver')

    await rejects(MEM.deleteAccount(leaver, { password: 'wrong password!', removeContent: false }), 'validation')
    assert.equal((await payload.findByID({ collection: 'members', id: leaver.id, depth: 0 }) as Any).status, 'active', 'a wrong password deletes nothing')
    await MEM.deleteAccount(leaver, { password: leaver.password, removeContent: false })

    const row: Any = await payload.findByID({ collection: 'members', id: leaver.id, depth: 0, showHiddenFields: true })
    assert.equal(row.status, 'deleted')
    assert.ok(!row.email.includes(leaver.handle) && row.email.endsWith('@deleted.invalid'))
    assert.ok(row.handle.startsWith('deleted-') && row.displayName === 'Deleted member' && !row.bio)
    assert.equal((row.sessions ?? []).length, 0, 'every session is ended')
    await rejects(MEM.signIn({ email: leaver.email, password: leaver.password }, { ip: null }), 'validation', 'the old sign-in no longer works')
    await rejects(MEM.requireActive(leaver), 'auth', 'a session issued before deletion is refused')
    assert.equal(await MEM.getPublicProfile(leaver.handle), null, 'no public profile')

    for (const [collection, field, id] of [['plans', 'owner', plan.id], ['bookmarks', 'member', null], ['rsvps', 'member', null], ['notifications', 'recipient', null]] as Any[]) {
      assert.equal((await payload.count({ collection, where: { [field]: { equals: leaver.id } } })).totalDocs, 0, `${collection} are deleted`)
      if (id) assert.equal(await payload.findByID({ collection, id, disableErrors: true }), null)
    }
    assert.equal((await Q.getPublished(event.shortId)).activity.goingCount, 0, 'the RSVP count is corrected')
    for (const id of [draft.id, pending.id]) assert.equal(await payload.findByID({ collection: 'contributions', id, disableErrors: true }), null, 'never-published work is deleted')
    assert.ok((await captured(leaver.id)).every((m: Any) => m.status !== 'pending' && m.data === null), 'queued email is cancelled and its data cleared')

    const page = await Q.getPublished(post.shortId)
    assert.equal(page.title, 'A question whose author later deletes their account', 'the approved question stays, by their choice')
    assert.deepEqual([page.author.displayName, page.author.handle, page.author.hasProfile], ['Deleted member', null, false])
    assert.equal(page.authorId, null)
    assert.equal((await R.listReplies(post.id)).items[0].id, answer.id, 'other people’s answers are untouched')
    const kept = (await R.listReplies(relIdOf(theirAnswer.contribution))).items.find((r: Any) => r.id === theirAnswer.id)
    assert.equal(kept.author.displayName, 'Deleted member')
    assert.ok(!JSON.stringify(SEO.questionJsonLd(page, (await R.listReplies(post.id)).items)).includes(`/travellers/${leaver.handle}`), 'structured data does not link to a profile that no longer exists')
    assert.equal(SEO.questionJsonLd(page, (await R.listReplies(post.id)).items).mainEntity.author.url, undefined)
    const log = await payload.find({ collection: 'moderation-actions', where: { and: [{ action: { equals: 'account_deleted' } }, { targetId: { equals: leaver.id } }] }, depth: 0 })
    assert.equal(log.totalDocs, 1, 'the deletion itself is on the audit record')
    assert.ok(!(await SITEMAP.communitySitemap({ ignoreSiteFlag: true })).some((e: Any) => e.path.includes(leaver.handle)))
  })

  it('a member can ask for their public posts to be removed as well', async () => {
    const leaver = await newMember('Remover')
    const post = await published(leaver, 'trip', tripInput({ title: 'A trip report removed together with its author account' }))
    const other = await published(author, 'question', questionInput({ title: 'A question with a reply from the remover' }))
    const reply = await approvedReply(leaver, other.id, 'A reply that goes when its author leaves.')
    await MEM.deleteAccount(leaver, { password: leaver.password, removeContent: true })
    assert.equal(await Q.getPublished(post.shortId), null)
    assert.equal(await Q.wasPublished(post.shortId), true)
    assert.ok(!(await R.listReplies(other.id)).items.some((r: Any) => r.id === reply.id))
    assert.equal((await Q.getPublished(other.shortId)).replyCount, 0, 'reply counts are recounted')
    assert.equal((await S.search({ q: 'removed together' })).total, 0)
  })

  const relIdOf = (value: Any) => (typeof value === 'string' ? value : value.id)
})

describe('settings switches and review rules', () => {
  it('closed sign-up and paused submissions are refused with a clear reason', async () => {
    await openCommunity({ signupsOpen: false })
    await rejects(MEM.signUp({ email: 'closed@example.test', password: 'x'.repeat(12), handle: 'closedhandle', displayName: 'Closed', acceptTerms: true }, { ip: null }), 'closed')
    await openCommunity({ submissionsOpen: false })
    await rejects(C.saveContribution(author, { type: 'question', input: questionInput(), intent: 'submit' }), 'closed')
    const post = await payload.find({ collection: 'contributions', where: { state: { equals: 'published' } }, limit: 1, depth: 0 })
    await rejects(R.postReply(author, { contributionId: post.docs[0].id, body: 'A reply while submissions are paused.' }), 'closed')
    await openCommunity({ maxPendingPerMember: 2 })
    const fresh = await newMember('Queue')
    await C.saveContribution(fresh, { type: 'question', input: questionInput({ title: 'First question waiting in the queue' }), intent: 'submit' })
    await C.saveContribution(fresh, { type: 'question', input: questionInput({ title: 'Second question waiting in the queue' }), intent: 'submit' })
    await rejects(C.saveContribution(fresh, { type: 'question', input: questionInput({ title: 'Third question over the queue limit' }), intent: 'submit' }), 'rate_limited')
    await openCommunity()
  })

  it('sign-up validates input, hides whether an address is registered, and ignores bots', async () => {
    const bad = await rejects(MEM.signUp({ email: 'not-an-email', password: 'short', handle: 'A', displayName: '', acceptTerms: false }, { ip: null }), 'validation')
    assert.deepEqual(Object.keys(bad.fields).sort(), ['acceptTerms', 'displayName', 'email', 'handle', 'password'])
    assert.ok((await rejects(MEM.signUp({ email: 'x@example.test', password: 'x'.repeat(12), handle: 'admin', displayName: 'Admin', acceptTerms: true }, { ip: null }), 'validation')).fields.handle)
    assert.ok((await rejects(MEM.signUp({ email: 'x@example.test', password: 'x'.repeat(12), handle: author.handle, displayName: 'Copy', acceptTerms: true }, { ip: null }), 'validation')).fields.handle)
    const members = (await payload.count({ collection: 'members' })).totalDocs
    // Same answer for an address that already has an account, and no second account.
    assert.deepEqual(await MEM.signUp({ email: author.email, password: 'x'.repeat(12), handle: `new${Date.now().toString(36)}`, displayName: 'Dup', acceptTerms: true }, { ip: null }), { ok: true })
    // A filled honeypot field looks like success to the script and creates nothing.
    assert.deepEqual(await MEM.signUp({ email: 'bot@example.test', password: 'x'.repeat(12), handle: 'botbotbot', displayName: 'Bot', acceptTerms: true, website: 'https://spam.example.test' }, { ip: null }), { ok: true })
    assert.equal((await payload.count({ collection: 'members' })).totalDocs, members)
    await rejects(MEM.verifyEmail('0'.repeat(40)), 'validation')
  })

  it('password reset works once, by emailed link only', async () => {
    const m = await newMember('Resetter')
    assert.deepEqual(await MEM.requestPasswordReset('nobody-at-all@example.test', { ip: null }), { ok: true }, 'same answer for an unknown address')
    await MEM.requestPasswordReset(m.email, { ip: null })
    const token = (await captured(m.id, 'password_reset'))[0].data.token
    await rejects(MEM.resetPassword({ token, password: 'short' }), 'validation')
    await MEM.resetPassword({ token, password: 'a brand new password' })
    await rejects(MEM.resetPassword({ token, password: 'another new password' }), 'validation', 'the link works once')
    await rejects(MEM.signIn({ email: m.email, password: m.password }, { ip: null }), 'validation', 'the old password is gone')
    assert.ok((await MEM.signIn({ email: m.email, password: 'a brand new password' }, { ip: null })).token)
  })

  it('lighter review applies only when switched on AND a moderator marked the member as trusted', async () => {
    const post = await published(author, 'question', questionInput({ title: 'A question used to test trusted replies' }))
    const trusted = await newMember('Trusted')
    await M.setTrusted(moderator(), trusted.id, true)
    assert.equal((await R.postReply(trusted, { contributionId: post.id, body: 'With the switch off, even a trusted member waits.' })).state, 'pending')
    await openCommunity({ review: { autoApproveTrustedReplies: true } })
    assert.equal((await R.postReply(reader, { contributionId: post.id, body: 'An ordinary member still waits for review.' })).state, 'pending')
    const auto = await R.postReply(trusted, { contributionId: post.id, body: 'A trusted member is published at once, and it is logged.' })
    assert.equal(auto.state, 'published')
    const log = await payload.find({ collection: 'moderation-actions', where: { and: [{ targetId: { equals: auto.id } }, { action: { equals: 'auto_approve_reply' } }] }, depth: 0 })
    assert.equal(log.docs[0].actorType, 'system')
    await openCommunity({ review: { autoApproveTrustedReplies: false } })
  })

  it('moderators can link duplicates, override an abused accepted answer and handle suggestions, all on the record', async () => {
    const original = await published(author, 'question', questionInput({ title: 'The original question about airport transfers' }))
    const dupe = await published(reader, 'question', questionInput({ title: 'A later duplicate question about airport transfers' }))
    await M.markDuplicate(moderator(), dupe.id, `${original.shortId}-anything`)
    const page = await Q.getPublished(dupe.shortId)
    assert.equal(page.questionDetail.duplicateOf.title, original.title, 'the later thread stays readable and points to the first')
    const settings = await (await import('../../src/lib/community/settings')).getSettings()
    await approvedReply(third, dupe.id, 'An answer on the duplicate thread.')
    assert.equal(SEO.contributionIndexing(await Q.getPublished(dupe.shortId), settings).index, false, 'a linked duplicate is not indexed separately')
    await rejects(M.markDuplicate(moderator(), dupe.id, dupe.shortId), 'validation')

    const answer = await approvedReply(third, original.id, 'An answer accepted and then corrected by a moderator.')
    await R.setAcceptedAnswer(author, { contributionId: original.id, replyId: answer.id })
    await rejects(M.overrideAcceptedAnswer(moderator(), original.id, { replyId: null, reason: '' }), 'validation', 'an override needs a reason')
    await M.overrideAcceptedAnswer(moderator(), original.id, { replyId: null, reason: 'Accepted by a second account of the same person.' })
    assert.equal((await Q.getPublished(original.shortId)).questionDetail.acceptedAnswerId, null)

    const { suggestDestination } = await import('../../src/lib/community/destinations')
    await suggestDestination(reader, { name: 'Pai', country: 'Thailand', details: 'A small town in the north.' })
    const pending = await M.listSuggestions(moderator())
    assert.equal(pending.length, 1)
    assert.equal((await (await import('../../src/lib/community/destinations')).searchDestinations('Pai')).length, 0, 'a suggestion is never published automatically')
    await rejects(M.decideSuggestion(moderator(), pending[0].id, { decision: 'accept' }), 'validation', 'accepting needs a real destination record')
    await M.decideSuggestion(moderator(), pending[0].id, { decision: 'reject', resolution: 'Already covered by Mae Hong Son.' })
    const actions = (await M.auditLog(moderator())).items.map((a: Any) => a.action)
    for (const action of ['mark_duplicate', 'override_accepted_answer', 'reject_suggestion']) assert.ok(actions.includes(action), `${action} is on the audit record`)
  })

  it('the dashboard counts real rows and says "no data" rather than inventing a figure', async () => {
    const { getDashboard } = await import('../../src/lib/community/dashboard')
    await rejects(getDashboard({ kind: 'staff', id: 'x', name: 'x', canModerate: false, isAdministrator: false }), 'forbidden')
    const d = await getDashboard(moderator())
    assert.equal(d.content.published.question, (await payload.count({ collection: 'contributions', where: { and: [{ type: { equals: 'question' } }, { state: { equals: 'published' } }] } })).totalDocs)
    assert.equal(d.backlog.submissions, (await payload.count({ collection: 'contributions', where: { state: { equals: 'pending' } } })).totalDocs)
    assert.ok(d.backlog.replies >= 1 && d.email.failed >= 1 && d.jobs.length >= 5)
    assert.ok(d.medianHoursToFirstAnswer === null || d.medianHoursToFirstAnswer >= 0)
    assert.equal(d.email.mode, 'capture')
  })
})
