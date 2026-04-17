import type { DocketContext, DocketProject, DocketTask } from "./types.js";

export class DocketClient {
	private workerUrl: string;
	private apiToken: string;

	constructor(workerUrl: string, apiToken: string) {
		this.workerUrl = workerUrl;
		this.apiToken = apiToken;
	}

	private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
		const res = await fetch(`${this.workerUrl}${path}`, {
			method,
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.apiToken}`,
			},
			body: body ? JSON.stringify(body) : undefined,
		});
		const data = (await res.json()) as T;
		if (!res.ok) {
			const err = (data as { error?: string }).error ?? res.statusText;
			throw new Error(`Docket API ${res.status}: ${err}`);
		}
		return data;
	}

	createTask(input: {
		title: string;
		description?: string;
		priority?: string;
		project_id?: string;
		tags?: string[];
	}): Promise<DocketTask> {
		return this.request<DocketTask>("POST", "/tasks", input);
	}

	listTasks(filters?: { status?: string; project_id?: string }): Promise<DocketTask[]> {
		const params = new URLSearchParams();
		if (filters?.status) params.set("status", filters.status);
		if (filters?.project_id) params.set("project_id", filters.project_id);
		const qs = params.toString();
		return this.request<DocketTask[]>("GET", qs ? `/tasks?${qs}` : "/tasks");
	}

	listProjects(): Promise<DocketProject[]> {
		return this.request<DocketProject[]>("GET", "/projects");
	}

	getContext(): Promise<DocketContext> {
		return this.request<DocketContext>("GET", "/context");
	}

	updateTask(id: string, updates: Record<string, unknown>): Promise<DocketTask> {
		return this.request<DocketTask>("PATCH", `/tasks/${id}`, updates);
	}
}
