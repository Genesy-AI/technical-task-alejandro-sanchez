import { describe, expect, it } from 'vitest'
import { loadPhoneProvidersConfig } from './config'

// Fake values only. The tests never call a provider.
const completeEnv: NodeJS.ProcessEnv = {
  ORION_CONNECT_API_KEY: 'fake-orion-key',
  ORION_CONNECT_BASE_URL: 'https://orion.test/orionConnect',
  ASTRA_DIALER_API_KEY: 'fake-astra-key',
  ASTRA_DIALER_BASE_URL: 'https://astra.test/astraDialer',
  NIMBUS_LOOKUP_API_KEY: 'fake-nimbus-key',
  NIMBUS_LOOKUP_BASE_URL: 'https://nimbus.test/numbusLookup',
}

describe('loadPhoneProvidersConfig', () => {
  it('reads the key and the base URL of each provider, with no rate limit by default', () => {
    const config = loadPhoneProvidersConfig(completeEnv)

    expect(config).toEqual({
      orionConnect: { apiKey: 'fake-orion-key', baseUrl: 'https://orion.test/orionConnect' },
      astraDialer: { apiKey: 'fake-astra-key', baseUrl: 'https://astra.test/astraDialer' },
      nimbusLookup: { apiKey: 'fake-nimbus-key', baseUrl: 'https://nimbus.test/numbusLookup' },
    })
  })

  it('names each missing or empty variable in one error', () => {
    const env = { ...completeEnv, ORION_CONNECT_API_KEY: undefined, NIMBUS_LOOKUP_BASE_URL: '  ' }

    expect(() => loadPhoneProvidersConfig(env)).toThrow(
      'Missing phone provider configuration: ORION_CONNECT_API_KEY, NIMBUS_LOOKUP_BASE_URL'
    )
  })

  it('reads an optional rate limit for each provider', () => {
    const env = { ...completeEnv, ASTRA_DIALER_MAX_REQUESTS_PER_SECOND: '2.5' }

    const config = loadPhoneProvidersConfig(env)

    expect(config.astraDialer.maxRequestsPerSecond).toBe(2.5)
    expect(config.orionConnect.maxRequestsPerSecond).toBeUndefined()
  })

  it('treats an empty rate limit as no limit', () => {
    const env = { ...completeEnv, ORION_CONNECT_MAX_REQUESTS_PER_SECOND: '' }

    expect(loadPhoneProvidersConfig(env).orionConnect.maxRequestsPerSecond).toBeUndefined()
  })

  it.each(['0', '-1', 'fast'])('rejects the rate limit %j and names the variable', (value) => {
    const env = { ...completeEnv, NIMBUS_LOOKUP_MAX_REQUESTS_PER_SECOND: value }

    expect(() => loadPhoneProvidersConfig(env)).toThrow(
      'NIMBUS_LOOKUP_MAX_REQUESTS_PER_SECOND must be a number greater than 0'
    )
  })

  it('rejects a base URL that is not a URL', () => {
    const env = { ...completeEnv, ASTRA_DIALER_BASE_URL: 'astraDialer' }

    expect(() => loadPhoneProvidersConfig(env)).toThrow('ASTRA_DIALER_BASE_URL must be an absolute URL')
  })

  it('never puts a key value in an error message', () => {
    const env = { ...completeEnv, ORION_CONNECT_BASE_URL: undefined }

    expect(() => loadPhoneProvidersConfig(env)).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('fake-') })
    )
  })
})
