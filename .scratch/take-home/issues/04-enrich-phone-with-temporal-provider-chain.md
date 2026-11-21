# 04: Enrich phone with a Temporal provider chain

**What to build:** A user selects leads and starts "Enrich phone". For each lead, a Temporal workflow calls three providers in order and stops at the first phone it finds:

1. Orion Connect: best data, but slow and sometimes fails.
2. Astra Dialer: fastest, but the worst data.
3. Nimbus Lookup: new provider.

If no provider finds a phone, the lead is marked "No data found". The user sees the progress and the result on each lead. Provider details (URLs, auth, request and response shapes) are in the README.

**Blocked by:** 03 (needs the phone field)

**Status:** ready-for-agent

- [ ] One provider interface hides the request, auth, and response differences between the providers. Each provider maps its response to one normalized phone result.
- [ ] Each provider call is a separate activity with a short timeout and a retry policy (for example, 3 attempts with exponential backoff).
- [ ] The workflow stops after the first provider that returns a phone.
- [ ] When all three providers return no phone, the lead status is "No data found".
- [ ] A provider that fails after all retries does not stop the chain. The workflow continues to the next provider.
- [ ] The workflow is idempotent, with one workflow for each lead and a deterministic ID. A repeated request for a lead that is already running does not start a second workflow.
- [ ] The lead stores an enrichment status (for example: running, found, not found, failed) and, when found, the phone and the provider that found it.
- [ ] The UI has an "Enrich phone" action and shows the status for each lead while the workflow runs. The user does not have to reload the page.
- [ ] Provider credentials come from configuration, not from source code.
- [ ] Tests cover the response mapping for each provider and the workflow paths: first-hit stop, fallback, all-empty, and provider failure.
- [ ] Nice to have: each provider has its own rate limit, so a bulk enrichment respects future RPS/RPM limits. Leave the limit unset by default.
