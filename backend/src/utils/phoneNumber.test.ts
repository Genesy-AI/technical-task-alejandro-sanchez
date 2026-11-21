import { describe, it, expect } from 'vitest'
import { normalizePhoneNumber } from './phoneNumber'

describe('normalizePhoneNumber', () => {
  it.each(['+1-280-754-0462x2154', '(731)123-9702', '063.430.8860x4762'])('stores %j as it is', (phone) => {
    expect(normalizePhoneNumber(phone)).toBe(phone)
  })

  it('trims the value', () => {
    expect(normalizePhoneNumber('  +34 600 000 000 ')).toBe('+34 600 000 000')
  })

  it.each([undefined, null, '', '   ', 600000000, {}])('stores no phone for %j', (emptyValue) => {
    expect(normalizePhoneNumber(emptyValue)).toBeNull()
  })
})
