# Store phone numbers as trimmed text, with no format check

The example CSV files have phone numbers in many formats, for example `+1-280-754-0462x2154`, `(731)123-9702`, and `063.430.8860x4762` (ticket 03). Most have no country code, and some have extensions. We store the trimmed text as it is, with no format check. A correct conversion to E.164 needs the country of each number and a phone library, and the import has neither. A guessed conversion would change real numbers without any warning.

## Consequences

- Phone numbers in the database are not in one format. Do not compare or deduplicate them as strings.
- Ticket 04 adds phone numbers from providers. That is the place to decide on one format, for example E.164 with `libphonenumber-js`. A backfill of the imported numbers can follow.
