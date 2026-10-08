/**
 * Money is stored as an exact whole number of the currency's smallest unit ("minor units":
 * cents for USD, yen for JPY, fils for KWD) together with the currency code. It is never stored
 * or added up as a floating-point number, and amounts in different currencies are never added.
 */

const currencyDigits = new Map<string, number>()

export function isCurrency(code: unknown): code is string {
  if (typeof code !== 'string' || !/^[A-Z]{3}$/.test(code)) return false
  try {
    return (Intl.supportedValuesOf('currency') as string[]).includes(code)
  } catch {
    return false
  }
}

/** Decimal places for a currency: 2 for USD, 0 for JPY, 3 for KWD. */
export function minorDigits(currency: string): number {
  let digits = currencyDigits.get(currency)
  if (digits === undefined) {
    digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
    currencyDigits.set(currency, digits)
  }
  return digits
}

/**
 * Turn what a person typed ("1,250.50", "1250") into minor units without using floating point.
 * Returns null when the text is not a valid amount for that currency.
 */
export function parseAmount(input: unknown, currency: string): number | null {
  if (typeof input !== 'string' && typeof input !== 'number') return null
  const text = String(input).trim().replace(/[\s,_']/g, '')
  if (!/^\d{1,12}(\.\d{1,3})?$/.test(text)) return null
  const digits = minorDigits(currency)
  const [whole, fraction = ''] = text.split('.')
  if (fraction.length > digits) return null // "10.5" yen or "1.234" dollars is a typing mistake, not something to round away
  const minor = BigInt(whole) * 10n ** BigInt(digits) + BigInt(fraction.padEnd(digits, '0') || '0')
  return minor <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(minor) : null
}

/** Minor units back to the plain text a person would type, for editing a saved amount. */
export function amountToInput(minor: number, currency: string): string {
  const digits = minorDigits(currency)
  const value = BigInt(Math.round(minor))
  if (digits === 0) return value.toString()
  const base = 10n ** BigInt(digits)
  return `${value / base}.${(value % base).toString().padStart(digits, '0')}`
}

/** Display an amount in its own currency, for example "THB 1,250.00". */
export function formatMoney(minor: number, currency: string, locale = 'en'): string {
  const digits = minorDigits(currency)
  const value = BigInt(Math.round(minor))
  const base = 10n ** BigInt(digits)
  const whole = new Intl.NumberFormat(locale).format(value / base)
  const fraction = digits ? `.${(value % base).toString().padStart(digits, '0')}` : ''
  return `${currency} ${whole}${fraction}`
}

export type CostLine = { amountMinor: number; currency: string; quantity?: number | null }
export type CurrencyTotal = { currency: string; totalMinor: number }

/**
 * Totals per currency. There is no exchange-rate source in this release, so currencies are
 * reported side by side and never converted or combined into one figure.
 */
export function totalsByCurrency(lines: CostLine[]): CurrencyTotal[] {
  const totals = new Map<string, bigint>()
  for (const line of lines) {
    const quantity = BigInt(Math.max(1, Math.round(line.quantity ?? 1)))
    totals.set(line.currency, (totals.get(line.currency) ?? 0n) + BigInt(Math.round(line.amountMinor)) * quantity)
  }
  return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, total]) => ({ currency, totalMinor: Number(total) }))
}

/**
 * Per-person figure for a per-party total. Whole minor units only: the remainder is dropped and
 * the result is labelled "about" where it is shown.
 */
export const perPerson = (totalMinor: number, partySize: number): number => Number(BigInt(Math.round(totalMinor)) / BigInt(Math.max(1, Math.round(partySize))))
