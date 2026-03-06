# Docket

Agent-native task and project management. No dashboard. Agents read/write via MCP, humans interact through Claude.

> "What's on the docket?"

## Architecture

```
                    ┌─────────────────┐
Claude Code ────────┤                 │
  agents    ────MCP─┤  MCP Server     │──HTTP──┐
                    │  (stdio)        │        │
Humans via  ────────┤                 │        ▼
  Claude    ────MCP─┤                 │  ┌───────────┐    ┌─────────────────┐
                    └─────────────────┘  │ CF Worker │───▶│ Durable Object  │
                                         │  (Hono)   │    │    (SQLite)     │
                    ┌─────────────────┐  │           │    ├─────────────────┤
                    │  Observer       │◀─┤           │    │ tasks           │
                    │  (cron, Claude  │  └───────────┘    │ projects        │
                    │   Haiku)        │──────────────────▶│ activity_log    │
                    └─────────────────┘                   │ observations    │
                                                          └─────────────────┘
```

All state lives in a single Durable Object. The observer runs every 6 hours, analyzes recent activity via Claude Haiku, and stores observations that agents can query for context.

See [docs/architecture.md](docs/architecture.md) for details.

## Quick Start

### 1. Install and build

```bash
npm install
cd mcp-server && npm run build && cd ..
```

### 2. Deploy the worker

```bash
cd worker
npx wrangler login
npx wrangler deploy
npx wrangler secret put API_TOKEN        # choose a strong token
npx wrangler secret put ANTHROPIC_API_KEY # for the observer
cd ..
```

### 3. Configure MCP in Claude Code

Create `.mcp.json` in your project root (or `~/.claude/.mcp.json` for global):

```json
{
  "mcpServers": {
    "docket": {
      "command": "node",
      "args": ["/path/to/docket/mcp-server/dist/index.js"],
      "env": {
        "DOCKET_WORKER_URL": "https://docket.YOUR-SUBDOMAIN.workers.dev",
        "DOCKET_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

Restart Claude Code. You'll have access to: `create_task`, `update_task`, `list_tasks`, `get_task`, `create_project`, `update_project`, `list_projects`, `get_project`, `query`, and `get_context`.

### 4. Local development

```bash
# Create worker/.dev.vars with:
# API_TOKEN=dev-token-123

cd worker && npm run dev   # starts on http://localhost:8787
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `create_task` | Create a task with title, description, priority, tags, etc. |
| `update_task` | Update any task field by ID |
| `list_tasks` | List tasks with optional filters (status, assignee, project, customer) |
| `get_task` | Get a task by ID, including its sub-tasks |
| `create_project` | Create a project |
| `update_project` | Update a project by ID |
| `list_projects` | List projects with optional filters |
| `get_project` | Get a project by ID with task counts by status |
| `query` | Run read-only SQL against the database |
| `get_context` | Get recent observations and activity (call before deciding what to work on) |

## Development

```bash
npm run check    # lint + typecheck + structural tests
npm run lint:fix # auto-fix lint issues
npm run test     # run tests
```

Structural tests enforce: files under 300 lines, no `any` types, no default exports, required docs exist, append-only tables stay append-only.

## Design Decisions

- **No UI** — the interface is conversational. Ask Claude.
- **Single Durable Object** — one SQLite DB, one source of truth. Scale isn't a concern for a team task tracker.
- **Append-only logs** — activity_log and observations are never deleted. They're the raw material for the observer.
- **Free-form strings** — no user management. Assignee, owner, customer are just strings.
- **Raw SQL query tool** — trust the agents. Read-only enforced at the API level.

## License

MIT
