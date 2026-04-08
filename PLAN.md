# ystack — Plan

## Problem

AI coding agents need two things they don't have:

1. **Memory** — persistent state across sessions (solved by Beads)
2. **Workflow** — a guided path from "I want to build X" to "PR created" (solved by ystack)

The workflow should be dead simple to learn. Not 65 commands. Not 10 commands. **4 commands + 2 confirmation checkpoints.**

## The Flow

```
/build add refund reason to payments
  → checks status, reads docs + code, creates plan
  → presents plan to user

User confirms or corrects the plan

/go
  → splits into tasks, executes with fresh subagents
  → atomic commit per task
  → shows results

/review
  → code review against project rules
  → returns findings

User confirms (or asks for fixes)

/docs
  → detects which doc pages are affected
  → updates them

/pr
  → verify → docs check → pr-draft → create PR
```

For small tasks, `/build` detects simplicity and asks: "This is small — want me to just do it?" — collapsing `/go` into the same step.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Developer                                       │
│  /build   /go   /review   /docs   /pr            │
├─────────────────────────────────────────────────┤
│  ystack (workflow layer)                         │
│  • Reads docs as spec                            │
│  • Plans with goal-backward criteria             │
│  • Executes with fresh subagents                 │
│  • Reviews against project rules                 │
│  • Detects doc drift, syncs docs                 │
│  • Chains into pr-draft for shipping             │
├─────────────────────────────────────────────────┤
│  Beads (memory layer)                            │
│  • Task graph with dependencies                  │
│  • Structured notes (compaction survival)        │
│  • Ready fronts (dependency-driven work)         │
│  • Session protocol (prime → work → handoff)     │
│  • Cross-session continuity (Dolt DB)            │
├─────────────────────────────────────────────────┤
│  Project                                         │
│  • CLAUDE.md / AGENTS.md                         │
│  • docs/ (Nextra, MDX — the spec)               │
│  • Existing skills: pr-draft, docs-update, etc.  │
└─────────────────────────────────────────────────┘
```

### What Lives Where

| Concern | Owner | Why |
|---------|-------|-----|
| Task tracking, dependencies, status | **Beads** | Already built, Dolt-backed, merge-safe |
| Structured notes, session state | **Beads** | Compaction survival, cross-session |
| Ready front computation | **Beads** (`bd ready`) | Graph query on dependency DAG |
| Execution plans | **ystack** (`.context/PLAN.md`) | Plans-as-prompts for subagent consumption |
| Decisions from intake | **ystack** (`.context/DECISIONS.md`) | Doc-driven, not generic task metadata |
| Doc-driven spec reading | **ystack** | Beads doesn't know about your docs |
| Goal-backward verification | **ystack** | Requires codebase analysis |
| PR creation, doc sync | **ystack** + existing skills | Chains pr-draft, docs-update |

---

## Commands — Detailed Specs

### `/build <feature>` — Plan

The entry point. Takes a natural language feature description and produces a plan.

**Process:**

1. **Check status** — run `bd ready` to see if there's in-progress work. If resuming, show context and ask how to proceed.

2. **Find relevant docs** — scan docs site structure (`docs/src/content/`), match by module/feature name. Read the matching pages to understand the current spec.

3. **Find relevant code** — identify which packages/files are involved. Read schema files, API routes, UI components as needed.

4. **Surface assumptions** — present "here's what I'd do and why" instead of asking 20 questions:
   ```
   I'd approach this by:
   1. Adding a `refundReason` enum column to the transactions table
   2. Accepting it in the POST /api/payments/refund endpoint
   3. Displaying it as a badge in the admin transaction detail

   Assumptions:
   - Enum values: duplicate, fraud, requested, other
   - Column on transactions table, not a separate table
   - Admin shows it in detail view, not list view

   Correct anything that's wrong, or confirm to proceed.
   ```

5. **Capture decisions** — write `.context/DECISIONS.md`:
   ```markdown
   # Decisions

   ## Locked
   - Refund reason uses enum: duplicate, fraud, requested, other
   - Column on transactions table
   - Badge in admin transaction detail panel

   ## Claude's Discretion
   - Exact column name (follow project conventions)
   - Migration file naming

   ## Deferred
   - Filtering by refund reason (future work)
   ```

6. **Create plan** — write `.context/PLAN.md` with goal-backward success criteria:
   ```markdown
   # Plan: Add refund reason to payments

   ## Success Criteria
   - [ ] `refundReason` enum column exists on transactions table
   - [ ] POST /api/payments/refund accepts `reason` field
   - [ ] Admin transaction detail shows refund reason badge
   - [ ] Types exported from @hellyeah/shared

   ## Tasks

   ### task-1: Schema and types (bd-a1b2)
   **Files:** packages/db/src/schema.ts, packages/shared/src/types/payments.ts
   **Do:** Add refundReason column (enum). Export type.
   **Verify:** pnpm typecheck passes.

   ### task-2: API endpoint (bd-c3d4)
   **Files:** apps/api/src/routes/payments.ts
   **Do:** Accept reason in refund endpoint. Validate with Zod.
   **Verify:** Endpoint accepts valid reasons, rejects invalid.

   ### task-3: Admin UI (bd-e5f6)
   **Files:** apps/admin/src/app/transactions/[id]/page.tsx
   **Do:** Add RefundReasonBadge. Wire to API response.
   **Verify:** Badge renders for refunded transactions.
   **Depends on:** task-1, task-2
   ```

7. **Create beads** — `bd create` for each task with dependencies.

8. **Spawn plan-checker** — subagent validates:
   - Does the plan deliver ALL locked decisions?
   - Is anything silently simplified? (scope reduction check)
   - Is any task too large for a fresh context?
   - Max 2 revision iterations.

9. **Present plan to user** — wait for confirmation or corrections.

**Small task detection:** If the plan has 1 task and touches ≤3 files, ask: "This is small — want me to just do it?" If yes, execute immediately (skip `/go`).

---

### `/go` — Execute

Runs the plan. Each task gets a fresh subagent to prevent context rot.

**Process:**

1. **Read plan** — load `.context/PLAN.md`.

2. **Compute order** — tasks without dependencies run first. Independent tasks can run in parallel (wave-based).

3. **For each task:**
   a. Claim bead: `bd update <id> --claim`
   b. Spawn subagent with ONLY: task description + file targets + verification step
   c. Subagent reads target files, makes changes, runs verification
   d. Atomic commit on success
   e. Update bead notes (structured format):
      ```
      COMPLETED: Added refundReason enum column to schema
      KEY DECISIONS: Used pgEnum, values match DECISIONS.md
      ```
   f. Close bead: `bd close <id> --reason "Implemented and verified"`

4. **Handle deviations:**
   - Auto-fix: minor bugs, missing imports, type errors in adjacent code
   - STOP and ask: architectural decisions, new tables, scope changes

5. **Report results** — show what was done per task, any issues encountered.

---

### `/review` — Code Review

Reviews the changes against project standards.

**Process:**

1. **Load rules** — read `.claude/rules/`, CLAUDE.md, contributor guidance, design guide.

2. **Read diff** — all changes since before `/go` started.

3. **Check against rules:**
   - Security (injection, XSS, auth)
   - Accessibility (ARIA, semantic HTML, keyboard)
   - Performance (unnecessary re-renders, N+1 queries)
   - Code style (Ultracite/Biome compliance)
   - Type safety (any usage, missing types)
   - Error handling (unhandled promises, missing validation)

4. **Goal-backward verification:**
   - Read success criteria from PLAN.md
   - For each criterion, verify against actual code
   - File existence, pattern matching, typecheck, test runs
   - Distrust summaries — check the code directly

5. **Output findings** with file:line references:
   ```
   ## Review Results

   ### Issues (2)
   - [WARN] apps/admin/src/app/transactions/[id]/page.tsx:45
     RefundReasonBadge missing aria-label for screen readers
   - [WARN] apps/api/src/routes/payments.ts:98
     Missing error message in Zod validation

   ### Verification: 4/4 PASS
   - [PASS] refundReason column exists — packages/db/src/schema.ts:47
   - [PASS] API accepts reason — apps/api/src/routes/payments.ts:92
   - [PASS] Admin badge renders — apps/admin/.../page.tsx:43
   - [PASS] Types exported — packages/shared/src/types/payments.ts:23
   ```

6. **User decides:** fix issues, or accept and move on.

---

### `/docs` — Update Documentation

Detects which doc pages are affected and updates them.

**Process:**

1. **Detect changes** — `git diff --stat` to see which packages/files changed.

2. **Map to docs** — match changed code paths to doc pages:
   - `packages/db/src/schema.ts` → `docs/src/content/data-models.mdx`
   - `packages/payments/` → `docs/src/content/shared/payments.mdx`
   - `apps/api/src/routes/` → `docs/src/content/api/` pages

3. **Read before writing** — load affected doc pages, understand current content.

4. **Update only changed sections** — don't rewrite entire pages. Add/modify:
   - New data model fields
   - New API endpoints or parameters
   - Updated flow diagrams (Mermaid)
   - Changed scope or dependencies

5. **Update structural files if needed** — CLAUDE.md, AGENTS.md, package CLAUDE.md.

6. **Show changes** — present doc updates to user for review.

Delegates to existing `docs-update` skill under the hood.

---

### `/pr` — Create PR

The final step. Chains verification, docs check, and PR creation.

**Process:**

1. **Final verification** — run success criteria check one more time.

2. **Docs check** — any code changes without corresponding doc updates? Warn if so.

3. **Lint and typecheck** — `pnpm fix` + `pnpm typecheck`.

4. **Delegate to pr-draft** — uses existing `pr-draft` skill for:
   - Branch sync (fetch, rebase)
   - Diff analysis
   - Monorepo-aware section grouping
   - Conventional commit title
   - PR creation (draft or ready)

5. **Close out beads** — verify all beads in scope are closed.

6. **Archive `.context/`** — clean up ephemeral files.

---

## The `.context/` Directory

Ephemeral working files. Gitignored. Only exists during active work.

```
.context/
├── DECISIONS.md     # Locked choices from /build
└── PLAN.md          # Execution plan (the subagent prompt)
```

Everything persistent (tasks, notes, deps, session state) lives in **Beads**.

---

## Design Principles

### From GSD
1. **Plans are prompts** — PLAN.md is the literal prompt the executor subagent receives
2. **Goal-backward verification** — success criteria checked against actual code, not task completion
3. **Fresh context per agent** — each subagent gets a clean context window
4. **Scope reduction prohibition** — never silently simplify; split tasks instead
5. **Plan-checker gate** — validate plan before burning context on execution

### From Beads
6. **Beads is the state layer** — don't reinvent task tracking
7. **Structured notes** — COMPLETED / IN PROGRESS / NEXT / KEY DECISIONS / BLOCKERS
8. **Ready fronts** — `bd ready` drives work selection for large multi-task features
9. **Discovery-driven** — side quests captured with `bd create --deps discovered-from:<id>`

### Our Own
10. **Docs are the spec** — read existing docs to understand what to build
11. **Assumptions over Q&A** — present a plan, let user correct
12. **4 commands** — simple enough to remember without a manual
13. **Chain existing skills** — pr-draft, docs-update, commit are already battle-tested

---

## Hooks

### Context Monitor (PostToolUse)
- At 60% context: suggest spawning subagents
- At 80%: warn and suggest finishing current task

### Session Start
- Auto-detect Beads project (`.beads/` exists)
- Run `bd ready` and show status
- If `.context/PLAN.md` exists, remind user of in-progress work

### Workflow Nudge (PreToolUse on Edit)
- If editing code with no `.context/PLAN.md`: soft warning
- "Consider `/build` or just `/build --quick` for tracked changes."

---

## Build Order

| Phase | What | Ship When |
|-------|------|-----------|
| **1** | `/build` — doc reading, assumptions, plan creation, plan-checker | Can use standalone to plan work |
| **2** | `/go` — task execution with fresh subagents | Core loop works: build → go |
| **3** | `/review` — code review + goal-backward verification | Quality gate before shipping |
| **4** | `/docs` — doc drift detection + updates | Wraps existing docs-update skill |
| **5** | `/pr` — PR creation chain | Wraps existing pr-draft skill |
| **6** | Hooks + installer | Polish and distribution |

Each phase is independently useful. `/build` alone is valuable even without `/go`.

---

## Configuration

`ystack.config.json` in project root:

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
    "auto_docs_check": true,
    "small_task_threshold": 3
  }
}
```

---

## File Structure

```
ystack/
├── skills/
│   ├── build/
│   │   ├── SKILL.md
│   │   └── resources/
│   │       └── plan-checker.md
│   ├── go/
│   │   ├── SKILL.md
│   │   └── resources/
│   │       └── executor.md
│   ├── review/SKILL.md
│   ├── docs/SKILL.md
│   └── pr/SKILL.md
├── hooks/
│   ├── context-monitor.js
│   ├── session-start.sh
│   └── workflow-nudge.js
├── templates/
│   ├── DECISIONS.md
│   └── PLAN.md
├── docs/
│   ├── getting-started.md
│   ├── commands.md
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

## Open Questions

1. **Beads version** — minimum `bd` version to depend on?
2. **Docs framework** — start Nextra-native, generalize later?
3. **Parallel execution** — should `/go` parallelize independent tasks from day 1?
4. **Linear sync** — Beads supports `--external-ref linear:LIN-123`. Enable by default?
5. **Beads formulas** — should ystack ship formula templates for common workflows?
