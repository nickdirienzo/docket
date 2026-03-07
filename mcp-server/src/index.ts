#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const WORKER_URL = process.env.DOCKET_WORKER_URL ?? "http://localhost:8787";
const API_TOKEN = process.env.DOCKET_API_TOKEN ?? "";

async function api(method: string, path: string, body?: unknown): Promise<unknown> {
	const url = `${WORKER_URL}${path}`;
	const res = await fetch(url, {
		method,
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${API_TOKEN}`,
		},
		body: body ? JSON.stringify(body) : undefined,
	});

	const data = await res.json();
	if (!res.ok) {
		const errorMsg = (data as { error?: string }).error ?? res.statusText;
		throw new Error(`API error ${res.status}: ${errorMsg}`);
	}
	return data;
}

async function apiWithActivity(
	toolName: string,
	input: unknown,
	fn: () => Promise<unknown>,
	agentId?: string,
): Promise<unknown> {
	const output = await fn();
	// Fire and forget activity logging
	api("POST", "/activity", {
		tool_name: toolName,
		input,
		output,
		agent_id: agentId,
	}).catch(() => {});
	return output;
}

const server = new McpServer({
	name: "docket",
	version: "0.1.0",
});

// --- Task tools ---

server.tool(
	"create_task",
	"Create a new task",
	{
		title: z.string().describe("Task title (required)"),
		summary: z
			.string()
			.optional()
			.describe("Brief one-line summary of current task state or progress"),
		description: z.string().optional().describe("Task description"),
		status: z
			.enum(["not_started", "in_progress", "done", "archived"])
			.optional()
			.describe("Task status"),
		priority: z
			.enum(["backlog", "low", "medium", "high", "urgent"])
			.optional()
			.describe("Task priority"),
		assignee: z.string().optional().describe("Assignee name"),
		tags: z.array(z.string()).optional().describe("Tags"),
		estimate: z.number().optional().describe("Story points (1, 2, 3, 5, 8)"),
		project_id: z.string().optional().describe("Project ID"),
		parent_task_id: z.string().optional().describe("Parent task ID for sub-tasks"),
		customer: z.string().optional().describe("Customer name"),
		pr_url: z.string().optional().describe("Pull request URL"),
		due_date: z.string().optional().describe("Due date (ISO-8601)"),
	},
	async (input) => {
		const result = await apiWithActivity("create_task", input, () => api("POST", "/tasks", input));
		return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
	},
);

server.tool(
	"update_task",
	"Update an existing task",
	{
		id: z.string().describe("Task ID"),
		title: z.string().optional(),
		summary: z
			.string()
			.optional()
			.describe("Brief one-line summary of current task state or progress"),
		description: z.string().optional(),
		status: z.enum(["not_started", "in_progress", "done", "archived"]).optional(),
		priority: z.enum(["backlog", "low", "medium", "high", "urgent"]).optional(),
		assignee: z.string().optional(),
		tags: z.array(z.string()).optional(),
		estimate: z.number().optional(),
		project_id: z.string().optional(),
		parent_task_id: z.string().optional(),
		customer: z.string().optional(),
		pr_url: z.string().optional(),
		due_date: z.string().optional(),
	},
	async (input) => {
		const { id, ...updates } = input;
		const result = await apiWithActivity("update_task", input, () =>
			api("PATCH", `/tasks/${id}`, updates),
		);
		return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
	},
);

server.tool(
	"list_tasks",
	"List tasks with optional filters",
	{
		status: z.enum(["not_started", "in_progress", "done", "archived"]).optional(),
		assignee: z.string().optional(),
		project_id: z.string().optional(),
		customer: z.string().optional(),
		tags: z
			.array(z.string())
			.optional()
			.describe("Filter by one or more tag values (e.g. ['phase-1', 'backend'])"),
	},
	async (input) => {
		const params = new URLSearchParams();
		const { tags, ...rest } = input;
		for (const [k, v] of Object.entries(rest)) {
			if (v) params.set(k, v as string);
		}
		if (tags && tags.length > 0) {
			for (const tag of tags) params.append("tag", tag);
		}
		const qs = params.toString();
		const path = qs ? `/tasks?${qs}` : "/tasks";
		const result = await apiWithActivity("list_tasks", input, () => api("GET", path));
		return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
	},
);

server.tool(
	"get_task",
	"Get a task by ID, including sub-tasks",
	{ id: z.string() },
	async (input) => {
		const result = await apiWithActivity("get_task", input, () => api("GET", `/tasks/${input.id}`));
		return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
	},
);

// --- Project tools ---

server.tool(
	"create_project",
	"Create a new project",
	{
		name: z.string().describe("Project name (required)"),
		description: z.string().optional(),
		status: z
			.enum(["backlog", "scoping", "planning", "in_progress", "paused", "done", "canceled"])
			.optional(),
		priority: z.enum(["low", "medium", "high"]).optional(),
		owner: z.string().optional(),
		customer: z.string().optional(),
	},
	async (input) => {
		const result = await apiWithActivity("create_project", input, () =>
			api("POST", "/projects", input),
		);
		return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
	},
);

server.tool(
	"update_project",
	"Update an existing project",
	{
		id: z.string(),
		name: z.string().optional(),
		description: z.string().optional(),
		status: z
			.enum(["backlog", "scoping", "planning", "in_progress", "paused", "done", "canceled"])
			.optional(),
		priority: z.enum(["low", "medium", "high"]).optional(),
		owner: z.string().optional(),
		customer: z.string().optional(),
	},
	async (input) => {
		const { id, ...updates } = input;
		const result = await apiWithActivity("update_project", input, () =>
			api("PATCH", `/projects/${id}`, updates),
		);
		return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
	},
);

server.tool(
	"list_projects",
	"List projects with optional filters",
	{
		status: z
			.enum(["backlog", "scoping", "planning", "in_progress", "paused", "done", "canceled"])
			.optional(),
		owner: z.string().optional(),
		customer: z.string().optional(),
	},
	async (input) => {
		const params = new URLSearchParams();
		for (const [k, v] of Object.entries(input)) {
			if (v) params.set(k, v);
		}
		const qs = params.toString();
		const path = qs ? `/projects?${qs}` : "/projects";
		const result = await apiWithActivity("list_projects", input, () => api("GET", path));
		return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
	},
);

server.tool(
	"get_project",
	"Get a project by ID, including task counts by status",
	{ id: z.string() },
	async (input) => {
		const result = await apiWithActivity("get_project", input, () =>
			api("GET", `/projects/${input.id}`),
		);
		return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
	},
);

// --- Query ---

server.tool(
	"query",
	"Execute a read-only SQL query (SELECT only)",
	{ sql: z.string().describe("SQL query (SELECT only)") },
	async (input) => {
		const result = await apiWithActivity("query", input, () =>
			api("POST", "/query", { sql: input.sql }),
		);
		return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
	},
);

// --- Context ---

server.tool(
	"get_context",
	"Get recent observations and activity summary. Call this to understand what's going on before deciding what to work on.",
	{},
	async () => {
		const result = await api("GET", "/context");
		return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
	},
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
