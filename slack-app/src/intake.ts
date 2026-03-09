import type { DocketProject, DocketTask, IntakeAction, SlackMessage } from "./types.js";

const INTAKE_SYSTEM_PROMPT = `You are @docket, a Slack bot that captures work signals into a task tracking system.

When someone tags you in Slack, your job is to:
1. Read the conversation for context
2. Check existing Docket tasks and projects for duplicates or related work
3. Decide the right action

Respond with a JSON object only — no markdown, no explanation.

**If the message contains a clear, actionable work item** (bug, task, follow-up, request):
{"action":"create_task","title":"<concise task title, under 100 chars>","description":"<full context: who reported it, what the issue is, environment/scope details>","priority":"<low|medium|high|urgent>","project_id":"<matching project ID if clearly applicable, otherwise omit>","reply":"<brief Slack reply confirming what was captured>"}

**If context is too ambiguous to act on** (missing key info about what, who, or scope):
{"action":"ask_followup","question":"<specific question>","reply":"<your Slack reply as a direct question>"}

**If the work is already tracked in Docket**:
{"action":"link_existing","task_id":"<existing task ID>","reply":"<Slack reply confirming it's tracked, offer to add context>"}

Guidelines:
- Default priority to "medium" unless urgency signals are clear
- Lean toward creating a task rather than asking — an incomplete task is better than no task
- Never invent task IDs — only reference IDs from the provided Docket context
- The reply field is your voice in Slack: brief, direct, no jargon`;

interface ClaudeMessage {
	content: Array<{ type: string; text: string }>;
}

export interface IntakeInput {
	messages: SlackMessage[];
	tasks: DocketTask[];
	projects: DocketProject[];
	mentionText: string;
	anthropicApiKey: string;
}

export async function processIntake(input: IntakeInput): Promise<IntakeAction> {
	const { messages, tasks, projects, mentionText, anthropicApiKey } = input;

	const formattedMessages = messages
		.filter((m) => m.text)
		.map((m) => `[${m.ts ?? "?"}] ${m.bot_id ? "bot" : (m.user ?? "unknown")}: ${m.text}`)
		.join("\n");

	const openTasks = tasks
		.filter((t) => t.status === "not_started" || t.status === "in_progress")
		.slice(0, 20)
		.map(
			(t) =>
				`- [${t.id}] ${t.title} (${t.status}${t.priority ? `, ${t.priority}` : ""}${t.project_id ? `, project: ${t.project_id}` : ""})`,
		)
		.join("\n");

	const projectList = projects
		.slice(0, 10)
		.map((p) => `- [${p.id}] ${p.name} (${p.status})`)
		.join("\n");

	const userContent = [
		"## Slack Messages (oldest to newest)",
		formattedMessages || "(no messages)",
		"\n## Mention Text",
		mentionText,
		"\n## Open Docket Tasks",
		openTasks || "(none)",
		"\n## Active Projects",
		projectList || "(none)",
	].join("\n");

	const res = await fetch("https://api.anthropic.com/v1/messages", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"anthropic-version": "2023-06-01",
			"x-api-key": anthropicApiKey,
		},
		body: JSON.stringify({
			model: "claude-haiku-4-5-20251001",
			max_tokens: 1024,
			system: INTAKE_SYSTEM_PROMPT,
			messages: [{ role: "user", content: userContent }],
		}),
	});

	if (!res.ok) {
		const err = await res.text();
		throw new Error(`Claude API error ${res.status}: ${err}`);
	}

	const data = (await res.json()) as ClaudeMessage;
	const text = data.content[0]?.text ?? "{}";

	try {
		const parsed = JSON.parse(text) as IntakeAction;
		const validActions = ["create_task", "ask_followup", "link_existing"];
		if (!parsed.action || !validActions.includes(parsed.action)) {
			throw new Error(`Unknown action: ${parsed.action}`);
		}
		return parsed;
	} catch {
		return {
			action: "ask_followup",
			question: "Could you clarify what needs to be done?",
			reply: "I had trouble parsing this request — could you clarify what needs to be done?",
		};
	}
}
