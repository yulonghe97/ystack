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

function commandExists(cmd) {
	try {
		execSync(`which ${cmd}`, { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

function getPackageManagerVersion(pm) {
	try {
		return execSync(`${pm} --version`, { encoding: "utf-8" }).trim();
	} catch {
		return null;
	}
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

function detectDocsFramework() {
	if (existsSync("docs/src/content/_meta.ts")) return { framework: "nextra", root: "docs/src/content" };
	if (existsSync("content/docs/meta.json")) return { framework: "fumadocs", root: "content/docs" };
	if (existsSync("docs/_meta.ts")) return { framework: "nextra", root: "docs" };
	return null;
}

function detectMonorepo() {
	if (existsSync("turbo.json")) return "turborepo";
	if (existsSync("pnpm-workspace.yaml")) return "pnpm";
	if (existsSync("lerna.json")) return "lerna";
	if (existsSync("nx.json")) return "nx";
	return null;
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

function copyTemplateDir(srcDir, destDir, vars) {
	const entries = readdirSync(srcDir, { withFileTypes: true });
	for (const entry of entries) {
		const srcPath = join(srcDir, entry.name);
		const isTemplate = entry.name.endsWith(".tmpl");
		const destName = isTemplate ? entry.name.slice(0, -5) : entry.name;
		const destPath = join(destDir, destName);

		if (entry.isDirectory()) {
			mkdirSync(destPath, { recursive: true });
			copyTemplateDir(srcPath, destPath, vars);
		} else if (isTemplate) {
			let content = readFileSync(srcPath, "utf-8");
			for (const [key, value] of Object.entries(vars)) {
				content = content.replaceAll(`{{${key}}}`, value);
			}
			writeFileSync(destPath, content);
		} else {
			cpSync(srcPath, destPath);
		}
	}
}

// --- Commands ---

async function cmdInit() {
	const projectRoot = process.cwd();
	const skillsOnly = flags.includes("--skills-only");

	p.intro("ystack init — agent harness for doc-driven development");

	// --- Step 1: Project name ---
	const detectedName = detectProjectName();
	const projectName = handleCancel(await p.text({
		message: "Project name:",
		placeholder: detectedName,
		defaultValue: detectedName,
	}));

	// --- Step 2: Docs framework ---
	const detectedDocs = detectDocsFramework();
	let docsFramework;
	let docsRoot;

	if (detectedDocs) {
		const keepDetected = handleCancel(await p.confirm({
			message: `Detected ${detectedDocs.framework} at ${detectedDocs.root}. Use it?`,
		}));
		if (keepDetected) {
			docsFramework = detectedDocs.framework;
			docsRoot = detectedDocs.root;
		}
	}

	if (!docsFramework) {
		docsFramework = handleCancel(await p.select({
			message: "Docs framework:",
			options: [
				{ label: "Nextra", value: "nextra" },
				{ label: "Fumadocs", value: "fumadocs" },
				{ label: "None — I'll set up docs later", value: "none" },
			],
		}));

		if (docsFramework === "nextra") {
			docsRoot = handleCancel(await p.text({
				message: "Docs root:",
				placeholder: "docs/src/content",
				defaultValue: "docs/src/content",
			}));
		} else if (docsFramework === "fumadocs") {
			docsRoot = handleCancel(await p.text({
				message: "Docs root:",
				placeholder: "content/docs",
				defaultValue: "content/docs",
			}));
		} else {
			docsRoot = null;
		}
	}

	// --- Step 3: Runtime ---
	const runtime = handleCancel(await p.select({
		message: "Runtime:",
		options: [
			{ label: "Claude Code", value: "claude-code" },
			{ label: "Claude Code (skills only, no hooks)", value: "claude-code-minimal" },
		],
	}));

	// --- Step 4: Hooks ---
	let installHooksFlag = true;
	if (!skillsOnly && runtime === "claude-code") {
		installHooksFlag = handleCancel(await p.confirm({
			message: "Install agent linting hooks?",
		}));
	} else if (runtime === "claude-code-minimal") {
		installHooksFlag = false;
	}

	// --- Execute ---
	const s = p.spinner();
	s.start("Setting up...");

	// Skills
	mkdirSync(join(projectRoot, ".claude", "skills"), { recursive: true });
	const result = copySkills(projectRoot, YSTACK_ROOT, true);

	// Hooks
	if (installHooksFlag) {
		installHooks(projectRoot, YSTACK_ROOT);
	}

	// Config
	const ystackDir = join(projectRoot, ".ystack");
	mkdirSync(ystackDir, { recursive: true });
	const configPath = join(ystackDir, "config.json");
	const configExisted = existsSync(configPath);
	if (!configExisted) {
		const monorepo = detectMonorepo();
		const config = {
			project: projectName,
			runtime,
			docs: {
				root: docsRoot,
				framework: docsFramework === "none" ? null : docsFramework,
			},
			monorepo: {
				enabled: !!monorepo,
				...(monorepo ? { tool: monorepo } : {}),
			},
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
	if (installHooksFlag) {
		p.log.success("Hooks: context-monitor, workflow-nudge");
	}
	if (configExisted) {
		p.log.info("Config: .ystack/config.json preserved");
	} else {
		p.log.success("Config: created .ystack/config.json");
	}
	p.log.success("Progress: .ystack/progress/ ready");

	p.note(
		[
			`${cyan("/import")}  — scan codebase and populate module registry`,
			`${cyan("/build")}   — plan a feature`,
			`${cyan("/scaffold")} — scaffold docs from a plan`,
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

	// Parse flags
	const docsFlag = flags.find((f) => f.startsWith("--docs"));
	let docsFramework = "nextra";
	if (docsFlag) {
		const idx = args.indexOf(docsFlag);
		const val = docsFlag.includes("=") ? docsFlag.split("=")[1] : args[idx + 1];
		if (val === "fumadocs" || val === "nextra") {
			docsFramework = val;
		} else {
			console.log(red(`\nUnknown docs framework: ${val}. Use "nextra" or "fumadocs".\n`));
			process.exit(1);
		}
	}

	const fromFlag = flags.find((f) => f.startsWith("--from"));
	if (fromFlag) {
		console.log(yellow("\nScaffold integration from plan files is coming soon."));
		console.log(yellow("Creating base project without plan integration.\n"));
	}

	const projectDir = resolve(process.cwd(), name);

	if (existsSync(projectDir)) {
		console.log(red(`\nDirectory "${name}" already exists.\n`));
		process.exit(1);
	}

	p.intro(`ystack create — scaffolding ${name}`);

	// --- Package manager ---
	const availablePMs = ["pnpm", "npm", "yarn", "bun"].filter(commandExists);
	let pm;
	if (availablePMs.length === 1) {
		pm = availablePMs[0];
	} else {
		pm = handleCancel(await p.select({
			message: "Which package manager?",
			options: availablePMs.map((name) => ({ value: name, label: name })),
		}));
	}
	const pmVersion = getPackageManagerVersion(pm);
	const packageManager = pmVersion ? `${pm}@${pmVersion}` : pm;

	// --- Copy templates ---
	const templatesDir = join(YSTACK_ROOT, "templates");
	const docsRoot = docsFramework === "fumadocs" ? "content/docs" : "docs/src/content";
	const vars = { name, docsRoot, docsFramework, packageManager, pm };

	// Ensure required directories exist (for skills + context)
	mkdirSync(join(projectDir, ".claude/skills"), { recursive: true });
	mkdirSync(join(projectDir, ".context"), { recursive: true });

	console.log(bold("Generating project files..."));
	copyTemplateDir(join(templatesDir, "base"), projectDir, vars);

	// Workspace config varies by package manager
	const workspaces = ["apps/*", "packages/*", "docs"];
	if (pm === "pnpm") {
		writeFileSync(join(projectDir, "pnpm-workspace.yaml"), `packages:\n${workspaces.map((w) => `  - "${w}"`).join("\n")}\n`);
	} else {
		// npm, yarn, bun use workspaces field in package.json
		const pkgPath = join(projectDir, "package.json");
		const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
		pkg.workspaces = workspaces;
		writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
	}

	console.log(green("  ✓ base config (package.json, turbo.json, tsconfig, CLAUDE.md, AGENTS.md, ...)"));

	console.log(bold("Setting up docs app..."));
	copyTemplateDir(join(templatesDir, docsFramework), projectDir, vars);
	console.log(green(`  ✓ docs (${docsFramework === "nextra" ? "Nextra 4" : "Fumadocs"})`));
	console.log();

	// --- Skills & Hooks ---
	console.log(bold("Installing skills..."));
	const skillsResult = copySkills(projectDir, YSTACK_ROOT);
	console.log(dim(`  ${skillsResult.installed} installed, ${skillsResult.skipped} skipped\n`));

	console.log(bold("Installing hooks..."));
	installHooks(projectDir, YSTACK_ROOT);
	console.log(green("  ✓ context-monitor (PostToolUse)"));
	console.log(green("  ✓ workflow-nudge (PreToolUse on Edit)\n"));

	// --- Git init ---
	console.log(bold("Initializing git..."));
	try {
		execSync("git init", { cwd: projectDir, stdio: "ignore" });
		console.log(green("  ✓ git init\n"));
	} catch {
		console.log(yellow("  ⚠ git init failed — initialize manually\n"));
	}

	// --- Summary ---
	p.note(
		[
			`Monorepo:   Turborepo + ${pm} workspaces`,
			`Linting:    Ultracite (Biome)`,
			`Docs:       ${docsFramework === "nextra" ? "Nextra 4" : "Fumadocs"}`,
			`TypeScript: Strict mode, ES2022`,
			`Skills:     ${skillsResult.installed} ystack skills`,
			`Hooks:      context-monitor, workflow-nudge`,
		].join("\n"),
		`Created ${name}`,
	);

	p.note(
		[
			`cd ${name}`,
			`${pm} install`,
			`${pm} dev`,
		].join("\n"),
		"Next steps",
	);

	p.outro("Done!");
}

function usage() {
	console.log(`
${bold("ystack")} — agent harness for doc-driven development

${bold("Commands:")}
  ${green("init")}              Interactive setup — configure docs, runtime, hooks
  ${green("init --skills-only")} Install skills only, skip everything else
  ${green("update")}            Update skills and hooks to latest version
  ${green("remove")}            Remove ystack skills and hooks (keeps data)
  ${green("create <name>")}     Scaffold a new project with opinionated defaults
  ${dim("  --docs nextra|fumadocs")}  Choose docs framework (default: nextra)
  ${dim("  --from plan.md")}          Scaffold integration (coming soon)

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
