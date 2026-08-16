# 03 — Code Style and Tooling

Formatting, typing, linting, and package boundaries should turn recurring review
comments into executable checks. Exact configuration belongs in the checked-in
tool files; this document owns the intended policy.

The repository contains the Milestone 0 application scaffold and the root command
contract below. Specialized suites are added with the milestone that first needs
them.

## Root command contract

The pnpm workspace provides:

```bash
pnpm format          # rewrite supported source and config files
pnpm format:check    # verify formatting without changing files
pnpm lint            # ESLint and dependency-boundary checks
pnpm typecheck       # TypeScript project references and svelte-check
pnpm test            # default unit/property/integration suite
pnpm check           # format:check + lint + typecheck + test + Rust checks
```

Specialized suites have focused commands for direct iteration and named evidence gates:

```bash
pnpm test:visual
pnpm test:e2e
pnpm test:cross-platform
pnpm test:native-recovery
```

`pnpm test:e2e` runs the focused desktop orchestration test and the real native Milestone 1
workflow bridge. That bridge drives the production generate → reroll markers → save → close →
reopen sequence across Node and Rust, writes an actual sibling-directory `.mapworld` package, and
arms a generator-free reopen tripwire after unload.

`pnpm test:visual` runs the scene-adapter, semantic/render comparison, and deterministic PNG
rasterizer tests before regenerating every registered fixture into a disposable directory and
byte-comparing the reviewed semantic, SVG, PNG, and authoritative evidence. The PNG rasterizer is
test-only evidence tooling; production Canvas and SVG remain the application render backends.

`pnpm test:cross-platform` is the read-only deterministic fixture command defined by
[07 — Deterministic Fixture Conventions](07-fixture-conventions.md). The existing Linux and
macOS CI matrix runs this exact command. One spelling for each operation prevents README
snippets, CI, hooks, and local workflows from drifting apart.

`pnpm test:native-recovery` runs the real-filesystem `.mapworld` commit/recovery contract and
prints its native platform evidence. CI runs it separately on macOS and Linux and records the
filesystem containing the checked-out workspace where the integration tests create their parents.
The suite is also covered by `pnpm check`, then deliberately repeated under this named CI step so its
filesystem/platform output is easy to audit. The gate is serialized because its hard-exit child
processes and deterministic fault controller share one test filesystem contract. A local run proves
only the platform and filesystem it reports; it does not substitute for the other CI matrix leg.

No `pnpm benchmark` command exists yet. Benchmarks remain deferred until a costly generator or
large-output render path makes that specialized suite applicable.

## TypeScript is strict

All production TypeScript uses the workspace's strict base configuration. Start
with at least:

- `strict: true`;
- `noUncheckedIndexedAccess: true`;
- `exactOptionalPropertyTypes: true`;
- `noImplicitOverride: true`;
- `noFallthroughCasesInSwitch: true`;
- `useUnknownInCatchVariables: true`.

Additional rules:

- No explicit `any` in production code. Parse unknown data as `unknown` and
  narrow or validate it.
- Function parameters and exported return types are explicit when inference does
  not make the public contract unmistakable.
- Domain records exposed across packages are readonly.
- Promises are awaited, returned, or deliberately marked and explained. Floating
  promises are lint errors.
- Domain discriminated unions are handled exhaustively.
- Avoid numeric enums. Prefer validated string literal unions or `as const`
  tables for persisted values.
- Type assertions are narrow boundary tools, not a substitute for validation.
- Non-null assertions are forbidden in production code unless an immediately
  adjacent invariant proves them and the reason is documented.
- `@ts-ignore` is forbidden. A rare `@ts-expect-error` states why the error is
  expected and is covered by a test when it protects a compatibility boundary.

Tests may use small, documented relaxations for fixture construction. They may not
disable type checking for the behavior being tested.

## Boundary validation

Use Zod at trust boundaries:

- `.mapworld` manifests and records;
- migrations from old persisted schemas;
- Web Worker requests and responses;
- Tauri commands and native results;
- imported user content;
- future external plugin messages.

Validate once at entry, then convert to project-owned domain types. Do not carry
Zod objects, third-party geometry types, DOM types, or Tauri types through the
generation core.

Expected invalid data produces stable diagnostic or error codes plus actionable
context. User-facing logic must not depend on matching human-readable error text.

## ESLint policy

Use flat ESLint configuration with type-aware TypeScript and Svelte rules. It
must enforce, directly or through a focused custom rule:

- no `Math.random()` in `generation`, `assets`, `render`, or the explicitly listed deterministic
  seed-kernel modules under `core`;
- no forbidden package direction or private deep import;
- no import cycles;
- no explicit `any`;
- no unsafe assignment, call, return, or member access from `any`;
- no floating or misused promises;
- exhaustive switches over domain unions;
- no unused imports, variables, or unreachable code;
- consistent type-only imports;
- stable, automatic import ordering;
- no blanket lint-disable comments.

Do not ban wall-clock and DOM APIs across the entire repository: desktop UI,
profiling, and save metadata legitimately need them. Ban them in deterministic
output paths or isolate them behind explicitly injected services.

If a rule is wrong for the project, change the shared configuration and explain
why. A suppression that survives review names the exact rule and gives a local
reason. File-wide disables require exceptional justification.

## Formatting and text files

Prettier owns formatting for TypeScript, Svelte, JSON, YAML, Markdown, and other
supported text formats. Use these repository defaults unless a supported file
format requires otherwise:

- UTF-8;
- LF line endings;
- final newline;
- trailing whitespace removed, except intentional Markdown hard breaks;
- two-space indentation for web/configuration files;
- 100-character line-width target;
- formatting never rewrites files during a verification command.

Add `.editorconfig` during the scaffold so editors agree before Prettier runs.
Do not manually align columns in source code; the formatter decides.

## Svelte and desktop rules

Svelte components own presentation and interaction, not geographic rules.

- Move reusable domain behavior into the appropriate package.
- Keep stores small and purpose-built for transient state such as viewport,
  selection, active tool, progress, and open panels.
- The accepted `WorldDocument` is not recreated as a collection of UI stores.
- Worker and Tauri messages cross validated adapter boundaries.
- Components do not import generator implementation internals.
- Accessibility semantics and keyboard behavior are part of a component's public
  behavior.
- A component that mixes orchestration, domain transformation, and extensive
  markup should be split along those responsibilities.

## Rust and Tauri rules

Rust initially owns native shell capabilities such as dialogs and atomic file
operations. It does not become a second domain engine.

The root check runs the equivalents of:

```bash
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets --all-features -- --test-threads=1
```

- Tauri commands accept and return validated adapter DTOs.
- Native errors use typed error variants and stable codes.
- Do not panic on user data or recoverable operating-system failures.
- `unsafe` is absent by default. Any future use requires an isolated module, a
  safety explanation, an ADR, and focused tests.
- ADR-0008's required POSIX operations use the single isolated unsafe boundary at
  `apps/desktop/src-tauri/src/mapworld_native/platform_ffi.rs`; all callers use safe wrappers and
  the same native recovery suite must exercise those wrappers on macOS and Linux.
- Moving a generation algorithm into Rust or WASM requires a representative
  benchmark, a deterministic compatibility strategy, and an ADR.

## Module and file size

A source file over roughly 300 lines is a design prompt. A hand-written file over
500 lines is a defect unless a documented structural reason makes a split worse.

Line count is not the goal. Split along a stable responsibility or dependency
seam:

- domain model versus serialization adapter;
- generator planning versus algorithm implementation versus validation;
- Svelte orchestration versus visual subcomponents;
- Canvas backend versus SVG backend;
- public contract versus private algorithm helpers.

Do not split one coherent algorithm into arbitrary fragments merely to satisfy a
number. Generated, vendored, and data fixture files are exempt and clearly marked.

Avoid generic dumping grounds such as `utils.ts`, `helpers.ts`, `common.ts`, or
`misc.ts`. A shared helper belongs with the concept whose vocabulary explains it;
if no concept owns it, its abstraction may be premature.

## Public surfaces

- Export only what another package or feature is expected to use.
- Package entry points define the supported public surface.
- Do not add barrel files at every directory level; they hide ownership and make
  cycles easier. Use a deliberate package root entry point where a public API is
  required.
- A file normally has one primary exported concept. Closely coupled supporting
  types may stay beside it.
- Framework DTOs, persistence records, and domain entities are distinct types even
  when their current fields happen to match.

## Comments and documentation

- Module documentation explains purpose, layer, and important things the module
  deliberately does not know.
- Public API documentation states units, coordinate spaces, determinism,
  mutation, failure behavior, or invariants when they are not obvious from types.
- Comments explain why, mathematical reasoning, or a non-obvious constraint. They
  do not narrate the next line.
- Tunable parameters document unit, default, useful range, invalid range, and
  visible effect.
- `TODO` and `FIXME` comments reference an issue:
  `// TODO(#42): preserve portals during coastline reconciliation`.
- Delete commented-out code, debug output, temporary feature flags, and resolved
  TODOs before a change is done.

Complex geometry code should link to the paper, algorithm description, or ADR it
implements and state any deliberate deviation.

## Dependencies

- Use the pnpm lockfile and keep dependency versions reproducible.
- A new runtime dependency needs a concrete use, maintenance check, license check,
  bundle/runtime impact review, and comparison with a small project-owned solution.
- Geometry dependencies sit behind internal adapters.
- Do not expose transitive dependencies as if they were direct promises.
- Remove unused dependencies promptly.
- Dependency upgrades that may affect deterministic output run the fixed-seed and
  cross-platform suites before merge.

## Enforcement points

Milestone 0 installs:

- a fast pre-commit hook for formatting, linting, obvious forbidden files, and
  staged-file hygiene;
- full `pnpm check` in CI on every branch or pull request;
- Linux and macOS CI jobs, ready to run deterministic fixtures when those fixtures
  are introduced;
- visual and end-to-end suites at the frequencies defined in
  [04 — Testing](04-testing.md).

Hooks reject; they do not silently rewrite staged files. If bypassing a hook becomes
normal, recalibrate the hook rather than normalizing bypasses.
