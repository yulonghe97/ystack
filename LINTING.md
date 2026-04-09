# Agent Linting

## Two Types of Linting

**Code linting** checks what the code looks like — formatting, syntax, style. Tools like Ultracite/Biome handle this. You configure it once and it covers all code. Adding a new feature doesn't mean adding new rules.

**Agent linting** checks what the agent does — did it follow the process? Did it read the spec? Did it verify its work? This is the harness enforcing discipline on agent behavior, not code quality.

Code linting is static. Agent linting grows with the harness. Each new skill or convention can ship with its own agent lint rule.

## How Agent Linting Works

Agent lint rules are implemented as Claude Code hooks — `PreToolUse` and `PostToolUse` checks in `.claude/settings.json`. They run automatically during agent execution, providing warnings or blocks at the right moment.

```
Agent tries to edit code
  → PreToolUse hook fires
  → Check: is there an active plan?
  → No plan → soft warning: "Consider /build for tracked changes"
  → Has plan → proceed
```

Rules come in two severities:

- **Warn** — surface a message, let the agent continue. For nudges and best practices.
- **Block** — prevent the action. For hard constraints that protect quality.

---

## Built Hooks

These are implemented and installed by `npx ystack init`.

### Workflow Hooks

| Hook | File | Trigger | What it does |
|------|------|---------|-------------|
| **workflow-nudge** | `workflow-nudge.js` | PreToolUse on Edit/Write | After 3+ source files edited without an active `.context/<feature-slug>/PLAN.md`, warns: "Consider /build for tracked changes." Dismissible via `.context/.no-nudge`. |
| **context-monitor** | `context-monitor.js` | PostToolUse on * | Warns at 60% context usage (suggest subagents) and 80% (suggest finishing current task). Silent if runtime doesn't expose context metrics. |
| **session-start** | `session-start.sh` | Session start | Shows unchecked features from `.ystack/progress/` and any in-progress plans in `.context/`. |

### Progress Integrity Hooks

| Hook | File | Trigger | What it does |
|------|------|---------|-------------|
| **progress-before-ship** | `progress-before-ship.js` | PreToolUse on Bash (git push / gh pr create) | Warns if the branch has code changes but no `.ystack/progress/` updates. Catches `/go` forgetting to check the box. |
| **docs-match-progress** | `docs-match-progress.js` | PostToolUse on Edit/Write (doc files) | After editing a doc file, checks that `[x]` items in the module's progress file don't still have `<!-- ystack:stub -->` in docs. Catches incomplete doc updates. |
| **no-undocumented-check** | `no-undocumented-check.js` | PreToolUse on Edit (progress files) | When checking a box `[x]` in a progress file, warns if the linked doc section still has `<!-- ystack:stub -->`. Reminds you to run `/docs` before `/pr`. |

---

## Design Spec — Not Yet Implemented

The rules below are enforced by the skill prompts themselves (the SKILL.md instructions tell the agent what to check). They are not separate hook implementations. A future version of ystack may extract these into standalone hooks for harder enforcement.

### Workflow Rules (prompt-enforced)

| Rule | Severity | When | What it checks |
|------|----------|------|---------------|
| `spec-before-plan` | Block | During `/build` | Did the agent read the module's doc page before creating a plan? Prevents hallucinated architecture. |
| `decisions-before-execute` | Block | During `/go` | Does `.context/<feature-slug>/DECISIONS.md` exist? No executing without confirmed decisions. |
| `plan-checker-passed` | Block | During `/go` | Has the plan-checker agent validated the plan? No executing unchecked plans. |
| `no-scope-reduction` | Block | During `/build` | Does the plan cover ALL locked decisions from DECISIONS.md? Catches silent simplification. |

### Verification Rules (prompt-enforced)

| Rule | Severity | When | What it checks |
|------|----------|------|---------------|
| `verify-before-ship` | Block | During `/pr` | Has `/review` passed all success criteria? No shipping unverified work. |
| `typecheck-before-ship` | Block | During `/pr` | Does `pnpm typecheck` pass? No shipping broken types. |

### Documentation Rules (prompt-enforced)

| Rule | Severity | When | What it checks |
|------|----------|------|---------------|
| `cross-references` | Warn | During `/docs` | Does the updated doc page link to related modules? Flags isolated pages. |
| `final-state-only` | Block | During `/docs` | Does the doc contain "planned", "coming soon", "TODO", "WIP"? Docs describe what IS. |
| `module-registered` | Warn | During `/build` | Is the target module in `.ystack/config.json`? Catches work outside any module's scope. |
| `reference-not-dump` | Warn | During `/build` | Did the agent inline a full doc page into the plan instead of referencing it? |

---

## Adding Rules When You Add Skills

Each skill can ship with its own lint rules. When you install a skill, its rules get added to the hook configuration automatically.

**Example: adding a `/test` skill**

The skill comes with:
```
skills/test/
├── SKILL.md
└── rules/
    └── tests-before-ship.json
```

The rule definition:
```json
{
  "name": "tests-before-ship",
  "severity": "warn",
  "hook": "PreToolUse",
  "trigger": "during /pr",
  "check": "Do test files exist for changed modules?",
  "message": "Changed modules have no tests. Consider /test before shipping."
}
```

On install, this gets wired into `.claude/settings.json` alongside the skill.

## Rule Lifecycle

Rules evolve with the project:

1. **Start soft.** New rules ship as `warn`. Teams adopt the practice before it becomes enforced.
2. **Promote to block.** Once the team is comfortable, flip severity to `block` for critical rules.
3. **Project-specific rules.** Teams can add their own rules in `.ystack/config.json`:

```json
{
  "linting": {
    "rules": {
      "plan-before-edit": "warn",
      "verify-before-ship": "block",
      "docs-before-ship": "warn",
      "custom-rules": [
        {
          "name": "security-review-for-auth",
          "severity": "block",
          "trigger": "during /pr",
          "check": "If changed packages include 'auth', has a security-focused review been done?",
          "message": "Auth changes require security review. Run /review --security first."
        }
      ]
    }
  }
}
```

4. **Disable rules.** Any rule can be turned off per-project:

```json
{
  "linting": {
    "rules": {
      "context-budget": "off"
    }
  }
}
```

## Code Linting vs. Agent Linting

| | Code Linting | Agent Linting |
|---|---|---|
| **Tool** | Ultracite / Biome | ystack hooks |
| **Checks** | Formatting, syntax, style | Process, workflow, constraints |
| **When** | Pre-commit hook | During agent execution |
| **Grows with** | Language features | New skills and conventions |
| **Examples** | "Use `const` not `let`" | "Read the spec before planning" |
| **Configured in** | `biome.json` | `.ystack/config.json` |

Both run automatically. Code linting on commit, agent linting during workflow. Together they ensure both the code and the process that produced it meet the team's standards.
