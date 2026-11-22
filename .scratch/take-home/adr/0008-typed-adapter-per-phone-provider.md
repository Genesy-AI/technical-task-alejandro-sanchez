# One typed adapter for each phone provider, with one shared HTTP runner

The three phone providers differ in auth, input, and response shape, and the live responses do not match the README (ticket 04). For example, Nimbus returns `{ phoneNmbr: number, countryCode }`, not `{ number, countryCode }`. Each provider is a small adapter with a pure `buildRequest(lead, apiKey)` and a pure `parseResponse(body: unknown)`. One shared runner does the `fetch`, the timeout, the auth secret, and the error types. An ordered registry lists the providers, and the workflow knows only the normalized result: found, not found, or skipped.

## Considered options

- **Declarative config with one generic engine (rejected).** Less code for each provider. But Nimbus already needs a type conversion and a second field, so the config would grow into a small language with weak types.
- **A base class with one subclass for each provider (rejected).** The same result as adapters, with inheritance and `this` state for no gain. The repo uses functions and interfaces.
- **One hand-written activity for each provider (rejected).** The least code, but the timeouts, error rules, and secret reads would be copied three times.

## Consequences

- Adapters parse the body as `unknown` and accept only the shapes they know. Each live shape has a test. A body that an adapter does not accept is not retried.
- The runner retries a 5xx, a 429, a timeout, or a network error. It does not retry a 400, a 401, or another 4xx, and the workflow goes to the next provider.
- An adapter can skip a call when the lead does not have the input: Nimbus with no job title, and Orion with a free-mail email. Orion needs `companyWebsite`, and the lead has only a company name. The adapter uses the domain of the lead's email, from a named list of free-mail domains.
- To add a provider, add one adapter file and one registry entry with its activity name, task queue, and limits (see ADR 0009).
