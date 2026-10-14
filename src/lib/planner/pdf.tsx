import { Document, Link, Page, renderToBuffer, StyleSheet, Text, View } from '@react-pdf/renderer'

import type { DocDay, DocModel } from './document'

/**
 * The plan as an A4 PDF: real text (selectable and searchable), page numbers, the date it was made
 * and clean page breaks (a day never starts at the very bottom of a page). Built on the server, so
 * no browser is needed. Uses the built-in Helvetica font, which covers English and most
 * European accents; place names in other scripts are shown as typed in English.
 */

const ink = '#1b2733'
const muted = '#5b6670'
const line = '#d9dee2'
const brand = '#0e2a3d'
const accent = '#1f6f63'

const s = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 64, paddingHorizontal: 48, fontFamily: 'Helvetica', fontSize: 10, color: ink, lineHeight: 1.45 },
  brand: { fontSize: 9, color: accent, fontFamily: 'Helvetica-Bold', letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: brand, marginTop: 6, lineHeight: 1.2 },
  subtitle: { fontSize: 11, color: muted, marginTop: 4 },
  h2: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: brand, marginTop: 18, marginBottom: 6 },
  h3: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: brand },
  muted: { color: muted },
  small: { fontSize: 8.5, color: muted },
  factRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: line, paddingVertical: 4 },
  factLabel: { width: '38%', fontFamily: 'Helvetica-Bold', paddingRight: 8 },
  factValue: { width: '62%' },
  day: { marginTop: 12, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: line },
  stop: { marginTop: 4, flexDirection: 'row' },
  stopTime: { width: 62, color: muted },
  stopBody: { flex: 1 },
  label: { fontSize: 8, color: accent },
  aiLabel: { fontSize: 8, color: '#7d6217' },
  bullet: { flexDirection: 'row', marginTop: 2 },
  bulletDot: { width: 10 },
  table: { borderWidth: 0.5, borderColor: line, marginTop: 4 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: line },
  th: { fontFamily: 'Helvetica-Bold', backgroundColor: '#f2f4f5' },
  td: { padding: 5 },
  footer: { position: 'absolute', bottom: 24, left: 48, right: 48, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: muted },
  disclaimer: { marginTop: 18, padding: 8, borderWidth: 0.5, borderColor: line, fontSize: 8.5, color: muted },
})

function Facts({ doc }: { doc: DocModel }) {
  return (
    <View style={{ marginTop: 14 }}>
      {doc.facts.map((f) => (
        <View key={f.label} style={s.factRow} wrap={false}>
          <Text style={s.factLabel}>{f.label}</Text>
          <Text style={s.factValue}>{f.value}</Text>
        </View>
      ))}
    </View>
  )
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((t, i) => (
        <View key={i} style={s.bullet}>
          <Text style={s.bulletDot}>•</Text>
          <Text style={{ flex: 1 }}>{t}</Text>
        </View>
      ))}
    </View>
  )
}

function HolidayDay({ day }: { day: DocDay }) {
  return (
    <View style={s.day}>
      {/* The heading stays with at least the first stop, so a day never starts at the foot of a page. */}
      <View wrap={false} minPresenceAhead={60}>
        <Text style={s.h3}>Day {day.number}{day.dateLabel ? ` · ${day.dateLabel}` : ''}{day.title ? ` · ${day.title}` : ''}</Text>
        {day.overnight ? <Text style={s.muted}>Overnight: {day.overnight} ({day.overnightStatus === 'confirmed' ? 'booked by you' : 'proposed'})</Text> : null}
        {day.transport ? <Text style={s.muted}>Getting around: {day.transport}</Text> : null}
      </View>
      {day.stops.map((st, i) => (
        <View key={i} style={s.stop} wrap={false}>
          <Text style={s.stopTime}>{st.time}</Text>
          <View style={s.stopBody}>
            <Text><Text style={{ fontFamily: 'Helvetica-Bold' }}>{st.title}</Text>{st.place ? ` · ${st.place}` : ''}</Text>
            {st.notes ? <Text>{st.notes}</Text> : null}
            {st.label ? (
              st.link ? <Link src={st.link} style={s.label}>{st.label}: {st.link}</Link> : <Text style={st.label.startsWith('AI') ? s.aiLabel : s.label}>{st.label}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  )
}

function VisaTable({ days }: { days: DocDay[] }) {
  const col = ['22%', '20%', '38%', '20%']
  return (
    <View style={s.table}>
      <View style={[s.tr, s.th]} fixed>
        {['Date', 'City / overnight', 'Planned activities', 'Arrangement'].map((h, i) => <Text key={h} style={[s.td, { width: col[i] }]}>{h}</Text>)}
      </View>
      {days.map((d) => (
        <View key={d.number} style={s.tr} wrap={false}>
          <Text style={[s.td, { width: col[0] }]}>{d.dateLabel || `Day ${d.number}`}</Text>
          <Text style={[s.td, { width: col[1] }]}>{d.overnight || d.title || '—'}</Text>
          <Text style={[s.td, { width: col[2] }]}>{d.stops.map((x) => x.title).join('; ') || '—'}</Text>
          <Text style={[s.td, { width: col[3] }]}>{d.overnightStatus === 'confirmed' ? 'Confirmed (provided by the traveller)' : 'Proposed – to be confirmed'}</Text>
        </View>
      ))}
    </View>
  )
}

export function PlanDocument({ doc }: { doc: DocModel }) {
  return (
    <Document title={doc.title} author="Travel Notes Trip Planner" subject={doc.subtitle} creator="Travel Notes" producer="Travel Notes" language="en-AU">
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>Travel Notes · Trip Planner</Text>
        <Text style={s.title}>{doc.title}</Text>
        <Text style={s.subtitle}>{doc.subtitle}</Text>
        <Facts doc={doc} />

        {doc.layout === 'visa' ? (
          <>
            <Text style={s.h2}>Daily itinerary</Text>
            <VisaTable days={doc.days} />
          </>
        ) : (
          <>
            {doc.advice.length > 0 && <><Text style={s.h2}>Australian Government travel advice (Smartraveller)</Text><Bullets items={doc.advice} /></>}
            {doc.summary.length > 0 && <><Text style={s.h2}>Overview</Text>{doc.summary.map((t, i) => <Text key={i}>{t}</Text>)}</>}
            {doc.checks.length > 0 && <><Text style={s.h2}>Check before you go</Text><Bullets items={doc.checks} /></>}
            {doc.legs.length > 0 && <><Text style={s.h2}>Distances between places</Text><Bullets items={doc.legs} /></>}
            <Text style={s.h2}>Day by day</Text>
            {doc.days.map((d) => <HolidayDay key={d.number} day={d} />)}
            {doc.options.length > 0 && (
              <View break={doc.days.length > 3}>
                <Text style={s.h2}>Three ways to do this trip</Text>
                {doc.options.map((o) => (
                  <View key={o.label} style={{ marginTop: 6 }} wrap={false}>
                    <Text style={s.h3}>{o.label}</Text>
                    <Text>{o.summary}</Text>
                    <Bullets items={o.choices} />
                  </View>
                ))}
              </View>
            )}
            {doc.budget.length > 0 && <><Text style={s.h2}>Budget</Text>{doc.budget.map((t, i) => <Text key={i} style={i ? s.small : undefined}>{t}</Text>)}</>}
            {doc.sources.length > 0 && <><Text style={s.h2}>Where the prices come from</Text><Bullets items={doc.sources} /></>}
          </>
        )}

        <Text style={s.disclaimer}>{doc.disclaimer}</Text>
        <View style={s.footer} fixed>
          <Text>Made on {doc.generatedOn} · {doc.site}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

export const renderPlanPdf = (doc: DocModel): Promise<Buffer> => renderToBuffer(<PlanDocument doc={doc} />)
