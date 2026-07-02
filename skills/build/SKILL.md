---
name: build
description: >
  Plan a feature by reading documentation and code, surfacing assumptions, capturing
  decisions, and creating an execution plan with goal-backward success criteria. Use this
  skill when the user says 'build', '/build', 'implement', 'add feature', 'plan feature',
  'I want to build', 'let me build', 'work on', or describes a feature they want to implement.
  This is the entry point for the ystack workflow — it produces a one-page BRIEF.md the user
  reviews, plus DECISIONS.md and PLAN.md that `/go` executes from.
compatibility: Designed for Claude Code
metadata:
  user-invocable: "true"
---

# /build — Plan a Feature

You are the planning phase of the ystack agent harness. Your job is to understand what needs to be built by reading documentation and code, surface your assumptions for the user to confirm, then produce three artifacts:

- **BRIEF.md** — one-page, plain-English summary. The human reviews this to approve.
- **DECISIONS.md** — locked technical choices. `/go` reads this for context.
- **PLAN.md** — task contract with success criteria. `/go` executes from this.

**You do NOT write code.** You produce artifacts that `/go` will execute.

## Audience split

The three artifacts have different audiences. Don't blur them:

| File | Audience | Tone | Contains |
|---|---|---|---|
| `BRIEF.md` | Human reviewer | Plain English, product-level | What changes for users, why, scope, risk |
| `DECISIONS.md` | `/go` agent | Technical | Locked choices, deferred, sources |
| `PLAN.md` | `/go` agent | Structured | Success criteria + tasks (Files / Do / Verify / Deps) |

A PM or founder should be able to read BRIEF.md without seeing file paths, column names, library names, or commands. Those belong in DECISIONS.md and PLAN.md.

## Phase 0: Locate the Module

Identify which module(s) this feature belongs to. **Do not skip this phase** — module detection drives everything downstream. `/go` edits files inside the matched module's package; `/qa` runs tests scoped to it. Guessing the module silently causes plans to target wrong files, and the mistake only surfaces after code is written.

1. **Always check for `.ystack/config.json` first.** This is the module registry — if it exists, it's the source of truth for module → scope glob mapping:
   ```bash
   test -f .ystack/config.json && cat .ystack/config.json || echo "MISSING: .ystack/config.json"
   ```
   - **If present:** match the feature to a module by checking `scope` globs. In your response, state the match explicitly: *"Matched to module **<name>** via glob `<pattern>` in `.ystack/config.json`."*
   - **If absent or no glob matches:** say so out loud — *"No `.ystack/config.json` match; falling back to docs navigation."* — then proceed to step 2.

2. If no config exists or no match found, scan the docs directory structure:
   ```bash
   # Find docs root — check common locations
   # Nextra: docs/src/content/
   # Fumadocs: content/docs/
   ls docs/src/content/_meta.ts 2>/dev/null || ls content/docs/meta.json 2>/dev/null || ls docs/_meta.ts 2>/dev/null
   ```

3. Read the navigation config to understand what modules exist:
   - Nextra: `_meta.ts` files (object keys = sidebar order)
   - Fumadocs: `meta.json` files or frontmatter-based ordering

4. Match the user's feature description to a module. If ambiguous, ask:
   > This could belong to **Payments** or **Managed Ads**. Which module should this feature live in?

5. If this is a cross-module feature, identify the primary module (where the core logic lives) and secondary modules (where integration happens).

## Phase 1: Read the Spec

Read the module's documentation page to understand the current design.

1. **Read the module overview** — the `index.mdx` file for the matched module:
   ```
   docs/src/content/<module>/index.mdx
   ```
   Extract: Purpose, Scope (in/out), Sub-modules, Dependencies (needs/provides), Key Contracts.

2. **Read relevant sub-module pages** — if the feature maps to a specific sub-module, read that page too.

3. **Read cross-referenced modules** — if the module's Dependencies table references other modules that this feature will touch, read their overview pages. Follow the cross-reference links in the docs.

4. **Read the contributor guidance** — check if there are relevant conventions:
   - `docs/src/content/contributing/index.mdx` for golden rules
   - Module-specific conventions if they exist

**Important:** Read the actual files. Do not guess what docs contain based on file names. The docs are the spec — they tell you what the system IS.

## Phase 2: Read the Code

Read the relevant source code to understand the current implementation.

1. **Identify code packages** from the module registry or `CLAUDE.md` Structure section.

2. **Read the package's `AGENTS.md`** (or `CLAUDE.md` if it exists) in the module's code directory. This gives you quick orientation — key files, conventions, and patterns specific to that package. If it doesn't exist, proceed without it.

3. **Read key files** — focus on:
   - Schema files (database tables, types)
   - API routes (endpoints, request/response shapes)
   - Public interfaces (exported functions, tool definitions)
   - Existing tests (what's already tested)

4. **Do NOT read everything.** Read only what's relevant to the feature. Use the docs to guide which code matters — if the docs say "Payments uses Stripe Customer Balance", read the Stripe integration code, not the entire payments package.

## Phase 3: Surface Assumptions

Present your understanding of how to build this feature. Do NOT ask 20 questions — present a plan and let the user correct what's wrong.

Format your assumptions as:

```
Based on the docs and code, here's how I'd approach this:

1. [First concrete step with specific files/tables/endpoints]
2. [Second step]
3. [Third step]

**Assumptions:**
- [Specific technical assumption — e.g., "Column goes on the `transactions` table, not a new table"]
- [Design assumption — e.g., "Enum values: duplicate, fraud, requested, other"]
- [Scope assumption — e.g., "Admin detail view only, not the list view"]

**Out of scope** (deferring these):
- [Thing that's related but not part of this feature]

Correct anything that's wrong, or confirm to proceed.
```

**Rules for assumptions:**
- Be specific, not vague. "Add a column to the transactions table" not "update the database".
- Reference actual file paths from the code you read.
- Reference actual doc sections that inform your approach.
- If the docs explicitly define a contract or scope boundary, follow it — don't assume differently.
- If something is listed as "Out of Scope" in the module docs, it's out of scope for this feature too.

**Wait for the user to confirm or correct before proceeding to Phase 4.**

## Phase 4: Write the Brief (human-facing)

After the user confirms, write the one-pager. This is what they'll actually read to approve.

Create:
```
.context/<feature-id>/BRIEF.md
```

Use a short, descriptive feature ID (e.g., `refund-reason`, `oauth-support`, `dashboard-charts`).

**BRIEF.md format:**

```markdown
# <Feature Name>

**Module:** <module>  ·  **Size:** <N small/medium/large changes>  ·  **Risk:** <low/medium/high>

## What we're doing
<One paragraph in plain English. No file paths, no column names, no library names.
What does the user see or experience that's different? Write for someone who hasn't
seen the codebase.>

## Why
<One paragraph. Business or user reason. What problem does this solve? What unblocks?>

## What changes for users
- **<User type>** <sees / can do / gets> <plain-language outcome>.
- **<User type>** <sees / can do / gets> <plain-language outcome>.
- <Optional: explicit "no change to X" line if it's likely to be assumed>.

## Out of scope
- <Related work intentionally deferred — plain English, no jargon>
- <…>

## Risk
<One or two short lines. Examples: "Low — new nullable column, no backfill.";
"Medium — touches the refund hot path; rollback by reverting the API change.">

---

**Details for `/go`:**
- [DECISIONS.md](./DECISIONS.md) — locked technical choices, deferred items, source files read
- [PLAN.md](./PLAN.md) — <N> tasks with success criteria, file targets, and verify steps
```

**Rules for BRIEF.md:**

1. **No code, no file paths, no commands.** Those belong in PLAN.md.
2. **No internal jargon.** Avoid `zod`, `enum`, `migration`, `endpoint`, `schema` if a plainer word fits ("validation", "categories", "data column", "API", "shape").
3. **One paragraph per section, max.** If you can't fit it, the feature is too big — split it.
4. **The reviewer should know if they want this in 60 seconds.** Optimize for scan, not exhaustiveness.
5. **Always end with the "Details for `/go`" footer.** Link to DECISIONS.md and PLAN.md with the relative paths shown above and substitute the real task count. The footer is the reader's bridge to the agent artifacts if they want to drill in — without it, BRIEF.md feels like the whole story.

## Phase 5: Capture Decisions (agent-facing)

Write the technical decisions file. This is the contract for `/go`.

Create:
```
.context/<feature-id>/DECISIONS.md
```

**DECISIONS.md format:**

```markdown
# <Feature Name>

**Module:** <primary module> (+ secondary modules if cross-module)

## Locked
- <Specific, actionable technical decision>
- <…>

## Deferred
- <Related work explicitly not part of this feature>

## Sources
docs/src/content/<module>/index.mdx · packages/<module>/src/<file>.ts · <other paths>
```

**Notes:**
- Drop the old "Claude's Discretion" section. Anything not in Locked is implicitly discretionary.
- Sources is a single line of `·`-separated paths, not a bulleted list. Reviewers don't read it; `/go` resolves it.
- Each Locked item should be one line. If it needs more, split it.

## Phase 6: Create the Plan (agent-facing)

Write an execution plan with goal-backward success criteria.

Create:
```
.context/<feature-id>/PLAN.md
```

**PLAN.md format:**

```markdown
# <Feature Name>

## Done when
- [ ] <Criterion 1 — specific and checkable, e.g. "`refundReason` column exists on `transactions`">
- [ ] <Criterion 2 — e.g. "POST /api/payments/refund validates `reason` with zod, returns 400 on invalid">
- [ ] <Criterion 3 — e.g. "Admin detail page renders `RefundReasonBadge`">

## Tasks

### 1. <Short title> — `<primary file path>`
<One or two sentences describing what to implement. Reference patterns by name
rather than pasting code.>
**Verify:** <concrete command or check, e.g. `pnpm typecheck`>

### 2. <Short title> — `<primary file path>`  *(needs 1)*
<What to implement.>
**Verify:** <check>

### 3. <Short title> — `<primary file path>`  *(needs 1)*
<What to implement.>
**Verify:** <check>
```

**Rules for plans:**

1. **Tasks describe intent, not implementation.** A plan is not a diff. Describe *what* to build in prose; let `/go` figure out *how*. Pre-writing code wastes tokens, drifts from actual conventions, and makes the executor second-guess whether to follow your snippet or write fresh.

   **Good:**
   - "Add a `refundReason` enum column to `transactions` (duplicate, fraud, requested, other). Follow existing enum patterns."
   - "Extend the refund endpoint to accept an optional `reason`, validate it as one of the enum values, return 400 if invalid."

   **Bad** (don't do this):
   - Code fences, function bodies, SQL, schema DSL, import statements
   - Type definitions written out (reference existing types by name instead)
   - Config file contents

   OK to include: file paths, function/type/table names as references, enum values as data, commands to run for verification.

2. **2–4 tasks.** If you need more, the feature should be split. Each task must fit in a fresh agent context.

3. **The heading carries the primary file path.** Use the form `### N. Title — \`path\``. List additional files inline in the description if needed. A fresh agent should know exactly where to look from the heading alone.

4. **Dependencies are inline.** Use `*(needs 1)*` or `*(needs 1, 2)*` after the heading. Omit when independent (parallelizable).

5. **Verification is concrete.** Not "verify it works" — rather `pnpm typecheck`, `pnpm test refund`, "grep for `refundReason` in `schema.ts`", or a one-line manual repro.

6. **No scope reduction.** Every locked decision in DECISIONS.md must be covered by at least one task. If a decision can't be delivered, STOP and tell the user — don't silently simplify.

7. **Each task is a single atomic unit of work.** Even though `/go` no longer commits per task — that's now `/pr`'s job — tasks should still be sized as if they were atomic commits. "Add column and update 3 API endpoints and redesign the UI" is too big; split it.

8. **Reference the docs.** If a task implements something described in the docs (a contract, a data model, an API shape), mention the doc page so the executor can read it.

## Phase 7: Plan Check

Before presenting the plan to the user, self-check. The five checks below are the fast-path version; for the full coverage-table format and extended scope-reduction heuristics, see [references/plan-checker.md](references/plan-checker.md).

1. **Coverage check:** Read DECISIONS.md. For each locked decision, confirm at least one task in PLAN.md delivers it. If any decision is uncovered, add a task or flag the gap.

2. **Scope reduction check:** Re-read your plan. Are you delivering exactly what was decided, or a simplified version? Look for red flags:
   - "Simplified version" / "basic implementation" / "v1" / "placeholder"
   - Missing a decision from the locked list
   - A task that says "will be wired later" or "can be added in a follow-up"

   If any of these appear, revise the plan or split into phases.

3. **Size check:** Each task should touch 1–5 files. If a task would touch more, split it.

4. **Fresh agent test:** For each task, ask: "Could a fresh agent with no conversation history execute this task from the description alone?" If not, add more detail.

5. **Code leak check:** Scan every task's body for code fences (```` ``` ````), function bodies, SQL, or import statements. If found, rewrite as prose.

6. **Brief jargon check:** Re-read BRIEF.md. Does it contain file paths, column names, library names, or commands? If so, move them to DECISIONS.md or PLAN.md and rewrite the BRIEF line in plain English.

## Phase 8: Present the Plan

After `BRIEF.md`, `DECISIONS.md`, and `PLAN.md` are written and the plan check passes, show the user the brief:

```bash
cat .context/<feature-id>/BRIEF.md
```

Then say:

> Brief ready at `.context/<feature-id>/BRIEF.md`. Full plan and decisions are in the same folder for `/go`. Confirm to proceed, or let me know what to adjust.

**Small task detection:** If the plan has only 1 task touching 3 or fewer files, offer:

> This is a small change. Want me to just do it now? (Skips `/go`, executes inline.)

If the user confirms inline execution, execute the single task directly — make the changes and run the verification step. **Do not commit.** Leave the change in the working tree; `/pr` will create the single commit when the user is ready to ship.

---

## What This Skill Does NOT Do

- **Does not write code.** That's `/go`.
- **Does not create PRs.** That's `/pr`.
- **Does not update docs.** That's `/docs`.
- **Does not generate HTML previews.** The BRIEF.md Markdown file IS the review surface.
- **Does not run without user confirmation.** The brief is always presented for approval.
- **Does not invent architecture.** It reads docs and code to understand what exists, then plans within those boundaries.
