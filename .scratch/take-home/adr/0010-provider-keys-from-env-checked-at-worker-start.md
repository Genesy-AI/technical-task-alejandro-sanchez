# Read provider keys from the environment, and stop the worker when one is missing

Phone provider keys and endpoint URLs come from environment variables, not from source code (ticket 04). Locally they are in `backend/.env`, which git ignores, and `backend/.env.sample` lists the names. A config module checks all of them when the worker starts. If one is missing, the worker does not start, and the error names the variable. We chose to stop at start because a missing key found later would only show as each lead failing, with no clear cause.

## Consequences

- Warning: the backend process exits when a key or URL is missing, because the worker runs inside it. Create `backend/.env` from `.env.sample` before you start the backend.
- The backend `dev` and `start` scripts and the mise `dev` task all run node with `--env-file-if-exists=.env`. No new dependency is needed, and Node 22.9 or later is required.
- Only activity code reads the keys. Never pass a key as a workflow or activity argument: Temporal stores arguments as plain text in its history, and the Temporal UI shows them.
- The runner removes the key from every URL and error message, because Nimbus sends its key in the query string.
- Error messages name variables, never values.
- A rotated key needs a restart, not a release.
