# Engineering Rules

This directory defines how the TTRPG Map Generator codebase is kept coherent,
testable, and safe to evolve. These rules are binding once implementation begins.
They apply to application code, tests, scripts, fixtures, and technical
documentation unless a rule states otherwise.

The product and architecture source of truth remains
[`PROJECT_PLAN.md`](PROJECT_PLAN.md). These documents translate that plan into
day-to-day engineering constraints; they do not replace its product scope,
roadmap, or acceptance criteria.

Superseded planning proposals are retained in [`archive/`](archive/README.md)
for historical context. They are not current requirements or decision records.

## Read before changing code

| Document                                                    | Owns                                                                                                 |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [Project plan](PROJECT_PLAN.md)                             | Product scope, architecture, roadmap, risks, and MVP acceptance criteria                             |
| [01 — Architecture](01-architecture.md)                     | Package boundaries, data layers, generation, identity, coordinates, persistence, and cross-map rules |
| [02 — Naming and vocabulary](02-naming-and-vocabulary.md)   | Identifier conventions, units, events, files, and the canonical domain language                      |
| [03 — Code style and tooling](03-code-style-and-tooling.md) | TypeScript, Svelte, Rust, formatting, linting, module size, comments, and enforcement                |
| [04 — Testing](04-testing.md)                               | Test tiers, determinism, geometry, persistence, fixtures, snapshots, and visual review               |
| [05 — Git workflow](05-git-workflow.md)                     | Branches, commits, generated files, versions, dependencies, and ADRs                                 |
| [06 — Definition of done](06-definition-of-done.md)         | Completion checklists and named anti-patterns                                                        |
| [ADR template](adr/0000-template.md)                        | Durable technical decisions and their consequences                                                   |
| [Dependency reviews](dependency-reviews/README.md)          | Required capability, maintenance, license, runtime, and determinism review for adopted dependencies  |
| [Retrospectives](retrospectives/README.md)                  | Short milestone learnings, scope cuts, and the next visible proof                                    |

## Authority and conflicts

Different artifacts own different questions:

- Product scope, priorities, architectural model, and roadmap belong in
  [`PROJECT_PLAN.md`](PROJECT_PLAN.md).
- Durable technical decisions with real alternatives belong in `docs/adr/`.
- Recurring engineering behavior belongs in this rules suite.
- Exact executable settings belong in checked-in tool configuration such as
  `tsconfig.json`, ESLint configuration, Prettier configuration, and Cargo
  manifests.
- Work status and acceptance criteria for one change belong in its issue.

An artifact may summarize a rule owned elsewhere, but it must link to the owner
instead of developing a second, subtly different version.

If two sources conflict, do not choose whichever is convenient. Stop and update
the owning source and every affected summary in the same change. Configuration
and prose must agree before the change is done.

## Non-negotiables

These are the promises most likely to cause permanent damage if broken:

1. Generated output has no hidden randomness or ambient inputs.
2. Accepted user work is never silently regenerated, replaced, or migrated.
3. Semantic world data, user intent, decoration, render scenes, and caches remain
   distinct.
4. World-to-region continuity travels through persisted, versioned context
   contracts rather than parent-generator internals.
5. Coordinate spaces, physical units, stable IDs, and seed scopes are explicit
   in types.
6. Package dependencies point in the direction defined by the architecture.
7. Every output-changing behavior and persisted schema is versioned.
8. Tests, diagnostics, and visual review are part of a generator, not follow-up
   polish.

## Changing a rule

A rule may be changed when experience shows it is wrong. In the same change:

1. Update the owning document.
2. Update tool configuration and enforcement.
3. Update examples, templates, and summaries that mention it.
4. Search open work for assumptions based on the old rule.
5. Record an ADR when the change has durable architectural consequences.

Do not accumulate local suppressions to avoid changing a bad global rule. Do not
leave a documented rule in place after the codebase has deliberately rejected it.
