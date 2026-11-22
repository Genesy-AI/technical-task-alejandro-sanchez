# Accept LinkedIn profile URLs only, in one canonical form

The LinkedIn field holds a person's profile, and messages insert it as a link (ticket 03). We accept only person profiles: an `http` or `https` URL on `linkedin.com` or one of its subdomains, with the path `/in/<slug>`. We store each one as `https://www.linkedin.com/in/<slug>`, without the query, the fragment, or a trailing slash. Any other value is dropped with a warning, as in ADR 0002.

## Considered options

- **Any `linkedin.com` URL (rejected).** Fewer warnings, but company pages and posts would reach templates as if they were a person.
- **Any `http(s)` URL (rejected).** Almost no check, so a malformed or wrong value would still reach messages.

## Consequences

- Company pages, posts, sub-pages such as `/in/<slug>/details`, and other schemes such as `ftp:` are rejected.
- The domain check matches `linkedin.com` and its subdomains only. Look-alike hosts such as `linkedin.com.evil.example` are rejected.
- Stored values are already in canonical form. To accept more URL types later, change the check in both apps. Existing data needs no change.
