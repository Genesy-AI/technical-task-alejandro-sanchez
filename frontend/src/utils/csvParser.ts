import Papa from 'papaparse'
import { normalizeCountryCode } from './countryCode'
import { normalizeLinkedinUrl } from './linkedinUrl'
import { normalizeYearsAtCompany } from './yearsAtCompany'

/** An optional field whose invalid value the parser drops with a warning. */
export type DroppableCsvField = 'countryCode' | 'yearsAtCompany' | 'linkedinUrl'

export interface CsvLead {
  firstName: string
  lastName: string
  email: string
  jobTitle?: string
  countryCode?: string
  companyName?: string
  phoneNumber?: string
  yearsAtCompany?: number
  linkedinUrl?: string
  isValid: boolean
  errors: string[]
  /** Problems that do not block the import, such as a dropped country code. */
  warnings: string[]
  /** The fields whose invalid value the parser dropped. Each one also has an entry in `warnings`. */
  droppedFields: DroppableCsvField[]
  rowIndex: number
}

/**
 * Counts the leads that had an invalid value of one field dropped.
 *
 * @param leads - The parsed leads.
 * @param field - The field to count.
 * @returns The number of leads with a dropped value for `field`.
 * @example
 * countDroppedValues(parseCsv(csv), 'yearsAtCompany') // 2
 */
export const countDroppedValues = (leads: CsvLead[], field: DroppableCsvField): number =>
  leads.filter((lead) => lead.droppedFields.includes(field)).length

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const parseCsv = (content: string): CsvLead[] => {
  if (!content?.trim()) {
    throw new Error('CSV content cannot be empty')
  }

  const parseResult = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transform: (value) => value.trim(),
    transformHeader: (header) => header.trim().toLowerCase(),
    quoteChar: '"',
  })

  if (parseResult.errors.length > 0) {
    const criticalErrors = parseResult.errors.filter(
      (error) => error.type === 'Delimiter' || error.type === 'Quotes' || error.type === 'FieldMismatch'
    )
    if (criticalErrors.length > 0) {
      throw new Error(`CSV parsing failed: ${criticalErrors[0].message}`)
    }
  }

  if (!parseResult.data || parseResult.data.length === 0) {
    throw new Error('CSV file appears to be empty or contains no valid data')
  }

  const data: CsvLead[] = []

  parseResult.data.forEach((row, index) => {
    if (Object.values(row).every((value) => !value)) return

    const lead: Partial<CsvLead> = { rowIndex: index + 2 }
    const warnings: string[] = []
    const droppedFields: DroppableCsvField[] = []
    const recordDroppedValue = (field: DroppableCsvField, warning?: string) => {
      if (warning) {
        warnings.push(warning)
        droppedFields.push(field)
      }
    }

    Object.entries(row).forEach(([header, value]) => {
      const normalizedHeader = header.toLowerCase().replace(/[^a-z]/g, '')
      const trimmedValue = value?.trim() || ''

      switch (normalizedHeader) {
        case 'firstname':
          lead.firstName = trimmedValue
          break
        case 'lastname':
          lead.lastName = trimmedValue
          break
        case 'email':
          lead.email = trimmedValue
          break
        case 'jobtitle':
          lead.jobTitle = trimmedValue || undefined
          break
        case 'countrycode': {
          const { countryCode, warning } = normalizeCountryCode(trimmedValue)
          lead.countryCode = countryCode
          recordDroppedValue('countryCode', warning)
          break
        }
        case 'companyname':
          lead.companyName = trimmedValue || undefined
          break
        case 'phonenumber':
        case 'phone':
          lead.phoneNumber = trimmedValue || undefined
          break
        // The example files name this column `yearsInRole`. The import reads it as years at the company.
        case 'yearsatcompany':
        case 'yearsinrole': {
          const { yearsAtCompany, warning } = normalizeYearsAtCompany(trimmedValue)
          lead.yearsAtCompany = yearsAtCompany
          recordDroppedValue('yearsAtCompany', warning)
          break
        }
        case 'linkedinurl':
        case 'linkedin':
        case 'linkedinprofile': {
          const { linkedinUrl, warning } = normalizeLinkedinUrl(trimmedValue)
          lead.linkedinUrl = linkedinUrl
          recordDroppedValue('linkedinUrl', warning)
          break
        }
      }
    })

    const errors: string[] = []
    if (!lead.firstName?.trim()) {
      errors.push('First name is required')
    }
    if (!lead.lastName?.trim()) {
      errors.push('Last name is required')
    }
    if (!lead.email?.trim()) {
      errors.push('Email is required')
    } else if (!isValidEmail(lead.email)) {
      errors.push('Invalid email format')
    }

    data.push({
      ...lead,
      firstName: lead.firstName || '',
      lastName: lead.lastName || '',
      email: lead.email || '',
      isValid: errors.length === 0,
      errors,
      warnings,
      droppedFields,
    } as CsvLead)
  })

  return data
}
