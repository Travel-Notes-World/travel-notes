import type { CollectionConfig } from 'payload'

import { isEditor, isPublisher } from '../../access/roles'
import { ADVICE_LEVELS } from '../../lib/planner/advice'

/**
 * The Australian Government's travel advice level for each country, copied by an editor from
 * Smartraveller with the date it was checked. The Trip Planner shows it at the top of every trip
 * to that country and in the PDF, and always links to Smartraveller for the current advice.
 * Smartraveller does not allow automated reading, so this is kept by hand.
 */
export const TravelAdvisories: CollectionConfig = {
  slug: 'travel-advisories',
  labels: { singular: 'Travel advice level', plural: 'Travel advice levels' },
  admin: {
    group: 'Trip Planner data',
    useAsTitle: 'countryName',
    defaultColumns: ['countryName', 'level', 'checkedAt'],
    description: 'Copy the overall level from the country’s Smartraveller page, and check it again whenever Smartraveller changes it. Plans warn travellers when the check is more than 30 days old.',
  },
  access: { read: isEditor, create: isEditor, update: isEditor, delete: isPublisher },
  hooks: {
    beforeChange: [
      async ({ data, req }) => {
        if (data.country) {
          const id = typeof data.country === 'object' ? data.country.id : data.country
          const doc = await req.payload.findByID({ collection: 'destinations', id, depth: 0, draft: true, req }).catch(() => null)
          if (doc) data.countryName = doc.name
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'country', type: 'relationship', relationTo: 'destinations', required: true, unique: true, filterOptions: { kind: { equals: 'country' } } },
    { name: 'countryName', type: 'text', admin: { readOnly: true, hidden: true } },
    { name: 'level', type: 'select', required: true, options: ADVICE_LEVELS.map((l) => ({ value: String(l.level), label: `Level ${l.level}: ${l.label}` })) },
    { name: 'note', type: 'textarea', maxLength: 400, admin: { description: 'Optional, short. For example “Higher levels apply in some border areas.” Do not copy Smartraveller’s full text.' } },
    { name: 'url', label: 'Smartraveller page', type: 'text', required: true, validate: (v: string | null | undefined) => (v && /^https:\/\/www\.smartraveller\.gov\.au\/destinations\/[a-z0-9/-]+$/.test(v) ? true : 'Use the country’s page, for example https://www.smartraveller.gov.au/destinations/asia/japan') },
    { name: 'checkedAt', label: 'Date checked', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
  ],
}
