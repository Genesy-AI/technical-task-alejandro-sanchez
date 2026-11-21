import { describe, expect, it } from 'vitest'
import { Lead } from '../api/types/leads/lead'
import { getLeadsRefetchInterval, getPhoneCellState, summarizePhoneEnrichmentStart } from './phoneEnrichment'

const POLLING_STARTED_AT = Date.parse('2026-11-21T10:00:00Z')
const ONE_MINUTE_MS = 60_000

const baseLead: Lead = {
  id: 1,
  createdAt: '2026-11-21T09:00:00Z',
  updatedAt: '2026-11-21T09:00:00Z',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@acme.com',
  jobTitle: 'CTO',
  countryCode: null,
  companyName: null,
  message: null,
  emailVerified: null,
  phoneNumber: null,
  yearsAtCompany: null,
  linkedinUrl: null,
  phoneEnrichmentStatus: null,
  phoneProvider: null,
  phoneCountryCode: null,
  phoneEnrichedAt: null,
}

describe('getPhoneCellState', () => {
  it('shows the phone and the provider that found it', () => {
    const lead: Lead = {
      ...baseLead,
      phoneNumber: '8229099100',
      phoneProvider: 'orionConnect',
      phoneEnrichmentStatus: 'found',
    }

    expect(getPhoneCellState(lead)).toEqual({ text: '8229099100', detail: 'Orion Connect', tone: 'value' })
  })

  it('adds the country code that the provider sent', () => {
    const lead: Lead = {
      ...baseLead,
      phoneNumber: '8173646528',
      phoneProvider: 'nimbusLookup',
      phoneCountryCode: 'ES',
    }

    expect(getPhoneCellState(lead)).toEqual({
      text: '8173646528',
      detail: 'Nimbus Lookup · ES',
      tone: 'value',
    })
  })

  it('shows an imported phone with no provider', () => {
    const lead: Lead = { ...baseLead, phoneNumber: '(731)123-9702' }

    expect(getPhoneCellState(lead)).toEqual({ text: '(731)123-9702', detail: null, tone: 'value' })
  })

  it.each([
    ['running', 'Searching…', 'pending'],
    ['not_found', 'No data found', 'empty'],
    ['failed', 'Could not enrich', 'error'],
  ] as const)('shows the status %s as %j', (status, text, tone) => {
    expect(getPhoneCellState({ ...baseLead, phoneEnrichmentStatus: status })).toEqual({
      text,
      detail: null,
      tone,
    })
  })

  it('shows - for a lead with no phone and no enrichment', () => {
    expect(getPhoneCellState(baseLead)).toEqual({ text: '-', detail: null, tone: 'empty' })
  })
})

describe('getLeadsRefetchInterval', () => {
  const runningLead: Lead = { ...baseLead, id: 2, phoneEnrichmentStatus: 'running' }

  it('polls every 2 seconds while a lead is running', () => {
    const interval = getLeadsRefetchInterval(
      [baseLead, runningLead],
      POLLING_STARTED_AT,
      POLLING_STARTED_AT + ONE_MINUTE_MS
    )

    expect(interval).toBe(2000)
  })

  it('stops when no lead is running', () => {
    expect(getLeadsRefetchInterval([baseLead], POLLING_STARTED_AT, POLLING_STARTED_AT)).toBe(false)
  })

  it('stops when there are no leads yet', () => {
    expect(getLeadsRefetchInterval(undefined, POLLING_STARTED_AT, POLLING_STARTED_AT)).toBe(false)
  })

  it('stops 2 minutes after polling started, even with a running lead', () => {
    const interval = getLeadsRefetchInterval(
      [runningLead],
      POLLING_STARTED_AT,
      POLLING_STARTED_AT + 2 * ONE_MINUTE_MS
    )

    expect(interval).toBe(false)
  })
})

describe('summarizePhoneEnrichmentStart', () => {
  const failedStart = { leadId: 3, leadName: 'Ada Byron', error: 'Temporal is down' }

  it('shows the started, already-has-a-phone, and could-not-start counts', () => {
    const summary = summarizePhoneEnrichmentStart({ startedCount: 3, skippedWithPhoneCount: 1, errors: [] })

    expect(summary).toEqual({
      message: 'Searching phones for 3 leads. 1 already has a phone. 0 could not start.',
      tone: 'success',
    })
  })

  it('uses the warning tone when some leads could not start', () => {
    const summary = summarizePhoneEnrichmentStart({
      startedCount: 1,
      skippedWithPhoneCount: 2,
      errors: [failedStart],
    })

    expect(summary).toEqual({
      message: 'Searching phones for 1 lead. 2 already have a phone. 1 could not start.',
      tone: 'warning',
    })
  })

  it('uses the error tone when no lead could start', () => {
    const summary = summarizePhoneEnrichmentStart({
      startedCount: 0,
      skippedWithPhoneCount: 0,
      errors: [failedStart],
    })

    expect(summary.tone).toBe('error')
  })
})
