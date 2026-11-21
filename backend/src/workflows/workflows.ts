import { proxyActivities } from '@temporalio/workflow'
import type * as activities from './activities'

// The email provider can be slow or hang. These limits make a verification end in about 9 seconds
// in the worst case: 2 s + 1 s wait + 2 s + 2 s wait + 2 s.
const VERIFY_EMAIL_ATTEMPT_TIMEOUT = '2 seconds'
const VERIFY_EMAIL_MAX_ATTEMPTS = 3
const VERIFY_EMAIL_FIRST_RETRY_DELAY = '1 second'
const VERIFY_EMAIL_RETRY_BACKOFF = 2

const { verifyEmail } = proxyActivities<typeof activities>({
  startToCloseTimeout: VERIFY_EMAIL_ATTEMPT_TIMEOUT,
  retry: {
    maximumAttempts: VERIFY_EMAIL_MAX_ATTEMPTS,
    initialInterval: VERIFY_EMAIL_FIRST_RETRY_DELAY,
    backoffCoefficient: VERIFY_EMAIL_RETRY_BACKOFF,
  },
})

/**
 * Checks if an email address is deliverable.
 *
 * The workflow fails when all activity attempts time out or throw. The caller must treat a
 * failed run as "could not be verified".
 *
 * @param email - The email address to check.
 * @returns `true` when the email is valid, `false` when it is not valid.
 * @throws {ActivityFailure} When the verify activity fails after the maximum attempts.
 * @example
 * const isVerified = await client.workflow.execute(verifyEmailWorkflow, {
 *   taskQueue: 'myQueue',
 *   workflowId: 'verify-email-42',
 *   args: ['jane@example.com'],
 * })
 */
export async function verifyEmailWorkflow(email: string): Promise<boolean> {
  return await verifyEmail(email)
}
