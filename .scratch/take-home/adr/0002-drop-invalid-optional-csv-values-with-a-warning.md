# Drop invalid optional CSV values with a warning

When a CSV row has an invalid value in an optional field, the lead still imports without that value, and the preview shows a warning for the row. A warning is a separate list from the row's errors, and it does not make the row invalid. Errors are only for required fields (first name, last name, email), and they still block the row. We chose this because one bad optional value must not cost the user a full lead.

The CSV parser checks values for the preview. The bulk import endpoint checks them again and is the final authority, because a client can call the API directly.

## Considered options

- **Mark the row invalid (rejected).** The data stays strict, but a bad country code would block a lead with a good name and email.
- **Check in the frontend only (rejected).** The UX is good, but a direct API call can still save bad data.
- **Check in the backend only (rejected).** It is safe, but the user sees the problem only after the import.

## Consequences

- The preview removes bad values before it sends the request. The server's dropped count is therefore almost always 0 from the UI, so the success toast adds the preview's count to the server's count.
- Ticket 03 uses the same rule for phone, years at company, and LinkedIn URL.
