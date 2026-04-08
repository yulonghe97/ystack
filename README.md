# ystack

Doc-driven workflow orchestration for AI coding agents, built on top of [Beads](https://github.com/gastownhall/beads).

## The Idea

Your documentation should describe what your system IS — not what's planned, not what's in progress. Beads tracks the journey. Docs show the destination. ystack connects them.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Docs (Nextra)  │     │  Beads (bd)     │     │  Code           │
│  What it IS     │◄────│  What's done /  │────►│  The actual     │
│  Final specs    │     │  what's left    │     │  implementation │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        ▲                       ▲                       ▲
        └───────────────────────┴───────────────────────┘
                        Module Registry
                    (ystack.config.json)
```

**Three principles** drive the design (see [PHILOSOPHY.md](./PHILOSOPHY.md) for the full rationale):

1. **Documentation is the operating system.** A doc page is simultaneously the spec an AI reads, the reference your team reads, and the contract between modules. You write it once — it serves all three purposes.

2. **References, not dumps.** Agents get a pointer ("read `shared/payments.mdx`"), not a 500-line paste. Doc pages are highly cross-referenced so agents navigate the graph incrementally, the same way humans do.

3. **Final state only.** Docs describe what's built and working. Beads tracks what's planned and in progress. The boundary is clean — no "coming soon" in docs, no specs in Beads.

## Commands

### Starting a project

| Command | What it does |
|---------|-------------|
| `/skeleton` | Takes a big plan, splits it into module doc stubs + interaction diagrams + epic beads |
| `/import` | Scans an existing repo, generates module registry, flags doc gaps |

### Building features

| Command | What it does |
|---------|-------------|
| `/build <feature>` | Reads docs + code, surfaces assumptions, creates a plan. You confirm. |
| `/go` | Executes the plan — fresh subagent per task, atomic commits. |
| `/review` | Code review + goal-backward verification against success criteria. |
| `/docs` | Updates documentation for completed work (only completed, never planned). |
| `/pr` | Verify → docs check → create PR. |

### The flow

```
New project:
  big plan → /skeleton → pick a module → /build → /go → /review → /docs → /pr

Existing project:
  repo → /import → /build → /go → /review → /docs → /pr
```

## Team Collaboration

ystack is designed for teams where multiple developers (and their agents) work on the same repo simultaneously.

### What's shared

Everything that matters is committed and shared via git:

| Artifact | How it's shared | What the team sees |
|----------|----------------|-------------------|
| **Docs** (`docs/`) | Git | The current state of every module — architecture, contracts, data models |
| **Beads** (`.beads/`) | Dolt (synced via git refs) | Who's working on what, what's done, what's blocked, structured notes |
| **Module registry** (`ystack.config.json`) | Git | The full module map — which code, docs, and beads belong together |
| **CLAUDE.md / AGENTS.md** | Git | AI context that every agent on the team reads |

### What's NOT shared

Temporary working files stay local to each agent:

| Artifact | Why it's not shared |
|----------|-------------------|
| `.context/<bead-id>/PLAN.md` | Execution plan for one agent's current task — consumed by `/go`, then cleaned up |
| `.context/<bead-id>/DECISIONS.md` | Scratch pad — decisions flow into bead notes and doc pages once work completes |

### Parallel work

Multiple developers can work on different features at the same time because:

- **Beads** uses hash-based IDs (`bd-a1b2`) that never collide, even across branches
- **`.context/`** is scoped by bead ID — each feature gets its own folder, no overwrites
- **Dolt** (Beads' storage) supports cell-level 3-way merge — virtually no merge conflicts on task state
- **Docs** are page-per-module — two developers touching different modules won't conflict

### How a new team member onboards

1. Clone the repo. Docs are already there — read them to understand the system.
2. Run `bd ready` to see what's available to work on.
3. Pick a task, run `/build` — the agent reads the same docs and creates a plan grounded in real architecture.
4. No "ask Sarah about the payments module" — the docs page IS the answer.

### How knowledge flows

```
Developer A builds a feature:
  /build → /go → /review → /docs → /pr
                              ↓
                    Docs updated with new feature
                              ↓
Developer B starts their feature:
  /build reads the updated docs
    → agent has accurate context from A's work
    → no stale assumptions, no hallucinated architecture
```

The docs are always current because updating them is a step in the workflow, not a separate chore. Every completed feature automatically becomes context for the next developer's agent.

## Module Registry

The bridge between code, docs, and Beads. Each module maps to a doc page, code packages, and a Beads epic:

```json
{
  "modules": {
    "payments": {
      "doc": "shared/payments",
      "packages": ["packages/payments", "packages/db"],
      "epic": "bd-a1b2"
    }
  }
}
```

When a feature bead closes, ystack knows which doc page to update. When `/build` starts planning, it knows which doc page to read. The registry is the index — docs, code, and Beads are the content.

## Prerequisites

- [Beads](https://github.com/gastownhall/beads) (`bd`) installed and initialized
- [Claude Code](https://claude.ai/code) with skills support
- A project with documentation (Nextra/MDX preferred, any markdown works)

## Docs

- [PHILOSOPHY.md](./PHILOSOPHY.md) — Design principles and rationale
- [PLAN.md](./PLAN.md) — Full roadmap and command specs

## Status

Planning phase.

## License

MIT
