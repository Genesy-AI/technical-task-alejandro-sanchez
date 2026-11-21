/** The largest value the backend `Int` column can hold. */
const MAX_STORABLE_YEARS = 2_147_483_647
const WHOLE_NUMBER_PATTERN = /^\d+$/

/**
 * The result of a years at company check.
 * `yearsAtCompany` is set only for a valid value. `warning` is set only for an invalid value.
 */
export interface NormalizedYearsAtCompany {
  yearsAtCompany?: number
  warning?: string
}

/**
 * Checks the years at the current company: a whole number, `0` or more.
 * The backend `backend/src/utils/yearsAtCompany.ts` does the same check. Update both together.
 *
 * @param rawYears - The years value as it comes from the CSV.
 * @returns The years, a warning for an invalid value, or an empty object for an empty value.
 * @example
 * normalizeYearsAtCompany(' 5 ') // { yearsAtCompany: 5 }
 * normalizeYearsAtCompany('0') // { yearsAtCompany: 0 }
 * normalizeYearsAtCompany('-3') // { warning: 'Invalid years at company "-3" dropped' }
 */
export const normalizeYearsAtCompany = (rawYears: string): NormalizedYearsAtCompany => {
  const trimmedYears = rawYears.trim()
  if (!trimmedYears) {
    return {}
  }

  const yearsAtCompany = Number(trimmedYears)
  if (!WHOLE_NUMBER_PATTERN.test(trimmedYears) || yearsAtCompany > MAX_STORABLE_YEARS) {
    return { warning: `Invalid years at company "${trimmedYears}" dropped` }
  }

  return { yearsAtCompany }
}
