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

When a feature bead closes → ystack knows which doc page to update.

## Prerequisites

- [Beads](https://github.com/gastownhall/beads) (`bd`) installed and initialized
- [Claude Code](https://claude.ai/code) with skills support
- A project with documentation (Nextra/MDX preferred, any markdown works)

## Status

Planning phase. See [PLAN.md](./PLAN.md) for the full roadmap.

## License

MIT
