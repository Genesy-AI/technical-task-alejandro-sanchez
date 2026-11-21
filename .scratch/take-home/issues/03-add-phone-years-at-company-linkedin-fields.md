# 03: Add phone, years at company, and LinkedIn fields

**What to build:** A lead has three new optional fields: phone number, years at current company, and LinkedIn profile URL. Users can see them in the leads table, set them through CSV import, and use them in message templates. The example CSV files already contain `phoneNumber` and `yearsInRole` columns. Today the app ignores these columns.

The message composition UX must keep working as the field list grows. Today the backend and the frontend each have their own hard-coded field list, and the modal shows one button for each field. Make one list the source of truth for the fields a template can use. Replace the fixed button row with a picker that scales, for example a searchable list.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Diagnosis

Checked on 2026-11-21 against the code and the example CSV files.

Data path today:

| Layer | File | State |
|---|---|---|
| Schema | `backend/prisma/schema.prisma` | No phone, years, or LinkedIn column. |
| CSV parser | `frontend/src/utils/csvParser.ts` | The header `switch` has no case for the new columns. It drops them with no message. |
| Bulk import | `backend/src/index.ts` (`POST /leads/bulk`) | Copies six named fields. It ignores all other fields. |
| Lead types | `frontend/src/api/types/leads/*.ts` | `getMany` has the full lead. `create` and `getOne` declare only `id`, `firstName`, and `email`, but the API returns the full row. |
| Table | `frontend/src/components/LeadsList.tsx` | Fixed columns. Empty values show `-`. |
| Build | `frontend/src/api/mutations/useApiMutation.ts` | TS2741: the optimistic lead has no `emailVerified`. The same error comes back for each new field if the type changes and this object does not. |

The example CSV data:

| File | `yearsInRole` | `phoneNumber` | LinkedIn |
|---|---|---|---|
| `leads-ok-1/2/3.csv` | Integers 1 to 15 | Mixed formats, for example `+1-280-754-0462x2154`, `(731)123-9702`, `063.430.8860x4762` | No column |
| `leads-ok-missing fields.csv` | 2 empty rows | 2 empty rows | No column |
| `leads-with-errors.csv` | 2 empty rows | 13 empty rows | No column |

No example file has a bad years value or a LinkedIn column. The tests must supply those cases.

Message templates have two field lists that can drift:

- Backend: `availableFields` in `backend/src/utils/messageGenerator.ts`.
- Frontend: `availableFields` in `frontend/src/components/MessageTemplateModal.tsx`, shown as one button for each key.

Other problems on the same path:

- The generator calls `String.replace` with the value as a string. JavaScript reads `$&`, `$1`, and `$$` in that string as patterns. Tested: the value `Price $& now` gives `Price {x} now`. A URL or free text can trigger this.
- The generator treats only `null`, `undefined`, and `''` as empty. A years value of `0` is valid, but `replace` needs a string. The number must be formatted first.
- The error messages use the key only, for example `Missing required field: lastName`. They do not use a readable label.
- The README says "years at current company". The CSV column is `yearsInRole`. These are not the same fact. The ticket accepts `yearsInRole` as an alias, so the import treats them as the same.

Overlap with in-progress work:

- Ticket 01 (branch `fix/01-csv-country-codes`) adds a `warnings` list to the parsed CSV lead, a Country column in the preview, and a migration. This ticket needs the same `warnings` list.
- Both tickets change `backend/prisma/dev.db`. Git cannot merge a binary file. The second merge must take one copy and apply the other migration again.

## Solution options

Source of truth for template fields. The backend and the frontend are separate pnpm projects with no shared package.

| Option | How it works | Trade-off |
|---|---|---|
| **A. Backend list, served by an endpoint (recommended)** | The backend defines the list: key, label, and how to read the value from a lead. `GET /leads/template-fields` returns key and label. The modal fetches it. | One list at runtime. A new field needs no frontend change. Costs one cached request and a loading state in the modal. |
| B. Shared folder imported by both apps | A `shared/` folder at the repo root. Both apps import it through a path alias. | One list at build time, no request. Needs Vite `server.fs.allow`, a backend `rootDir` change, and both test configs. More build risk. |
| C. Two lists and a contract test | Keep a list in each app. A test fails when they differ. | Simple. Not one source of truth, so it does not meet the ticket. |

Field picker in the modal:

| Option | Trade-off |
|---|---|
| **A. Searchable dropdown (recommended)** | An "Insert field" button opens a list with a search box. It matches label and key, and supports the arrow keys, Enter, and Escape. Scales to many fields. Moderate effort, no new dependency. |
| B. Autocomplete on `{` in the textarea | Fast for power users. Needs caret position tracking in a plain textarea, which is fragile. Users who do not know the syntax cannot find it. |
| C. Both | Best UX. About twice the UI work and tests in the timebox. |

LinkedIn URL check:

| Option | Accepts | Trade-off |
|---|---|---|
| **A. Profile URL only, normalized (recommended)** | Host `linkedin.com` or a subdomain, path `/in/<slug>`. Adds `https://` when it is missing. Stores `https://www.linkedin.com/in/<slug>`. | Clean data and correct links in messages. Rejects company pages, which are not person profiles. |
| B. Any `linkedin.com` URL | Profiles, company pages, and posts. | Fewer warnings, but bad values reach templates. |
| C. Any `http(s)` URL | Any URL. | Almost no check. Does not meet "malformed LinkedIn URL". |

Where to check the values: follow the ticket 01 decision. The CSV parser warns in the preview, and the bulk import endpoint is the final authority. A bad value is dropped and the lead still imports.

Phone and years defaults (not open questions unless you disagree):

- **Phone:** store the trimmed text as it is. The example formats have extensions and no country, so a correct E.164 conversion needs a country and a library. Ticket 04 can normalize phones from providers.
- **Years:** a whole number, `0` or more, stored as `Int`. A decimal, negative, or non-numeric value gives a warning and is dropped.

## Decisions

Decided with the user on 2026-11-21:

- **Field list:** the backend owns it (option A). `GET /leads/template-fields` serves the key and label of each field. The modal fetches it.
- **Picker:** a searchable dropdown (option A). Autocomplete on `{` is out of scope.
- **LinkedIn URL:** profile URLs only, normalized to `https://www.linkedin.com/in/<slug>` (option A).
- **Sequencing:** build on ticket 01. Reuse its `warnings` list and its normalize pattern (`{ value, warning }` in the frontend, `{ value, isDropped }` in the backend). On 2026-11-21, ticket 01 was on `fix/01-csv-country-codes` and not yet on `technical-task`.
- **Where to check:** both, as in ticket 01. A bad value is dropped with a warning. The lead still imports.
- **Phone:** stored as trimmed text, with no format check.
- **Years:** a whole number, `0` or more, stored as `Int`. The import reads `yearsInRole` as years at the current company.

## Plan

Field names: `phoneNumber`, `yearsAtCompany`, `linkedinUrl`. The template key of each field is the same as its lead property.

1. Make sure ticket 01 is on `technical-task`. If it is not, merge `fix/01-csv-country-codes` first. For a `dev.db` conflict, take one copy and run `mise run db` to apply the missing migration.
2. Add the three fields to `schema.prisma` as optional. Run `pnpm migrate:dev --name add_phone_years_linkedin` in `backend/`. Make sure the 25 seed leads keep their data.
3. Write failing backend tests first for a template field list in `backend/src/utils/templateFields.ts`:
   - The lookup finds a field by key and returns nothing for an unknown key.
   - Keys and labels are unique.
   - Years `0` reads as `"0"`. An empty value reads as `null`.
4. Make the field list. Each entry has a `key`, a `label`, and a `readValue(lead)` function that returns a string or `null`. Include the six current fields and the three new ones.
5. Change the message generator to use the field list:
   - Unknown key: keep `Unknown field in template: <key>`.
   - Empty value: `Missing required field: <key> (<label>)`. The current tests match this as a substring, so they keep passing.
   - Replace with a function, not a string. This fixes the `$&` bug. Add a test for it.
   - Add tests that generate messages with the three new fields.
6. Add `GET /leads/template-fields`. It returns `{ key, label }[]` from the list.
   Warning: declare this route before `GET /leads/:id`. If you do not, Express sends the request to `/leads/:id`.
7. Write failing backend tests for two normalizers: `yearsAtCompany` and `linkedinUrl`.
   - Years: `5` and `"5"` pass. `0` passes. `-1`, `2.5`, `abc`, and empty are dropped.
   - LinkedIn: `linkedin.com/in/jane`, `https://es.linkedin.com/in/jane/`, and `www.linkedin.com/in/jane?x=1` become `https://www.linkedin.com/in/jane`. `linkedin.com/company/acme`, `example.com/in/jane`, and `not a url` are dropped.
8. Make the normalizers. Use them in `POST /leads/bulk`. Store a trimmed phone or `null`. Add `yearsAtCompanyDropped` and `linkedinUrlsDropped` to the response, as ticket 01 did with `countryCodesDropped`.
9. In the frontend, add one `Lead` type in `frontend/src/api/types/leads/lead.ts`. Use it for the `getMany`, `getOne`, and `create` outputs. Add the new fields to the bulk import input and output types.
10. Add `emailVerified: null` and the three new fields as `null` to the optimistic lead in `useApiMutation.ts`. Remove the TS2741 line from the known failures in `CLAUDE.md`.
11. Write failing parser tests first, then add the same normalizers in the frontend. Map these normalized headers in `csvParser.ts`:
    - `phonenumber`, `phone` to `phoneNumber`.
    - `yearsatcompany`, `yearsinrole` to `yearsAtCompany`.
    - `linkedinurl`, `linkedin`, `linkedinprofile` to `linkedinUrl`.
    A bad value adds a warning that names the value. It does not change `isValid`.
12. In the import preview, add Phone, Years, and LinkedIn columns. Show the new warnings in the existing warnings cell. Add the dropped counts to the success toast when they are above zero.
13. In the leads table, add the three columns with `-` for an empty value. Show the LinkedIn URL as a link with `target="_blank"` and `rel="noopener noreferrer"`.
14. Add the `templateFields` endpoint to `frontend/src/api/modules/leads.ts`, with its type file. Fetch it in the modal with `useQuery` and `staleTime: Infinity`.
15. Write failing tests first for a pure `filterTemplateFields(fields, query)` function. It matches the label or the key, with no case sensitivity. An empty query returns all fields.
16. Make `TemplateFieldPicker.tsx`: an "Insert field" button, a search box, and a list that shows the label and `{key}` of each field. Support the arrow keys, Enter, Escape, and a "No fields match" state. Keep the current cursor insert logic.
17. Replace the button row in `MessageTemplateModal.tsx` with the picker. Show a loading state while the fields load. If the fetch fails, show a short message. The user can still type a template.
18. Do a manual test:
    - Import `docs/leads-ok-1.csv`. Make sure the table shows phone and years.
    - Import a CSV with years `-3`, years `abc`, and the LinkedIn value `example.com/in/x`. Make sure the preview warns and the rows import without those values.
    - Search "phone" and "years" in the picker. Insert both.
    - Generate a message with `{phoneNumber}` for leads with and without a phone. Make sure each lead without a phone gets the error.
19. Run Prettier on the changed files. Run `pnpm vitest run` and `pnpm build` in both apps. The change must add no new build errors.

To add a template field later: add it to the schema and the lead types, then add one entry to `templateFields.ts`.

## Acceptance criteria

Data, API, and table:

- [x] A new migration adds the three fields. Existing leads keep their data, and the new fields are empty.
  - Migration `20261121191853_add_phone_years_linkedin`. After it ran, the local database had 25 leads, 24 country codes, and no values in the new columns.
- [x] The API returns the new fields on every endpoint that returns a lead.
  - The routes return the full Prisma row, so the new columns are included. Not checked with a running backend, because the dev stack was in use.
- [x] The leads table shows the three fields, with a placeholder when a value is empty.
  - Not checked in the browser. See the manual checks below.
- [x] The frontend lead types include the new fields. This fixes the existing TS2741 build error on the optimistic lead. Remove that entry from the known failures in CLAUDE.md.

CSV import:

- [x] CSV import maps the phone, years-at-company, and LinkedIn columns. It accepts the header aliases in the example files (`phoneNumber`, `yearsInRole`).
  - A test runs the parser on `docs/leads-ok-1.csv` and gets the phone and years of each row.
- [x] The import preview flags a non-numeric or negative years value and a malformed LinkedIn URL. The row still imports without the bad value.
  - Parser tests cover `-3`, `abc`, `2.5`, and `example.com/in/x`. The preview UI is not checked in the browser.
- [x] The bulk import endpoint also checks years and LinkedIn values. It does not depend on the client check alone.
  - The normalizers have unit tests. The route itself has no test, because `index.ts` starts the server on import.
- [x] A valid LinkedIn profile URL is stored as `https://www.linkedin.com/in/<slug>`.

Message composition:

- [x] One list defines the template fields. The message generator and the composition modal both use it.
- [x] Each field has a human-readable label, separate from its template key.
- [x] Users can find and insert a field by searching its label or key.
- [x] The picker works with the keyboard: arrow keys, Enter, and Escape.
  - A jsdom test drives the picker with key events. Not checked in the browser.
- [x] The three new fields work in templates and in generated messages.
- [x] An unknown field or an empty value still gives a clear error for each lead.
- [x] A value that contains `$&` or `$1` is inserted as it is.
- [x] To add a new template field, a developer changes only the field list and the lead data.
  - Backend: the schema, `TemplateLead`, and one entry in `templateFields.ts`. Frontend: the `Lead` type only.

Tests:

- [x] Unit tests cover CSV mapping and validation for the new fields.
- [x] Tests cover the message generator with the new fields and the field-list lookup.
- [x] Tests cover the picker search function.

Manual checks left (plan step 18, not done because the dev stack was in use):

- Import `docs/leads-ok-1.csv`. Make sure the table shows phone and years.
- Import a CSV with years `-3`, years `abc`, and the LinkedIn value `example.com/in/x`. Make sure the preview warns and the rows import without those values.
- Search "phone" and "years" in the picker. Insert both.
- Generate a message with `{phoneNumber}` for leads with and without a phone. Make sure each lead without a phone gets the error.

## Out of scope

- Phone format checks or E.164 normalization. Ticket 04 can normalize phones from providers.
- Editing the new fields in the create and update flows. Those endpoints do not accept them today.
- Autocomplete on `{` in the template textarea.
- A check for unknown fields in the modal before submit. The backend error for each lead covers it.
- LinkedIn company pages and other non-profile URLs.
- A backfill of the new fields for existing leads.
