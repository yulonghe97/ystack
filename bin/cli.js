#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createInterface } from "node:readline";

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

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(question, defaultVal) {
	return new Promise((resolve) => {
		const prompt = defaultVal
			? `${cyan("?")} ${question} ${dim(`(${defaultVal})`)} `
			: `${cyan("?")} ${question} `;
		rl.question(prompt, (answer) => {
			resolve(answer.trim() || defaultVal || "");
		});
	});
}

function select(question, options, defaultIndex = 0) {
	return new Promise((resolve) => {
		console.log(`${cyan("?")} ${question}`);
		for (let i = 0; i < options.length; i++) {
			const marker = i === defaultIndex ? green("❯ ") : "  ";
			console.log(`${marker}${options[i].label}`);
		}
		rl.question(`${dim(`  Enter choice [1-${options.length}]: `)}`, (answer) => {
			const idx = Number.parseInt(answer, 10) - 1;
			if (idx >= 0 && idx < options.length) {
				resolve(options[idx].value);
			} else {
				resolve(options[defaultIndex].value);
			}
		});
	});
}

function confirm(question, defaultYes = true) {
	return new Promise((resolve) => {
		const hint = defaultYes ? "Y/n" : "y/N";
		rl.question(`${cyan("?")} ${question} ${dim(`(${hint})`)} `, (answer) => {
			const a = answer.trim().toLowerCase();
			if (a === "") resolve(defaultYes);
			else resolve(a === "y" || a === "yes");
		});
	});
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
				command: `node "${join(projectRoot, ".claude", "hooks", "context-monitor.js")}"`,
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
				command: `node "${join(projectRoot, ".claude", "hooks", "workflow-nudge.js")}"`,
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
				(h) => !h.hooks?.some((hh) => hh.command?.includes("context-monitor")),
			);
		}
		if (settings.hooks?.PreToolUse) {
			settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(
				(h) => !h.hooks?.some((hh) => hh.command?.includes("workflow-nudge")),
			);
		}
		writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
	} catch { /* ignore */ }

	const hooksDir = join(projectRoot, ".claude", "hooks");
	for (const file of ["context-monitor.js", "session-start.sh", "workflow-nudge.js"]) {
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
	const skillsOnly = flags.includes("--skills-only");

	console.log(`\n${bold("ystack init")} — agent harness for doc-driven development\n`);

	// --- Step 1: Project name ---
	const detectedName = detectProjectName();
	const projectName = await ask("Project name:", detectedName);

	// --- Step 2: Docs framework ---
	const detectedDocs = detectDocsFramework();
	let docsFramework;
	let docsRoot;

	if (detectedDocs) {
		console.log(dim(`  detected: ${detectedDocs.framework} at ${detectedDocs.root}`));
		const keepDetected = await confirm(`Use ${detectedDocs.framework}?`);
		if (keepDetected) {
			docsFramework = detectedDocs.framework;
			docsRoot = detectedDocs.root;
		}
	}

	if (!docsFramework) {
		docsFramework = await select("Docs framework:", [
			{ label: "Nextra", value: "nextra" },
			{ label: "Fumadocs", value: "fumadocs" },
			{ label: "None — I'll set up docs later", value: "none" },
		]);

		if (docsFramework === "nextra") {
			docsRoot = await ask("Docs root:", "docs/src/content");
		} else if (docsFramework === "fumadocs") {
			docsRoot = await ask("Docs root:", "content/docs");
		} else {
			docsRoot = null;
		}
	}

	// --- Step 3: Beads ---
	let initBeads = false;
	if (!skillsOnly) {
		const hasBeads = existsSync(join(projectRoot, ".beads"));
		const hasBdCli = commandExists("bd");

		if (hasBeads) {
			console.log(dim("  Beads already initialized"));
		} else if (hasBdCli) {
			initBeads = await confirm("Initialize Beads for persistent memory?");
		} else {
			const installBeads = await select("Beads (persistent memory for agents):", [
				{ label: "Install Beads (brew install gastownhall/tap/beads)", value: "install" },
				{ label: "Skip — I'll set up Beads later", value: "skip" },
			]);

			if (installBeads === "install") {
				console.log(`\n${bold("Installing Beads...")}`);
				try {
					execSync("brew install gastownhall/tap/beads", { stdio: "inherit" });
					initBeads = true;
				} catch {
					console.log(yellow("  ⚠ Brew install failed. Install manually: brew install gastownhall/tap/beads"));
					console.log(yellow("    or: go install github.com/gastownhall/beads/cmd/bd@latest"));
				}
			}
		}
	}

	// --- Step 4: Runtime ---
	const runtime = await select("Runtime:", [
		{ label: "Claude Code", value: "claude-code" },
		{ label: "Claude Code (skills only, no hooks)", value: "claude-code-minimal" },
	]);

	// --- Step 5: Hooks ---
	let installHooksFlag = true;
	if (!skillsOnly && runtime === "claude-code") {
		installHooksFlag = await confirm("Install agent linting hooks?");
	} else if (runtime === "claude-code-minimal") {
		installHooksFlag = false;
	}

	// --- Execute ---
	console.log(`\n${bold("Setting up...")}\n`);

	// Skills
	console.log(bold("Skills:"));
	mkdirSync(join(projectRoot, ".claude", "skills"), { recursive: true });
	const result = copySkills(projectRoot, YSTACK_ROOT);
	console.log(dim(`  ${result.installed} installed, ${result.skipped} skipped\n`));

	// Hooks
	if (installHooksFlag) {
		console.log(bold("Hooks:"));
		installHooks(projectRoot, YSTACK_ROOT);
		console.log(green("  ✓ context-monitor (PostToolUse)"));
		console.log(green("  ✓ workflow-nudge (PreToolUse on Edit)"));
		console.log();
	}

	// Config
	console.log(bold("Config:"));
	const configPath = join(projectRoot, "ystack.config.json");
	if (existsSync(configPath)) {
		console.log(dim("  ystack.config.json already exists, preserving"));
	} else {
		const monorepo = detectMonorepo();
		const config = {
			project: projectName,
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
		console.log(green("  ✓ created ystack.config.json"));
	}

	ensureGitignore(projectRoot);
	console.log(green("  ✓ .context/ added to .gitignore"));
	console.log();

	// Beads
	if (initBeads) {
		console.log(bold("Beads:"));
		try {
			execSync("bd init", { stdio: "inherit", cwd: projectRoot });
			console.log(green("  ✓ Beads initialized"));
		} catch {
			console.log(yellow("  ⚠ bd init failed — run it manually"));
		}
		console.log();
	}

	// --- Done ---
	console.log(`${bold(green("Done!"))}\n`);
	console.log("Next steps:");
	console.log(`  ${cyan("/import")}  — scan codebase and populate module registry`);
	console.log(`  ${cyan("/build")}   — plan a feature`);
	console.log(`  ${cyan("/skeleton")} — scaffold docs from a plan\n`);

	rl.close();
}

async function cmdUpdate() {
	const projectRoot = process.cwd();

	console.log(`\n${bold("ystack update")}\n`);

	console.log(bold("Skills:"));
	const result = copySkills(projectRoot, YSTACK_ROOT);
	console.log(dim(`  ${result.installed} updated, ${result.skipped} customized (preserved)\n`));

	console.log(bold("Hooks:"));
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

	console.log(`${bold(green("Done!"))}\n`);
	rl.close();
}

async function cmdRemove() {
	const projectRoot = process.cwd();

	console.log(`\n${bold("ystack remove")}\n`);

	const proceed = await confirm("Remove ystack skills and hooks? (keeps config, beads, docs)");
	if (!proceed) {
		console.log(dim("\nCancelled.\n"));
		rl.close();
		return;
	}

	console.log(`\n${bold("Removing skills:")}`);
	removeSkills(projectRoot);

	console.log(`\n${bold("Removing hooks:")}`);
	removeHooks(projectRoot);

	console.log(dim("\nKept: ystack.config.json, .beads/, docs/"));
	console.log(`\n${bold(green("Done!"))}\n`);
	rl.close();
}

async function cmdCreate() {
	const name = args[1];
	if (!name) {
		console.log(red("\nUsage: ystack create <project-name>\n"));
		rl.close();
		process.exit(1);
	}
	console.log(yellow("\nystack create is coming soon."));
	console.log(yellow("For now, set up your project manually and run: ystack init\n"));
	rl.close();
}

function usage() {
	console.log(`
${bold("ystack")} — agent harness for doc-driven development

${bold("Commands:")}
  ${green("init")}              Interactive setup — configure docs, beads, runtime, hooks
  ${green("init --skills-only")} Install skills only, skip everything else
  ${green("update")}            Update skills and hooks to latest version
  ${green("remove")}            Remove ystack skills and hooks (keeps data)
  ${green("create <name>")}     Scaffold a new project (coming soon)

${bold("Docs:")}
  https://github.com/yulonghe97/ystack
`);
	rl.close();
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
