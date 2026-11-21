import { describe, it, expect } from 'vitest'
import { normalizeYearsAtCompany } from './yearsAtCompany'

describe('normalizeYearsAtCompany', () => {
  it.each([
    [5, 5],
    ['5', 5],
    [' 12 ', 12],
    [0, 0],
    ['0', 0],
  ])('accepts %j as %d', (rawYears, expectedYears) => {
    expect(normalizeYearsAtCompany(rawYears)).toEqual({ yearsAtCompany: expectedYears, isDropped: false })
  })

  it.each([-1, '-1', 2.5, '2.5', 'abc', '5 years', Number.NaN, Number.POSITIVE_INFINITY, true, {}])(
    'drops the invalid value %j',
    (invalidYears) => {
      expect(normalizeYearsAtCompany(invalidYears)).toEqual({ yearsAtCompany: null, isDropped: true })
    }
  )

  it('drops a value too large for the database column', () => {
    expect(normalizeYearsAtCompany('2147483648')).toEqual({ yearsAtCompany: null, isDropped: true })
  })

  it.each([undefined, null, '', '   '])('stores no value and drops nothing for %j', (emptyYears) => {
    expect(normalizeYearsAtCompany(emptyYears)).toEqual({ yearsAtCompany: null, isDropped: false })
  })
})
