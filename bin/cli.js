#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import * as p from "@clack/prompts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const YSTACK_ROOT = resolve(__dirname, "..");

// Colors
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;

const args = process.argv.slice(2);
const command = args[0];
const flags = args.filter((a) => a.startsWith("--"));

// --- Prompt helpers ---

function handleCancel(value) {
	if (p.isCancel(value)) {
		p.cancel("Cancelled.");
		process.exit(0);
	}
	return value;
}

// --- File helpers ---

function hashFile(path) {
	if (!existsSync(path)) return null;
	const content = readFileSync(path, "utf-8");
	return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

function detectProjectName() {
	// Try package.json
	if (existsSync("package.json")) {
		try {
			const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
			if (pkg.name) return pkg.name.replace(/^@[^/]+\//, "");
		} catch { /* ignore */ }
	}
	// Fall back to directory name
	return process.cwd().split("/").pop();
}

// --- Skill installation ---

function copySkills(projectRoot, ystackRoot, silent = false) {
	const skillsDir = join(ystackRoot, "skills");
	const targetDir = join(projectRoot, ".claude", "skills");
	const skills = readdirSync(skillsDir).filter((d) =>
		statSync(join(skillsDir, d)).isDirectory(),
	);

	let installed = 0;
	let skipped = 0;

	for (const skill of skills) {
		const src = join(skillsDir, skill);
		const dst = join(targetDir, skill);
		const srcSkill = join(src, "SKILL.md");
		const dstSkill = join(dst, "SKILL.md");

		if (!existsSync(srcSkill)) continue;

		if (existsSync(dstSkill)) {
			const srcHash = hashFile(srcSkill);
			const dstHash = hashFile(dstSkill);
			if (srcHash !== dstHash) {
				if (!silent) console.log(yellow(`  ⚠ ${skill}/ — customized, skipping`));
				skipped++;
				continue;
			}
		}

		mkdirSync(dst, { recursive: true });
		cpSync(src, dst, { recursive: true });
		installed++;
		if (!silent) console.log(green(`  ✓ ${skill}/`));
	}

	return { installed, skipped, total: skills.length };
}

function installHooks(projectRoot, ystackRoot) {
	const settingsPath = join(projectRoot, ".claude", "settings.json");
	let settings = {};

	if (existsSync(settingsPath)) {
		try {
			settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		} catch { /* create new */ }
	}

	if (!settings.hooks) settings.hooks = {};

	// PostToolUse — context monitor
	if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];
	const hasContextMonitor = settings.hooks.PostToolUse.some(
		(h) => h.hooks?.some((hh) => hh.command?.includes("context-monitor")),
	);
	if (!hasContextMonitor) {
		settings.hooks.PostToolUse.push({
			matcher: "*",
			hooks: [{
				type: "command",
				command: `node .claude/hooks/context-monitor.js`,
				timeout: 5,
			}],
		});
	}

	// PreToolUse — workflow nudge
	if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];
	const hasWorkflowNudge = settings.hooks.PreToolUse.some(
		(h) => h.hooks?.some((hh) => hh.command?.includes("workflow-nudge")),
	);
	if (!hasWorkflowNudge) {
		settings.hooks.PreToolUse.push({
			matcher: "Edit|Write",
			hooks: [{
				type: "command",
				command: `node .claude/hooks/workflow-nudge.js`,
				timeout: 5,
			}],
		});
	}

	// PreToolUse — progress-before-ship (on Bash for git push / gh pr create)
	const hasProgressBeforeShip = settings.hooks.PreToolUse.some(
		(h) => h.hooks?.some((hh) => hh.command?.includes("progress-before-ship")),
	);
	if (!hasProgressBeforeShip) {
		settings.hooks.PreToolUse.push({
			matcher: "Bash",
			hooks: [{
				type: "command",
				command: `node .claude/hooks/progress-before-ship.js`,
				timeout: 5,
			}],
		});
	}

	// PreToolUse — no-undocumented-check (on Edit of progress files)
	const hasNoUndocumentedCheck = settings.hooks.PreToolUse.some(
		(h) => h.hooks?.some((hh) => hh.command?.includes("no-undocumented-check")),
	);
	if (!hasNoUndocumentedCheck) {
		settings.hooks.PreToolUse.push({
			matcher: "Edit",
			hooks: [{
				type: "command",
				command: `node .claude/hooks/no-undocumented-check.js`,
				timeout: 5,
			}],
		});
	}

	// PostToolUse — docs-match-progress (after editing doc files)
	const hasDocsMatchProgress = settings.hooks.PostToolUse.some(
		(h) => h.hooks?.some((hh) => hh.command?.includes("docs-match-progress")),
	);
	if (!hasDocsMatchProgress) {
		settings.hooks.PostToolUse.push({
			matcher: "Edit|Write",
			hooks: [{
				type: "command",
				command: `node .claude/hooks/docs-match-progress.js`,
				timeout: 5,
			}],
		});
	}

	mkdirSync(dirname(settingsPath), { recursive: true });
	writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");

	// Copy hook files
	const hooksDir = join(ystackRoot, "hooks");
	const targetHooksDir = join(projectRoot, ".claude", "hooks");
	mkdirSync(targetHooksDir, { recursive: true });

	if (existsSync(hooksDir)) {
		for (const file of readdirSync(hooksDir)) {
			cpSync(join(hooksDir, file), join(targetHooksDir, file));
		}
		// Ensure ESM imports work regardless of the consuming repo's package.json
		writeFileSync(join(targetHooksDir, "package.json"), '{ "type": "module" }\n');
	}
}

function removeSkills(projectRoot) {
	const ystackSkills = join(YSTACK_ROOT, "skills");
	if (!existsSync(ystackSkills)) return;

	const skillsDir = join(projectRoot, ".claude", "skills");
	for (const skill of readdirSync(ystackSkills)) {
		const target = join(skillsDir, skill);
		if (existsSync(target) && statSync(join(ystackSkills, skill)).isDirectory()) {
			rmSync(target, { recursive: true });
			console.log(dim(`  removed ${skill}/`));
		}
	}
}

function removeHooks(projectRoot) {
	const settingsPath = join(projectRoot, ".claude", "settings.json");
	if (!existsSync(settingsPath)) return;

	try {
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		if (settings.hooks?.PostToolUse) {
			settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(
				(h) => !h.hooks?.some((hh) =>
					hh.command?.includes("context-monitor") ||
					hh.command?.includes("docs-match-progress")
				),
			);
		}
		if (settings.hooks?.PreToolUse) {
			settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(
				(h) => !h.hooks?.some((hh) =>
					hh.command?.includes("workflow-nudge") ||
					hh.command?.includes("progress-before-ship") ||
					hh.command?.includes("no-undocumented-check")
				),
			);
		}
		writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
	} catch { /* ignore */ }

	const hooksDir = join(projectRoot, ".claude", "hooks");
	for (const file of ["context-monitor.js", "session-start.sh", "workflow-nudge.js", "progress-before-ship.js", "docs-match-progress.js", "no-undocumented-check.js"]) {
		const target = join(hooksDir, file);
		if (existsSync(target)) rmSync(target);
	}
	console.log(dim("  removed hooks"));
}

function ensureGitignore(projectRoot) {
	const gitignorePath = join(projectRoot, ".gitignore");
	if (!existsSync(gitignorePath)) return;

	const content = readFileSync(gitignorePath, "utf-8");
	if (!content.includes(".context/")) {
		writeFileSync(gitignorePath, content.trimEnd() + "\n.context/\n");
	}
}

// --- Commands ---

async function cmdInit() {
	const projectRoot = process.cwd();

	p.intro("ystack init — agent harness for doc-driven development");

	const s = p.spinner();
	s.start("Installing skills and hooks...");

	// Skills
	mkdirSync(join(projectRoot, ".claude", "skills"), { recursive: true });
	const result = copySkills(projectRoot, YSTACK_ROOT, true);

	// Hooks
	installHooks(projectRoot, YSTACK_ROOT);

	// Minimal config (agent fills in stack details via /create)
	const ystackDir = join(projectRoot, ".ystack");
	mkdirSync(ystackDir, { recursive: true });
	const configPath = join(ystackDir, "config.json");
	const configExisted = existsSync(configPath);
	if (!configExisted) {
		const projectName = detectProjectName();
		const config = {
			project: projectName,
			runtime: "claude-code",
			modules: {},
			workflow: {
				plan_checker: true,
				fresh_context_per_task: true,
				auto_docs_check: true,
			},
		};
		writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
	}

	// Progress directory
	const progressDir = join(ystackDir, "progress");
	mkdirSync(progressDir, { recursive: true });
	if (!existsSync(join(progressDir, "_overview.md"))) {
		writeFileSync(join(progressDir, "_overview.md"), `# Project Progress\n\n## Module Status\n\n| Module | Done | Total | Status |\n|--------|------|-------|--------|\n\n## Ready Front\n\n_No modules registered yet. Run \`/import\` or \`/scaffold\` to get started._\n`);
	}

	ensureGitignore(projectRoot);

	s.stop("Setup complete");

	// Summary
	p.log.success(`Skills: ${result.installed} installed, ${result.skipped} skipped`);
	p.log.success("Hooks: context-monitor, workflow-nudge");
	if (configExisted) {
		p.log.info("Config: .ystack/config.json preserved");
	} else {
		p.log.success("Config: created .ystack/config.json");
	}

	p.note(
		[
			`${cyan("/create")}  — set up project (recommends stack, adapts to your needs)`,
			`${cyan("/import")}  — scan existing codebase and populate module registry`,
			`${cyan("/build")}   — plan a feature`,
		].join("\n"),
		"Next steps",
	);

	p.outro("Done!");
}

async function cmdUpdate() {
	const projectRoot = process.cwd();

	p.intro("ystack update");

	const s = p.spinner();
	s.start("Updating skills...");
	const result = copySkills(projectRoot, YSTACK_ROOT, true);
	s.stop(`Skills: ${result.installed} updated, ${result.skipped} customized (preserved)`);

	const hooksDir = join(YSTACK_ROOT, "hooks");
	const targetHooksDir = join(projectRoot, ".claude", "hooks");
	if (existsSync(hooksDir) && existsSync(targetHooksDir)) {
		for (const file of readdirSync(hooksDir)) {
			cpSync(join(hooksDir, file), join(targetHooksDir, file));
		}
		p.log.success("Hook files updated");
	} else {
		p.log.info("No hooks to update");
	}

	p.outro("Done!");
}

async function cmdRemove() {
	const projectRoot = process.cwd();

	p.intro("ystack remove");

	const proceed = handleCancel(await p.confirm({
		message: "Remove ystack skills and hooks? (keeps .ystack/, docs)",
	}));
	if (!proceed) {
		p.outro("Cancelled.");
		return;
	}

	const s = p.spinner();
	s.start("Removing skills and hooks...");
	removeSkills(projectRoot);
	removeHooks(projectRoot);
	s.stop("Removed skills and hooks");

	p.log.info("Kept: .ystack/, docs/");
	p.outro("Done!");
}

async function cmdCreate() {
	const name = args[1];
	if (!name) {
		console.log(red("\nUsage: ystack create <project-name>\n"));
		process.exit(1);
	}

	const projectDir = resolve(process.cwd(), name);

	if (existsSync(projectDir)) {
		console.log(red(`\nDirectory "${name}" already exists.\n`));
		process.exit(1);
	}

	p.intro(`ystack create — ${name}`);

	const s = p.spinner();
	s.start("Setting up...");

	// Create directory structure
	mkdirSync(join(projectDir, ".claude", "skills"), { recursive: true });
	mkdirSync(join(projectDir, ".context"), { recursive: true });

	// Minimal .ystack config
	const ystackDir = join(projectDir, ".ystack");
	mkdirSync(ystackDir, { recursive: true });
	const config = {
		project: name,
		runtime: "claude-code",
		modules: {},
		workflow: {
			plan_checker: true,
			fresh_context_per_task: true,
			auto_docs_check: true,
		},
	};
	writeFileSync(join(ystackDir, "config.json"), JSON.stringify(config, null, 2) + "\n");

	// Progress directory
	const progressDir = join(ystackDir, "progress");
	mkdirSync(progressDir, { recursive: true });
	writeFileSync(join(progressDir, "_overview.md"), `# Project Progress\n\n## Module Status\n\n| Module | Done | Total | Status |\n|--------|------|-------|--------|\n\n## Ready Front\n\n_No modules registered yet. Run \`/import\` or \`/scaffold\` to get started._\n`);

	// Skills & Hooks
	const skillsResult = copySkills(projectDir, YSTACK_ROOT, true);
	installHooks(projectDir, YSTACK_ROOT);

	// Git init
	try {
		execSync("git init", { cwd: projectDir, stdio: "ignore" });
	} catch { /* user can init manually */ }

	s.stop("Ready");

	p.note(
		[
			`Skills:  ${skillsResult.installed} installed`,
			`Hooks:   context-monitor, workflow-nudge`,
			`Config:  .ystack/config.json`,
		].join("\n"),
		`Created ${name}`,
	);

	p.note(
		[
			`cd ${name}`,
			`Run ${cyan("/create")} in your coding agent to set up the project`,
		].join("\n"),
		"Next steps",
	);

	p.outro("Done!");
}

function usage() {
	console.log(`
${bold("ystack")} — agent harness for doc-driven development

${bold("Commands:")}
  ${green("init")}              Install skills and hooks into an existing project
  ${green("create <name>")}     Create a new project directory with skills and hooks
  ${green("update")}            Update skills and hooks to latest version
  ${green("remove")}            Remove ystack skills and hooks (keeps data)

${bold("After install, run /create in your coding agent to set up the project.")}

${bold("Docs:")}
  https://github.com/yulonghe97/ystack
`);
}

// --- Router ---

switch (command) {
	case "init":
		cmdInit();
		break;
	case "update":
		cmdUpdate();
		break;
	case "remove":
		cmdRemove();
		break;
	case "create":
		cmdCreate();
		break;
	case "--help":
	case "-h":
	case "help":
	case undefined:
		usage();
		break;
	default:
		console.log(red(`Unknown command: ${command}\n`));
		usage();
		process.exit(1);
}
