import { Client } from '@temporalio/client'
import { TEMPORAL_TASK_QUEUE } from './temporalClient'
import { verifyEmailWorkflow } from './workflows'

// A safety limit if the activity limits change. The activity limits end a run in about 9 seconds.
const VERIFY_EMAIL_WORKFLOW_TIMEOUT = '30 seconds'
const UNKNOWN_ERROR_MESSAGE = 'Unknown error'

/** The lead fields that email verification needs. */
export interface LeadToVerify {
  id: number
  firstName: string
  lastName: string
  email: string
}

/** The side effects of email verification. The endpoint supplies Temporal and Prisma. */
export interface EmailVerificationDependencies {
  /** Checks one email. Resolves `true` for valid, `false` for not valid. Rejects when the check fails. */
  runVerification: (lead: LeadToVerify) => Promise<boolean>
  /** Stores the result of a completed check. */
  saveVerification: (leadId: number, isVerified: boolean) => Promise<void>
}

/** A lead with a completed check. */
export interface EmailVerificationResult {
  leadId: number
  emailVerified: boolean
}

/** A lead that could not be verified. Its `emailVerified` value stays unchanged. */
export interface EmailVerificationError {
  leadId: number
  leadName: string
  /** The email that could not be verified. The UI shows it to the user. */
  email: string
  error: string
}

/** The response body of `POST /leads/verify-emails`. */
export interface EmailVerificationReport {
  success: true
  /** The number of completed checks: `validCount + invalidCount`. Kept for older clients. */
  verifiedCount: number
  validCount: number
  invalidCount: number
  failedCount: number
  results: EmailVerificationResult[]
  errors: EmailVerificationError[]
}

type LeadOutcome =
  | { isFulfilled: true; result: EmailVerificationResult }
  | { isFulfilled: false; error: EmailVerificationError }

async function verifyAndSaveLead(
  lead: LeadToVerify,
  dependencies: EmailVerificationDependencies
): Promise<EmailVerificationResult> {
  const isVerified = await dependencies.runVerification(lead)
  await dependencies.saveVerification(lead.id, isVerified)
  return { leadId: lead.id, emailVerified: isVerified }
}

function toLeadOutcome(
  lead: LeadToVerify,
  settled: PromiseSettledResult<EmailVerificationResult>
): LeadOutcome {
  if (settled.status === 'fulfilled') {
    return { isFulfilled: true, result: settled.value }
  }
  const error = settled.reason instanceof Error ? settled.reason.message : UNKNOWN_ERROR_MESSAGE
  return {
    isFulfilled: false,
    error: {
      leadId: lead.id,
      leadName: `${lead.firstName} ${lead.lastName}`.trim(),
      email: lead.email,
      error,
    },
  }
}

function buildReport(outcomes: LeadOutcome[]): EmailVerificationReport {
  const results = outcomes.flatMap((outcome) => (outcome.isFulfilled ? [outcome.result] : []))
  const errors = outcomes.flatMap((outcome) => (outcome.isFulfilled ? [] : [outcome.error]))
  const validCount = results.filter((result) => result.emailVerified).length
  return {
    success: true,
    verifiedCount: results.length,
    validCount,
    invalidCount: results.length - validCount,
    failedCount: errors.length,
    results,
    errors,
  }
}

/**
 * Verifies the emails of all leads in parallel and saves each completed check.
 *
 * A failed check does not stop the other checks. The lead goes into `errors`, and its stored
 * `emailVerified` value stays unchanged.
 *
 * @param leads - The leads to verify.
 * @param dependencies - The functions that run one check and save one result.
 * @returns A report with the counts, the completed checks, and the failed leads.
 * @example
 * const report = await verifyLeadEmails(leads, {
 *   runVerification: (lead) => runEmailVerificationWorkflow(client, lead),
 *   saveVerification: (leadId, isVerified) => saveEmailVerified(leadId, isVerified),
 * })
 */
export async function verifyLeadEmails(
  leads: LeadToVerify[],
  dependencies: EmailVerificationDependencies
): Promise<EmailVerificationReport> {
  const settled = await Promise.allSettled(leads.map((lead) => verifyAndSaveLead(lead, dependencies)))
  return buildReport(settled.map((result, index) => toLeadOutcome(leads[index], result)))
}

/**
 * Runs `verifyEmailWorkflow` for one lead and waits for its result.
 *
 * The workflow ID is `verify-email-<leadId>`. A second call for a lead with a running workflow
 * joins that workflow and does not start a duplicate.
 *
 * @param client - The Temporal client.
 * @param lead - The lead to verify.
 * @returns `true` when the email is valid, `false` when it is not valid.
 * @throws {WorkflowFailedError} When the workflow fails or times out.
 * @example
 * const isVerified = await runEmailVerificationWorkflow(await getTemporalClient(), lead)
 */
export async function runEmailVerificationWorkflow(client: Client, lead: LeadToVerify): Promise<boolean> {
  return await client.workflow.execute(verifyEmailWorkflow, {
    taskQueue: TEMPORAL_TASK_QUEUE,
    workflowId: `verify-email-${lead.id}`,
    workflowIdConflictPolicy: 'USE_EXISTING',
    workflowExecutionTimeout: VERIFY_EMAIL_WORKFLOW_TIMEOUT,
    args: [lead.email],
  })
}
