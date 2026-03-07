import { DurableObject } from "cloudflare:workers";
import { SCHEMA } from "./schema";
import type { ActivityLogEntry, Env, Project, Task } from "./types";
import { PROJECT_STATUSES, TASK_PRIORITIES, TASK_STATUSES } from "./types";
import { ulid } from "./ulid";
import {
	asStringOrNull,
	buildWhere,
	validatedEnum,
	validatedEnumOrNull,
	validatedEstimate,
} from "./validate";

type SqlRow = Record<string, SqlStorageValue>;

export class TaskStore extends DurableObject<Env> {
	private initialized = false;

	private ensureSchema(): void {
		if (this.initialized) return;
		this.ctx.storage.sql.exec(SCHEMA);
		try {
			this.ctx.storage.sql.exec("ALTER TABLE tasks ADD COLUMN summary TEXT");
		} catch {}
		this.initialized = true;
	}

	private q(sql: string, ...params: unknown[]): SqlRow[] {
		this.ensureSchema();
		return [...this.ctx.storage.sql.exec<SqlRow>(sql, ...params)];
	}

	createTask(input: Record<string, unknown>): Task {
		this.ensureSchema();
		const title = input.title;
		if (typeof title !== "string" || title.trim() === "") {
			throw new Error("title is required");
		}
		const now = new Date().toISOString();
		const task: Task = {
			id: ulid(),
			title: title.trim(),
			summary: asStringOrNull(input.summary),
			description: asStringOrNull(input.description),
			status: validatedEnum(input.status, TASK_STATUSES, "not_started"),
			priority: validatedEnumOrNull(input.priority, TASK_PRIORITIES),
			assignee: asStringOrNull(input.assignee),
			tags: input.tags ? JSON.stringify(input.tags) : null,
			estimate: validatedEstimate(input.estimate),
			project_id: asStringOrNull(input.project_id),
			parent_task_id: asStringOrNull(input.parent_task_id),
			customer: asStringOrNull(input.customer),
			pr_url: asStringOrNull(input.pr_url),
			due_date: asStringOrNull(input.due_date),
			created_at: now,
			updated_at: now,
		};
		this.ctx.storage.sql.exec(
			`INSERT INTO tasks (id,title,summary,description,status,priority,assignee,tags,estimate,project_id,parent_task_id,customer,pr_url,due_date,created_at,updated_at)
			 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			task.id,
			task.title,
			task.summary,
			task.description,
			task.status,
			task.priority,
			task.assignee,
			task.tags,
			task.estimate,
			task.project_id,
			task.parent_task_id,
			task.customer,
			task.pr_url,
			task.due_date,
			task.created_at,
			task.updated_at,
		);
		return task;
	}

	getTask(id: string): (Task & { sub_tasks: Task[] }) | null {
		const task = this.q("SELECT * FROM tasks WHERE id = ?", id)[0] as Task | undefined;
		if (!task) return null;
		const sub_tasks = this.q(
			"SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY created_at",
			id,
		) as unknown as Task[];
		return { ...task, sub_tasks };
	}

	listTasks(filters: Record<string, unknown>): Task[] {
		const { where, params } = buildWhere(filters, ["status", "assignee", "project_id", "customer"]);
		const allParams = [...params];
		let sql = `SELECT * FROM tasks ${where}`;
		const tagFilter = filters.tags;
		const tags: string[] = Array.isArray(tagFilter)
			? tagFilter.filter((t): t is string => typeof t === "string")
			: typeof tagFilter === "string"
				? [tagFilter]
				: [];
		if (tags.length > 0) {
			sql += `${where ? " AND" : " WHERE"} EXISTS (SELECT 1 FROM json_each(tags) WHERE value IN (${tags.map(() => "?").join(",")}))`;
			allParams.push(...tags);
		}
		sql += " ORDER BY created_at DESC";
		return this.q(sql, ...allParams) as unknown as Task[];
	}

	updateTask(id: string, updates: Record<string, unknown>): Task | null {
		this.ensureSchema();
		if (!this.getTask(id)) return null;
		const allowed = [
			"title",
			"summary",
			"description",
			"status",
			"priority",
			"assignee",
			"tags",
			"estimate",
			"project_id",
			"parent_task_id",
			"customer",
			"pr_url",
			"due_date",
		];
		const setClauses: string[] = [];
		const params: unknown[] = [];
		for (const key of allowed) {
			if (!(key in updates)) continue;
			let value = updates[key];
			if (key === "tags" && Array.isArray(value)) value = JSON.stringify(value);
			if (key === "status") validatedEnum(value, TASK_STATUSES, "not_started");
			if (key === "priority" && value != null) validatedEnumOrNull(value, TASK_PRIORITIES);
			if (key === "estimate" && value != null) validatedEstimate(value);
			setClauses.push(`${key} = ?`);
			params.push(value ?? null);
		}
		if (setClauses.length === 0) return this.getTask(id);
		setClauses.push("updated_at = ?");
		params.push(new Date().toISOString());
		params.push(id);
		this.ctx.storage.sql.exec(`UPDATE tasks SET ${setClauses.join(", ")} WHERE id = ?`, ...params);
		return this.getTask(id);
	}

	createProject(input: Record<string, unknown>): Project {
		this.ensureSchema();
		const name = input.name;
		if (typeof name !== "string" || name.trim() === "") throw new Error("name is required");
		const now = new Date().toISOString();
		const project: Project = {
			id: ulid(),
			name: name.trim(),
			description: asStringOrNull(input.description),
			status: validatedEnum(input.status, PROJECT_STATUSES, "backlog"),
			priority: validatedEnumOrNull(input.priority, ["low", "medium", "high"] as const),
			owner: asStringOrNull(input.owner),
			customer: asStringOrNull(input.customer),
			created_at: now,
			updated_at: now,
		};
		this.ctx.storage.sql.exec(
			`INSERT INTO projects (id,name,description,status,priority,owner,customer,created_at,updated_at)
			 VALUES (?,?,?,?,?,?,?,?,?)`,
			project.id,
			project.name,
			project.description,
			project.status,
			project.priority,
			project.owner,
			project.customer,
			project.created_at,
			project.updated_at,
		);
		return project;
	}

	getProject(id: string): (Project & { task_summary: Record<string, number> }) | null {
		const project = this.q("SELECT * FROM projects WHERE id = ?", id)[0] as Project | undefined;
		if (!project) return null;
		const counts = this.q(
			"SELECT status, COUNT(*) as count FROM tasks WHERE project_id = ? GROUP BY status",
			id,
		) as unknown as { status: string; count: number }[];
		const task_summary: Record<string, number> = {};
		for (const row of counts) task_summary[row.status] = row.count;
		return { ...project, task_summary };
	}

	listProjects(filters: Record<string, unknown>): Project[] {
		const { where, params } = buildWhere(filters, ["status", "owner", "customer"]);
		return this.q(
			`SELECT * FROM projects ${where} ORDER BY created_at DESC`,
			...params,
		) as unknown as Project[];
	}

	updateProject(id: string, updates: Record<string, unknown>): Project | null {
		this.ensureSchema();
		if (!this.getProject(id)) return null;
		const allowed = ["name", "description", "status", "priority", "owner", "customer"];
		const setClauses: string[] = [];
		const params: unknown[] = [];
		for (const key of allowed) {
			if (!(key in updates)) continue;
			setClauses.push(`${key} = ?`);
			params.push(updates[key] ?? null);
		}
		if (setClauses.length === 0) return this.getProject(id);
		setClauses.push("updated_at = ?");
		params.push(new Date().toISOString());
		params.push(id);
		this.ctx.storage.sql.exec(
			`UPDATE projects SET ${setClauses.join(", ")} WHERE id = ?`,
			...params,
		);
		return this.getProject(id);
	}

	logActivity(entry: {
		tool_name: string;
		input: unknown;
		output: unknown;
		agent_id?: string;
	}): ActivityLogEntry {
		this.ensureSchema();
		const row: ActivityLogEntry = {
			id: ulid(),
			tool_name: entry.tool_name,
			input: JSON.stringify(entry.input),
			output: entry.output ? JSON.stringify(entry.output) : null,
			agent_id: entry.agent_id ?? null,
			created_at: new Date().toISOString(),
		};
		this.ctx.storage.sql.exec(
			"INSERT INTO activity_log (id,tool_name,input,output,agent_id,created_at) VALUES (?,?,?,?,?,?)",
			row.id,
			row.tool_name,
			row.input,
			row.output,
			row.agent_id,
			row.created_at,
		);
		return row;
	}

	getActivitySinceLastObservation(): unknown[] {
		const lastObs = this.q("SELECT created_at FROM observations ORDER BY created_at DESC LIMIT 1");
		const since = (lastObs[0] as { created_at: string } | undefined)?.created_at;
		return since
			? this.q("SELECT * FROM activity_log WHERE created_at > ? ORDER BY created_at", since)
			: this.q("SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 50");
	}

	storeObservation(
		content: string,
		type: "observation" | "reflection",
		sourceIds?: string[],
	): unknown {
		const id = ulid();
		const now = new Date().toISOString();
		this.q(
			"INSERT INTO observations (id,content,type,source_ids,created_at) VALUES (?,?,?,?,?)",
			id,
			content,
			type,
			sourceIds ? JSON.stringify(sourceIds) : null,
			now,
		);
		return { id, content, type, source_ids: sourceIds ?? null, created_at: now };
	}

	getRecentObservations(limit = 10): unknown[] {
		const sql =
			"SELECT * FROM observations WHERE type = 'observation' ORDER BY created_at DESC LIMIT ?";
		return this.q(sql, limit);
	}

	getObservationCount(): number {
		const row = this.q(
			"SELECT COUNT(*) as count FROM observations WHERE type = 'observation'",
		)[0] as { count: number } | undefined;
		return row?.count ?? 0;
	}

	executeQuery(sql: string): unknown[] {
		if (!sql.trim().toUpperCase().startsWith("SELECT"))
			throw new Error("Only SELECT queries are allowed");
		return this.q(sql);
	}

	getContext(): { observations: unknown[]; recent_activity: unknown[] } {
		return {
			observations: this.q("SELECT * FROM observations ORDER BY created_at DESC LIMIT 10"),
			recent_activity: this.q("SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 20"),
		};
	}
}
