# Installation & Project Setup

> **Note:** v0.1 supports Claude Code only. Multi-runtime support (Cursor, Codex, etc.) is planned for a future version. See [RUNTIMES.md](./RUNTIMES.md).

## Install

```bash
# Option A: skills only (via skills.sh)
npx skills add yulonghe97/ystack

# Option B: skills + agent linting hooks
cd your-project && npx ystack init

# Option C: new project from scratch
npx ystack create my-app && cd my-app
```

**Option A** installs just the skills — good if you want the workflow without the hooks.

**Options B and C** also install [agent linting hooks](./LINTING.md) that enforce the doc-driven workflow (read spec before coding, plan before executing, verify before shipping).

Then open your coding agent and run `/create` to finish setup.

### What gets installed

```
your-project/
├── .claude/
│   ├── skills/                  # ystack skills
│   │   ├── create/SKILL.md      # Project setup (stack choices, configs)
│   │   ├── build/SKILL.md       # Plan a feature
│   │   ├── go/SKILL.md          # Execute a plan
│   │   ├── scaffold/SKILL.md    # Scaffold docs from a plan
│   │   ├── import/SKILL.md      # Scan existing codebase
│   │   ├── review/SKILL.md      # Code review + verification
│   │   ├── docs/SKILL.md        # Update docs for completed work
│   │   ├── pr/SKILL.md          # Create PR
│   │   ├── quick/SKILL.md       # Fast path for small changes
│   │   └── address-review/SKILL.md
│   ├── hooks/                   # Agent linting hooks
│   └── settings.json            # Hook configuration
├── .ystack/
│   ├── config.json              # Module registry (empty until /create or /import)
│   └── progress/                # Progress tracking
└── .context/                    # (gitignored) ephemeral working files
```

### What `/create` does

The `/create` skill runs interactively in your coding agent. It:

1. Detects whether this is a blank repo or existing project
2. **Blank repo:** proposes the default stack, lets you override any choice, generates all project files
3. **Existing project:** detects what's there, adds ystack conventions without overwriting

#### Default stack (recommended)

| Tool | Role |
|------|------|
| **Turborepo** | Monorepo task orchestration |
| **pnpm** | Package management with workspaces |
| **TypeScript** | Strict mode, ES2022 |
| **Ultracite** | Code linting and formatting (Biome) |
| **Nextra 4** | Documentation site |

The agent adapts if you want something different — npm instead of pnpm, Vite instead of Turbo, Fumadocs instead of Nextra, etc.

---

## Updating

```bash
npx ystack update
```

- **Unmodified skills** — replaced with latest version
- **Modified skills** — flagged, not overwritten
- **Hooks** — updated
- **Config** (`.ystack/config.json`) — always preserved

---

## Uninstalling

```bash
npx ystack remove
```

Removes skills and hooks. Your data (`.ystack/`, docs) is never touched.

---

## Prerequisites

| Tool | How to install | Why |
|------|---------------|-----|
| **Node.js** 20+ | [nodejs.org](https://nodejs.org) | Runs the CLI |
| **Claude Code** | [claude.ai/code](https://claude.ai/code) | Runs the skills |

---

## Quick Start

### New project from scratch

```bash
npx ystack create my-app
cd my-app

# Open your coding agent, then:
/create
# → sets up project with recommended stack

/scaffold
# → scaffold docs from a plan

/build implement user authentication
# → plan the first feature
```

### Existing project

```bash
cd your-project
npx ystack init

# Open your coding agent, then:
/create
# → detects your stack, adds ystack conventions

/import
# → scan codebase and populate module registry

/build add refund reason to payments
# → start building
```
