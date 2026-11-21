import { describe, expect, it } from 'vitest'
import { summarizeEmailVerification } from './emailVerificationSummary'

describe('summarizeEmailVerification', () => {
  it('shows the valid, invalid, and failed counts', () => {
    const summary = summarizeEmailVerification({ validCount: 2, invalidCount: 1, failedCount: 1 })

    expect(summary).toEqual({ message: '2 valid, 1 invalid, 1 could not be verified', isError: false })
  })

  it('shows zero counts, so that each outcome is always visible', () => {
    const summary = summarizeEmailVerification({ validCount: 3, invalidCount: 0, failedCount: 0 })

    expect(summary).toEqual({ message: '3 valid, 0 invalid, 0 could not be verified', isError: false })
  })

  it('uses the error style when every lead failed', () => {
    const summary = summarizeEmailVerification({ validCount: 0, invalidCount: 0, failedCount: 2 })

    expect(summary).toEqual({ message: '0 valid, 0 invalid, 2 could not be verified', isError: true })
  })
})
