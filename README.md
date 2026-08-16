# TTRPG Map Generator

An offline macOS application for generating, editing, saving, and exporting coherent
world-to-region fantasy maps. The project emphasizes selective deterministic regeneration,
preservation of accepted user work, believable geography, and a consistent hand-drawn atlas
style.

## Status

Milestones 0 and 1 are implemented. The desktop app now exposes the fixed deterministic-kernel
proof: seed `81985529216486895` produces one accepted outline and nine markers, **Reroll markers**
changes only the marker aspect, and a native `.mapworld` save can be unloaded and reopened without
calling either generator.

The Milestone 1 visible exit is:

> A seed produces a small repeatable composition; rerolling one test aspect leaves every unrelated
> aspect byte-for-byte unchanged after save/reopen.

This is deliberately a synthetic one-world-map proof with no `RegionalMap`; Milestone 2 owns the
first geographic whole-world atlas.

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
- [Milestone 2 whole-world atlas-proof contract](docs/milestone-2-atlas-proof.md)
- [Engineering rules and document ownership](docs/README.md)
- [Architecture](docs/01-architecture.md)
- [Naming and vocabulary](docs/02-naming-and-vocabulary.md)
- [Code style and tooling](docs/03-code-style-and-tooling.md)
- [Testing](docs/04-testing.md)
- [Git workflow](docs/05-git-workflow.md)
- [Definition of done](docs/06-definition-of-done.md)

Historical proposals live in `docs/archive/` and are not current requirements.

## Development

Prerequisites:

- macOS development tools from Xcode;
- Node.js `24.11.0` (recorded in `.node-version`);
- Corepack, included with the pinned Node.js release;
- Rust `1.97.1` through rustup (recorded in `rust-toolchain.toml`).

Install and verify the workspace:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm check
```

Run the desktop app:

```bash
corepack pnpm dev
```

In the proof window:

1. Leave the registered seed in place and select **Generate baseline**.
2. Inspect outline revision 0, marker revision 0, and their canonical SHA-256 evidence.
3. Select **Reroll markers** and confirm the outline stays fixed while the nine markers move and
   the marker-only isolation result is `PASS`.
4. Enter an absolute, previously unused `.mapworld` path whose parent exists, then select **Save
   .mapworld**. The proof uses first-save semantics and will not overwrite an existing target.
5. Select **Close proof** to unload the accepted document and `RenderScene`, then **Reopen proof**.
6. Confirm native reopen equality is `PASS`, generator calls on reopen is `0`, and the restored
   scene matches the rerolled checkpoint.

Run the focused workflow and visual evidence gates with:

```bash
corepack pnpm test:e2e
corepack pnpm test:visual
```

The complete command contract and enforcement policy live in
[`docs/03-code-style-and-tooling.md`](docs/03-code-style-and-tooling.md).
