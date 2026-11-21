import { LeadsEnrichPhonesOutput } from '../api/types/leads/enrichPhones'
import { Lead } from '../api/types/leads/lead'

/** How often the leads table refetches while a lead is running. */
export const LEADS_POLLING_INTERVAL_MS = 2000
// A provider chain ends in about 45 seconds. A lead that is still running after this time lost its
// workflow, for example after a Temporal restart. The user can start enrichment again.
const MAX_POLLING_DURATION_MS = 2 * 60 * 1000

// A manual copy of the provider labels in `backend/src/phoneProviders/`.
const PROVIDER_LABELS: Record<string, string> = {
  orionConnect: 'Orion Connect',
  astraDialer: 'Astra Dialer',
  nimbusLookup: 'Nimbus Lookup',
}

/** How the phone cell looks: a phone, a search in progress, no phone, or a failed search. */
export type PhoneCellTone = 'value' | 'pending' | 'empty' | 'error'

/** The content of the phone cell in the leads table. */
export interface PhoneCellState {
  text: string
  /** The provider that found the phone, and its country code when it sent one. */
  detail: string | null
  tone: PhoneCellTone
}

/** The parts of the enrich phones response that the result toast uses. */
export type PhoneEnrichmentStartOutcome = Pick<
  LeadsEnrichPhonesOutput,
  'startedCount' | 'skippedWithPhoneCount' | 'errors'
>

/** The text and style of the result toast. */
export interface PhoneEnrichmentStartSummary {
  message: string
  tone: 'success' | 'warning' | 'error'
}

function describeProvider(lead: Lead): string | null {
  if (!lead.phoneProvider) {
    return null
  }
  const label = PROVIDER_LABELS[lead.phoneProvider] ?? lead.phoneProvider
  return lead.phoneCountryCode ? `${label} · ${lead.phoneCountryCode}` : label
}

/**
 * Gets the content of the phone cell for one lead. A phone always wins over the status.
 *
 * @param lead - The lead to show.
 * @returns The text, the provider detail, and the tone of the cell.
 * @example
 * getPhoneCellState({ ...lead, phoneEnrichmentStatus: 'running' })
 * // { text: 'Searching…', detail: null, tone: 'pending' }
 */
export function getPhoneCellState(lead: Lead): PhoneCellState {
  if (lead.phoneNumber) {
    return { text: lead.phoneNumber, detail: describeProvider(lead), tone: 'value' }
  }
  if (lead.phoneEnrichmentStatus === 'running') {
    return { text: 'Searching…', detail: null, tone: 'pending' }
  }
  if (lead.phoneEnrichmentStatus === 'not_found') {
    return { text: 'No data found', detail: null, tone: 'empty' }
  }
  if (lead.phoneEnrichmentStatus === 'failed') {
    return { text: 'Could not enrich', detail: null, tone: 'error' }
  }
  return { text: '-', detail: null, tone: 'empty' }
}

/**
 * Gets the `refetchInterval` of the leads query. It polls while a lead is running, for at most 2 minutes.
 *
 * @param leads - The leads in the cache, or `undefined` before the first fetch.
 * @param pollingStartedAt - When polling started, in epoch milliseconds: the page load or the last "Enrich phone".
 * @param now - The current time in epoch milliseconds.
 * @returns `2000` while a lead is running, or `false` to stop polling.
 * @example
 * refetchInterval: (query) => getLeadsRefetchInterval(query.state.data, pollingStartedAt, Date.now())
 */
export function getLeadsRefetchInterval(
  leads: Lead[] | undefined,
  pollingStartedAt: number,
  now: number
): number | false {
  const hasRunningLead = leads?.some((lead) => lead.phoneEnrichmentStatus === 'running') ?? false
  if (!hasRunningLead) {
    return false
  }
  const isPollingTooLong = now - pollingStartedAt >= MAX_POLLING_DURATION_MS
  return isPollingTooLong ? false : LEADS_POLLING_INTERVAL_MS
}

function pickTone(outcome: PhoneEnrichmentStartOutcome): PhoneEnrichmentStartSummary['tone'] {
  if (outcome.errors.length === 0) {
    return 'success'
  }
  return outcome.startedCount === 0 ? 'error' : 'warning'
}

/**
 * Builds the result toast for an "Enrich phone" request.
 *
 * @param outcome - The counts and the leads that could not start.
 * @returns The toast message and its tone.
 * @example
 * summarizePhoneEnrichmentStart({ startedCount: 3, skippedWithPhoneCount: 1, errors: [] })
 * // { message: 'Searching phones for 3 leads. 1 already has a phone. 0 could not start.', tone: 'success' }
 */
export function summarizePhoneEnrichmentStart(
  outcome: PhoneEnrichmentStartOutcome
): PhoneEnrichmentStartSummary {
  const { startedCount, skippedWithPhoneCount, errors } = outcome
  const started = `Searching phones for ${startedCount} ${startedCount === 1 ? 'lead' : 'leads'}.`
  const skipped = `${skippedWithPhoneCount} already ${skippedWithPhoneCount === 1 ? 'has' : 'have'} a phone.`
  const failed = `${errors.length} could not start.`
  return { message: `${started} ${skipped} ${failed}`, tone: pickTone(outcome) }
}
