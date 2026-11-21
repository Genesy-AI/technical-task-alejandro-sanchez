import { Client } from '@temporalio/client'
import { PHONE_ENRICHMENT_STATUS } from './phoneProviders/types'
import { TEMPORAL_TASK_QUEUE } from './temporalClient'
import { enrichPhoneWorkflow } from './workflows'

const UNKNOWN_ERROR_MESSAGE = 'Unknown error'

/**
 * The lead fields that the enrich phone endpoint needs.
 *
 * @example
 * const lead: LeadToEnrich = await prisma.lead.findUniqueOrThrow({ where: { id } })
 */
export interface LeadToEnrich {
  id: number
  firstName: string
  lastName: string
  email: string
  jobTitle: string | null
  phoneNumber: string | null
  /** The status before this request. A failed start puts it back. */
  phoneEnrichmentStatus: string | null
}

/**
 * The side effects of starting phone enrichment. The endpoint supplies Temporal and Prisma.
 *
 * @example
 * const dependencies: PhoneEnrichmentDependencies = { saveStatus, startEnrichment }
 */
export interface PhoneEnrichmentDependencies {
  /** Stores the enrichment status of one lead. */
  saveStatus: (leadId: number, status: string | null) => Promise<void>
  /** Starts the enrichment workflow of one lead. It does not wait for the result. */
  startEnrichment: (lead: LeadToEnrich) => Promise<void>
}

/**
 * A lead whose enrichment could not start. Its earlier status is back in place.
 *
 * @example
 * const error: PhoneEnrichmentStartError = { leadId: 3, leadName: 'Ada Byron', error: 'Temporal is down' }
 */
export interface PhoneEnrichmentStartError {
  leadId: number
  leadName: string
  error: string
}

/**
 * The response body of `POST /leads/enrich-phones`.
 *
 * @example
 * const report: PhoneEnrichmentStartReport = { success: true, startedCount: 4, skippedWithPhoneCount: 1, errors: [] }
 */
export interface PhoneEnrichmentStartReport {
  success: true
  /** The leads with a running workflow, including a workflow that was already running. */
  startedCount: number
  /** The leads that already have a phone. No workflow starts for them. */
  skippedWithPhoneCount: number
  errors: PhoneEnrichmentStartError[]
}

function hasPhone(lead: LeadToEnrich): boolean {
  return Boolean(lead.phoneNumber?.trim())
}

// Set `running` first. A fast workflow can end before the start call returns, and its saved
// result must not be overwritten.
async function startOneEnrichment(
  lead: LeadToEnrich,
  dependencies: PhoneEnrichmentDependencies
): Promise<void> {
  await dependencies.saveStatus(lead.id, PHONE_ENRICHMENT_STATUS.running)
  try {
    await dependencies.startEnrichment(lead)
  } catch (error: unknown) {
    await dependencies.saveStatus(lead.id, lead.phoneEnrichmentStatus).catch(() => undefined)
    throw error
  }
}

function toStartError(lead: LeadToEnrich, reason: unknown): PhoneEnrichmentStartError {
  return {
    leadId: lead.id,
    leadName: `${lead.firstName} ${lead.lastName}`.trim(),
    error: reason instanceof Error ? reason.message : UNKNOWN_ERROR_MESSAGE,
  }
}

/**
 * Starts phone enrichment for each lead with no phone, in parallel. It does not wait for the results.
 *
 * Each started lead is `running` until its workflow saves `found`, `not_found`, or `failed`.
 * A lead whose workflow cannot start gets its earlier status back and goes into `errors`.
 *
 * @param leads - The selected leads.
 * @param dependencies - The functions that store a status and start one workflow.
 * @returns The started, skipped, and failed counts.
 * @example
 * const report = await startLeadPhoneEnrichments(leads, {
 *   saveStatus: (leadId, status) => saveEnrichmentStatus(leadId, status),
 *   startEnrichment: (lead) => startPhoneEnrichmentWorkflow(client, lead),
 * })
 */
export async function startLeadPhoneEnrichments(
  leads: LeadToEnrich[],
  dependencies: PhoneEnrichmentDependencies
): Promise<PhoneEnrichmentStartReport> {
  const leadsToStart = leads.filter((lead) => !hasPhone(lead))
  const settled = await Promise.allSettled(leadsToStart.map((lead) => startOneEnrichment(lead, dependencies)))
  const errors = settled.flatMap((result, index) =>
    result.status === 'rejected' ? [toStartError(leadsToStart[index], result.reason)] : []
  )
  return {
    success: true,
    startedCount: leadsToStart.length - errors.length,
    skippedWithPhoneCount: leads.length - leadsToStart.length,
    errors,
  }
}

/**
 * Starts `enrichPhoneWorkflow` for one lead and returns at once.
 *
 * The workflow ID is `enrich-phone-<leadId>`. A second call for a lead with a running workflow
 * joins that workflow and does not start a duplicate.
 *
 * @param client - The Temporal client.
 * @param lead - The lead to enrich.
 * @returns A promise that resolves when Temporal accepts the start.
 * @throws When Temporal cannot start the workflow.
 * @example
 * await startPhoneEnrichmentWorkflow(await getTemporalClient(), lead)
 */
export async function startPhoneEnrichmentWorkflow(client: Client, lead: LeadToEnrich): Promise<void> {
  await client.workflow.start(enrichPhoneWorkflow, {
    taskQueue: TEMPORAL_TASK_QUEUE,
    workflowId: `enrich-phone-${lead.id}`,
    workflowIdConflictPolicy: 'USE_EXISTING',
    args: [
      {
        leadId: lead.id,
        fullName: `${lead.firstName} ${lead.lastName}`.trim(),
        email: lead.email,
        jobTitle: lead.jobTitle,
      },
    ],
  })
}

/**
 * Reads the `leadIds` list from a request body.
 *
 * @param body - The parsed request body.
 * @returns The ids as numbers, or `null` when the list is missing, empty, or has a value that is not a whole number.
 * @example
 * readLeadIds({ leadIds: [1, '2'] }) // [1, 2]
 * readLeadIds({ leadIds: [] }) // null
 */
export function readLeadIds(body: unknown): number[] | null {
  if (typeof body !== 'object' || body === null || !('leadIds' in body)) {
    return null
  }
  const { leadIds } = body
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return null
  }
  const isEachIdNumeric = leadIds.every((id: unknown) => typeof id === 'number' || typeof id === 'string')
  const ids = leadIds.map((id: unknown) => Number(id))
  return isEachIdNumeric && ids.every((id) => Number.isInteger(id) && id > 0) ? ids : null
}
