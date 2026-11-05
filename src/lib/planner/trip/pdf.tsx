import { Document, Link, Page, renderToBuffer, StyleSheet, Text, View } from '@react-pdf/renderer'

import { siteUrl } from '../../site'
import { displayRound, formatMoney } from './calc'
import { partyText, type TripForm } from './form'
import type { TripView } from './gate'
import { CATEGORY_LABEL, MODE_LABEL, PRICE_TYPE_LABEL, priceBasisText, SLOT_LABEL } from './plan'

/**
 * The full trip as an A4 PDF: route, every day, the budget with its quantities, assumptions and
 * sources. No site navigation, forms or footers. Built only for a view made with full access
 * (the route checks payment first). Uses the built-in Helvetica font.
 */

const ink = '#1b2733'
const muted = '#5b6670'
const line = '#d9dee2'
const brand = '#0e2a3d'
const accent = '#1f6f63'

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 60, paddingHorizontal: 44, fontFamily: 'Helvetica', fontSize: 9.5, color: ink, lineHeight: 1.45 },
  brand: { fontSize: 9, color: accent, fontFamily: 'Helvetica-Bold', letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: brand, marginTop: 6 },
  subtitle: { fontSize: 10.5, color: muted, marginTop: 3 },
  h2: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: brand, marginTop: 16, marginBottom: 6 },
  h3: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: brand },
  small: { fontSize: 8.5, color: muted },
  row: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: line, paddingVertical: 3 },
  day: { marginTop: 10, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: line },
  item: { marginTop: 4, flexDirection: 'row' },
  slot: { width: 62, color: muted },
  body: { flex: 1 },
  box: { marginTop: 8, padding: 8, borderWidth: 0.5, borderColor: line },
  footer: { position: 'absolute', bottom: 22, left: 44, right: 44, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: muted },
})

const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

function TripPdf({ form, view, generatedOn }: { form: TripForm; view: TripView; generatedOn: string }) {
  const b = view.budget
  const m = (minor: number) => formatMoney(minor, b.currency, { round: true })
  const left = b.budget !== null ? displayRound(b.budget, b.currency) - displayRound(b.total.working, b.currency) : null
  const r = (x: { low: number; high: number }) => (x.low === x.high ? m(x.low) : `${m(x.low)} to ${m(x.high)}`)
  return (
    <Document title={`${form.destination} trip plan`} author="Travel Notes" creator="Travel Notes Trip Planner">
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>Travel Notes · Trip Planner</Text>
        <Text style={s.title}>{form.days} days in {form.destination}</Text>
        <Text style={s.subtitle}>{fmtDate(form.arrive)} to {fmtDate(form.depart)} · {form.nights} nights · {partyText(form)} · from {form.origin}</Text>

        <View style={s.box}>
          <Text style={s.h3}>Estimated total for the whole party: {m(b.total.working)} (range {r(b.total)}){b.incomplete ? ' — incomplete' : ''}</Text>
          <Text>Average per person: {m(b.perPerson)} · Budget: {b.budget !== null ? m(b.budget) : 'not given'}{left !== null ? ` · ${left < 0 ? `${m(-left)} over` : `${m(left)} left`}` : ''}</Text>
          <Text>Route: {view.bases.map((x) => `${x.name} (${x.nights} ${x.nights === 1 ? 'night' : 'nights'})`).join(' → ')}</Text>
        </View>

        {view.why ? <><Text style={s.h2}>Why this route</Text><Text>{view.summary}</Text><Text style={{ marginTop: 4 }}>{view.why}</Text></> : null}

        <Text style={s.h2}>Day by day</Text>
        {view.days.map((d) => (d.locked ? null : (
          <View key={d.day} style={s.day} wrap={d.items.length > 6}>
            <Text style={s.h3}>Day {d.day} · {fmtDate(d.date)} · {d.base}</Text>
            <Text style={s.small}>{d.title}{d.overnight ? ` · overnight in ${d.overnight}` : ' · departure day'} · day costs {m(d.subtotal.working)}</Text>
            {d.items.map((it) => {
              const l = b.lines.find((x) => x.id === `item-${it.id}`)
              return (
                <View key={it.id} style={s.item} wrap={false}>
                  <Text style={s.slot}>{SLOT_LABEL[it.slot]}</Text>
                  <View style={s.body}>
                    {it.travel && it.travel.minutes > 0 ? <Text style={s.small}>{MODE_LABEL[it.travel.mode]}, about {it.travel.minutes} min</Text> : null}
                    <Text style={{ fontFamily: 'Helvetica-Bold' }}>{it.title}</Text>
                    <Text>{[it.place, it.area].filter(Boolean).join(' · ')}{it.minutes ? ` · about ${it.minutes} min` : ''}</Text>
                    {it.reason ? <Text style={s.small}>{it.reason}</Text> : null}
                    {it.note ? <Text style={s.small}>Check: {it.note}</Text> : null}
                    {l ? <Text style={s.small}>{l.status === 'unavailable' ? 'Price unavailable' : l.status === 'free' ? 'Free entry' : `${m(l.working)} · ${l.quantity}`}</Text> : null}
                  </View>
                </View>
              )
            })}
          </View>
        )))}

        <View break>
          <Text style={s.h2}>Budget</Text>
          {b.byCategory.map((c) => <View key={c.category} style={s.row}><Text>{CATEGORY_LABEL[c.category]}{c.missing ? ` (${c.missing} missing)` : ''}</Text><Text>{m(c.working)}</Text></View>)}
          <View style={s.row}><Text>Contingency ({b.contingencyPct}%)</Text><Text>{m(b.contingency.working)}</Text></View>
          <View style={s.row}><Text style={{ fontFamily: 'Helvetica-Bold' }}>Estimated total</Text><Text style={{ fontFamily: 'Helvetica-Bold' }}>{m(b.total.working)}</Text></View>
          <Text style={{ marginTop: 4 }}>Already paid: {m(b.paid)} · Still to pay: {m(b.toPay)}</Text>
          {b.incomplete ? <Text style={{ marginTop: 4 }}>Not included (no reliable price found): {b.missing.map((x) => x.label).join('; ')}</Text> : null}

          <Text style={[s.h3, { marginTop: 10 }]}>Every cost</Text>
          {b.lines.map((l) => (
            <View key={l.id} style={s.row} wrap={false}>
              <Text style={{ flex: 1 }}>{l.day ? `Day ${l.day}: ` : ''}{l.label} — {l.quantity}</Text>
              <Text>{l.status === 'unavailable' ? 'Missing' : l.status === 'included' ? 'Included' : m(l.working)}</Text>
            </View>
          ))}
        </View>

        <Text style={s.h2}>Where the prices come from</Text>
        {Object.values(view.facts).filter((f) => f.type !== 'unavailable').map((f) => (
          <View key={f.key} style={{ marginTop: 3 }} wrap={false}>
            <Text>{f.label}: {PRICE_TYPE_LABEL[f.type]} ({priceBasisText(f)}), {f.currency} {f.low}–{f.high}, used {f.currency} {f.working} {f.unit.replace(/_/g, ' ')}. Checked {new Date(f.checkedAt).toLocaleDateString('en-AU')}.{f.assumptions ? ` ${f.assumptions}` : ''}</Text>
            {f.sourceUrl ? <Link src={f.sourceUrl} style={s.small}>{f.sourceName || f.sourceUrl}</Link> : null}
          </View>
        ))}
        {view.rates.length > 0 && <Text style={{ marginTop: 6 }}>Exchange rates: {view.rates.map((x) => `A$1 = ${x.perAud} ${x.currency} (${x.sourceName})`).join('; ')}</Text>}

        {view.assumptions.length > 0 && <><Text style={s.h2}>Assumptions</Text>{view.assumptions.map((a, i) => <Text key={i}>• {a}</Text>)}</>}
        {view.checks.length > 0 && <><Text style={s.h2}>Check before you book</Text>{view.checks.map((a, i) => <Text key={i}>• {a}</Text>)}</>}

        <Text style={[s.small, { marginTop: 14 }]}>Estimates can change before you book. Nothing in this plan has been booked or reserved. Check prices, opening days and entry rules with the official source before you travel.</Text>
        <View style={s.footer} fixed>
          <Text>Made on {generatedOn} · {siteUrl.replace(/^https?:\/\//, '')}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

export const renderTripPdf = (form: TripForm, view: TripView): Promise<Buffer> =>
  renderToBuffer(<TripPdf form={form} view={view} generatedOn={new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' })} />)
