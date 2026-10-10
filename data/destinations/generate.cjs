const cities = require('all-the-cities')
// Small countries have few or no places of 100,000 people, so each is topped up to this many places
// with its largest towns of at least TOP_UP_MIN people.
const TOP_UP_TO = 10
const TOP_UP_MIN = 1000
const { countries } = require('countries-list')
const tz = require('tz-lookup')
// Letters that have no accent to strip, so NFKD leaves them as they are (Łódź, Tromsø, Garðabær, Kırıkkale).
const LETTERS = { ł: 'l', ı: 'i', ð: 'd', đ: 'd', ø: 'o', ħ: 'h', æ: 'ae', œ: 'oe', þ: 'th', ß: 'ss' }
const slug = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[łıðđøħæœþß]/g, (ch) => LETTERS[ch]).replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const keep = cities.filter((c) => c.population >= 100000 || c.featureCode === 'PPLC')
const outCountries = []
const usedCountrySlugs = new Set()
for (const [code, c] of Object.entries(countries)) {
  let s = slug(c.name)
  if (usedCountrySlugs.has(s)) s = `${s}-${code.toLowerCase()}`
  usedCountrySlugs.add(s)
  const capital = keep.filter((x) => x.country === code).sort((a, b) => (b.featureCode === 'PPLC') - (a.featureCode === 'PPLC') || b.population - a.population)[0]
  const aliases = [...new Set([c.native, ...(c.alias || [])].filter((a) => a && a !== c.name))]
  let timeZone = null
  if (capital) { try { timeZone = tz(capital.loc.coordinates[1], capital.loc.coordinates[0]) } catch {} }
  outCountries.push({ code, name: c.name, slug: s, aliases, timeZone })
}
const outCities = []
const used = new Map()
const kept = new Set(keep.map((c) => c.cityId))
const perCountry = new Map()
for (const c of keep) perCountry.set(c.country, (perCountry.get(c.country) || 0) + 1)
// Appended after the main list so the slugs of the places above never change.
const topUp = []
for (const code of Object.keys(countries)) {
  const room = TOP_UP_TO - (perCountry.get(code) || 0)
  if (room <= 0) continue
  topUp.push(...cities.filter((c) => c.country === code && !kept.has(c.cityId) && c.population >= TOP_UP_MIN).sort((a, b) => b.population - a.population).slice(0, room))
}
for (const c of [...keep.sort((a, b) => b.population - a.population), ...topUp.sort((a, b) => b.population - a.population)]) {
  if (!countries[c.country]) continue
  const set = used.get(c.country) ?? new Set(); used.set(c.country, set)
  let s = slug(c.name) || `place-${c.cityId}`
  if (set.has(s)) s = `${s}-${slug(c.adminCode || '') || c.cityId}`
  if (set.has(s)) s = `${s}-${c.cityId}`
  set.add(s)
  const [lon, lat] = c.loc.coordinates
  let timeZone = null
  try { timeZone = tz(lat, lon) } catch {}
  const aliases = c.altName && c.altName !== c.name ? [c.altName] : []
  outCities.push({ id: String(c.cityId), name: c.name, slug: s, country: c.country, population: c.population, lat: Math.round(lat * 1e4) / 1e4, lon: Math.round(lon * 1e4) / 1e4, timeZone, aliases })
}
const data = {
  source: {
    cities: 'GeoNames (geonames.org), via the npm package all-the-cities 3.1.0. Licence: Creative Commons Attribution 4.0 (CC BY 4.0). Places with at least 100,000 people, plus every national capital, plus each country\'s largest towns of at least 1,000 people until it has 10 places.',
    countries: 'ISO 3166-1 country list from the npm package countries-list 3.4.1 (MIT licence).',
    timeZones: 'Time zones looked up from coordinates with the npm package tz-lookup 6.1.25 (CC0). Approximate near borders; editors can correct any record.',
    generated: new Date().toISOString().slice(0, 10),
  },
  countries: outCountries,
  cities: outCities,
}
require('fs').writeFileSync('destinations.json', JSON.stringify(data))
console.log('countries', outCountries.length, 'cities', outCities.length, 'size', require('fs').statSync('destinations.json').size)
console.log(JSON.stringify(outCities.find((c) => c.name === 'Bangkok')), JSON.stringify(outCountries.find((c) => c.code === 'TH')))
console.log('no tz cities', outCities.filter((c) => !c.timeZone).length, 'dup check', outCountries.filter(c=>/,/.test(c.name)).map(c=>c.name).slice(0,5))
