export interface LeadsBulkImportInput {
  leads: {
    firstName: string
    lastName: string
    email: string
    jobTitle?: string
    countryCode?: string
    companyName?: string
  }[]
}

export interface LeadsBulkImportOutput {
  success: boolean
  importedCount: number
  duplicatesSkipped: number
  invalidLeads: number
  /** Leads that imported with no country code because the code was not a valid ISO 3166-1 alpha-2 code. */
  countryCodesDropped: number
  errors: Array<{
    lead: any
    error: string
  }>
}
