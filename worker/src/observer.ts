import type { Observation } from "./types";

const SYSTEM_PROMPT = `You are an observer agent for Docket, a task/project management system.
Analyze recent task activity and produce concise observations about:
- Patterns (what's being worked on, what's stalling)
- Blockers (tasks stuck in_progress too long, missing assignments)
- Velocity (how fast tasks are moving through statuses)
- Relationships (tasks that seem related, projects that need attention)

Output 2-5 bullet points. Be specific and actionable. Reference task/project IDs when relevant.`;

interface ObserveInput {
	recentActivity: unknown[];
	existingObservations: unknown[];
	anthropicApiKey: string;
}

interface ClaudeMessage {
	content: { type: string; text: string }[];
}

export async function generateObservations(input: ObserveInput): Promise<string> {
	const { recentActivity, existingObservations, anthropicApiKey } = input;

	if (recentActivity.length === 0) {
		return "No new activity since last observation.";
	}

	const userContent = [
		"## Recent Activity",
		JSON.stringify(recentActivity, null, 2),
		existingObservations.length > 0
			? `\n## Previous Observations\n${JSON.stringify(existingObservations, null, 2)}`
			: "",
	].join("\n");

	const res = await fetch("https://api.anthropic.com/v1/messages", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": anthropicApiKey,
			"anthropic-version": "2023-06-01",
		},
		body: JSON.stringify({
			model: "claude-haiku-4-5-20251001",
			max_tokens: 1024,
			system: SYSTEM_PROMPT,
			messages: [{ role: "user", content: userContent }],
		}),
	});

	if (!res.ok) {
		const err = await res.text();
		throw new Error(`Claude API error ${res.status}: ${err}`);
	}

	const data = (await res.json()) as ClaudeMessage;
	return data.content[0]?.text ?? "No observations generated.";
}

export async function generateReflection(observations: Observation[]): Promise<string> {
	// Phase 2 stub — will compress observations into higher-level reflections
	// For now, just summarize the count
	return `Reflection over ${observations.length} observations. Detailed reflection coming in next iteration.`;
}
