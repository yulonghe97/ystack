# ystack — Plan

## Problem

AI coding agents need three things they don't have:

1. **Memory** — persistent state across sessions → Beads
2. **Workflow** — a guided path from idea to PR → ystack commands
3. **Spec-code-docs coherence** — docs reflect what's built, not what's planned → module registry + doc sync

## Commands

```
/skeleton   →  split a big plan into module docs skeleton
/import     →  analyze existing repo, generate module registry + doc stubs
/build      →  plan a feature (reads docs + code, surfaces assumptions)
/go         →  execute the plan (fresh subagents, atomic commits)
/review     →  code review + goal-backward verification
/docs       →  update documentation for completed work
/pr         →  verify → docs check → create PR
```

### The Two Flows

**New project:**
```
Big plan (markdown)
  → /skeleton
    → module registry, doc skeleton (overviews, interactions, stubs)
    → epic beads per module with child features
  → pick a module
  → /build → /go → /review → /docs → /pr
  → repeat per module
```

**Existing project:**
```
Existing repo + docs
  → /import
    → scans code, docs, git history
    → generates module registry
    → creates epic beads per module (marks implemented features as closed)
    → flags doc gaps
  → continue with /build → /go → /review → /docs → /pr
```

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Developer                                            │
│  /skeleton  /import  /build  /go  /review  /docs  /pr │
├──────────────────────────────────────────────────────┤
│  ystack (workflow layer)                              │
│  • Module registry (modules ↔ docs ↔ beads)          │
│  • Doc-driven planning                                │
│  • Execution with fresh subagents                     │
│  • Goal-backward verification                         │
│  • Doc sync (completed work → docs)                   │
├──────────────────────────────────────────────────────┤
│  Beads (memory layer)                                 │
│  • Epic beads per module                              │
│  • Feature beads as children                          │
│  • Structured notes, dependencies                     │
│  • Cross-session continuity                           │
├──────────────────────────────────────────────────────┤
│  Project                                              │
│  • docs/ (the spec — final state only)                │
│  • CLAUDE.md / AGENTS.md                              │
│  • Existing skills: pr-draft, docs-update, commit     │
└──────────────────────────────────────────────────────┘
```

### The Module Registry

The bridge between code, docs, and Beads. Lives in `ystack.config.json`:

```json
{
  "modules": {
    "payments": {
      "doc": "shared/payments",
      "packages": ["packages/payments", "packages/db"],
      "epic": "bd-a1b2",
      "status": "active"
    },
    "aima": {
      "doc": "aima",
      "packages": ["packages/aima"],
      "epic": "bd-c3d4",
      "status": "active"
    },
    "admin": {
      "doc": "admin",
      "packages": ["apps/admin"],
      "epic": "bd-e5f6",
      "status": "active"
    }
  },
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

Each module entry connects three things:
- **doc** — path to the docs page (relative to docs root)
- **packages** — which code directories belong to this module
- **epic** — the Beads epic tracking this module's progress

### Two Sources of Truth

| | Docs (Nextra) | Beads |
|---|---|---|
| **Shows** | What the system IS (final state) | What's been done, what's left |
| **Audience** | Whole team, new devs, AI agents | Active developers, AI agents |
| **Changes when** | Feature is completed and verified | Every task starts/finishes |
| **Contains** | Architecture, contracts, data models, flows | Progress, decisions, context, next steps |
| **Never contains** | Planning, in-progress, "coming soon" | Final specs (those go in docs) |

**The sync rule:** docs reflect only completed work. When a bead closes → check parent epic → flag doc page for update. `/docs` reads closed-but-not-yet-documented children to know what's new.

---

## Commands — Detailed Specs

### `/skeleton` — Start a New Project

Takes a big plan (markdown input or file) and produces a documentation skeleton + module registry + epic beads.

**When to use:** Starting a new project, or when you have an overall architecture in your head and want to turn it into a structured starting point.

**Input:** A markdown document describing the project. Can be rough — module names, how they connect, key features. Example:

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
- Subscription management
- Connects to: Auth, Database, API

### Dashboard
- User overview
- Usage charts
- Settings page
- Connects to: Auth, Payments, API
```

**Process:**

1. **Parse the plan** — extract modules, features per module, and inter-module connections.

2. **Generate doc skeleton** — for each module, create:
   - `docs/src/content/<module>/index.mdx` — module overview with:
     - Purpose (1-2 sentences from the plan)
     - Module interaction diagram (Mermaid, auto-generated from connections)
     - Feature list as stub sections (headers only, no content yet)
     - Dependencies table
   - `docs/src/content/<module>/_meta.ts` — navigation entries
   - Update parent `_meta.ts` to include new modules

3. **Generate system overview** — a top-level architecture page with:
   - Full system diagram showing all modules and their connections
   - Module table (name, purpose, status)
   - This becomes the "map" that everything else references

4. **Create module registry** — write `ystack.config.json` with module entries.

5. **Create epic beads** — one epic per module, child beads per feature:
   ```
   bd create "Auth Module" -t epic --metadata '{"doc": "auth"}'
   bd create "Email/password login" -t feature --parent bd-xxxx
   bd create "OAuth (Google, GitHub)" -t feature --parent bd-xxxx
   bd create "Session management" -t feature --parent bd-xxxx
   ```

6. **Add inter-module dependencies** where features cross boundaries:
   ```
   bd dep add bd-payments-wallet blocks:bd-dashboard-usage
   ```

7. **Present skeleton to user** — show the doc structure, module diagram, and bead graph. Ask for corrections.

**Output:** A project with:
- Doc skeleton (overviews with diagrams, feature stubs)
- Module registry linking code ↔ docs ↔ beads
- Epic beads with feature children
- A clear "ready front" — features with no blockers that you can `/build` first

**Key design:** The skeleton is intentionally shallow — module overviews and interaction diagrams only. No detailed specs. Those get written as features are implemented via `/docs`. This keeps docs honest: they describe what IS, not what's planned. The stubs show structure, the beads track what's left.

---

### `/import` — Adopt an Existing Project

Analyzes an existing repo and generates the module registry, doc stubs, and Beads state. This is the on-ramp for projects that already have code (and possibly docs).

**When to use:** You have an existing codebase and want to bring it into the ystack workflow.

**Process:**

1. **Scan codebase** — spawn parallel agents to analyze:
   - **Structure agent:** package.json files, directory tree, monorepo layout → module boundaries
   - **Dependency agent:** imports, package.json deps → inter-module connections
   - **Schema agent:** database schemas, API routes, type definitions → data model inventory
   - **Docs agent:** existing docs, README files, CLAUDE.md → current documentation state

2. **Detect modules** — group code into logical modules based on:
   - Package boundaries (monorepo packages/apps)
   - Directory structure (feature folders)
   - Import patterns (what depends on what)

3. **Scan existing docs** — if docs exist:
   - Map doc pages to detected modules
   - Identify documented vs. undocumented modules
   - Check for stale docs (code changed, docs didn't)

4. **Generate module registry** — write `ystack.config.json` with discovered modules.

5. **Create epic beads** — one per module. For each:
   - Analyze code to identify implemented features
   - Create child beads, marking implemented ones as **closed**
   - Mark undocumented features with label `needs-docs`
   - Mark features with stale docs with label `docs-stale`

6. **Generate gap report:**
   ```markdown
   # Import Report

   ## Modules Detected: 8
   - payments (3 features, all documented)
   - auth (4 features, 2 undocumented)
   - admin (5 features, 1 stale doc)
   ...

   ## Documentation Gaps
   - auth/oauth: implemented but no docs
   - auth/sessions: implemented but no docs
   - admin/campaigns: docs reference old API shape

   ## Suggested Next Steps
   1. Run /docs to update 3 gap pages
   2. Review stale docs for admin/campaigns
   3. /build for any new features
   ```

7. **Create doc stubs** for undocumented modules (if docs site exists) or offer to scaffold with `/skeleton`.

**Key design:** This is a long-running process. For a large repo it could take several minutes with parallel agents. Progress should be visible. The output is conservative — it creates beads and a registry but doesn't modify existing docs without user confirmation.

**Incremental adoption:** You don't have to import everything at once. `/import --module payments` can import a single module.

---

### `/build <feature>` — Plan

The entry point for implementing a feature.

**Process:**

1. **Check status** — `bd ready` for in-progress work. If resuming, show context.

2. **Find module** — match feature description to module registry. If ambiguous, ask.

3. **Read docs** — load the module's doc page to understand current spec.

4. **Read code** — load the module's packages to understand current implementation.

5. **Surface assumptions:**
   ```
   I'd approach this by:
   1. Adding a refundReason enum column to the transactions table
   2. Accepting it in POST /api/payments/refund
   3. Displaying as a badge in admin transaction detail

   Assumptions:
   - Enum values: duplicate, fraud, requested, other
   - Column on transactions, not a separate table

   Correct anything, or confirm.
   ```

6. **Capture decisions** → `.context/<bead-id>/DECISIONS.md`

7. **Create plan** → `.context/<bead-id>/PLAN.md` with goal-backward success criteria.

8. **Create child beads** under the module's epic with dependencies.

9. **Plan-checker gate** — subagent validates plan delivers all decisions. Max 2 revisions.

10. **Present plan** — wait for confirmation.

**Small task detection:** 1 task, ≤3 files → "This is small — want me to just do it?"

---

### `/go` — Execute

Runs the plan with fresh subagents.

**Process:**

1. Read `.context/<bead-id>/PLAN.md`.
2. Compute execution order from dependencies.
3. Per task:
   a. `bd update <id> --claim`
   b. Spawn subagent with: task description + file targets + verification step
   c. Subagent works in fresh context (reads only its target files)
   d. Atomic commit on success
   e. Update bead notes (COMPLETED / KEY DECISIONS format)
   f. `bd close <id>`
4. Report results.

**Deviation rules:**
- Auto-fix: minor bugs, missing imports, type errors
- STOP and ask: architectural decisions, scope changes

---

### `/review` — Code Review + Verification

Reviews changes and verifies against success criteria.

**Process:**

1. Load project rules (.claude/rules/, CLAUDE.md, contributor guidance, design guide).
2. Read diff (all changes since before `/go`).
3. Check: security, accessibility, performance, style, types, error handling.
4. Goal-backward verification — check each success criterion against actual code.
5. Output findings with file:line references.
6. User decides: fix or accept.

---

### `/docs` — Update Documentation

Updates docs for completed work. Only completed work.

**Process:**

1. Read module registry — which module was this work for?
2. Read the module's epic — which children just closed?
3. Read the module's doc page — what's currently documented?
4. Update only the sections affected by newly completed features:
   - New data model fields
   - New API endpoints
   - Updated flow diagrams
   - Changed dependencies
5. Mark beads as documented (label `documented`).
6. Never add "planned" or "coming soon" content.

Delegates to existing `docs-update` skill.

---

### `/pr` — Create PR

**Process:**

1. Final success criteria verification.
2. Docs check — code changes without doc updates? Warn.
3. `pnpm fix` + `pnpm typecheck`.
4. Delegate to `pr-draft` skill.
5. Verify all beads in scope are closed.
6. Clean up `.context/<bead-id>/`.

---

## Hooks

### Context Monitor (PostToolUse)
- 60% context: suggest subagents for remaining work
- 80%: suggest finishing current task

### Session Start
- Auto-detect project (`.beads/` + `ystack.config.json`)
- Show: module status summary, ready front, in-progress work
- If `.context/` has active bead folders: remind of in-progress work

### Workflow Nudge (PreToolUse on Edit)
- Editing code with no active `.context/<bead-id>/PLAN.md`: "Consider `/build` for tracked changes."

---

## Design Principles

### From GSD
1. **Plans are prompts** — PLAN.md is the subagent's literal prompt
2. **Goal-backward verification** — success criteria against actual code
3. **Fresh context per agent** — clean context window per task
4. **Scope reduction prohibition** — never silently simplify
5. **Plan-checker gate** — validate before execution

### From Beads
6. **Beads is the state layer** — don't reinvent task tracking
7. **Structured notes** — COMPLETED / IN PROGRESS / NEXT / KEY DECISIONS / BLOCKERS
8. **Ready fronts** — `bd ready` drives work selection
9. **Epics as module trackers** — parent-child for module → features

### Our Own
10. **Docs are final state only** — never "planned" or "in progress"
11. **Module registry** — the bridge between code, docs, and beads
12. **Skeleton-first** — start with structure, fill in as you build
13. **Import existing** — on-ramp for repos that already have code
14. **7 commands** — skeleton, import, build, go, review, docs, pr

---

## The `.context/` Directory

Ephemeral working files during active feature work. Gitignored. Scoped by bead ID so multiple agents/features can work in parallel without collisions.

```
.context/
├── bd-a1b2/              # "Add refund reason" feature
│   ├── DECISIONS.md
│   └── PLAN.md
├── bd-c3d4/              # "Add OAuth support" feature
│   ├── DECISIONS.md
│   └── PLAN.md
└── bd-e5f6/              # "Dashboard charts" feature
    ├── DECISIONS.md
    └── PLAN.md
```

Each `/build` creates `.context/<bead-id>/`. Each `/go` reads from the same folder. No collisions across parallel agents or features.

### What Gets Committed vs. What Stays Ephemeral

| Artifact | Committed? | Shared with team? | Why |
|----------|-----------|-------------------|-----|
| Docs (`docs/src/content/`) | Yes | Yes | Final state of the product |
| Module registry (`ystack.config.json`) | Yes | Yes | Module map everyone needs |
| CLAUDE.md / AGENTS.md | Yes | Yes | AI context for all agents |
| Beads (`.beads/`) | Yes (Dolt refs) | Yes | Progress, notes, decisions — the development state machine |
| `.context/<bead-id>/` | No | No | Temporary working files — consumed by `/go`, then cleaned up |

The valuable parts of `.context/` flow to their permanent homes:

```
/build  →  .context/<bead-id>/DECISIONS.md  (temporary)
                     ↓
/go     →  bead structured notes             (committed via Beads)
                     ↓
/docs   →  doc pages                         (committed via git)
                     ↓
/pr     →  .context/<bead-id>/ cleaned up
```

Nothing is lost. Decisions get written into bead notes during execution. Outcomes get written into docs during `/docs`. The temporary files are just a working scratch pad for the active agent.

---

## Build Order

| Phase | What | Value |
|-------|------|-------|
| **1** | Module registry format + `ystack.config.json` | Foundation everything builds on |
| **2** | `/build` — doc reading, assumptions, planning | Standalone planning tool |
| **3** | `/go` — execution with fresh subagents | Core loop: build → go |
| **4** | `/review` — code review + verification | Quality gate |
| **5** | `/docs` — doc sync for completed work | Docs stay current |
| **6** | `/pr` — shipping chain | Wraps pr-draft |
| **7** | `/skeleton` — new project scaffolding | New project on-ramp |
| **8** | `/import` — existing project adoption | Existing project on-ramp (long-running, complex) |
| **9** | Hooks + installer + docs | Polish and distribution |

---

## Open Questions

1. **Beads version** — minimum `bd` version to depend on?
2. **Docs framework** — start Nextra-native, generalize to any markdown later?
3. **Parallel execution** — should `/go` parallelize independent tasks from day 1?
4. **Linear sync** — use Beads `--external-ref linear:LIN-123` by default?
5. **Import depth** — how deep should `/import` analyze? Function-level or module-level?
6. **Skeleton input** — accept markdown file, clipboard, or interactive Q&A?
7. **Multi-repo** — should module registry support modules across repos?
