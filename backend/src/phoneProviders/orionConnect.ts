import { getEmailDomain, isFreeMailDomain } from './emailDomain'
import { readOptionalText, readResponseObject } from './responseShape'
import { PhoneLookupLead, PhoneLookupResult, PhoneProvider, ProviderRequest } from './types'

const LABEL = 'Orion Connect'

// The lead has no company website. The decision for ticket 04 is to use the email domain instead.
function buildRequest(lead: PhoneLookupLead, apiKey: string): ProviderRequest {
  const fullName = lead.fullName.trim()
  const domain = getEmailDomain(lead.email)
  if (!fullName) {
    return { kind: 'skip', reason: 'The lead has no name' }
  }
  if (!domain) {
    return { kind: 'skip', reason: 'The email has no domain' }
  }
  if (isFreeMailDomain(domain)) {
    return { kind: 'skip', reason: `The email domain ${domain} is a free-mail domain` }
  }
  return {
    kind: 'send',
    headers: { 'x-auth-me': apiKey },
    query: {},
    body: { fullName, companyWebsite: domain },
  }
}

function parseResponse(body: unknown): PhoneLookupResult {
  const phone = readOptionalText(readResponseObject(body, LABEL), 'phone', LABEL)
  return phone ? { status: 'found', phone } : { status: 'not_found' }
}

/**
 * The Orion Connect adapter. Best data, but slow (about 4 seconds) and fails about 1 call in 3.
 *
 * Request: `POST { fullName, companyWebsite }` with the key in the `x-auth-me` header.
 * Response: `{ phone: string | null }`.
 *
 * @example
 * orionConnect.parseResponse({ phone: '8229099100' }) // { status: 'found', phone: '8229099100' }
 */
export const orionConnect: PhoneProvider = { id: 'orionConnect', label: LABEL, buildRequest, parseResponse }
