import { describe, it, expect } from 'vitest'
import { normalizeYearsAtCompany } from './yearsAtCompany'

describe('normalizeYearsAtCompany', () => {
  it.each([
    ['5', 5],
    [' 12 ', 12],
    ['0', 0],
  ])('accepts "%s" as %d', (rawYears, expectedYears) => {
    expect(normalizeYearsAtCompany(rawYears)).toEqual({ yearsAtCompany: expectedYears })
  })

  it.each(['-1', '-3', '2.5', 'abc', '5 years', '2147483648'])(
    'gives a warning that names the value "%s"',
    (invalidYears) => {
      expect(normalizeYearsAtCompany(invalidYears)).toEqual({
        warning: `Invalid years at company "${invalidYears}" dropped`,
      })
    }
  )

  it('gives an empty result for an empty or blank value', () => {
    expect(normalizeYearsAtCompany('')).toEqual({})
    expect(normalizeYearsAtCompany('   ')).toEqual({})
  })
})
