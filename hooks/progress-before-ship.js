/**
 * ystack progress-before-ship — PreToolUse hook on Bash
 *
 * Warns when creating a PR or pushing code if the branch has code
 * changes in module scopes but no corresponding .ystack/progress/ updates.
 *
 * Only fires on git push or gh pr create commands.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";

// Only check on git push or gh pr create
const toolInput = process.env.CLAUDE_TOOL_INPUT || "";
if (!toolInput.includes("git push") && !toolInput.includes("gh pr create")) {
	process.exit(0);
}

// Must be a ystack project
if (!existsSync(".ystack/config.json")) {
	process.exit(0);
}

// Quick mode — skip progress checks for bug fixes and chores
if (existsSync(".context/.quick")) {
	process.exit(0);
}

// Resolve the repo's default branch dynamically
let baseBranch = "main";
try {
	const ref = execSync("git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null", {
		encoding: "utf-8",
	}).trim();
	baseBranch = ref.replace("refs/remotes/origin/", "");
} catch {
	// Fall back to "main"
}

// Get changed files on this branch vs the default branch
let changedFiles;
try {
	changedFiles = execSync(`git diff ${baseBranch}...HEAD --name-only 2>/dev/null`, {
		encoding: "utf-8",
	}).trim().split("\n").filter(Boolean);
} catch {
	process.exit(0);
}

if (changedFiles.length === 0) {
	process.exit(0);
}

// Check if any code files changed (not docs, not config, not progress)
const codeChanges = changedFiles.filter(
	(f) =>
		!f.startsWith("docs/") &&
		!f.startsWith(".ystack/") &&
		!f.startsWith(".claude/") &&
		!f.startsWith(".context/") &&
		!f.endsWith(".md") &&
		!f.endsWith(".json") &&
		!f.endsWith(".yaml") &&
		!f.endsWith(".yml"),
);

if (codeChanges.length === 0) {
	process.exit(0);
}

// Small diffs (≤ 5 code files) are likely bug fixes or chores — don't warn
if (codeChanges.length <= 5) {
	process.exit(0);
}

// Check if progress files were updated
const progressChanges = changedFiles.filter((f) =>
	f.startsWith(".ystack/progress/"),
);

if (progressChanges.length === 0) {
	console.log(
		`[ystack] ${codeChanges.length} code files changed but no .ystack/progress/ updates. If this is a feature, did /go check the boxes? If it's a bug fix, ignore this.`,
	);
}
