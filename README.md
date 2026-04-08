# ystack

Doc-driven workflow orchestration for AI coding agents, built on top of [Beads](https://github.com/gastownhall/beads).

## Why?

**Beads** gives AI agents persistent memory — task graphs, structured notes, session protocols. But it doesn't know about your documentation, can't orchestrate multi-step execution with fresh context per agent, and doesn't verify code matches the spec.

**GSD** solves orchestration — goal-backward verification, plans-as-prompts, wave-based execution. But it's 65 commands with its own requirements system, disconnected from your docs.

**ystack** bridges the gap:

| Layer | Tool | Role |
|-------|------|------|
| Persistent memory | **Beads** (`bd`) | Task graph, dependencies, session state, cross-session continuity |
| Workflow orchestration | **ystack** | Doc-driven intake, execution planning, goal-backward verification, shipping |
| Your project | Existing skills | `pr-draft`, `docs-update`, `commit` — ystack chains into these |

## Core Ideas

1. **Docs are the spec** — AI reads your Nextra/MDX docs to understand what to build, then keeps them in sync
2. **Beads is the memory** — task state, dependencies, structured notes all live in `bd`, not reinvented markdown
3. **Fresh context per agent** — subagents get clean context windows, preventing quality degradation
4. **Goal-backward verification** — check "what must be TRUE" not "what tasks ran"
5. **Assumptions over Q&A** — surface "here's what I'd do" and let you correct, instead of 20 questions

## Skills

| Skill | Purpose |
|-------|---------|
| `/prime` | Session start — reads `bd ready` + git log, shows where you are |
| `/kickoff` | Task intake — reads docs + code, surfaces assumptions, creates beads |
| `/plan` | Creates execution plan with goal-backward success criteria |
| `/execute` | Runs plan with per-task atomic commits and fresh subagents |
| `/verify` | Checks codebase against success criteria (distrusts summaries) |
| `/quick` | Lightweight path — one bead, inline execution, no subagents |
| `/next` | Computes ready front, routes to next action |
| `/discover` | Captures side-quest work with provenance (`discovered-from`) |
| `/ship` | Chains: verify → audit-docs → pr-draft → create PR |
| `/review` | Code review against project rules and design guide |

## Prerequisites

- [Beads](https://github.com/gastownhall/beads) (`bd`) installed and initialized
- [Claude Code](https://claude.ai/code) with skills support
- A project with documentation (Nextra/MDX preferred, any markdown works)

## Status

Planning phase. See [PLAN.md](./PLAN.md) for the full roadmap.

## License

MIT
