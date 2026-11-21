// Orion Connect looks up a company website. A free-mail domain is not a company, so the call is skipped.
const FREE_MAIL_DOMAINS: ReadonlySet<string> = new Set([
  'aol.com',
  'gmail.com',
  'gmx.com',
  'gmx.de',
  'googlemail.com',
  'hotmail.com',
  'icloud.com',
  'live.com',
  'mac.com',
  'mail.com',
  'me.com',
  'msn.com',
  'outlook.com',
  'proton.me',
  'protonmail.com',
  'yahoo.com',
  'yandex.com',
  'zoho.com',
])

/**
 * Gets the domain of an email address.
 *
 * @param email - The email address.
 * @returns The lowercase text after the last `@`, or `null` when there is no domain.
 * @example
 * getEmailDomain('Ada@Acme.com') // 'acme.com'
 * getEmailDomain('ada') // null
 */
export function getEmailDomain(email: string): string | null {
  const separatorIndex = email.lastIndexOf('@')
  if (separatorIndex === -1) {
    return null
  }
  const domain = email.slice(separatorIndex + 1).trim()
  return domain.toLowerCase() || null
}

/**
 * Checks if a domain belongs to a free-mail service, for example `gmail.com`.
 *
 * @param domain - A lowercase email domain.
 * @returns `true` when the domain is in the free-mail list.
 * @example
 * isFreeMailDomain('gmail.com') // true
 */
export function isFreeMailDomain(domain: string): boolean {
  return FREE_MAIL_DOMAINS.has(domain)
}
