/** Amounts as members really type them. */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseAmount } from '../../src/lib/community/money'

describe('parseAmount', () => {
  it('accepts plain numbers, thousands separators and a leading currency symbol', () => {
    assert.equal(parseAmount('1599', 'AUD'), 159900)
    assert.equal(parseAmount('1,599', 'AUD'), 159900)
    assert.equal(parseAmount('$1,599.50', 'AUD'), 159950)
    assert.equal(parseAmount('A$1500', 'AUD'), 150000)
    assert.equal(parseAmount('¥20000', 'JPY'), 20000)
  })
  it('still rejects text that is not an amount', () => {
    assert.equal(parseAmount('about 1500', 'AUD'), null)
    assert.equal(parseAmount('1500$', 'AUD'), null)
    assert.equal(parseAmount('10.5', 'JPY'), null)
  })
})
