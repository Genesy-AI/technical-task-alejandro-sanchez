/** The largest value the `Int` column can hold. A larger value makes the database write fail. */
const MAX_STORABLE_YEARS = 2_147_483_647
const WHOLE_NUMBER_PATTERN = /^\d+$/

/**
 * The result of a years at company check.
 * `yearsAtCompany` is the value to store. `isDropped` is true when the input had a value that is not valid.
 */
export interface NormalizedYearsAtCompany {
  yearsAtCompany: number | null
  isDropped: boolean
}

const NO_YEARS: NormalizedYearsAtCompany = { yearsAtCompany: null, isDropped: false }
const DROPPED_YEARS: NormalizedYearsAtCompany = { yearsAtCompany: null, isDropped: true }

const isEmptyValue = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === 'string' && !value.trim())

/** Reads a whole number from a number or a digit-only string. Returns `null` for all other values. */
const readWholeNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : null
  }
  if (typeof value === 'string' && WHOLE_NUMBER_PATTERN.test(value.trim())) {
    return Number(value.trim())
  }
  return null
}

/**
 * Checks the years at the current company: a whole number, `0` or more.
 * The bulk import uses this as the final check, because a client can skip the CSV preview.
 *
 * @param rawYears - The years value from the request body. Any type is accepted.
 * @returns The years to store, or `null` with `isDropped` set when the value is not valid.
 * @example
 * normalizeYearsAtCompany('5') // { yearsAtCompany: 5, isDropped: false }
 * normalizeYearsAtCompany(0) // { yearsAtCompany: 0, isDropped: false }
 * normalizeYearsAtCompany('-1') // { yearsAtCompany: null, isDropped: true }
 * normalizeYearsAtCompany('') // { yearsAtCompany: null, isDropped: false }
 */
export function normalizeYearsAtCompany(rawYears: unknown): NormalizedYearsAtCompany {
  if (isEmptyValue(rawYears)) {
    return NO_YEARS
  }

  const yearsAtCompany = readWholeNumber(rawYears)
  if (yearsAtCompany === null || yearsAtCompany < 0 || yearsAtCompany > MAX_STORABLE_YEARS) {
    return DROPPED_YEARS
  }

  return { yearsAtCompany, isDropped: false }
}
