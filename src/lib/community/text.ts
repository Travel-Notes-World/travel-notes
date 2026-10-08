import { randomInt } from 'node:crypto'

import { LIMITS } from './constants'

/**
 * Member text is plain text. Nothing a member types is ever stored or rendered as HTML, so there
 * is no markup to sanitise: React escapes it on output and links are built from checked addresses.
 */

/** Tidy text from a form: unify line breaks, drop control characters, trim, collapse long blank runs. */
export function cleanText(input: unknown, max: number): string {
  if (typeof input !== 'string') return ''
  const text = input
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    // Control characters, except tab and line break. Also the invisible direction-override characters used to disguise links.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text.length > max ? text.slice(0, max) : text
}

/** One line of text: no line breaks at all. */
export const cleanLine = (input: unknown, max: number): string => cleanText(input, max * 2).replace(/\s+/g, ' ').trim().slice(0, max)

const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gi

export const countLinks = (text: string): number => (text.match(URL_PATTERN) ?? []).length

/**
 * Accept only an absolute http(s) address. Returns the normalised address or null.
 * This is a format check only: the server never fetches a member's link.
 */
export function safeHttpUrl(input: unknown, max = 500): string | null {
  if (typeof input !== 'string') return null
  const value = input.trim()
  if (!value || value.length > max) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (!url.hostname.includes('.') || url.username || url.password) return null
  return url.toString()
}

export type TextPart = { kind: 'text'; value: string } | { kind: 'link'; href: string; label: string }

/** Split a paragraph into text and safe links, for rendering. Trailing punctuation stays outside the link. */
export function linkParts(paragraph: string): TextPart[] {
  const parts: TextPart[] = []
  let last = 0
  for (const match of paragraph.matchAll(URL_PATTERN)) {
    const raw = match[0].replace(/[),.;:!?\]]+$/, '')
    const start = match.index ?? 0
    const href = safeHttpUrl(raw)
    if (!href) continue
    if (start > last) parts.push({ kind: 'text', value: paragraph.slice(last, start) })
    parts.push({ kind: 'link', href, label: raw.length > 60 ? `${raw.slice(0, 57)}…` : raw })
    last = start + raw.length
  }
  if (last < paragraph.length) parts.push({ kind: 'text', value: paragraph.slice(last) })
  return parts
}

export const paragraphs = (text: string | null | undefined): string[] => (text ?? '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)

/** A short plain summary for cards and search descriptions, cut at a word boundary. */
export function excerpt(text: string | null | undefined, max = 160): string {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${space > max * 0.5 ? cut.slice(0, space) : cut}…`
}

/** Address-safe slug. Non-Latin titles fall back to "post", because the stable id carries the identity. */
export function slugify(input: string, max = 80): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, max)
    .replace(/-$/, '')
  return slug || 'post'
}

const ID_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz' // no 0/o, 1/l/i: easy to read aloud and retype
/** A short, stable public id. It contains no hyphen, so "id-slug" addresses split cleanly. */
export const newShortId = (length = 9): string => Array.from({ length }, () => ID_ALPHABET[randomInt(ID_ALPHABET.length)]).join('')

/** Read the stable id from an "id-slug" address segment. */
export const shortIdFromSegment = (segment: string): string => decodeURIComponent(segment).split('-')[0].toLowerCase()

export const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/

export const validYearMonth = (value: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(value)

export const bodyTooManyLinks = (text: string): boolean => countLinks(text) > LIMITS.maxLinksInBody
