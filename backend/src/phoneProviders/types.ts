/**
 * The ID of a phone provider. The workflow, the config, and the stored `phoneProvider` value use it.
 *
 * @example
 * const providerId: PhoneProviderId = 'orionConnect'
 */
export type PhoneProviderId = 'orionConnect' | 'astraDialer' | 'nimbusLookup'

/**
 * The lead fields that the phone providers can use. It has no API key, because Temporal stores
 * activity arguments in plain text.
 *
 * @example
 * const lead: PhoneLookupLead = { fullName: 'Ada Lovelace', email: 'ada@acme.com', jobTitle: 'CTO' }
 */
export interface PhoneLookupLead {
  fullName: string
  email: string
  jobTitle: string | null
}

/**
 * The normalized result of one provider call. A failed call is a thrown error, not a result.
 *
 * - `found`: the provider has a phone. `countryCode` is set only when the provider sends one.
 * - `not_found`: the provider answered with no phone.
 * - `skipped`: the lead does not have the input that the provider needs. No request was sent.
 *
 * @example
 * const result: PhoneLookupResult = { status: 'found', phone: '8173646528', countryCode: 'ES' }
 */
export type PhoneLookupResult =
  | { status: 'found'; phone: string; countryCode?: string }
  | { status: 'not_found' }
  | { status: 'skipped'; reason: string }

/**
 * The request that an adapter builds for one lead, or a skip when the lead lacks a required input.
 * The runner adds the base URL, the JSON content type, and the timeout.
 *
 * @example
 * const request: ProviderRequest = { kind: 'send', headers: { apiKey: key }, query: {}, body: { email } }
 */
export type ProviderRequest =
  | {
      kind: 'send'
      headers: Record<string, string>
      query: Record<string, string>
      body: Record<string, string>
    }
  | { kind: 'skip'; reason: string }

/**
 * One phone provider. It hides the request, auth, and response shape of the provider.
 * Both functions are pure, so they can be tested with no network.
 *
 * @example
 * const request = orionConnect.buildRequest(lead, apiKey)
 * const result = orionConnect.parseResponse({ phone: '8229099100' })
 */
export interface PhoneProvider {
  id: PhoneProviderId
  /** The name that people see, for example in error messages. */
  label: string
  /** Builds the request for one lead. Returns a skip when the lead lacks a required input. */
  buildRequest: (lead: PhoneLookupLead, apiKey: string) => ProviderRequest
  /**
   * Maps the parsed JSON body of a 2xx response to a result.
   * @throws {InvalidProviderResponseError} When the body has an unexpected shape.
   */
  parseResponse: (body: unknown) => PhoneLookupResult
}

/**
 * The stored phone enrichment status of a lead. SQLite has no enums, so the code names the values.
 *
 * @example
 * await prisma.lead.update({ where: { id }, data: { phoneEnrichmentStatus: PHONE_ENRICHMENT_STATUS.running } })
 */
export const PHONE_ENRICHMENT_STATUS = {
  running: 'running',
  found: 'found',
  notFound: 'not_found',
  failed: 'failed',
} as const

/**
 * One value of `PHONE_ENRICHMENT_STATUS`.
 *
 * @example
 * const status: PhoneEnrichmentStatus = 'not_found'
 */
export type PhoneEnrichmentStatus = (typeof PHONE_ENRICHMENT_STATUS)[keyof typeof PHONE_ENRICHMENT_STATUS]

/**
 * The end result of the provider chain for one lead.
 *
 * - `found`: a provider found a phone. The chain stopped there.
 * - `not_found`: each provider answered with no phone, or was skipped.
 * - `failed`: at least one provider failed after its retries, and no provider found a phone.
 *
 * @example
 * const outcome: PhoneEnrichmentOutcome = { status: 'found', phone: '8229099100', provider: 'orionConnect' }
 */
export type PhoneEnrichmentOutcome =
  | { status: 'found'; phone: string; provider: PhoneProviderId; countryCode?: string }
  | { status: 'not_found' }
  | { status: 'failed' }
