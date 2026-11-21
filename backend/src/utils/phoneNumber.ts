/**
 * Trims a phone number. It does not check the format.
 * The example data has extensions and no country, so a correct E.164 conversion is not possible here.
 *
 * @param rawPhoneNumber - The phone value from the request body. Any type is accepted.
 * @returns The trimmed text, or `null` when the value is empty or is not a string.
 * @example
 * normalizePhoneNumber(' (731)123-9702 ') // '(731)123-9702'
 * normalizePhoneNumber('') // null
 */
export function normalizePhoneNumber(rawPhoneNumber: unknown): string | null {
  if (typeof rawPhoneNumber !== 'string') {
    return null
  }
  return rawPhoneNumber.trim() || null
}
