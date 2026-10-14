import type { CollectionConfig } from 'payload'

import { isEditor, isPublisher } from '../../access/roles'
import { httpsLink } from '../fields'

/**
 * Exchange rates the budget uses to show prices in Australian dollars, each with its source and
 * the date it was checked. AI price research adds one when it finds prices in another currency;
 * an editor can correct it. Rates older than 30 days are not used.
 */
export const ExchangeRates: CollectionConfig = {
  slug: 'exchange-rates',
  labels: { singular: 'Exchange rate', plural: 'Exchange rates' },
  admin: { group: 'Trip Planner data', useAsTitle: 'currency', defaultColumns: ['currency', 'perAud', 'sourceName', 'checkedAt'], description: 'How much of each currency one Australian dollar buys. Used to show prices in A$.' },
  access: { read: isEditor, create: isEditor, update: isEditor, delete: isPublisher },
  fields: [
    { name: 'currency', type: 'text', required: true, unique: true, maxLength: 3, validate: (v: string | null | undefined) => (v && /^[A-Z]{3}$/.test(v) && v !== 'AUD' ? true : 'Use a three-letter currency code other than AUD, for example JPY.') },
    { name: 'perAud', label: 'Units for 1 AUD', type: 'number', required: true, min: 0.000001, max: 1_000_000, admin: { description: 'For example 98.5 means A$1 = ¥98.5.' } },
    { name: 'sourceName', type: 'text', required: true, maxLength: 120 },
    { name: 'sourceUrl', type: 'text', required: true, validate: httpsLink },
    { name: 'checkedAt', label: 'Date checked', type: 'date', required: true },
    { name: 'method', type: 'select', defaultValue: 'editor', options: [{ value: 'editor', label: 'Checked by an editor' }, { value: 'ai_research', label: 'Found by AI web research' }], admin: { position: 'sidebar' } },
  ],
}
