/* eslint-disable */
/* biome-ignore-all lint: ystack hook runtime is vendored into consuming repos. */

/**
 * ystack no-undocumented-check — PreToolUse hook on Edit
 *
 * When someone checks a box in a progress file ([ ] → [x]),
 * verifies the linked doc section doesn't still have <!-- ystack:stub -->.
 *
 * Prevents marking features as "done" when docs haven't been written.
 * This is a warn, not a block — /go checks the box before /docs runs,
 * so the stub is expected at that point. The warning reminds you to
 * run /docs before /pr.
 */

import { existsSync, readFileSync } from "node:fs";

// Only check edits to progress files
const filePath = process.env.CLAUDE_TOOL_INPUT_FILE_PATH || "";
if (!filePath.includes(".ystack/progress/") || filePath.includes("_overview")) {
	process.exit(0);
}

// Check if the edit is checking a box
const newContent = process.env.CLAUDE_TOOL_INPUT_NEW_STRING || "";
if (!newContent.includes("- [x]")) {
	process.exit(0);
}

// Must be a ystack project with config
if (!existsSync(".ystack/config.json")) {
	process.exit(0);
}

let config;
try {
	config = JSON.parse(readFileSync(".ystack/config.json", "utf-8"));
} catch {
	process.exit(0);
}

if (!config.docs?.root) {
	process.exit(0);
}

// Extract anchor references from the lines being checked
const anchorPattern = /- \[x\] .+→\s*(.+)/g;
let match;
const anchors = [];
while ((match = anchorPattern.exec(newContent)) !== null) {
	anchors.push(match[1].trim());
}

if (anchors.length === 0) {
	process.exit(0);
}

// Check each anchor for stubs in the doc files
const warnings = [];
for (const anchor of anchors) {
	const parts = anchor.split("#");
	const docPath = parts[0];
	const anchorId = parts[1];

	if (!docPath || !anchorId) continue;

	// Try to find the doc file
	const candidates = [
		`${docPath}/index.mdx`,
		`${docPath}/index.md`,
		`${docPath}.mdx`,
		`${docPath}.md`,
	];

	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			const content = readFileSync(candidate, "utf-8");
			const stubCheck = new RegExp(
				`\\{#${anchorId}\\}[\\s\\S]*?<!-- ystack:stub -->`,
			);
			if (stubCheck.test(content)) {
				warnings.push(`${docPath}#${anchorId}`);
			}
			break;
		}
	}
}

if (warnings.length > 0) {
	console.log(
		`[ystack] Checking off feature(s) with stubbed doc sections: ${warnings.join(", ")}. Run /docs before /pr to fill them in.`,
	);
}
