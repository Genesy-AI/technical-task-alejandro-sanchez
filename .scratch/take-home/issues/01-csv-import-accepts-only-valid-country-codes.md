# 01: CSV import accepts only valid country codes

**What to build:** When a user imports leads from CSV, the leads table shows only valid ISO 3166-1 alpha-2 country codes. A lead with an invalid code still imports. The app drops the code and shows a warning in the import preview.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Diagnosis

Reproduced on 2026-11-21 by running the CSV parser on `docs/leads-with-errors.csv`.

| Row | Lead | Country in CSV | Parser result |
|---|---|---|---|
| 14 | Amanda James | `12` | valid, imported as `12` |
| 16 | Latasha Martin | `XXX` | valid, imported as `XXX` |
| 18 | Linda Choi | `XXX` | valid, imported as `XXX` |

Root cause: no layer checks the country value.

- The CSV parser copies any trimmed string into the country code.
- The import preview has no country column, so the user cannot see the value before import.
- The bulk import endpoint saves the value as it is.
- The leads table renders the stored value as it is.

The local database already holds bad values from earlier imports: `12` (1 lead), `XXX` (2 leads), and `UK` (1 seed lead).

## Solution options

Where the list of valid codes comes from:

| Option | Result | Trade-off |
|---|---|---|
| A. `Intl.DisplayNames` (built in) | Rejected. It accepts `UK`, `EU`, `UN`, `ZZ`, `419`, and withdrawn codes such as `AN` and `YU`. | No data to keep, but wrong answers. |
| **B. Static ISO 3166-1 alpha-2 list (recommended)** | Exact. Accepts the 249 assigned codes only. | The list is copied in the frontend and the backend. The standard changes very rarely. |
| C. `i18n-iso-countries` package | Exact, and includes country names. | A new dependency in both apps for one lookup. |

Where to check:

| Option | Trade-off |
|---|---|
| Frontend only | Good UX, but a direct API call can still save bad data. |
| Backend only | Safe, but the user sees the problem only after import. |
| **Both (recommended)** | The preview warns early. The endpoint is the final authority. This matches how the app already validates required fields. |

What to do with an invalid code:

| Option | Trade-off |
|---|---|
| **Drop the code and warn (recommended)** | The lead imports. The user loses only the bad value. |
| Mark the row invalid | Data stays strict, but one bad optional field blocks a full lead. |

## Decisions

Decided with the user on 2026-11-21:

- **Valid codes:** a static ISO 3166-1 alpha-2 list (option B).
- **Where to check:** both. The frontend CSV parser checks for the preview. The backend bulk import is the final authority.
- **Invalid code:** drop the code and warn. The lead still imports.
- **`UK` alias:** import maps `UK` to `GB` with no warning. A new migration changes stored `UK` values to `GB`.
- **Other stored bad values (`12`, `XXX`):** out of scope. The user clears the local data.

## Plan

1. Write failing parser tests first: `ES` and `es` pass, `UK` becomes `GB`, `XXX`, `12`, and `XX` give a warning, and an empty value gives no code and no warning.
2. Add a country code helper in the frontend: the ISO list and the `UK` alias as named constants, and a normalize function that trims, uppercases, maps the alias, and returns a code or a warning.
3. Add a `warnings` list to the parsed CSV lead, separate from `errors`. A warning does not change `isValid`.
4. In the CSV parser, send the country value through the helper. Store only a valid code.
5. In the import preview, add a Country column and show the warnings in each row. Add a stats tile for dropped country codes.
6. Add the same helper and tests in the backend. Make the bulk import endpoint normalize each code and store `null` for an invalid one.
7. Add `countryCodesDropped` to the bulk import response and to the frontend output type. Include it in the success toast when it is above zero.
8. Create a data migration with `pnpm migrate:dev --create-only --name normalize_uk_country_code` in `backend/`. Put only an `UPDATE` in it that sets `UK` to `GB`. Then apply it.
9. Do a manual test on cleared data: import `docs/leads-with-errors.csv`, then make sure the table shows no `XXX` or `12`.
10. Run `pnpm vitest run` and `pnpm build` in both apps. The change must add no new build errors.

## Acceptance criteria

- [x] The CSV preview shows the country of each row and a warning for each invalid code. The warning names the value.
  - Not checked in the browser. The dev stack was in use, so the manual test (plan step 9) is open for the user. An automated run of `parseCsv` on `docs/leads-with-errors.csv` kept no `XXX` or `12`.
- [x] A row with an invalid country code stays importable. It imports with no country code.
- [x] Valid codes are normalized: trimmed and uppercased (`es` becomes `ES`).
- [x] `UK` imports as `GB` with no warning.
- [x] The bulk import endpoint also checks country codes. It does not depend on the client check alone.
- [x] The import result tells the user how many country codes the app dropped.
- [x] A new migration changes stored `UK` values to `GB`. Existing migration files stay unchanged.
- [x] Unit tests cover valid, lowercase, three-letter, numeric, empty, and `UK` values, in both apps.

## Out of scope

- Cleanup of other stored bad values (`12`, `XXX`). The user clears the local data.
- A country picker or country names in the leads table.
- Checking country codes on lead create and update. Those endpoints do not accept a country today.
