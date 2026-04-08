# Multi-Runtime Support

> **Status: Future Roadmap / Design Spec**
> This document describes a planned multi-runtime adapter architecture. It is NOT implemented. v0.1 supports Claude Code only. Everything below is retained as a roadmap and specification for future versions.

## The Problem

AI coding agents all have different conventions:

| Runtime | Skills/Commands | Rules/Context | Hooks | Subagents |
|---------|----------------|---------------|-------|-----------|
| Claude Code | `.claude/skills/`, `.claude/commands/` | `CLAUDE.md`, `.claude/rules/` | `.claude/settings.json` hooks | `Agent()` tool with `subagent_type` |
| Codex | `AGENTS.md` instructions | `AGENTS.md` | None | None (single-agent) |
| Cursor | `.cursor/rules/*.mdc` | `.cursorrules` | None | None |
| Copilot | `.github/copilot-instructions.md` | Same file | None | None |
| Windsurf | `.windsurfrules` | Same file | None | None |
| Gemini CLI | `.gemini/` | `.gemini/GEMINI.md` | `.gemini/settings.json` | Task-based |

ystack's core logic — read docs, surface assumptions, create plans, verify against criteria — is just prompts. It works in any agent. The only thing that changes is how the prompts are packaged and delivered.

## Architecture (Planned)

> **Not yet built.** The `core/prompts/` and `adapters/<runtime>/` structure below is the target design. In v0.1, skills are installed directly as `.claude/skills/` files for Claude Code only.

```
ystack/
├── core/                        # Agent-agnostic
│   ├── prompts/                 # The actual skill logic (markdown)
│   │   ├── build.md
│   │   ├── go.md
│   │   ├── review.md
│   │   ├── docs.md
│   │   ├── pr.md
│   │   ├── skeleton.md
│   │   └── import.md
│   ├── agents/                  # Subagent prompts
│   │   ├── plan-checker.md
│   │   └── executor.md
│   ├── rules/                   # Agent lint rules (declarative)
│   │   ├── spec-before-plan.json
│   │   ├── no-scope-reduction.json
│   │   └── docs-before-ship.json
│   └── templates/
│       ├── DECISIONS.md
│       └── PLAN.md
│
├── adapters/                    # Runtime-specific packaging
│   ├── claude-code/             # → .claude/skills/, .claude/rules/, hooks
│   ├── codex/                   # → AGENTS.md with embedded instructions
│   ├── cursor/                  # → .cursor/rules/*.mdc
│   ├── copilot/                 # → .github/copilot-instructions.md
│   ├── windsurf/                # → .windsurfrules
│   └── gemini/                  # → .gemini/ directory
│
└── install.js                   # Detects runtime, applies adapter
```

### Core (agent-agnostic)

The prompts in `core/prompts/` are the actual skill logic. They reference:
- `ystack.config.json` for the module registry
- `bd` CLI for Beads operations
- Doc page paths (resolved from the registry)
- `.context/<bead-id>/` for temporary state

These are pure markdown instructions that any LLM can follow. They don't use Claude-specific features, tool names, or XML tags.

### Adapters (Planned — not yet implemented)

Each adapter takes the core prompts and packages them for a specific runtime:

**Claude Code adapter:**
- Wraps each prompt as a `.claude/skills/<name>/SKILL.md`
- Installs lint rules as hooks in `.claude/settings.json`
- Registers subagent types for plan-checker and executor
- Supports parallel subagent execution via `Agent()` tool

**Codex adapter:**
- Compiles all prompts into sections of `AGENTS.md`
- No hooks (Codex doesn't support them) — lint rules become inline instructions
- No subagents — execution runs inline in single context
- Commands referenced as natural language triggers

**Cursor adapter:**
- Wraps prompts as `.cursor/rules/*.mdc` with frontmatter (globs, description)
- Rules applied contextually based on file patterns
- No hooks — lint rules become rule file instructions
- No subagents — single context execution

**Copilot adapter:**
- Compiles into `.github/copilot-instructions.md`
- Minimal format — instructions only, no hooks or subagents

**Gemini CLI adapter:**
- Wraps as `.gemini/` skills
- Hook support via `.gemini/settings.json`
- Task-based subagent execution

## Capability Tiers (Planned)

Not all runtimes can do everything. ystack degrades gracefully:

| Capability | Tier 1 (full) | Tier 2 (inline) | Tier 3 (instructions) |
|------------|--------------|-----------------|----------------------|
| **Runtimes** | Claude Code, Gemini CLI | Codex, Cursor | Copilot, Windsurf |
| **Subagents** | Yes — fresh context per task | No — inline execution | No |
| **Hooks** | Yes — pre/post tool use | No — rules embedded in prompts | No |
| **Beads** | Full (`bd` CLI) | Full (`bd` CLI) | Full (`bd` CLI) |
| **Docs reading** | Selective (agent navigates) | Selective | Selective |
| **Plan-checker** | Separate agent validates | Self-check in same context | Self-check |
| **Parallel execution** | Yes (wave-based) | Sequential | Sequential |
| **Agent linting** | Hook-enforced | Prompt-instructed | Prompt-instructed |

### Tier 1: Full Harness

Claude Code and Gemini CLI support subagents and hooks. They get the full experience:
- `/go` spawns fresh subagents per task (context rot prevention)
- Lint rules enforced via hooks (hard blocks)
- Plan-checker runs as a separate agent
- Parallel wave-based execution

### Tier 2: Inline Execution

Codex and Cursor can run `bd` commands and read files, but have no subagent support. The harness adapts:
- `/go` executes tasks sequentially in the same context
- Plan-checker runs as a self-review step (not a separate agent)
- Lint rules are embedded in the prompt ("before editing, verify you've read the spec")
- No parallel execution — tasks run one at a time

This is still valuable. The workflow (build → go → review → docs → pr) works the same. You lose context isolation but keep the structure.

### Tier 3: Instructions Only

Copilot and Windsurf have minimal configuration. They get the workflow as natural language instructions:
- No slash commands — the instructions describe the process to follow
- The agent is told: "When asked to build a feature, first read the module's doc page..."
- Beads still works (any agent with shell access can use `bd`)
- Verification is self-check only

Even at this tier, having Beads + docs + module registry is a significant upgrade over nothing.

## What Stays Universal

Regardless of runtime, every agent gets:

1. **Beads** — any agent with shell access can run `bd ready`, `bd create`, `bd close`. The persistent memory layer works everywhere.

2. **Docs** — every agent can read markdown files. The documentation-as-spec pattern is runtime-agnostic.

3. **Module registry** — `ystack.config.json` is JSON. Any agent can parse it to find the right doc page and code scope.

4. **`.context/<bead-id>/`** — PLAN.md and DECISIONS.md are markdown files. Any agent can read and write them.

5. **The workflow** — build → go → review → docs → pr is a process, not a tool feature. It works in any agent that can follow multi-step instructions.

## Installation (Planned)

> **v0.1:** Only `npx ystack init` (Claude Code) is implemented. The `--runtime` flags and multi-runtime detection described below are planned for a future version.

```bash
# Auto-detect runtime
npx ystack init

# Specify runtime (planned — not yet implemented)
npx ystack init --claude-code
npx ystack init --codex
npx ystack init --cursor
npx ystack init --copilot
npx ystack init --windsurf
npx ystack init --gemini

# Install multiple (planned)
npx ystack init --claude-code --cursor

# Update after ystack upgrade
npx ystack update
```

The installer (planned behavior):
1. Detects which runtimes are present (checks for `.claude/`, `.cursor/`, `AGENTS.md`, etc.)
2. Reads `core/` prompts
3. Applies the appropriate adapter
4. Writes files to the runtime's expected locations
5. Preserves any existing configuration (merges, doesn't overwrite)

## Contributing an Adapter (Future)

To add support for a new runtime:

1. Create `adapters/<runtime>/` directory
2. Implement the adapter interface:
   - `detectRuntime()` — how to detect this runtime is in use
   - `installSkills(corePrompts)` — how to package and write skill files
   - `installRules(coreRules)` — how to package lint rules (hooks or inline)
   - `installHooks(coreHooks)` — how to install hooks (or skip if unsupported)
3. Define the capability tier (1, 2, or 3)
4. Add to the installer's runtime registry

The adapter should be thin — under 200 lines. All the logic lives in `core/`.
