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
  ])('converts "%s" to the canonical profile URL', (rawUrl) => {
    expect(normalizeLinkedinUrl(rawUrl)).toEqual({ linkedinUrl: JANE_PROFILE_URL })
  })

  it('keeps the slug as it is', () => {
    expect(normalizeLinkedinUrl('linkedin.com/in/Jane-Doe-123')).toEqual({
      linkedinUrl: 'https://www.linkedin.com/in/Jane-Doe-123',
    })
  })

  it.each([
    'linkedin.com/company/acme',
    'example.com/in/jane',
    'example.com/in/x',
    'not a url',
    'linkedin.com/in/',
    'linkedin.com/in/jane/details',
    'linkedin.com.evil.com/in/jane',
    'evillinkedin.com/in/jane',
    'https://linkedin.com@evil.com/in/jane',
    'ftp://linkedin.com/in/jane',
    'javascript:alert(1)',
  ])('gives a warning that names the value "%s"', (invalidUrl) => {
    expect(normalizeLinkedinUrl(invalidUrl)).toEqual({
      warning: `Invalid LinkedIn URL "${invalidUrl}" dropped`,
    })
  })

  it('gives an empty result for an empty or blank value', () => {
    expect(normalizeLinkedinUrl('')).toEqual({})
    expect(normalizeLinkedinUrl('   ')).toEqual({})
  })
})
