import { PhoneProviderId } from './types'

/**
 * The settings of one phone provider.
 *
 * @example
 * const settings: PhoneProviderSettings = { apiKey: key, baseUrl: 'https://api.example.com/astraDialer' }
 */
export interface PhoneProviderSettings {
  apiKey: string
  /** The full endpoint URL of the provider. */
  baseUrl: string
  /** The maximum provider calls per second for all workers. `undefined` means no limit. */
  maxRequestsPerSecond?: number
}

/**
 * The settings of all phone providers.
 *
 * @example
 * const { apiKey } = config.orionConnect
 */
export type PhoneProvidersConfig = Record<PhoneProviderId, PhoneProviderSettings>

/** The prefix of the environment variable names of each provider. */
const ENV_PREFIXES: Record<PhoneProviderId, string> = {
  orionConnect: 'ORION_CONNECT',
  astraDialer: 'ASTRA_DIALER',
  nimbusLookup: 'NIMBUS_LOOKUP',
}

const PROVIDER_IDS = Object.keys(ENV_PREFIXES) as PhoneProviderId[]

function listRequiredVariables(): string[] {
  return PROVIDER_IDS.flatMap((id) => [`${ENV_PREFIXES[id]}_API_KEY`, `${ENV_PREFIXES[id]}_BASE_URL`])
}

function readText(env: NodeJS.ProcessEnv, name: string): string | undefined {
  return env[name]?.trim() || undefined
}

function readBaseUrl(env: NodeJS.ProcessEnv, name: string): string {
  const baseUrl = readText(env, name) ?? ''
  if (!URL.canParse(baseUrl)) {
    throw new Error(`${name} must be an absolute URL`)
  }
  return baseUrl
}

function readRateLimit(env: NodeJS.ProcessEnv, name: string): number | undefined {
  const rawLimit = readText(env, name)
  if (rawLimit === undefined) {
    return undefined
  }
  const limit = Number(rawLimit)
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error(`${name} must be a number greater than 0`)
  }
  return limit
}

function readProviderSettings(env: NodeJS.ProcessEnv, id: PhoneProviderId): PhoneProviderSettings {
  const prefix = ENV_PREFIXES[id]
  const settings: PhoneProviderSettings = {
    apiKey: readText(env, `${prefix}_API_KEY`) ?? '',
    baseUrl: readBaseUrl(env, `${prefix}_BASE_URL`),
  }
  const maxRequestsPerSecond = readRateLimit(env, `${prefix}_MAX_REQUESTS_PER_SECOND`)
  return maxRequestsPerSecond === undefined ? settings : { ...settings, maxRequestsPerSecond }
}

/**
 * Reads and checks the phone provider settings. The worker calls it before it starts, so a
 * missing key stops the worker at once. The error messages name variables, never values.
 *
 * Each provider uses `<PREFIX>_API_KEY`, `<PREFIX>_BASE_URL`, and the optional
 * `<PREFIX>_MAX_REQUESTS_PER_SECOND`. The prefixes are `ORION_CONNECT`, `ASTRA_DIALER`, and `NIMBUS_LOOKUP`.
 *
 * @param env - The environment to read. The default is `process.env`.
 * @returns The settings of each provider.
 * @throws {Error} When a key or a base URL is missing, a base URL is not absolute, or a rate limit is not a positive number.
 * @example
 * const config = loadPhoneProvidersConfig()
 * config.nimbusLookup.maxRequestsPerSecond // undefined when the variable is not set
 */
export function loadPhoneProvidersConfig(env: NodeJS.ProcessEnv = process.env): PhoneProvidersConfig {
  const missing = listRequiredVariables().filter((name) => readText(env, name) === undefined)
  if (missing.length > 0) {
    throw new Error(`Missing phone provider configuration: ${missing.join(', ')}`)
  }
  return {
    orionConnect: readProviderSettings(env, 'orionConnect'),
    astraDialer: readProviderSettings(env, 'astraDialer'),
    nimbusLookup: readProviderSettings(env, 'nimbusLookup'),
  }
}
