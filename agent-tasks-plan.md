# Docket

**Status:** Planning
**Repo:** github.com/nickdirienzo/docket
**Goal:** Open-source, agent-native task/project management. No dashboard. Agents read/write via MCP, humans interact through Claude + gws (Gmail/Chat/Calendar). "What's on the docket?"

## Architecture

```
Claude Code agents (MCP)──┐
                          ├──→ MCP Server ──→ CF Worker + Durable Object (SQLite)
Humans via Claude (MCP)───┘                        │
        │                                          ├── tasks
        ↓                                          ├── projects
   gws MCP (notifications)                         ├── activity_log
   Gmail / Chat / Calendar                         └── observations
                                                         ↑
                                                   Observer (cron)
                                                   Claude API call
```

## Repo Structure

```
docket/
├── worker/                     # Cloudflare Worker + Durable Object
│   ├── src/
│   │   ├── index.ts            # Hono router
│   │   ├── TaskStore.ts        # Durable Object class
│   │   └── schema.sql          # DDL for all tables
│   ├── wrangler.toml
│   └── package.json
├── mcp-server/                 # MCP server (stdio transport)
│   ├── src/
│   │   └── index.ts            # Tool definitions
│   └── package.json
└── README.md
```

## Schema

### tasks
```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,           -- ulid
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'not_started',
    -- not_started | in_progress | done | archived
  priority TEXT,                 -- backlog | low | medium | high | urgent
  assignee TEXT,                 -- free-form, agent name or human name
  tags TEXT,                     -- JSON array of strings
  estimate INTEGER,              -- story points (1, 2, 3, 5, 8)
  project_id TEXT REFERENCES projects(id),
  parent_task_id TEXT REFERENCES tasks(id),
  customer TEXT,                 -- free-form customer name
  pr_url TEXT,                   -- linked pull request
  due_date TEXT,                 -- ISO-8601 date
  created_at TEXT NOT NULL,      -- ISO-8601 datetime
  updated_at TEXT NOT NULL       -- ISO-8601 datetime
);
```

### projects
```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,           -- ulid
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'backlog',
    -- backlog | scoping | planning | in_progress | paused | done | canceled
  priority TEXT,                 -- low | medium | high
  owner TEXT,                    -- free-form
  customer TEXT,                 -- free-form
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### activity_log
```sql
CREATE TABLE activity_log (
  id TEXT PRIMARY KEY,           -- ulid
  tool_name TEXT NOT NULL,       -- e.g. "create_task", "update_task"
  input TEXT NOT NULL,           -- JSON of the MCP tool input
  output TEXT,                   -- JSON of the result
  agent_id TEXT,                 -- which agent made the call
  created_at TEXT NOT NULL
);
```

### observations
```sql
CREATE TABLE observations (
  id TEXT PRIMARY KEY,           -- ulid
  content TEXT NOT NULL,         -- the observation text
  type TEXT NOT NULL,            -- observation | reflection
  source_ids TEXT,               -- JSON array of activity_log or observation IDs
  created_at TEXT NOT NULL
);
```

## MCP Tools

### Task CRUD
- `create_task` — title, description, status, priority, assignee, tags, estimate, project_id, parent_task_id, customer, due_date
- `update_task` — id + any fields to update
- `list_tasks` — optional filters: status, assignee, project_id, tags, customer
- `get_task` — by id, includes sub-tasks

### Project CRUD
- `create_project` — name, description, status, priority, owner, customer
- `update_project` — id + any fields to update
- `list_projects` — optional filters: status, owner, customer
- `get_project` — by id, includes task summary (counts by status)

### Query
- `query` — raw SQL for ad-hoc queries. Read-only (SELECT only).

### Context
- `get_context` — returns recent observations + activity summary. This is what an agent calls to understand "what's going on" before deciding what to work on.

## Worker API

Simple REST, authenticated with a single `Authorization: Bearer <token>` header.

```
POST   /tasks              — create
GET    /tasks               — list (query params for filters)
GET    /tasks/:id           — get
PATCH  /tasks/:id           — update
POST   /projects            — create
GET    /projects             — list
GET    /projects/:id         — get
PATCH  /projects/:id         — update
POST   /query               — { sql: "SELECT ..." }
GET    /context              — recent observations + activity
POST   /activity             — log an activity (called by MCP server)
POST   /observe              — trigger observer run (called by cron)
```

All state lives in a single Durable Object. Routing is just `env.TASK_STORE.get(env.TASK_STORE.idFromName("global"))`.

## Observer (v1)

CF Cron Trigger (daily, or every few hours):

1. Hits `POST /observe` on the Worker
2. Worker reads last N activity_log entries since last observation
3. Worker calls Claude API (`messages.create`) with:
   - System: "You are an observer agent. Analyze recent task activity and produce concise observations about patterns, blockers, velocity, and relationships."
   - User: the activity log entries
4. Claude response gets stored in `observations` table
5. Every ~10 observations, trigger a reflection pass that compresses observations into higher-level reflections

The Claude API key is a Worker secret (`wrangler secret put ANTHROPIC_API_KEY`).

## Phases

### Phase 1: Task Store (ship in a day)
- [ ] CF Worker + DO with schema
- [ ] REST API for tasks + projects
- [ ] MCP server with CRUD tools + query tool
- [ ] Activity logging on every MCP call
- [ ] README with setup instructions
- [ ] Deploy to CF, configure MCP in Claude Code

### Phase 2: Observer (ship in a day)
- [ ] `observations` table
- [ ] `POST /observe` endpoint with Claude API call
- [ ] CF Cron Trigger
- [ ] `get_context` MCP tool
- [ ] Reflection pass (compress observations)

### Phase 3: Polish for OSS
- [ ] Clean README with architecture diagram
- [ ] Example MCP config for Claude Code
- [ ] Example gws integration (notifications via Gmail/Chat)
- [ ] MIT license

### Phase 4: Learn from usage
- Observer identifies missing tools → add them
- Observer identifies unused fields → drop them
- Consider: observer suggests schema migrations?
- Consider: observer auto-creates tasks from patterns?

## Design Decisions

1. **Single Durable Object, not per-project** — keeps it simple. One SQLite DB, one source of truth. Scale isn't a concern for a team task tracker.

2. **Free-form strings for assignee/customer/owner** — no user management. Just names. Agents write whatever makes sense.

3. **Activity log is append-only** — never delete. This is the raw material for the observer.

4. **Observations are also append-only** — reflections compress but don't delete observations.

5. **Raw SQL query tool** — trust the agents. Read-only enforced at the API level. This avoids building a filter for every possible query shape.

6. **Auth is a single API key** — this is a personal/small-team tool. No OAuth, no RBAC. Add it later if the OSS project needs it.

7. **No UI** — if you want to see tasks, ask Claude. The whole point is that the interface is conversational.
