export interface DocketTask {
	id: string;
	title: string;
	summary: string | null;
	description: string | null;
	status: string;
	priority: string | null;
	project_id: string | null;
	tags: string | null;
}

export interface DocketProject {
	id: string;
	name: string;
	status: string;
	description: string | null;
}

export interface DocketContext {
	observations: Array<{ id: string; content: string; type: string; created_at: string }>;
	recent_activity: Array<{ tool_name: string; input: string; created_at: string }>;
}

export interface SlackMessage {
	text?: string;
	user?: string;
	bot_id?: string;
	ts?: string;
}

export type IntakeAction =
	| {
			action: "create_task";
			title: string;
			description: string;
			priority?: string;
			project_id?: string;
			reply: string;
	  }
	| { action: "ask_followup"; question: string; reply: string }
	| { action: "link_existing"; task_id: string; reply: string };
