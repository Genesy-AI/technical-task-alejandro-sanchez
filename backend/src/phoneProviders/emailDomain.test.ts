import { describe, expect, it } from 'vitest'
import { getEmailDomain, isFreeMailDomain } from './emailDomain'

describe('getEmailDomain', () => {
  it('returns the lowercase domain after the last @', () => {
    expect(getEmailDomain(' Ada.Lovelace@Acme.COM ')).toBe('acme.com')
  })

  it.each(['ada', 'ada@', '@', ''])('returns null for %j', (email) => {
    expect(getEmailDomain(email)).toBeNull()
  })
})

describe('isFreeMailDomain', () => {
  it.each(['gmail.com', 'outlook.com', 'yahoo.com', 'icloud.com'])('is true for %s', (domain) => {
    expect(isFreeMailDomain(domain)).toBe(true)
  })

  it('is false for a company domain', () => {
    expect(isFreeMailDomain('acme.com')).toBe(false)
  })
})
