---
status: accepted
---

# Verify emails in the request, with bounded retries

Email verification hung, because the verify activity had no retry limit and Temporal retried a slow email forever (ticket 02). The endpoint still waits for the results in the same HTTP request. The activity has explicit limits (2-second timeout, 3 attempts, exponential backoff), each run has a 30-second execution timeout, and all leads run in parallel. A failing email now ends in about 9 seconds, however many leads the user selects. We chose this over an async design because it removes the hang with no schema change, within the timebox.

## Considered options

- **Async with a stored status (deferred).** The endpoint starts the workflows and returns at once. Each lead stores a status (pending, valid, invalid, failed), and the UI polls. It scales to any number of leads and any provider latency. It needs a schema change and polling. Ticket 04 builds this pattern for phone enrichment. After that, move verification to it and supersede this ADR.
- **Catch the failure in the workflow and return a "failed" result (rejected).** The run would show as Completed in Temporal, which hides the failure. The workflow fails, and the endpoint reports the lead in `errors` with its email.

## Consequences

- The request time depends on the slowest lead, up to about 9 seconds. The worker runs at most 100 activities at once by default. With more slow leads than that, the 30-second execution timeout becomes the limit.
- A lead whose check fails keeps its earlier `emailVerified` value. The table can show a stale ✅ or ❌ for an email that the latest check could not verify. The result toast names those emails. A stored status, as in the deferred option, removes this gap.
- The workflow ID is `verify-email-<leadId>` with `workflowIdConflictPolicy: USE_EXISTING`. A repeated request joins the running workflow and does not start a duplicate.
