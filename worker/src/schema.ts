/* eslint-disable -- schema is intentionally compact */
export const SCHEMA = [
	"CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, summary TEXT, description TEXT, status TEXT NOT NULL DEFAULT 'not_started', priority TEXT, assignee TEXT, tags TEXT, estimate INTEGER, project_id TEXT, parent_task_id TEXT, customer TEXT, pr_url TEXT, due_date TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
	"CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'backlog', priority TEXT, owner TEXT, customer TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
	"CREATE TABLE IF NOT EXISTS activity_log (id TEXT PRIMARY KEY, tool_name TEXT NOT NULL, input TEXT NOT NULL, output TEXT, agent_id TEXT, created_at TEXT NOT NULL)",
	"CREATE TABLE IF NOT EXISTS observations (id TEXT PRIMARY KEY, content TEXT NOT NULL, type TEXT NOT NULL, source_ids TEXT, created_at TEXT NOT NULL)",
].join(";");
