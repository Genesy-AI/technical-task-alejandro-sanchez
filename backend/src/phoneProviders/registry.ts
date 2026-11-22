import { astraDialer } from './astraDialer'
import { nimbusLookup } from './nimbusLookup'
import { orionConnect } from './orionConnect'
import { PhoneProvider } from './types'

/**
 * The name of the Temporal activity that calls one provider.
 *
 * @example
 * const name: PhoneLookupActivityName = 'lookupPhoneWithOrionConnect'
 */
export type PhoneLookupActivityName =
  | 'lookupPhoneWithOrionConnect'
  | 'lookupPhoneWithAstraDialer'
  | 'lookupPhoneWithNimbusLookup'

/**
 * One step of the provider chain: the adapter, its activity, its task queue, and its limits.
 *
 * @example
 * const { taskQueue, attemptTimeoutMs } = PHONE_PROVIDER_CHAIN[0]
 */
export interface PhoneProviderStep {
  provider: PhoneProvider
  activityName: PhoneLookupActivityName
  /** Each provider has its own queue, so that each one can get its own rate limit. */
  taskQueue: string
  /** The `startToCloseTimeout` of one attempt. */
  attemptTimeoutMs: number
  maxAttempts: number
}

/** The wait before the first retry of a provider call. */
export const PHONE_LOOKUP_FIRST_RETRY_DELAY_MS = 1000
/** Each retry waits this many times longer than the one before. */
export const PHONE_LOOKUP_RETRY_BACKOFF = 2
// Three attempts per provider, as the ticket asks.
const MAX_ATTEMPTS = 3

/**
 * The providers in the order that the workflow calls them. The chain stops at the first phone.
 *
 * Each attempt timeout is above the latency that the live API showed: Orion about 4.2 s,
 * Astra up to 1.2 s, Nimbus up to 2.7 s. In the worst case the full chain ends in about 45 seconds.
 *
 * @example
 * PHONE_PROVIDER_CHAIN.map((step) => step.provider.id) // ['orionConnect', 'astraDialer', 'nimbusLookup']
 */
export const PHONE_PROVIDER_CHAIN: readonly PhoneProviderStep[] = [
  {
    provider: orionConnect,
    activityName: 'lookupPhoneWithOrionConnect',
    taskQueue: 'phone-orion-connect',
    attemptTimeoutMs: 6000,
    maxAttempts: MAX_ATTEMPTS,
  },
  {
    provider: astraDialer,
    activityName: 'lookupPhoneWithAstraDialer',
    taskQueue: 'phone-astra-dialer',
    attemptTimeoutMs: 2000,
    maxAttempts: MAX_ATTEMPTS,
  },
  {
    provider: nimbusLookup,
    activityName: 'lookupPhoneWithNimbusLookup',
    taskQueue: 'phone-nimbus-lookup',
    attemptTimeoutMs: 4000,
    maxAttempts: MAX_ATTEMPTS,
  },
]
