import { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TemplateField } from '../api/types/leads/templateFields'
import { TemplateFieldPicker } from './TemplateFieldPicker'

const FIELDS: TemplateField[] = [
  { key: 'firstName', label: 'First name' },
  { key: 'phoneNumber', label: 'Phone number' },
  { key: 'yearsAtCompany', label: 'Years at company' },
]

// Tells React that the test wraps each update in `act`.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root
let onInsert: ReturnType<typeof vi.fn<(fieldKey: string) => void>>

const openPicker = () => {
  act(() => container.querySelector('button')!.click())
}

const searchBox = (): HTMLInputElement => container.querySelector('input')!

const optionLabels = (): string[] =>
  Array.from(container.querySelectorAll('[role="option"]')).map((option) => option.firstChild!.textContent!)

const highlightedLabel = (): string | undefined =>
  container.querySelector('[aria-selected="true"]')?.firstChild?.textContent ?? undefined

/** Types into the controlled search box. React reads the value from the native setter. */
const typeQuery = (query: string) => {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setValue.call(searchBox(), query)
    searchBox().dispatchEvent(new Event('input', { bubbles: true }))
  })
}

const pressKey = (key: string): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  act(() => {
    searchBox().dispatchEvent(event)
  })
  return event
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  onInsert = vi.fn<(fieldKey: string) => void>()
  act(() => root.render(<TemplateFieldPicker fields={FIELDS} onInsert={onInsert} />))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('TemplateFieldPicker', () => {
  it('shows each field label and key when it opens', () => {
    openPicker()

    expect(optionLabels()).toEqual(['First name', 'Phone number', 'Years at company'])
    expect(container.textContent).toContain('{phoneNumber}')
    expect(highlightedLabel()).toBe('First name')
  })

  it('filters the list by the search text', () => {
    openPicker()
    typeQuery('years')

    expect(optionLabels()).toEqual(['Years at company'])
  })

  it('shows a message when no field matches', () => {
    openPicker()
    typeQuery('salary')

    expect(optionLabels()).toEqual([])
    expect(container.textContent).toContain('No fields match')
  })

  it('moves the highlight with the arrow keys and inserts with Enter', () => {
    openPicker()
    pressKey('ArrowDown')
    pressKey('ArrowDown')
    pressKey('ArrowUp')
    const enterEvent = pressKey('Enter')

    expect(onInsert).toHaveBeenCalledWith('phoneNumber')
    expect(enterEvent.defaultPrevented).toBe(true)
    expect(container.querySelector('input')).toBeNull()
  })

  it('inserts the first match of a search with Enter', () => {
    openPicker()
    typeQuery('phone')
    pressKey('Enter')

    expect(onInsert).toHaveBeenCalledWith('phoneNumber')
  })

  it('closes with Escape and does not let the event reach the modal', () => {
    const documentListener = vi.fn()
    document.addEventListener('keydown', documentListener)
    openPicker()
    pressKey('Escape')
    document.removeEventListener('keydown', documentListener)

    expect(container.querySelector('input')).toBeNull()
    expect(documentListener).not.toHaveBeenCalled()
    expect(onInsert).not.toHaveBeenCalled()
  })
})
