export interface LeadsBulkImportInput {
  leads: {
    firstName: string
    lastName: string
    email: string
    jobTitle?: string
    countryCode?: string
    companyName?: string
    phoneNumber?: string
    yearsAtCompany?: number
    linkedinUrl?: string
  }[]
}

export interface LeadsBulkImportOutput {
  success: boolean
  importedCount: number
  duplicatesSkipped: number
  invalidLeads: number
  /** Leads that imported with no country code because the code was not a valid ISO 3166-1 alpha-2 code. */
  countryCodesDropped: number
  /** Leads that imported with no years value because the value was not a whole number of 0 or more. */
  yearsAtCompanyDropped: number
  /** Leads that imported with no LinkedIn URL because the value was not a LinkedIn profile URL. */
  linkedinUrlsDropped: number
  errors: Array<{
    lead: any
    error: string
  }>
}
