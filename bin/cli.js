#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const YSTACK_ROOT = resolve(__dirname, "..");

// Colors
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

const args = process.argv.slice(2);
const command = args[0];
const flags = args.filter((a) => a.startsWith("--"));
const positional = args.filter((a) => !a.startsWith("--"));

function usage() {
	console.log(`
${bold("ystack")} — agent harness for doc-driven development

${bold("Commands:")}
  ${green("init")}              Add ystack to an existing project
  ${green("init --skills-only")} Install skills only, skip hooks and config
  ${green("update")}            Update skills to latest version
  ${green("add --runtime <r>")} Add support for a runtime (claude-code)
  ${green("remove")}            Remove ystack skills and hooks (keeps data)
  ${green("create <name>")}     Scaffold a new project (coming soon)

${bold("Options:")}
  --runtime <name>  Specify runtime (default: auto-detect)
  --skills-only     Install skills only
  --help            Show this help

${bold("Docs:")}
  https://github.com/yulonghe97/ystack
`);
}

function detectRuntimes(projectRoot) {
	const runtimes = [];
	if (existsSync(join(projectRoot, ".claude"))) {
		runtimes.push("claude-code");
	}
	// Future: detect .cursor/, AGENTS.md for codex, etc.
	return runtimes.length > 0 ? runtimes : ["claude-code"]; // default
}

function hashFile(path) {
	if (!existsSync(path)) return null;
	const content = readFileSync(path, "utf-8");
	return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

function copySkills(projectRoot, ystackRoot) {
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

		// Check if target exists and was customized
		if (existsSync(dstSkill)) {
			const srcHash = hashFile(srcSkill);
			const dstHash = hashFile(dstSkill);
			if (srcHash !== dstHash) {
				console.log(
					yellow(`  ⚠ ${skill}/ — customized, skipping (use --force to overwrite)`),
				);
				skipped++;
				continue;
			}
		}

		// Copy skill directory
		mkdirSync(dst, { recursive: true });
		cpSync(src, dst, { recursive: true });
		installed++;
		console.log(green(`  ✓ ${skill}/`));
	}

	return { installed, skipped, total: skills.length };
}

function installHooks(projectRoot, ystackRoot) {
	const settingsPath = join(projectRoot, ".claude", "settings.json");
	let settings = {};

	if (existsSync(settingsPath)) {
		try {
			settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		} catch {
			console.log(yellow("  ⚠ Could not parse .claude/settings.json, creating new"));
		}
	}

	// Ensure hooks structure
	if (!settings.hooks) settings.hooks = {};

	// Add PostToolUse hooks
	if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];

	const hasContextMonitor = settings.hooks.PostToolUse.some(
		(h) => h.command && h.command.includes("context-monitor"),
	);

	if (!hasContextMonitor) {
		settings.hooks.PostToolUse.push({
			matcher: "*",
			hooks: [
				{
					type: "command",
					command: `node "${join(projectRoot, ".claude", "hooks", "context-monitor.js")}"`,
					timeout: 5,
				},
			],
		});
		console.log(green("  ✓ context-monitor hook"));
	}

	// Add PreToolUse hooks for workflow nudge
	if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];

	const hasWorkflowNudge = settings.hooks.PreToolUse.some(
		(h) => h.command && h.command.includes("workflow-nudge"),
	);

	if (!hasWorkflowNudge) {
		settings.hooks.PreToolUse.push({
			matcher: "Edit|Write",
			hooks: [
				{
					type: "command",
					command: `node "${join(projectRoot, ".claude", "hooks", "workflow-nudge.js")}"`,
					timeout: 5,
				},
			],
		});
		console.log(green("  ✓ workflow-nudge hook"));
	}

	// Write settings
	mkdirSync(dirname(settingsPath), { recursive: true });
	writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");

	// Copy hook files
	const hooksDir = join(ystackRoot, "hooks");
	const targetHooksDir = join(projectRoot, ".claude", "hooks");
	mkdirSync(targetHooksDir, { recursive: true });

	if (existsSync(hooksDir)) {
		for (const file of readdirSync(hooksDir)) {
			const src = join(hooksDir, file);
			const dst = join(targetHooksDir, file);
			cpSync(src, dst);
		}
		console.log(green("  ✓ hook files copied"));
	}
}

function removeSkills(projectRoot) {
	const skillsDir = join(projectRoot, ".claude", "skills");
	const ystackSkills = join(YSTACK_ROOT, "skills");

	if (!existsSync(ystackSkills)) return;

	const skills = readdirSync(ystackSkills).filter((d) =>
		statSync(join(ystackSkills, d)).isDirectory(),
	);

	for (const skill of skills) {
		const target = join(skillsDir, skill);
		if (existsSync(target)) {
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
				(h) => !h.hooks?.some((hh) => hh.command?.includes("context-monitor")),
			);
		}
		if (settings.hooks?.PreToolUse) {
			settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(
				(h) => !h.hooks?.some((hh) => hh.command?.includes("workflow-nudge")),
			);
		}

		writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
		console.log(dim("  removed hooks from settings.json"));
	} catch {
		console.log(yellow("  ⚠ Could not parse settings.json"));
	}

	// Remove hook files
	const hooksDir = join(projectRoot, ".claude", "hooks");
	for (const file of ["context-monitor.js", "session-start.sh", "workflow-nudge.js"]) {
		const target = join(hooksDir, file);
		if (existsSync(target)) {
			rmSync(target);
			console.log(dim(`  removed ${file}`));
		}
	}
}

function ensureGitignore(projectRoot) {
	const gitignorePath = join(projectRoot, ".gitignore");
	if (!existsSync(gitignorePath)) return;

	const content = readFileSync(gitignorePath, "utf-8");
	if (!content.includes(".context/")) {
		writeFileSync(gitignorePath, content.trimEnd() + "\n.context/\n");
		console.log(green("  ✓ added .context/ to .gitignore"));
	}
}

function createConfig(projectRoot) {
	const configPath = join(projectRoot, "ystack.config.json");
	if (existsSync(configPath)) {
		console.log(dim("  ystack.config.json already exists, skipping"));
		return;
	}

	// Detect docs framework
	let docsRoot = null;
	let framework = "unknown";

	if (existsSync(join(projectRoot, "docs", "src", "content", "_meta.ts"))) {
		docsRoot = "docs/src/content";
		framework = "nextra";
	} else if (existsSync(join(projectRoot, "content", "docs", "meta.json"))) {
		docsRoot = "content/docs";
		framework = "fumadocs";
	} else if (existsSync(join(projectRoot, "docs"))) {
		docsRoot = "docs";
	}

	// Detect monorepo
	const isMonorepo = existsSync(join(projectRoot, "turbo.json")) ||
		existsSync(join(projectRoot, "pnpm-workspace.yaml")) ||
		existsSync(join(projectRoot, "lerna.json"));

	const config = {
		project: projectRoot.split("/").pop(),
		docs: {
			root: docsRoot,
			framework,
		},
		monorepo: {
			enabled: isMonorepo,
		},
		modules: {},
		workflow: {
			plan_checker: true,
			fresh_context_per_task: true,
			auto_docs_check: true,
		},
	};

	writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
	console.log(green("  ✓ created ystack.config.json"));
}

// --- Commands ---

function cmdInit() {
	const projectRoot = process.cwd();
	const skillsOnly = flags.includes("--skills-only");

	console.log(bold("\nystack init\n"));

	// Detect runtimes
	const runtimes = detectRuntimes(projectRoot);
	console.log(dim(`  detected: ${runtimes.join(", ")}\n`));

	// Install skills
	console.log(bold("Skills:"));
	mkdirSync(join(projectRoot, ".claude", "skills"), { recursive: true });
	const result = copySkills(projectRoot, YSTACK_ROOT);
	console.log(
		dim(`  ${result.installed} installed, ${result.skipped} skipped\n`),
	);

	if (!skillsOnly) {
		// Install hooks
		console.log(bold("Hooks:"));
		installHooks(projectRoot, YSTACK_ROOT);
		console.log();

		// Create config
		console.log(bold("Config:"));
		createConfig(projectRoot);
		ensureGitignore(projectRoot);
		console.log();

		// Check for Beads
		console.log(bold("Beads:"));
		if (existsSync(join(projectRoot, ".beads"))) {
			console.log(green("  ✓ .beads/ detected"));
		} else {
			try {
				execSync("which bd", { stdio: "ignore" });
				console.log(
					yellow("  ⚠ bd CLI found but .beads/ not initialized. Run: bd init"),
				);
			} catch {
				console.log(
					yellow("  ⚠ Beads not installed. Install: brew install gastownhall/tap/beads"),
				);
			}
		}
		console.log();
	}

	console.log(bold("Done!\n"));
	console.log("Next steps:");
	console.log(`  ${green("/import")}  — scan codebase and populate module registry`);
	console.log(`  ${green("/build")}   — plan a feature`);
	console.log();
}

function cmdUpdate() {
	const projectRoot = process.cwd();

	console.log(bold("\nystack update\n"));

	console.log(bold("Skills:"));
	const result = copySkills(projectRoot, YSTACK_ROOT);
	console.log(
		dim(`  ${result.installed} updated, ${result.skipped} customized (preserved)\n`),
	);

	console.log(bold("Hooks:"));
	// Re-copy hook files (not settings.json — those are merged on init)
	const hooksDir = join(YSTACK_ROOT, "hooks");
	const targetHooksDir = join(projectRoot, ".claude", "hooks");
	if (existsSync(hooksDir) && existsSync(targetHooksDir)) {
		for (const file of readdirSync(hooksDir)) {
			cpSync(join(hooksDir, file), join(targetHooksDir, file));
		}
		console.log(green("  ✓ hook files updated\n"));
	} else {
		console.log(dim("  no hooks to update\n"));
	}

	console.log(bold("Done!\n"));
}

function cmdRemove() {
	const projectRoot = process.cwd();

	console.log(bold("\nystack remove\n"));

	console.log(bold("Removing skills:"));
	removeSkills(projectRoot);
	console.log();

	console.log(bold("Removing hooks:"));
	removeHooks(projectRoot);
	console.log();

	console.log(dim("Kept: ystack.config.json, .beads/, docs/\n"));
	console.log(bold("Done!\n"));
}

function cmdCreate() {
	const name = positional[1];
	if (!name) {
		console.log(red("Usage: ystack create <project-name>"));
		process.exit(1);
	}
	console.log(
		yellow(
			"\nystack create is coming soon.\nFor now, set up your project manually and run: ystack init\n",
		),
	);
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
	case "add":
		// For now, just re-run init
		console.log(dim("Running init to add runtime support...\n"));
		cmdInit();
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
