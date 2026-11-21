# The backend owns the template field list

The message generator and the composition modal each had a hard-coded list of template fields, and the two lists could drift (ticket 03). The backend now owns the only list. Each field has a key, a readable label, and a function that reads its value from a lead. `GET /leads/template-fields` sends the key and the label, and the modal fetches them once (`staleTime: Infinity`). A new template field needs a schema change and one list entry, with no frontend change.

## Considered options

- **A shared folder imported by both apps (rejected).** One list at build time, with no request. It needs Vite `server.fs.allow`, a backend `rootDir` change, and changes to both test configs. That is too much build risk for one list.
- **A list in each app and a contract test (rejected).** Simple, but it is two sources of truth. The ticket asked for one.

## Consequences

- The modal has a loading state and an error state for the field list. If the fetch fails, the user can still type a template by hand.
- Declare `GET /leads/template-fields` before `GET /leads/:id`. If you do not, Express sends the request to the `:id` route.
- A template key is always the name of a lead property, for example `{phoneNumber}`. Do not add a key with no lead property behind it.
