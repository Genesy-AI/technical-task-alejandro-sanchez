import { ActivityFailure, log, proxyActivities } from '@temporalio/workflow'
import {
  PHONE_LOOKUP_FIRST_RETRY_DELAY_MS,
  PHONE_LOOKUP_RETRY_BACKOFF,
  PHONE_PROVIDER_CHAIN,
  PhoneProviderStep,
} from '../phoneProviders/registry'
import { PhoneEnrichmentOutcome, PhoneLookupLead, PhoneLookupResult } from '../phoneProviders/types'
import type { PhoneEnrichmentActivities, PhoneLookupActivities } from './activities/phoneEnrichment'

// A database write is fast. The retries cover a short lock on the SQLite file.
const SAVE_ATTEMPT_TIMEOUT = '5 seconds'
const SAVE_MAX_ATTEMPTS = 5
const SAVE_FIRST_RETRY_DELAY = '1 second'
const SAVE_RETRY_BACKOFF = 2

const { savePhoneEnrichment } = proxyActivities<PhoneEnrichmentActivities>({
  startToCloseTimeout: SAVE_ATTEMPT_TIMEOUT,
  retry: {
    maximumAttempts: SAVE_MAX_ATTEMPTS,
    initialInterval: SAVE_FIRST_RETRY_DELAY,
    backoffCoefficient: SAVE_RETRY_BACKOFF,
  },
})

/**
 * The input of `enrichPhoneWorkflow`. It has no API key, because Temporal stores workflow
 * arguments in plain text and the Temporal UI shows them.
 *
 * @example
 * const input: EnrichPhoneInput = { leadId: 7, fullName: 'Ada Lovelace', email: 'ada@acme.com', jobTitle: 'CTO' }
 */
export interface EnrichPhoneInput {
  leadId: number
  fullName: string
  email: string
  jobTitle: string | null
}

type StepResult = PhoneLookupResult | { status: 'failed' }

// Each provider has its own task queue and limits, so each one needs its own proxy.
function proxyLookup(step: PhoneProviderStep): PhoneLookupActivities[typeof step.activityName] {
  const activities = proxyActivities<PhoneLookupActivities>({
    taskQueue: step.taskQueue,
    startToCloseTimeout: step.attemptTimeoutMs,
    retry: {
      maximumAttempts: step.maxAttempts,
      initialInterval: PHONE_LOOKUP_FIRST_RETRY_DELAY_MS,
      backoffCoefficient: PHONE_LOOKUP_RETRY_BACKOFF,
    },
  })
  return activities[step.activityName]
}

// A provider that fails after its retries must not stop the chain.
async function callProvider(step: PhoneProviderStep, lead: PhoneLookupLead): Promise<StepResult> {
  try {
    return await proxyLookup(step)(lead)
  } catch (error: unknown) {
    if (!(error instanceof ActivityFailure)) {
      throw error
    }
    log.warn('Phone provider failed', { provider: step.provider.id, reason: error.cause?.message })
    return { status: 'failed' }
  }
}

async function runProviderChain(lead: PhoneLookupLead): Promise<PhoneEnrichmentOutcome> {
  let hasFailure = false
  // A loop, not an array method: each call must wait for the one before, and the chain stops at the first phone.
  for (const step of PHONE_PROVIDER_CHAIN) {
    const result = await callProvider(step, lead)
    if (result.status === 'found') {
      return {
        status: 'found',
        phone: result.phone,
        countryCode: result.countryCode,
        provider: step.provider.id,
      }
    }
    hasFailure = hasFailure || result.status === 'failed'
  }
  return hasFailure ? { status: 'failed' } : { status: 'not_found' }
}

/**
 * Finds the phone of one lead. It calls Orion Connect, Astra Dialer, and Nimbus Lookup in that
 * order, stops at the first phone, and saves the outcome on the lead.
 *
 * Start it with the workflow ID `enrich-phone-<leadId>`, so each lead has at most one running enrichment.
 *
 * @param input - The lead ID and the lead fields that the providers use.
 * @returns The saved outcome: `found` with the phone and the provider, `not_found`, or `failed`.
 * @throws {ActivityFailure} When the outcome cannot be saved after the maximum attempts.
 * @example
 * await client.workflow.start(enrichPhoneWorkflow, {
 *   taskQueue: 'myQueue',
 *   workflowId: 'enrich-phone-7',
 *   args: [{ leadId: 7, fullName: 'Ada Lovelace', email: 'ada@acme.com', jobTitle: 'CTO' }],
 * })
 */
export async function enrichPhoneWorkflow(input: EnrichPhoneInput): Promise<PhoneEnrichmentOutcome> {
  const { leadId, ...lead } = input
  const outcome = await runProviderChain(lead)
  await savePhoneEnrichment(leadId, outcome)
  return outcome
}
