import { LeadsVerifyEmailsOutput } from '../api/types/leads/verifyEmails'

/** The outcome counts of one email verification request. */
export type EmailVerificationCounts = Pick<
  LeadsVerifyEmailsOutput,
  'validCount' | 'invalidCount' | 'failedCount'
>

/** The text and style of the result toast. */
export interface EmailVerificationSummary {
  message: string
  isError: boolean
}

/**
 * Builds the result toast for an email verification request.
 *
 * @param counts - The valid, invalid, and failed counts from the response.
 * @returns The toast message, and `isError: true` when no lead got a result.
 * @example
 * summarizeEmailVerification({ validCount: 2, invalidCount: 1, failedCount: 1 })
 * // { message: '2 valid, 1 invalid, 1 could not be verified', isError: false }
 */
export function summarizeEmailVerification(counts: EmailVerificationCounts): EmailVerificationSummary {
  const { validCount, invalidCount, failedCount } = counts
  const hasNoResult = validCount + invalidCount === 0
  return {
    message: `${validCount} valid, ${invalidCount} invalid, ${failedCount} could not be verified`,
    isError: failedCount > 0 && hasNoResult,
  }
}
