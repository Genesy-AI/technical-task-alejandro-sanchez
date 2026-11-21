import { describe, it, expect } from 'vitest'
import { filterTemplateFields, moveHighlight } from './templateFieldPicker'
import { TemplateField } from '../api/types/leads/templateFields'

const FIELDS: TemplateField[] = [
  { key: 'firstName', label: 'First name' },
  { key: 'companyName', label: 'Company name' },
  { key: 'phoneNumber', label: 'Phone number' },
  { key: 'yearsAtCompany', label: 'Years at company' },
  { key: 'linkedinUrl', label: 'LinkedIn URL' },
]

const keysOf = (fields: TemplateField[]) => fields.map((field) => field.key)

describe('filterTemplateFields', () => {
  it.each(['', '   '])('returns all fields for the empty query "%s"', (emptyQuery) => {
    expect(filterTemplateFields(FIELDS, emptyQuery)).toEqual(FIELDS)
  })

  it('matches the label', () => {
    expect(keysOf(filterTemplateFields(FIELDS, 'phone'))).toEqual(['phoneNumber'])
  })

  it('matches the label with spaces', () => {
    expect(keysOf(filterTemplateFields(FIELDS, 'years at'))).toEqual(['yearsAtCompany'])
  })

  it('matches the key', () => {
    expect(keysOf(filterTemplateFields(FIELDS, 'Url'))).toEqual(['linkedinUrl'])
    expect(keysOf(filterTemplateFields(FIELDS, 'yearsAtC'))).toEqual(['yearsAtCompany'])
  })

  it('ignores case', () => {
    expect(keysOf(filterTemplateFields(FIELDS, 'LINKEDIN'))).toEqual(['linkedinUrl'])
  })

  it('matches a query in braces as the key', () => {
    expect(keysOf(filterTemplateFields(FIELDS, '{phoneNumber}'))).toEqual(['phoneNumber'])
  })

  it('keeps the list order for more than one match', () => {
    expect(keysOf(filterTemplateFields(FIELDS, 'company'))).toEqual(['companyName', 'yearsAtCompany'])
  })

  it('returns no fields when nothing matches', () => {
    expect(filterTemplateFields(FIELDS, 'salary')).toEqual([])
  })
})

describe('moveHighlight', () => {
  it('moves down and up by one', () => {
    expect(moveHighlight(0, 'ArrowDown', 3)).toBe(1)
    expect(moveHighlight(2, 'ArrowUp', 3)).toBe(1)
  })

  it('wraps at the ends of the list', () => {
    expect(moveHighlight(2, 'ArrowDown', 3)).toBe(0)
    expect(moveHighlight(0, 'ArrowUp', 3)).toBe(2)
  })

  it('starts at the first or the last row when no row is highlighted', () => {
    expect(moveHighlight(-1, 'ArrowDown', 3)).toBe(0)
    expect(moveHighlight(-1, 'ArrowUp', 3)).toBe(2)
  })

  it('gives -1 for an empty list', () => {
    expect(moveHighlight(0, 'ArrowDown', 0)).toBe(-1)
    expect(moveHighlight(-1, 'ArrowUp', 0)).toBe(-1)
  })
})
