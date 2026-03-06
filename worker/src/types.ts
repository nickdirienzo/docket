import type { TaskStore } from "./TaskStore";

export interface Env {
	TASK_STORE: DurableObjectNamespace<TaskStore>;
	API_TOKEN: string;
	ANTHROPIC_API_KEY?: string;
	ANTHROPIC_OAUTH_TOKEN?: string;
	ENVIRONMENT: string;
}

export interface Task {
	id: string;
	title: string;
	description: string | null;
	status: "not_started" | "in_progress" | "done" | "archived";
	priority: "backlog" | "low" | "medium" | "high" | "urgent" | null;
	assignee: string | null;
	tags: string | null; // JSON array
	estimate: number | null;
	project_id: string | null;
	parent_task_id: string | null;
	customer: string | null;
	pr_url: string | null;
	due_date: string | null;
	created_at: string;
	updated_at: string;
}

export interface Project {
	id: string;
	name: string;
	description: string | null;
	status: "backlog" | "scoping" | "planning" | "in_progress" | "paused" | "done" | "canceled";
	priority: "low" | "medium" | "high" | null;
	owner: string | null;
	customer: string | null;
	created_at: string;
	updated_at: string;
}

export interface ActivityLogEntry {
	id: string;
	tool_name: string;
	input: string; // JSON
	output: string | null; // JSON
	agent_id: string | null;
	created_at: string;
}

export interface Observation {
	id: string;
	content: string;
	type: "observation" | "reflection";
	source_ids: string | null; // JSON array
	created_at: string;
}

export type TaskStatus = Task["status"];
export type TaskPriority = NonNullable<Task["priority"]>;
export type ProjectStatus = Project["status"];
export type ProjectPriority = NonNullable<Project["priority"]>;

export const TASK_STATUSES: readonly TaskStatus[] = [
	"not_started",
	"in_progress",
	"done",
	"archived",
] as const;

export const TASK_PRIORITIES: readonly TaskPriority[] = [
	"backlog",
	"low",
	"medium",
	"high",
	"urgent",
] as const;

export const PROJECT_STATUSES: readonly ProjectStatus[] = [
	"backlog",
	"scoping",
	"planning",
	"in_progress",
	"paused",
	"done",
	"canceled",
] as const;

export const VALID_ESTIMATES = [1, 2, 3, 5, 8] as const;
