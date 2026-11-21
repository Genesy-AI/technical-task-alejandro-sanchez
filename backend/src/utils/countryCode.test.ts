import { describe, it, expect } from 'vitest'
import { ISO_COUNTRY_CODES, normalizeCountryCode } from './countryCode'

const ASSIGNED_CODE_COUNT = 249

describe('ISO_COUNTRY_CODES', () => {
  it('holds the 249 assigned codes', () => {
    expect(ISO_COUNTRY_CODES.size).toBe(ASSIGNED_CODE_COUNT)
  })

  it.each(['UK', 'EU', 'UN', 'ZZ', 'AN', 'YU'])('does not hold the unassigned code %s', (code) => {
    expect(ISO_COUNTRY_CODES.has(code)).toBe(false)
  })
})

describe('normalizeCountryCode', () => {
  it('accepts a valid code', () => {
    expect(normalizeCountryCode('ES')).toEqual({ countryCode: 'ES', isDropped: false })
  })

  it('trims and uppercases a code', () => {
    expect(normalizeCountryCode(' es ')).toEqual({ countryCode: 'ES', isDropped: false })
  })

  it('maps UK and uk to GB', () => {
    expect(normalizeCountryCode('UK')).toEqual({ countryCode: 'GB', isDropped: false })
    expect(normalizeCountryCode('uk')).toEqual({ countryCode: 'GB', isDropped: false })
  })

  it.each(['XXX', '12', 'XX', 'E'])('drops the invalid code %s', (invalidCode) => {
    expect(normalizeCountryCode(invalidCode)).toEqual({ countryCode: null, isDropped: true })
  })

  it.each([12, true, {}])('drops the non-string value %s', (invalidValue) => {
    expect(normalizeCountryCode(invalidValue)).toEqual({ countryCode: null, isDropped: true })
  })

  it.each([undefined, null, '', '   '])('stores no code and drops nothing for %s', (emptyValue) => {
    expect(normalizeCountryCode(emptyValue)).toEqual({ countryCode: null, isDropped: false })
  })
})
