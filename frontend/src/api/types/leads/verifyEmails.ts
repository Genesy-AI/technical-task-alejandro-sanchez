export type LeadsVerifyEmailsInput = {
  leadIds: number[]
}

export type LeadsVerifyEmailsOutput = {
  success: boolean
  /** The number of completed checks: `validCount + invalidCount`. */
  verifiedCount: number
  validCount: number
  invalidCount: number
  /** The number of leads that could not be verified. They are listed in `errors`. */
  failedCount: number
  results: Array<{
    leadId: number
    emailVerified: boolean
  }>
  errors: Array<{
    leadId: number
    leadName: string
    error: string
  }>
}
