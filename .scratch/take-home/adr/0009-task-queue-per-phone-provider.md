# One activity and one task queue for each phone provider

The providers said they will add rate limits, and their speeds are very different: Orion takes about 4 seconds, and Astra takes less than 1 second (ticket 04). Each provider has its own activity (`lookupPhoneWithOrionConnect`, `lookupPhoneWithAstraDialer`, `lookupPhoneWithNimbusLookup`) on its own task queue, with its own timeout and retry policy. The worker process starts one Temporal worker for `myQueue` (workflows and the save activity), and one for each provider queue. They share one `NativeConnection`. A provider rate limit is one config value, applied as `maxTaskQueueActivitiesPerSecond` on that provider's worker. It is unset by default.

## Considered options

- **One generic `lookupPhone(providerId, lead)` activity (rejected).** One function. But the Temporal UI shows the same name for each call, and all providers share one set of options and one queue.
- **A token bucket in the worker process (rejected).** No Temporal changes, but the limit is wrong with more than one worker, and the count resets on restart.
- **Back off on a 429 (rejected as the only control).** The providers do not send 429 today. The runner still retries a 429, as ADR 0008 says.

## Consequences

| Provider | Task queue | Attempt timeout | Attempts |
|---|---|---|---|
| Orion Connect | `phone-orion-connect` | 6 s | 3 |
| Astra Dialer | `phone-astra-dialer` | 2 s | 3 |
| Nimbus Lookup | `phone-nimbus-lookup` | 4 s | 3 |

- The first retry waits 1 second, and the wait doubles each time. The full chain ends in about 45 seconds in the worst case.
- A provider queue with no running worker leaves its activity waiting, and the lead stays `running`. Start all the workers together.
- Nobody has confirmed yet that the Temporal server applies `maxTaskQueueActivitiesPerSecond` as expected. Test it before you depend on it.
