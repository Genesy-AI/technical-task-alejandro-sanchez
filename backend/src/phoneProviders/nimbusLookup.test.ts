import { describe, expect, it } from 'vitest'
import { nimbusLookup } from './nimbusLookup'
import { InvalidProviderResponseError } from './responseShape'
import { PhoneLookupLead } from './types'

const FAKE_KEY = 'fake-nimbus-key'
const lead: PhoneLookupLead = { fullName: 'Ada Lovelace', email: 'ada@acme.com', jobTitle: 'CTO' }

describe('nimbusLookup.buildRequest', () => {
  it('sends the key in the api query value, and the email and job title in the body', () => {
    expect(nimbusLookup.buildRequest(lead, FAKE_KEY)).toEqual({
      kind: 'send',
      headers: {},
      query: { api: FAKE_KEY },
      body: { email: 'ada@acme.com', jobTitle: 'CTO' },
    })
  })

  it.each([null, '', '  '])('skips a lead with the job title %j', (jobTitle) => {
    const request = nimbusLookup.buildRequest({ ...lead, jobTitle }, FAKE_KEY)

    expect(request).toEqual({ kind: 'skip', reason: 'The lead has no job title' })
  })
})

describe('nimbusLookup.parseResponse', () => {
  it('finds the live shape { phoneNmbr: number, countryCode } as a string of digits', () => {
    expect(nimbusLookup.parseResponse({ phoneNmbr: 8173646528, countryCode: 'ES' })).toEqual({
      status: 'found',
      phone: '8173646528',
      countryCode: 'ES',
    })
  })

  it('finds the README shape { number, countryCode }', () => {
    expect(nimbusLookup.parseResponse({ number: 8173646528, countryCode: 'ES' })).toEqual({
      status: 'found',
      phone: '8173646528',
      countryCode: 'ES',
    })
  })

  it('accepts a phone as a string and no country code', () => {
    expect(nimbusLookup.parseResponse({ phoneNmbr: '8173646528' })).toEqual({
      status: 'found',
      phone: '8173646528',
    })
  })

  it.each([{ phoneNmbr: null, countryCode: 'ES' }, { countryCode: 'ES' }, {}])(
    'does not find a phone in %j',
    (body) => {
      expect(nimbusLookup.parseResponse(body)).toEqual({ status: 'not_found' })
    }
  )

  it.each([
    [[]],
    [{ phoneNmbr: true }],
    [{ phoneNmbr: 81736.5 }],
    [{ phoneNmbr: -1 }],
    [{ phoneNmbr: 8173646528, countryCode: 34 }],
  ])('rejects the shape %j', (body) => {
    expect(() => nimbusLookup.parseResponse(body)).toThrow(InvalidProviderResponseError)
  })
})
