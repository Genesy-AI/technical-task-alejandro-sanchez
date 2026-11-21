# Check country codes against a static ISO list in each app

CSV import showed values such as `XXX` and `12` as country codes, because no layer checked them (ticket 01). We check each code against a static list of the 249 assigned ISO 3166-1 alpha-2 codes. Each app keeps its own copy of the list, because the frontend and the backend are separate pnpm projects with no shared package. `UK` is the only alias: it maps to `GB`.

## Considered options

- **`Intl.DisplayNames` (rejected).** It needs no data, but it accepts codes that are not countries: `UK`, `EU`, `UN`, `ZZ`, `419`, and the withdrawn codes `AN` and `YU`. Do not replace the list with it.
- **The `i18n-iso-countries` package (rejected).** It is exact, but it adds a dependency to both apps for one lookup.
- **One shared module for both apps (rejected).** It needs build changes in Vite, TypeScript, and both test configs. The list changes about once a decade, so two copies cost less.

## Consequences

- The two copies can drift. Update both together. Each copy has a comment that names the other.
- `UK` is not an ISO code, but it is common in real CSV files. The import stores it as `GB` with no warning. The migration `normalize_uk_country_code` changes stored `UK` values to `GB`, so old and new data agree.
