import { randomInt } from 'node:crypto'

/**
 * Server-side id generation. Kept out of text.ts because client components import text.ts, and
 * node:crypto there would ship a browser crypto polyfill (about 130 KB gzip) with every form.
 */
const ID_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz' // no 0/o, 1/l/i: easy to read aloud and retype
/** A short, stable public id. It contains no hyphen, so "id-slug" addresses split cleanly. */
export const newShortId = (length = 9): string => Array.from({ length }, () => ID_ALPHABET[randomInt(ID_ALPHABET.length)]).join('')
