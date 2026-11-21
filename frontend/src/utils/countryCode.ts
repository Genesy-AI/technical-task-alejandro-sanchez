/**
 * The officially assigned ISO 3166-1 alpha-2 codes (249 codes).
 *
 * A static list, because `Intl.DisplayNames` also accepts codes that are not
 * assigned, such as `UK`, `EU`, `UN`, `ZZ`, and `419`.
 * The backend keeps a copy in `backend/src/utils/countryCode.ts`. Update both together.
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
 * `countryCode` is set only for a valid code. `warning` is set only for an invalid code.
 */
export interface NormalizedCountryCode {
  countryCode?: string
  warning?: string
}

/**
 * Trims, uppercases, and checks a country code against the ISO 3166-1 alpha-2 list.
 *
 * @param rawCountryCode - The country value as it comes from the CSV.
 * @returns The normalized code, a warning for an invalid code, or an empty object for an empty value.
 * @example
 * normalizeCountryCode(' es ') // { countryCode: 'ES' }
 * normalizeCountryCode('UK') // { countryCode: 'GB' }
 * normalizeCountryCode('XXX') // { warning: 'Invalid country code "XXX" dropped' }
 */
export const normalizeCountryCode = (rawCountryCode: string): NormalizedCountryCode => {
  const trimmedCode = rawCountryCode.trim()
  if (!trimmedCode) {
    return {}
  }

  const upperCode = trimmedCode.toUpperCase()
  const countryCode = COUNTRY_CODE_ALIASES[upperCode] ?? upperCode
  if (!ISO_COUNTRY_CODES.has(countryCode)) {
    return { warning: `Invalid country code "${trimmedCode}" dropped` }
  }

  return { countryCode }
}
