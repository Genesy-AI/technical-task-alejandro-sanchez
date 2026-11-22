import { ApplicationFailure } from '@temporalio/client'
import { PhoneProviderSettings } from './config'
import { InvalidProviderResponseError } from './responseShape'
import { PhoneLookupLead, PhoneLookupResult, PhoneProvider } from './types'

/**
 * The `fetch` signature that the runner uses. Tests pass a mock.
 *
 * @example
 * const fetchFunction: FetchFunction = async () => new Response('{}', { status: 200 })
 */
export type FetchFunction = (url: string, init?: RequestInit) => Promise<Response>

/**
 * The options of one provider call.
 *
 * @example
 * const options: ProviderLookupOptions = { timeoutMs: 5500 }
 */
export interface ProviderLookupOptions {
  /** Aborts the HTTP request after this time. Set it below the activity timeout. */
  timeoutMs: number
  /** The default is the global `fetch`. */
  fetchFunction?: FetchFunction
}

/** The Temporal failure types that the runner throws. */
export const PROVIDER_FAILURE_TYPE = {
  unavailable: 'ProviderUnavailable',
  serverError: 'ProviderServerError',
  rejectedRequest: 'ProviderRejectedRequest',
  invalidResponse: 'InvalidProviderResponse',
} as const

const HTTP_TOO_MANY_REQUESTS = 429
const HTTP_FIRST_SERVER_ERROR = 500
const REDACTED = '[redacted]'

// Temporal stores failure messages in the workflow history, and the Temporal UI shows them.
function redactKey(text: string, apiKey: string): string {
  return text.split(apiKey).join(REDACTED)
}

// The origin and the path only. Nimbus sends its key in the query.
function describeUrl(baseUrl: string): string {
  const url = new URL(baseUrl)
  return `${url.origin}${url.pathname}`
}

function buildUrl(baseUrl: string, query: Record<string, string>): string {
  const url = new URL(baseUrl)
  Object.entries(query).forEach(([name, value]) => url.searchParams.set(name, value))
  return url.toString()
}

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

function isRetryableStatus(status: number): boolean {
  return status >= HTTP_FIRST_SERVER_ERROR || status === HTTP_TOO_MANY_REQUESTS
}

function toStatusFailure(
  provider: PhoneProvider,
  settings: PhoneProviderSettings,
  status: number
): ApplicationFailure {
  const message = `${provider.label} answered with HTTP ${status} at ${describeUrl(settings.baseUrl)}`
  if (isRetryableStatus(status)) {
    return ApplicationFailure.retryable(message, PROVIDER_FAILURE_TYPE.serverError)
  }
  // A 400 or a 401 fails the same way each time. The workflow goes to the next provider at once.
  return ApplicationFailure.nonRetryable(message, PROVIDER_FAILURE_TYPE.rejectedRequest)
}

async function sendRequest(
  url: string,
  init: RequestInit,
  context: { provider: PhoneProvider; settings: PhoneProviderSettings; fetchFunction: FetchFunction }
): Promise<Response> {
  const { provider, settings, fetchFunction } = context
  try {
    return await fetchFunction(url, init)
  } catch (error: unknown) {
    const reason = redactKey(describeError(error), settings.apiKey)
    const message = `${provider.label} request to ${describeUrl(settings.baseUrl)} failed: ${reason}`
    throw ApplicationFailure.retryable(message, PROVIDER_FAILURE_TYPE.unavailable)
  }
}

async function parseBody(provider: PhoneProvider, response: Response): Promise<PhoneLookupResult> {
  try {
    const body: unknown = await response.json()
    return provider.parseResponse(body)
  } catch (error: unknown) {
    const reason = error instanceof InvalidProviderResponseError ? error.message : 'the body is not JSON'
    throw ApplicationFailure.nonRetryable(reason, PROVIDER_FAILURE_TYPE.invalidResponse)
  }
}

/**
 * Calls one phone provider for one lead and maps the response to a normalized result.
 *
 * No failure message contains the API key. Messages show the URL without its query.
 *
 * @param provider - The adapter of the provider.
 * @param settings - The key and the base URL of the provider.
 * @param lead - The lead to look up.
 * @param options - The request timeout and, in tests, a mock `fetch`.
 * @returns The result. A skip sends no request.
 * @throws {ApplicationFailure} Retryable for a 5xx, a 429, a timeout, or a network error.
 * Non-retryable for another 4xx or a body that the adapter does not accept.
 * @example
 * const result = await runProviderLookup(orionConnect, config.orionConnect, lead, { timeoutMs: 5500 })
 */
export async function runProviderLookup(
  provider: PhoneProvider,
  settings: PhoneProviderSettings,
  lead: PhoneLookupLead,
  options: ProviderLookupOptions
): Promise<PhoneLookupResult> {
  const request = provider.buildRequest(lead, settings.apiKey)
  if (request.kind === 'skip') {
    return { status: 'skipped', reason: request.reason }
  }
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...request.headers },
    body: JSON.stringify(request.body),
    signal: AbortSignal.timeout(options.timeoutMs),
  }
  const fetchFunction = options.fetchFunction ?? fetch
  const url = buildUrl(settings.baseUrl, request.query)
  const response = await sendRequest(url, init, { provider, settings, fetchFunction })
  if (!response.ok) {
    throw toStatusFailure(provider, settings, response.status)
  }
  return parseBody(provider, response)
}
