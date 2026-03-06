import { Hono } from "hono";
import type { TaskStore } from "./TaskStore";
import type { Env } from "./types";

export { TaskStore } from "./TaskStore";

type HonoEnv = { Bindings: Env };

const app = new Hono<HonoEnv>();

// Auth middleware
app.use("*", async (c, next) => {
	const token = c.req.header("Authorization")?.replace("Bearer ", "");
	if (token !== c.env.API_TOKEN) {
		return c.json({ error: "Unauthorized" }, 401);
	}
	await next();
});

function getStore(env: Env): DurableObjectStub<TaskStore> {
	const id = env.TASK_STORE.idFromName("global");
	return env.TASK_STORE.get(id);
}

// --- Tasks ---

app.post("/tasks", async (c) => {
	const body = await c.req.json();
	const store = getStore(c.env);
	const task = await store.createTask(body);
	return c.json(task, 201);
});

app.get("/tasks", async (c) => {
	const filters = {
		status: c.req.query("status"),
		assignee: c.req.query("assignee"),
		project_id: c.req.query("project_id"),
		customer: c.req.query("customer"),
	};
	const store = getStore(c.env);
	const tasks = await store.listTasks(filters);
	return c.json(tasks);
});

app.get("/tasks/:id", async (c) => {
	const store = getStore(c.env);
	const task = await store.getTask(c.req.param("id"));
	if (!task) return c.json({ error: "Task not found" }, 404);
	return c.json(task);
});

app.patch("/tasks/:id", async (c) => {
	const body = await c.req.json();
	const store = getStore(c.env);
	const task = await store.updateTask(c.req.param("id"), body);
	if (!task) return c.json({ error: "Task not found" }, 404);
	return c.json(task);
});

// --- Projects ---

app.post("/projects", async (c) => {
	const body = await c.req.json();
	const store = getStore(c.env);
	const project = await store.createProject(body);
	return c.json(project, 201);
});

app.get("/projects", async (c) => {
	const filters = {
		status: c.req.query("status"),
		owner: c.req.query("owner"),
		customer: c.req.query("customer"),
	};
	const store = getStore(c.env);
	const projects = await store.listProjects(filters);
	return c.json(projects);
});

app.get("/projects/:id", async (c) => {
	const store = getStore(c.env);
	const project = await store.getProject(c.req.param("id"));
	if (!project) return c.json({ error: "Project not found" }, 404);
	return c.json(project);
});

app.patch("/projects/:id", async (c) => {
	const body = await c.req.json();
	const store = getStore(c.env);
	const project = await store.updateProject(c.req.param("id"), body);
	if (!project) return c.json({ error: "Project not found" }, 404);
	return c.json(project);
});

// --- Query ---

app.post("/query", async (c) => {
	const { sql } = await c.req.json();
	if (typeof sql !== "string") {
		return c.json({ error: "sql field is required" }, 400);
	}
	const store = getStore(c.env);
	const results = await store.executeQuery(sql);
	return c.json(results);
});

// --- Context ---

app.get("/context", async (c) => {
	const store = getStore(c.env);
	const context = await store.getContext();
	return c.json(context);
});

// --- Activity ---

app.post("/activity", async (c) => {
	const body = await c.req.json();
	const store = getStore(c.env);
	const entry = await store.logActivity(body);
	return c.json(entry, 201);
});

// --- Observer ---

function getAuth(env: Env) {
	return { apiKey: env.ANTHROPIC_API_KEY, oauthToken: env.ANTHROPIC_OAUTH_TOKEN };
}

function hasAuth(env: Env): boolean {
	return Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_OAUTH_TOKEN);
}

async function runObserver(env: Env): Promise<{ observation: unknown; reflection: unknown }> {
	const store = getStore(env);
	const recentActivity = await store.getActivitySinceLastObservation();
	const existingObservations = await store.getRecentObservations(5);

	const { generateObservations } = await import("./observer");
	const content = await generateObservations({
		recentActivity,
		existingObservations,
		auth: getAuth(env),
	});

	const observation = await store.storeObservation(content, "observation");

	let reflection = null;
	const count = await store.getObservationCount();
	if (count > 0 && count % 10 === 0) {
		const recent = await store.getRecentObservations(10);
		const { generateReflection } = await import("./observer");
		const reflectionContent = await generateReflection(recent as never);
		reflection = await store.storeObservation(reflectionContent, "reflection");
	}

	return { observation, reflection };
}

app.post("/observe", async (c) => {
	if (!hasAuth(c.env)) {
		return c.json(
			{ error: "No Anthropic auth configured (set ANTHROPIC_API_KEY or ANTHROPIC_OAUTH_TOKEN)" },
			500,
		);
	}
	const result = await runObserver(c.env);
	return c.json(result);
});

// Error handler
app.onError((err, c) => {
	console.error(`[docket] ${err.message}`, { stack: err.stack });
	const status = err.message.includes("required") || err.message.includes("Invalid") ? 400 : 500;
	return c.json({ error: err.message }, status);
});

export default {
	fetch: app.fetch,
	async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
		if (!hasAuth(env)) {
			console.log("[docket] Skipping observer: no Anthropic auth configured");
			return;
		}
		await runObserver(env);
		console.log("[docket] Observer completed");
	},
};
