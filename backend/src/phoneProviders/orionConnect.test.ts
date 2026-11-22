import { describe, expect, it } from 'vitest'
import { orionConnect } from './orionConnect'
import { InvalidProviderResponseError } from './responseShape'
import { PhoneLookupLead } from './types'

const FAKE_KEY = 'fake-orion-key'
const lead: PhoneLookupLead = { fullName: 'Ada Lovelace', email: 'ada@acme.com', jobTitle: 'CTO' }

describe('orionConnect.buildRequest', () => {
  it('sends the key in the x-auth-me header, the full name, and the email domain as companyWebsite', () => {
    expect(orionConnect.buildRequest(lead, FAKE_KEY)).toEqual({
      kind: 'send',
      headers: { 'x-auth-me': FAKE_KEY },
      query: {},
      body: { fullName: 'Ada Lovelace', companyWebsite: 'acme.com' },
    })
  })

  it('skips a lead with a free-mail email', () => {
    const request = orionConnect.buildRequest({ ...lead, email: 'ada@gmail.com' }, FAKE_KEY)

    expect(request).toEqual({ kind: 'skip', reason: 'The email domain gmail.com is a free-mail domain' })
  })

  it('skips a lead with no email domain', () => {
    expect(orionConnect.buildRequest({ ...lead, email: 'ada' }, FAKE_KEY)).toMatchObject({ kind: 'skip' })
  })

  it('skips a lead with no name', () => {
    expect(orionConnect.buildRequest({ ...lead, fullName: ' ' }, FAKE_KEY)).toMatchObject({ kind: 'skip' })
  })
})

describe('orionConnect.parseResponse', () => {
  it('finds the live shape { phone: string }', () => {
    expect(orionConnect.parseResponse({ phone: '8229099100' })).toEqual({
      status: 'found',
      phone: '8229099100',
    })
  })

  it.each([{ phone: null }, { phone: '' }, {}])('does not find a phone in %j', (body) => {
    expect(orionConnect.parseResponse(body)).toEqual({ status: 'not_found' })
  })

  it.each([[[]], [null], ['8229099100'], [{ phone: 8229099100 }]])('rejects the shape %j', (body) => {
    expect(() => orionConnect.parseResponse(body)).toThrow(InvalidProviderResponseError)
  })
})
