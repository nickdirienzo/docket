import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");

function collectTsFiles(dir: string): string[] {
	const files: string[] = [];
	if (!existsSync(dir)) return files;
	for (const entry of readdirSync(dir, { recursive: true })) {
		const full = join(dir, String(entry));
		if (full.endsWith(".ts") && !full.endsWith(".test.ts") && !full.includes("node_modules")) {
			files.push(full);
		}
	}
	return files;
}

describe("architecture constraints", () => {
	it("no source file exceeds 300 lines", () => {
		const dirs = ["worker/src", "mcp-server/src", "slack-app/src"];
		const violations: string[] = [];

		for (const dir of dirs) {
			for (const file of collectTsFiles(join(ROOT, dir))) {
				const lines = readFileSync(file, "utf-8").split("\n").length;
				if (lines > 300) {
					violations.push(`${file} has ${lines} lines (max 300)`);
				}
			}
		}

		expect(violations).toEqual([]);
	});

	it("no default exports in source files (except worker/src/index.ts)", () => {
		const dirs = ["worker/src", "mcp-server/src", "slack-app/src"];
		const violations: string[] = [];

		for (const dir of dirs) {
			for (const file of collectTsFiles(join(ROOT, dir))) {
				// Worker index.ts must default-export the Hono app for Cloudflare
				if (file.endsWith("worker/src/index.ts")) continue;

				const content = readFileSync(file, "utf-8");
				if (/^export default /m.test(content)) {
					violations.push(file);
				}
			}
		}

		expect(violations).toEqual([]);
	});

	it("no 'any' type in source files", () => {
		const dirs = ["worker/src", "mcp-server/src", "slack-app/src"];
		const violations: string[] = [];

		for (const dir of dirs) {
			for (const file of collectTsFiles(join(ROOT, dir))) {
				const content = readFileSync(file, "utf-8");
				// Match ': any', '<any>', 'as any' but not comments or strings
				const lines = content.split("\n");
				for (let i = 0; i < lines.length; i++) {
					const line = lines[i] ?? "";
					// Skip comments
					if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;
					if (/\bany\b/.test(line) && /[:,<(]\s*any\b|as\s+any\b/.test(line)) {
						violations.push(`${file}:${i + 1}: ${line.trim()}`);
					}
				}
			}
		}

		expect(violations).toEqual([]);
	});

	it("required docs exist", () => {
		const requiredDocs = [
			"AGENTS.md",
			"docs/architecture.md",
			"docs/conventions.md",
			"docs/api.md",
			"docs/mcp-tools.md",
		];

		for (const doc of requiredDocs) {
			expect(existsSync(join(ROOT, doc)), `Missing: ${doc}`).toBe(true);
		}
	});

	it("schema.sql is the source of truth and exists", () => {
		const schemaPath = join(ROOT, "worker/src/schema.sql");
		expect(existsSync(schemaPath)).toBe(true);

		const content = readFileSync(schemaPath, "utf-8");
		// Must define all four tables
		for (const table of ["tasks", "projects", "activity_log", "observations"]) {
			expect(content).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
		}
	});

	it("activity_log and observations have no DELETE or UPDATE in worker source", () => {
		const violations: string[] = [];
		for (const file of collectTsFiles(join(ROOT, "worker/src"))) {
			const content = readFileSync(file, "utf-8");
			for (const table of ["activity_log", "observations"]) {
				if (content.includes(`DELETE FROM ${table}`) || content.includes(`UPDATE ${table}`)) {
					violations.push(`${file} mutates append-only table: ${table}`);
				}
			}
		}
		expect(violations).toEqual([]);
	});
});
