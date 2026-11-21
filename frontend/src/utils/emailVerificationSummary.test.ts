import { describe, expect, it } from 'vitest'
import { EmailVerificationOutcome, summarizeEmailVerification } from './emailVerificationSummary'

const failedLead = (leadId: number, email: string): EmailVerificationOutcome['errors'][number] => ({
  leadId,
  leadName: `Lead ${leadId}`,
  email,
  error: 'Workflow execution failed',
})

describe('summarizeEmailVerification', () => {
  it('shows the valid, invalid, and failed counts', () => {
    const summary = summarizeEmailVerification({ validCount: 3, invalidCount: 1, failedCount: 0, errors: [] })

    expect(summary).toEqual({ message: '3 valid, 1 invalid, 0 could not be verified', tone: 'success' })
  })

  it('names the emails that could not be verified', () => {
    const summary = summarizeEmailVerification({
      validCount: 2,
      invalidCount: 1,
      failedCount: 1,
      errors: [failedLead(3, 'jane.smith@example.com')],
    })

    expect(summary).toEqual({
      message: '2 valid, 1 invalid, 1 could not be verified\nCould not verify: jane.smith@example.com',
      tone: 'warning',
    })
  })

  it('names at most three emails and counts the rest', () => {
    const errors = [1, 2, 3, 4, 5].map((id) => failedLead(id, `lead${id}@example.com`))

    const summary = summarizeEmailVerification({ validCount: 1, invalidCount: 0, failedCount: 5, errors })

    expect(summary.message).toBe(
      '1 valid, 0 invalid, 5 could not be verified\n' +
        'Could not verify: lead1@example.com, lead2@example.com, lead3@example.com and 2 more'
    )
  })

  it('uses the error tone when every lead failed', () => {
    const summary = summarizeEmailVerification({
      validCount: 0,
      invalidCount: 0,
      failedCount: 2,
      errors: [failedLead(1, 'a@example.com'), failedLead(2, 'b@example.com')],
    })

    expect(summary).toEqual({
      message: '0 valid, 0 invalid, 2 could not be verified\nCould not verify: a@example.com, b@example.com',
      tone: 'error',
    })
  })
})
