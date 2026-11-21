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
    expect(normalizeCountryCode('ES')).toEqual({ countryCode: 'ES' })
  })

  it('trims and uppercases a code', () => {
    expect(normalizeCountryCode(' es ')).toEqual({ countryCode: 'ES' })
  })

  it('maps UK and uk to GB with no warning', () => {
    expect(normalizeCountryCode('UK')).toEqual({ countryCode: 'GB' })
    expect(normalizeCountryCode('uk')).toEqual({ countryCode: 'GB' })
  })

  it.each(['XXX', '12', 'XX', 'E'])('gives a warning for %s', (invalidCode) => {
    expect(normalizeCountryCode(invalidCode)).toEqual({
      warning: `Invalid country code "${invalidCode}" dropped`,
    })
  })

  it('gives an empty result for an empty or blank value', () => {
    expect(normalizeCountryCode('')).toEqual({})
    expect(normalizeCountryCode('   ')).toEqual({})
  })
})
