/**
 * A provider sent a 2xx response with a body that the adapter does not accept.
 * The runner does not retry it, because the same request gives the same shape.
 *
 * @example
 * throw new InvalidProviderResponseError('Astra Dialer', 'phoneNmbr is not a string')
 */
export class InvalidProviderResponseError extends Error {
  /**
   * @param providerLabel - The name of the provider.
   * @param problem - What is wrong with the body. It must not contain a secret.
   */
  constructor(providerLabel: string, problem: string) {
    super(`${providerLabel} sent an invalid response: ${problem}`)
    this.name = 'InvalidProviderResponseError'
  }
}

/**
 * Narrows a response body to a JSON object.
 *
 * @param body - The parsed JSON body.
 * @param providerLabel - The name of the provider, for the error message.
 * @returns The body as a record.
 * @throws {InvalidProviderResponseError} When the body is not an object, or is an array or `null`.
 * @example
 * const record = readResponseObject({ phone: '8229099100' }, 'Orion Connect')
 */
export function readResponseObject(body: unknown, providerLabel: string): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new InvalidProviderResponseError(providerLabel, 'the body is not an object')
  }
  return body as Record<string, unknown>
}

/**
 * Reads an optional text value. A missing key, `null`, and empty text all mean "no value".
 *
 * @param record - The response body.
 * @param key - The key to read.
 * @param providerLabel - The name of the provider, for the error message.
 * @returns The trimmed text, or `undefined` when there is no value.
 * @throws {InvalidProviderResponseError} When the value is not a string.
 * @example
 * readOptionalText({ phoneNmbr: null }, 'phoneNmbr', 'Astra Dialer') // undefined
 */
export function readOptionalText(
  record: Record<string, unknown>,
  key: string,
  providerLabel: string
): string | undefined {
  const value = record[key]
  if (value === undefined || value === null) {
    return undefined
  }
  if (typeof value !== 'string') {
    throw new InvalidProviderResponseError(providerLabel, `${key} is not a string`)
  }
  return value.trim() || undefined
}
