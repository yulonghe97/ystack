/**
 * ystack workflow nudge — PreToolUse hook on Edit/Write
 *
 * Soft warning when editing source files without an active plan.
 * Only warns once per session (uses a temp file as flag).
 */

import { existsSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const NUDGE_FLAG = join(tmpdir(), ".ystack-nudge-shown");

// Don't warn if we already warned this session
if (existsSync(NUDGE_FLAG)) {
	process.exit(0);
}

// Get the file being edited from env (Claude Code sets these)
const filePath = process.env.CLAUDE_TOOL_INPUT_FILE_PATH || "";

// Skip non-source files
const skipPatterns = [
	/\.md$/,
	/\.mdx$/,
	/\.json$/,
	/\.yaml$/,
	/\.yml$/,
	/\.toml$/,
	/\.env/,
	/\.config\./,
	/_meta\.ts$/,
	/meta\.json$/,
	/\.gitignore$/,
	/\.context\//,
	/node_modules\//,
	/\.next\//,
	/dist\//,
];

if (skipPatterns.some((p) => p.test(filePath))) {
	process.exit(0);
}

// Check if there's an active plan
const contextDir = ".context";
let hasActivePlan = false;

if (existsSync(contextDir)) {
	try {
		const entries = readdirSync(contextDir);
		for (const entry of entries) {
			if (existsSync(join(contextDir, entry, "PLAN.md"))) {
				hasActivePlan = true;
				break;
			}
		}
	} catch {
		// .context doesn't exist or can't be read
	}
}

if (!hasActivePlan) {
	console.log(
		"[ystack] Editing code without a plan. Consider /build for tracked changes.",
	);
	// Set flag so we don't warn again this session
	writeFileSync(NUDGE_FLAG, new Date().toISOString());
}
