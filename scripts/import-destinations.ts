/**
 * Import the worldwide destination list into the CMS.
 *
 *   npm run destinations:import                 # countries + every place in the data file
 *   npm run destinations:import -- --min=300000 # only places with at least 300,000 people (all countries are always imported; smaller capitals are not)
 *
 * Source: data/destinations/geonames-100k.json (GeoNames, CC BY 4.0; ISO 3166 countries). See the
 * "source" block in that file and docs/community/data-model.md for the attribution the licence needs.
 *
 * Safe to run again: a record that already exists (matched by its source id, or by its address) is
 * left exactly as it is, so corrections editors made in the CMS are never overwritten.
 * Imported places are usable in forms straight away, but their community pages stay out of
 * search engines until an administrator ticks "hubIndexable" for each one.
 */
import fs from 'node:fs'
import path from 'node:path'

type Country = { code: string; name: string; slug: string; aliases: string[]; timeZone: string | null }
type City = { id: string; name: string; slug: string; country: string; population: number; lat: number; lon: number; timeZone: string | null; aliases: string[] }

async function main() {
  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config })
  const file = path.resolve(process.cwd(), 'data/destinations/geonames-100k.json')
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as { source: Record<string, string>; countries: Country[]; cities: City[] }
  const minArg = process.argv.find((a) => a.startsWith('--min='))
  const min = minArg ? Number(minArg.slice(6)) : 0
  const importedAt = new Date().toISOString()

  const existing = await payload.find({ collection: 'destinations', limit: 100000, pagination: false, depth: 0, select: { path: true, source: true } })
  const bySource = new Map(existing.docs.filter((d) => d.source?.externalId).map((d) => [d.source!.externalId!, d.id]))
  const byPath = new Map(existing.docs.filter((d) => d.path).map((d) => [d.path!, d.id]))
  let created = 0
  let kept = 0

  const countryIds = new Map<string, string>()
  for (const c of data.countries) {
    const externalId = `iso3166:${c.code}`
    const found = bySource.get(externalId) ?? byPath.get(c.slug)
    if (found) { countryIds.set(c.code, found); kept++; continue }
    const summary = `Traveller questions, trip reports and activities about ${c.name}.`
    const doc = await payload.create({
      collection: 'destinations',
      data: {
        name: c.name, slug: c.slug, kind: 'country', isoCountryCode: c.code, timeZone: c.timeZone, aliases: c.aliases, summary,
        seo: { title: `${c.name} travel community`, description: summary },
        source: { name: 'ISO 3166-1 (countries-list 3.4.1)', externalId, licence: 'MIT', importedAt },
        _status: 'published',
      },
    })
    countryIds.set(c.code, doc.id)
    created++
  }
  console.log(`Countries: ${created} created, ${kept} already there.`)

  const cities = data.cities.filter((c) => c.population >= min)
  const names = new Map(data.countries.map((c) => [c.code, c.name]))
  let done = 0
  const queue = [...cities]
  const worker = async () => {
    for (let city = queue.shift(); city; city = queue.shift()) {
      const parent = countryIds.get(city.country)
      if (!parent) continue
      const externalId = `geonames:${city.id}`
      const countrySlug = data.countries.find((c) => c.code === city.country)!.slug
      if (bySource.has(externalId) || byPath.has(`${countrySlug}/${city.slug}`)) { kept++; continue }
      const summary = `Traveller questions, trip reports and activities about ${city.name}, ${names.get(city.country)}.`
      await payload.create({
        collection: 'destinations',
        data: {
          name: city.name, slug: city.slug, kind: 'city', parent, isoCountryCode: city.country, timeZone: city.timeZone, aliases: city.aliases,
          latitude: city.lat, longitude: city.lon, population: city.population, summary,
          seo: { title: `${city.name} travel community`, description: summary },
          source: { name: 'GeoNames (all-the-cities 3.1.0)', externalId, licence: 'CC BY 4.0', importedAt },
          _status: 'published',
        },
      })
      created++
      if (++done % 250 === 0) console.log(`  ${done} places…`)
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  console.log(`Done. Created ${created} records in total; ${kept} were already there and left unchanged.`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
