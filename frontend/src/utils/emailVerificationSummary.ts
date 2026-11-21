import { LeadsVerifyEmailsOutput } from '../api/types/leads/verifyEmails'

// A toast has little room. The user sees the rest as a count.
const MAX_LISTED_EMAILS = 3

/** The parts of one email verification response that the result toast uses. */
export type EmailVerificationOutcome = Pick<
  LeadsVerifyEmailsOutput,
  'validCount' | 'invalidCount' | 'failedCount' | 'errors'
>

/** How the result toast looks: all checks done, some failed, or all failed. */
export type EmailVerificationTone = 'success' | 'warning' | 'error'

/** The text and style of the result toast. */
export interface EmailVerificationSummary {
  message: string
  tone: EmailVerificationTone
}

function listFailedEmails(errors: EmailVerificationOutcome['errors']): string {
  const listed = errors.slice(0, MAX_LISTED_EMAILS).map((failed) => failed.email)
  const hiddenCount = errors.length - listed.length
  const suffix = hiddenCount > 0 ? ` and ${hiddenCount} more` : ''
  return `Could not verify: ${listed.join(', ')}${suffix}`
}

function pickTone(outcome: EmailVerificationOutcome): EmailVerificationTone {
  if (outcome.failedCount === 0) {
    return 'success'
  }
  const hasNoResult = outcome.validCount + outcome.invalidCount === 0
  return hasNoResult ? 'error' : 'warning'
}

/**
 * Builds the result toast for an email verification request.
 *
 * @param outcome - The counts and the failed leads from the response.
 * @returns The toast message, which names up to three failed emails, and its tone.
 * @example
 * summarizeEmailVerification({ validCount: 2, invalidCount: 1, failedCount: 1, errors: [janeSmith] })
 * // { message: '2 valid, 1 invalid, 1 could not be verified\nCould not verify: jane.smith@example.com',
 * //   tone: 'warning' }
 */
export function summarizeEmailVerification(outcome: EmailVerificationOutcome): EmailVerificationSummary {
  const { validCount, invalidCount, failedCount, errors } = outcome
  const counts = `${validCount} valid, ${invalidCount} invalid, ${failedCount} could not be verified`
  const message = errors.length > 0 ? `${counts}\n${listFailedEmails(errors)}` : counts
  return { message, tone: pickTone(outcome) }
}
