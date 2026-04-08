/**
 * ystack workflow nudge — PreToolUse hook on Edit/Write
 *
 * Soft warning when editing multiple source files without an active plan.
 * Tracks edits per session — only nudges after 3+ distinct source files
 * are edited without a plan. One-off fixes don't trigger it.
 *
 * Dismissible: creating a file at .context/.no-nudge silences it for
 * the session (e.g., when the developer intentionally works without a plan).
 */

import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Session state file — tracks edited files and nudge status
const STATE_FILE = join(tmpdir(), ".ystack-nudge-state.json");

// Load state
let state = { editedFiles: [], nudged: false };
try {
	if (existsSync(STATE_FILE)) {
		state = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
	}
} catch {
	// Fresh state
}

// Already nudged this session
if (state.nudged) {
	process.exit(0);
}

// Developer dismissed nudges
if (existsSync(".context/.no-nudge")) {
	process.exit(0);
}

// Get the file being edited
const filePath = process.env.CLAUDE_TOOL_INPUT_FILE_PATH || "";
if (!filePath) {
	process.exit(0);
}

// Skip non-source files — these never need a plan
const skipPatterns = [
	/\.md$/,
	/\.mdx$/,
	/\.json$/,
	/\.yaml$/,
	/\.yml$/,
	/\.toml$/,
	/\.env/,
	/\.config\./,
	/\.css$/,
	/_meta\.ts$/,
	/meta\.json$/,
	/\.gitignore$/,
	/\.context\//,
	/node_modules\//,
	/\.next\//,
	/dist\//,
	/\.test\./,
	/\.spec\./,
	/__tests__\//,
];

if (skipPatterns.some((p) => p.test(filePath))) {
	process.exit(0);
}

// Check if there's an active plan
let hasActivePlan = false;
if (existsSync(".context")) {
	try {
		for (const entry of readdirSync(".context")) {
			if (existsSync(join(".context", entry, "PLAN.md"))) {
				hasActivePlan = true;
				break;
			}
		}
	} catch {
		// Can't read .context
	}
}

// If there's a plan, no nudge needed
if (hasActivePlan) {
	process.exit(0);
}

// Track this file edit
if (!state.editedFiles.includes(filePath)) {
	state.editedFiles.push(filePath);
}

// Only nudge after 3+ distinct source files edited without a plan
// One or two files = probably a quick fix, not feature work
if (state.editedFiles.length >= 3) {
	console.log(
		`[ystack] Editing ${state.editedFiles.length} source files without a plan. Consider /build for tracked changes, or touch .context/.no-nudge to dismiss.`,
	);
	state.nudged = true;
}

// Save state
writeFileSync(STATE_FILE, JSON.stringify(state));
