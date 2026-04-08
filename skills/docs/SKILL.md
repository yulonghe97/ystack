---
name: docs
description: >
  Update documentation for completed work. Only updates docs for features that are
  implemented and verified — never for planned or in-progress work. Use this skill
  when the user says 'docs', '/docs', 'update docs', 'update documentation',
  'sync docs', or after /review passes and before /pr.
user-invocable: true
---

# /docs — Update Documentation

You update documentation to reflect completed, verified work. Docs describe what the system IS — never what's planned.

## Phase 0: Detect What Changed

1. Get the diff to understand what code changed:
   ```bash
   git diff main...HEAD --stat
   ```

2. Read `.context/<feature-id>/DECISIONS.md` to understand the feature intent.

3. Read `.context/<feature-id>/PLAN.md` for the success criteria — these tell you what was built.

## Phase 1: Map Changes to Docs

Identify which documentation pages are affected.

1. **Read the module registry** (`ystack.config.json`) to find the module-to-doc mapping. Match changed file paths against module `scope` globs. If no registry exists, fall back to scanning `docs/src/content/_meta.ts`.

2. **Map changed code paths to doc pages:**

   | Code path pattern | Likely doc page |
   |-------------------|----------------|
   | `packages/<name>/` | `docs/src/content/<module>/` or `docs/src/content/shared/<name>/` |
   | `apps/<name>/` | `docs/src/content/<module>/` |
   | `packages/db/src/schema*` | Data model sections across affected modules |
   | `apps/api/src/routes/` | API module + any module whose API changed |

3. **Read the affected doc pages** before modifying them. Understand what's currently documented.

## Phase 2: Update Affected Pages

For each affected doc page, update ONLY the sections impacted by the new feature.

**What to update:**

| Change type | Doc section to update |
|-------------|----------------------|
| New database column/table | Data Model section — add to table/columns/notes table |
| New API endpoint or field | Dependencies section — update "Provides" list, or relevant sub-module page |
| New UI component or page | Sub-modules table — add or update entry |
| New module dependency | Dependencies section — update "Needs" table |
| Changed flow or behavior | Flows section — update Mermaid diagram and numbered explanation |
| New sub-module | Sub-modules table + create new sub-module page if significant |

**What NOT to update:**
- Sections unrelated to the feature
- "Purpose" section (unless the module's core responsibility changed)
- "Team" section
- "Scope" section (unless something moved in/out of scope)

**Writing rules:**
- Present tense, active voice: "The gateway normalizes messages" not "Messages will be normalized"
- Purpose over implementation: describe what it does and why, not how the code works
- No version language: no "v1", "v2", "Phase 1", "new", "recently added"
- No planning language: no "planned", "coming soon", "TODO", "will be", "in progress"
- Link, don't recap: reference other pages instead of repeating their content
- Use cross-references: `[Module Name](/module-path)` for every module mention

**Diagram rules (if updating Mermaid diagrams):**
- Use the right type: `sequenceDiagram` for multi-actor flows, `graph TB/LR` for architecture, `erDiagram` for data models
- Label edges: `-->|"what flows"|` not just `-->`
- Keep under 20 nodes — split if bigger
- Every diagram needs a text explanation below it

## Phase 3: Update Navigation

If you created a new doc page, add it to the relevant `_meta.ts`:

```typescript
// docs/src/content/<module>/_meta.ts
export default {
  index: "Overview",
  "existing-page": "Existing Page",
  "new-page": "New Page",        // ← add here, object key order = sidebar order
};
```

## Phase 4: Update Structural Files

If the feature changed module responsibilities, dependencies, or structure, also update:

1. **`CLAUDE.md`** — if the Structure section or Commands changed
2. **`AGENTS.md`** — mirror CLAUDE.md changes
3. **Package-level `CLAUDE.md`** — if a package's responsibilities changed

Most features don't require structural file updates. Only update these if the module's role or boundaries shifted.

## Phase 5: Verify

1. Check that all cross-reference links point to existing pages:
   ```bash
   # Extract links from updated docs and verify targets exist
   grep -oP '\[.*?\]\((/[^)]+)\)' docs/src/content/<module>/*.mdx
   ```

2. Confirm no planning language leaked in:
   ```bash
   grep -i -E '(coming soon|planned|todo|will be|in progress|phase [0-9])' docs/src/content/<module>/*.mdx
   ```

3. Present a summary of what was updated:
   ```
   ## Documentation Updates

   ### Modified
   - docs/src/content/shared/payments/index.mdx
     - Added `refundReason` to Data Model table
     - Updated Refund Flow sub-module description

   ### Created
   - (none)

   ### Structural files
   - (no changes needed)
   ```

---

## Delegating to Existing Skills

If the project has its own documentation skills (e.g., `docs-update`, `docs-module`, `docs-page`), prefer delegating to them. They know the project-specific conventions.

- **Updating existing pages** → delegate to `docs-update` if available
- **Creating a new module's docs** → delegate to `docs-module` if available
- **Writing a single new page** → delegate to `docs-page` if available

If no project-specific doc skills exist, follow the process above.

---

## What This Skill Does NOT Do

- **Does not document planned features.** Only completed, verified work.
- **Does not rewrite entire pages.** Updates only affected sections.
- **Does not create module scaffolds.** That's `/skeleton` or `docs-module`.
- **Does not create PRs.** That's `/pr`.
