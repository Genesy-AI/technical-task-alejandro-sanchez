import { readOptionalText, readResponseObject } from './responseShape'
import { PhoneLookupLead, PhoneLookupResult, PhoneProvider, ProviderRequest } from './types'

const LABEL = 'Astra Dialer'

function buildRequest(lead: PhoneLookupLead, apiKey: string): ProviderRequest {
  const email = lead.email.trim()
  if (!email) {
    return { kind: 'skip', reason: 'The lead has no email' }
  }
  return { kind: 'send', headers: { apiKey }, query: {}, body: { email } }
}

// The live API sends `{}` or `{ phoneNmbr: null }` when it has no phone.
function parseResponse(body: unknown): PhoneLookupResult {
  const phone = readOptionalText(readResponseObject(body, LABEL), 'phoneNmbr', LABEL)
  return phone ? { status: 'found', phone } : { status: 'not_found' }
}

/**
 * The Astra Dialer adapter. The fastest provider, but with the worst data.
 *
 * Request: `POST { email }` with the key in the `apiKey` header.
 * Response: `{ phoneNmbr?: string | null }`.
 *
 * @example
 * astraDialer.parseResponse({}) // { status: 'not_found' }
 */
export const astraDialer: PhoneProvider = { id: 'astraDialer', label: LABEL, buildRequest, parseResponse }
