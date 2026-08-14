# 0001 — Milestone 0 Foundation Dependencies

- Date reviewed: 2026-08-14
- Scope: initial Svelte, Vite, Tauri, test, lint, formatting, and hook toolchain
- Resolution: adopted for the private Milestone 0 workspace

## Capability and alternatives

| Dependency group                              | Capability                                                                     | Alternatives considered           | Decision                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Svelte 5, Vite 8, and the Svelte Vite plugin  | Typed desktop UI and fast browser-side build                                   | Vanilla DOM code; React           | Svelte matches the project plan and keeps the initial UI surface small. Vite is its supported build path.   |
| Tauri 2 API, CLI, Rust crate, and build crate | macOS application shell and a narrow native boundary                           | Browser-only app; Electron        | Tauri provides the planned native shell without bundling a separate browser runtime.                        |
| TypeScript 6 and Svelte Check                 | Strict static checking across packages and components                          | JavaScript plus runtime checks    | TypeScript project references enforce the planned package direction before domain implementation begins.    |
| ESLint and focused plugins                    | Type-aware linting, import boundaries, cycles, sorting, and unused-code checks | Biome; custom scripts alone       | ESLint's Svelte and type-aware rule ecosystem covers the documented policy with focused local restrictions. |
| Prettier and its Svelte plugin                | One deterministic formatter for source, configuration, and documentation       | ESLint formatting; manual style   | Prettier supplies the repository-wide formatter contract with minimal custom policy.                        |
| Vitest                                        | Unit, property, and integration test runner                                    | Node's built-in test runner; Jest | Vitest integrates with the Vite/TypeScript toolchain and is ready for Milestone 0 behavior tests.           |
| simple-git-hooks                              | Install the fast pre-commit quality gate                                       | A committed shell hook; Husky     | It installs the package-script hook without a generated hook framework or platform-specific script.         |

The Node dependencies were selected at current stable releases available during
the review, subject to peer compatibility. Tauri and its Rust ecosystem are on
the current major release. Exact JavaScript resolutions and transitive versions
are committed in `pnpm-lock.yaml`; exact Rust resolutions are committed in the
desktop crate's `Cargo.lock`.

## Maintenance and licenses

The selected projects are actively released and are established parts of their
respective Svelte, Vite, Tauri, TypeScript, ESLint, and testing ecosystems. The
direct JavaScript packages use permissive MIT or Apache-2.0 licenses. Tauri's API
and Rust crates are dual licensed Apache-2.0 OR MIT. These licenses are compatible
with a private, unlicensed repository and do not determine the project's eventual
public license.

No source is vendored. License notices and full transitive-license reporting must
be revisited before public distribution.

## Runtime, bundle, and system impact

Only Svelte and `@tauri-apps/api` contribute application runtime code. Vite,
TypeScript, checks, formatter, test runner, and hook tooling are development-only.
Tauri adds a Rust build and relies on the operating system webview; macOS builds
therefore require Xcode development tools. Linux CI installs Tauri's documented
WebKitGTK and native build prerequisites.

The initial web production build is intentionally small. Bundle size will be
tracked once the render pipeline and asset catalogs add meaningful runtime data.

## Determinism and adapter boundaries

These dependencies do not implement geographic generation or seeded decisions.
Svelte and Tauri remain in `apps/desktop`; the application consumes internal
packages only through their public package entry points. Tauri messages will be
validated at the desktop adapter boundary when native commands are introduced.
Vitest, ESLint, Prettier, and build tools cannot enter canonical output.

Framework upgrades can still change SVG serialization, visual output, or build
behavior. Any such upgrade must run the applicable fixed-seed, SVG, visual, and
cross-platform suites once those fixtures exist. Geometry libraries require a
separate review and project-owned adapter before adoption.
