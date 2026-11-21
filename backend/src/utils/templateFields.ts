/**
 * The lead data that a message template can read.
 * Each property name is also the template key of its field, for example `{phoneNumber}`.
 */
export interface TemplateLead {
  firstName: string
  lastName?: string | null
  email?: string | null
  jobTitle?: string | null
  companyName?: string | null
  countryCode?: string | null
  phoneNumber?: string | null
  yearsAtCompany?: number | null
  linkedinUrl?: string | null
}

/** A template key. It is always the name of a {@link TemplateLead} property. */
export type TemplateFieldKey = keyof TemplateLead

/**
 * One field that a message template can use.
 * `readValue` returns the text to insert, or `null` when the lead has no value.
 */
export interface TemplateField {
  key: TemplateFieldKey
  label: string
  readValue: (lead: TemplateLead) => string | null
}

/** The part of a template field that the API sends to the client. */
export interface TemplateFieldSummary {
  key: TemplateFieldKey
  label: string
}

/** Converts a lead property to template text. A number such as `0` is a value, not an empty field. */
const formatLeadValue = (value: TemplateLead[TemplateFieldKey]): string | null => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  return String(value)
}

const defineField = (key: TemplateFieldKey, label: string): TemplateField => ({
  key,
  label,
  readValue: (lead) => formatLeadValue(lead[key]),
})

/**
 * The single list of fields that message templates can use.
 * The message generator and `GET /leads/template-fields` both read it.
 * To add a field, add it to the schema and {@link TemplateLead}, then add one entry here.
 */
export const TEMPLATE_FIELDS: readonly TemplateField[] = [
  defineField('firstName', 'First name'),
  defineField('lastName', 'Last name'),
  defineField('email', 'Email'),
  defineField('jobTitle', 'Job title'),
  defineField('companyName', 'Company name'),
  defineField('countryCode', 'Country code'),
  defineField('phoneNumber', 'Phone number'),
  defineField('yearsAtCompany', 'Years at company'),
  defineField('linkedinUrl', 'LinkedIn URL'),
]

/**
 * Finds a template field by its key. The match is case sensitive.
 *
 * @param key - The key between the braces of a template variable, for example `phoneNumber`.
 * @returns The field, or `undefined` when no field has this key.
 * @example
 * findTemplateField('phoneNumber')?.label // 'Phone number'
 * findTemplateField('unknownField') // undefined
 */
export function findTemplateField(key: string): TemplateField | undefined {
  return TEMPLATE_FIELDS.find((field) => field.key === key)
}

/**
 * Lists the key and the label of each template field, in display order.
 *
 * @returns One summary for each field in {@link TEMPLATE_FIELDS}.
 * @example
 * listTemplateFieldSummaries()[0] // { key: 'firstName', label: 'First name' }
 */
export function listTemplateFieldSummaries(): TemplateFieldSummary[] {
  return TEMPLATE_FIELDS.map(({ key, label }) => ({ key, label }))
}
