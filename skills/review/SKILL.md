---
name: review
description: >
  Code review with multi-agent parallel analysis and confidence-based scoring.
  Use this skill when the user says 'review', '/review', 'check my work', 'verify',
  'did it work', 'is it done', 'review the changes', or after /go completes and
  the user wants to verify the implementation before shipping.
  Also supports reviewing external PRs by URL (e.g., '/review owner/repo#123').
user-invocable: true
---

# /review — Multi-Agent Code Review + Verification

You are the quality gate of the ystack agent harness. You combine:

1. **Goal-backward verification** — check that the codebase delivers what the plan promised
2. **Multi-agent code review** — parallel specialized agents with confidence scoring

You do NOT trust summaries or task completion claims. You check the actual code.

---

## Step 1: Determine Review Target

**If a PR URL or reference is provided** (e.g., `owner/repo#123`, a GitHub URL):
- This is an **external PR review**. Skip to Step 3 (no plan verification needed).
- Use `gh pr view <ref>` and `gh pr diff <ref>` to get the PR details and diff.

**If no PR is specified** (reviewing current work):
- Proceed to Step 2 for plan verification, then Step 3 for code review.

## Step 2: Goal-Backward Verification (current work only)

1. Find the active plan:
   ```bash
   ls .context/*/PLAN.md 2>/dev/null
   ```

2. If multiple features exist, ask which to review. If only one, proceed.

3. Read:
   - `.context/<feature-id>/PLAN.md` — the success criteria
   - `.context/<feature-id>/DECISIONS.md` — the locked decisions
   - `.context/<feature-id>/QA-REPORT.md` — what `/qa` verified (if exists)

4. Get the diff:
   ```bash
   BASE=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||' || echo main)
   git diff "$BASE"...HEAD --stat
   git diff "$BASE"...HEAD
   ```

5. For each success criterion in PLAN.md, verify against the actual codebase:

   **If QA-REPORT.md exists:** Trust criteria that `/qa` already verified with evidence. Focus on what `/qa` didn't cover.

   **Output a verification table:**

   ```markdown
   ## Verification

   | # | Criterion | Status | Evidence |
   |---|-----------|--------|----------|
   | 1 | `refundReason` column exists | PASS | `packages/db/src/schema.ts:47` |
   | 2 | POST /api/refund accepts `reason` | PASS | `apps/api/src/routes/payments.ts:92` |
   | 3 | Admin detail shows refund badge | FAIL | Component exists but not imported in `page.tsx` |
   ```

   **Include file path and line number as evidence.** "PASS" without evidence is not acceptable.

## Step 3: Eligibility Check

Use a fast agent to check if the PR:
- (a) is closed
- (b) is a draft
- (c) doesn't need review (automated PR, trivially obvious change)
- (d) already has a code review from you

If any of these are true, stop and report why.

## Step 4: Gather Context

Run these in parallel:

1. **Collect CLAUDE.md files** — find all relevant CLAUDE.md files: root CLAUDE.md plus any in directories modified by the PR.
2. **Summarize the change** — view the PR and produce a brief summary of what it does.

## Step 5: Multi-Agent Parallel Review

Launch **5 parallel agents** to independently review the change. Each agent returns a list of issues with the reason each was flagged:

| Agent | Focus | Method |
|-------|-------|--------|
| **#1: CLAUDE.md compliance** | Audit changes against CLAUDE.md rules | Read CLAUDE.md files, check each rule against the diff. Note: CLAUDE.md is guidance for writing code — not all instructions apply during review. |
| **#2: Shallow bug scan** | Obvious bugs in the changes only | Read the diff. Focus on large bugs. Avoid nitpicks. No extra context beyond the changes. |
| **#3: Historical context** | Bugs visible via git history | Read `git blame` and `git log` of modified files. Find bugs the diff alone wouldn't reveal. |
| **#4: Prior PR patterns** | Recurring issues from past reviews | Read previous PRs touching these files. Check if past review comments apply here. |
| **#5: Code comment compliance** | Respect in-code guidance | Read code comments (TODOs, NOTEs, warnings) in modified files. Check the changes comply. |

### What each agent checks

**Security:**
- SQL injection, XSS, auth bypass, secrets in code
- `target="_blank"` without `rel="noopener"`

**Type safety:**
- `any` usage (should be `unknown` or specific type)
- Type assertions (`as`) avoidable with narrowing

**Logic:**
- Off-by-one errors, null dereference, race conditions
- Missing error handling at API boundaries

**Accessibility** (UI changes only):
- Semantic HTML (`<button>` not `<div onClick>`)
- ARIA labels, alt text, keyboard navigation

## Step 6: Confidence Scoring

For **each issue** found in Step 5, score it 0-100 for confidence:

| Score | Meaning |
|-------|---------|
| **0** | False positive. Doesn't hold up to scrutiny, or is a pre-existing issue. |
| **25** | Might be real, but could be a false positive. Couldn't verify. If stylistic, not explicitly called out in CLAUDE.md. |
| **50** | Verified real, but a nitpick or unlikely in practice. Not very important relative to the rest of the PR. |
| **75** | Very likely real. Double-checked. Will be hit in practice. Existing PR approach is insufficient. Directly mentioned in CLAUDE.md. |
| **100** | Definitely real. Confirmed. Will happen frequently. Evidence directly proves it. |

For issues flagged due to CLAUDE.md, double-check that the CLAUDE.md **actually** calls out that issue specifically.

**Filter out anything scoring below 80.** If nothing remains, report "no issues found."

### False Positives — Do NOT Flag These

- Pre-existing issues (bugs that existed before this PR)
- Things that look like bugs but aren't
- Pedantic nitpicks a senior engineer wouldn't call out
- Issues a linter, typechecker, or compiler would catch (formatting, imports, type errors, broken tests) — assume CI runs these separately
- General code quality issues (test coverage, documentation) unless explicitly required in CLAUDE.md
- Issues explicitly silenced in code (lint-ignore comments, etc.)
- Intentional functionality changes related to the broader PR purpose
- Real issues on lines the user **did not modify**
- Code that wasn't changed in this PR

## Step 7: Report

### For current work (with plan verification):

```markdown
## Review Results

### Verification: X/Y PASS

[Verification table from Step 2]

### Code Review: N issues (confidence >= 80)

1. **[SEVERITY]** brief description (CLAUDE.md says "<...>" / bug due to <context>)

   https://github.com/OWNER/REPO/blob/FULL_SHA/path/to/file.ts#L10-L15

2. ...

### Overall Verdict

**PASS** — All criteria met, no blocking issues. Ready for `/pr`.

or

**NEEDS FIX** — N criteria failed, M issues found.
```

### For external PR review:

Post a comment via `gh pr comment` with this format:

```markdown
### Code review

Found N issues:

1. <brief description> (CLAUDE.md says "<...>")

   https://github.com/OWNER/REPO/blob/FULL_SHA/path/to/file.ts#L10-L15

2. <brief description> (bug due to <file and code snippet>)

   https://github.com/OWNER/REPO/blob/FULL_SHA/path/to/file.ts#L20-L25

Generated with [Claude Code](https://claude.ai/code)
```

Or if no issues:

```markdown
### Code review

No issues found. Checked for bugs and CLAUDE.md compliance.

Generated with [Claude Code](https://claude.ai/code)
```

**GitHub link requirements:**
- Full git SHA (not `$(git rev-parse HEAD)` — raw Markdown rendering)
- `#L[start]-L[end]` line range format
- At least 1 line of context before and after the issue line
- Repo name must match the repo being reviewed

**Severity levels:**
- **BLOCK** — Must fix before shipping. Security issues, failed criteria, broken types.
- **WARN** — Should fix. Missing accessibility, weak error handling, CLAUDE.md violations.
- **NOTE** — Consider fixing. Minor improvements, not blocking.

## Step 8: Offer Fixes (current work only)

If there are BLOCK or WARN issues:

> Found N issues. Want me to fix them?
>
> **Blocking:**
> 1. RefundReasonBadge not imported in page.tsx
>
> **Warnings:**
> 1. Missing aria-label on badge component

If the user says yes, fix directly, re-verify, and commit with `fix(<scope>): <description>`.

If all criteria PASS and no BLOCK issues:

> All clear. Ready for `/pr`.

---

## What This Skill Does NOT Do

- **Does not trust SUMMARY.md.** It reads the actual code.
- **Does not check build/typecheck/lint.** Assume CI runs those separately.
- **Does not review code outside the diff.** Only changed lines.
- **Does not update docs.** That's `/docs`.
- **Does not create PRs.** That's `/pr`.
- **Does not rewrite working code.** If it passes criteria and has no issues, it's done.
