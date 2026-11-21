# 03: Add phone, years at company, and LinkedIn fields

**What to build:** A lead has three new optional fields: phone number, years at current company, and LinkedIn profile URL. Users can see them in the leads table, set them through CSV import, and use them in message templates. The example CSV files already contain `phoneNumber` and `yearsInRole` columns. Today the app ignores these columns.

The message composition UX must keep working as the field list grows. Today the backend and the frontend each have their own hard-coded field list, and the modal shows one button for each field. Make one list the source of truth for the fields a template can use. Replace the fixed button row with a picker that scales, for example a searchable list.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

Data, API, and table:

- [ ] A new migration adds the three fields. Existing leads keep their data, and the new fields are empty.
- [ ] The API returns the new fields on every endpoint that returns a lead.
- [ ] The leads table shows the three fields, with a placeholder when a value is empty.
- [ ] The frontend lead types include the new fields. This fixes the existing TS2741 build error on the optimistic lead. Remove that entry from the known failures in CLAUDE.md.

CSV import:

- [ ] CSV import maps the phone, years-at-company, and LinkedIn columns. It accepts the header aliases in the example files (`phoneNumber`, `yearsInRole`).
- [ ] The import preview flags a non-numeric or negative years value and a malformed LinkedIn URL. The row still imports without the bad value.

Message composition:

- [ ] One list defines the template fields. The message generator and the composition modal both use it.
- [ ] Each field has a human-readable label, separate from its template key.
- [ ] Users can find and insert a field by searching its label or key.
- [ ] The three new fields work in templates and in generated messages.
- [ ] An unknown field or an empty value still gives a clear error for each lead.
- [ ] To add a new template field, a developer changes only the field list and the lead data.

Tests:

- [ ] Unit tests cover CSV mapping and validation for the new fields.
- [ ] Tests cover the message generator with the new fields and the field-list lookup.
