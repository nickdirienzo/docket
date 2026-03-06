# Conventions

## TypeScript

- Strict mode (`strict: true` in tsconfig)
- No `any` — use `unknown` and narrow
- Named exports only (no default exports)
- Files under 300 lines
- snake_case for database columns and API fields
- camelCase for TypeScript variables and functions
- PascalCase for types and classes

## API

- REST endpoints use snake_case for JSON fields
- All mutations return the created/updated resource
- Error responses: `{ error: string, details?: string }`
- HTTP status codes: 200 (ok), 201 (created), 400 (bad input), 401 (unauthorized), 404 (not found), 500 (server error)

## SQL

- Table names are snake_case, plural (tasks, projects, activity_log, observations)
- Primary keys are `id TEXT` containing ULIDs
- Timestamps are `TEXT` containing ISO-8601 UTC strings
- JSON fields stored as `TEXT` (e.g. tags, source_ids)
- Foreign keys use `_id` suffix (e.g. project_id, parent_task_id)

## Testing

- Unit tests co-located: `foo.ts` -> `foo.test.ts`
- Structural tests in `tests/` enforce architecture rules
- Test names describe behavior: `it("returns 404 when task does not exist")`

## Git

- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- One logical change per commit
