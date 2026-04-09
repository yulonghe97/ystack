# Design Philosophy

## The Five Constraints

The harness enforces five things on every agent interaction:

1. **Read the spec first.** Before writing code, the agent reads the relevant doc page. No guessing.
2. **Plan before executing.** The agent shows you what it will do. You confirm or correct.
3. **Verify against criteria.** After execution, goal-backward verification checks the codebase — "does this column exist? Is this endpoint wired?" — not "did the task complete?"
4. **Never simplify silently.** If the plan can't deliver what was decided, it splits into phases instead of cutting corners.
5. **Update docs when done.** Documentation reflects the new reality before the PR is created.

The harness also includes [agent linting](./LINTING.md) — rules that check agent behavior, not code style. Did the agent read the spec? Does the plan cover all decisions? Are docs updated? These rules grow with the harness: each new skill can ship its own lint rules.

## Documentation as the Operating System

Most teams treat documentation as a chore — something you write after the code is done, if you write it at all. ystack treats documentation as the operating system for your entire development process.

When you write a doc page for a module, that page becomes:
- The **spec** your AI agent reads before writing code
- The **reference** your team reads to understand the system
- The **context** a new developer uses to get up to speed
- The **contract** between modules that defines boundaries

You write it once. It serves all four purposes. There is no separate "planning doc" and "user doc" and "AI context file" — they are the same document.

## Three Layers, Three Roles

```
Docs        →  What the system IS (final state)
Progress    →  What's been done, what's left (development state)
Code        →  The actual implementation
```

These three layers never overlap in responsibility:

**Docs** describe the finished design. They answer: what does this module do? How does it connect to other modules? What data does it manage? What are the contracts at its boundaries? Docs never contain "planned", "coming soon", "TODO", or "v2". If it's in the docs, it's built and working.

**Progress files** track the journey. They record which features are implemented (checked), which are not yet built (unchecked), and which are blocked (via `depends-on:` annotations). They hold the decisions made during implementation and the notes that let an agent resume work after a context reset. Progress files are the development state — committed to git, branching and merging with the code they track.

**Code** is the implementation. It doesn't need to explain itself beyond what's necessary for maintenance. The architecture lives in docs. The progress lives in `.ystack/progress/`. The code just works.

## Why Human-Readable Markdown

AI agents work better with clean, structured prose than with machine-generated metadata blobs. A well-written doc page gives an agent:

- **Selective context** — read only the page you need, not a 500-line dump
- **Navigable structure** — headings, sections, and cross-references let the agent find exactly what's relevant
- **Accurate mental model** — prose written for humans forces clarity that JSON schemas don't

This is why ystack works with documentation frameworks like Nextra and Fumadocs. The docs are rendered as a real documentation site that humans browse. The same markdown files are what AI agents read as context. The format that's good for humans turns out to be good for agents too.

The alternative — generating machine-readable context files, planning artifacts, or structured metadata — creates information that's useful to nobody except the tool that generated it. It rots quickly, nobody maintains it, and it bloats agent context with noise.

## References, Not Dumps

When an agent needs to understand the payments module, ystack tells it: "Read `docs/src/content/shared/payments.mdx`." It does not paste the entire page into the prompt.

This matters because:

1. **Context windows are finite.** Every token of inlined content is a token you can't use for reasoning.
2. **Docs change.** A reference always points to the current version. Inlined content is stale the moment it's pasted.
3. **Agents can navigate.** A doc page with cross-references lets the agent follow links to related modules, just like a human developer would.

The module registry (`.ystack/config.json`) exists to give agents a map: "payments lives here in the code, here in the docs, and here in the progress files." From that map, the agent reads what it needs, when it needs it.

## Connected Documentation

Every doc page should be highly connected to related pages. Cross-references are not optional — they are how agents (and humans) navigate the system.

A module overview page should link to:
- Its sub-module pages (detailed specs for each component)
- Modules it depends on (upstream contracts it relies on)
- Modules that depend on it (downstream consumers)
- Data model pages (shared schema definitions)
- The system architecture page (where it fits in the big picture)

When an agent reads a module page and finds a reference to another module, it can follow that link to understand the boundary. This is how agents build understanding incrementally — by navigating a graph of connected documents, not by receiving a monolithic context dump.

The navigation structure (framework-specific: `_meta.ts` in Nextra, `meta.json` in Fumadocs) defines the hierarchy. Cross-references within page content define the graph. Together they create a documentation site that works as both a human-readable reference and an agent-navigable knowledge base.

## The Module Registry

The module registry bridges three worlds:

```json
{
  "payments": {
    "doc": "shared/payments",
    "scope": [
      "packages/payments/**",
      "packages/db/src/schema/transactions.*",
      "apps/api/src/routes/payments.*"
    ]
  }
}
```

- **doc** → where to read the spec (and where to write updates when features complete)
- **scope** → where the code lives, as glob patterns. A module doesn't have to be a package — it can span files across multiple packages, or live within a subdirectory of one. This is what to scan when planning and what to verify when done.

Progress is tracked by convention in `.ystack/progress/<module-key>.md` — one file per module, with feature checklists, decisions, and notes.

The registry tracks **modules only**. Sub-modules are tracked by the docs site (sub-pages within a module). Features are tracked in progress files (checklist items in the module's progress file). Each layer has its own hierarchy — the registry connects the top level.

When a feature is checked off in a progress file, ystack knows which doc page might need updating. When `/build` starts planning, it knows which files across the repo are relevant. When `/import` scans an existing repo, it builds this map automatically.

The registry is small, stable, and rarely changes. It's the index — the docs, code, and progress files are the content.

## Documentation Reflects Only Completed Work

This is a hard rule. Docs describe what IS, never what's planned.

When you run `/scaffold` to start a new project, it creates doc stubs — module overviews with interaction diagrams and section headers. These stubs show structure (what modules exist and how they connect) but not implementation detail. The detail gets filled in by `/docs` as features are completed and verified.

This means:
- A new team member reading the docs sees exactly what's built and working
- An agent reading the docs gets accurate context, not aspirational specs
- There's no "planned" section that's been "planned" for six months
- The gap between docs and reality is always zero for documented features

Progress files track what's planned and in progress. That's their role. Docs track what's done. The boundary is clean.

## Why This Works for Teams

A developer joins the project. They read the docs site. They understand the architecture, the module boundaries, the data models, the contracts. Everything they read is accurate because it describes completed, verified work.

They pick up a feature. `/build` reads the same docs to understand context. The agent and the developer are reading the same source of truth. The agent creates a plan grounded in real architecture, not hallucinated structure.

They finish the feature. `/docs` updates the relevant pages. The docs site now reflects the new reality. The next developer — or the next agent session — gets accurate context automatically.

No one wrote documentation as a separate task. The docs updated as a natural step in the workflow. The documentation site is always current because it's part of the development process, not an afterthought.
