export type LeadsTemplateFieldsInput = undefined

/**
 * One field that a message template can use. The backend owns the list.
 * `key` is the text between the braces, for example `phoneNumber` in `{phoneNumber}`.
 */
export interface TemplateField {
  key: string
  label: string
}

export type LeadsTemplateFieldsOutput = TemplateField[]
