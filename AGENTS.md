# Repository Instructions

## Orientation

- Read [`docs/README.md`](docs/README.md) before changing code, configuration, fixtures, or
  technical documentation.
- Treat [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md) as the source of truth for product
  scope, architecture, roadmap, and milestone acceptance criteria.
- Follow the owning document in `docs/` for architecture, vocabulary, tooling, testing, Git,
  and definition-of-done rules. Files in `docs/archive/` are historical context, not current
  requirements.
- Work toward the earliest incomplete milestone and its visible product proof. Milestone 0 is
  the initial implementation target.

## Working Agreements

- Keep each change narrowly tied to the selected milestone. Record follow-up work instead of
  silently expanding scope.
- Preserve existing user changes and avoid destructive Git operations.
- Follow the package dependency direction in `docs/01-architecture.md`; cross-package imports
  use declared public entry points.
- Keep generation, asset, and render output deterministic. Do not introduce ambient randomness,
  clocks, locale behavior, filesystem state, or unstable ordering into deterministic paths.
- Never silently regenerate or replace accepted semantic data, constraints, locks, decoration,
  or user edits.
- Keep semantic data, user intent, decoration, render scenes, and disposable caches distinct.
- Use explicit stable IDs, coordinate spaces, physical units, seed scopes, and versions at
  domain boundaries.
- Do not add a production dependency without the review required by
  `docs/05-git-workflow.md`. Hide third-party geometry types behind project-owned adapters.
- Treat this as a public repository. Never commit private data, including personal contact
  information, local paths, credentials, signing material, user content, or machine-specific
  configuration.

## Implementation and Verification

- Use strict TypeScript and validate persistence, worker, Tauri, and imported-data boundaries.
- Add tests with behavior changes, especially for determinism, persistence, geometry, and
  world-to-region continuity.
- Once the workspace scripts exist, use the root commands defined in
  `docs/03-code-style-and-tooling.md`; run the relevant focused checks while iterating and
  `pnpm check` before declaring a change complete.
- Treat rendered changes as requiring visual inspection in addition to automated checks.
- Keep configuration and its owning documentation synchronized in the same change.
- Use Conventional Commits and keep each commit a logical, safely revertible unit.

## Durable Decisions

- Record decisions with lasting architectural or compatibility consequences in `docs/adr/`
  using the repository template.
- Do not implement deferred map scales, a plugin system, a headless production CLI, cloud
  features, or Rust/WASM generation logic unless the project plan explicitly brings them into
  the active milestone.
