import { App } from "@slack/bolt";
import { DocketClient } from "./docket.js";
import { processIntake } from "./intake.js";

const WORKER_URL = process.env.DOCKET_WORKER_URL ?? "http://localhost:8787";
const API_TOKEN = process.env.DOCKET_API_TOKEN ?? "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN ?? "";
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET ?? "";
const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN ?? "";

const docket = new DocketClient(WORKER_URL, API_TOKEN);

const app = new App({
	token: SLACK_BOT_TOKEN,
	signingSecret: SLACK_SIGNING_SECRET,
	socketMode: true,
	appToken: SLACK_APP_TOKEN,
});

app.event("app_mention", async ({ event, client }) => {
	const channel = event.channel;
	const threadTs = event.thread_ts ?? event.ts;

	try {
		// Gather channel context and Docket state in parallel
		const [contextResult, tasks, projects] = await Promise.all([
			event.thread_ts
				? client.conversations.replies({ channel, ts: event.thread_ts, limit: 20 })
				: client.conversations.history({ channel, limit: 10 }),
			docket.listTasks(),
			docket.listProjects(),
		]);

		const messages = (contextResult.messages ?? []).map((m) => ({
			text: typeof m.text === "string" ? m.text : undefined,
			user: typeof m.user === "string" ? m.user : undefined,
			bot_id: typeof m.bot_id === "string" ? m.bot_id : undefined,
			ts: typeof m.ts === "string" ? m.ts : undefined,
		}));

		const action = await processIntake({
			messages,
			tasks,
			projects,
			mentionText: event.text ?? "",
			anthropicApiKey: ANTHROPIC_API_KEY,
		});

		// Act on Claude's decision
		if (action.action === "create_task") {
			const task = await docket.createTask({
				title: action.title,
				description: action.description,
				priority: action.priority,
				project_id: action.project_id,
				tags: ["slack"],
			});
			console.log(`[docket] Created task ${task.id}: ${task.title}`);
		} else if (action.action === "link_existing") {
			console.log(`[docket] Linked to existing task ${action.task_id}`);
		}

		await client.chat.postMessage({
			channel,
			thread_ts: threadTs,
			text: action.reply,
		});
	} catch (err) {
		console.error("[docket] Intake error:", err);
		await client.chat.postMessage({
			channel,
			thread_ts: threadTs,
			text: "Something went wrong processing this request. Please try again.",
		});
	}
});

await app.start();
console.log("[docket] Slack app running (Socket Mode)");
