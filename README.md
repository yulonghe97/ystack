# ystack

```
                 _             _
  _   _ ___| |_ __ _  ___| | __
 | | | / __| __/ _` |/ __| |/ /
 | |_| \__ \ || (_| | (__|   <
  \__, |___/\__\__,_|\___|_|\_\
  |___/
```

[![npm version](https://img.shields.io/npm/v/ystack)](https://www.npmjs.com/package/ystack)
[![license](https://img.shields.io/npm/l/ystack)](./LICENSE)

**An agent harness for doc-driven development** — with git-native progress tracking.

**[English](./README.md)** | **[中文](./README.zh-CN.md)**

```bash
# Interactive setup guide
npx ystack

# New project with opinionated defaults
npx ystack create my-app

# Add to an existing project
cd your-project && npx ystack init
```

---

## Why

Most AI agent setups have a dirty secret: the context they feed the agent is separate from the docs humans read. You end up maintaining two sources of truth — one rots, the other drifts, and neither is reliable.

ystack makes your documentation site the single source of truth for both humans and agents.

<p align="center">
  <img src="./docs/diagrams/concept-en.svg" alt="One Doc, Four Roles" width="720" />
</p>

**Hard rule: docs reflect only completed work.** No "planned", no "coming soon", no six-month-old TODOs. If it's in the docs, it's built, verified, and working. The gap between docs and reality is always zero.

This means agents get accurate context every time — not hallucinated architecture, not aspirational specs, not stale planning artifacts that nobody maintains.

See [PHILOSOPHY.md](./PHILOSOPHY.md) for the full design rationale.

---

## How It Works

Three layers, connected by a module registry:

<p align="center">
  <img src="./docs/diagrams/architecture-en.svg" alt="Architecture Overview" width="820" />
</p>

Each module maps a doc page and code scope:

```json
{
  "modules": {
    "payments": {
      "doc": "shared/payments",
      "scope": ["packages/payments/**", "apps/api/src/routes/payments.*"]
    }
  }
}
```

---

## The Workflow

<p align="center">
  <img src="./docs/diagrams/workflow-en.svg" alt="Development Workflow" width="900" />
</p>

### Commands

| Command | What it does |
|---------|-------------|
| `/scaffold` | Takes a big plan, splits into module doc stubs + diagrams + progress files |
| `/import` | Scans existing repo, generates module registry, flags doc gaps |
| `/build <feature>` | Reads docs + code, surfaces assumptions, creates a plan. You confirm. |
| `/go` | Executes the plan — fresh subagent per task, atomic commits |
| `/quick` | Fast path for bug fixes, chores, small changes — skip planning and progress |
| `/review` | Code review + goal-backward verification against success criteria |
| `/docs` | Updates documentation for completed work (only completed, never planned) |
| `/pr` | Verify, docs check, create PR |
| `/address-review` | Fetch PR review comments, triage by priority, address approved fixes |

---

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

## Contributing

Issues and PRs welcome. Please open an issue before starting large changes.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release history.

## License

MIT
