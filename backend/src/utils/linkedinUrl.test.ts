import { describe, it, expect } from 'vitest'
import { normalizeLinkedinUrl } from './linkedinUrl'

const JANE_PROFILE_URL = 'https://www.linkedin.com/in/jane'

describe('normalizeLinkedinUrl', () => {
  it.each([
    'linkedin.com/in/jane',
    'https://es.linkedin.com/in/jane/',
    'www.linkedin.com/in/jane?x=1',
    'http://www.linkedin.com/in/jane#about',
    '  HTTPS://LinkedIn.com/in/jane  ',
    JANE_PROFILE_URL,
  ])('stores %j as the canonical profile URL', (rawUrl) => {
    expect(normalizeLinkedinUrl(rawUrl)).toEqual({ linkedinUrl: JANE_PROFILE_URL, isDropped: false })
  })

  it('keeps the slug as it is', () => {
    expect(normalizeLinkedinUrl('linkedin.com/in/Jane-Doe-123')).toEqual({
      linkedinUrl: 'https://www.linkedin.com/in/Jane-Doe-123',
      isDropped: false,
    })
  })

  it.each([
    'linkedin.com/company/acme',
    'example.com/in/jane',
    'not a url',
    'linkedin.com/in/',
    'linkedin.com/in/jane/details',
    'linkedin.com.evil.com/in/jane',
    'evillinkedin.com/in/jane',
    'https://linkedin.com@evil.com/in/jane',
    'ftp://linkedin.com/in/jane',
    'javascript:alert(1)',
  ])('drops the value %j', (invalidUrl) => {
    expect(normalizeLinkedinUrl(invalidUrl)).toEqual({ linkedinUrl: null, isDropped: true })
  })

  it.each([42, true, {}])('drops the non-string value %j', (invalidValue) => {
    expect(normalizeLinkedinUrl(invalidValue)).toEqual({ linkedinUrl: null, isDropped: true })
  })

  it.each([undefined, null, '', '   '])('stores no URL and drops nothing for %j', (emptyValue) => {
    expect(normalizeLinkedinUrl(emptyValue)).toEqual({ linkedinUrl: null, isDropped: false })
  })
})
