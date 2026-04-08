# ystack — Comprehensive Plan

## Problem Statement

AI coding agents are powerful but amnesiac. They lose context across sessions, silently simplify scope, and have no way to verify they delivered what was asked. Current solutions either:

- **Over-engineer** (GSD: 65 commands, 24 agents, Dolt database) — too heavy for most teams
- **Under-serve** (ad-hoc CLAUDE.md files) — no workflow, no state, no verification

ystack sits in the middle: **12 composable skills, markdown-based state, doc-driven specs**.

## Design Principles

### Stolen from GSD
1. **Plans are prompts** — PLAN.md is the literal prompt the executor receives, not a document that becomes one
2. **Goal-backward verification** — check "what must be TRUE in the codebase" not "what tasks completed"
3. **Fresh context per agent** — each subagent gets a clean context window (prevents quality degradation as context fills)
4. **Scope reduction prohibition** — never silently simplify user decisions; split into phases instead
5. **Plan-checker gate** — validate plan will achieve goals BEFORE burning context on execution
6. **Context budget awareness** — orchestrators stay lean, agents read files from disk

### Stolen from Beads
7. **Structured notes for compaction survival** — COMPLETED / IN PROGRESS / NEXT / KEY DECISIONS / BLOCKERS format
8. **Ready fronts over rigid phases** — dependency-driven work selection, not sequential phase numbers
9. **Discovery-driven workflow** — side quests are first-class with provenance tracking
10. **Resumability test** — "would a fresh Claude instance resume from this description alone?"
11. **Session protocol** — prime at start, structured handoff at end
12. **Temporal layering** — TaskCreate for hours (tactical), `.context/` for days (strategic)

### Our Own
13. **Docs are the spec** — existing documentation (Nextra, MDX, any markdown site) replaces GSD's REQUIREMENTS.md
14. **Lightweight state** — markdown files in `.context/`, not a database
15. **Monorepo-native** — skills understand package boundaries and scope mapping
16. **Chain, don't replace** — new skills compose with existing tools (pr-draft, docs-update, commit)

---

## Architecture

```
ystack/
├── skills/                  # Claude Code skills (the main product)
│   ├── prime/               # Session start — load context
│   ├── kickoff/             # Task intake — surface assumptions, capture decisions
│   ├── plan/                # Create execution plan with goal-backward criteria
│   ├── execute/             # Run plan with per-task atomic commits
│   ├── verify/              # Goal-backward verification against codebase
│   ├── quick/               # Lightweight path for small tasks
│   ├── next/                # Compute ready front, route to next action
│   ├── pause/               # Save structured handoff state
│   ├── resume/              # Restore context from handoff
│   ├── discover/            # Capture side-quest work with provenance
│   ├── ship/                # Chain: verify → audit-docs → pr-draft → create PR
│   └── review/              # Code review against project rules
├── hooks/                   # Claude Code hooks
│   ├── context-monitor.js   # Warn when context fills
│   ├── session-start.sh     # Auto-run /prime
│   └── workflow-nudge.js    # Soft warning for edits without a plan
├── templates/               # File templates
│   ├── context/             # .context/ directory templates
│   └── plans/               # PLAN.md structure
├── docs/                    # ystack's own documentation
│   ├── getting-started.md
│   ├── skills.md
│   ├── workflow.md
│   └── configuration.md
├── examples/                # Example configurations
│   ├── monorepo/            # Monorepo setup (Turborepo, pnpm)
│   ├── single-app/          # Single app setup
│   └── docs-site/           # Nextra/MDX docs site setup
├── CLAUDE.md                # ystack's own Claude Code config
├── install.js               # Installer script
└── package.json
```

---

## The `.context/` Directory

The state layer. Gitignored. Survives LLM compaction because it's on disk.

```
.context/                    # Created by /prime or /kickoff
├── WORK.md                  # Active work items with structured notes
├── DECISIONS.md             # Locked choices from /kickoff
├── HANDOFF.md               # Pause/resume state
├── PLAN.md                  # Current execution plan
├── SUMMARY.md               # Execution results
└── codebase/                # Optional: /map-codebase output
    ├── ARCHITECTURE.md
    ├── CONVENTIONS.md
    └── CONCERNS.md
```

### WORK.md Format (Beads-inspired)

```markdown
# Active Work

## task-1: Add refund reason to payments
- **Status:** in_progress
- **Discovered from:** kickoff
- **Blocked by:** —
- **COMPLETED:** Added `refundReason` column to schema
- **IN PROGRESS:** Exposing via Hono API
- **NEXT:** Add admin UI display
- **KEY DECISIONS:** Using enum type, not free text
- **BLOCKERS:** None

## task-2: Update payments docs
- **Status:** open
- **Discovered from:** task-1
- **Blocked by:** task-1
- **NEXT:** Update docs/src/content/shared/payments.mdx with new field
```

### DECISIONS.md Format (GSD-inspired)

```markdown
# Decisions

## Locked
- Refund reason uses an enum: `duplicate`, `fraud`, `requested`, `other`
- Column added to `transactions` table, not a separate table
- Admin displays reason in transaction detail panel

## Claude's Discretion
- Exact column name (convention: camelCase)
- Migration file naming

## Deferred
- Filtering transactions by refund reason (future work)
```

### HANDOFF.md Format

```markdown
# Handoff — 2025-03-15

## What's Done
- Schema migration created and applied
- API endpoint updated with `refundReason` field

## What's In Progress
- Admin UI: component created but not wired to API

## What's Next
1. Wire `RefundReasonBadge` to transaction detail API call
2. Run `pnpm typecheck` to verify
3. Run `/verify` to check success criteria

## Key Decisions Made
- Used enum type (see DECISIONS.md)

## Blockers
- None
```

---

## Skills — Detailed Specifications

### Phase 1: Foundation

#### `/prime` — Session Start Ritual

**Purpose:** Answer "where was I?" at the start of every session.

**Trigger:** SessionStart hook (automatic) or manual invocation.

**Process:**
1. Check for `.context/` directory
2. If exists: read WORK.md, HANDOFF.md, recent git log — output summary
3. If not: output project overview from CLAUDE.md/AGENTS.md
4. Show ready front (tasks with no blockers)
5. Suggest next action

**Output:** Concise status block, not a wall of text. Under 30 lines.

**Key design:** Does NOT modify any files. Read-only. Fast.

---

#### `/pause` — Structured Handoff

**Purpose:** Save state so a future session (or different developer) can resume.

**Process:**
1. Read current `.context/WORK.md` and recent git log
2. Generate HANDOFF.md with: done, in progress, next, decisions, blockers
3. Apply resumability test: "would a fresh Claude resume from this alone?"
4. If test fails, add implementation details (working code samples, API shapes)
5. Write HANDOFF.md

**Key design:** Must be fast — developer is about to close the terminal.

---

#### `/resume` — Context Restoration

**Purpose:** Restore full context from a previous session.

**Process:**
1. Read HANDOFF.md + WORK.md + DECISIONS.md + recent git log
2. Reconstruct context
3. Output summary
4. Route to `/next`

**Key design:** Replaces the "let me understand the codebase" preamble that wastes context.

---

### Phase 2: Core Workflow

#### `/kickoff` — Task Intake

**Purpose:** Understand what to build before writing code. Replace ad-hoc exploration with structured intake.

**Process:**
1. Accept task description as argument (e.g., `/kickoff add refund reason to payments`)
2. Find relevant docs pages (scan docs site structure, match by module/feature name)
3. Read relevant code (package directory, schema files, API routes)
4. Surface assumptions (Beads pattern): "Here's what I'd do and why. Correct what's wrong."
   - Not a Q&A — present a plan and let user correct
5. Capture locked decisions, discretion areas, deferred items → DECISIONS.md
6. Create initial work items → WORK.md

**Key design:** Assumptions mode is faster than Q&A for experienced developers. Questions only for genuine ambiguity.

---

#### `/plan` — Execution Planning

**Purpose:** Create an atomic execution plan that a fresh subagent can follow.

**Process:**
1. Read DECISIONS.md + relevant docs + relevant code
2. Define success criteria (goal-backward): "What must be TRUE when done?"
3. Break into 2-4 tasks, each with:
   - Description (what to do)
   - File targets (which files to read/modify)
   - Verification step (how to check it worked)
4. Write PLAN.md
5. Spawn plan-checker agent:
   - Does this plan deliver ALL locked decisions?
   - Are any tasks missing?
   - Is any task too large for a fresh context?
   - Scope reduction check: are we silently simplifying anything?
6. Revise if checker finds issues (max 2 iterations)

**PLAN.md format:**
```markdown
# Plan: Add refund reason to payments

## Success Criteria
- [ ] `refundReason` enum column exists on `transactions` table
- [ ] POST /api/payments/refund accepts `reason` field
- [ ] Admin transaction detail shows refund reason badge
- [ ] Types exported from @hellyeah/shared

## Tasks

### task-1: Schema and types
**Files:** packages/db/src/schema.ts, packages/shared/src/types/payments.ts
**Do:** Add `refundReason` column (enum: duplicate, fraud, requested, other). Export type.
**Verify:** `pnpm typecheck` passes. Column exists in schema.

### task-2: API endpoint
**Files:** apps/api/src/routes/payments.ts
**Do:** Accept `reason` in refund endpoint. Validate with Zod.
**Verify:** Endpoint accepts valid reasons, rejects invalid ones.

### task-3: Admin UI
**Files:** apps/admin/src/app/transactions/[id]/page.tsx
**Do:** Add RefundReasonBadge component. Wire to API response.
**Verify:** Badge renders for refunded transactions.
**Depends on:** task-1, task-2
```

---

#### `/execute` — Plan Execution

**Purpose:** Run PLAN.md with per-task atomic commits and fresh context.

**Process:**
1. Read PLAN.md
2. Compute execution order from dependencies (wave-based: independent tasks can parallelize)
3. For each task:
   a. Spawn subagent with task description + file targets (fresh context)
   b. Subagent reads only the files it needs
   c. Subagent makes changes + runs verification step
   d. Atomic commit on success
   e. Update WORK.md with structured notes
4. Write SUMMARY.md with results

**Deviation rules (from GSD):**
- Rule 1: Auto-fix minor bugs encountered during implementation
- Rule 2: Auto-add missing critical functionality (e.g., forgotten import)
- Rule 3: Auto-fix blocking issues (e.g., type error in adjacent code)
- Rule 4: STOP and ask for architectural decisions (e.g., "this requires a new table")

**Key design:** Each subagent gets ONLY its task + file targets. No accumulated context from previous tasks. This is the core context rot prevention mechanism.

---

#### `/verify` — Goal-Backward Verification

**Purpose:** Check the codebase delivers what was promised, not just that tasks ran.

**Process:**
1. Read success criteria from PLAN.md
2. For each criterion, check the actual codebase:
   - File existence checks (does the column exist in schema?)
   - Grep for expected patterns (is the API route wired?)
   - Type checking (`pnpm typecheck`)
   - Run relevant tests if they exist
3. Explicitly distrust SUMMARY.md claims — verify independently
4. Output pass/fail report with evidence

**Output format:**
```markdown
# Verification Report

## Results
- [PASS] `refundReason` column exists — packages/db/src/schema.ts:47
- [PASS] API accepts reason field — apps/api/src/routes/payments.ts:92
- [FAIL] Admin badge not rendering — component exists but not imported in page.tsx
- [PASS] Types exported — packages/shared/src/types/payments.ts:23

## Verdict: 3/4 PASS — needs fix for admin import

## Fix Plan
1. Add import for RefundReasonBadge in apps/admin/src/app/transactions/[id]/page.tsx
```

---

### Phase 3: Developer Experience

#### `/quick` — Lightweight Path

**Purpose:** For tasks too small to need the full kickoff → plan → execute loop.

**Process:**
1. Accept task description
2. Inline plan (no subagent): identify files, define success criteria
3. Execute directly (no subagent): make changes, verify
4. Atomic commit
5. Update WORK.md

**When to use:** Bug fixes, adding a field, renaming something, small refactors. If it touches >5 files, suggest `/kickoff` instead.

---

#### `/next` — Ready Front Router

**Purpose:** Compute what's ready to work on and route to the right action.

**Process:**
1. Read WORK.md
2. Find items with no blockers and status=open (the "ready front")
3. Check current state:
   - No PLAN.md? → suggest `/plan`
   - PLAN.md exists, not executed? → suggest `/execute`
   - Executed, not verified? → suggest `/verify`
   - Verified and passing? → suggest `/ship`
4. Output suggestion and auto-route if unambiguous

---

#### `/discover` — Side Quest Capture

**Purpose:** During any task, capture unexpected work without losing focus.

**Process:**
1. Accept description + current task context
2. Create new item in WORK.md with `discovered-from: <current-task>`
3. Assess: is this a blocker for current work?
   - Yes → update dependency, suggest pausing current task
   - No → defer, continue current task
4. Return to current work

---

### Phase 4: Quality & Shipping

#### `/ship` — End-to-End PR Creation

**Purpose:** The "I'm done" button. Chains verification, docs check, and PR creation.

**Process:**
1. Run `/verify` — if failures exist, stop and report
2. Check docs drift: did code changes affect documented modules?
   - If yes, suggest/run `docs-update` skill
3. Run `pnpm fix` (lint/format)
4. Run `pnpm typecheck`
5. Delegate to `pr-draft` skill for PR creation
6. Clean up `.context/` (archive, don't delete)

---

#### `/review` — Code Review

**Purpose:** Review current diff against project standards.

**Process:**
1. Read project rules (.claude/rules/, CLAUDE.md, contributor guidance, design guide)
2. Read current diff
3. Check for: security issues, accessibility, performance, code style violations, missing error handling
4. Output actionable findings with file:line references

---

### Phase 5: Hooks

#### Context Monitor (PostToolUse)
- Track approximate context usage
- At 60%: suggest spawning subagents for remaining work
- At 80%: suggest `/pause` to save state

#### Session Start
- Auto-run `/prime` when a new Claude Code session starts in a project with `.context/`

#### Workflow Nudge (PreToolUse on Edit)
- If editing code and no PLAN.md exists in `.context/`: soft warning
- "You're editing without a plan. Consider `/kickoff` or `/quick` for tracked changes."
- Warning only, never blocking

---

## The Workflow

```
Session Start
  │
  /prime (auto — "where was I?")
  │
  ├── Resuming? → /resume → /next
  │
  ├── New task (trivial)? → /quick
  │
  ├── New task (standard)?
  │     /kickoff → /plan → /execute → /verify → /ship
  │     │
  │     ├── Side quest found? → /discover (defer or block)
  │     ├── Pausing? → /pause
  │     └── Done? → /ship
  │
  └── New task (large)?
        /kickoff → [/plan → /execute → /verify] × N → /ship
        (dependency graph drives order via /next)
```

---

## Build Order

| Phase | Skills | Rationale |
|-------|--------|-----------|
| **1** | `/prime`, `/pause`, `/resume` + `.context/` templates | Foundation — everything reads/writes `.context/` |
| **2** | `/kickoff`, `/plan` | Intake and planning — the thinking layer |
| **3** | `/execute`, `/verify` | Execution and verification — the doing layer |
| **4** | `/quick`, `/next`, `/discover` | Ergonomics — faster paths and side quests |
| **5** | `/ship`, `/review` | Quality gates and shipping |
| **6** | Hooks, installer, docs | Polish and distribution |

---

## Configuration

ystack is configured via a `ystack.config.json` in the project root (or `.context/config.json`):

```json
{
  "docs": {
    "root": "docs/src/content",
    "framework": "nextra"
  },
  "monorepo": {
    "enabled": true,
    "scopes": {
      "apps/api": "api",
      "apps/admin": "admin",
      "packages/shared": "shared",
      "packages/db": "db"
    }
  },
  "workflow": {
    "plan_checker": true,
    "fresh_context_per_task": true,
    "auto_prime": true,
    "auto_docs_check": true
  },
  "gates": {
    "confirm_plan": true,
    "confirm_execute": true,
    "confirm_ship": true
  }
}
```

---

## What Makes ystack Different

| vs. GSD | vs. Beads | vs. Raw Claude Code |
|---------|-----------|---------------------|
| 12 skills, not 65 commands | Markdown files, not Dolt DB | Actual workflow, not ad-hoc |
| Docs ARE the spec | No Go binary to install | Cross-session continuity |
| Monorepo-native | Same structured notes, less infrastructure | Goal-backward verification |
| Chains into existing skills | Integrated with doc-driven flow | Dependency-driven work selection |
| Minutes to set up | Minutes to set up | Already there (but limited) |

---

## Open Questions

1. **Distribution:** npm package (`npx ystack init`) or git clone?
2. **Docs framework agnostic?** Start Nextra-native, generalize later?
3. **Multi-agent coordination:** Should `/execute` support parallel subagents from day 1, or add later?
4. **Linear integration:** Should WORK.md items sync to Linear issues?
5. **Skill dependencies:** Should ystack bundle `pr-draft`/`docs-update` or declare them as peer dependencies?
