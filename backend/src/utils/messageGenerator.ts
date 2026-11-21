import { findTemplateField, TemplateLead } from './templateFields'

/** The lead data that a message template can read. */
export type Lead = TemplateLead

const TEMPLATE_VARIABLE_PATTERN = /\{(\w+)\}/g

/**
 * Reads the text for one template variable.
 *
 * @throws {Error} When no template field has this key, or when the lead has no value for it.
 */
const readVariableValue = (fieldKey: string, lead: Lead): string => {
  const field = findTemplateField(fieldKey)
  if (!field) {
    throw new Error(`Unknown field in template: ${fieldKey}`)
  }

  const value = field.readValue(lead)
  if (value === null) {
    throw new Error(`Missing required field: ${field.key} (${field.label})`)
  }

  return value
}

/**
 * Replaces each `{fieldKey}` variable in a template with the value from the lead.
 * The template fields in `templateFields.ts` define the keys that are permitted.
 *
 * @param template - The message template, for example `Hi {firstName}`.
 * @param lead - The lead that supplies the values.
 * @returns The message with each variable replaced.
 * @throws {Error} When the template has an unknown key, or when the lead has no value for a key.
 * @example
 * generateMessageFromTemplate('Hi {firstName}', { firstName: 'Ana' }) // 'Hi Ana'
 * generateMessageFromTemplate('Call {phoneNumber}', { firstName: 'Ana' })
 * // throws 'Missing required field: phoneNumber (Phone number)'
 */
export function generateMessageFromTemplate(template: string, lead: Lead): string {
  // A replacer function inserts the value as it is. A replacement string reads `$&` and `$1` as patterns.
  return template.replace(TEMPLATE_VARIABLE_PATTERN, (_variable, fieldKey: string) =>
    readVariableValue(fieldKey, lead)
  )
}
