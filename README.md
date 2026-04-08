# ystack

AI-native development harness — doc-driven workflows, structured context, and composable skills for Claude Code.

## What is this?

ystack is a set of Claude Code skills and hooks that turn documentation into the operating system for AI-assisted development. Instead of treating docs as an afterthought, ystack makes your documentation site the single source of truth that AI reads, follows, and keeps in sync.

**Core ideas:**

1. **Docs are the spec** — AI reads your docs to understand what to build, then updates them when done
2. **Structured context survives compaction** — `.context/` files persist across sessions so you never lose your place
3. **Composable skills** — small, focused skills that chain together into workflows
4. **Goal-backward verification** — check "what must be TRUE" not "what tasks ran"
5. **Fresh context per agent** — subagents get clean context windows, preventing quality degradation

## Inspiration

Built on ideas from:

- [GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done) — context rot prevention, goal-backward verification, wave-based execution
- [Beads](https://github.com/gastownhall/beads) — persistent memory, structured notes, session protocols, ready fronts
- HellYeah — doc-driven development, monorepo-aware skills, Nextra as source of truth

## Status

Planning phase. See [PLAN.md](./PLAN.md) for the full roadmap.

## License

MIT
