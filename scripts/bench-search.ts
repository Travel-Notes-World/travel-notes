/**
 * Guide search speed check: npm run bench:search
 *
 * Seeds about 500 realistic published articles (bodies of 800 to 1,500 words, destinations, travel
 * styles) into the THROWAWAY database in TEST_DATABASE_URL, then times typical searches and prints
 * the median and p95, plus the query plan. It never touches DATABASE_URL, and it wipes the test
 * database first, exactly like the test suites do:
 *
 *   TEST_DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/tn_test npm run bench:search
 *
 * Timing is printed, not asserted: a busy machine makes timings noisy. The target is p95 under
 * 150 ms on a developer machine.
 */
import { payload, places, setup, type Any } from '../tests/community/helpers'

const ARTICLES = 500
const RUNS_PER_QUERY = 5
const TARGET_P95_MS = 150

const WORDS = `temple shrine garden market street food noodle ramen sushi tea ceremony ferry island beach
  snorkel dive hike trail mountain summit lake river boat train rail pass bus airport taxi scooter cycling
  bicycle hostel hotel guesthouse ryokan homestay budget luxury family backpacking itinerary day trip
  weekend sunrise sunset festival lantern night market museum gallery castle palace old town harbour
  coast cliff waterfall rice terrace jungle national park wildlife monkey elephant safari desert dune
  canyon glacier fjord volcano hot spring onsen spa massage cooking class wine vineyard coffee bakery
  breakfast lunch dinner vegetarian vegan halal visa border currency cash card atm sim card wifi phone
  packing rain season monsoon autumn spring summer winter crowds queue ticket booking reservation
  price cost tip etiquette language phrase safety scam pickpocket insurance pharmacy hospital`.split(/\s+/).filter(Boolean)
const TITLES = ['Three slow days in', 'A first-timer guide to', 'Eating your way through', 'The best day trips from', 'Getting around', 'Where to stay in', 'A budget weekend in', 'Hidden corners of', 'Rainy-day ideas for', 'Family travel in']
const STYLES = ['budget', 'mid_range', 'luxury', 'backpacking', 'family', 'adventure', 'slow', 'road_trip', 'city_break', 'food']

let seed = 42
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)]

const text = (t: string) => ({ type: 'text', text: t, format: 0, style: '', mode: 'normal', detail: 0, version: 1 })
const block = (type: string, t: string, extra: Any = {}) => ({ type, format: '', indent: 0, version: 1, direction: 'ltr', ...extra, children: [text(t)] })

/** Each article draws on its own small part of the vocabulary, so a word appears in roughly one article in six, as topics do in a real archive. */
function body(place: string, words: number) {
  const own = Array.from({ length: 25 }, () => pick(WORDS))
  const word = () => pick(own)
  const children: Any[] = []
  let written = 0
  while (written < words) {
    children.push(block('heading', `${word()} and ${word()} in ${place}`, { tag: 'h2' }))
    for (let p = 0; p < 4 && written < words; p++) {
      const sentence = Array.from({ length: 60 }, word).join(' ')
      children.push(block('paragraph', `${sentence} ${place}.`, { textFormat: 0, textStyle: '' }))
      written += 62
    }
  }
  return { root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children } }
}

const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
const ms = (n: number) => `${n.toFixed(1)} ms`

async function main() {
  await setup()
  const G = await import('../src/lib/content/guideSearch')
  const { withDescendants } = await import('../src/lib/community/destinations')
  const { run, sql } = await import('../src/lib/community/db')

  const author = await payload.create({ collection: 'authors', data: { name: 'Bench writer', slug: 'bench-writer', biography: 'Bio' } as Any })
  const destinations = [places.kyoto, places.bangkok, places.japan, places.thailand]
  const started = Date.now()
  for (let i = 0; i < ARTICLES; i++) {
    const d = pick(destinations)
    const title = `${pick(TITLES)} ${d.name} (${i})`
    await payload.create({
      collection: 'articles',
      data: {
        slug: `bench-${i}`, title, deck: `${pick(WORDS)} ${pick(WORDS)} and ${pick(WORDS)} in ${d.name}.`, excerpt: `${pick(WORDS)}, ${pick(WORDS)} and ${pick(WORDS)}.`,
        type: 'destination-guide', body: body(d.name, 800 + Math.floor(rand() * 700)), primaryAuthor: author.id, primaryDestination: d.id,
        travelStyles: [pick(STYLES), pick(STYLES)].filter((s, j, all) => all.indexOf(s) === j), seo: { title, description: 'Bench' }, _status: 'published',
      } as Any,
    })
  }
  // Steady state, as autovacuum leaves it: statistics, and newly inserted rows moved out of the
  // GIN index's pending list (until then the index looks more expensive to the planner).
  await run(payload, sql`VACUUM ANALYZE "articles"`)
  console.log(`Seeded ${ARTICLES} published articles in ${((Date.now() - started) / 1000).toFixed(0)} s.\n`)

  const japan = await withDescendants(places.japan.id, payload)
  const queries: { label: string; q: string; destinationIds?: string[]; style?: string; page?: number }[] = [
    ...['temple', 'ferry', 'ramen', 'hot spring', 'night market', 'visa', 'rain season', 'cooking class', 'snorkel', 'lantern'].map((q) => ({ label: 'one or two words', q })),
    ...['"street food"', '"day trip"', '"national park"', '"rail pass"', '"old town"'].map((q) => ({ label: 'phrase', q })),
    ...['temple -crowds', 'beach or island', 'hostel budget'].map((q) => ({ label: 'syntax', q })),
    ...['temple', 'ferry', 'market'].map((q) => ({ label: 'with destination', q, destinationIds: japan })),
    ...['food', 'family', 'hike'].map((q) => ({ label: 'with style', q, style: 'food' })),
    ...['temple', 'beach', 'train'].map((q) => ({ label: 'page 3', q, page: 3 })),
    { label: 'no matches', q: 'zzzzzz' },
  ]

  const endToEnd: number[] = []
  const sqlOnly: number[] = []
  for (const query of queries) {
    for (let r = 0; r < RUNS_PER_QUERY; r++) {
      let t = performance.now()
      await G.searchGuides(payload, query)
      endToEnd.push(performance.now() - t)
      t = performance.now()
      await run(payload, G.rankedGuideSql(query.q, query, G.GUIDE_PAGE_SIZE, ((query.page ?? 1) - 1) * G.GUIDE_PAGE_SIZE))
      sqlOnly.push(performance.now() - t)
    }
  }
  endToEnd.sort((a, b) => a - b)
  sqlOnly.sort((a, b) => a - b)

  const matches = Number((await run(payload, sql`SELECT count(*) AS n FROM "articles" WHERE "search_vector" @@ websearch_to_tsquery('english', 'lantern')`)).rows[0]?.n)
  const plan = (await run(payload, sql`EXPLAIN ANALYZE ${G.rankedGuideSql('lantern', {}, G.GUIDE_PAGE_SIZE, 0)}`)).rows.map((r: Any) => r['QUERY PLAN']).join('\n')
  const p95 = quantile(endToEnd, 0.95)
  console.log(`${queries.length} queries x ${RUNS_PER_QUERY} runs = ${endToEnd.length} searches`)
  console.log(`Full search (ranked SQL + loading the 20 results): median ${ms(quantile(endToEnd, 0.5))}, p95 ${ms(p95)}`)
  console.log(`Ranked SQL only:                                   median ${ms(quantile(sqlOnly, 0.5))}, p95 ${ms(quantile(sqlOnly, 0.95))}`)
  console.log(`Target p95 under ${TARGET_P95_MS} ms: ${p95 < TARGET_P95_MS ? 'met' : 'NOT met'}`)
  console.log(`Plan for "lantern" (${matches} of ${ARTICLES} articles match): ${/articles_search_vector_idx/.test(plan) ? 'GIN index' : 'sequential scan'}`)
  // A rare term (one article's number in its title): the GIN index is what finds it.
  const rare = (await run(payload, sql`EXPLAIN ANALYZE ${G.rankedGuideSql('137', {}, G.GUIDE_PAGE_SIZE, 0)}`)).rows.map((r: Any) => r['QUERY PLAN']).join('\n')
  console.log(`Plan for a rare term (1 of ${ARTICLES} articles match): ${/articles_search_vector_idx/.test(rare) ? 'GIN index' : 'NOT the GIN index'}\n`)
  console.log(plan, '\n')
  console.log(rare)
  await payload.destroy?.()
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
