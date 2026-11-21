/**
 * The officially assigned ISO 3166-1 alpha-2 codes (249 codes).
 *
 * A static list, because `Intl.DisplayNames` also accepts codes that are not
 * assigned, such as `UK`, `EU`, `UN`, `ZZ`, and `419`.
 * The frontend keeps a copy in `frontend/src/utils/countryCode.ts`. Update both together.
 */
export const ISO_COUNTRY_CODES: ReadonlySet<string> = new Set(
  `
  AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
  BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
  CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
  DE DJ DK DM DO DZ
  EC EE EG EH ER ES ET
  FI FJ FK FM FO FR
  GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
  HK HM HN HR HT HU
  ID IE IL IM IN IO IQ IR IS IT
  JE JM JO JP
  KE KG KH KI KM KN KP KR KW KY KZ
  LA LB LC LI LK LR LS LT LU LV LY
  MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
  NA NC NE NF NG NI NL NO NP NR NU NZ
  OM
  PA PE PF PG PH PK PL PM PN PR PS PT PW PY
  QA
  RE RO RS RU RW
  SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
  TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ
  UA UG UM US UY UZ
  VA VC VE VG VI VN VU
  WF WS
  YE YT
  ZA ZM ZW
  `
    .trim()
    .split(/\s+/)
)

/**
 * Common aliases that map to an assigned code.
 * `UK` is reserved by ISO but is not assigned. The assigned code for the United Kingdom is `GB`.
 */
export const COUNTRY_CODE_ALIASES: Readonly<Record<string, string>> = { UK: 'GB' }

/**
 * The result of a country code check.
 * `countryCode` is the value to store. `isDropped` is true when the input had a value that is not a valid code.
 */
export interface NormalizedCountryCode {
  countryCode: string | null
  isDropped: boolean
}

const NO_COUNTRY_CODE: NormalizedCountryCode = { countryCode: null, isDropped: false }
const DROPPED_COUNTRY_CODE: NormalizedCountryCode = { countryCode: null, isDropped: true }

/**
 * Trims, uppercases, and checks a country code against the ISO 3166-1 alpha-2 list.
 * The bulk import uses this as the final check, because a client can skip the CSV preview.
 *
 * @param rawCountryCode - The country value from the request body. Any type is accepted.
 * @returns The code to store, or `null` with `isDropped` set when the value is not a valid code.
 * @example
 * normalizeCountryCode(' es ') // { countryCode: 'ES', isDropped: false }
 * normalizeCountryCode('UK') // { countryCode: 'GB', isDropped: false }
 * normalizeCountryCode('XXX') // { countryCode: null, isDropped: true }
 * normalizeCountryCode(undefined) // { countryCode: null, isDropped: false }
 */
export function normalizeCountryCode(rawCountryCode: unknown): NormalizedCountryCode {
  if (rawCountryCode === undefined || rawCountryCode === null) {
    return NO_COUNTRY_CODE
  }
  if (typeof rawCountryCode !== 'string') {
    return DROPPED_COUNTRY_CODE
  }

  const upperCode = rawCountryCode.trim().toUpperCase()
  if (!upperCode) {
    return NO_COUNTRY_CODE
  }

  const countryCode = COUNTRY_CODE_ALIASES[upperCode] ?? upperCode
  if (!ISO_COUNTRY_CODES.has(countryCode)) {
    return DROPPED_COUNTRY_CODE
  }

  return { countryCode, isDropped: false }
}
