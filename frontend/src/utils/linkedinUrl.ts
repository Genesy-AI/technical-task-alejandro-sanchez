const LINKEDIN_DOMAIN = 'linkedin.com'
const CANONICAL_PROFILE_PREFIX = 'https://www.linkedin.com/in/'
const ALLOWED_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:'])
const URL_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/i
/** A profile path is `/in/<slug>` with an optional trailing slash. */
const PROFILE_PATH_PATTERN = /^\/in\/([\w%-]+)\/?$/

/**
 * The result of a LinkedIn URL check.
 * `linkedinUrl` is set only for a profile URL. `warning` is set only for all other values.
 */
export interface NormalizedLinkedinUrl {
  linkedinUrl?: string
  warning?: string
}

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
 * The backend `backend/src/utils/linkedinUrl.ts` does the same check. Update both together.
 *
 * @param rawUrl - The LinkedIn value as it comes from the CSV.
 * @returns The canonical URL, a warning for an invalid value, or an empty object for an empty value.
 * @example
 * normalizeLinkedinUrl('es.linkedin.com/in/jane/') // { linkedinUrl: 'https://www.linkedin.com/in/jane' }
 * normalizeLinkedinUrl('example.com/in/x') // { warning: 'Invalid LinkedIn URL "example.com/in/x" dropped' }
 */
export const normalizeLinkedinUrl = (rawUrl: string): NormalizedLinkedinUrl => {
  const trimmedUrl = rawUrl.trim()
  if (!trimmedUrl) {
    return {}
  }

  const url = parseUrl(trimmedUrl)
  const slug = url ? readProfileSlug(url) : null
  if (!slug) {
    return { warning: `Invalid LinkedIn URL "${trimmedUrl}" dropped` }
  }

  return { linkedinUrl: `${CANONICAL_PROFILE_PREFIX}${slug}` }
}
