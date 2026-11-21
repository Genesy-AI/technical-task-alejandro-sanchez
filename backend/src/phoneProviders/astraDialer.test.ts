import { describe, expect, it } from 'vitest'
import { astraDialer } from './astraDialer'
import { InvalidProviderResponseError } from './responseShape'
import { PhoneLookupLead } from './types'

const FAKE_KEY = 'fake-astra-key'
const lead: PhoneLookupLead = { fullName: 'Ada Lovelace', email: 'ada@gmail.com', jobTitle: null }

describe('astraDialer.buildRequest', () => {
  it('sends the key in the apiKey header and the email in the body', () => {
    expect(astraDialer.buildRequest(lead, FAKE_KEY)).toEqual({
      kind: 'send',
      headers: { apiKey: FAKE_KEY },
      query: {},
      body: { email: 'ada@gmail.com' },
    })
  })

  it('skips a lead with no email', () => {
    expect(astraDialer.buildRequest({ ...lead, email: '' }, FAKE_KEY)).toMatchObject({ kind: 'skip' })
  })
})

describe('astraDialer.parseResponse', () => {
  it('finds the live shape { phoneNmbr: string }', () => {
    expect(astraDialer.parseResponse({ phoneNmbr: '2502843895' })).toEqual({
      status: 'found',
      phone: '2502843895',
    })
  })

  it.each([{ phoneNmbr: null }, {}])('does not find a phone in the live shape %j', (body) => {
    expect(astraDialer.parseResponse(body)).toEqual({ status: 'not_found' })
  })

  it.each([[[]], [{ phoneNmbr: 2502843895 }], [{ phoneNmbr: true }]])('rejects the shape %j', (body) => {
    expect(() => astraDialer.parseResponse(body)).toThrow(InvalidProviderResponseError)
  })
})
