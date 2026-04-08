# Installation & Project Setup

## Two Paths

| Path | Command | For |
|------|---------|-----|
| **New project** | `npx ystack create` | Start from scratch with opinionated defaults |
| **Existing project** | `npx ystack init` | Add ystack to a repo that already has code |

---

## New Project: `npx ystack create`

> **Status: Stub only.** `npx ystack create` currently prints "coming soon" and exits. The full behavior described below is planned but not yet implemented. Use `npx ystack init` in an existing project for now.

Creates a fully configured project with opinionated defaults.

```bash
# Minimal — empty project with full tooling (planned)
npx ystack create my-app

# From a plan — scaffold modules from a markdown plan (planned)
npx ystack create my-app --from plan.md

# With options (planned — --runtime flag not yet implemented)
npx ystack create my-app --from plan.md --runtime claude-code --runtime cursor

# Choose docs framework (planned)
npx ystack create my-app --docs nextra
npx ystack create my-app --docs fumadocs
```

### What Gets Created

```
my-app/
├── apps/                        # Application packages (empty, ready for apps)
├── packages/                    # Library packages (empty, ready for shared code)
├── docs/                        # Nextra docs site
│   ├── src/
│   │   └── content/
│   │       ├── _meta.ts         # Top-level navigation
│   │       └── index.mdx        # Project overview
│   ├── next.config.ts
│   ├── package.json
│   └── tsconfig.json
├── .beads/                      # Beads database (bd init)
├── .claude/
│   ├── skills/                  # ystack skills installed
│   │   ├── build/SKILL.md
│   │   ├── go/SKILL.md
│   │   ├── review/SKILL.md
│   │   ├── docs/SKILL.md
│   │   └── pr/SKILL.md
│   ├── rules/                   # Agent lint rules
│   └── settings.json            # Hooks configured
├── .context/                    # (gitignored) ephemeral working files
├── biome.json                   # Ultracite (Biome) config
├── turbo.json                   # Turborepo pipeline config
├── pnpm-workspace.yaml          # pnpm workspace definition
├── package.json                 # Root package with shared scripts
├── tsconfig.json                # Root TypeScript config
├── ystack.config.json           # Module registry (empty, populated by /scaffold)
├── CLAUDE.md                    # AI context for Claude Code
├── AGENTS.md                    # AI context for other agents
├── .gitignore
└── .env.example
```

### Default Stack

| Tool | Version | Role |
|------|---------|------|
| **Turborepo** | Latest | Monorepo task orchestration — build, typecheck, lint across packages |
| **pnpm** | Latest | Package management with workspace support |
| **Ultracite** | Latest | Code linting and formatting (Biome under the hood) |
| **Nextra 4** or **Fumadocs** | Latest | Documentation site — App Router, MDX, renders docs as browsable site. Nextra is the default; use `--docs fumadocs` for Fumadocs. |
| **TypeScript** | 5.8+ | Strict mode, project references |
| **Beads** | Latest | Persistent memory — task graph, session state, cross-session continuity |

### Root `package.json` Scripts

```json
{
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "typecheck": "turbo typecheck",
    "check": "ultracite check",
    "fix": "ultracite fix",
    "clean": "turbo clean"
  }
}
```

### Root `turbo.json`

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

### With `--from plan.md`

When you provide a plan file, `npx ystack create` also runs the `/scaffold` logic:

1. Parses the plan for modules, features, and connections
2. Creates a package directory per module under `apps/` or `packages/`
3. Scaffolds doc pages per module (`docs/src/content/<module>/`)
4. Generates system architecture diagram (Mermaid)
5. Creates `ystack.config.json` with module registry entries
6. Creates epic beads per module with feature children
7. Sets up inter-module dependencies in Beads

**Example plan.md input:**

```markdown
# MyApp

## Modules

### Auth
- Email/password login
- OAuth (Google, GitHub)
- Session management
- Connects to: Database, API

### Payments
- Stripe integration
- Wallet with balance
- Connects to: Auth, Database, API

### Dashboard
- User overview
- Usage charts
- Connects to: Auth, Payments, API
```

**What gets generated (in addition to base setup):**

```
my-app/
├── apps/
│   └── api/                     # Detected from connections
│       └── package.json
├── packages/
│   ├── auth/
│   │   └── package.json
│   ├── payments/
│   │   └── package.json
│   └── db/                      # Detected from "Database" references
│       └── package.json
├── docs/src/content/
│   ├── _meta.ts                 # Updated with module entries
│   ├── index.mdx                # System overview with architecture diagram
│   ├── auth/
│   │   ├── _meta.ts
│   │   └── index.mdx            # Auth overview with feature stubs
│   ├── payments/
│   │   ├── _meta.ts
│   │   └── index.mdx            # Payments overview with feature stubs
│   └── dashboard/
│       ├── _meta.ts
│       └── index.mdx            # Dashboard overview with feature stubs
└── ystack.config.json           # Populated module registry
```

---

## Existing Project: `npx ystack init`

Adds ystack to a repo that already has code, docs, or both.

```bash
cd your-project

# Auto-detect runtimes
npx ystack init

# Specify runtimes (planned — --runtime flag not yet implemented)
npx ystack init --runtime claude-code --runtime cursor

# Minimal — skills only, skip tooling checks
npx ystack init --skills-only
```

### What It Does

1. **Detect environment:**
   - Monorepo? (Turborepo, Nx, Lerna, plain workspaces)
   - Docs framework? (Nextra, Fumadocs, Docusaurus, VitePress, plain markdown)
   - Linter? (Ultracite/Biome, ESLint, none)
   - AI runtimes? (Claude Code, Cursor, Copilot, etc.)

2. **Install skills** for detected runtimes:
   - Claude Code → `.claude/skills/`, hooks in `.claude/settings.json`
   - Cursor → `.cursor/rules/*.mdc` (planned — not yet implemented)
   - Codex → appends to `AGENTS.md` (planned — not yet implemented)
   - etc. (see [RUNTIMES.md](./RUNTIMES.md) — multi-runtime support is planned)

3. **Create `ystack.config.json`** with detected settings:
   ```json
   {
     "docs": {
       "root": "docs/src/content",
       "framework": "nextra"
     },
     "monorepo": {
       "enabled": true,
       "tool": "turborepo"
     },
     "modules": {}
   }
   ```

4. **Initialize Beads** if not already present:
   ```bash
   bd init
   ```

5. **Add to `.gitignore`:**
   ```
   .context/
   ```

6. **Suggest next steps:**
   ```
   ystack installed successfully.

   Next:
   → Run /import to scan your codebase and populate the module registry
   → Or manually add modules to ystack.config.json

   Detected: Turborepo monorepo, Nextra docs, Ultracite linter, Claude Code
   Skills installed: .claude/skills/build, go, review, docs, pr
   ```

### What It Does NOT Do

- Does not install Turborepo, Ultracite, or Nextra (use `create` for that)
- Does not modify existing configs (biome.json, turbo.json, etc.)
- Does not overwrite existing `.claude/` or `.cursor/` files (merges only)
- Does not auto-run `/import` (suggests it, lets you decide)

---

## Updating

```bash
# Update skills to latest version
npx ystack update

# What happens:
# 1. Pulls latest core prompts
# 2. Re-applies adapters for detected runtimes
# 3. Preserves project customizations in ystack.config.json
# 4. Merges hook changes (doesn't overwrite custom hooks)
# 5. Shows changelog of what changed
```

### Customization Preservation

When you customize a skill (edit a SKILL.md), ystack tracks this. On update:

- **Unmodified skills** — replaced with latest version
- **Modified skills** — flagged, not overwritten. Shows diff so you can merge manually
- **Custom rules** in `ystack.config.json` — always preserved
- **Custom hooks** — always preserved

---

## Adding a Runtime (Planned — not yet implemented)

> **Status:** The `ystack add --runtime` command does not exist yet. Multi-runtime support is planned for a future version.

```bash
# Add Cursor support to existing ystack project (planned)
npx ystack add --runtime cursor

# What happens (planned):
# 1. Reads core prompts (already installed)
# 2. Applies cursor adapter → .cursor/rules/*.mdc
# 3. Does not duplicate or modify Claude Code skills
```

---

## Uninstalling

```bash
npx ystack remove

# What happens:
# 1. Removes .claude/skills/ystack-* (only ystack skills)
# 2. Removes ystack hooks from .claude/settings.json
# 3. Removes .cursor/rules/ystack-* (if present)
# 4. Keeps ystack.config.json (your module registry)
# 5. Keeps .beads/ (your Beads data)
# 6. Keeps docs/ (your documentation)
```

Skills and hooks are removed. Your data (registry, beads, docs) is never touched.

---

## Prerequisites

### Required

| Tool | How to install | Why |
|------|---------------|-----|
| **Node.js** 20+ | [nodejs.org](https://nodejs.org) | Runs the installer and Nextra |
| **pnpm** | `npm install -g pnpm` | Workspace package management |
| **Beads** (`bd`) | `brew install gastownhall/tap/beads` or `go install github.com/gastownhall/beads/cmd/bd@latest` | Persistent memory layer |

### Included in `create` (not required for `init`)

| Tool | Installed by | Role |
|------|-------------|------|
| **Turborepo** | `pnpm add -D turbo` | Monorepo task runner |
| **Ultracite** | `pnpm add -D ultracite` | Code linting (Biome) |
| **Nextra 4** | `pnpm add nextra nextra-theme-docs` | Documentation site |

### Optional

| Tool | Why you'd want it |
|------|------------------|
| **Claude Code** | Tier 1 runtime — full subagent + hook support |
| **Cursor** | Tier 2 runtime — inline execution |
| **Codex** | Tier 2 runtime — inline execution |

---

## Quick Start

### New project from scratch (planned — `npx ystack create` is a stub)

```bash
# Create project with plan (planned — currently prints "coming soon")
npx ystack create my-app --from plan.md

# Enter project
cd my-app

# Install dependencies
pnpm install

# Start developing
# (open Claude Code or your preferred agent)
/build implement user authentication
```

### Existing project

```bash
# Add ystack to your repo
cd your-project
npx ystack init

# Scan codebase and populate module registry
/import

# Start building
/build add refund reason to payments
```
