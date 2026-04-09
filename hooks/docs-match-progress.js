/**
 * ystack docs-match-progress — PostToolUse hook
 *
 * After writing/editing doc files, checks that any [x] features in the
 * module's progress file have real content in docs (not <!-- ystack:stub -->).
 *
 * Fires after Edit or Write on files under the docs root.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

// Only check on doc file edits
const filePath = process.env.CLAUDE_TOOL_INPUT_FILE_PATH || "";
if (!filePath) {
	process.exit(0);
}

// Must be a ystack project
if (!existsSync(".ystack/config.json")) {
	process.exit(0);
}

// Read config to find docs root
let config;
try {
	config = JSON.parse(readFileSync(".ystack/config.json", "utf-8"));
} catch {
	process.exit(0);
}

const docsRoot = config.docs?.root;
if (!docsRoot || !filePath.includes(docsRoot)) {
	process.exit(0);
}

// Find which module this doc file belongs to
const modules = config.modules || {};
let matchedModule = null;

for (const [key, mod] of Object.entries(modules)) {
	if (mod.doc && filePath.includes(mod.doc)) {
		matchedModule = key;
		break;
	}
}

if (!matchedModule) {
	process.exit(0);
}

// Read the module's progress file
const progressPath = `.ystack/progress/${matchedModule}.md`;
if (!existsSync(progressPath)) {
	process.exit(0);
}

const progressContent = readFileSync(progressPath, "utf-8");

// Find checked items with doc anchors
const checkedPattern = /^- \[x\] .+→\s*(.+)/gm;
const checkedAnchors = [];
let match;
while ((match = checkedPattern.exec(progressContent)) !== null) {
	checkedAnchors.push(match[1].trim());
}

if (checkedAnchors.length === 0) {
	process.exit(0);
}

// Read the doc file being edited
let docContent;
try {
	docContent = readFileSync(filePath, "utf-8");
} catch {
	process.exit(0);
}

// Check for stubs that should have been filled
const stubs = [];
for (const anchor of checkedAnchors) {
	// Extract the anchor part (after #)
	const anchorId = anchor.includes("#") ? anchor.split("#")[1] : null;
	if (!anchorId) continue;

	// Check if this anchor's section still has a stub marker
	const anchorRegex = new RegExp(
		`\\{#${anchorId}\\}[\\s\\S]*?<!-- ystack:stub -->`,
	);
	if (anchorRegex.test(docContent)) {
		stubs.push(anchorId);
	}
}

if (stubs.length > 0) {
	console.log(
		`[ystack] ${stubs.length} feature(s) marked done in progress but still stubbed in docs: ${stubs.join(", ")}`,
	);
}
