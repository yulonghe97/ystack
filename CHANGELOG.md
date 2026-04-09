# Changelog

## 0.1.0 — 2026-04-09

First public release. Claude Code only.

### Features

- **CLI** — `ystack create`, `init`, `update`, `remove` commands with interactive prompts (@clack/prompts)
- **Skills** — `/build`, `/go`, `/review`, `/docs`, `/pr`, `/import`, `/scaffold`, `/address-review`
- **Hooks** — context-monitor (tracks context usage), workflow-nudge (suggests `/build` when editing without a plan), session-start (shows ready front)
- **Module registry** — `ystack.config.json` maps code scopes to doc pages and Beads epics
- **Beads integration** — persistent task memory with epics, features, ready front, structured notes
- **Docs support** — Nextra 4 and Fumadocs, framework-agnostic doc layer
- **`ystack create`** — scaffolds a full monorepo (Turborepo, pnpm, Ultracite, TypeScript strict, docs site)
- **`ystack init`** — adds ystack to an existing project with auto-detection of docs framework, monorepo tool, and Beads

### Design

- Three-layer architecture: Docs (what it is), Beads (what's done), Code (the implementation)
- Doc-driven workflow: read spec, plan, execute, verify, update docs
- Fresh subagent per task for context isolation
- Wave-based parallel execution with dependency tracking
- Goal-backward verification against success criteria
