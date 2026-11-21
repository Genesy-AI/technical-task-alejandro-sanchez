# 02: Email verification always reports an outcome

**What to build:** When a user starts email verification, each selected lead ends in a final state: verified, not verified, or could not be verified. The process never hangs. The user sees that verification is in progress and gets a clear result.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Diagnosis

Root cause, from the code and the Temporal SDK docs (`@temporalio/*` 1.13.0):

1. The verify activity has a `startToCloseTimeout` of 1 second and no `retry` option.
2. Without a `retry` option, Temporal uses the server default: `maximumAttempts` is unlimited, with exponential backoff up to 100 seconds.
3. The stub activity sleeps 20 seconds for `jane.smith@example.com`. Each attempt times out, and Temporal retries it forever.
4. The endpoint calls `workflow.execute` for each lead, one after another. It waits for each result. One stuck lead blocks the full HTTP request, so the request never returns.
5. The UI shows no pending state. The user sees nothing while the request hangs.

Other problems on the same path:

- The workflow ID includes `Date.now()`. Each click starts a new workflow for the same lead.
- The endpoint opens a new Temporal connection for each request. It closes the connection only on success, so an error leaks the connection.
- The success toast says "Verified N emails", but N counts completed checks, including emails that are not valid.

## Solution options

The main decision is how the request waits for the result.

| Option | How it works | Trade-off |
|---|---|---|
| **A. Bounded and parallel (recommended)** | Give the activity a retry limit. Start all leads in parallel and wait for all of them. The request returns when the slowest lead finishes or fails, about 9 seconds in the worst case. | Smallest change. No schema change. Uses the existing `errors` field in the response. The request is still synchronous. |
| B. Async with status | The endpoint starts the workflows and returns at once. Each lead stores a verification status (pending, verified, invalid, failed). The UI polls until no lead is pending. | Scales to any number of leads and any provider latency. Needs a schema change, polling, and more UI work. Ticket 04 builds this pattern for phone enrichment. |

Recommendation: option A for this bug. It removes the hang within the timebox. Move verification to option B later, when ticket 04 has built the status and polling pattern.

How a failed verification reaches the endpoint:

| Option | Trade-off |
|---|---|
| **Let the workflow fail (recommended)** | The Temporal UI shows the run as Failed, which is true. The endpoint catches the error for that lead and adds it to `errors`. |
| Catch in the workflow and return a "failed" result | The run shows as Completed, which hides the failure. |

## Decisions

Decided with the user on 2026-11-21:

- **Approach:** option A, bounded and parallel. Option B waits for ticket 04.
- **Failure path:** let the workflow fail. The endpoint reports the lead in `errors`.
- **Tests:** `@temporalio/testing` with a time-skipping test environment and mocked activities.

## Plan

1. Add `@temporalio/testing` 1.13.0 as a dev dependency. Write failing workflow tests first, with mocked activities:
   - The activity returns `true`: the workflow returns `true`.
   - The activity returns `false`: the workflow returns `false`.
   - The activity never finishes: the workflow fails after the maximum attempts, and does not retry forever.
2. Give the verify activity explicit, named limits: `startToCloseTimeout` 2 seconds, `maximumAttempts` 3, `initialInterval` 1 second, `backoffCoefficient` 2.
3. Add a workflow execution timeout of 30 seconds when the client starts the workflow. This is a safety limit if the activity settings change.
4. Add a shared Temporal client module. It connects once, at first use, with task queue `myQueue` on `localhost:7233`. Ticket 04 reuses it.
5. In the endpoint, start all leads in parallel and wait with `Promise.allSettled`. Use the workflow ID `verify-email-<leadId>` with `workflowIdConflictPolicy: USE_EXISTING`. A repeated click then joins the running workflow and does not start a duplicate.
6. In the endpoint, save `emailVerified` only for leads with a result. Leave a failed lead as unknown (`null`) and add it to `errors`.
7. Add a summary to the response: `validCount`, `invalidCount`, and `failedCount`. Update the frontend output type to match.
8. In the UI, close the dropdown and show a loading toast at the start. Disable the verify action while the request runs.
9. In the UI, replace the loading toast with a result toast, for example "2 valid, 1 invalid, 1 could not be verified". Use an error style when every lead failed.
10. Do a manual test: select `john.doe`, `jane.smith`, and one other lead. Make sure the request returns in less than 15 seconds and the table updates.
11. Run `pnpm vitest run` and `pnpm build` in both apps. The change must add no new build errors.

## Acceptance criteria

- [x] The verify activity has an explicit timeout and a retry policy with a maximum number of attempts.
- [ ] A verification request always returns. The worst case is less than 15 seconds, for any number of leads.
  - Not fully met. The workflow test measures 9.04 s of workflow time when all attempts time out. The request always returns, because each workflow has a 30 s execution timeout.
  - The worker runs at most 100 activities at the same time (SDK default). With more slow leads than that, queued attempts wait, and the bound becomes the 30 s execution timeout.
  - The end-to-end HTTP time was not measured. The manual app test (plan step 10) is left for the user.
- [x] A lead that runs out of attempts stays unknown in the table. The result toast counts it as "could not be verified".
  - The endpoint does not write `emailVerified` for a failed lead. A lead with an earlier result keeps that result.
- [x] One slow or failed lead does not delay the results of the other leads.
  - All leads run in parallel. The response is synchronous, so it comes when the slowest lead ends (option A).
- [x] The workflow ID is `verify-email-<leadId>`. A second request for a lead that is already running does not start a duplicate workflow.
- [x] The UI shows that verification is in progress, and the verify action is disabled until it ends.
  - Not checked in a browser. The dev stack was in use.
- [x] The result toast shows the counts: valid, invalid, and could not be verified.
  - Not checked in a browser. Unit tests cover the message.
- [x] The result toast names each email that could not be verified: up to three, then "and N more". A partial failure uses a warning style, and a toast with failed emails stays open for 8 seconds.
  - Added after review on 2026-11-21. Unit tests cover the message and the tone.
- [x] The backend uses one shared Temporal connection. An error does not leak a connection.
- [x] Workflow tests cover the valid, invalid, and timeout-then-failed paths.

## Out of scope

- Async verification with a stored status and polling (option B). Do it after ticket 04.
- Changes to the stub verify activity. Its 20-second delay simulates a slow provider, and the tests need it.
- Cancellation of the stub activity after a timeout. Without heartbeats, the 20-second sleep keeps running in the worker. This is harmless for a stub, but a real provider call must heartbeat or abort.
