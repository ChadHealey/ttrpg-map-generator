# 05 — Git Workflow

The repository uses a lightweight trunk-based workflow. The purpose is readable
history and recoverable changes, not process for its own sake.

## Branches

- `main` is releasable and must never be force-pushed or deleted. Enforce this with
  GitHub branch protection when the repository plan supports rules for private
  repositories; until then it remains a mandatory project rule rather than a
  server-side control.
- Use short-lived branches for changes that need more than one safe commit or CI
  cycle.
- Prefer one active change at a time for a solo project; unfinished work multiplies
  context switching.
- Branch names are lowercase and specific:
  `feat/world-seed-scopes`, `fix/atomic-save-recovery`,
  `docs/domain-vocabulary`.
- Rebase or merge current `main` before final integration according to repository
  policy; never rewrite published `main` history.

Direct commits to `main` may be acceptable for tiny documentation or tooling
changes while the repository is private, but they follow the same checks and commit
rules.

## Conventional Commits

Use:

```text
<type>(<scope>): <imperative summary>

Optional body explaining why and important consequences.

Refs #123
```

Types:

| Type       | Use                                                                      |
| ---------- | ------------------------------------------------------------------------ |
| `feat`     | User-visible or domain capability                                        |
| `fix`      | Incorrect behavior                                                       |
| `tune`     | Parameter, preset, or style-number change without structural code change |
| `refactor` | Structural change intended to preserve behavior                          |
| `perf`     | Measured performance improvement                                         |
| `docs`     | Documentation only                                                       |
| `test`     | Test-only change                                                         |
| `chore`    | Repository maintenance                                                   |
| `build`    | Build, packaging, or dependency configuration                            |
| `ci`       | Continuous integration                                                   |

Initial scopes:

`core`, `world`, `region`, `gen`, `assets`, `render`, `persist`, `desktop`,
`export`, `tooling`, `docs`

Use the narrowest stable scope. Do not coin a scope for one file.

The subject is imperative and describes the result:

```text
feat(region): preserve inherited river portals
fix(persist): retain the previous package after interrupted save
tune(assets): reduce evergreen rotation jitter
```

The diff explains what changed. The body explains why, non-obvious tradeoffs,
determinism/version consequences, migration impact, or what was deliberately left
out.

## One logical change per commit

A commit should be understandable and safely revertible on its own.

- Do not mix feature work with opportunistic cleanup.
- A regression test may land with its fix; that is one logical change.
- A schema change, migration, and fixture belong together.
- An output-changing algorithm change and its version bump belong together.
- Automated formatting caused by the change belongs with the change; unrelated
  repository-wide formatting does not.

Use `Refs #N` while advancing an issue and `Closes #N` only when the commit or
merged branch satisfies its acceptance criteria. Work without an issue is allowed
for genuinely tiny maintenance and should remain uncommon after implementation
begins.

## Merging

Squash branches whose intermediate commits are review/WIP history for one logical
change. Preserve multiple commits when each is independently coherent, passes the
required checks, and would be useful to inspect or revert separately.

The final history must not contain `wip`, `fix tests`, `address review`, or similar
messages. Never force-push `main`.

## Versions are not one number

Keep these compatibility concepts distinct:

- application version;
- world-document/package schema version;
- individual record schema versions where needed;
- generator ID and generator version;
- parameter schema version;
- seed-derivation algorithm version;
- style version;
- inherited-context contract version.

Increment the smallest version that truthfully describes the behavior change. An
application release does not automatically rewrite every generator version. A
refactor that preserves canonical output does not pretend to be an algorithm
upgrade.

Any intentional change to fixed inputs' canonical output states:

- which version changed;
- which accepted data remains untouched;
- whether an explicit upgrade operation exists;
- which semantic, SVG, and visual fixtures changed.

## Tags and milestones

Milestones represent demonstrated capabilities, not target dates. Tag only after
the milestone's visible exit and the release gate in
[04 — Testing](04-testing.md) pass.

Use semantic application versions. Pre-1.0 minor releases may correspond to major
capability milestones; patches fix released behavior without silently redesigning
accepted worlds.

## Architecture decisions

Write an ADR when a decision has durable tradeoffs, affects compatibility, or is
expensive to reverse. Required examples include:

- coordinate topology, projection, and quantization;
- seed derivation or scope changes;
- persistence format and atomic-save strategy;
- render-scene primitives and worker message contracts;
- geometry dependency adoption;
- moving logic to Rust/WASM;
- adding WebGL, SQLite, a public plugin boundary, or a new map scale;
- changing a package boundary.

Use [the ADR template](adr/0000-template.md). ADRs record why a choice was made,
not a diary of implementation steps. Supersede an old ADR rather than rewriting
its history.

## Dependency changes

A dependency commit or pull request records:

- the capability it supplies;
- alternatives considered;
- maintenance and release activity;
- license compatibility;
- runtime, bundle, and native/system requirements;
- deterministic-output risk;
- the adapter boundary that contains it.

Commit the pnpm lockfile with dependency changes. Do not bundle unrelated upgrades
with feature work. Output-sensitive upgrades run fixed-seed and cross-platform
fixtures.

## What is committed

Commit:

- source, tests, scripts, documentation, configuration, and lockfiles;
- small durable fixtures needed to prove determinism, migration, recovery, and
  visual behavior;
- vendored code only when the project explicitly chooses to own it and records its
  license and provenance.

Do not commit:

- `node_modules`, build directories, coverage output, local caches, editor state,
  logs, or temporary save packages;
- exported maps and ad hoc screenshots that are not reviewed fixtures;
- secrets, signing material, local paths, or machine-specific configuration;
- `.mapworld` packages containing personal/user content;
- large binaries outside the repository's chosen large-file policy.

Generated fixtures are allowed only when they follow
[07 — Deterministic Fixture Conventions](07-fixture-conventions.md): provenance and review
purpose are generated into the manifest, updates target one registered fixture, and a new
append-only review record names the intended behavior and version/compatibility consequence.
Never hand-edit a generated golden file or use a broad snapshot update.

## Repository hygiene

- Keep `.gitignore` narrow and understandable; do not hide unknown files with broad
  patterns.
- Delete merged branches.
- Remove abandoned feature flags and dead code.
- Keep the working tree free of generated exports after tests.
- Do not reformat, rename, or reorganize unrelated files while implementing a
  scoped change.
- Never use destructive Git recovery commands on work you do not own.
