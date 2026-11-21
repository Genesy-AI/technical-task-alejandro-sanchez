import { Prisma, PrismaClient } from '@prisma/client'
import { PhoneProviderSettings } from '../../phoneProviders/config'
import { PhoneLookupActivityName, PhoneProviderStep } from '../../phoneProviders/registry'
import { FetchFunction, runProviderLookup } from '../../phoneProviders/runProviderLookup'
import {
  PHONE_ENRICHMENT_STATUS,
  PhoneEnrichmentOutcome,
  PhoneLookupLead,
  PhoneLookupResult,
} from '../../phoneProviders/types'

// The request aborts a little before the activity attempt times out, so the activity reports
// the timeout as its own retryable failure.
const FETCH_TIMEOUT_MARGIN_MS = 500

/**
 * One provider lookup activity. Its argument has no API key, because Temporal stores activity
 * arguments in plain text.
 *
 * @example
 * const result = await lookupPhoneWithOrionConnect({ fullName, email, jobTitle })
 */
export type PhoneLookupActivity = (lead: PhoneLookupLead) => Promise<PhoneLookupResult>

/**
 * The provider lookup activities, by name. Each one runs on the task queue of its provider.
 *
 * @example
 * const { lookupPhoneWithAstraDialer } = proxyActivities<PhoneLookupActivities>({ taskQueue, startToCloseTimeout })
 */
export type PhoneLookupActivities = Record<PhoneLookupActivityName, PhoneLookupActivity>

/**
 * The activities on the main task queue that store the enrichment result.
 *
 * @example
 * const { savePhoneEnrichment } = proxyActivities<PhoneEnrichmentActivities>({ startToCloseTimeout: '5 seconds' })
 */
export interface PhoneEnrichmentActivities {
  savePhoneEnrichment: (leadId: number, outcome: PhoneEnrichmentOutcome) => Promise<void>
}

/**
 * Makes the lookup activity of one provider. The activity reads the key from the settings that
 * the worker checked at start. The key never goes through Temporal.
 *
 * @param step - The registry entry of the provider.
 * @param settings - The key and the base URL of the provider.
 * @param fetchFunction - A mock `fetch` for tests. The default is the global `fetch`.
 * @returns The activity function.
 * @example
 * const activities = { [step.activityName]: createPhoneLookupActivity(step, config[step.provider.id]) }
 */
export function createPhoneLookupActivity(
  step: PhoneProviderStep,
  settings: PhoneProviderSettings,
  fetchFunction?: FetchFunction
): PhoneLookupActivity {
  const timeoutMs = step.attemptTimeoutMs - FETCH_TIMEOUT_MARGIN_MS
  return (lead) => runProviderLookup(step.provider, settings, lead, { timeoutMs, fetchFunction })
}

/**
 * Maps an enrichment outcome to the lead columns to write.
 *
 * @param outcome - The end result of the provider chain.
 * @param enrichedAt - The time to store in `phoneEnrichedAt`.
 * @returns The data for `prisma.lead.updateMany`.
 * @example
 * toPhoneEnrichmentUpdate({ status: 'not_found' }, new Date())
 * // { phoneEnrichmentStatus: 'not_found', phoneProvider: null, phoneCountryCode: null, phoneEnrichedAt: … }
 */
export function toPhoneEnrichmentUpdate(
  outcome: PhoneEnrichmentOutcome,
  enrichedAt: Date
): Prisma.leadUpdateManyMutationInput {
  if (outcome.status !== PHONE_ENRICHMENT_STATUS.found) {
    return {
      phoneEnrichmentStatus: outcome.status,
      phoneProvider: null,
      phoneCountryCode: null,
      phoneEnrichedAt: enrichedAt,
    }
  }
  return {
    phoneEnrichmentStatus: outcome.status,
    phoneNumber: outcome.phone,
    phoneProvider: outcome.provider,
    phoneCountryCode: outcome.countryCode ?? null,
    phoneEnrichedAt: enrichedAt,
  }
}

/**
 * Makes the activities that store the enrichment result of a lead.
 *
 * `updateMany` does not throw for a lead that was deleted while its workflow ran.
 *
 * @param prisma - The Prisma client.
 * @returns The `savePhoneEnrichment` activity.
 * @example
 * Worker.create({ taskQueue: 'myQueue', activities: { ...createPhoneEnrichmentActivities(prisma) } })
 */
export function createPhoneEnrichmentActivities(prisma: PrismaClient): PhoneEnrichmentActivities {
  return {
    savePhoneEnrichment: async (leadId, outcome) => {
      await prisma.lead.updateMany({
        where: { id: leadId },
        data: toPhoneEnrichmentUpdate(outcome, new Date()),
      })
    },
  }
}
