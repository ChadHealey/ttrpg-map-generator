# 01 — Architecture

These rules turn the architectural model in
[`PROJECT_PLAN.md`](PROJECT_PLAN.md) into constraints that can be checked in a
diff. Optimize for the central promise: a user can move between a world and its
regions and selectively regenerate one concern without losing continuity or
accepted work.

## Rule 1 — The world document is authoritative

The persistent `WorldDocument` is the center of the application. Canvas pixels,
Svelte stores, worker messages, database-shaped records, and SVG nodes are not
domain entities.

Keep five categories distinct:

1. **Semantic world data** — what exists at a map's scale.
2. **Constraints and overrides** — user intent that generation must honor.
3. **Decoration** — derived motif placement, hatching, and label layout.
4. **Render scene** — renderer-neutral drawing instructions.
5. **Disposable caches** — previews, indexes, tiles, thumbnails, and export
   intermediates.

A forest is a semantic region, not a collection of tree drawings. A coastline
is canonical geometry, not an SVG path. A moved label is persisted user intent,
not a mutation hidden in viewport state.

The deletion test is decisive: deleting every cache and rebuilding every render
scene must preserve all accepted semantic data, decoration, constraints, locks,
and user edits.

## Rule 2 — Dependencies point one direction

The initial workspace has these internal packages:

```text
apps/desktop
    |---> packages/persistence ---> packages/core
    |---> packages/generation  ---> packages/core
    |---> packages/assets      ---> packages/core
    |---> packages/render      ---> packages/core
    `---> packages/core
```

The rules are:

- `core` imports no other internal package.
- `generation` and `assets` depend on `core`; they never import desktop,
  persistence, Canvas, SVG DOM APIs, Svelte, or Tauri.
- `render` consumes the render-scene contract from `core`; it never imports a
  generator implementation.
- `persistence` validates and serializes domain records; it does not own domain
  behavior or invoke generators during load.
- `desktop` orchestrates lower packages and owns transient interaction state.
- Cross-package imports go through the package's declared public surface. No
  consumer reaches into another package's private directory.
- Cyclic package or module dependencies are defects.

Enforce package boundaries through TypeScript project references and ESLint. A
diagram that is not executable will eventually become fiction.

Do not split a new package merely to make a folder look architectural. Add a
package only when it has a real public contract, more than one consumer, or an
independently enforced dependency boundary.

## Rule 3 — Ownership and dependency are different structures

The ownership tree answers, "Who contains and saves this?" The aspect dependency
DAG answers, "What may become stale when this changes?" Never force one to act as
the other.

- Every entity has exactly one owning map.
- Every child map has exactly one parent map.
- Every meaningful entity and generated aspect has a stable opaque ID.
- Display names and array positions are never references.
- Dependencies name stable aspects, not object addresses or current list slots.
- Cross-map dependency edges carry declared context provenance.
- A parent change may mark a child's inherited context stale; it does not
  directly replace accepted child geography.

The MVP ownership path is `WorldDocument -> WorldMap -> RegionalMap`. Future map
kinds may extend that tree, but no future node is implemented until its milestone
requires it.

## Rule 4 — Cross-map continuity uses a context contract

A regional generator consumes a persisted, versioned inherited-context snapshot.
It never reaches into a world generator's working data, cache, or private type.

The contract includes the footprint, projection, transforms, source lineage,
classification and geometry anchors, physical fields, boundary continuations,
seed namespace, source aspect versions, and checksum required by the plan.

The contract has four obligations:

1. It can be saved and understood without loading generator internals.
2. Its transform composes back to the root world map and round-trips within a
   declared tolerance.
3. It identifies exactly which accepted parent state the child used.
4. It supports a meaningful stale-context diff after the parent changes.

Current parent context and the accepted child snapshot may differ. Classify the
difference as non-conflicting, reconcilable, or conflicting, then offer an
explicit keep, reconcile, or regenerate operation. Loading and parent editing
never make that choice silently.

Adjacent regional children share root-coordinate refinement and boundary data so
physical fields and crossing features agree. Overlapping regional footprints are
rejected in the MVP rather than approximated with independent seeds.

## Rule 5 — Generation is deterministic and isolated

A generator's output is a function of its immutable inputs, parameters, declared
behavior versions, and explicit deterministic context. It may not depend on:

- `Math.random()`;
- wall-clock time or locale;
- global mutable state;
- object, set, or hash-map iteration order when order affects output;
- worker scheduling or completion order;
- Canvas, DOM, Svelte, filesystem, or process state;
- an undeclared cache entry.

Every randomized aspect declares one seed scope:

- **Map/entity scope** for independent accepted features and decoration.
- **Root-coordinate scope** for physical refinement shared by surface children.
- **Shared-boundary scope** for portals and continuations shared by related maps.

The scope and every seed input are versioned generation metadata. Changing seed
scope is an output-changing migration, not a refactor.

Stable ordering is explicit. Parallel work writes keyed results and performs a
stable final ordering; it does not append in completion order. Cancellation and
progress observation may interrupt work but may not influence a completed result.

## Rule 6 — Generators propose; the document commits

The conceptual generator contract may evolve during early milestones, but the
separation of responsibilities may not:

```ts
interface Generator<P, O> {
  readonly manifest: GeneratorManifest;
  plan(context: ReadContext, target: GenerationTarget): GenerationPlan;
  generate(
    context: GenerationContext,
    plan: GenerationPlan,
    params: P,
  ): O;
  validate(output: O, context: ValidationContext): Diagnostic[];
}
```

A generator:

- receives immutable validated inputs and explicit random streams;
- declares input/output aspects, seed scope, versions, validation, and dirty
  bounds where relevant;
- returns proposed output and diagnostics;
- performs no save, UI mutation, or document commit;
- reports expected failure as actionable diagnostics.

The application service validates a proposed patch, previews its effects when
required, and commits the whole valid transaction or none of it. Undo/redo records
domain commands and snapshots, not pixel changes.

## Rule 7 — Accepted data is immutable until an explicit transaction

Accepted semantic geometry, decoration, constraints, and aspect metadata are read
as immutable values. A renderer, validator, cache builder, or UI component cannot
modify an object it was handed.

Changes occur through named document commands that identify:

- the target map, entity, and aspect;
- the expected previous revision;
- proposed replacements;
- affected dependencies and diagnostics;
- undo information.

Locks are retained even when upstream changes make them inconsistent. The system
reports the inconsistency rather than replacing locked output.

## Rule 8 — Coordinate spaces and units are types

Planet-native, regional, screen, render, and print coordinates are distinct.
Physical distance, screen pixels, print points, angles, ratios, and grid cells are
not interchangeable numbers.

- Use branded types or small immutable records for domain coordinates, units, map
  IDs, entity IDs, aspect IDs, and revisions.
- Transforms are explicit values with named source and destination spaces.
- World display projections never become authoritative planet geometry.
- Regional geometry uses explicit physical units and an invertible world mapping.
- Persisted geometry is quantized using the policy for its own coordinate space.
- Third-party geometry values are converted at an adapter boundary and do not leak
  through the domain model.

An `x: number, y: number` pair without a declared space is not acceptable in a
public domain contract.

## Rule 9 — Persistence restores; it does not redesign

The `.mapworld` package persists accepted state and sufficient provenance to open
the world without running a generator. Loading performs validation, migration when
explicitly supported, and reconstruction of disposable caches only.

- Saves use an immutable snapshot, canonical ordering, checksums, and atomic
  replacement with recovery information.
- Every released schema retains a migration fixture.
- Output-changing generator, seed, style, and parameter-schema behavior is
  versioned independently where appropriate.
- Unknown or incompatible required data fails with an actionable error; it is not
  discarded.
- Generator upgrades are offered as explicit operations after load.

Persistence serializes domain data but does not define its behavior. Domain rules
live in `core` and generation modules, not as accidental consequences of JSON
shape.

## Rule 10 — Rendering never becomes a second world model

Canvas preview and SVG/PNG export consume the same renderer-neutral `RenderScene`.
They may differ in level of detail or rasterization strategy, but not in semantic
interpretation.

- Render nodes retain stable source entity links and stable ordering.
- Styled paths are derived from canonical geometry plus a style and style seed.
- Never apply hand-drawn distortion to previously distorted output.
- Preview simplification cannot move semantic boundaries or change classification.
- Renderers do not repair or validate semantic geography; generators and domain
  validators own those rules.

## Rule 11 — Dependencies and optimizations are earned

Geometry libraries are hidden behind project-owned adapters. Evaluate correctness,
determinism, maintenance, bundle cost, and license before adoption, and record the
decision in an ADR.

Do not introduce WebGL, PixiJS, SQLite, Rust/WASM algorithms, a public plugin
system, microservices, or generalized map scales in anticipation of need. First
measure a representative workload or build the second concrete use case; then
extract or optimize the proven seam.

## Where a new thing goes

| Adding | Location | Reason |
|---|---|---|
| Stable IDs, units, transforms, domain records, scene types | `packages/core` | Shared contracts with no higher-layer dependency |
| World or regional generation behavior | `packages/generation` | Pure domain generation |
| Motif family or style definition | `packages/assets` | Procedural visual content independent of rendering backend |
| Canvas, SVG, or PNG interpretation | `packages/render` | Consumes `RenderScene` only |
| Schemas, migrations, or `.mapworld` I/O | `packages/persistence` | Boundary validation and storage |
| Panels, tools, selection, navigation, orchestration | `apps/desktop` | Transient interaction and application composition |
| Fixed seeds, old saves, seam/pole cases, adversarial geometry | `fixtures` | Shared reproducible evidence |
| Durable decision with alternatives | `docs/adr` | Preserves why the choice was made |
