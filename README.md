# ystack

An agent harness for doc-driven development — built on top of [Beads](https://github.com/gastownhall/beads).

## The Problem with AI Agents

AI coding agents are capable but unstructured. Without guardrails, they:

- **Hallucinate architecture** — invent module boundaries that don't exist
- **Silently simplify** — deliver a "v1" of what you asked for instead of the real thing
- **Lose context** — forget decisions from 20 minutes ago as the context window fills
- **Skip verification** — mark tasks done without checking the code actually works
- **Ignore docs** — write code that drifts from the documented design, or never update docs at all

The fix isn't better models. It's a **harness** — a structure that constrains and guides agents so they work reliably, every time.

## What is an Agent Harness?

A harness doesn't do the work. It makes the work trustworthy.

```
Without harness:              With harness:

"Build payments"              /build payments
  → agent guesses               → reads docs/shared/payments.mdx
  → writes code                  → surfaces assumptions, you confirm
  → maybe works                  → creates plan with success criteria
  → no docs updated              → /go executes with fresh subagents
  → context rot after 30min      → /review verifies against criteria
                                 → /docs updates affected pages
                                 → /pr ships with confidence
```

The harness enforces five things:

1. **Read the spec first.** Before writing code, the agent reads the relevant doc page. No guessing.
2. **Plan before executing.** The agent shows you what it will do. You confirm or correct.
3. **Verify against criteria.** After execution, goal-backward verification checks the codebase — "does this column exist? Is this endpoint wired?" — not "did the task complete?"
4. **Never simplify silently.** If the plan can't deliver what was decided, it splits into phases instead of cutting corners.
5. **Update docs when done.** Documentation reflects the new reality before the PR is created.

The harness also includes [agent linting](./LINTING.md) — rules that check agent behavior, not code style. Did the agent read the spec? Does the plan cover all decisions? Are docs updated? These rules grow with the harness: each new skill can ship its own lint rules.

## The Three Layers

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

| Layer | Role | Owned by |
|-------|------|----------|
| **Docs** | What the system IS. The spec an AI reads, the reference your team reads, the contract between modules. Written once, serves all three. | Nextra / MDX |
| **Beads** | The development state machine. What's built, what's in progress, what's blocked. Persistent memory that survives context resets. | Beads (`bd`) |
| **Code** | The implementation. Doesn't need to explain itself — the architecture lives in docs, the progress lives in Beads. | Your repo |

The **module registry** (`ystack.config.json`) bridges them: each module maps to a doc page, code packages, and a Beads epic.

**Three principles** drive the design (see [PHILOSOPHY.md](./PHILOSOPHY.md) for the full rationale):

1. **Documentation is the operating system.** Agents get a pointer ("read `shared/payments.mdx`"), not a 500-line paste. Doc pages are highly cross-referenced so agents navigate the graph incrementally.

2. **Final state only.** Docs describe what's built and working. Beads tracks what's planned and in progress. The boundary is clean.

3. **References, not dumps.** Clean, structured prose beats machine-generated metadata. The format that's good for humans turns out to be good for agents too.

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

## Getting Started



See [INSTALL.md](./INSTALL.md) for full installation guide, default stack details, and configuration options.

## Docs

- [INSTALL.md](./INSTALL.md) — Installation, project setup, default stack
- [PHILOSOPHY.md](./PHILOSOPHY.md) — Design principles and rationale
- [LINTING.md](./LINTING.md) — Agent linting — rules that grow with the harness
- [RUNTIMES.md](./RUNTIMES.md) — Multi-runtime support — Claude Code, Codex, Cursor, and more
- [PLAN.md](./PLAN.md) — Full roadmap and command specs

## Status

Planning phase.

## License

MIT
