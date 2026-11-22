/**
 * The phone enrichment status of a lead. `null` means that enrichment never ran.
 * This is a manual copy of `PHONE_ENRICHMENT_STATUS` in `backend/src/phoneProviders/types.ts`.
 */
export type PhoneEnrichmentStatus = 'running' | 'found' | 'not_found' | 'failed'

/**
 * A lead as the API returns it.
 * This is a manual copy of the `lead` model in `backend/prisma/schema.prisma`. Update both together.
 */
export interface Lead {
  id: number
  createdAt: string
  updatedAt: string
  firstName: string
  lastName: string | null
  email: string | null
  jobTitle: string | null
  countryCode: string | null
  companyName: string | null
  message: string | null
  emailVerified: boolean | null
  phoneNumber: string | null
  /** Whole years at the current company. `0` is a valid value. */
  yearsAtCompany: number | null
  /** A LinkedIn profile URL in the form `https://www.linkedin.com/in/<slug>`. */
  linkedinUrl: string | null
  phoneEnrichmentStatus: PhoneEnrichmentStatus | null
  /** The provider that found `phoneNumber`, for example `orionConnect`. `null` for an imported phone. */
  phoneProvider: string | null
  /** The country code that the provider sent with the phone. Only Nimbus Lookup sends one. */
  phoneCountryCode: string | null
  /** When the last enrichment ended, as an ISO date. */
  phoneEnrichedAt: string | null
}
