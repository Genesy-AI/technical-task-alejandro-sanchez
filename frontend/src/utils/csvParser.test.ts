import { describe, it, expect } from 'vitest'
import { parseCsv, isValidEmail, countDroppedValues } from './csvParser'
import leadsOk1Csv from '../../../docs/leads-ok-1.csv?raw'
import leadsOkMissingFieldsCsv from '../../../docs/leads-ok-missing fields.csv?raw'
describe('isValidEmail', () => {
  it('should return true for valid email addresses', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
    expect(isValidEmail('user.name@domain.co.uk')).toBe(true)
    expect(isValidEmail('first.last+tag@example.org')).toBe(true)
    expect(isValidEmail('123@456.com')).toBe(true)
  })

  it('should return false for invalid email addresses', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('invalid')).toBe(false)
    expect(isValidEmail('test@')).toBe(false)
    expect(isValidEmail('@example.com')).toBe(false)
    expect(isValidEmail('test.example.com')).toBe(false)
    expect(isValidEmail('test@.com')).toBe(false)
    expect(isValidEmail('test@example')).toBe(false)
  })
})

describe('parseCsv', () => {
  it('should throw error for empty content', () => {
    expect(() => parseCsv('')).toThrow('CSV content cannot be empty')
    expect(() => parseCsv('   ')).toThrow('CSV content cannot be empty')
  })

  it('should throw error for CSV with only headers', () => {
    const csv = 'firstName,lastName,email'
    expect(() => parseCsv(csv)).toThrow('CSV file appears to be empty or contains no valid data')
  })

  it('should throw error for malformed CSV content', () => {
    const malformedCsv = `firstName,lastName,email
"John,Doe,john@example.com,extra"field`
    expect(() => parseCsv(malformedCsv)).toThrow('CSV parsing failed')
  })

  it('should throw error for CSV with mismatched field count', () => {
    const mismatchedCsv = `firstName,lastName,email
John,Doe,john@example.com,ExtraField,AnotherExtra
Jane,Smith`
    expect(() => parseCsv(mismatchedCsv)).toThrow('CSV parsing failed')
  })

  it('should throw error for CSV with critical delimiter issues', () => {
    const noDelimiterCsv = `firstName lastName email
John Doe john@example.com`
    expect(() => parseCsv(noDelimiterCsv)).toThrow()
  })

  it('should parse valid CSV with all required fields', () => {
    const csv = `firstName,lastName,email,jobTitle,countryCode,companyName
John,Doe,john.doe@example.com,Developer,US,Tech Corp`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      jobTitle: 'Developer',
      countryCode: 'US',
      companyName: 'Tech Corp',
      isValid: true,
      errors: [],
      warnings: [],
      droppedFields: [],
      rowIndex: 2,
    })
  })

  it('should handle missing required fields and mark as invalid', () => {
    const csv = `firstName,lastName,email
,Smith,john@example.com
John,,john@example.com
John,Smith,`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)

    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('First name is required')

    expect(result[1].isValid).toBe(false)
    expect(result[1].errors).toContain('Last name is required')

    expect(result[2].isValid).toBe(false)
    expect(result[2].errors).toContain('Email is required')
  })

  it('should validate email format', () => {
    const csv = `firstName,lastName,email
John,Doe,invalid-email
Jane,Smith,jane@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(2)
    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('Invalid email format')
    expect(result[1].isValid).toBe(true)
  })

  it('should handle CSV with quoted values', () => {
    const csv = `firstName,lastName,email,jobTitle
"John","Doe","john.doe@example.com","Software Engineer"`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john.doe@example.com')
    expect(result[0].jobTitle).toBe('Software Engineer')
  })

  it('should skip empty rows', () => {
    const csv = `firstName,lastName,email
John,Doe,john@example.com
,,
Jane,Smith,jane@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(2)
    expect(result[0].firstName).toBe('John')
    expect(result[1].firstName).toBe('Jane')
  })

  it('should handle case-insensitive headers', () => {
    const csv = `FIRSTNAME,LASTNAME,EMAIL,JOBTITLE,COUNTRYCODE,COMPANYNAME
John,Doe,john@example.com,Developer,US,Tech Corp`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].jobTitle).toBe('Developer')
  })

  it('should handle missing optional fields', () => {
    const csv = `firstName,lastName,email,jobTitle,countryCode
John,Doe,john@example.com,,`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].jobTitle).toBeUndefined()
    expect(result[0].countryCode).toBeUndefined()
    expect(result[0].isValid).toBe(true)
  })

  it('should preserve row index correctly', () => {
    const csv = `firstName,lastName,email
John,Doe,john@example.com
Jane,Smith,jane@example.com
Bob,Johnson,bob@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)
    expect(result[0].rowIndex).toBe(2)
    expect(result[1].rowIndex).toBe(3)
    expect(result[2].rowIndex).toBe(4)
  })

  it('should handle multiple validation errors per lead', () => {
    const csv = `firstName,lastName,email
 , ,invalid-email`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toHaveLength(3)
    expect(result[0].errors).toContain('First name is required')
    expect(result[0].errors).toContain('Last name is required')
    expect(result[0].errors).toContain('Invalid email format')
  })

  it('should handle extra columns not in header mapping', () => {
    const csv = `firstName,lastName,email,unknownColumn
John,Doe,john@example.com,someValue`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].isValid).toBe(true)
  })

  it('should handle mixed valid and invalid leads', () => {
    const csv = `firstName,lastName,email
John,Doe,john@example.com
,Smith,invalid-email
Jane,Johnson,jane@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)
    expect(result[0].isValid).toBe(true)
    expect(result[1].isValid).toBe(false)
    expect(result[1].errors).toContain('First name is required')
    expect(result[1].errors).toContain('Invalid email format')
    expect(result[2].isValid).toBe(true)
  })

  it('should handle whitespace in fields', () => {
    const csv = `firstName,lastName,email
 John , Doe , john@example.com `

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].isValid).toBe(true)
  })
})

describe('parseCsv country codes', () => {
  const parseCountry = (countryCode: string) =>
    parseCsv(`firstName,lastName,email,countryCode\nJohn,Doe,john@example.com,${countryCode}`)[0]

  it('keeps a valid code with no warning', () => {
    const lead = parseCountry('ES')

    expect(lead.countryCode).toBe('ES')
    expect(lead.warnings).toEqual([])
  })

  it('uppercases a lowercase code', () => {
    expect(parseCountry('es').countryCode).toBe('ES')
  })

  it('maps UK to GB with no warning', () => {
    const lead = parseCountry('UK')

    expect(lead.countryCode).toBe('GB')
    expect(lead.warnings).toEqual([])
  })

  it.each(['XXX', '12', 'XX'])('drops %s with a warning that names the value', (invalidCode) => {
    const lead = parseCountry(invalidCode)

    expect(lead.countryCode).toBeUndefined()
    expect(lead.warnings).toEqual([`Invalid country code "${invalidCode}" dropped`])
  })

  it('keeps a lead with an invalid code valid', () => {
    const lead = parseCountry('XXX')

    expect(lead.isValid).toBe(true)
    expect(lead.errors).toEqual([])
  })

  it('gives no code and no warning for an empty value', () => {
    const lead = parseCountry('')

    expect(lead.countryCode).toBeUndefined()
    expect(lead.warnings).toEqual([])
  })
})

describe('parseCsv phone, years, and LinkedIn', () => {
  const HEADER = 'firstName,lastName,email'
  const parseRow = (extraHeaders: string, extraValues: string) =>
    parseCsv(`${HEADER},${extraHeaders}\nJohn,Doe,john@example.com,${extraValues}`)[0]

  it('maps the phoneNumber, yearsAtCompany, and linkedinUrl columns', () => {
    const lead = parseRow('phoneNumber,yearsAtCompany,linkedinUrl', '(731)123-9702,7,linkedin.com/in/john')

    expect(lead.phoneNumber).toBe('(731)123-9702')
    expect(lead.yearsAtCompany).toBe(7)
    expect(lead.linkedinUrl).toBe('https://www.linkedin.com/in/john')
    expect(lead.warnings).toEqual([])
    expect(lead.droppedFields).toEqual([])
  })

  it.each(['phone', 'Phone Number', 'phone_number'])('maps the phone header alias "%s"', (header) => {
    expect(parseRow(header, '+1-280-754-0462x2154').phoneNumber).toBe('+1-280-754-0462x2154')
  })

  it.each(['yearsInRole', 'years_at_company', 'YEARSINROLE'])(
    'maps the years header alias "%s"',
    (header) => {
      expect(parseRow(header, '3').yearsAtCompany).toBe(3)
    }
  )

  it.each(['linkedin', 'LinkedIn Profile', 'linkedin_url'])(
    'maps the LinkedIn header alias "%s"',
    (header) => {
      expect(parseRow(header, 'https://es.linkedin.com/in/john/').linkedinUrl).toBe(
        'https://www.linkedin.com/in/john'
      )
    }
  )

  it('keeps years 0', () => {
    expect(parseRow('yearsInRole', '0').yearsAtCompany).toBe(0)
  })

  it.each(['-3', 'abc', '2.5'])('drops the years value "%s" with a warning', (invalidYears) => {
    const lead = parseRow('yearsInRole', invalidYears)

    expect(lead.yearsAtCompany).toBeUndefined()
    expect(lead.warnings).toEqual([`Invalid years at company "${invalidYears}" dropped`])
    expect(lead.droppedFields).toEqual(['yearsAtCompany'])
    expect(lead.isValid).toBe(true)
  })

  it('drops a LinkedIn value that is not a profile URL with a warning', () => {
    const lead = parseRow('linkedinUrl', 'example.com/in/x')

    expect(lead.linkedinUrl).toBeUndefined()
    expect(lead.warnings).toEqual(['Invalid LinkedIn URL "example.com/in/x" dropped'])
    expect(lead.droppedFields).toEqual(['linkedinUrl'])
    expect(lead.isValid).toBe(true)
  })

  it('lists one warning and one dropped field for each bad value', () => {
    const lead = parseRow('countryCode,yearsInRole,linkedinUrl', 'XXX,abc,linkedin.com/company/acme')

    expect(lead.warnings).toEqual([
      'Invalid country code "XXX" dropped',
      'Invalid years at company "abc" dropped',
      'Invalid LinkedIn URL "linkedin.com/company/acme" dropped',
    ])
    expect(lead.droppedFields).toEqual(['countryCode', 'yearsAtCompany', 'linkedinUrl'])
    expect(lead.isValid).toBe(true)
  })

  it('gives no value and no warning for empty cells', () => {
    const lead = parseRow('phoneNumber,yearsInRole,linkedinUrl', ',,')

    expect(lead.phoneNumber).toBeUndefined()
    expect(lead.yearsAtCompany).toBeUndefined()
    expect(lead.linkedinUrl).toBeUndefined()
    expect(lead.warnings).toEqual([])
  })
})

describe('parseCsv example files', () => {
  it('reads phone and years from docs/leads-ok-1.csv', () => {
    const leads = parseCsv(leadsOk1Csv)

    expect(leads.map(({ phoneNumber, yearsAtCompany }) => ({ phoneNumber, yearsAtCompany }))).toEqual([
      { phoneNumber: '+1-280-754-0462x2154', yearsAtCompany: 2 },
      { phoneNumber: '001-464-312-8555', yearsAtCompany: 2 },
      { phoneNumber: '(731)123-9702', yearsAtCompany: 5 },
      { phoneNumber: '063.430.8860x4762', yearsAtCompany: 1 },
      { phoneNumber: '133.622.7535', yearsAtCompany: 10 },
    ])
    expect(leads.every((lead) => lead.isValid && lead.warnings.length === 0)).toBe(true)
  })

  it('leaves empty phone and years cells empty in docs/leads-ok-missing fields.csv', () => {
    const phyllis = parseCsv(leadsOkMissingFieldsCsv).find((lead) => lead.firstName === 'Phyllis')

    expect(phyllis?.phoneNumber).toBeUndefined()
    expect(phyllis?.yearsAtCompany).toBeUndefined()
    expect(phyllis?.warnings).toEqual([])
  })
})

describe('countDroppedValues', () => {
  it('counts the leads that dropped a value of one field', () => {
    const leads = parseCsv(`firstName,lastName,email,countryCode,yearsInRole
A,One,a@example.com,XXX,abc
B,Two,b@example.com,ES,-1
C,Three,c@example.com,12,4`)

    expect(countDroppedValues(leads, 'countryCode')).toBe(2)
    expect(countDroppedValues(leads, 'yearsAtCompany')).toBe(2)
    expect(countDroppedValues(leads, 'linkedinUrl')).toBe(0)
  })
})
