import { TemplateField } from '../api/types/leads/templateFields'

/** The keys that move the highlight in the field list. */
export type HighlightMoveKey = 'ArrowDown' | 'ArrowUp'

const NO_HIGHLIGHT = -1
const TEMPLATE_BRACES_PATTERN = /[{}]/g

/**
 * Finds the template fields whose label or key contains the query. The match ignores case.
 * Braces in the query are ignored, so `{phone` also matches `phoneNumber`.
 *
 * @param fields - The template fields, in display order.
 * @param query - The search text.
 * @returns The matching fields in their original order, or all fields for an empty query.
 * @example
 * filterTemplateFields(fields, 'phone') // [{ key: 'phoneNumber', label: 'Phone number' }]
 */
export const filterTemplateFields = (fields: TemplateField[], query: string): TemplateField[] => {
  const normalizedQuery = query.replace(TEMPLATE_BRACES_PATTERN, '').trim().toLowerCase()
  if (!normalizedQuery) {
    return fields
  }

  return fields.filter(
    (field) =>
      field.label.toLowerCase().includes(normalizedQuery) || field.key.toLowerCase().includes(normalizedQuery)
  )
}

/**
 * Moves the highlighted row of a list by one. The highlight wraps at each end.
 *
 * @param currentIndex - The highlighted row, or `-1` for none.
 * @param key - The arrow key the user pressed.
 * @param itemCount - The number of rows in the list.
 * @returns The new highlighted row, or `-1` when the list is empty.
 * @example
 * moveHighlight(2, 'ArrowDown', 3) // 0
 * moveHighlight(0, 'ArrowUp', 3) // 2
 */
export const moveHighlight = (currentIndex: number, key: HighlightMoveKey, itemCount: number): number => {
  if (itemCount === 0) {
    return NO_HIGHLIGHT
  }
  if (currentIndex < 0) {
    return key === 'ArrowDown' ? 0 : itemCount - 1
  }

  const step = key === 'ArrowDown' ? 1 : -1
  return (currentIndex + step + itemCount) % itemCount
}
