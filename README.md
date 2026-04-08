# ystack

Doc-driven workflow orchestration for AI coding agents, built on top of [Beads](https://github.com/gastownhall/beads).

## Why?

**Beads** gives AI agents persistent memory — task graphs, structured notes, session protocols. But it doesn't know about your documentation, can't orchestrate multi-step execution with fresh context per agent, and doesn't verify code matches the spec.

**GSD** solves orchestration — goal-backward verification, plans-as-prompts, wave-based execution. But it's 65 commands with its own requirements system, disconnected from your docs.

**ystack** bridges the gap: 4 commands, doc-driven, built on Beads.

## The Flow

```
/build add refund reason to payments
  → reads docs + code, creates plan (user confirms)
/go
  → splits tasks, executes with fresh subagents, atomic commits
/review
  → code review, returns findings (user confirms)
/docs
  → updates affected documentation pages
/pr
  → creates PR draft
```

## Commands

| Command | What it does |
|---------|-------------|
| `/build <feature>` | Reads docs + code, surfaces assumptions, creates a plan. Asks you to confirm. |
| `/go` | Executes the plan — fresh subagent per task, atomic commits, structured notes. |
| `/review` | Code review against project rules. Fix issues or confirm. |
| `/docs` | Updates documentation affected by the changes. |
| `/pr` | Creates a PR draft with verify → docs check → pr-draft chain. |

For small tasks, `/build` detects simplicity and offers to execute immediately — no need for a separate `/go`.

## How It Works

| Layer | Tool | Role |
|-------|------|------|
| Persistent memory | **Beads** (`bd`) | Task graph, dependencies, session state, cross-session continuity |
| Workflow orchestration | **ystack** | Doc-driven intake, execution, review, doc sync, shipping |
| Your project | Existing skills | `pr-draft`, `docs-update`, `commit` — ystack chains into these |

### Core Ideas

1. **Docs are the spec** — AI reads your docs to understand what to build, then keeps them in sync
2. **Beads is the memory** — task state, dependencies, structured notes all live in `bd`
3. **Fresh context per agent** — subagents get clean context windows, preventing quality degradation
4. **Goal-backward verification** — check "what must be TRUE" not "what tasks ran"
5. **Assumptions over Q&A** — surface "here's what I'd do" and let you correct, instead of 20 questions

## Prerequisites

- [Beads](https://github.com/gastownhall/beads) (`bd`) installed and initialized
- [Claude Code](https://claude.ai/code) with skills support
- A project with documentation (Nextra/MDX preferred, any markdown works)

## Status

Planning phase. See [PLAN.md](./PLAN.md) for the full roadmap.

## License

MIT
