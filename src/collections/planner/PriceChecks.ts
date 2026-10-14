import type { CollectionConfig } from 'payload'
import { ValidationError } from 'payload'

import { isEditor, isPublisher } from '../../access/roles'
import { BASES, COST_ITEMS, PRICE_KINDS } from '../../lib/planner/costs'
import { httpsLink } from '../fields'

const group = 'Trip Planner data'
const NAMED = ['attraction', 'tour', 'intercity']

/**
 * Prices the Trip Planner budget may use. Each one is a real price someone checked: where it came
 * from (a link), when it was checked, what it is per, and what it includes. The planner never
 * makes a price up; anything without a row here is shown as "price unavailable".
 *
 * A price saved for a country or region is used for every place inside it that has no price of its own.
 */
export const PriceChecks: CollectionConfig = {
  slug: 'price-checks',
  labels: { singular: 'Price check', plural: 'Price checks' },
  admin: {
    group,
    useAsTitle: 'name',
    defaultColumns: ['name', 'item', 'destination', 'amount', 'kind', 'checkedAt', 'status'],
    description: 'Checked prices the Trip Planner adds up. Always give the source link and the date you checked it. Use Australian dollars: other currencies are not converted yet.',
  },
  access: { read: isEditor, create: isEditor, update: isEditor, delete: isPublisher },
  indexes: [{ fields: ['destination', 'item'] }],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data
        const errors: { path: string; message: string }[] = []
        if (typeof data.amountHigh === 'number' && typeof data.amount === 'number' && data.amountHigh < data.amount) errors.push({ path: 'amountHigh', message: 'The high end must be at least the low price.' })
        if (typeof data.childAmountHigh === 'number' && typeof data.childAmount === 'number' && data.childAmountHigh < data.childAmount) errors.push({ path: 'childAmountHigh', message: 'The high end must be at least the low child price.' })
        if (NAMED.includes(data.item) && !(typeof data.name === 'string' && data.name.trim().length >= 3)) errors.push({ path: 'name', message: 'Name the attraction, tour or journey, for example “Taronga Zoo general entry”.' })
        if (data.item === 'intercity' && !data.toDestination) errors.push({ path: 'toDestination', message: 'Choose where the journey goes to.' })
        if (errors.length) throw new ValidationError({ collection: 'price-checks', errors })
        if (!data.name && data.item) data.name = COST_ITEMS.find((i) => i.value === data.item)?.label
        return data
      },
    ],
  },
  fields: [
    { name: 'destination', type: 'relationship', relationTo: 'destinations', required: true, index: true, admin: { description: 'The city, region or country this price applies to. A country price is used anywhere in that country without its own price.' } },
    { name: 'item', type: 'select', required: true, options: COST_ITEMS.map((i) => ({ value: i.value, label: i.label })) },
    { name: 'name', type: 'text', maxLength: 140, admin: { description: 'For tickets, tours and journeys: the exact product, for example “Taronga Zoo general entry” or “Sydney to Canberra coach”.' } },
    { name: 'toDestination', type: 'relationship', relationTo: 'destinations', admin: { condition: (_, s) => s?.item === 'intercity', description: 'Where the journey ends.' } },
    {
      type: 'row',
      fields: [
        { name: 'amount', label: 'Price (low)', type: 'number', required: true, min: 0, max: 100000, admin: { width: '25%', description: 'Adult or standard price, in dollars, for example 4.50.' } },
        { name: 'amountHigh', label: 'Price (high)', type: 'number', min: 0, max: 100000, admin: { width: '25%', description: 'Only for a range. Leave empty for one price.' } },
        { name: 'currency', type: 'text', required: true, defaultValue: 'AUD', maxLength: 3, validate: (v: string | null | undefined) => (v && /^[A-Z]{3}$/.test(v) ? true : 'Use a three-letter currency code, for example AUD.'), admin: { width: '20%' } },
        { name: 'basis', type: 'select', required: true, options: BASES.map((b) => ({ value: b.value, label: b.label })), admin: { width: '30%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'childAmount', label: 'Child price (low)', type: 'number', min: 0, max: 100000, admin: { width: '25%' } },
        { name: 'childAmountHigh', label: 'Child price (high)', type: 'number', min: 0, max: 100000, admin: { width: '25%' } },
        { name: 'childMaxAge', label: 'Child price up to age', type: 'number', min: 0, max: 17, admin: { width: '25%', description: 'Including this age.' } },
        { name: 'freeUnderAge', label: 'Free under age', type: 'number', min: 0, max: 18, admin: { width: '25%', description: 'For example 4 means children aged 0 to 3 are free.' } },
      ],
    },
    { name: 'kind', label: 'Type of price', type: 'select', required: true, defaultValue: 'published', options: PRICE_KINDS.map((k) => ({ value: k.value, label: k.label })) },
    {
      type: 'row',
      fields: [
        { name: 'sourceName', type: 'text', required: true, maxLength: 120, admin: { width: '40%', description: 'For example “Taronga Zoo (official site)”.' } },
        { name: 'sourceUrl', type: 'text', required: true, validate: httpsLink, admin: { width: '60%' } },
      ],
    },
    { name: 'checkedAt', label: 'Date checked', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
    { name: 'includes', type: 'text', maxLength: 300, admin: { description: 'What the price includes, for example “Entry and the keeper talks”.' } },
    { name: 'excludes', type: 'text', maxLength: 300, admin: { description: 'What it does not include, for example “Booking fee of 1.5% on cards”.' } },
    { name: 'bookingUrl', type: 'text', validate: httpsLink, admin: { description: 'Optional. The official booking page.' } },
    {
      name: 'method',
      type: 'select',
      defaultValue: 'editor',
      options: [{ value: 'editor', label: 'Checked by an editor' }, { value: 'ai_research', label: 'Found by AI web research' }],
      admin: { position: 'sidebar', description: 'AI research saves a typical range with the page it came from. Edit or retire it if it looks wrong.' },
    },
    { name: 'quote', type: 'textarea', maxLength: 600, admin: { description: 'AI research: what the source page says about the price.', condition: (_, s) => s?.method === 'ai_research' } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { value: 'active', label: 'Use in plans' },
        { value: 'review', label: 'Needs checking (not used)' },
        { value: 'retired', label: 'Out of date (not used)' },
      ],
      admin: { position: 'sidebar' },
    },
  ],
}
