# TTRPG Map Generator — Consolidated Project Plan

**Status:** Recommended implementation plan  
**Initial product:** Offline world-to-region fantasy-map generator and editor  
**Primary runtime:** macOS desktop  
**Development environments:** macOS and Linux  
**Visual direction:** Believable geography rendered as coherent, hand-drawn fantasy cartography

## 1. Executive decision

Build the generation engine, document model, procedural asset system, scene graph, and
exporters in **strict TypeScript**. Build the interface with **Svelte and Vite**, packaged
as a **Tauri 2** macOS desktop application.

Keep the Rust portion of Tauri deliberately small. It should initially provide native
windowing, file dialogs, atomic file operations, and other operating-system integration.
Move an algorithm to Rust or WASM only after profiling identifies a real bottleneck and a
representative benchmark proves that the move is worthwhile.

There is no supported headless CLI in the first release. The generation core must still be
DOM-free so that its tests, benchmarks, and development utilities can run under Node on a
Linux server. This preserves portability without requiring two production applications or
an early TypeScript/Rust domain boundary.

The architectural center is a persistent **world document**, not a canvas image. It owns a
generated world map and its drill-down maps, and stores semantic features, accepted canonical
geometry, user constraints, generation metadata, and stable identities. Disposable render
and preview caches are kept separate.

The central product promise is:

> The user can generate an entire world, drill into a region without losing continuity, and
> regenerate one meaningful part of either map without unexpectedly changing the rest.

## 2. Product goals and scope

### 2.1 World-to-regional MVP

The first complete release generates and edits one whole-world map containing:

- continents, major islands, archipelagos, and other configurable landmass types;
- global oceans, seas, gulfs, straits, and other configurable water-body types;
- broad elevation, mountain systems, climate zones, biome belts, and major drainage cues;
- stable named world features and selectable regional footprints;
- a coherent hand-drawn atlas style and whole-world export.

The user can then select a footprint on that world map and generate a regional map containing:

- land, sea, coastlines, islands, and lakes;
- elevation, mountain ranges, hills, and cliffs;
- temperature, moisture, and believable biome regions;
- rivers and watersheds;
- forests with procedurally generated tree motif families;
- settlements and terrain-aware roads;
- labels, title, compass, border, legend, and scale;
- a coherent hand-drawn style;
- selective regeneration by feature and aspect;
- constrained editing of coastlines and rivers;
- reusable region/path editing foundations for later feature types;
- project save/load without unintended visual or semantic drift;
- SVG and high-resolution PNG export.

The world map defines macro-scale facts and boundary conditions; the regional generator adds
detail rather than inventing a disconnected geography. The MVP needs plausible atlas-scale
geography, not a complete planetary simulation.

### 2.2 Explicitly deferred

The following are not part of the world-to-regional MVP:

- a supported headless production CLI;
- packaged Linux or Windows desktop releases;
- a distinct `ContinentMap` drill-down level; continents remain semantic world-map entities;
- city, town/village, dungeon/cave, building-interior, or battle-map generation;
- political simulation, history, economy, or complete plate tectonics;
- a public plugin protocol or marketplace;
- cloud accounts, collaboration, or runtime-downloaded assets;
- PDF and Foundry VTT export unless they become immediate usage requirements;
- a universal geometry editor supporting every future map scale.

The world and regional models must leave a clean path to these features without implementing
them prematurely.

### 2.3 Priority order

When goals conflict, prefer:

1. Reproducible selective regeneration.
2. Preservation of user edits and accepted results.
3. Attractive, legible maps.
4. Geographic and topological validity.
5. Fast interactive feedback.
6. Total generation speed.

Geographic validity is not optional, but the project is a cartographic tool rather than a
scientific simulator. A bounded artistic adjustment is acceptable when it preserves declared
invariants and produces a better map.

## 3. Technology stack

### 3.1 Application

- **Language:** TypeScript with `strict: true`.
- **Desktop shell:** Tauri 2.
- **UI:** Svelte with Vite as a single-page application.
- **Interactive viewport:** layered Canvas 2D with SVG or HTML overlays for handles,
  selections, and accessibility.
- **Background generation:** Web Workers with cancellation and progress messages.
- **UI state:** small purpose-built Svelte stores.
- **Boundary validation:** Zod schemas at persistence, worker, and Tauri boundaries.

Do not use SvelteKit, a web server, React, a game engine, or a large graphics framework in
the initial implementation. Introduce WebGL/PixiJS only if a measured viewport workload
cannot meet its frame budget with Canvas level-of-detail rendering.

### 3.2 Generation and geometry

Evaluate these libraries in the first technical spike and hide each behind an internal
interface:

| Need                       | Initial candidate       |
| -------------------------- | ----------------------- |
| Delaunay/Voronoi           | `d3-delaunay`           |
| Seeded noise               | `simplex-noise`         |
| Blue-noise placement       | `poisson-disk-sampling` |
| Polygon boolean operations | `polygon-clipping`      |
| Curve operations           | `bezier-js`             |
| Schema validation          | `zod`                   |

Use project-owned modules for coordinate types, seed derivation, basic vector math,
quantization, stable sorting, spatial hashing, and canonical serialization. Do not expose a
third-party geometry type throughout the domain model.

Pin exact dependency versions only after the spike. Record the dependency and license
review in an architecture decision record.

### 3.3 Tooling

- pnpm workspace;
- Vitest for unit, property-style, determinism, and integration tests;
- Playwright for a small number of desktop/webview interaction workflows;
- ESLint and Prettier in CI;
- TypeScript project references and enforced package boundaries;
- benchmark fixtures runnable on both macOS and the Linux development server.

## 4. Architectural model

Keep five kinds of data distinct.

### 4.1 Semantic world

This is what exists in the fictional world at one or more map scales:

- world-scale continents, islands, oceans, seas, elevation, and climate systems;
- regional land/water classification and detailed elevation;
- coastlines and water bodies at the resolution owned by each map;
- drainage basins and river networks;
- climate and biome regions;
- forests and other ecological regions;
- settlements, roads, crossings, and named features.

Each semantic feature has one owning map. A regional coastline may be a refined child of a
world-scale coast, but it is not the same geometry sampled more densely. The parent supplies
constraints and anchors; the child owns its accepted detailed result.

A forest is a semantic region with identity, properties, and canonical geometry. It is not
the collection of tree strokes used to depict it.

### 4.2 Constraints and overrides

This records user intent:

- locked entities or aspects;
- pinned boundary segments and path waypoints;
- inclusion, exclusion, attraction, and keep-out regions;
- moved or deleted instances;
- user-positioned labels;
- parameter overrides and accepted warnings.

Edits are inputs to regeneration. They are never undocumented mutations to a disposable
render result.

### 4.3 Decoration

This records what is drawn where:

- motif/stamp placements;
- selected stamp variants;
- rotations, scales, and deterministic jitter;
- hatch and stipple placements;
- label candidates and resolved label positions.

Decoration is derived from semantic features but has separate seed revisions so appearance
or placement can change without changing the underlying world.

### 4.4 Render scene

The renderer-neutral scene contains paths, polygons, symbols, text, masks, patterns, style
tokens, stable z-order, and links back to source entity IDs. Canvas preview and SVG export
consume the same scene so they do not independently reinterpret the world.

### 4.5 Disposable caches

Preview meshes, low-resolution field tiles, hit-test accelerators, raster tiles, thumbnails,
and export intermediates are safe to delete. Cache keys include every relevant input,
generator version, style version, aspect seed, and resolution.

## 5. Document and identity model

### 5.1 Ownership tree and dependency graph

Use two related structures:

- An **ownership tree** organizes maps and their contained features.
- An **aspect-level dependency DAG** records what regeneration actually affects.

Do not force dependencies into the ownership tree. A river may depend on elevation,
rainfall, a lake, and several user constraints even though it has only one owning map.

Conceptually:

```text
WorldDocument
└─ WorldMap
   ├─ Continent and island entities
   ├─ Ocean and sea entities
   ├─ Global terrain, climate, and biome entities
   ├─ World layout and label entities
   └─ RegionalMap [0..n]
      ├─ Terrain entities
      ├─ Water-body and river entities
      ├─ Biome and forest entities
      ├─ Settlement and road entities
      ├─ Asset-family entities
      └─ Layout and label entities
```

The world-to-region relationship is part of the MVP. Regional maps communicate with the
world map through a versioned inherited-context contract rather than by reaching into world
generator internals.

The dependency DAG crosses ownership boundaries only through declared context provenance. A
parent aspect change invalidates the child's context-status aspect and may mark the child
stale; it does not directly invalidate or replace accepted child geography.

The complete planned ownership hierarchy is:

```text
WorldDocument
└─ WorldMap
   └─ RegionalMap [0..n]
      ├─ SelectedAreaBattleMap [battle map]
      ├─ SettlementMap [city | town | village]
      │  ├─ Building entity → BuildingInteriorMap [battle map]
      │  └─ SelectedAreaBattleMap [battle map]
      └─ UndergroundMap [dungeon | cave]
         └─ UndergroundLevelMap [battle map]
```

The diagram shows the usual ownership path, not a restriction on navigation. A selected-area
battle map may be created directly from a regional crossroad, forest path, landmark, or free
selection, or from any settlement subtype. Each instance has exactly one parent map. A
building interior is created on demand from a selected building. A dungeon or cave may also
be entered from a settlement, building, or another underground level while retaining its
regional georeference.

### 5.2 Stable identity

Every meaningful entity receives a stable opaque ID. Names and array positions are never
identities. Generated subfeatures use IDs derived from stable parent identity and semantic
keys where practical.

Every generated aspect records:

```text
entityId
aspectName
generatorId
generatorVersion
parameterSchemaVersion
parameters
variantRevision
dependencyAspects
generationStatus
diagnostics
```

Common aspects include:

```text
continent.boundary
waterBody.classification
worldClimate.fields
regionalMap.inheritedContext
forest.boundary
forest.species
forest.motifShapes
forest.motifPlacement
forest.hatching
river.course
river.appearance
label.content
label.placement
```

### 5.3 Seed derivation

Never use one sequential random stream for the entire map. Every generated aspect declares
one of these seed scopes:

- **Map/entity scope:** independent accepted features and decoration owned by one map.
- **Root-coordinate scope:** physical refinement that must agree between adjacent surface
  children.
- **Shared-boundary scope:** continuations shared by linked child maps or split battle maps.

Map/entity-scoped seeds derive from:

```text
worldSeed
mapId
entityId
generatorId
generatorVersion
aspectName
variantRevision
```

Root-coordinate refinement seeds replace `mapId` and `entityId` with a persisted
`rootSurfaceNamespaceId` and a quantized planet-native tile or coordinate key. This prevents
two adjacent regional maps from deriving different elevation, coastline, or drainage detail
at the same physical location merely because they have different map IDs. Shared-boundary
seeds use the stable boundary or portal ID shared by both children.

Changing `forest.motifShapes` increments only that aspect's revision. Placement, boundary,
other forests, and unrelated geography retain their seeds and outputs. Seed scope and inputs
are versioned generation metadata; changing scope is an output-changing migration, not an
implementation detail.

Use a small, documented, versioned seed-derivation implementation. Ban `Math.random()` in
generation packages through ESLint.

## 6. Persistence

### 6.1 Saved-project shape

Use a readable directory package during development:

```text
MyWorld.mapworld/
  manifest.json
  world.json
  maps/
    <world-map-id>.json
    <regional-map-id>.json
    <settlement-map-id>.json
    <building-interior-map-id>.json
  data/                  authoritative large arrays or geometry chunks when needed
  assets/                user-imported resources, if supported later
  cache/                 safe to delete
  previews/              safe to rebuild
```

`manifest.json` records the package and schema versions, application compatibility,
authoritative-file checksums, and recovery metadata. `world.json` is the small world-level
index: world identity, root world-map ID, map ownership relationships, and shared world
settings. Each file in `maps/` is the authoritative document for one map and its entities.

Introduce the `maps/` collection in the first persistence implementation. The initial root is
one `WorldMap`; each generated `RegionalMap` is stored as its child. A world document is the
unit of saving and loading; world, regional, settlement, selected-area, underground, and
building-interior maps are not unrelated project files. Keeping them in one package preserves
references and lets the user reopen one world before generating or editing a map at another
scale.

Start with canonical JSON. Move large numeric fields or geometry to versioned binary chunks
only after representative projects demonstrate that JSON is a real size or performance
problem. Do not introduce SQLite before spatial scale, query patterns, and recovery needs
justify it.

### 6.2 World, map, and parent-context records

Every map document has a stable map ID, map kind and scale class, physical coordinate system,
extent, entities, generated-aspect records, constraints, accepted decoration, and layout
state. `WorldMap` is the single root map kind. A child map additionally stores a parent link
containing:

- parent map ID and relationship kind;
- root map ID plus zero or more upstream source-map/entity lineage records and the aspect
  versions used to create the child;
- the child's footprint, vertical extent where relevant, and invertible parent transform;
- inherited boundary portals such as roads, rivers, doors, walls, stairs, and cave entrances;
- a versioned snapshot and checksum of the clipped parent context used for generation.

For example, a regional map references its selected footprint and source features on the
world map; a settlement map references its regional settlement entity; and a
building-interior map references the stable building entity in that settlement map. Renaming
an entity does not break the relationship, and any child can be generated during a later
session from its persisted parent context.

A feature-anchored battle map records that feature in its source lineage. A free-area battle
map may have no source entity; its persisted footprint, transform, and clipped parent-context
snapshot are sufficient identity and provenance.

The inherited-context snapshot is intentionally persisted even though some information also
exists in the parent. It records exactly what the child was based on and prevents a later
parent edit from silently redesigning an accepted child. When current parent context differs,
classify the change as non-conflicting, reconcilable, or conflicting and offer a previewed
choice to keep the child, reconcile compatible changes, or regenerate affected aspects.

Keep the surface-map parent contract scale-generic even though the MVP implements only
`WorldMap -> RegionalMap`. The regional generator consumes a versioned surface context, not a
concrete world-generator data structure. A future `ContinentMap` could therefore consume
world context and produce regional context without invalidating existing regions that remain
direct children of a world map.

Transforms compose through the ownership chain back to the root world map, and validation
checks the composed round trip. Staleness also propagates through the chain as metadata: a
world change can mark a future continent and its regional descendants stale, but reconciliation
occurs top-down and no descendant is regenerated automatically.

### 6.3 What is authoritative

Persist:

- world, map, and entity IDs;
- accepted semantic geometry and properties;
- constraints, overrides, locks, and regeneration revisions;
- generator, schema, style, and seed-algorithm versions;
- accepted decoration placements, selected variants, and user-positioned labels;
- parent links, source lineage, transforms, portals, source versions, seed scopes, and
  inherited-context snapshots;
- enough accepted generated state to reopen an old map without silently redesigning it;
- references and checksums for authoritative data chunks.

Do not persist as authoritative:

- screen-space geometry;
- viewport caches;
- derived hit-test indexes;
- thumbnails;
- raster export intermediates.

This deliberately rejects the idea that a project file should contain only seeds and edits.
Recomputation is useful for regeneration, but it is not a safe substitute for preserving
accepted work across algorithm and dependency upgrades.

### 6.4 Save and load lifecycle

Saving operates on an immutable snapshot of the world document:

1. Validate all changed world, map, entity, geometry, and reference records.
2. Serialize canonical JSON with stable key and collection ordering.
3. Write a complete temporary sibling package and calculate authoritative checksums.
4. Flush and verify the temporary package before committing it in place of the old package.
5. Retain enough backup or commit-marker information to recover if the replacement is
   interrupted.

Loading validates the manifest, checksums, references, and schemas before exposing the
document. It restores accepted state exactly and does not invoke generators merely because
the application or a generator is newer. Disposable render scenes, previews, and indexes are
then rebuilt from the accepted semantic and decoration state. Generator updates are reported
as optional upgrades rather than applied during load.

### 6.5 Migration, autosave, and recovery

- Version every schema and generator behavior that can affect output.
- Keep migration fixtures for every released project version.
- Never redraw an opened project merely because a generator was upgraded.
- Offer `keep existing`, `upgrade selected`, and eventually `upgrade all` when behavior
  versions change.
- Autosave user-authored constraints promptly; caches may be rebuilt after a crash.
- Implement bounded command-based undo/redo before broad editing is added.

## 7. Generator contracts and invalidation

Every generator follows one conceptual contract:

```ts
interface Generator<P, O> {
  readonly manifest: GeneratorManifest;
  plan(context: ReadContext, target: GenerationTarget): GenerationPlan;
  generate(context: GenerationContext, plan: GenerationPlan, params: P): O;
  validate(output: O, context: ValidationContext): Diagnostic[];
}
```

The real API may evolve during the first milestones. Preserve these rules:

- Generators are pure where practical.
- They receive explicit random streams and immutable inputs.
- They return proposed output plus diagnostics; they do not save files or mutate UI state.
- They declare input and output aspects, seed scope, generator versions, dirty bounds, and
  validation rules.
- The engine validates a proposed patch before committing it to the document.
- Inputs and outputs use stable ordering and declared units.

### 7.1 Regeneration modes

Expose these user-facing operations:

- **Appearance:** change motifs, strokes, hatching, or label styling only.
- **Placement:** change decoration positions while retaining semantic regions and motifs.
- **Feature:** regenerate the selected semantic feature within its current constraints.
- **Feature and dependents:** regenerate the feature and affected downstream aspects.
- **Region:** later, regenerate unlocked features intersecting a selected area.

Before a broad operation, show what will remain fixed and what will change.

### 7.2 Invalidation strategy

Begin with correct aspect-level invalidation across the whole world document, including
cross-map context-staleness edges. Add geographic dirty bounds and tile-local recomputation
when editing workloads make them necessary. Correct isolation is required from the start;
optimal locality is not.

Locks apply to an entity or aspect. A locked accepted output remains materialized. If an
upstream change makes it inconsistent, retain it and show a specific warning rather than
silently replacing it.

## 8. World and regional generation pipelines

World and regional maps use separate generators and resolutions. The world pipeline creates
macro-scale facts; it must not attempt to produce regional geometry everywhere and then hide
most of it. A regional map is generated on demand from a persisted parent-context snapshot.

### 8.1 Whole-world pipeline

Use an acyclic staged pipeline:

```text
planet shape + world constraints
  -> macro elevation, uplift, and ridge fields
  -> continents, islands, and global coastline
  -> connected ocean basins and named water bodies
  -> broad temperature, winds, and moisture
  -> climate zones and biome belts
  -> major watersheds, rivers, lakes, and terrain systems
  -> world feature names, labels, and atlas layout
  -> decoration
  -> render scene
```

Landmass classification should distinguish at least continents, major islands, island chains,
and archipelagos. Water-body classification should distinguish the global ocean or connected
ocean basins, marginal and inland seas, gulfs or bays, straits, and major lakes. These are
semantic types with properties and stable IDs, not labels inferred only at render time.

User controls should describe atlas-scale outcomes—world dimensions, water coverage,
continent count and size distribution, fragmentation, island and archipelago frequency,
ocean connectivity, polar character, mountaininess, and broad climate character—rather than
exposing raw noise parameters. Plausibility comes from coherent fields and declared
invariants; complete plate-tectonic and atmospheric simulation remains deferred.

### 8.2 World-to-region context contract

A regional map begins with a selectable world-space footprint. Its parent-context snapshot
contains:

- the footprint in planet-native coordinates and its chosen local projection;
- coastline anchors and land/water classification at and around the boundary;
- elevation envelope, major ridges, and watershed divides;
- temperature, moisture, prevailing-wind, climate-zone, and biome constraints;
- parent continent, island, ocean, sea, and other named-feature IDs;
- major river, lake, route, and coastline continuations that cross the footprint boundary;
- a padded boundary collar and root-coordinate refinement namespace so neighboring regions
  sample compatible physical detail;
- source aspect versions and a checksum for reconciliation after parent edits.

The regional generator may add coves, tributaries, hills, forests, settlements, roads, and
other detail below world-map resolution. It must preserve inherited classification, named
anchors, and boundary continuations within declared tolerances. If a requested refinement
cannot honor them, generation returns a diagnostic instead of silently disconnecting the
maps.

The MVP permits multiple disjoint or edge-adjacent regional children but does not permit
overlapping regional footprints. The selector reports an overlap before generation. Adjacent
children reuse the same root-coordinate refinement namespace and boundary collar so their
physical fields and crossing features agree at the shared edge. Supporting overlapping
same-scale regions later requires a shared authoritative refinement layer or an explicit
merge/reuse workflow; it must not be approximated with independent map-scoped seeds.

### 8.3 Regional pipeline

```text
inherited world context + regional constraints
  -> detailed elevation and landmass refinement
  -> land/water mask and coastline
  -> preliminary temperature and moisture
  -> hydrology and drainage
  -> refined surface wetness
  -> biome classification
  -> forest and terrain-feature regions
  -> settlements
  -> road network
  -> labels and layout
  -> decoration
  -> render scene
```

Broad moisture drives rainfall and rivers, while drainage contributes a later local-wetness
refinement used by biomes. Inherited world fields provide boundary conditions, not final
regional answers.

### 8.4 Coordinates, projections, and fields

- Represent the `WorldMap` in planet-native coordinates with explicit horizontal wrap and
  pole behavior; do not make a display projection authoritative.
- Give each `RegionalMap` a local planar coordinate system measured in explicit physical
  units such as kilometers, plus an invertible mapping to its world footprint.
- Keep planet-native, regional, screen, render, and print coordinates distinct in the type
  system.
- Record the display projection used by the world atlas and the local projection used by
  each child region.
- Quantize persisted geometry to a declared precision appropriate to its coordinate space.
- Store continuous phenomena as tiled or multiresolution numeric fields when appropriate.
- Store meaningful features such as coastlines, rivers, forests, and roads as vector
  entities owned by their map.
- Render independently of screen resolution until rasterization.

The exact planet representation and initial atlas projection are early-spike decisions, but
world features must remain continuous across a horizontal map seam and regional footprints
must not depend on a particular visual projection.

### 8.5 Terrain and coastlines

At world scale, use layered seeded fields and broad uplift/ridge controls to form macro
elevation, continents, islands, and ocean basins. At regional scale, refine the inherited
fields with higher-frequency detail and local constraints. Extract land/water contours,
repair invalid topology, simplify them by scale, and produce separate canonical and styled
paths. Do not let smoothing introduce self-intersections, collapse narrow channels, or break
an inherited boundary crossing.

### 8.6 Hydrology and climate

- At world scale, produce coherent broad climate fields, watershed divides, and only the
  major hydrologic features that are legible and useful for drill-down.
- At regional scale, condition accidental sinks while preserving intentional basins.
- Compute flow direction and accumulation.
- Select channel heads using accumulation, rainfall, slope, density controls, and inherited
  major-river anchors.
- Trace tributaries into lakes or the sea as a directed drainage graph.
- Derive river width from discharge.
- Validate endpoints, crossings, joins, downstream width behavior, and inherited boundary
  portals.
- Compute temperature from latitude or world climate context, elevation, and maritime
  influence.
- Compute broad moisture from water, winds, and orographic effects; refine biome wetness
  after drainage exists.

### 8.7 Biomes, forests, and vegetation

Biome definitions are versioned data. Forests are semantic polygons derived from biome,
moisture, elevation, slope, and constraints.

For each forest:

1. Generate or accept its canonical region.
2. Produce a density field with edge falloff and clearings.
3. Select compatible motif families.
4. Place anchors using variable-radius blue-noise sampling.
5. Generate several seeded vector variants.
6. Resolve deterministic overlap and level of detail.

Forest boundary, motif shapes, placement, and hatching remain independently regenerable.

### 8.8 Mountains, settlements, roads, and labels

- Derive mountain ridges from elevation and place oriented peak motifs by prominence.
- Score settlement sites using water, crossings, terrain, agriculture, resources, flood
  risk, defensibility, and spacing.
- Connect important settlements through a sparse graph and route roads over a terrain cost
  field.
- Represent bridges, fords, passes, and future child-map entrances explicitly.
- Classify settlements by scale and role so later drill-down can choose a city generator or
  a town/village generator rather than treating every settlement as a differently sized city.
- Place labels from stable candidates with collision penalties and deterministic priority.
- Preserve semantic anchors when labels are manually moved.

World labels and regional labels are resolved independently. A stable world feature may have
different label content or placement at regional scale while retaining the same source ID.

## 9. Procedural art and rendering

### 9.1 Asset families

An asset-family generator produces vector scene fragments with:

- a stable family identity and seed revision;
- several variants;
- semantic compatibility tags;
- anchor points and bounds;
- collision/masking shapes;
- level-of-detail variants;
- style tokens rather than hard-coded colors;
- generator and schema versions.

An evergreen family might generate eight variations from trunk, branch-tier, silhouette,
and hatch rules. Placement independently chooses variants and applies bounded seeded scale,
rotation, and positional jitter.

### 9.2 Hand-drawn style

Create controlled imperfection from canonical geometry:

- band-limited seeded path wobble;
- mild pressure/width variation;
- double-pass ink strokes where appropriate;
- seeded asymmetry in motifs;
- clipped hatching and stippling;
- coastal echo lines and water marks;
- restrained paper grain and a procedural border/compass.

Never distort an already distorted path. Styled output is always regenerated from canonical
geometry plus a stable style seed, preventing accumulated degradation after edits.

Start with one excellent monochrome or limited-color ink style. A second clean-print style
is useful before public style extensibility because it tests whether content and appearance
are truly separated.

### 9.3 Preview and export

- Canvas is the interactive preview backend.
- SVG is the first authoritative export format and uses stable element IDs and ordering.
- Repeated motifs use SVG definitions and references to control file size.
- PNG export rasterizes the same render scene, tiled for very large output.
- Preview may reduce detail, but it may not reinterpret semantic content.
- Add a native `resvg` path later only if WebView raster consistency or memory use becomes
  a demonstrated problem.

## 10. Editing model

Begin with three concrete tools rather than designing the universal editor in isolation:

1. A **world-to-region footprint selector** that previews inherited context.
2. A **closed-region coastline editor** usable at world and regional scales.
3. An **open-path river editor** for detailed regional hydrology.

Both use simplified control geometry and persistent constraints. From their shared behavior,
extract reusable primitives for closed regions, open paths, points/portals, painted
constraints, and eventually shared borders.

Offer three edit intents:

- **Cosmetic:** changes only the displayed path.
- **Constrained semantic:** requests a geographic change while preserving relevant rules.
- **Authoritative:** pins the requested geometry as world truth and reports conflicts in
  dependents.

A coastline semantic edit adjusts the owning map's land/water constraint and re-extracts the
coast. An accepted world-scale edit marks affected regional children as potentially stale but
does not silently rewrite them. A river semantic edit supplies a waypoint or corridor and
solves a valid downstream route, optionally proposing local terrain adjustment. Both
operations show affected dependents before commit and support undo/redo.

Do not promise shared-border topology, forest painting, territory editing, or arbitrary
plugin-defined geometry until the coastline and river tools work well.

## 11. Workspace structure

Start with a small workspace and split only when boundaries become real:

```text
apps/
  desktop/              Svelte UI and Tauri shell
packages/
  core/                 IDs, units, RNG, document types, constraints, scene types
  generation/           generator contracts plus world and regional generators
  assets/               procedural motif families and styles
  render/               Canvas preview and SVG/PNG export
  persistence/          schemas, migrations, project package I/O
fixtures/               fixed seeds, saved projects, adversarial geometry
docs/
  adr/                  architecture decisions
```

Dependency direction:

- `core` imports no other internal package.
- `generation` and `assets` depend on `core`, never UI or persistence.
- `render` consumes the scene model, not generator internals.
- `persistence` serializes domain records but does not own domain behavior.
- `desktop` orchestrates packages and owns only transient interaction/UI state.

Enforce these boundaries through lint rules and TypeScript project references.

## 12. Development roadmap

Every milestone ends in a visible, demonstrable improvement. Internal architecture is built
only far enough to support the next product proof.

### Milestone 0 — App and rendering proof

- Create the pnpm workspace, Svelte/Vite application, and Tauri shell.
- Render a small hard-coded scene in Canvas and export the same scene to SVG.
- Add pan, zoom, and a minimal inspector panel.
- Run core/render tests under Node on macOS and Linux.
- Record decisions for scene primitives, coordinate transforms, and worker messaging.

**Visible exit:** the desktop app displays and exports the same simple inked scene.

### Milestone 1 — Deterministic kernel

- Implement typed IDs, planet-native and local physical units, coordinate transforms, seed
  scopes and derivation, aspect revisions, stable serialization, and generator contracts.
- Add `WorldMap` and `RegionalMap` records, the ownership tree, and the aspect dependency
  graph.
- Add fixed-seed isolation tests and the `Math.random()` lint ban.
- Create and atomically reopen a minimal `.mapworld` project.

**Visible exit:** a seed produces a small repeatable composition; rerolling one test aspect
leaves every unrelated aspect byte-for-byte unchanged after save/reopen.

### Milestone 2 — Whole-world atlas postcard

- Generate macro elevation, continents, major islands and archipelagos, connected oceans,
  seas, and a seam-safe global coastline.
- Classify landmasses and water bodies as stable semantic entities.
- Render one attractive whole-world ink atlas with coastal echo lines and paper treatment.
- Add meaningful atlas-scale controls and fast coarse previews.
- Persist accepted canonical geometry and generator versions.
- Export deterministic SVG and high-resolution PNG.

**Visible exit:** the application creates, saves, reopens, rerolls, and exports an attractive
whole-world atlas with recognizable continents and oceans. The exact composition, controls,
isolation, budgets, evidence, and workflow are fixed by the
[Milestone 2 atlas-proof contract](milestone-2-atlas-proof.md).

### Milestone 3 — Coherent world and regional handoff

- Add broad mountain systems, temperature, winds, moisture, climate zones, biome belts,
  major watersheds, and globally significant rivers and lakes.
- Add world feature naming and deterministic atlas label placement.
- Add the world-to-region footprint selector and inherited-context preview.
- Persist the footprint, projection, clipped context and boundary collar, root-refinement
  namespace, source lineage and aspect versions, and checksum.
- Add seam, projection, parent-anchor, and boundary-continuation fixtures.

**Visible exit:** a user selects a world footprint and sees the exact terrain, coast, climate,
biome, and major-feature constraints that will govern its regional child.

### Milestone 4 — Regional terrain postcard

- Generate detailed regional elevation, land/water classification, coastline, and islands
  from the inherited world context.
- Refine parent geometry without breaking its classifications, anchors, or boundary
  continuations.
- Add regional pan, zoom, navigation back to the parent, meaningful terrain controls, and
  fast coarse previews.
- Reject overlapping regional footprints in the MVP and prove that an adjacent pair samples
  matching physical fields and crossing features along its shared boundary.
- Persist and reopen both maps with their parent link intact.

**Visible exit:** the application drills from the atlas into an attractive regional landmass
whose coastline, relief, climate, and named anchors visibly agree with the selected world
footprint.

### Milestone 5 — Signature procedural assets

- Add evergreen and deciduous asset-family generators with several vector variants.
- Add a temporary forest-region input, density field, and blue-noise placement.
- Separate family appearance, placement, and region seed revisions.
- Add selection and explicit `reroll appearance` / `reroll placement` controls.
- Add zoom-based level of detail.

**Visible exit:** rerolling evergreen shapes updates all evergreen marks while leaving their
positions, deciduous marks, and coastline unchanged.

### Milestone 6 — Believable physical region

- Add mountain ridges and motifs.
- Add preliminary climate, hydrology, lakes, revised wetness, and biome classification.
- Honor inherited world ridges, climate ranges, watershed divides, and major-water portals.
- Derive real forest regions from the resulting ecology.
- Add invariant diagnostics for coastlines, rivers, water bodies, biomes, and placement.
- Move costly preview generation into cancellable workers.

**Visible exit:** a complete terrain-and-ecology map has rivers that relate visibly and
explainably to relief and climate.

### Milestone 7 — Lived-in complete regional map

- Generate settlements, roads, bridges/fords, names, and label candidates.
- Add terrain-aware road routing and deterministic label collision handling.
- Add title, compass, border, legend, and scale.
- Add pinning for settlements and labels.

**Visible exit:** one click produces a legible, attractive regional fantasy map suitable for
use at the table.

### Milestone 8 — Selective editing

- Implement world and regional coastline cosmetic, constrained-semantic, and authoritative
  edits.
- Implement river waypoints/corridors with validity checks.
- Add child-impact preview for world edits plus transactional commit, locks, diagnostics,
  undo, and redo.
- Extract shared closed-region and open-path editing components only after both tools work.

**Visible exit:** a user can alter a coastline or regional river, understand the consequences
across map scales, undo the changes, and regenerate unrelated art without losing either edit.

### Milestone 9 — World-to-regional MVP hardening

- Complete save migration and recovery fixtures.
- Test large SVG/PNG exports and memory limits.
- Add accessibility and keyboard-pass review for the main workflow.
- Add golden semantic, SVG, and visual fixtures.
- Package and test the macOS application.
- Write the user guide, contributor setup, architecture overview, and initial ADRs.

**Visible exit:** the world-to-regional MVP meets every acceptance criterion in Section 15.

### Post-MVP — Expand only from demonstrated need

- General region/path editing for forests and biomes.
- PDF and versioned Foundry export.
- Generalized reconciliation tools for parent changes beyond the world-to-region cases proven
  in the MVP.
- Add the shared battle-map document, sizing, grid, encounter-scale asset, rendering, and
  export contracts.
- Size-controlled area selection directly from a regional map and generation of a grid-based
  battle map for a crossroad, path, landmark, or free area.
- Optional continent-scale maps between world and region, only if real use demonstrates that
  the direct world-to-region handoff lacks useful context or control.
- Settlement drill-down with separate city and town/village generation pipelines.
- Extend size-controlled selected-area battle maps to settlement parents.
- Surface-aware dungeon and cave generation, including grid-based underground levels.
- On-demand generation of a selected building's grid-based interior from its exact footprint,
  dimensions, orientation, entrances, and known external constraints.
- Linux/Windows packaging.
- Public style packs and out-of-process plugins.
- Optional Rust/WASM acceleration for measured hot paths.

## 13. Testing strategy

### 13.1 Determinism and isolation

- Hash canonical semantic output for a matrix of fixed seeds.
- For fixed world seeds and footprints, hash both the world output and inherited regional
  context.
- Verify that map/entity-scoped rerolls remain isolated while root-coordinate and
  shared-boundary scopes agree wherever two child maps represent the same physical boundary.
- Hash canonical SVG with normalized ordering and metadata.
- Verify that regenerating entity/aspect A cannot change unrelated B.
- Run core fixtures under Node on macOS and Linux.
- Test workers with different scheduling without permitting output-order changes.

### 13.2 Geometry properties

- Coast rings are closed, consistently wound, and non-self-intersecting.
- World coastlines and fields remain continuous across the horizontal seam.
- Continents, islands, archipelagos, oceans, seas, and other classified bodies satisfy their
  declared connectivity and containment rules.
- Land and water do not overlap improperly.
- Rivers join rather than cross and end at a valid sink.
- River width does not decrease downstream without a modeled reason.
- Forest motifs remain inside their permitted regions.
- Roads cross otherwise impassable features only through explicit crossings.
- Regional outputs preserve inherited parent classifications, anchors, and boundary
  continuations within declared tolerances.
- Overlapping regional footprints are rejected in the MVP; adjacent regions agree on sampled
  physical fields and crossing features along their shared edge.
- Selected-area battle maps preserve their source anchor when present and all declared edge
  continuations; selections above the configured hard size limit are rejected before
  generation.
- World-to-region transforms round-trip within their declared error bounds, including
  footprints near seams and poles.
- Quantization and serialization preserve declared tolerances.

### 13.3 Persistence and recovery

- Save/load round trips preserve accepted semantic and visual state.
- World-to-region parent links, source lineage, context snapshots, projections, seed scopes,
  source versions, and checksums survive save/load round trips.
- Locked aspects survive upstream changes and reopening.
- Every released schema has a migration fixture.
- Interrupted atomic saves retain the previous valid project.
- Deleted caches rebuild without changing authoritative state.

### 13.4 Visual regression

Maintain a small reviewed gallery of standard seeds and paired world/region drill-downs.
Compare rendered PNGs with an explicit tolerance, while keeping semantic and SVG hashes
separate so a deliberate style change is not mistaken for a geography regression.

Every generator is complete only when it has a manifest, versions, seed namespaces,
dependency declarations, validation, fixed-seed tests, and at least one visual example when
it affects rendering.

## 14. Codebase rules

1. No `Math.random()` in generation, assets, or rendering.
2. No clocks, globals, locale-sensitive ordering, or ambient state in generator output.
3. Sort every order-sensitive collection by stable keys.
4. Keep semantic geometry separate from styled geometry.
5. Use explicit coordinate-space and unit types.
6. Use stable entity IDs; never use display names or array positions as references.
7. Version output-changing generator behavior.
8. Validate persistence, worker, Tauri, and future plugin boundaries.
9. Preserve accepted user work; regeneration cannot override locks silently.
10. Keep generators independent of Canvas, SVG DOM APIs, Svelte, and filesystem access.
11. Keep the map document separate from transient UI state.
12. Quantize persisted geometry and canonicalize serialized ordering.
13. Every bug fix includes a regression test.
14. Every meaningful architecture choice gets a short ADR.
15. Add packages, databases, rendering frameworks, or native code only in response to a
    measured or demonstrated need.

## 15. World-to-regional MVP acceptance criteria

The MVP is complete when:

- A fixed seed and version produce the same canonical `WorldMap` in repeated runs.
- The world map contains stable, selectable continent/island and ocean/sea entities with
  valid declared classifications and connectivity.
- World geometry and fields remain continuous across the atlas seam.
- A user can select a world footprint, preview its inherited context, and generate a linked
  `RegionalMap`.
- A fixed world seed, source versions, footprint, and regional seed produce the same regional
  child in repeated runs.
- The regional child preserves inherited land/water classification, major named anchors,
  climate and biome constraints, and boundary continuations within declared tolerances.
- The MVP rejects overlapping regional footprints and adjacent regional children agree on
  physical fields and crossing features along their shared boundary.
- World and regional maps export from the same renderer-neutral scene model at their declared
  scales.
- A saved project reopens without automatic regeneration or drift.
- A generator upgrade does not silently alter an accepted existing project.
- Rerolling one forest's motif shapes changes neither its placement nor another forest.
- Rerolling placement does not alter the forest boundary or motif family.
- A user can edit a world or regional coastline and a regional river, preview same-map and
  child-map dependents, commit, undo, and redo.
- An accepted world edit never silently rewrites an existing regional child; the project
  reports and previews stale or conflicting inherited context.
- Locked aspects are retained and inconsistent locks produce actionable warnings.
- Every river passes declared hydrology validation or carries a specific warning.
- Preview work is cancellable and remains interactive through coarse level of detail.
- SVG and PNG exports agree with the same render scene at the declared scale.
- Very large PNG output is bounded or tiled rather than exhausting memory unexpectedly.
- Core tests and deterministic fixtures run successfully on macOS and the Linux development
  server.
- The application is packaged and usable as a macOS desktop application.
- A new built-in motif family can be added without modifying persistence, the UI's core
  workflow, and every renderer.

## 16. Principal risks and controls

| Risk                                                        | Control                                                                                                                                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Infrastructure delays visible progress                      | End every milestone in an on-screen product proof; deliver coast and stamps before full simulation                                                                        |
| TypeScript generation becomes slow                          | Workers, coarse previews, tiled fields, spatial indexing, profiling, then isolated Rust/WASM only if justified                                                            |
| Old maps change after upgrades                              | Persist accepted canonical state; version generators and seeds; never auto-upgrade                                                                                        |
| Small rerolls affect unrelated content                      | Aspect-scoped seeds, stable IDs, dependency isolation tests                                                                                                               |
| Noisy geometry becomes invalid                              | Quantization, validation/repair, adversarial fixtures, canonical geometry distinct from styling                                                                           |
| General editing becomes a project of its own                | Build coastline and river tools first; generalize only from working examples                                                                                              |
| SVG becomes huge                                            | Symbol reuse, stable definitions, level of detail, path batching, bounded texture detail                                                                                  |
| Canvas and SVG diverge                                      | Both consume the same scene; visual fixtures compare representative outputs                                                                                               |
| Browser/WebView differences affect PNG                      | Treat SVG and canonical semantic state as authoritative; add native rasterization only if observed                                                                        |
| Whole-world scope becomes a planetary simulator             | Generate only atlas-scale fields and features needed for a coherent world and regional boundary conditions; keep full plate tectonics, history, and economy deferred      |
| World, regional, or adjacent regional maps visibly disagree | Persist inherited context; use root-coordinate refinement seeds and boundary collars; validate classifications, anchors, transforms, and portals; require paired fixtures |
| Projection seams or poles corrupt geometry                  | Keep planet-native coordinates authoritative; test seam/pole fixtures; isolate projections behind typed transforms                                                        |
| A selected battle-map area is too large to use or export    | Choose dimensions before placement; show physical and cell size; apply warnings and hard budgets; support linked splits and tiled export                                  |

## 17. Decisions deliberately left to early spikes

These should be settled with representative code or assets, not abstract debate:

- exact planet-native and regional-coordinate quantization precision;
- the planet-native topology, wrap/pole behavior, and initial world-atlas projection;
- the supported shapes and limits of regional footprints, especially near seams and poles;
- grid, Voronoi, or hybrid representation for specific terrain tasks;
- whether large authoritative numeric fields need binary chunks;
- the scene-message format sent to workers;
- the threshold for adding an R-tree or WebGL viewport;
- the hand-lettering font and license;
- the maximum supported initial map complexity and export dimensions;
- recommended battle-map size profiles and hard cell/pixel budgets based on measured desktop
  and target-VTT performance;
- whether PNG rasterization in the WebView is sufficiently consistent for actual use.

## 18. Future scale extensions

World-to-region drill-down is part of the MVP. Settlement, building-interior, dungeon/cave,
and battle-map work begins only after that foundation is proven. Preserve the remaining path
by giving each future child map:

- a stable map ID and scale class;
- a footprint, vertical extent where relevant, and invertible parent transform;
- versioned inherited context;
- boundary portals for rivers, roads, walls, and other continuations;
- source entity IDs and versions;
- explicit non-conflicting, reconcilable, and conflicting update states.

All drill-down maps receive clipped source geometry in physical units through a typed context
contract. They do not reach into a parent generator's internal data. Parent changes are
previewed before propagation, and child edits do not rewrite a parent without an explicit
promotion operation.

Do not add a continent scale preemptively. Preserve it as an optional future map kind by
keeping surface parent-context production and consumption generic. Adding the node itself is
then structurally small; the substantial work would be designing a useful continent-scale
generator, editor, render style, validation rules, and world/continent/region reconciliation.
Existing direct `WorldMap -> RegionalMap` relationships remain valid if that scale is added.

The first recommended battle-map extension is selected-area generation directly from a
regional map; it does not depend on settlement generation. Settlement, dungeon, and building
pipelines can then reuse the proven battle-map document, sizing, grid, rendering, and boundary
contracts.

### 18.1 Settlement drill-down

Regional settlements have an explicit `city`, `town`, or `village` classification plus
population/extent bands and semantic roles. Drill-down selects a generator family from that
classification; it must not produce small settlements by merely shrinking or thinning a city.

A city map emphasizes districts, major streets, walls and gates where present, civic and
commercial centers, density gradients, blocks, parcels, and dense building fabric. A town or
village map instead emphasizes a simpler road hierarchy, greens or market spaces, irregular
lots, farms, outbuildings, dispersed structures, and a stronger transition into surrounding
land. Town and village may share a pipeline with different parameters, but remain distinct
semantic values so their rules can diverge later.

Both settlement families inherit clipped elevation, slope, cliffs, coast and water geometry,
biome/vegetation, regional roads and crossings, settlement anchors, and physical scale. Their
roads and waterways meet inherited boundary portals exactly.

### 18.2 Surface-aware dungeons and caves

An underground map has a georeferenced horizontal footprint plus one or more depth intervals
or levels. Its context contract includes the relevant surface elevation, slope and cliff
faces, land/water boundaries, river and lake geometry, approximate geology or material,
structures above it, and known entrances. This allows generation and validation to reason
about the full local volume rather than treating the underground map as an isolated rectangle.

Dungeon and cave generation must explicitly handle intersections with surface features:

- a passage reaching a cliff face can create, preserve, or forbid an exterior opening;
- intersection with a sea, lake, river, or groundwater constraint can produce a sealed wall,
  wet area, controlled inflow, flooded section, or validation conflict according to user
  settings;
- shafts, stairs, entrances, and transitions align across surface and underground maps;
- rooms and passages remain within permitted depth and cover constraints unless the user
  accepts a surfaced or structurally exceptional feature.

Generated underground levels are battle maps. Walkable areas, walls, doors, hazards,
elevation changes, water, obstacles, and portals are semantic entities rather than marks baked
into the image.

### 18.3 On-demand building interiors

Interior generation is an explicit user action on a selected building; it is not required as
part of settlement generation. The child map receives the building's exact footprint,
dimensions, orientation, exterior wall geometry, known entrances/windows, shared-wall or
adjacency constraints, and any declared floor count or use. Room subdivision, corridors,
stairs, doors, and furnishings must fit that envelope and keep required entrances reachable.

Each generated floor is a battle map. Irregular, narrow, curved, and multi-part footprints
must either produce a valid constrained layout or return an actionable diagnostic rather than
silently substituting a rectangular building.

### 18.4 Selected-area battle maps

A selected-area battle map may be created directly from a regional map or from a city, town,
or village. The user can select a semantic anchor such as a crossroad, forest path, bridge,
ruin, cave mouth, or other landmark, or place a free-area selection. An anchored selection
retains the source entity ID and initially centers and orients itself from that feature, while
remaining repositionable before generation.

Selection is dimension-first rather than an unconstrained freehand square. The user chooses a
recommended size profile or custom grid width and height, grid-cell size, and orientation,
then positions the resulting rectangle on the parent map. The preview always shows physical
dimensions, total cell count, expected export dimensions, and whether the selection exceeds
the recommended interactive or export budget. Custom sizes have a configurable hard safety
limit; an oversized area should be split into adjacent linked battle maps or exported as
tiles instead of being accepted as one impractical map.

A regional selection inherits clipped roads and paths, crossings, terrain and slope, water,
forest or other vegetation, land cover, landmark geometry, nearby structures, and every
relevant boundary continuation. A settlement selection additionally inherits streets,
building footprints, walls, and other urban features. The battle-map generator expands these
semantic inputs—not styled regional strokes or decorative symbols—into encounter-scale
geometry and detail while preserving the selected anchor when present and every continuation
at the boundary. The user may reroll added local detail without moving inherited features.

This is procedural refinement, not enlargement of the regional render. Battle maps require
their own encounter-scale terrain, vegetation, prop, obstacle, and structure generators plus
an encounter-scale style and level-of-detail policy. Those generators consume the inherited
semantic context and are independently seeded and versioned.

### 18.5 Shared battle-map and grid contract

Dungeon levels, cave levels, building floors, and selected regional or settlement areas use
the same battle-map contract:

- canonical geometry remains in physical world units;
- a configurable square-cell grid is present, with a five-foot cell as the default rather
  than a hard-coded assumption;
- map width and height are stored in grid cells and physical units, and need not be equal;
- recommended size profiles, custom-size warnings, and hard cell/pixel limits are versioned
  application policy rather than generator assumptions;
- grid origin and orientation are stable and stored with the map;
- grid rendering can be styled independently of encounter geometry;
- snapping may be enabled for editing without forcing organic cave or terrain geometry onto
  cell boundaries;
- portals and boundary continuations retain stable IDs across related floors, levels, and
  parent maps.

Adjacent battle maps created by splitting a large selection share stable edge-portal IDs so
roads, paths, water, walls, and other continuations align. Their local decoration can still be
rerolled independently.

Generation validates traversability, doorway and corridor clearance, unreachable regions,
grid-scale usability, conflicting inherited geometry, and boundary-portal alignment. Accepted
child maps remain stable when a parent changes; the application shows a clipped-context diff
and offers to keep, reconcile, or regenerate the affected aspects.

## 19. Final position

This project should begin as a **visually rewarding TypeScript world-atlas application with a
durable drill-down model**, not as either a disposable procedural sketch or a fully simulated
planetary platform.

The consolidated approach takes the strongest elements of both earlier plans:

- TypeScript's fast iteration, direct SVG model, and approachable contribution path;
- early coastline and stamp-family milestones that make progress visible;
- a first-class whole-world map whose continents, oceans, climate, and major terrain provide
  stable context for regional generation;
- explicit world-to-region footprints, projections, inherited context, and reconciliation;
- stable entity identities and aspect-scoped randomness;
- persisted accepted geometry, versioned behavior, and safe migrations;
- semantic, constraint, decoration, scene, and cache separation;
- transactional regeneration and editing that respect user intent;
- deferred subregional drill-down, plugins, native optimization, and secondary exporters.

The result is a plan that proves the distinctive world-to-region map-making experience early
without sacrificing the foundations required for selective regeneration and trustworthy
editing at smaller scales.
