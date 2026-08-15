# Milestone 0 retrospective — App and rendering proof

- **Status:** Complete
- **Completed:** 2026-08-14
- **Visible exit:** The desktop app displays and exports the same simple inked scene.

## What shipped

- A pnpm workspace with strict TypeScript checks, a Svelte/Vite desktop frontend,
  and a Tauri 2 shell.
- One renderer-neutral, hard-coded `RenderScene` interpreted by Canvas and
  deterministic SVG export.
- An interactive proof viewport with responsive pan and zoom, element selection,
  and an accessible inspector.
- Cross-platform quality checks on macOS and Linux.
- ADRs for render-scene primitives, viewport coordinate boundaries, and the
  future generation-worker message contract.

## What took longer or required iteration

- Interactive viewport work needed an additional review cycle to correct drag
  scaling on responsive Canvases, make scene selection keyboard-accessible, and
  isolate viewport and hit-testing logic for focused tests.
- Launch verification exposed a local toolchain-path issue and an already-running
  Vite process holding the development port. The repository configuration was
  sound, but local launch instructions should call out those environment checks
  when they become recurring contributor friction.
- The numeric reference “4” initially needed clarification between issue #4 and
  Milestone 4. Future task descriptions should say `issue #N` or `Milestone N`.

## Deliberately cut or deferred

- No persistent world document, generator, seed model, or geographic coordinate
  system was introduced; these belong to Milestone 1.
- No production worker was added. ADR-0003 establishes its boundary for the
  planned cancellable-preview work in Milestone 6.
- No additional map scales, editing tools, procedural assets, PNG export, or
  broad accessibility audit was started.

## Next milestone proof

Milestone 1 must prove the deterministic kernel: a fixed seed produces a small
repeatable composition, and rerolling one test aspect leaves unrelated output
byte-for-byte unchanged after save and reopen.

## Evidence

- `corepack pnpm check` passes locally.
- The quality workflow passes on macOS and Linux.
- Milestone 0 issues #1 through #4 are closed.
- The completed implementation and decisions are recorded in commits `7bbe7c9`
  and `f19848d`.
