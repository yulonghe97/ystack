# ystack

[![npm version](https://img.shields.io/npm/v/ystack)](https://www.npmjs.com/package/ystack)
[![license](https://img.shields.io/npm/l/ystack)](./LICENSE)

An agent harness for doc-driven development — built on top of [Beads](https://github.com/gastownhall/beads).

> **Status:** Early release (v0.1) — Claude Code only. Multi-runtime support is planned.

```bash
# Interactive setup guide
npx ystack

# New project with opinionated defaults
npx ystack create my-app

# Add to an existing project
cd your-project && npx ystack init
```

## Why

AI coding agents are capable but unstructured. Without guardrails, they:

- **Hallucinate architecture** — invent module boundaries that don't exist
- **Silently simplify** — deliver a "v1" of what you asked for instead of the real thing
- **Lose context** — forget decisions from 20 minutes ago as the context window fills
- **Skip verification** — mark tasks done without checking the code actually works
- **Ignore docs** — write code that drifts from the documented design, or never update docs at all

ystack fixes this. It makes agents read the spec before coding, plan before executing, verify against success criteria, and update docs when done. See [PHILOSOPHY.md](./PHILOSOPHY.md) for the full design rationale.

## How It Works

Three layers, connected by a module registry:

```
  Docs (MDX)          Beads (bd)           Code
  What it IS    ◄───  What's done /  ───►  The actual
  Final specs         what's left          implementation
       ▲                   ▲                    ▲
       └───────────────────┴────────────────────┘
                    Module Registry
                  (ystack.config.json)
```

| Layer | Role |
|-------|------|
| **Docs** | The spec agents read, the reference your team reads, the contract between modules. Written once, serves all three. |
| **Beads** | Development state machine. What's built, in progress, or blocked. Persistent memory that survives context resets. |
| **Code** | The implementation. Architecture lives in docs, progress lives in Beads. |

Each module in `ystack.config.json` maps a doc page, code scope (glob patterns), and a Beads epic:

```json
{
  "modules": {
    "payments": {
      "doc": "shared/payments",
      "scope": ["packages/payments/**", "apps/api/src/routes/payments.*"],
      "epic": "bd-a1b2"
    }
  }
}
```

## Commands

### Setup

| Command | What it does |
|---------|-------------|
| `/scaffold` | Takes a big plan, splits it into module doc stubs + interaction diagrams + epic beads |
| `/import` | Scans an existing repo, generates module registry, flags doc gaps |

### Build cycle

| Command | What it does |
|---------|-------------|
| `/build <feature>` | Reads docs + code, surfaces assumptions, creates a plan. You confirm. |
| `/go` | Executes the plan — fresh subagent per task, atomic commits. |
| `/review` | Code review + goal-backward verification against success criteria. |
| `/docs` | Updates documentation for completed work (only completed, never planned). |
| `/pr` | Verify, docs check, create PR. |
| `/address-review` | Fetch PR review comments, triage by priority, address approved fixes. |

### The flow

```
New project:       big plan → /scaffold → /build → /go → /review → /docs → /pr
Existing project:  repo → /import → /build → /go → /review → /docs → /pr
```

## Getting Started

```bash
# New project
npx ystack create my-app

# Existing project
cd your-project
npx ystack init
```

See [INSTALL.md](./INSTALL.md) for full setup options, prerequisites, and configuration.

## Documentation

- [PHILOSOPHY.md](./PHILOSOPHY.md) — Design principles and rationale
- [INSTALL.md](./INSTALL.md) — Installation and default stack
- [LINTING.md](./LINTING.md) — Agent linting rules
- [RUNTIMES.md](./RUNTIMES.md) — Multi-runtime support
- [PLAN.md](./PLAN.md) — Roadmap and command specs

## Contributing

Issues and PRs welcome. Please open an issue before starting large changes.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release history.

## License

MIT
