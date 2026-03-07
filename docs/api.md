# Worker API

Base URL: configured per environment. Auth: `Authorization: Bearer <token>`.

## Tasks

| Method | Path | Description |
|--------|------|-------------|
| POST | /tasks | Create a task |
| GET | /tasks | List tasks (query params: status, assignee, project_id, tags, customer) |
| GET | /tasks/:id | Get task by ID (includes sub-tasks) |
| PATCH | /tasks/:id | Update task fields |

### Create Task (POST /tasks)
```json
{
  "title": "string (required)",
  "description": "string",
  "status": "not_started | in_progress | done | archived",
  "priority": "backlog | low | medium | high | urgent",
  "assignee": "string",
  "tags": ["string"],

  "project_id": "ulid",
  "parent_task_id": "ulid",
  "customer": "string",
  "pr_url": "string",
  "due_date": "ISO-8601 date"
}
```

## Projects

| Method | Path | Description |
|--------|------|-------------|
| POST | /projects | Create a project |
| GET | /projects | List projects (query params: status, owner, customer) |
| GET | /projects/:id | Get project by ID (includes task counts by status) |
| PATCH | /projects/:id | Update project fields |

### Create Project (POST /projects)
```json
{
  "name": "string (required)",
  "description": "string",
  "status": "backlog | scoping | planning | in_progress | paused | done | canceled",
  "priority": "low | medium | high",
  "owner": "string",
  "customer": "string"
}
```

## Query

| Method | Path | Description |
|--------|------|-------------|
| POST | /query | Execute read-only SQL |

```json
{ "sql": "SELECT ... (no mutations allowed)" }
```

## Context

| Method | Path | Description |
|--------|------|-------------|
| GET | /context | Recent observations + activity summary |

## Activity

| Method | Path | Description |
|--------|------|-------------|
| POST | /activity | Log an activity (called by MCP server) |

## Observer

| Method | Path | Description |
|--------|------|-------------|
| POST | /observe | Trigger observer run (called by cron) |
