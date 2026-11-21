import { describe, it, expect } from 'vitest'
import {
  findTemplateField,
  listTemplateFieldSummaries,
  TEMPLATE_FIELDS,
  TemplateLead,
} from './templateFields'

const lead: TemplateLead = {
  firstName: 'Ana',
  lastName: 'Ruiz',
  phoneNumber: '+34 600 000 000',
  yearsAtCompany: 0,
  linkedinUrl: null,
}

describe('findTemplateField', () => {
  it('finds a field by its key', () => {
    expect(findTemplateField('phoneNumber')?.label).toBe('Phone number')
  })

  it.each(['unknownField', 'FirstName', 'constructor', 'toString', ''])(
    'returns nothing for the unknown key "%s"',
    (unknownKey) => {
      expect(findTemplateField(unknownKey)).toBeUndefined()
    }
  )
})

describe('TEMPLATE_FIELDS', () => {
  it('holds the six original fields and the three new fields', () => {
    expect(TEMPLATE_FIELDS.map((field) => field.key)).toEqual([
      'firstName',
      'lastName',
      'email',
      'jobTitle',
      'companyName',
      'countryCode',
      'phoneNumber',
      'yearsAtCompany',
      'linkedinUrl',
    ])
  })

  it('has unique keys', () => {
    const keys = TEMPLATE_FIELDS.map((field) => field.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('has unique labels that differ from the keys', () => {
    const labels = TEMPLATE_FIELDS.map((field) => field.label)
    expect(new Set(labels).size).toBe(labels.length)
    TEMPLATE_FIELDS.forEach((field) => expect(field.label).not.toBe(field.key))
  })
})

describe('readValue', () => {
  it('reads a text value as it is', () => {
    expect(findTemplateField('phoneNumber')?.readValue(lead)).toBe('+34 600 000 000')
  })

  it('reads years 0 as "0"', () => {
    expect(findTemplateField('yearsAtCompany')?.readValue(lead)).toBe('0')
  })

  it('reads years 12 as "12"', () => {
    expect(findTemplateField('yearsAtCompany')?.readValue({ ...lead, yearsAtCompany: 12 })).toBe('12')
  })

  it.each([null, undefined, ''])('reads the empty value %s as null', (emptyValue) => {
    expect(findTemplateField('lastName')?.readValue({ ...lead, lastName: emptyValue })).toBeNull()
  })

  it('reads a missing property as null', () => {
    expect(findTemplateField('email')?.readValue(lead)).toBeNull()
  })
})

describe('listTemplateFieldSummaries', () => {
  it('returns only the key and the label of each field', () => {
    const summaries = listTemplateFieldSummaries()
    expect(summaries).toHaveLength(TEMPLATE_FIELDS.length)
    expect(summaries[7]).toEqual({ key: 'yearsAtCompany', label: 'Years at company' })
    summaries.forEach((summary) => expect(Object.keys(summary)).toEqual(['key', 'label']))
  })
})
