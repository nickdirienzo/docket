# Architecture

## System Boundaries

```
Claude Code agents ──┐
                     ├──> MCP Server (stdio) ──> CF Worker ──> Durable Object (SQLite)
Humans via Claude ───┘         │                     │
                               │                     ├── tasks
                               │                     ├── projects
                               │                     ├── activity_log
                               │                     └── observations
                               │
                          gws MCP (future: Gmail/Chat/Calendar notifications)
```

## Components

### Worker (`worker/`)
- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Storage**: Single Durable Object with SQLite
- **Auth**: Bearer token (`Authorization: Bearer <token>`)
- **Routing**: All requests forwarded to one DO via `env.TASK_STORE.idFromName("global")`

### MCP Server (`mcp-server/`)
- **Transport**: stdio (for Claude Code integration)
- **Role**: Translates MCP tool calls into Worker REST API calls
- **State**: Stateless. All persistence is in the Worker.

### Observer (Phase 2)
- **Trigger**: CF Cron Trigger (configurable interval)
- **Flow**: Read activity_log -> Claude API summarize -> store observations
- **Reflections**: Every ~10 observations, compress into higher-level reflections

## Data Flow

1. Agent/human invokes MCP tool (e.g. `create_task`)
2. MCP server sends HTTP request to Worker
3. Worker routes to Durable Object
4. DO executes SQL, logs activity, returns result
5. MCP server returns structured result to caller

## Invariants

- All IDs are ULIDs (time-sortable, unique)
- All timestamps are ISO-8601 UTC
- All responses are JSON
- Activity log captures every mutation (tool name, input, output, agent ID)
- Schema migrations are additive only (no dropping columns in production)
