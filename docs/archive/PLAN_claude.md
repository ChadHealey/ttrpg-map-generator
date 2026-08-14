# TTRPG Map Generator — Project Plan

A procedural map generator for tabletop RPGs that generates **both the map geometry and the
art assets used to draw it**. Hand-drawn fantasy style, desktop app, personal tool growing
into an open-source project.

## Vision summary

- Generate complete regional maps: land types, coastlines, rivers, lakes, forests,
  mountains, settlements, roads, labels.
- **Fully procedural assets, consistent per map.** On generation, the tool creates a
  *stamp set* for each asset family (e.g. ~8 evergreen tree variants) and reuses that set
  everywhere that family appears. Rerolling the evergreen set changes every evergreen forest
  on the map, but leaves the deciduous set untouched.
- **Selective regeneration.** Any part of the map — an asset set, a placement pass, a
  terrain region — can be regenerated independently without disturbing the rest.
- **Editable geometry.** Coastlines, river courses, and other boundaries can be hand-tweaked,
  and those tweaks survive regeneration of other parts.
- **Scale drill-down.** Pick a city on the regional map and open a city generator that
  inherits the surrounding geometry (river bend, coastline, terrain). Same again for a
  building within the city, or a dungeon under it.
- Exports: high-resolution raster (print), VTT-ready images, and SVG.

---

## 1. Language recommendation

**TypeScript**, running in a **Tauri** desktop shell, with the generation core kept
UI-agnostic. Rust (which Tauri embeds) as a later escape hatch for hot paths.

### Why TypeScript

| Concern | How TS fits |
|---|---|
| Vector art & SVG export | SVG *is* the web stack's native vector format. Path data, transforms, groups, and styling map 1:1 to what the stamp generators produce. No translation layer. |
| Geometry ecosystem | Best-in-class open libraries for exactly this domain: Delaunay/Voronoi, polygon boolean ops, Poisson-disk sampling, noise, bezier math (see §2). |
| Precedent | Azgaar's Fantasy Map Generator — the closest existing project to this vision — is pure JS in a browser and handles continent-scale maps fine. Performance is a solved problem at this map scale. |
| Interactive editing | Canvas/SVG + pointer events is the most productive environment there is for "drag this coastline control point" UX. |
| Open-source future | TypeScript has the largest contributor pool of any language. A web-stack repo is the easiest for drive-by contributors to build and run. |
| One language | Core, UI, exporters, and tests all in one language. No FFI boundary to maintain while the design is still fluid. |

### Why Tauri over Electron

- ~10 MB binaries vs ~150 MB, much lower memory use.
- The shell is Rust, so when a generation step genuinely needs native speed
  (e.g. large-map erosion simulation), it can move into a Rust command or a WASM module
  without changing the app's architecture.
- File-system access for project files and exports, with a proper native app feel.

### Runner-up considered

- **Rust end-to-end (egui/iced):** best raw performance, but slower iteration while the
  *design* is the hard problem, weaker 2D/SVG ecosystem, smaller contributor pool for the
  UI layer. Revisit per-module via WASM if profiling demands it.
- **Godot:** great for interaction, but SVG export and print-DPI rasterization fight the
  engine, and the scene-tree model doesn't match a document-centric editor.

---

## 2. Libraries

Keep the dependency list small and boring. Every geometry dependency must be replaceable
behind an internal interface (see §4).

### Generation core (pure, no DOM)

| Purpose | Library | Notes |
|---|---|---|
| Delaunay / Voronoi | `d3-delaunay` | The backbone of the terrain model (§5.1). Fast, tiny, well-maintained. |
| Noise | `simplex-noise` | Elevation, moisture, stroke wobble, stamp variation. |
| Blue-noise sampling | `poisson-disk-sampling` | Cell seeding, tree/stamp placement inside polygons. |
| Polygon boolean ops | `polygon-clipping` | Union/intersect/difference for regions, forest masks, drill-down clipping. |
| Bezier math | `bezier-js` | Curve fitting, offsetting, point-at-length for coastlines, rivers, roads, and stroke synthesis. |
| Seeded PRNG | small vendored impl (`sfc32` or `alea`) + `splitmix`-style seed derivation | Determinism is architectural (§5.2); vendor ~50 lines rather than depend on a package. |
| Geometry utils | write our own `geom/` module | Point/segment/polygon primitives, spatial hash. Avoid Turf: it is geo/latitude-oriented and heavier than needed. |

### App / rendering

| Purpose | Library | Notes |
|---|---|---|
| Desktop shell | Tauri 2 | |
| UI framework | Svelte (or React if preferred later) | Thin layer; almost all logic lives below it. |
| Interactive canvas | Canvas 2D + own scene graph; adopt PixiJS *only if* pan/zoom profiling demands WebGL | Don't start with a game engine you may not need. |
| State | `zustand`-style minimal store, or Svelte stores | The map *document* is not UI state; keep them separate. |
| Schema validation | `zod` | Validates project files and generator params at the boundaries. |

### Tooling

- `vitest` for tests, `eslint` + `prettier` enforced in CI, `typescript` in strict mode.
- `pnpm` workspaces for the monorepo.
- Golden-file snapshot testing (JSON + rendered PNG) for determinism regression (§6).

---

## 3. Project architecture

### Monorepo layout

```
packages/
  core/        Seeds, PRNG, geometry primitives, scene-graph types, document model.
               Depends on nothing internal. No DOM, no Tauri, no UI.
  generators/  The map-content generators: terrain, hydrology, biomes, settlements,
               roads, names. Depends on core only.
  assets/      The asset-family generators: trees, mountains, hills, buildings,
               waves, cartouches, hatching patterns. Produces stamp sets as vector
               scene-graph fragments. Depends on core only.
  render/      Themes and backends. Turns a scene graph into pixels (Canvas), SVG
               text, or print-DPI raster tiles. Depends on core only.
  io/          Project file load/save, schema migration, exporters (PNG/SVG/VTT).
  app/         Tauri + Svelte editor UI. The only package that knows about windows,
               menus, and pointer events. Depends on everything above.
```

**Dependency rule: arrows point down only.** `core` imports nothing internal;
`app` imports anything. `generators` never imports `render`. Enforced with an ESLint
boundary rule, not convention.

### The three-layer model

Every map is produced in three conceptually separate layers. This separation is what makes
selective regeneration, editing, and drill-down possible.

1. **Geometry layer (style-neutral).** The Voronoi cell graph, elevation field, coastline
   polylines, river networks, biome regions, settlement sites, road graph. No art here —
   this is *what the world is*.
2. **Decoration layer.** Placement of asset instances: which stamp goes where, at what
   rotation/scale/jitter; label positions; hatching regions. This is *what gets drawn where*.
3. **Asset & style layer.** The generated stamp sets themselves, plus the theme
   (stroke widths, palette, paper texture, hatching style). This is *what the drawings
   look like*.

Rerolling a stamp set touches layer 3 only. Editing a coastline touches layer 1 and
invalidates dependent parts of layers 1–2 (rivers that crossed it, trees now in water).
The dependency graph between layers is explicit (§5.3).

### The document model

The saved map is a **tree of generator nodes**, not a bag of pixels:

```
MapDocument
└─ RegionNode (seed, params)
   ├─ TerrainNode (seed, params, user-edits[])
   ├─ HydrologyNode (seed, params, user-edits[])
   ├─ BiomeNode ...
   ├─ AssetSetNode "evergreen-tree" (seed, style-params)
   ├─ AssetSetNode "deciduous-tree" (seed, style-params)
   ├─ SettlementNode "Aldenmere" (seed)
   │  └─ CityNode (seed, boundary-contract-ref)   ← drill-down lives in the tree
   │     └─ BuildingNode ...
   └─ ...
```

Each node stores its **seed, its parameters, and its user edits** — never its full output.
Output is recomputed deterministically on load and cached in memory. Project files stay
small and diff-able, and "regenerate X" is just "assign X a new seed and re-run its subtree."

---

## 4. Codebase rules

Rules chosen for a solo project that must later survive open-source contributors.

### Determinism rules (the non-negotiables)

1. **No `Math.random()`, anywhere.** All randomness flows through an injected `Rng`
   instance. An ESLint ban-rule enforces this.
2. **No hidden inputs.** A generator's output is a pure function of
   `(inputs, params, seed)`. No reading clocks, globals, or module state.
3. **Seeds are derived, never invented.** Child seed = `derive(parentSeed, stableKey)`
   where `stableKey` is a string like `"assets/evergreen-tree"`. Rerolling a node means
   bumping a per-node `generation` counter that is mixed into the derivation — so
   rerolls are themselves reproducible and saved in the document.
4. **Iteration order is stable.** No iterating over object keys or Sets where order
   affects output; use arrays with explicit sort keys.

### Structure rules

5. **One generator, one contract.** Every generator implements the same interface:
   `generate(ctx: GeneratorContext, params: P): Output` — where `ctx` carries the rng,
   the parent constraints, and nothing else. Uniformity here is what lets the editor
   offer "reroll / edit params / lock" on *every* node without special cases.
6. **Layer boundaries are import boundaries.** Geometry code cannot import decoration
   or style code. Enforced by the package layout and lint rules, not discipline.
7. **Data at boundaries is schema'd.** Every project-file type and every generator
   param type has a `zod` schema and a `schemaVersion`. Migrations are written the day
   a schema changes, not later.
8. **The scene graph is the only render input.** Generators emit scene-graph nodes
   (paths, stamp references, fills, text); render backends consume only the scene graph.
   No generator ever calls a canvas API.

### Hygiene rules

9. Strict TypeScript: `strict: true`, no `any`, no non-null assertions outside tests.
10. Small modules with one exported concept; file name matches the export.
11. Every bug fix lands with a regression test; every generator lands with a golden-seed
    determinism test (§6).
12. Conventional commits; short-lived branches; CI runs typecheck + lint + tests on
    every push.
13. Decisions that shape architecture get a 1-page ADR in `docs/adr/`. Cheap now,
    invaluable when contributors arrive.
14. `CONTRIBUTING.md` and per-package `README.md` from early on — written as if the
    open-source future already happened.

---

## 5. How the major pieces work

### 5.1 Terrain & the cell graph

Use the well-trodden **Voronoi cell graph** approach (Red Blob Games / Azgaar lineage):

- Poisson-disk sample ~10–60k points over the map frame; build Delaunay + Voronoi via
  `d3-delaunay`. Cells are the atomic unit for elevation, moisture, biome, and ownership.
- Elevation = layered simplex noise + a small number of "tectonic" uplift blobs +
  distance-to-edge falloff (guarantees ocean at map edges when wanted).
- **Coastline** = the elevation-0 contour traced along cell edges, then fit to smooth
  bezier chains for rendering and editing.
- Optional erosion pass (thermal + hydraulic, a few iterations) for more natural ridges.
  This is the first candidate for a Rust/WASM port if it's slow.

### 5.2 Hydrology

- Compute downhill flow direction per cell; fill depressions (priority-flood) so all
  water reaches the sea or forms lakes; accumulate flux.
- Cells above a flux threshold become rivers; trace them into polylines, widen by flux,
  and fit bezier chains. Lakes form where depressions remain.
- Rivers are first-class document objects — they carry names, and cities reference them
  ("in the elbow of the Aldenwash").

### 5.3 Selective regeneration & the dependency graph

Nodes declare what they consume: `Hydrology consumes Terrain`, `Forests consume Biomes`,
`TreePlacement consumes Forests + AssetSet(evergreen)`. This forms an explicit DAG.

- **Reroll a stamp set** → only re-render; placement and geometry untouched.
- **Reroll placement** → new instance positions, same stamps, same forests.
- **Edit the coastline** → terrain re-solves locally, hydrology recomputes, placements
  in affected polygons recompute; the deciduous stamp set never changes because nothing
  it consumes changed.

Invalidation is computed from the DAG; nothing is manually "refreshed."

### 5.4 User edits that survive regeneration

Edits are stored as **constraint overlays on the node, not mutations of its output**:

- Coastline edit: user drags fitted-curve control points; the deltas are saved as pinned
  control points. On regeneration the tracer fits its curve *through the pinned points*
  (elevation is locally warped to agree with them).
- River edit: same mechanism — pinned points become waypoints the flow-trace must honor.
- Placement edits: "delete this tree / move this town" saved as per-instance overrides
  keyed by stable instance IDs.
- Every node also has a **lock flag**: a locked node ignores upstream invalidation and
  keeps its current output (with a UI warning when it becomes inconsistent).

### 5.5 Procedural stamp sets (the asset generators)

The signature feature. Each asset family is its own small generator:

- `AssetSetNode("evergreen-tree", familySeed, styleParams)` produces **N stamp variants**
  (e.g. 8) as vector scene-graph fragments with a defined anchor and footprint.
- A stamp generator is parametric art code: an evergreen = trunk stroke + 3–5 stacked
  branch-tier triangles with noise-perturbed edges + optional snow/hatch fill; a mountain
  = ridge spine + flank strokes + hatched shadow side; a house = footprint + roof line +
  door tick. Style params (stroke weight, jaggedness, ink color, fill style) come from the
  map theme so all families look like one hand drew them.
- **Placement** is a separate node: Poisson-disk points inside the forest mask, density
  from biome moisture, per-instance seed → pick variant + jitter rotation/scale (±10%),
  sort by y for painter's-order overlap. Same pattern for hills, mountains, swamp tufts,
  farm fields, waves on water.
- Because stamps are vectors, SVG export is exact and print rasterization is unlimited-DPI.

### 5.6 Hand-drawn rendering style

- **Stroke synthesis:** every "ink" line is rendered by resampling the ideal path and
  displacing points with low-frequency noise (seeded per path — deterministic wobble),
  with slight width variation to fake pen pressure.
- Coast gets 2–3 offset "waterline" echo strokes fading out to sea (`bezier-js` offsetting).
- Relief hatching on the shadow side of mountain/hill stamps; stipple or short-dash
  texture for swamp and desert.
- Paper theme: parchment fill, subtle noise grain, vignette, decorative border and
  compass rose (themselves procedural asset families).
- Themes are data (a theme object), not code — a second theme (clean print) forces the
  style/geometry separation to stay honest.

### 5.7 Settlements, roads, and names

- Score cells for settlement desirability: fresh water, river confluence, natural
  harbor, flat land, resource biomes. Pick maxima with spacing constraints; size
  (city/town/village) from score.
- Roads: A* over the cell graph, cost = distance × slope penalty × river-crossing
  penalty (crossings become bridges/fords — future drill-down hooks).
- Names: syllable-template generator per culture region (`"ald"+"en"+"mere"`), applied
  to settlements, rivers, seas, and regions. Label placement: along-curve labels for
  rivers/coasts, collision-avoided point labels for settlements.

### 5.8 Drill-down: the boundary contract

The mechanism that makes "zoom into the city in the river elbow" work:

- When a child map is opened for a site, the parent produces a **BoundaryContract**: the
  child's frame in parent coordinates, plus every parent feature clipped to (and near)
  that frame — coastline segments, river centerlines *with width and flow direction*,
  road entry points, land-type polygons, elevation samples, and climate values.
- The child generator treats the contract as **hard constraints**: the city generator
  receives "river enters frame edge at A, exits at B, width w" and must route the actual
  river banks through those points; roads entering the frame become city gates.
- Contracts are versioned data (zod schema) — parent and child only communicate through
  them. A city map never reaches into terrain internals, which means a dungeon-under-a-
  building works the same way, and a child map can even be generated standalone from a
  hand-written contract.
- Child maps live in the document tree under their parent node, with their own seeds,
  edits, and asset sets (a city gets its own building-stamp families).

City-scale generation (later milestone): grow a street network from gates + market
square (organic growth or tensor fields), split blocks into parcels, generate building
footprints per parcel, reuse the stamp-set machinery for rooftops. Building-scale and
dungeon-scale: grammar/BSP room layout driven by a generated mission graph, constrained
by the parcel footprint from the contract.

### 5.9 Export pipeline

All exports consume the same scene graph:

- **SVG:** near-direct serialization (stamps become `<defs>`+`<use>` — small files,
  editable in Illustrator/Inkscape).
- **Print raster:** render the scene graph to offscreen canvas tiles at target DPI and
  stitch; no upper resolution limit since everything is vector.
- **VTT:** raster export at a chosen px-per-grid-square, plus a sidecar JSON
  (grid size, dimensions; later Foundry scene JSON with walls/lights derived from
  building/dungeon geometry — the geometry layer makes this nearly free).

---

## 6. Testing strategy

- **Golden-seed tests:** every generator has fixture tests asserting that seed X +
  params Y produce exactly output Z (JSON snapshot). Catches accidental determinism
  breaks — the most dangerous regression class in this project.
- **Golden-image tests:** a small set of full maps rendered to PNG and pixel-compared
  (with tolerance) in CI. Catches render regressions the JSON snapshots miss.
- **Property tests** for geometry invariants: rivers always reach a sea or lake;
  coastlines are closed non-self-intersecting loops; no stamp anchored in water;
  contract features lie on the child frame.
- **Unit tests** for `core/geom` and seed derivation, exhaustively — everything sits
  on them.

---

## 7. Suggested milestones

1. **Skeleton:** monorepo, `core` (rng, seeds, geom, scene graph), Canvas viewer in a
   bare Tauri window, golden-test harness. *Proves the architecture.*
2. **Terrain slice:** cell graph → elevation → coastline → hand-drawn coast + water
   render. *First map on screen.*
3. **Stamp sets:** evergreen + deciduous tree families, biome-driven placement, the
   "reroll this set" button. *Proves the signature feature.*
4. **Hydrology + mountains + full regional render** with labels and theme.
5. **Editing:** coastline/river pinned-point editing, locks, placement overrides.
6. **Exports:** SVG, print PNG, VTT raster.
7. **Drill-down v1:** boundary contract + a minimal city generator.
8. Open-source prep: docs, ADR backlog cleanup, contributor guide, first release.

Each milestone ends with something visible on screen — important for momentum on a
solo project.
