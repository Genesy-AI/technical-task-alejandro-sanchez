import { ApplicationFailure } from '@temporalio/client'
import { describe, expect, it, vi } from 'vitest'
import { nimbusLookup } from './nimbusLookup'
import { orionConnect } from './orionConnect'
import { FetchFunction, runProviderLookup } from './runProviderLookup'
import { PhoneLookupLead } from './types'

const FAKE_KEY = 'fake-secret-123'
const TIMEOUT_MS = 1000
const lead: PhoneLookupLead = { fullName: 'Ada Lovelace', email: 'ada@acme.com', jobTitle: 'CTO' }
const orionSettings = { apiKey: FAKE_KEY, baseUrl: 'https://orion.test/orionConnect' }
const nimbusSettings = { apiKey: FAKE_KEY, baseUrl: 'https://nimbus.test/numbusLookup' }

function respondWith(status: number, body: unknown): FetchFunction {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }))
}

async function captureFailure(lookup: Promise<unknown>): Promise<ApplicationFailure> {
  const error = await lookup.then(
    () => undefined,
    (reason: unknown) => reason
  )
  expect(error).toBeInstanceOf(ApplicationFailure)
  return error as ApplicationFailure
}

describe('runProviderLookup', () => {
  it('sends a JSON POST and maps a 200 response with the adapter', async () => {
    const fetchFunction = respondWith(200, { phone: '8229099100' })

    const result = await runProviderLookup(orionConnect, orionSettings, lead, {
      timeoutMs: TIMEOUT_MS,
      fetchFunction,
    })

    expect(result).toEqual({ status: 'found', phone: '8229099100' })
    const [url, init] = vi.mocked(fetchFunction).mock.calls[0]
    expect(url).toBe('https://orion.test/orionConnect')
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-auth-me': FAKE_KEY },
      body: JSON.stringify({ fullName: 'Ada Lovelace', companyWebsite: 'acme.com' }),
    })
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('puts the query values in the URL', async () => {
    const fetchFunction = respondWith(200, { phoneNmbr: 8173646528, countryCode: 'ES' })

    await runProviderLookup(nimbusLookup, nimbusSettings, lead, { timeoutMs: TIMEOUT_MS, fetchFunction })

    expect(vi.mocked(fetchFunction).mock.calls[0][0]).toBe(`https://nimbus.test/numbusLookup?api=${FAKE_KEY}`)
  })

  it('sends no request when the adapter skips the lead', async () => {
    const fetchFunction = respondWith(200, {})

    const result = await runProviderLookup(
      nimbusLookup,
      nimbusSettings,
      { ...lead, jobTitle: null },
      { timeoutMs: TIMEOUT_MS, fetchFunction }
    )

    expect(result).toEqual({ status: 'skipped', reason: 'The lead has no job title' })
    expect(fetchFunction).not.toHaveBeenCalled()
  })

  it.each([500, 503, 429])('throws a retryable failure for status %i', async (status) => {
    const fetchFunction = respondWith(status, { error: 'Internal error' })

    const failure = await captureFailure(
      runProviderLookup(orionConnect, orionSettings, lead, { timeoutMs: TIMEOUT_MS, fetchFunction })
    )

    expect(failure.nonRetryable).toBe(false)
    expect(failure.message).toBe(
      `Orion Connect answered with HTTP ${status} at https://orion.test/orionConnect`
    )
  })

  it.each([400, 401, 404])('throws a non-retryable failure for status %i', async (status) => {
    const fetchFunction = respondWith(status, { error: 'Missing required input' })

    const failure = await captureFailure(
      runProviderLookup(orionConnect, orionSettings, lead, { timeoutMs: TIMEOUT_MS, fetchFunction })
    )

    expect(failure.nonRetryable).toBe(true)
    expect(failure.type).toBe('ProviderRejectedRequest')
  })

  it('throws a retryable failure when the request times out', async () => {
    const fetchFunction: FetchFunction = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      })

    const failure = await captureFailure(
      runProviderLookup(orionConnect, orionSettings, lead, { timeoutMs: 10, fetchFunction })
    )

    expect(failure.nonRetryable).toBe(false)
    expect(failure.type).toBe('ProviderUnavailable')
    expect(failure.message).toContain('TimeoutError')
  })

  it('throws a retryable failure on a network error', async () => {
    const fetchFunction: FetchFunction = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })

    const failure = await captureFailure(
      runProviderLookup(orionConnect, orionSettings, lead, { timeoutMs: TIMEOUT_MS, fetchFunction })
    )

    expect(failure.nonRetryable).toBe(false)
    expect(failure.message).toBe(
      'Orion Connect request to https://orion.test/orionConnect failed: TypeError: fetch failed'
    )
  })

  it('throws a non-retryable failure for an unexpected response shape', async () => {
    const fetchFunction = respondWith(200, [{ phone: '8229099100' }])

    const failure = await captureFailure(
      runProviderLookup(orionConnect, orionSettings, lead, { timeoutMs: TIMEOUT_MS, fetchFunction })
    )

    expect(failure.nonRetryable).toBe(true)
    expect(failure.type).toBe('InvalidProviderResponse')
  })

  it('throws a non-retryable failure for a body that is not JSON', async () => {
    const fetchFunction: FetchFunction = vi.fn(async () => new Response('<html>', { status: 200 }))

    const failure = await captureFailure(
      runProviderLookup(orionConnect, orionSettings, lead, { timeoutMs: TIMEOUT_MS, fetchFunction })
    )

    expect(failure.nonRetryable).toBe(true)
    expect(failure.type).toBe('InvalidProviderResponse')
  })

  describe('never puts the API key in a failure', () => {
    const failingFetches: Array<[string, FetchFunction]> = [
      ['an HTTP error', respondWith(500, {})],
      ['a rejected request', respondWith(401, {})],
      [
        'a network error that names the URL',
        async (url) => {
          throw new TypeError(`fetch failed for ${String(url)}`)
        },
      ],
    ]

    it.each(failingFetches)('for %s on the Nimbus URL with ?api=', async (_name, fetchFunction) => {
      const failure = await captureFailure(
        runProviderLookup(nimbusLookup, nimbusSettings, lead, { timeoutMs: TIMEOUT_MS, fetchFunction })
      )

      expect(failure.message).not.toContain(FAKE_KEY)
      expect(JSON.stringify(failure.details)).not.toContain(FAKE_KEY)
      expect(failure.message).toContain('https://nimbus.test/numbusLookup')
    })
  })
})
