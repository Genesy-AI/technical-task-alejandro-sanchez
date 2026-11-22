export type LeadsEnrichPhonesInput = {
  leadIds: number[]
}

/** The workflows run after the response. The leads query shows each result when it ends. */
export type LeadsEnrichPhonesOutput = {
  success: boolean
  /** The leads with a running enrichment, including one that was already running. */
  startedCount: number
  /** The leads that already have a phone. No enrichment starts for them. */
  skippedWithPhoneCount: number
  /** The leads whose enrichment could not start. */
  errors: Array<{
    leadId: number
    leadName: string
    error: string
  }>
}
