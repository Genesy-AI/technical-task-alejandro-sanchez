const LINKEDIN_DOMAIN = 'linkedin.com'
const CANONICAL_PROFILE_PREFIX = 'https://www.linkedin.com/in/'
const ALLOWED_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:'])
const URL_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/i
/** A profile path is `/in/<slug>` with an optional trailing slash. */
const PROFILE_PATH_PATTERN = /^\/in\/([\w%-]+)\/?$/

/**
 * The result of a LinkedIn URL check.
 * `linkedinUrl` is the value to store. `isDropped` is true when the input had a value that is not a profile URL.
 */
export interface NormalizedLinkedinUrl {
  linkedinUrl: string | null
  isDropped: boolean
}

const NO_LINKEDIN_URL: NormalizedLinkedinUrl = { linkedinUrl: null, isDropped: false }
const DROPPED_LINKEDIN_URL: NormalizedLinkedinUrl = { linkedinUrl: null, isDropped: true }

/** Parses a URL. Adds `https://` when the value has no scheme, for example `linkedin.com/in/jane`. */
const parseUrl = (value: string): URL | null => {
  const urlText = URL_SCHEME_PATTERN.test(value) ? value : `https://${value}`
  try {
    return new URL(urlText)
  } catch {
    return null
  }
}

const isLinkedinHost = (hostname: string): boolean =>
  hostname === LINKEDIN_DOMAIN || hostname.endsWith(`.${LINKEDIN_DOMAIN}`)

/** Returns the profile slug of a LinkedIn profile URL, or `null` for all other URLs. */
const readProfileSlug = (url: URL): string | null => {
  if (!ALLOWED_PROTOCOLS.has(url.protocol) || !isLinkedinHost(url.hostname)) {
    return null
  }
  return PROFILE_PATH_PATTERN.exec(url.pathname)?.[1] ?? null
}

/**
 * Checks a LinkedIn profile URL and converts it to `https://www.linkedin.com/in/<slug>`.
 * Only person profiles (`/in/<slug>`) pass. The query and the fragment are removed.
 * The bulk import uses this as the final check, because a client can skip the CSV preview.
 *
 * @param rawUrl - The LinkedIn value from the request body. Any type is accepted.
 * @returns The canonical URL, or `null` with `isDropped` set when the value is not a profile URL.
 * @example
 * normalizeLinkedinUrl('es.linkedin.com/in/jane/') // { linkedinUrl: 'https://www.linkedin.com/in/jane', isDropped: false }
 * normalizeLinkedinUrl('linkedin.com/company/acme') // { linkedinUrl: null, isDropped: true }
 * normalizeLinkedinUrl(undefined) // { linkedinUrl: null, isDropped: false }
 */
export function normalizeLinkedinUrl(rawUrl: unknown): NormalizedLinkedinUrl {
  if (rawUrl === undefined || rawUrl === null) {
    return NO_LINKEDIN_URL
  }
  if (typeof rawUrl !== 'string') {
    return DROPPED_LINKEDIN_URL
  }

  const trimmedUrl = rawUrl.trim()
  if (!trimmedUrl) {
    return NO_LINKEDIN_URL
  }

  const url = parseUrl(trimmedUrl)
  const slug = url ? readProfileSlug(url) : null
  if (!slug) {
    return DROPPED_LINKEDIN_URL
  }

  return { linkedinUrl: `${CANONICAL_PROFILE_PREFIX}${slug}`, isDropped: false }
}
