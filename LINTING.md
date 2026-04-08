# Agent Linting

> **Status: Design Spec — Not Yet Implemented**
> None of the agent lint rules, hook infrastructure (`hooks/agent-lint.js`), or per-skill `rules/*.json` files described below are built. This document is a design specification for a future version of ystack. v0.1 includes basic Claude Code hooks (context monitoring, file-count nudge) but not the structured rule system described here.

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

## Core Rules

These ship with ystack out of the box.

### Workflow Rules

| Rule | Severity | When | What it checks |
|------|----------|------|---------------|
| `plan-before-edit` | Warn | PreToolUse on Edit | Is there an active `.context/<bead-id>/PLAN.md`? Nudges toward `/build` or `/quick`. |
| `spec-before-plan` | Block | During `/build` | Did the agent read the module's doc page before creating a plan? Prevents hallucinated architecture. |
| `decisions-before-execute` | Block | During `/go` | Does `.context/<bead-id>/DECISIONS.md` exist? No executing without confirmed decisions. |
| `plan-checker-passed` | Block | During `/go` | Has the plan-checker agent validated the plan? No executing unchecked plans. |
| `no-scope-reduction` | Block | During `/plan` | Does the plan cover ALL locked decisions from DECISIONS.md? Catches silent simplification. |

### Verification Rules

| Rule | Severity | When | What it checks |
|------|----------|------|---------------|
| `verify-before-ship` | Block | During `/pr` | Has `/review` passed all success criteria? No shipping unverified work. |
| `docs-before-ship` | Warn | During `/pr` | Are there closed beads without corresponding doc updates? Nudges toward `/docs`. |
| `typecheck-before-ship` | Block | During `/pr` | Does `pnpm typecheck` pass? No shipping broken types. |

### Documentation Rules

| Rule | Severity | When | What it checks |
|------|----------|------|---------------|
| `cross-references` | Warn | During `/docs` | Does the updated doc page link to related modules? Flags isolated pages. |
| `final-state-only` | Block | During `/docs` | Does the doc contain "planned", "coming soon", "TODO", "WIP"? Docs describe what IS. |
| `module-registered` | Warn | During `/build` | Is the target module in `ystack.config.json`? Catches work outside any module's scope. |

### Context Rules

| Rule | Severity | When | What it checks |
|------|----------|------|---------------|
| `context-budget` | Warn | PostToolUse | Is context usage above 60%? Suggests spawning subagents. |
| `context-critical` | Warn | PostToolUse | Is context usage above 80%? Suggests finishing current task or `/pause`. |
| `reference-not-dump` | Warn | During `/build` | Did the agent inline a full doc page into the plan instead of referencing it? |

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
3. **Project-specific rules.** Teams can add their own rules in `ystack.config.json`:

```json
{
  "linting": {
    "rules": {
      "plan-before-edit": "warn",
      "spec-before-plan": "block",
      "verify-before-ship": "block",
      "docs-before-ship": "warn",
      "cross-references": "warn",
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

## Implementation

Agent lint rules are thin hooks. Each rule is a single check that runs at a specific point in the workflow.

### Hook Structure

```javascript
// hooks/agent-lint.js
// PostToolUse hook — runs after every tool call

export default function agentLint({ tool, input, output, config }) {
  const rules = loadRules(config);
  const violations = [];

  for (const rule of rules) {
    if (rule.shouldRun(tool, input)) {
      const result = rule.check(tool, input, output);
      if (result.violated) {
        violations.push({
          rule: rule.name,
          severity: rule.severity,
          message: result.message
        });
      }
    }
  }

  // Warnings get surfaced as messages
  // Blocks prevent the action
  return formatViolations(violations);
}
```

### What Rules Can Check

Rules have access to:
- **Tool name and input** — which tool was called and with what arguments
- **File system** — read `.context/`, `ystack.config.json`, doc pages
- **Beads state** — `bd show`, `bd ready` (via shell)
- **Git state** — current diff, branch, recent commits

Rules do NOT:
- Modify files
- Call external APIs
- Block indefinitely
- Access conversation history

## Code Linting vs. Agent Linting

| | Code Linting | Agent Linting |
|---|---|---|
| **Tool** | Ultracite / Biome | ystack hooks |
| **Checks** | Formatting, syntax, style | Process, workflow, constraints |
| **When** | Pre-commit hook | During agent execution |
| **Grows with** | Language features | New skills and conventions |
| **Examples** | "Use `const` not `let`" | "Read the spec before planning" |
| **Configured in** | `biome.json` | `ystack.config.json` |

Both run automatically. Code linting on commit, agent linting during workflow. Together they ensure both the code and the process that produced it meet the team's standards.
