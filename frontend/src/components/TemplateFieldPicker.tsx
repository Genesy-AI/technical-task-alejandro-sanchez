import { FC, KeyboardEvent, RefObject, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { TemplateField } from '../api/types/leads/templateFields'
import { filterTemplateFields, moveHighlight } from '../utils/templateFieldPicker'

/** Props of {@link TemplateFieldPicker}. */
interface TemplateFieldPickerProps {
  /** The fields to pick from, in display order. */
  fields: TemplateField[]
  /** Called with the key of the field the user picks. */
  onInsert: (fieldKey: string) => void
}

/** Closes the picker when the user presses the mouse outside of it. */
const useCloseOnOutsideClick = (
  containerRef: RefObject<HTMLElement>,
  isOpen: boolean,
  close: () => void
): void => {
  useEffect(() => {
    if (!isOpen) {
      return
    }
    const handleMouseDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        close()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [containerRef, isOpen, close])
}

interface FieldOptionProps {
  id: string
  field: TemplateField
  isHighlighted: boolean
  onHighlight: () => void
  onPick: () => void
}

const FieldOption: FC<FieldOptionProps> = ({ id, field, isHighlighted, onHighlight, onPick }) => {
  const optionRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    if (isHighlighted) {
      optionRef.current?.scrollIntoView?.({ block: 'nearest' })
    }
  }, [isHighlighted])

  return (
    <li
      ref={optionRef}
      id={id}
      role="option"
      aria-selected={isHighlighted}
      onMouseEnter={onHighlight}
      // Keep the focus in the search box, so that the keyboard still works after a click.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPick}
      className={`flex justify-between items-center gap-3 px-3 py-2 text-sm cursor-pointer ${
        isHighlighted ? 'bg-blue-100 text-blue-900' : 'text-gray-700'
      }`}
    >
      <span>{field.label}</span>
      <span className="font-mono text-xs text-gray-500">{`{${field.key}}`}</span>
    </li>
  )
}

/**
 * An "Insert field" button that opens a searchable list of template fields.
 * The search matches the label or the key. Arrow keys move the highlight, Enter inserts, and Escape closes.
 *
 * @example
 * <TemplateFieldPicker fields={fields} onInsert={(key) => insertField(key)} />
 */
export const TemplateFieldPicker: FC<TemplateFieldPickerProps> = ({ fields, onInsert }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listId = useId()

  const matchingFields = useMemo(() => filterTemplateFields(fields, query), [fields, query])
  const highlightedField = matchingFields[highlightedIndex]
  const optionId = (index: number) => `${listId}-option-${index}`

  const close = useCallback(() => setIsOpen(false), [])
  useCloseOnOutsideClick(containerRef, isOpen, close)

  const open = () => {
    setQuery('')
    setHighlightedIndex(0)
    setIsOpen(true)
  }

  const pick = (field: TemplateField) => {
    close()
    onInsert(field.key)
  }

  const changeQuery = (nextQuery: string) => {
    setQuery(nextQuery)
    setHighlightedIndex(0)
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex(moveHighlight(highlightedIndex, event.key, matchingFields.length))
    } else if (event.key === 'Enter') {
      // Stop the form submit. Enter inserts the field.
      event.preventDefault()
      if (highlightedField) {
        pick(highlightedField)
      }
    } else if (event.key === 'Escape') {
      // Stop the modal Escape handler. Escape closes only the picker.
      event.preventDefault()
      event.stopPropagation()
      close()
      buttonRef.current?.focus()
    }
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? close() : open())}
        className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors"
      >
        Insert field
      </button>

      {isOpen && (
        <div className="absolute left-0 z-10 mt-1 w-80 bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="p-2 border-b border-gray-200">
            <input
              type="text"
              role="combobox"
              aria-label="Search fields"
              aria-expanded={true}
              aria-controls={listId}
              aria-activedescendant={highlightedField ? optionId(highlightedIndex) : undefined}
              autoFocus
              value={query}
              onChange={(event) => changeQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search fields"
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {matchingFields.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">No fields match</p>
          ) : (
            <ul
              id={listId}
              role="listbox"
              aria-label="Template fields"
              className="max-h-60 overflow-y-auto py-1"
            >
              {matchingFields.map((field, index) => (
                <FieldOption
                  key={field.key}
                  id={optionId(index)}
                  field={field}
                  isHighlighted={index === highlightedIndex}
                  onHighlight={() => setHighlightedIndex(index)}
                  onPick={() => pick(field)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
