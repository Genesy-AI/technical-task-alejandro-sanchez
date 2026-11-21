# 04: Enrich phone with a Temporal provider chain

**What to build:** A user selects leads and starts "Enrich phone". For each lead, a Temporal workflow calls three providers in order and stops at the first phone it finds:

1. Orion Connect: best data, but slow and sometimes fails.
2. Astra Dialer: fastest, but the worst data.
3. Nimbus Lookup: new provider.

If no provider finds a phone, the lead is marked "No data found". The user sees the progress and the result on each lead. Provider details (URLs, auth, request and response shapes) are in the README.

**Blocked by:** 03 (needs the phone field)

**Status:** ready-for-agent

## Diagnosis

Checked on 2026-11-21 against the code and the live provider APIs. Each provider got 18 to 20 calls with the README example data.

### What exists

| Part | State |
|---|---|
| Phone field | None. Ticket 03 adds `phoneNumber` (trimmed text). Ticket 03 is not built yet. |
| Enrichment status | None. The lead has no status, provider, or timestamp columns. |
| Temporal | One workflow (`verifyEmailWorkflow`) and one stub activity. One worker on `myQueue`. Ticket 02 added a shared client in `backend/src/temporalClient.ts`. |
| Async pattern | None. Email verification waits in the HTTP request (ADR 0003). ADR 0003 says ticket 04 builds the stored status and polling pattern. |
| HTTP client | None in the backend. Node 22 has `fetch` and `AbortSignal.timeout`. |
| Configuration | Nothing reads `process.env`. The backend has no `.env` loader. Prisma loads `.env` only for itself. |

### The live APIs differ from the README

| | Orion Connect | Astra Dialer | Nimbus Lookup |
|---|---|---|---|
| Path | `/orionConnect` | `/astraDialer` | `/numbusLookup`. The spelling `nimbusLookup` gives 404. |
| Auth | Header `x-auth-me` | Header `apiKey` | Query `api` |
| Lead input | `fullName`, `companyWebsite` | `email` | `email`, `jobTitle` |
| Response (README) | `{ phone: string \| null }` | `{ phoneNmbr: string \| null \| undefined }` | `{ number: number, countryCode: string }` |
| **Response (live)** | `{ phone: "8229099100" }` | `{ phoneNmbr: "2502843895" }`, `{ phoneNmbr: null }`, or `{}` | **`{ phoneNmbr: 8173646528, countryCode: "ES" }`**. The key is `phoneNmbr`, not `number`, and the value is a number. |
| Latency | About 4.2 s on success. About 0.2 s on a 500. | 0.2 to 1.2 s | 2.2 to 2.7 s |
| Failures seen | 500 in about 1 of 3 calls | 500 in 1 of 18 calls. About half of the 200 responses have no phone. | 500 in about 1 of 9 calls |
| Bad auth | 401 | 401 | 401 |
| Missing input | 400 `Missing required input` | 400 | 400 (no `jobTitle`) |

Consequences for the design:

- **The adapter must not trust the README.** Nimbus has a different key and type from the README. Each adapter must parse the response as `unknown` and accept or reject each shape. A test for each live shape is required.
- **The timeouts must be different for each provider.** A 2-second timeout, as used for email verification, makes every successful Orion call time out. Orion needs about 6 seconds.
- **Some errors must not be retried.** Retry a 5xx, a timeout, or a network error. A 401 or a 400 fails the same way each time. Mark it non-retryable and go to the next provider.
- **Orion needs `companyWebsite`, but a lead has only `companyName`.** This is an open decision (see below).
- **Nimbus needs `jobTitle`, which is optional.** With no job title, the adapter must skip the call. It must not send a request that returns 400.
- **The results are random.** The same input gives a different phone on each call. Temporal records the activity result, so a replay is safe. A new workflow run can give a different phone.
- **The phone formats are different.** Orion and Astra return 10-digit strings with no country. Nimbus returns a number and a country code. A number loses a leading zero.

## Solution options

### Provider adapters

The workflow must not know the request, auth, or response shape of a provider. Each option below gives one normalized result:
`{ status: 'found', phone, countryCode? } | { status: 'not_found' } | { status: 'skipped', reason }`. A failure is a thrown error.

| Option | How it works | Trade-off |
|---|---|---|
| **A. Typed adapter per provider and one shared HTTP runner (recommended)** | Each provider is a small object: `id`, `buildRequest(lead)` (returns the URL, headers, query, and body, or "skip" when input is missing), and `parseResponse(body: unknown)`. One runner reads the secret, calls `fetch` with a timeout, and sorts errors into retryable and non-retryable. A registry lists the providers in order. | Each adapter is pure and can be tested with no network: about 20 lines and one test file each. Auth, timeouts, and error rules are in one place. A new provider is one adapter file and one registry entry. |
| B. Declarative config | Each provider is data only: URL, auth type and name, a request field map, and a response path. One generic engine runs all of them. | Less code per provider. Nimbus already needs a type conversion and a second field. The config grows into a small language with weak types. Harder to test edge cases. |
| C. Class per provider with a base class | `abstract class PhoneProvider` with template methods. Each provider overrides `buildRequest` and `parseResponse`. | Same result as A. Adds inheritance and `this` state for no gain. The repo uses functions and interfaces, not classes. |
| D. One hand-written activity per provider | Three activity functions. Each one does its own `fetch`, auth, and parsing. They share only the result type. | Least code. Timeouts, error rules, and secret reads are copied three times. Weak on "one provider interface". |

How activities map to providers (for options A to C):

| Option | Trade-off |
|---|---|
| **One activity per provider, made from the registry (recommended)** | Activities `lookupPhoneWithOrionConnect`, `lookupPhoneWithAstraDialer`, and `lookupPhoneWithNimbusLookup` all call the same runner. The Temporal UI shows which provider ran. Each provider gets its own timeout, retry policy, and later its own rate limit. |
| One generic activity `lookupPhone(providerId, lead)` | One function. The Temporal UI shows the same name for each call. All providers share one set of activity options unless the workflow makes one proxy per provider. |

### Rate limits (nice to have)

| Option | Trade-off |
|---|---|
| **Task queue per provider with `maxTaskQueueActivitiesPerSecond` (recommended)** | Built into Temporal. The server applies the limit to all workers, so it stays correct with more than one worker. Needs one extra worker for each provider queue. Leave the limit unset by default. |
| Token bucket in the worker process | No Temporal changes. Wrong when there is more than one worker, and the count resets on restart. |
| Wait for a 429 and back off | No limit config. It needs a 429 to happen first, and providers do not send 429 today. |

### Credentials

| Option | Trade-off |
|---|---|
| **Environment variables, checked at worker start (recommended)** | `backend/.env` locally (git ignores it), a secret manager in production. Node 22 loads the file with `--env-file-if-exists`, so no new dependency. A rotated key needs no code change. |
| Keys in source code | Fails the ticket. A rotated key needs a release, and the key is in git history. |

## Decisions

Decided with the user on 2026-11-21:

- **Adapters:** option A. Each provider is a typed adapter with a pure `buildRequest` and `parseResponse`. One shared HTTP runner handles auth, timeouts, and error types. An ordered registry lists the providers.
- **Activities and queues:** one activity for each provider, made from the registry. Each one runs on its own task queue, so each provider can get a rate limit with one config value. The limit is unset by default.
- **Credentials:** environment variables in `backend/.env`, with the names in `.env.sample`. One config module checks them when the worker starts. Only activity code reads them.
- **Orion input:** `companyWebsite` is the domain of the lead's email. For a free-mail domain (for example `gmail.com`), the Orion adapter skips the call.
- **Lead with a phone:** "Enrich phone" skips it and starts no workflow. The result counts it as "already has a phone".
- **UI updates:** polling. The leads query refetches every 2 seconds while a lead is running.

Defaults from this plan (not open questions unless you disagree):

- **Statuses:** `running`, `found`, `not_found`, and `failed`. `not_found` means each provider answered with no phone, or was skipped. `failed` means at least one provider failed after its retries and no provider found a phone. A later retry can still find data.
- **Phone format:** the provider value as a string of digits. A Nimbus number becomes a string. Its `countryCode` is stored too. No E.164 conversion.

## Plan

Names used below: provider IDs `orionConnect`, `astraDialer`, `nimbusLookup`. Workflow ID `enrich-phone-<leadId>`.

### Before you start

1. Make sure ticket 03 is on `technical-task`. This ticket needs its `phoneNumber` field and its shared frontend `Lead` type.

### Data

2. Add these optional columns to the lead: `phoneEnrichmentStatus String?`, `phoneProvider String?`, `phoneCountryCode String?`, `phoneEnrichedAt DateTime?`. Prisma does not support enums on SQLite, so the status is a string with named constants in the code. Run `pnpm migrate:dev --name add_phone_enrichment_status` in `backend/`.

### Configuration

3. Add the variables to `backend/.env.sample` with empty values: `ORION_CONNECT_API_KEY`, `ASTRA_DIALER_API_KEY`, `NIMBUS_LOOKUP_API_KEY`, the three base URLs, and three optional `*_MAX_REQUESTS_PER_SECOND` values. Put the README values in your local `backend/.env`.
4. Add `--env-file-if-exists=.env` to the `node` command in the `dev` task in `mise.toml`.
5. Write failing tests first for `backend/src/phoneProviders/config.ts`. A missing key gives an error that names the variable. A missing rate limit gives "no limit".
6. Make the config module.

### Adapters

7. Define the shared types in `backend/src/phoneProviders/types.ts`:
   - `PhoneLookupResult`: `{ status: 'found', phone, countryCode? } | { status: 'not_found' } | { status: 'skipped', reason }`.
   - `PhoneProvider`: `id`, `label`, `buildRequest(lead, apiKey)`, `parseResponse(body: unknown)`.
   - `ProviderRequest`: URL, headers, query, and JSON body, or a skip with a reason.
8. Write failing tests first for each adapter. Use the live shapes from the diagnosis, not only the README:
   - Orion: `{ phone: "…" }` is found. `{ phone: null }` is not found. A free-mail email is skipped. The request has the header `x-auth-me`, `fullName`, and the email domain.
   - Astra: `{ phoneNmbr: "…" }` is found. `{ phoneNmbr: null }` and `{}` are not found. The request has the header `apiKey`.
   - Nimbus: `{ phoneNmbr: 8173646528, countryCode: "ES" }` is found as `"8173646528"` with `ES`. The README shape `{ number, countryCode }` is also accepted. No job title is skipped. The key is in the `api` query value.
   - Each adapter: an unexpected shape, such as an array or a phone of the wrong type, throws an invalid response error.
9. Make the three adapters and a helper that gets the email domain and checks it against a named list of free-mail domains.
10. Make the registry in `backend/src/phoneProviders/registry.ts`. Each entry has the adapter, the task queue, and the activity limits:

    | Provider | Task queue | Attempt timeout | Attempts | Worst case |
    |---|---|---|---|---|
    | Orion Connect | `phone-orion-connect` | 6 s | 3 | About 21 s |
    | Astra Dialer | `phone-astra-dialer` | 2 s | 3 | About 9 s |
    | Nimbus Lookup | `phone-nimbus-lookup` | 4 s | 3 | About 15 s |

    The first retry waits 1 second, and the wait doubles on each retry. The full chain ends in about 45 seconds in the worst case.

### HTTP runner and activities

11. Write failing tests first for the runner in `backend/src/phoneProviders/runProviderLookup.ts`. Mock `fetch`:
    - A 200 response goes to `parseResponse`.
    - A 5xx, a timeout, or a network error throws a retryable error.
    - A 401 or a 400 throws `ApplicationFailure.nonRetryable`.
    - A skip from `buildRequest` sends no request.
    - No error message contains the API key. This includes the Nimbus URL with `?api=`.
12. Make the runner. Use `fetch` with `AbortSignal.timeout`, set a little below the activity timeout. Remove the key from each URL before you use the URL in an error.
13. Make one activity for each provider from the registry: `lookupPhoneWithOrionConnect`, `lookupPhoneWithAstraDialer`, `lookupPhoneWithNimbusLookup`. Each one reads its key from config and calls the runner.
14. Add a `savePhoneEnrichment(leadId, outcome)` activity on `myQueue`. It writes the status, phone, provider, country code, and timestamp. Give it explicit limits: 5-second timeout and 5 attempts.

    Warning: do not pass an API key as a workflow or activity argument. Temporal stores arguments in plain text in its history, and the Temporal UI shows them.

### Workflow and worker

15. Write failing workflow tests first, with `@temporalio/testing` and mocked activities. The test must start one worker for each task queue.
    - Orion finds a phone: the workflow does not call Astra or Nimbus, and saves `found` with `orionConnect`.
    - Orion has no phone, Astra finds one: saves `found` with `astraDialer`.
    - All three have no phone or skip: saves `not_found`.
    - Orion fails after its retries, Astra finds a phone: saves `found`.
    - All three fail: saves `failed`.
    - The save activity runs one time in each path.
16. Make `enrichPhoneWorkflow(lead)` in `backend/src/workflows/`. It takes the lead ID, full name, email, and job title. It loops over the registry in order, makes one `proxyActivities` call for each provider with that provider's queue and limits, catches `ActivityFailure` to go to the next provider, and saves the outcome at the end. Export it from the workflows barrel.
17. Change `backend/src/worker.ts` to start one worker on `myQueue` for workflows and the save activity, and one worker for each provider queue. They share one `NativeConnection`. Set `maxTaskQueueActivitiesPerSecond` only when the config has a limit. Check the config before the workers start.

### Endpoint

18. Write failing tests first for `backend/src/phoneEnrichment.ts`, with injected dependencies, as in `emailVerification.ts`:
    - A lead with a phone is skipped and counted.
    - Other leads are set to `running`, then their workflows start in parallel.
    - A failed start puts the earlier status back and adds the lead to `errors`.
19. Make the module and `POST /leads/enrich-phones` with `{ leadIds }`. Use `client.workflow.start`, not `execute`, so the request returns at once. Use `workflowIdConflictPolicy: USE_EXISTING`, so a repeated request joins the running workflow. Return `startedCount`, `skippedWithPhoneCount`, and `errors`.

### Frontend

20. Add the four new fields to the shared `Lead` type. Add `frontend/src/api/types/leads/enrichPhones.ts` and the `enrichPhones` entry with method `POST` in `frontend/src/api/modules/leads.ts`.
21. Write failing tests first for two pure helpers:
    - `getPhoneCellState(lead)`: phone and provider, "Searching…", "No data found", "Could not enrich", or `-`.
    - `getLeadsRefetchInterval(leads, pollingStartedAt, now)`: 2000 ms while a lead is `running`. `false` when no lead is running, or after 2 minutes.
22. Add "Enrich phone" to the selection actions in `LeadsList.tsx`. Disable it while the request runs. Show a toast with the counts: started, already has a phone, and could not start.
23. Use the helpers in the leads table and in the `getMany` query `refetchInterval`.

### Finish

24. Do a manual test with `mise run dev`:
    - Select 5 leads: 1 with a phone, 1 with a free-mail email, 1 with no job title, and 2 others. Make sure the toast counts the skipped lead and the table shows "Searching…".
    - Make sure each lead ends as found, not found, or failed with no page reload.
    - Click "Enrich phone" again on a lead that is running. Make sure the Temporal UI shows one workflow for it.
    - Open a workflow in the Temporal UI. Make sure no API key is in the inputs or the failures.
25. Run Prettier on the changed files. Run `pnpm vitest run` and `pnpm build` in both apps. The change must add no new build errors.

## Acceptance criteria

- [ ] One provider interface hides the request, auth, and response differences between the providers. Each provider maps its response to one normalized phone result.
- [ ] Each adapter accepts the live response shapes. This includes Nimbus `{ phoneNmbr: number, countryCode }`.
- [ ] Each provider call is a separate activity with a short timeout and a retry policy (for example, 3 attempts with exponential backoff).
- [ ] A 401 or a 400 from a provider is not retried. A 5xx or a timeout is retried.
- [ ] The workflow stops after the first provider that returns a phone.
- [ ] When all three providers return no phone, the lead status is "No data found".
- [ ] A provider that fails after all retries does not stop the chain. The workflow continues to the next provider.
- [ ] Orion gets the email domain as `companyWebsite`. It is skipped for a free-mail domain. Nimbus is skipped for a lead with no job title.
- [ ] The workflow is idempotent, with one workflow for each lead and a deterministic ID. A repeated request for a lead that is already running does not start a second workflow.
- [ ] "Enrich phone" skips a lead that already has a phone. The result counts it.
- [ ] The lead stores an enrichment status (for example: running, found, not found, failed) and, when found, the phone and the provider that found it.
- [ ] The UI has an "Enrich phone" action and shows the status for each lead while the workflow runs. The user does not have to reload the page.
- [ ] Polling stops when no lead is running.
- [ ] Provider credentials come from configuration, not from source code.
- [ ] The worker does not start when a key is missing. The error names the missing variable.
- [ ] No API key is in workflow history, activity failures, or logs.
- [ ] Tests cover the response mapping for each provider and the workflow paths: first-hit stop, fallback, all-empty, and provider failure.
- [ ] Nice to have: each provider has its own rate limit, so a bulk enrichment respects future RPS/RPM limits. Leave the limit unset by default.

## Out of scope

- Moving email verification to this async pattern. ADR 0003 records it as a follow-up.
- A `companyWebsite` field on the lead.
- Phone format checks or E.164 conversion.
- Server-sent events or WebSockets.
- A lead left as `running` after a Temporal restart. Temporal keeps its state in memory, so a restart loses the workflow. Polling stops after 2 minutes, and the user can start enrichment again.
- A cache of provider results, and cost tracking for each provider call.
