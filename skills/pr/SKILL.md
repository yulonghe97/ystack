---
name: pr
description: >
  Create a pull request after verification and docs are updated. Runs final checks,
  detects doc gaps, and delegates to the project's pr-draft skill if available.
  Use this skill when the user says 'pr', '/pr', 'ship', 'ship it', 'create pr',
  'open pr', 'ready to merge', 'let's ship', or after /review and /docs complete.
compatibility: Designed for Claude Code
metadata:
  user-invocable: "true"
---

# /pr — Ship It

You are the final step of the ystack workflow. You verify everything is ready, then create a pull request.

The PR description is the same shape as `BRIEF.md` — concise, plain English, optimized for a reviewer who hasn't seen the feature before. Do not paste PLAN.md or DECISIONS.md into the PR body; those are agent artifacts.

## Arguments

- `--base <branch>` — the PR's **target branch** (what it merges into). Overrides the
  default-branch auto-detection. Example: `/pr --base staging`. When omitted, the base is
  resolved dynamically from `git symbolic-ref refs/remotes/origin/HEAD` (falling back to
  `main`). The resolved value is reused for both the documentation-check diff and
  `gh pr create --base`.

## Phase 0: Pre-flight Checks

Run all checks before creating the PR. If any fail, stop and report.

### 1. Verification status

Check if `/review` has been run:
```bash
ls .context/*/PLAN.md 2>/dev/null
```

If a PLAN.md exists, check whether all success criteria have been verified. If not:
> Success criteria haven't been verified. Run `/review` first?

### 2. Documentation check

Detect if code changes affect documented modules:

```bash
# Target branch (BASE): the --base <branch> argument if the user gave one (ARG_BASE),
# otherwise the repo's default branch resolved dynamically.
BASE="${ARG_BASE:-$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||' || echo main)}"

# Get changed files
git diff "$BASE"...HEAD --stat

# Check if any changed packages map to doc pages
# Read .ystack/config.json or scan docs structure
```

**If this is a `/quick` change** (`.context/.quick` exists): skip doc check entirely. Quick fixes don't need doc updates.

**If this is a feature** (`.context/<feature>/PLAN.md` exists):

1. Read `.ystack/progress/<module>.md` for newly checked `[x]` items.
2. Check if the linked doc sections still have `<!-- ystack:stub -->`.
3. If stubs remain:
   > Feature **OAuth** is checked off but docs still have stubs. Running `/docs` to fill them in...

   Run `/docs` inline — don't just warn, actually execute the doc update. Then continue with the PR.
4. If no stubs and no doc changes needed, proceed.

**If unsure** (no plan, no quick marker): fall back to a warning:
> Code changes in **payments** but docs weren't updated. Run `/docs` to update, or confirm docs don't need changes.

### 3. Lint and typecheck

```bash
pnpm fix 2>/dev/null    # or the project's lint fix command
pnpm typecheck 2>/dev/null
pnpm check 2>/dev/null
```

If any fail, report the errors and offer to fix.

### 4. Working tree

```bash
git status --short
```

A dirty working tree is the **expected** state after `/go` — `/go` deliberately leaves the feature uncommitted so `/pr` can produce one clean commit. Don't error on dirty state; treat it as work to commit.

- If there are uncommitted changes that match what's in `.context/<feature-id>/SUMMARY.md`, proceed to Phase 1 — Phase 1 will commit them.
- If the tree is clean and HEAD already has commits ahead of base, the user committed manually; skip the commit step in Phase 1 and go straight to push + create PR.
- If there are changes that look unrelated to the feature (e.g., random scratch files), ask the user whether to include or stash them before continuing.

## Phase 1: Create PR

### If project has `pr-draft` skill

Delegate to the project's `pr-draft` skill. It knows the project's PR conventions, monorepo grouping, and section format. Pass the resolved base branch through (the `--base` value) so it opens the PR against the right target.

> Delegating to `pr-draft` for PR creation...

### If no `pr-draft` skill

Create the PR directly.

1. **Commit the feature (if not already committed).** This is where `/go`'s uncommitted work lands as a single atomic commit.

   - Read `.context/<feature-id>/BRIEF.md` for the title and body voice.
   - Read `.context/<feature-id>/SUMMARY.md` for any deviations / auto-fixes to mention.
   - Read `.context/<feature-id>/PLAN.md` for the task bullets.
   - Generate a Conventional Commits message:

     ```
     <type>(<scope>): <brief description>

     <one-paragraph "What we're doing" from BRIEF.md>

     - <task 1 title from PLAN.md>
     - <task 2 title from PLAN.md>
     - <task 3 title from PLAN.md>

     <optional: "Auto-fixes: <list>" from SUMMARY.md notes>
     ```

   - **Show the user the commit message and the file list before committing.** This is the one human checkpoint where they get to veto.

     > About to commit as **one** commit:
     >
     > `feat(dashboard): pin positions to top of the list`
     >
     > Files: <list from `git status --short`>
     >
     > Proceed, edit message, or split?

   - On proceed, stage and commit:
     ```bash
     git add -A    # or explicit file list if user wants to exclude some
     git commit -m "<message>"
     ```

   - **One commit per feature.** Do not split tasks into separate commits unless the user explicitly asks. The PR diff = the commit = the feature.

2. **Ensure branch is pushed:**
   ```bash
   git push -u origin HEAD
   ```

3. **Generate PR title** — same as the commit subject line:
   ```
   feat(payments): add refund reason tracking
   ```

4. **Generate PR body.** Source it from `BRIEF.md` when one exists at `.context/<feature-id>/BRIEF.md` — the brief was already written in the right voice. Otherwise derive from the diff using the same shape.

   **PR body format:**

   ```markdown
   ## What
   <One paragraph in plain English. Mirror BRIEF.md's "What we're doing" section.
   No file paths, no library names — say what changed for the user.>

   ## Why
   <One paragraph. Business or user reason. Mirror BRIEF.md's "Why" section.>

   ## Scope
   - <Plain-language outcome — what's in>
   - <Plain-language outcome — what's in>
   - Not included: <plain-language deferred items, comma-separated>

   ## How to check
   ```bash
   <one or two commands, e.g. `pnpm typecheck && pnpm test`>
   ```
   <One sentence describing a manual repro if relevant, e.g. "Then refund a transaction with reason=`fraud` and confirm the badge appears.">

   Closes #<issue> <!-- omit this line if there's no linked issue -->
   ```

   **Rules for PR body:**

   - **Mirror BRIEF.md, don't duplicate PLAN.md.** PLAN.md is the agent's contract; the PR body is the reviewer's overview.
   - **No `## Summary / ## Changes / ## Verification / ## Test Plan` four-section template.** That's what we replaced. Use What / Why / Scope / How to check.
   - **No checklists in the body unless something is genuinely manual.** If the only test is `pnpm typecheck`, write the command, not a checkbox.
   - **One paragraph per section, max.** A reviewer should know if they want to load this PR in 60 seconds.
   - **Drop "Closes #N" if there is no linked issue.** Don't fabricate one.

5. **Ask about PR status:**
   > Create as **draft** or **ready for review**?

6. **Create the PR** (target the resolved `$BASE` branch):
   ```bash
   gh pr create --title "<title>" --body "<body>" --base "$BASE" [--draft]
   ```

## Phase 2: Clean Up

After the PR is created:

1. **Verify progress** — confirm all features in scope are checked in `.ystack/progress/<module>.md`.

2. **Archive `.context/`** — don't delete, just note it's done:
   ```
   Feature context at .context/<feature-id>/ can be cleaned up.
   ```

3. **Report:**
   ```
   PR created: <URL>

   ## Summary
   - Feature: <name>
   - Commits: N
   - Files changed: N
   - Docs updated: yes/no
   - All criteria verified: yes
   ```

---

## What This Skill Does NOT Do

- **Does not write code.** That's `/go`.
- **Does not review code.** That's `/review`.
- **Does not update docs.** That's `/docs`. But it DOES check if docs need updating.
- **Does not force-push.** Ever.
- **Does not merge.** Only creates the PR. Merging is a human decision.
- **Does not paste PLAN.md or DECISIONS.md into the PR body.** Those are agent artifacts; the PR body is for human reviewers.

## What This Skill DOES Do (that may surprise you)

- **Creates the single commit for the feature.** `/go` deliberately leaves the working tree dirty; this skill produces one atomic commit covering all task changes, the progress file, and any docs updates. There is one human checkpoint where you can edit the commit message before it lands.
