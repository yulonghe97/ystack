# Changelog

## 0.2.2 — 2026-04-09

### Fixed

- CLI: use relative paths in `.claude/settings.json` instead of absolute paths that break on other machines
- CLI: write `package.json` with `"type": "module"` into `.claude/hooks/` so ESM imports work in any consuming repo
- `progress-before-ship` hook: resolve default branch dynamically via `git symbolic-ref` instead of hardcoding `main`
- `docs-match-progress` hook: use longest-match when resolving modules to avoid `shared` matching before `shared/payments`
- `workflow-nudge` hook: scope state file per repo to prevent cross-project leakage

---

## 0.2.1 — 2026-04-09

### Fixed

- `no-undocumented-check` hook: double `docs/` prefix when resolving doc paths — progress anchors already include the full path, so prepending `docsRoot` caused lookups to fail silently
- `session-start` hook: `xargs basename .md` returned `.md` instead of the module name

---

## 0.2.0 — 2026-04-09

**Breaking:** Replaces Beads with git-native progress files. No migration path from 0.1.0 — run `npx ystack init` to set up the new `.ystack/` directory.

### Breaking Changes

- `ystack.config.json` moved to `.ystack/config.json`
- `.beads/` directory no longer used — progress tracked in `.ystack/progress/*.md`
- `"epic"` field removed from module registry entries
- `.context/<bead-id>/` renamed to `.context/<feature-slug>/`
- `bd` CLI no longer required

### Added

- **`/quick` skill** — fast path for bug fixes, chores, and small changes (skips planning and progress)
- **`progress-before-ship` hook** — warns on PR if code changed but progress not updated
- **`docs-match-progress` hook** — catches `[x]` items with stubbed doc sections
- **`no-undocumented-check` hook** — warns when checking a box with stub docs still present
- **`/pr` runs `/docs` inline** when it detects stubbed doc sections for completed features

### Changed

- Progress tracked via markdown checklists in `.ystack/progress/<module>.md` instead of Beads
- `workflow-nudge` hook now recognizes `/quick` mode and stays silent
- `progress-before-ship` hook skips warning for small diffs (5 or fewer code files)
- `session-start` hook reads `.ystack/progress/` instead of `bd ready`

### Removed

- Beads (`bd` CLI) dependency
- `PLAN.md` project roadmap (content lives in individual skill files)
- Beads installation flow from `ystack init` and `ystack create`

---

## 0.1.0 — 2026-04-09

First public release. Claude Code only.

### Features

- **CLI** — `ystack create`, `init`, `update`, `remove` commands with interactive prompts (@clack/prompts)
- **Skills** — `/build`, `/go`, `/review`, `/docs`, `/pr`, `/import`, `/scaffold`, `/address-review`
- **Hooks** — context-monitor, workflow-nudge, session-start
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
