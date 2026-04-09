---
name: import
description: >
  Analyze an existing codebase and generate a ystack module registry, Beads epics,
  and a documentation gap report. Use this skill when the user says 'import', '/import',
  'adopt this project', 'onboard this repo', 'scan the codebase', 'set up ystack here',
  or when adding ystack to a project that already has code and possibly docs.
  Supports incremental adoption with --module flag.
user-invocable: true
---

# /import — Adopt an Existing Project

You analyze an existing codebase and produce a module registry, Beads epics, and a gap report. This is the on-ramp for projects that already have code.

**You do NOT modify code or docs.** You produce a registry and report. The user decides what to act on.

## Phase 0: Determine Scope

1. Check if `ystack.config.json` already exists:
   ```bash
   cat ystack.config.json 2>/dev/null
   ```

2. If a `--module <name>` argument was provided, scope the import to that module only. Otherwise, scan the entire repo.

3. If the config already has modules registered, note which are new vs. already known.

## Phase 1: Scan the Codebase

Analyze the repo structure to detect logical modules. Spawn parallel research for each area:

### 1a: Structure scan

Map the directory tree to identify module boundaries:
```bash
# Find package.json files (monorepo packages)
find . -name "package.json" -not -path "*/node_modules/*" -maxdepth 3

# Get directory structure
ls -d apps/*/ packages/*/ 2>/dev/null

# Check for monorepo config
cat turbo.json 2>/dev/null
cat pnpm-workspace.yaml 2>/dev/null
cat lerna.json 2>/dev/null
```

Classify each directory:
- `apps/*` → likely an app module (UI, server, API)
- `packages/*` → likely a library package
- `src/modules/*` or `src/features/*` → feature-based structure (single-app repo)
- Top-level `src/` without sub-packages → single-module project

### 1b: Dependency scan

Map imports between modules to understand connections:
```bash
# Find cross-package imports
grep -r "from ['\"]@" packages/ apps/ --include="*.ts" --include="*.tsx" -l 2>/dev/null

# Check package.json dependencies for workspace references
cat packages/*/package.json | grep "workspace:" 2>/dev/null
```

Build a dependency graph: which modules import from which.

### 1c: Schema scan

Identify data models, API routes, and type definitions:
```bash
# Database schemas
find . -path "*/schema*" -name "*.ts" -not -path "*/node_modules/*" 2>/dev/null
find . -path "*/migrations*" -not -path "*/node_modules/*" -type d 2>/dev/null

# API routes
find . -path "*/routes/*" -o -path "*/api/*" -name "*.ts" -not -path "*/node_modules/*" 2>/dev/null

# Shared types
find . -path "*/types/*" -name "*.ts" -not -path "*/node_modules/*" 2>/dev/null
```

### 1d: Docs scan

Find existing documentation and map it to modules:
```bash
# Nextra
ls docs/src/content/_meta.ts 2>/dev/null && find docs/src/content -name "*.mdx" -o -name "*.md" 2>/dev/null

# Fumadocs
ls content/docs/meta.json 2>/dev/null && find content/docs -name "*.mdx" -o -name "*.md" 2>/dev/null

# Generic docs
ls docs/ README.md CLAUDE.md AGENTS.md 2>/dev/null
```

Read `_meta.ts` or `meta.json` files to understand the doc site structure. Read `CLAUDE.md` and `AGENTS.md` for project context.

## Phase 2: Detect Modules

Group the scan results into logical modules.

### Grouping rules

1. **Monorepo packages** — each `apps/` and `packages/` directory is a candidate module.

2. **Cross-cutting modules** — some modules span multiple packages. Look for:
   - A package that has schema files in `packages/db/` AND routes in `apps/api/` AND UI in `apps/admin/` → likely one module with scope across all three
   - Shared types that are consumed by multiple packages → the types belong to whichever module defines the domain

3. **Feature modules within a package** — a large package might contain multiple modules:
   - `packages/core/src/features/onboarding/index.ts` → could be its own sub-module
   - Only split if the docs site treats it as a separate section

4. **Infrastructure vs. domain** — separate infrastructure (db, shared, tsconfig) from domain modules (payments, auth, dashboard). Infrastructure packages are usually not their own modules unless the docs site documents them.

### Module detection output

For each detected module, determine:
- **Name** — human-readable identifier
- **Scope** — glob patterns for files that belong to this module
- **Doc page** — matching docs path (if docs exist) or `null`
- **Status** — `implemented` (has code), `documented` (has docs), `both`, or `gap`
- **Features** — key files/exports that represent implemented features
- **Dependencies** — other modules this one imports from

### Present findings

```
## Detected Modules (8)

| Module | Scope | Docs | Status |
|--------|-------|------|--------|
| payments | packages/payments/**, apps/api/src/routes/payments.* | shared/payments | both |
| auth | packages/shared/src/auth/**, apps/api/src/routes/auth.* | shared/authentication | both |
| dashboard | apps/dashboard/** | dashboard | both |
| admin | apps/admin/** | admin-dashboard | docs only (stub) |
| notifications | packages/notifications/** | notifications | both |
| billing | packages/billing/** | billing | code only (no docs) |
| db | packages/db/** | (infrastructure) | — |
| shared | packages/shared/** | shared | partial |

Connections:
  payments → db, shared
  dashboard → payments, billing, notifications, db
  admin → payments, dashboard, billing
  ...

Does this look right? I'll generate the registry from this.
```

**Wait for user confirmation.** The user may want to merge, split, or rename modules.

## Phase 3: Generate Module Registry

Create or update `ystack.config.json`:

```json
{
  "project": "<detected-project-name>",
  "docs": {
    "root": "<detected-docs-root>",
    "framework": "<nextra|fumadocs|unknown>"
  },
  "modules": {
    "payments": {
      "doc": "shared/payments",
      "scope": [
        "packages/payments/**",
        "packages/db/src/schema/transactions.*",
        "apps/api/src/routes/payments.*"
      ],
      "status": "active"
    }
  }
}
```

For each module:
- `doc` — the matching docs path, or `null` if no docs exist
- `scope` — glob patterns covering all files that belong to this module
- `status` — `"active"` if code exists, `"planned"` if only docs/stubs

If the config already exists, merge new modules — don't overwrite existing entries.

## Phase 4: Create Beads Epics

If Beads (`bd`) is available:

1. Create an epic per module:
   ```bash
   bd create "<Module Name>" -t epic --metadata '{"doc": "<module-slug>", "ystack": true}'
   ```

2. For each implemented feature detected in the code, create a **closed** child bead:
   ```bash
   bd create "<Feature description>" -t feature --parent <epic-id>
   bd close <bead-id> --reason "Pre-existing implementation detected by /import"
   ```

3. Add inter-module dependencies:
   ```bash
   bd dep add <epic-id> related:<dependent-epic-id>
   ```

4. Update `ystack.config.json` with epic IDs.

If Beads is not available, skip and note:
> Beads not detected. Run `bd init` to enable progress tracking.

## Phase 5: Generate Gap Report

Analyze the delta between code and docs:

```markdown
## Import Report

### Project: <name>
### Modules: N detected, M documented

---

### Fully Documented (N)
- payments — docs match implementation
- auth — docs match implementation

### Code Without Docs (N)
- billing — 5 features implemented, no doc pages
  - Invoice generation
  - Subscription management
  - Usage metering
  - Refund processing
  - Payment method CRUD

### Docs Without Code (N)
- admin/analytics — doc page exists but feature not implemented

### Stale Docs (N)
- shared/storage — docs reference old S3 API, code uses R2 SDK
  Evidence: docs mention `@aws-sdk/client-s3`, code imports `@acme/shared/storage`

### Missing Cross-References (N)
- dashboard/index.mdx mentions "Payments" but doesn't link to /shared/payments
- billing has no doc page, so nothing can link to it

---

### Recommended Next Steps
1. Run `/scaffold` or `/docs` to create docs for billing (5 undocumented features)
2. Update shared/storage docs (stale — S3 → R2 migration)
3. Add cross-reference links in dashboard/index.mdx
4. `/build` for any new features — the registry is ready
```

### Stale docs detection

Compare code and docs for inconsistencies:
- **Imports in docs vs. code** — do docs reference packages the code no longer uses?
- **API routes** — do docs describe endpoints that don't exist (or miss ones that do)?
- **Schema fields** — do data model tables in docs match actual schema files?
- **Module names** — do docs use old names for renamed modules?

Only flag clear mismatches. Don't flag vague prose that's technically correct.

## Phase 6: Summary

```
## Import Complete

### Registry
  ystack.config.json — N modules registered

### Beads
  N epics created, M features tracked (K pre-closed as implemented)

### Documentation
  N pages found, M gaps detected

### Next Steps
  - Fix N doc gaps with /docs or /scaffold
  - Run /build to start new feature work
  - The module registry connects code ↔ docs ↔ beads
```

---

## Incremental Adoption

With `--module <name>`:

1. Only scan files matching the specified module name or path
2. Only create one module entry in the registry
3. Only create one epic in Beads
4. Gap report scoped to that module

This is useful for large repos where a full scan is too slow, or when onboarding one team at a time.

---

## What This Skill Does NOT Do

- **Does not modify code.** Read-only scan.
- **Does not modify existing docs.** Reports gaps, doesn't fix them.
- **Does not install tooling.** No Turborepo, Ultracite, Nextra — that's `npx ystack init` or `create`.
- **Does not create doc pages.** Reports what's missing — `/docs` or `/scaffold` creates them.
- **Does not guess features.** Only reports what it can detect from code structure, exports, and file names.
