import { InvalidProviderResponseError, readOptionalText, readResponseObject } from './responseShape'
import { PhoneLookupLead, PhoneLookupResult, PhoneProvider, ProviderRequest } from './types'

const LABEL = 'Nimbus Lookup'
// The live API sends `phoneNmbr`. The README documents `number`. Accept both.
const PHONE_KEYS = ['phoneNmbr', 'number'] as const

function buildRequest(lead: PhoneLookupLead, apiKey: string): ProviderRequest {
  const jobTitle = lead.jobTitle?.trim()
  if (!jobTitle) {
    return { kind: 'skip', reason: 'The lead has no job title' }
  }
  return { kind: 'send', headers: {}, query: { api: apiKey }, body: { email: lead.email.trim(), jobTitle } }
}

// The live API sends the phone as a JSON number. Keep the digits as text, with no E.164 conversion (ADR 0006).
function readPhone(record: Record<string, unknown>): string | undefined {
  const key = PHONE_KEYS.find((candidate) => record[candidate] !== undefined && record[candidate] !== null)
  if (key === undefined) {
    return undefined
  }
  const value = record[key]
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new InvalidProviderResponseError(LABEL, `${key} is not a whole positive number`)
    }
    return String(value)
  }
  return readOptionalText(record, key, LABEL)
}

function parseResponse(body: unknown): PhoneLookupResult {
  const record = readResponseObject(body, LABEL)
  const phone = readPhone(record)
  if (!phone) {
    return { status: 'not_found' }
  }
  const countryCode = readOptionalText(record, 'countryCode', LABEL)
  return countryCode ? { status: 'found', phone, countryCode } : { status: 'found', phone }
}

/**
 * The Nimbus Lookup adapter. A new provider. It needs a job title, so a lead without one is skipped.
 *
 * Request: `POST { email, jobTitle }` with the key in the `api` query value.
 * Response (live): `{ phoneNmbr: number, countryCode: string }`. Response (README): `{ number, countryCode }`.
 *
 * @example
 * nimbusLookup.parseResponse({ phoneNmbr: 8173646528, countryCode: 'ES' })
 * // { status: 'found', phone: '8173646528', countryCode: 'ES' }
 */
export const nimbusLookup: PhoneProvider = { id: 'nimbusLookup', label: LABEL, buildRequest, parseResponse }
