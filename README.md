# TTRPG Map Generator

An offline macOS application for generating, editing, saving, and exporting coherent
world-to-region fantasy maps. The project emphasizes selective deterministic regeneration,
preservation of accepted user work, believable geography, and a consistent hand-drawn atlas
style.

## Status

Milestones 0, 1, and 2 are complete. Milestone 2 implements the first geographic
whole-world atlas workflow: a registered seed and validated atlas controls produce a disposable
coarse preview and a separately generated accepted atlas; geography and appearance can be rerolled
with different isolation boundaries; accepted state can be saved, unloaded, reopened without
generation, and exported as deterministic SVG and 8192 by 4096 PNG.

The packaged workflow, deterministic exports, reviewed visual gallery, local and remote gates,
functional cancellation semantics, and Apple M5/24-GB coarse-preview matrix pass. The remaining
packaged full-generation/export reference matrices and cancellation-acknowledgement latency trials
retain their workloads and limits as Milestone 9 release-hardening requirements under
[ADR-0021](docs/adr/0021-defer-packaged-performance-evidence-to-milestone-9.md). The
[Milestone 2 release-evidence report](docs/milestone-2-release-evidence.md) preserves the complete
evidence and deferral record. Milestone 3 is the current product target.

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
- [Milestone 2 release evidence](docs/milestone-2-release-evidence.md)
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

1. Leave registered seed `81985529216486895` and the default controls in place.
2. Select **Generate coarse preview**, cancel the first request, and restart it. The labelled
   preview is disposable and cannot be saved as accepted geography.
3. Select **Accept full atlas**. Inspect stable landmass and water-body identities after the
   separate full-resolution transaction finishes.
4. Select **Preview geography reroll**, review the stated fixed/change set, then **Commit reviewed
   reroll**. Paper treatment, controls, seed, style versions, and singleton identities stay fixed.
5. Select **Preview appearance reroll**, review it, then **Commit reviewed reroll**. Semantic
   geography and the canonical coastline stay fixed while all three appearance aspects change.
6. Enter an absolute, previously unused `.mapworld` path whose parent already exists, then select
   **Save accepted .mapworld**. Save uses first-save semantics and does not overwrite a project.
7. Select **Unload accepted atlas**, then **Reopen saved atlas**. Confirm reopen evidence is `PASS`
   and generator calls during reopen is `0`.
8. Export deterministic SVG and 8192 by 4096 PNG from the reopened checkpoint. With no explicit
   destination picker, the files are `atlas-81985529216486895.svg` and `.png` in Downloads; move or
   remove any previous exports before exercising a fresh proof.

Run the focused workflow and visual evidence gates with:

```bash
corepack pnpm test:e2e
corepack pnpm test:visual
```

The complete command contract and enforcement policy live in
[`docs/03-code-style-and-tooling.md`](docs/03-code-style-and-tooling.md).
