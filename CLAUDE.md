# CLAUDE.md

TinyEnginy: a leads app. Express + Prisma (SQLite) + Temporal in `backend/`, React + Vite + TanStack Query in `frontend/`.

## Environment

- mise supplies Node, pnpm, and the Temporal CLI. See `mise.toml`.
- `mise run dev` starts Temporal, the backend (:4000), and the frontend (:5173).
- `mise run db` applies Prisma migrations and generates the client.
- `backend/` and `frontend/` are separate pnpm projects. Run `pnpm` commands inside the app directory.
- Temporal keeps its state in memory. A restart clears all workflow history.

## Change a lead field

The frontend types do not come from Prisma. They are a manual copy. A lead field change must touch all of these:

1. `backend/prisma/schema.prisma`, then `pnpm migrate:dev --name <change>` in `backend/`.
2. The routes in `backend/src/index.ts` that read or write the field.
3. `backend/src/utils/messageGenerator.ts` if the field is usable in messages.
4. `frontend/src/api/types/leads/*.ts` for each endpoint that sends or returns the field.
5. `frontend/src/utils/csvParser.ts` if the field comes from CSV import.
6. The components in `frontend/src/components/` that show or edit the field.

Add a new migration for each schema change. Leave existing migration files unchanged.

## Frontend API layer

Each endpoint has one type file and one entry:

- Types: `frontend/src/api/types/leads/<operation>.ts` exports `<Name>Input` and `<Name>Output`.
- Entry: `frontend/src/api/modules/leads.ts` declares it with `endpoint<Output, Input>(method, path)`.
- Mutations with cache updates go in `frontend/src/api/mutations/useApiMutation.ts`.

Make sure the HTTP method matches the backend route.

## Temporal

- Workflow code runs in a deterministic sandbox. Put all I/O, network calls, randomness, and clock reads in activities.
- Export new workflows from `backend/src/workflows/index.ts` and new activities from `backend/src/workflows/activities/index.ts`. The worker loads only these barrels.
- Give each `proxyActivities` call an explicit timeout and retry policy.
- Use a deterministic `workflowId` (for example `enrich-phone-<leadId>`) to get one workflow per lead.
- The worker uses task queue `myQueue` on `localhost:7233`. Clients must use the same values.

## Database

`backend/prisma/dev.db` is committed with 25 seed leads.

Warning: stop the backend before you restore or replace `dev.db`. Prisma keeps the old file open, so the app shows stale data until a restart.

To reset the data: stop `mise run dev`, run `git restore backend/prisma/dev.db`, then start it again.

## TypeScript conventions

Apply these to new and changed code. Leave unrelated code as it is.

- **Clarity:** use chained array methods (`map`, `filter`, `reduce`) instead of loops. Use a ternary only for a single-line condition. Use `if/else` for all other branches.
- **Early returns:** put guard clauses at the top. Put the happy path last.
- **Names:** name the intent. Booleans read as questions (`isVerified`, `hasPhone`). Functions start with a verb (`enrichPhone`). Give each magic number or string a named constant.
- **Single responsibility:** one function does one thing. Keep functions below 20 lines. Extract validation, side effects, and provider calls into named helpers.
- **Types:** use `unknown` and narrow it for untyped data, such as request bodies and provider responses. `any` is not permitted in new code. Declare return types on exported functions. Use `interface` for object shapes and `type` for unions and aliases.
- **Comments:** explain why, not what. Add a JSDoc block with `@param`, `@returns`, `@throws`, and `@example` to each exported function, class, and type.

For before/after examples, load the `typescript-conventions` skill when it is available.

## Formatting

Run Prettier only on the files you changed: `pnpm prettier --write <files>`. `pnpm format` reformats the full app, and some existing files do not follow the config. The result is unrelated diff noise.

## Done

A change is done when all of these pass in each app you touched:

1. `pnpm vitest run`. New logic has a test in a `*.test.ts` file next to the source.
2. `pnpm build`. This is the type check. Your change must add no new errors.

Known failures from before your change (remove each line when it is fixed):

- Frontend `pnpm lint` does not run. ESLint 9 needs a flat config, and the app has only `.eslintrc.cjs`.

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default role names are written as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
