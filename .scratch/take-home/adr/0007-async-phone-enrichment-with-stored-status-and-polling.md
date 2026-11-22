# Enrich phones asynchronously, with a stored status and polling

The provider chain for one lead can take about 45 seconds in the worst case (ticket 04), which is too long for one HTTP request. `POST /leads/enrich-phones` starts one workflow for each lead and returns at once. Each lead stores its enrichment status, and the leads table polls every 2 seconds while any lead is running. This is the async pattern that ADR 0003 deferred for email verification.

## Considered options

- **Wait in the request, as in ADR 0003 (rejected).** The request would take up to 45 seconds, and the user would see no progress for each lead.
- **Server-sent events or WebSockets (rejected).** Updates are faster, but they need a push channel from the worker to the browser. Polling a query that already exists is enough at a 2-second interval.

## Consequences

- The lead stores `phoneEnrichmentStatus`, `phoneProvider`, `phoneCountryCode`, and `phoneEnrichedAt`. SQLite has no enums in Prisma, so the status is a string with named constants in the code.
- The statuses are `running`, `found`, `not_found`, and `failed`. `not_found` means each provider answered with no phone, or was skipped. `failed` means at least one provider failed after its retries and no provider found a phone, so a later run can still find data.
- The endpoint sets each lead to `running` before its workflow starts. If it did this after, a fast workflow could save its result first and then be overwritten.
- A lead that already has a phone is skipped, and the response counts it.
- The workflow ID is `enrich-phone-<leadId>`, with `workflowIdConflictPolicy: USE_EXISTING`. A repeated request joins the running workflow.
- Polling stops when no lead is running, or 2 minutes after the page load or the last start. A lead stays `running` if Temporal restarts, because Temporal keeps its state in memory here. The user can start enrichment again.
- To move email verification to this pattern, add the same kind of status and supersede ADR 0003.
