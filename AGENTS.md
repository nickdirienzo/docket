# Docket — Agent Guide

Agent-native task/project management. No dashboard. Agents read/write via MCP, humans interact through Claude.

## Repo Map

```
docket/
  docs/           # Source of truth: architecture, schemas, conventions
  worker/         # Cloudflare Worker + Durable Object (Hono + SQLite)
  mcp-server/     # MCP server (stdio transport, calls worker API)
  slack-app/      # Slack bot: @docket mention handler + intake triage via Claude
  tests/          # Structural tests enforcing architecture rules
```

## Key Constraints

- **Dependency order**: Types -> Schema -> Worker -> MCP Server
- **Single Durable Object**: All state in one DO with SQLite. No sharding.
- **Append-only logs**: Never delete from `activity_log` or `observations`.
- **Read-only queries**: The `query` tool/endpoint only allows SELECT statements.
- **No UI**: The interface is conversational. No HTML, no dashboards.
- **Auth**: Single bearer token. No OAuth, no RBAC.

## Before You Code

1. Read `docs/architecture.md` for system boundaries
2. Read `docs/conventions.md` for naming and style rules
3. Run `npm run check` to validate before submitting — linter + type check + tests must pass
4. Keep files under 300 lines. Split if larger.

## Docs Pointers

| Topic | File |
|-------|------|
| Architecture & data flow | `docs/architecture.md` |
| SQL schema (source of truth) | `worker/src/schema.sql` |
| API contract | `docs/api.md` |
| Coding conventions | `docs/conventions.md` |
| MCP tool specs | `docs/mcp-tools.md` |
