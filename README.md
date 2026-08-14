# TTRPG Map Generator

An offline macOS application for generating, editing, saving, and exporting coherent
world-to-region fantasy maps. The project emphasizes selective deterministic regeneration,
preservation of accepted user work, believable geography, and a consistent hand-drawn atlas
style.

## Status

The project is in repository foundation work before Milestone 0 implementation. There is no
application scaffold yet.

Milestone 0 will prove the application and rendering architecture by displaying a small
hard-coded scene in a Svelte/Tauri desktop app and exporting that same scene through SVG. Its
visible exit is:

> The desktop app displays and exports the same simple inked scene.

## Planned Stack

- strict TypeScript
- Svelte and Vite
- Tauri 2 with a deliberately small Rust boundary
- pnpm workspace under the `@ttrpg-map/*` package scope
- Canvas 2D preview with SVG and PNG export
- Vitest, Playwright, ESLint, Prettier, and Rust checks

The macOS bundle identifier is `app.ttrpgmap.generator`. The repository is private and does
not currently grant an open-source license.

## Documentation

- [Consolidated project plan](docs/PROJECT_PLAN.md)
- [Engineering rules and document ownership](docs/README.md)
- [Architecture](docs/01-architecture.md)
- [Naming and vocabulary](docs/02-naming-and-vocabulary.md)
- [Code style and tooling](docs/03-code-style-and-tooling.md)
- [Testing](docs/04-testing.md)
- [Git workflow](docs/05-git-workflow.md)
- [Definition of done](docs/06-definition-of-done.md)

Historical proposals live in `docs/archive/` and are not current requirements.

## Development

The root development commands and contributor setup will be added with the Milestone 0
workspace scaffold. Their required command contract is already defined in
[`docs/03-code-style-and-tooling.md`](docs/03-code-style-and-tooling.md).
