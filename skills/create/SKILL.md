---
name: create
description: >
  Set up a new project or add ystack conventions to an existing repo. Recommends
  a default stack (Turborepo + pnpm + TypeScript + Ultracite + Nextra) but adapts
  to whatever the user prefers. Works for blank repos and existing codebases alike.
  Use this skill when the user says 'create', '/create', 'set up project',
  'initialize project', 'new project', 'bootstrap', or has just run `ystack create`
  or `ystack init` and needs to finish setting up.
user-invocable: true
---

# /create — Set Up a Project

You are the project setup skill for ystack. Your job is to create (or adapt) a project with the right file structure, tooling, and ystack conventions so the rest of the workflow (`/build`, `/go`, `/docs`, `/pr`) works smoothly.

**You generate files directly.** No templates — you create each file based on the conventions below and the user's choices.

---

## Phase 0: Detect Context

Determine what you're working with.

1. Check if this is a blank repo or an existing project:
   ```bash
   ls package.json 2>/dev/null || ls pyproject.toml 2>/dev/null || ls go.mod 2>/dev/null || ls Cargo.toml 2>/dev/null
   ```

2. Check what ystack has already set up:
   ```bash
   ls .ystack/config.json 2>/dev/null
   ls .claude/skills/ 2>/dev/null
   ```

3. **Blank repo** (no project files, or only git + `.claude/`):
   → Continue to Phase 1 (full setup)

4. **Existing project** (has package.json or equivalent):
   → Skip to [Existing Project Flow](#existing-project-flow)

## Phase 1: Understand What to Build

Ask the user what they're building. One question:

> What are you building? (e.g., "a SaaS app with auth and payments", "a CLI tool", "a component library")
>
> I'll set up a monorepo with our recommended stack. You can override any choice.

If the user already described their project (in the conversation or a plan file), skip the question and use that context.

## Phase 2: Choose the Stack

Present the recommended defaults and let the user override:

```
Recommended stack:

  Package manager:  pnpm
  Monorepo:         Turborepo
  Language:         TypeScript (strict)
  Linting:          Ultracite (Biome)
  Docs:             Nextra 4

Want to change anything, or should I proceed with these defaults?
```

If the user wants changes, adapt. Common alternatives:

| Choice | Alternatives | What changes |
|--------|-------------|--------------|
| Package manager | npm, yarn, bun | Workspace config format, lockfile |
| Monorepo tool | Nx, none (single package) | Build orchestration config |
| Language | JavaScript, Python, Go, Rust | Config files, compiler settings |
| Linting | ESLint + Prettier, Biome direct, ruff (Python) | Lint config, scripts |
| Docs | Fumadocs, Starlight, MkDocs, none | Docs app setup |

**Wait for confirmation before generating files.**

## Phase 3: Generate Project Files

Create all project files based on the chosen stack. Below are the conventions for the recommended defaults — adapt if the user chose differently.

### Root `package.json`

```json
{
  "name": "<project-name>",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "typecheck": "turbo typecheck",
    "check": "ultracite check",
    "fix": "ultracite fix",
    "clean": "turbo clean"
  },
  "packageManager": "<pm>@<version>",
  "devDependencies": {
    "turbo": "latest",
    "typescript": "^5.8.0",
    "ultracite": "latest"
  }
}
```

- `packageManager` field: detect the current version with `<pm> --version`
- Scripts should cover: dev, build, typecheck, lint check, lint fix, clean
- If not using Turborepo, adjust scripts to the chosen tool

### Workspace config

**pnpm** — create `pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "docs"
```

**npm/yarn/bun** — add `workspaces` field to `package.json`:
```json
{
  "workspaces": ["apps/*", "packages/*", "docs"]
}
```

### `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": { "persistent": true, "cache": false },
    "build": { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] },
    "clean": { "cache": false }
  }
}
```

### `tsconfig.json` (root)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist"
  },
  "exclude": ["node_modules", "dist", ".turbo"]
}
```

### `biome.json`

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "extends": ["ultracite"]
}
```

### `.gitignore`

```
node_modules/
dist/
.turbo/
.next/
.context/
.env
.env.local
*.tsbuildinfo
```

Adapt to the chosen stack — add framework-specific patterns as needed.

### `.env.example`

Create an empty `.env.example` as a placeholder for environment variables.

### Directory structure

Create these directories with placeholder `AGENTS.md` stubs:

- `apps/AGENTS.md` — "Application packages live here."
- `packages/AGENTS.md` — "Shared library packages live here."

### Docs app

**Nextra 4** (default):

Create `docs/` with:
- `package.json` — name: `<project>-docs`, dependencies: `next`, `nextra`, `nextra-theme-docs`, `react`, `react-dom`
- `next.config.ts` — Nextra configuration
- `tsconfig.json` — extends root, includes `src/`
- `src/app/layout.jsx` — root layout
- `src/app/[[...mdxPath]]/page.jsx` — catch-all page
- `src/mdx-components.js` — MDX components export
- `src/content/_meta.ts` — navigation: `{ index: "Overview" }`
- `src/content/index.mdx` — welcome page with project name

**Fumadocs** — similar structure with `content/docs/` layout and `meta.json` navigation.

**Other/None** — skip docs app, set `docs.framework: null` in config.

### CLAUDE.md (project root)

```markdown
# <Project Name>

This project uses [ystack](https://github.com/yulonghe97/ystack) for doc-driven development.

## Structure

- `apps/` — Application packages
- `packages/` — Shared library packages
- `docs/` — Documentation site (<docs framework>)

## Module Registry

Modules are defined in `.ystack/config.json`. Each module maps code directories to documentation pages.

## Available Commands

| Command | Description |
|---------|-------------|
| `/import` | Scan codebase and populate module registry |
| `/build <feature>` | Plan a feature (reads docs + code, surfaces assumptions) |
| `/go` | Execute the plan with fresh subagents |
| `/review` | Code review + goal-backward verification |
| `/docs` | Update documentation for completed work |
| `/pr` | Verify, docs check, create PR |

## Scripts

- `<pm> dev` — Start dev servers
- `<pm> build` — Build all packages
- `<pm> typecheck` — Type-check all packages
- `<pm> check` — Lint
- `<pm> fix` — Auto-fix lint issues
- `<pm> clean` — Clean build artifacts
```

Adapt the scripts section to match whatever build tool and package manager were chosen.

### AGENTS.md (project root)

```markdown
# <Project Name>

This project uses [ystack](https://github.com/yulonghe97/ystack) for doc-driven development.

## Structure

- `apps/` — Application packages
- `packages/` — Shared library packages
- `docs/` — Documentation site (<docs framework>)

## Module Registry

Modules are defined in `.ystack/config.json`. Each module maps code directories to documentation pages.

## Workflow

1. Read the relevant doc page before making changes
2. Plan before executing — break work into small, verifiable tasks
3. Verify against success criteria after implementation
4. Update docs when done — only document completed, verified work

## Scripts

- `<pm> dev` — Start dev servers
- `<pm> build` — Build all packages
- `<pm> typecheck` — Type-check all packages
- `<pm> check` — Lint
- `<pm> fix` — Auto-fix lint issues
- `<pm> clean` — Clean build artifacts
```

## Phase 4: Generate ystack Config

### `.ystack/config.json`

```json
{
  "project": "<project-name>",
  "runtime": "claude-code",
  "docs": {
    "root": "<docs-root-path>",
    "framework": "<chosen-framework>"
  },
  "monorepo": {
    "enabled": true,
    "tool": "<chosen-tool>"
  },
  "modules": {},
  "workflow": {
    "plan_checker": true,
    "fresh_context_per_task": true,
    "auto_docs_check": true
  }
}
```

- `docs.root`: `docs/src/content` (Nextra), `content/docs` (Fumadocs), or null
- `docs.framework`: `nextra`, `fumadocs`, or null
- `monorepo.tool`: `turborepo`, `nx`, or null
- `modules`: empty — populated later by `/import` or `/scaffold`

### `.ystack/progress/_overview.md`

```markdown
# Project Progress

## Module Status

| Module | Done | Total | Status |
|--------|------|-------|--------|

## Ready Front

_No modules registered yet. Run `/import` or `/scaffold` to get started._
```

## Phase 5: Summary

Present what was created:

```
## Project Ready

### Stack
  Package manager:  pnpm
  Monorepo:         Turborepo
  Language:         TypeScript (strict)
  Linting:          Ultracite (Biome)
  Docs:             Nextra 4

### Structure
  apps/             — application packages
  packages/         — shared libraries
  docs/             — documentation site

### ystack
  .ystack/config.json    — module registry (empty)
  .ystack/progress/      — progress tracking
  CLAUDE.md + AGENTS.md  — agent context

### Next Steps
  1. `<pm> install` to install dependencies
  2. `/scaffold` with a project plan to set up modules and docs
  3. `/build <feature>` to start building
```

---

## Existing Project Flow

When the project already has files (package.json, source code, etc.), adapt rather than overwrite.

### Step 1: Detect What Exists

Scan for:
- Package manager (lockfile: pnpm-lock.yaml, package-lock.json, yarn.lock, bun.lockb)
- Monorepo tool (turbo.json, nx.json, lerna.json)
- Language (tsconfig.json, jsconfig.json, pyproject.toml, go.mod)
- Linting (biome.json, .eslintrc*, prettier config)
- Docs (docs/, content/, any docs framework)
- Existing CLAUDE.md or AGENTS.md

### Step 2: Present Findings

```
Detected existing project:

  Name:            <from package.json>
  Package manager: pnpm (from pnpm-lock.yaml)
  Monorepo:        Turborepo (from turbo.json)
  Language:        TypeScript
  Linting:         ESLint + Prettier
  Docs:            none detected

I'll add ystack conventions without changing your existing setup.
Want me to proceed?
```

**Wait for confirmation.**

### Step 3: Add ystack Conventions

Only add what's missing — never overwrite existing files:

1. **`.ystack/config.json`** — create if missing, with detected values
2. **`.ystack/progress/_overview.md`** — create if missing
3. **`CLAUDE.md`** — create if missing, describing the actual project structure and scripts
4. **`AGENTS.md`** — create if missing, with workflow guidance
5. **`.gitignore`** — append `.context/` if not already ignored
6. **`.env.example`** — create if missing

Do NOT:
- Change package.json scripts
- Add or change build tool configs
- Modify existing lint configs
- Restructure the project

### Step 4: Summary

```
## ystack Added

### Created
  .ystack/config.json    — module registry
  .ystack/progress/      — progress tracking
  CLAUDE.md              — agent context (adapted to your project)

### Next Steps
  1. `/import` to scan your codebase and populate the module registry
  2. `/build <feature>` to start building
```

---

## What This Skill Does NOT Do

- **Does not install dependencies.** The user runs `<pm> install` themselves.
- **Does not scaffold modules.** That's `/scaffold`.
- **Does not scan existing code.** That's `/import`.
- **Does not write application code.** That's `/build` + `/go`.
- **Does not overwrite existing files** in existing projects without asking.
