# ystack — Comprehensive Plan

## Problem Statement

AI coding agents are powerful but amnesiac. They lose context across sessions, silently simplify scope, and have no way to verify they delivered what was asked.

**Beads** solves the memory problem — persistent task graph, structured notes, session protocols, compaction survival. But it doesn't know about your documentation, can't orchestrate multi-step execution with fresh context per agent, and doesn't verify that code matches the spec.

**GSD** solves the orchestration problem — goal-backward verification, plans-as-prompts, wave-based execution. But it's 65 commands with its own requirements/roadmap system, disconnected from your actual docs.

**ystack bridges the gap:** doc-driven workflow orchestration on top of Beads' persistent memory.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Developer                                       │
│  /kickoff  /plan  /execute  /verify  /ship       │
├─────────────────────────────────────────────────┤
│  ystack (workflow + doc-driven layer)            │
│  • Reads docs as spec                            │
│  • Orchestrates execution with fresh subagents   │
│  • Goal-backward verification                    │
│  • Doc sync detection                            │
│  • Monorepo-aware shipping                       │
├─────────────────────────────────────────────────┤
│  Beads (persistent memory layer)                 │
│  • Task graph with dependencies                  │
│  • Structured notes (compaction survival)        │
│  • Ready fronts (dependency-driven work)         │
│  • Session protocol (prime → work → handoff)     │
│  • Cross-session continuity (Dolt DB)            │
├─────────────────────────────────────────────────┤
│  Project (your codebase)                         │
│  • CLAUDE.md / AGENTS.md                         │
│  • docs/ (Nextra, MDX — the spec)               │
│  • .claude/skills/, .claude/rules/               │
│  • Existing skills: pr-draft, docs-update, etc.  │
└─────────────────────────────────────────────────┘
```

### What Lives Where

| Concern | Owner | Why |
|---------|-------|-----|
| Task tracking, dependencies, status | **Beads** (`bd`) | Already built, Dolt-backed, handles compaction, merge-safe |
| Structured notes, session state | **Beads** | Built for this — resumability test, compaction survival |
| Ready front computation | **Beads** (`bd ready`) | Graph query on dependency DAG |
| Execution plans | **ystack** (`.context/PLAN.md`) | Plans-as-prompts need specific format for subagent consumption |
| Decisions from intake | **ystack** (`.context/DECISIONS.md`) | Doc-driven, not generic task metadata |
| Execution summaries | **ystack** (`.context/SUMMARY.md`) | Ephemeral per-execution, not worth tracking in Beads |
| Doc-driven spec reading | **ystack** skills | Beads doesn't know about your docs site |
| Goal-backward verification | **ystack** skills | Requires codebase analysis, not task state |
| Orchestration (subagent spawning) | **ystack** skills | GSD-inspired, not in Beads' scope |
| PR creation, doc sync | **ystack** + existing skills | Chains pr-draft, docs-update, commit |

### The `.context/` Directory

Ephemeral working files that ystack skills read/write during a workflow. Not tracked in Beads — these are execution artifacts, not persistent memory.

```
.context/                    # gitignored
├── DECISIONS.md             # Locked choices from /kickoff
├── PLAN.md                  # Current execution plan (the subagent prompt)
└── SUMMARY.md               # Execution results
```

Everything else (task state, notes, dependencies, handoff) lives in **Beads**.

---

## Design Principles

### From GSD (Orchestration)
1. **Plans are prompts** — PLAN.md is the literal prompt the executor receives
2. **Goal-backward verification** — check "what must be TRUE in the codebase" not "what tasks completed"
3. **Fresh context per agent** — each subagent gets a clean context window
4. **Scope reduction prohibition** — never silently simplify user decisions
5. **Plan-checker gate** — validate plan before burning context on execution
6. **Context budget awareness** — orchestrators stay lean, agents read from disk

### From Beads (Memory)
7. **Beads IS the state layer** — don't reinvent task tracking, use `bd`
8. **Structured notes** — COMPLETED / IN PROGRESS / NEXT / KEY DECISIONS / BLOCKERS
9. **Ready fronts over phases** — `bd ready` drives work selection
10. **Session protocol** — `bd prime` at start, structured notes at end
11. **Discovery-driven** — side quests via `bd create --deps discovered-from:<id>`

### Our Own (Doc-Driven)
12. **Docs are the spec** — read Nextra/MDX docs to understand what to build
13. **Assumptions mode** — surface "here's what I'd do" instead of Q&A
14. **Chain, don't replace** — compose with existing pr-draft, docs-update, commit
15. **Monorepo-native** — skills understand package boundaries and scope mapping

---

## Skills

### Phase 1: Beads Integration + Session Protocol

#### `/prime` — Session Start

**Purpose:** Answer "where was I?" using Beads state.

**Process:**
1. Run `bd ready` to get the ready front
2. Check for `.context/PLAN.md` (mid-execution state)
3. Read recent git log for context
4. Output concise status: ready tasks, current plan state, suggested next action

**Beads interaction:** Read-only. Calls `bd ready`, `bd show`.

---

#### `/discover` — Side Quest Capture

**Purpose:** Capture unexpected work without losing focus on current task.

**Process:**
1. Accept description + current bead ID
2. `bd create "<title>" --deps discovered-from:<current-id>`
3. Assess: is this a blocker?
   - Yes → `bd create ... --deps blocks:<current-id>` + suggest pausing
   - No → defer, continue current task
4. Add structured notes to the new bead

**Beads interaction:** `bd create`, `bd dep add`.

---

### Phase 2: Doc-Driven Intake

#### `/kickoff` — Task Intake

**Purpose:** Understand what to build by reading docs + code. Surface assumptions. Capture decisions.

**Process:**
1. Accept task description (e.g., `/kickoff add refund reason to payments`)
2. Find relevant docs pages (scan docs site structure, match by module/feature)
3. Read relevant code (package directory, schema, API routes)
4. Surface assumptions: "Here's what I'd do and why. Correct what's wrong."
5. Capture decisions → `.context/DECISIONS.md`
6. Create beads for the work items:
   ```
   bd create "Add refundReason column to schema" -t task -p 2
   bd create "Update refund API endpoint" -t task -p 2
   bd create "Add refund reason badge to admin" -t task -p 2 --deps blocks:<schema-id>
   ```
7. Add structured notes to each bead with the relevant decisions

**Key design:** Assumptions mode (Beads pattern) is faster than Q&A. Present a plan, let user correct.

**Beads interaction:** `bd create`, `bd update --notes`.

---

### Phase 3: Planning + Execution

#### `/plan` — Execution Planning

**Purpose:** Create an atomic plan that fresh subagents can follow.

**Process:**
1. Read `.context/DECISIONS.md` + relevant docs + code
2. Read ready beads (`bd ready`) to know what to plan for
3. Define success criteria (goal-backward): "What must be TRUE when done?"
4. Break into 2-4 tasks with file targets and verification steps
5. Write `.context/PLAN.md`
6. Spawn plan-checker agent:
   - Does this plan deliver ALL locked decisions?
   - Scope reduction check: silently simplifying anything?
   - Is any task too large for a fresh context?
7. Revise if needed (max 2 iterations)

**PLAN.md format:**
```markdown
# Plan: Add refund reason to payments

## Success Criteria
- [ ] `refundReason` enum column exists on `transactions` table
- [ ] POST /api/payments/refund accepts `reason` field
- [ ] Admin transaction detail shows refund reason badge
- [ ] Types exported from @hellyeah/shared

## Tasks

### task-1: Schema and types (bd-a1b2)
**Files:** packages/db/src/schema.ts, packages/shared/src/types/payments.ts
**Do:** Add `refundReason` column (enum: duplicate, fraud, requested, other). Export type.
**Verify:** `pnpm typecheck` passes. Column exists in schema.

### task-2: API endpoint (bd-c3d4)
**Files:** apps/api/src/routes/payments.ts
**Do:** Accept `reason` in refund endpoint. Validate with Zod.
**Verify:** Endpoint accepts valid reasons, rejects invalid ones.

### task-3: Admin UI (bd-e5f6)
**Files:** apps/admin/src/app/transactions/[id]/page.tsx
**Do:** Add RefundReasonBadge component. Wire to API response.
**Verify:** Badge renders for refunded transactions.
**Depends on:** task-1, task-2
```

Each task references a bead ID so execution updates the right bead.

**Beads interaction:** `bd ready`, `bd show`, `bd update --notes`.

---

#### `/execute` — Plan Execution

**Purpose:** Run PLAN.md with per-task atomic commits and fresh context.

**Process:**
1. Read `.context/PLAN.md`
2. Compute execution order from dependencies (tasks without deps run first)
3. For each task:
   a. `bd update <id> --claim` (atomic claim)
   b. Spawn subagent with: task description + file targets + verification step
   c. Subagent reads ONLY its target files (fresh context)
   d. Subagent makes changes + runs verification
   e. Atomic commit on success
   f. Update bead with structured notes: `bd update <id> --notes "COMPLETED: ..."`
   g. `bd close <id> --reason "Implemented and verified"`
4. Write `.context/SUMMARY.md` with results

**Deviation rules:**
- Auto-fix: minor bugs, missing imports, type errors in adjacent code
- STOP and ask: architectural decisions, new tables, scope changes

**Beads interaction:** `bd update --claim`, `bd update --notes`, `bd close`.

---

#### `/verify` — Goal-Backward Verification

**Purpose:** Check the codebase delivers what was promised.

**Process:**
1. Read success criteria from `.context/PLAN.md`
2. For each criterion, verify against actual code:
   - File/pattern existence (grep, glob)
   - Type checking (`pnpm typecheck`)
   - Test execution (if tests exist)
3. **Distrust SUMMARY.md** — verify independently
4. Output pass/fail report with evidence

**Output:**
```markdown
# Verification Report

- [PASS] `refundReason` column exists — packages/db/src/schema.ts:47
- [PASS] API accepts reason field — apps/api/src/routes/payments.ts:92
- [FAIL] Admin badge not imported in page.tsx
- [PASS] Types exported — packages/shared/src/types/payments.ts:23

## Verdict: 3/4 PASS

## Fix Plan
1. Add import for RefundReasonBadge in page.tsx
```

If failures exist, can auto-generate a fix plan and re-execute.

**Beads interaction:** None (reads code, not beads state).

---

### Phase 4: Ergonomics

#### `/quick` — Lightweight Path

**Purpose:** For tasks too small for the full loop.

**Process:**
1. Accept task description
2. Create a single bead: `bd create "<title>" -t task`
3. Inline plan + execute (no subagent, no PLAN.md)
4. Atomic commit
5. Close bead: `bd close <id> --reason "..."`

**When to use:** Bug fixes, adding a field, small refactors. If >5 files, suggest `/kickoff`.

---

#### `/next` — Ready Front Router

**Purpose:** What should I do next?

**Process:**
1. `bd ready` — get ready front
2. Check state:
   - `.context/PLAN.md` exists but not executed? → `/execute`
   - Executed but not verified? → `/verify`
   - Verified and passing? → `/ship`
   - No plan? Pick highest-priority ready bead → `/plan`
3. Output suggestion, auto-route if unambiguous

---

### Phase 5: Shipping

#### `/ship` — End-to-End PR

**Purpose:** The "I'm done" button.

**Process:**
1. Run `/verify` — stop if failures
2. Detect docs drift: did changes affect documented modules?
   - If yes, suggest/run `docs-update`
3. `pnpm fix` (lint/format)
4. `pnpm typecheck`
5. Delegate to `pr-draft` skill
6. Archive `.context/` files

**Beads interaction:** Verify all beads in scope are closed.

---

#### `/review` — Code Review

**Purpose:** Review diff against project standards.

**Process:**
1. Read project rules (.claude/rules/, CLAUDE.md, contributor guidance, design guide)
2. Read current diff
3. Check: security, accessibility, performance, style, error handling
4. Actionable findings with file:line references

---

### Phase 6: Hooks

#### Context Monitor (PostToolUse)
- At 60% context: suggest subagents for remaining work
- At 80%: suggest `/pause` (which updates bead notes via `bd update`)

#### Session Start
- Auto-run `/prime` when session starts in a project with `.beads/`

#### Workflow Nudge (PreToolUse on Edit)
- If editing code and no `.context/PLAN.md`: soft warning
- "Consider `/kickoff` or `/quick` for tracked changes."

---

## The Workflow

```
Session Start
  │
  /prime (auto — reads bd ready + git log)
  │
  ├── Resuming? → bd show <in-progress> → /next
  │
  ├── Trivial? → /quick (one bead, inline execution)
  │
  ├── Standard?
  │     /kickoff → /plan → /execute → /verify → /ship
  │     │
  │     ├── Side quest? → /discover (bd create --deps discovered-from:...)
  │     ├── Pausing? → bd update --notes "IN PROGRESS: ..."
  │     └── Done? → /ship
  │
  └── Large?
        /kickoff → [/plan → /execute → /verify] × N → /ship
        (bd ready drives which beads to plan next)
```

---

## Prerequisites

- **Beads** (`bd`) installed and initialized in the project (`bd init`)
- **Claude Code** with skills support
- Project with documentation (Nextra/MDX preferred, any markdown works)

## Installation

```bash
# Install Beads
brew install gastownhall/tap/beads  # or: go install github.com/gastownhall/beads/cmd/bd@latest

# Initialize Beads in your project
cd your-project
bd init

# Install ystack skills
npx ystack init  # copies skills to .claude/skills/, hooks to .claude/settings.json
```

---

## File Structure

```
ystack/
├── skills/                  # Claude Code skills
│   ├── prime/SKILL.md
│   ├── kickoff/SKILL.md
│   ├── plan/
│   │   ├── SKILL.md
│   │   └── resources/
│   │       └── plan-checker.md    # Plan-checker agent prompt
│   ├── execute/
│   │   ├── SKILL.md
│   │   └── resources/
│   │       └── executor.md        # Executor agent prompt
│   ├── verify/SKILL.md
│   ├── quick/SKILL.md
│   ├── next/SKILL.md
│   ├── discover/SKILL.md
│   ├── ship/SKILL.md
│   └── review/SKILL.md
├── hooks/
│   ├── context-monitor.js
│   ├── session-start.sh
│   └── workflow-nudge.js
├── templates/
│   ├── DECISIONS.md           # Template for decisions file
│   └── PLAN.md                # Template for plan file
├── docs/
│   ├── getting-started.md
│   ├── skills.md
│   ├── workflow.md
│   └── beads-integration.md
├── examples/
│   ├── monorepo/
│   └── single-app/
├── install.js
├── package.json
├── CLAUDE.md
├── README.md
└── LICENSE
```

---

## Build Order

| Phase | What | Depends On |
|-------|------|------------|
| **1** | `/prime`, `/discover`, `/quick` + Beads integration | Beads installed |
| **2** | `/kickoff` (doc-driven intake) | Phase 1 |
| **3** | `/plan` + plan-checker agent | Phase 2 |
| **4** | `/execute` + executor agent | Phase 3 |
| **5** | `/verify` | Phase 4 |
| **6** | `/next`, `/ship`, `/review` | Phase 5 |
| **7** | Hooks, installer, docs | Phase 6 |

---

## Open Questions

1. **Beads version pinning** — minimum `bd` version to depend on?
2. **Docs framework** — start Nextra-native, generalize later? Or framework-agnostic from day 1?
3. **Parallel execution** — should `/execute` spawn parallel subagents for independent tasks from day 1?
4. **Linear sync** — Beads supports external refs (`bd update --external-ref linear:LIN-123`). Enable by default?
5. **Formula integration** — should ystack ship Beads formulas (proto templates) for common workflows?
