# Procedural TTRPG Map Generator: Technical Plan

**Status:** Initial architecture proposal  
**Initial scope:** Offline regional fantasy maps  
**Primary platforms:** Apple Silicon macOS desktop and headless Linux, with a path to Windows  
**Visual direction:** Believable geography rendered as a hand-drawn fantasy map  

## 1. Executive recommendation

Build the generation engine, world model, persistence layer, render scene, and exporters in **Rust**. Put them in reusable crates that know nothing about the desktop UI. Provide two thin applications over that core:

1. A **Tauri 2 desktop application** with a **TypeScript/Svelte** interface for procedural controls, layer visibility, selection, and occasional geometry editing.
2. A **Rust command-line application** for deterministic generation, batch export, automated tests, and use on a headless Linux server.

The architectural center should not be an image or a canvas. It should be a persistent, scale-aware **world document** containing semantic entities and canonical geometry. A renderer turns that data into a hand-drawn scene, and exporters turn the same scene into SVG, PDF, PNG/JPEG, or a Foundry VTT package.

Every generated entity must have a stable identity, its own derived random seed, a generator version, parameters, dependencies, and user overrides. Regenerating one evergreen forest can then change its tree shapes or distribution while leaving a nearby deciduous forest, the coastline, and every settlement untouched.

The most important design rule is:

> Keep geographic truth, user constraints, generated decoration, and final rendering as separate layers of data.

## 2. Product goals and boundaries

### 2.1 First-release goals

The first useful release should generate and edit one regional map containing:

- land and sea;
- coastlines, islands, and lakes;
- elevation and mountain forms;
- climate fields and believable biome regions;
- rivers and watersheds;
- forests and individually generated tree motifs;
- settlements and basic roads;
- labels, a legend, compass, border, and scale;
- a coherent hand-drawn style;
- independent regeneration of selected entities or visual layers;
- a reusable boundary editor for coastlines, rivers, lakes, forests, biomes, territories, and other generated regions;
- constrained point and route edits for settlements, roads, and other non-area features;
- saved worlds that reopen without changing;
- SVG, print-ready PDF, PNG/JPEG, and an initial Foundry VTT export.

### 2.2 Explicitly defer

Do not attempt city, building, dungeon, encounter, political-history, economy, or full plate-tectonic simulation in the first release. The regional model must preserve the context required by those systems, but implementing them too early would conceal flaws in the regional foundation.

Do not make cloud accounts, collaboration, marketplace distribution, or runtime-downloaded assets part of the initial architecture. The application is offline-first.

### 2.3 Quality priorities

When goals conflict, use this order:

1. Geographic and topological correctness.
2. Reproducible, selective regeneration.
3. Preservation of user edits.
4. Legible, attractive output.
5. Interactive preview speed.
6. Total generation speed.

## 3. Language and application stack

### 3.1 Primary language: Rust

Rust is the best primary language for this project because it provides:

- native binaries for macOS and Linux, including Apple Silicon and common Linux server targets;
- good performance for grids, geometry, spatial indexing, rendering, and high-resolution exports;
- strong type modeling for units, identifiers, coordinate spaces, generator inputs, and persistent schemas;
- explicit control over determinism, parallel work, and ownership of large map data;
- a clean way to expose the same core to a desktop shell, CLI, tests, and future plugin host;
- packaging without a Python interpreter, JVM, or Node runtime on the server.

Rust should own all behavior whose output must be stable: seeding, simulation, geometry, entity generation, scene construction, persistence, validation, and export.

### 3.2 UI language: TypeScript with Svelte

Use TypeScript and Svelte for the desktop interface. Tauri combines a Rust host with an HTML webview and message passing, while supporting desktop targets including macOS and Linux. This gives the editor mature controls, flexible panels, keyboard handling, accessible HTML, and a canvas/SVG viewport without moving core rules into JavaScript.

Keep TypeScript deliberately thin. It may contain transient UI state, interaction tools, and preview orchestration, but it must not contain a second implementation of generation or geographic rules.

Use **Svelte with Vite**, not a server-rendered web framework. There is no web server or routing requirement in the desktop application.

### 3.3 Headless Linux

The Linux server entry point is the CLI, not the Tauri window. Examples of eventual commands:

```text
mapgen new --seed 1234 --preset temperate-region --output world.mapworld
mapgen generate world.mapworld --through labels
mapgen regenerate world.mapworld --entity forest:01J... --aspect appearance
mapgen validate world.mapworld
mapgen export world.mapworld --format svg --output region.svg
mapgen export world.mapworld --format png --width 12000 --output region.png
mapgen export world.mapworld --format foundry-vtt --target-version 14
```

This keeps server operation independent of Linux display servers and WebKit packages. The GUI may still be built for graphical Linux workstations.

### 3.4 Alternatives considered

- **Python + Qt:** excellent for experiments and has a deep scientific ecosystem, but distribution, performance boundaries, static correctness, and long-term reproducibility are weaker for this product.
- **Godot:** strong interactive drawing and cross-platform support, but a less natural fit for vector-first print export, headless library reuse, schema migrations, and a persistent non-game world model.
- **C# + Avalonia/Skia:** a credible second choice with a friendlier learning curve, but Rust has a cleaner headless footprint and a particularly good geometry/vector ecosystem for this design.
- **Electron:** capable, but ships a larger runtime and encourages logic to drift into JavaScript. Tauri is a better shell for a Rust-owned engine.

## 4. Recommended libraries

Pin exact versions in lockfiles only after a small compatibility spike. The names below are architectural choices, not permission to adopt every dependency immediately.

### 4.1 Rust core

| Need | Recommended library | Use |
|---|---|---|
| Serialization | `serde`, `serde_json` | Persistent records, settings, plugin messages, debug fixtures |
| Schema descriptions | `schemars` | Generate JSON Schema for presets and extension contracts |
| Stable identifiers | `uuid` or `ulid` | Entity identity independent of names and array positions |
| Deterministic random streams | `rand_core`, `rand_chacha` | Explicit, portable RNG streams; never use ambient/thread RNG in generators |
| Hashing/seed derivation | `blake3` | Derive independent seeds and content/cache keys |
| Planar geometry | `geo`, `geo-types` | Polygons, lines, containment, intersection, simplification, buffers, triangulation |
| Spatial index | `rstar` | Nearby-entity, hit-test, overlap, and viewport queries |
| Triangulation | `spade` where `geo` is insufficient | Delaunay/Voronoi work for terrain regions and sampling |
| Graphs | `petgraph` | Dependency graph, drainage DAG, and road/settlement networks |
| Procedural fields | `noise` initially | Seeded simplex/Perlin/Worley components; wrap behind project traits |
| Parallelism | `rayon` | Parallel tiles and independent generators after determinism tests exist |
| Persistence | `rusqlite` with bundled SQLite | Offline world store and migrations without an external database service |
| Errors | `thiserror`; `anyhow` only in application binaries | Typed library errors and contextual errors at process boundaries |
| Diagnostics | `tracing`, `tracing-subscriber` | Timings, dependency invalidation, export reports, and debugging |
| CLI | `clap` | Headless and batch interface |
| Raster images | `image` | PNG/JPEG encoding and image operations |
| SVG parsing/rasterizing | `usvg`, `resvg`, `tiny-skia` | Normalize and rasterize the canonical SVG scene |
| Vector PDF | `svg2pdf` | Preserve vector paths in print output where supported |
| Compression/package | `zip` | Portable world bundles and Foundry packages |

The `geo` crate already provides core planar geometry and topology operations such as boolean operations, buffers, containment, intersection, simplification, and triangulation. SQLite's R*Tree module is useful for persistent bounding-box lookups. `rand_chacha` provides deterministic portable random streams, but its algorithm/version must still be recorded in the world file.

Avoid a required GEOS/GDAL/PROJ installation in the first version. A fictional regional map uses a local planar coordinate system, and pure-Rust dependencies are substantially easier to package on macOS and Linux. Add a native geospatial dependency only after a demonstrated correctness or performance gap.

### 4.2 Desktop interface

| Need | Recommendation |
|---|---|
| Desktop shell | Tauri 2 |
| Component UI | Svelte + TypeScript |
| Build tooling | Vite |
| Application state | Small purpose-built Svelte stores; avoid a second domain model |
| Viewport | Layered HTML Canvas for the interactive preview, with SVG overlays for handles and selections |
| Validation/types | Generate TypeScript contracts from the Rust-facing schema or test them against shared JSON Schema |

Do not make a browser graphics framework part of the domain. Begin with Canvas 2D plus SVG overlays. Introduce PixiJS/WebGL only if profiling shows that the preview cannot meet its frame budget with level-of-detail rendering.

### 4.3 Development quality tools

Use `rustfmt`, strict `clippy`, `cargo-nextest`, `cargo-deny`, and `cargo-audit`. Use ESLint, Prettier, TypeScript strict mode, and Vitest for the UI. Run builds and tests on macOS ARM64 and Linux x86-64; add Linux ARM64 when it becomes a deployment target.

## 5. Core conceptual model

The model has four distinct forms. Mixing them will make selective regeneration and editing unreliable.

### 5.1 Semantic world model

This is what exists in the fictional world:

- terrain fields and land/water classification;
- coastlines and lake polygons;
- watersheds and river networks;
- climate and biome regions;
- forest regions;
- settlements and routes;
- named features and parent/child relationships.

A `Forest` is a region with biome, density, age, and identity. It is not a collection of visible tree strokes.

### 5.2 Constraint and override model

This records user intent:

- locked or pinned entities;
- control points, protected segments, and shared-edge constraints for any editable boundary;
- hard/soft inclusion, exclusion, minimum-separation, containment, and overlap rules;
- river and road waypoints, source/sink constraints, corridors, and protected reaches;
- painted biome, forest, district, territory, and land-use inclusions/exclusions;
- settlement locations and keep-out areas;
- parameter overrides;
- accepted warnings.

Manual edits are inputs to later generation, never undocumented mutations to cached output.

### 5.3 Render scene

This is a renderer-neutral display list made from semantic data:

- paths, polygons, symbols, text, masks, patterns, and images;
- physical stroke widths and style tokens;
- stable z-order and clipping groups;
- links back to source entity IDs for selection and diagnostics.

SVG, PDF, raster, and the interactive preview all consume this scene. A single scene prevents each exporter from interpreting the world differently.

### 5.4 Derived cache

Preview meshes, raster field tiles, placed tree glyphs, label candidates, thumbnails, and export intermediates are disposable caches. Cache keys include all inputs, generator version, style version, seed, resolution, and relevant platform-independent settings.

## 6. Workspace and dependency architecture

Use a Cargo workspace with dependency direction pointing inward:

```text
apps/
  desktop/                 Tauri host and Svelte/Vite UI
  cli/                     headless commands
crates/
  domain/                  IDs, units, entities, invariants; no UI or database
  geometry/                coordinate types and robust geometry operations
  generation-api/          generator traits, contexts, outputs, dependency declarations
  generation-terrain/      elevation, landmass, coastline
  generation-climate/      temperature, moisture, biome classification
  generation-hydrology/    watersheds, rivers, lakes
  generation-ecology/      forests and vegetation regions
  generation-settlement/   settlement placement and roads
  assets/                  procedural vector motif generators
  style/                   style sheets, tokens, stroke grammars
  scene/                   renderer-neutral scene graph
  render-svg/              canonical SVG output
  render-raster/           PNG/JPEG via the SVG/render tree
  render-pdf/              print PDF
  export-foundry/          versioned Foundry adapter
  persistence/             SQLite repositories and migrations
  engine/                  orchestration, invalidation, transactions, commands
  plugin-protocol/         extension manifests and process protocol
fixtures/                  small reviewed worlds and golden references
docs/                      ADRs, schemas, algorithms, extension guide
```

This is a target structure, not a requirement to create every crate on day one. Start with `domain`, `engine`, `render-svg`, `persistence`, `cli`, and `desktop`; split a crate when its boundary becomes real.

### 6.1 Dependency rules

- `domain` depends only on small foundational crates.
- Generators depend on `domain`, `geometry`, and `generation-api`, never on UI, SQLite, or a particular renderer.
- Renderers consume the render scene, not generator internals.
- Applications call `engine` use cases; they do not query database tables directly.
- Exporters are adapters. Foundry-specific concepts must never enter the world model.
- UI-to-core calls are coarse application commands such as `RegenerateEntity`, not hundreds of geometry primitives sent through IPC.

## 7. Persistent world format

### 7.1 Working format

Use a directory package during editing:

```text
MyWorld.mapworld/
  world.sqlite
  manifest.json
  assets/                  imported fonts or user-added resources, if any
  cache/                   safe to delete
  previews/                safe to rebuild
```

On macOS this can later be presented as a document package. For transfer or backup, export the directory as a compressed single-file bundle. Do not edit SQLite inside a ZIP archive.

Use SQLite transactions and foreign keys. Use the R*Tree extension for entity bounding boxes and viewport/spatial queries. The authoritative geometry can be stored as a versioned binary or canonical JSON representation; do not expose the storage representation as the plugin API.

### 7.2 Essential records

Each generated entity should carry at least:

```text
EntityId
EntityKind
ParentEntityId / MapId
CanonicalGeometry
SemanticProperties
GeneratorId
GeneratorSchemaVersion
GeneratorParameters
VariantRevision
DependencyIds and dependency aspects
OverrideSet
LockState
GenerationStatus and diagnostics
CreatedAt / ModifiedAt
```

The world manifest records the world seed, coordinate conventions, unit scale, engine schema version, style pack, default generator versions, and feature flags.

### 7.3 Migrations and recovery

- All schema changes are forward migrations with fixtures for every historical version.
- Back up the database before a migration and use a transaction.
- Save user commands atomically; generation either commits a complete valid result or nothing.
- Keep bounded undo/redo as domain commands plus periodic snapshots. Full event sourcing is unnecessary initially.
- Autosave user-authored constraints promptly. Derived caches can be rebuilt after a crash.

## 8. Determinism and independent regeneration

Never use one sequential RNG for the whole map. Adding a tree early in a loop would shift every later draw and change unrelated features.

Derive an independent seed for every entity, stage, and concern:

```text
seed = BLAKE3(
  world_seed,
  map_id,
  generator_id,
  generator_schema_version,
  entity_id,
  aspect_name,
  variant_revision
)
```

Examples of aspects are `forest.boundary`, `forest.tree_species`, `forest.glyph_shapes`, `forest.glyph_placement`, and `forest.hatching`. Regenerating only `forest.glyph_shapes` increments that aspect's revision and invalidates only the forest's dependent render nodes.

### 8.1 Reproducibility rules

- Every generator receives an explicit RNG; no hidden system time or ambient random source.
- Sort inputs by stable ID before generation. Never rely on hash-map iteration order.
- Parallel execution may not change reductions or output ordering.
- Quantize serialized geometry to a declared world-unit precision.
- Record generator and style versions. A newer algorithm is a new version, not a silent behavioral change.
- Keep materialized authoritative output when opening old worlds so an upgrade does not redraw them automatically.
- Golden tests confirm identical canonical output on macOS and Linux for fixed seeds.
- If an intentional algorithm upgrade changes output, offer **keep existing**, **upgrade selected**, and **upgrade all**, with a preview.

### 8.2 Regeneration modes

The UI should distinguish:

- **Appearance:** redraw symbols, strokes, hatching, or labels without changing world facts.
- **Entity:** regenerate the selected semantic entity within its existing boundary/context.
- **Entity and dependents:** regenerate the entity and all invalidated downstream entities.
- **Region:** regenerate unlocked entities intersecting a selected area.

Always show what will be preserved and what will be invalidated before a broad regeneration.

## 9. Generation graph and invalidation

Represent the pipeline as a dependency graph with aspect-level edges, not merely a fixed list of functions.

```text
world boundary + constraints
  -> elevation
  -> land/water mask
  -> coastline and water bodies
  -> climate fields
  -> hydrology
  -> biomes
  -> forests
  -> settlement suitability
  -> settlements
  -> roads
  -> labels
  -> render scene
  -> exports
```

Actual edges are more precise. For example, forest glyph appearance depends on the forest polygon, style, and its appearance seed, but not on labels. A label position depends on visible obstacles but changing its font should not regenerate a river.

Each generator declares:

- accepted input entity/aspect types;
- output entity/aspect types;
- parameter schema and defaults;
- generator version;
- deterministic seed namespaces used;
- dirty-region expansion rules;
- validation rules;
- estimated cost and progress units.

When an edit occurs, the engine computes the affected subgraph and geographic dirty bounds. It proposes a transaction, runs it on a snapshot, validates the result, and commits only if valid. This is the basis for local recomputation.

## 10. Regional generation design

### 10.1 Coordinate system and resolution

Use a fictional local planar coordinate system measured in explicit world units such as kilometers. Keep it independent of screen pixels and print size. Store coordinates as quantized integers or quantized `f64` values at persistence boundaries, with typed conversions between:

- world coordinates;
- simulation grid cells;
- render points;
- screen pixels;
- print units;
- Foundry scene pixels/grid distance.

Use a multi-resolution field pyramid. Simulation fields can be coarse where smooth and refined near coasts, rivers, and edits. Rendering must be resolution-independent until raster export.

### 10.2 Elevation and landmass

For the MVP, combine several understandable controls rather than claiming a complete geological simulation:

1. Generate large-scale continental masks from seeded low-frequency fields and user parameters such as land coverage, fragmentation, and edge behavior.
2. Add mountain spines from generated ridge graphs or constrained polylines.
3. Add warped multi-scale noise for secondary terrain.
4. Apply broad erosion-inspired smoothing and drainage conditioning.
5. Select sea level and classify land/water.
6. Extract coast contours with marching squares, repair topology, simplify, and smooth without introducing self-intersections.

Expose meaningful controls—`land coverage`, `island frequency`, `coast roughness`, `mountaininess`, `relief`, and `erosion strength`—rather than raw noise octaves on the main screen. Advanced parameters may live in an inspector.

Noise is a useful ingredient, not the model itself. Every result should pass checks for valid polygon winding, self-intersection, minimum island size, and narrow artifacts.

### 10.3 General boundary and path editing

Boundary editing must be a shared engine capability, not a special tool implemented separately for coasts and rivers. The same selection, control geometry, constraints, topology validation, dirty-region calculation, dependency preview, transaction, undo, and regeneration workflow should support:

- coastlines, islands, lakes, and wetlands;
- forests, biomes, deserts, marshes, and other ecological regions;
- political territories, cultural regions, claims, and administrative borders;
- settlement footprints, farmland, neighborhoods, wards, and future city districts;
- walls, parcels, rooms, dungeon areas, and other future small-scale regions;
- rivers, roads, trails, walls, and other open paths;
- arbitrary plugin-defined regions or paths that declare their geometric rules.

Model editable geometry with a small set of reusable primitives:

- **Closed region:** one exterior ring plus optional holes.
- **Open path:** an ordered centerline with endpoints and optional width profile.
- **Shared border:** one canonical edge referenced by both neighboring regions, preventing gaps and overlaps after an edit.
- **Point/portal:** a constrained location, optionally attached to a path or boundary.
- **Painted field constraint:** inclusion, exclusion, attraction, repulsion, or target-value strokes with a falloff radius.

Display simplified edit geometry rather than every simulation or render sample. Editing operations include moving, adding, and removing control points; drawing or erasing regions; splitting and joining boundaries; smoothing or simplifying a selection; pinning a segment; and adjusting an influence radius. The engine converts these gestures into persistent constraints, regenerates the authoritative geometry locally, validates it, and shows the proposed result before commit.

Each boundary type declares a `BoundaryPolicy` describing:

- whether it is open, closed, or may contain holes;
- containment relationships, such as a district inside a city or a forest inside land;
- permitted overlap, contact, gaps, and minimum separation with other feature types;
- whether neighboring regions must share an exact canonical edge;
- minimum area, width, segment length, and curvature;
- snapping targets such as rivers, roads, coasts, walls, or parent boundaries;
- dependencies invalidated by semantic and cosmetic changes;
- automatic repair strategies and diagnostics when constraints conflict.

Provide three edit intents:

- **Cosmetic:** changes only how a boundary or path is drawn. It does not alter the underlying world.
- **Constrained semantic:** updates the feature while asking its generator to preserve geographic or domain validity around the edit.
- **Authoritative:** pins the user geometry as world truth and regenerates or reports conflicts in dependent features.

For adjacent regions such as city districts or political territories, never store two almost-matching copies of a border. Store a shared topological edge and let each region reference it with opposite orientation. Moving that edge updates both regions atomically. Junctions and enclaves receive stable IDs so splitting, merging, and undo remain deterministic.

Edits are scoped by feature identity and aspect. Changing a forest boundary does not regenerate its tree designs unless placement or rendering is invalidated; changing a city district border does not redesign unaffected districts. Locks can apply to a whole feature, one boundary segment, or one aspect.

### 10.4 Coastline behavior

A coastline uses the general boundary system with a land/water policy. A drag creates or updates a coastline constraint with an influence radius. Locally adjust the signed land/water field to honor that constraint, then re-extract and validate the affected coast.

Offer two edit strengths:

- **Cosmetic:** changes the displayed shoreline only; safe and fast.
- **Geographic:** modifies the land/water constraint and may invalidate nearby elevation, lakes, river mouths, biomes, settlements, and roads.

The impact preview must show the affected region and dependent entities before committing a geographic edit.

### 10.5 Climate and biomes

Compute temperature from a configurable north/south gradient, season baseline, elevation lapse, and optional maritime moderation. Compute moisture from water proximity, prevailing wind advection, elevation/rain-shadow effects, and drainage wetness. Classify biomes using data-driven threshold tables.

Biome definitions belong in versioned data, not hard-coded conditionals. A style can render the same semantic biome in different ways.

### 10.6 Hydrology

Hydrology must be elevation-derived:

1. Condition the elevation grid by filling or resolving accidental sinks while preserving intentional basins.
2. Calculate flow directions.
3. Calculate flow accumulation.
4. Select channel heads by accumulation, rainfall, slope, and density controls.
5. Trace tributaries downhill into lakes or the sea.
6. Build a directed drainage graph.
7. Derive river width from discharge/accumulation.
8. Identify intentional lakes, outlets, deltas, and terminal basins.

Validation rules include downhill flow within tolerance, no unexplained crossings, tributaries joining rather than crossing, endpoints in valid sinks, and widths that do not decrease downstream except at modeled diversions.

River editing specializes the general open-path system with source, mouth, downstream ordering, and optional waypoint/corridor constraints. A geographic river edit finds a least-cost downhill route through its corridor and may locally carve the terrain. If the requested path is impossible, explain why and offer either a cosmetic path edit or a terrain-adjusting edit.

### 10.7 Forests and vegetation

Create semantic forest regions from biome, moisture, elevation, slope, disturbance, and proximity rules. A forest entity records its ecological type and boundary; its visible contents are generated separately.

For each forest:

1. Generate or accept the forest polygon.
2. Produce a density field with clearings and edge falloff.
3. Select species/motif families from the biome definition.
4. Place symbol anchors with variable-radius Poisson-disc or blue-noise sampling.
5. Generate several seeded vector tree variants.
6. Batch compatible strokes for efficient rendering.

This directly supports regenerating evergreen tree designs without altering a deciduous forest. The forest entity and its `glyph_shapes` aspect use different seeds from its boundary and placement aspects.

Forest polygons use the general closed-region editor. The user can pull an edge, paint areas in or out, create a clearing as a hole, split one forest, merge compatible forests, or pin a boundary segment. The ecology generator then reconciles the edited region with slope, moisture, biome, and protected neighboring features. An authoritative edit may override ecological suitability but should retain a visible diagnostic explaining the exception.

At low zoom, render forest massing and a subset of symbols. At export resolution, use the full symbol population and detail level.

### 10.8 Mountains and terrain symbols

Derive mountain ridge polylines from elevated terrain. Generate hand-drawn peak motifs oriented along local ridges, scale them by prominence, and handle occlusion consistently. Hills, cliffs, marsh tufts, dunes, and grass marks use the same procedural motif system.

Do not let decorative symbols become the only record of topography. They are a view of elevation and terrain entities.

### 10.9 Settlements and roads

Create a settlement suitability field using freshwater access, river crossings, coast/harbor value, slope, flood risk, agricultural potential, natural resources, defensibility, and distance from existing settlements. Sample candidates, score them, enforce spacing, then assign size/class based on regional carrying capacity and network position.

Generate roads as a network problem:

1. Connect important settlements with a sparse candidate graph.
2. Route edges over a travel-cost surface that penalizes slope, marsh, water, and difficult terrain.
3. Reward passes, bridges, fords, valleys, and existing roads.
4. Remove redundant low-value links while preserving useful connectivity.

Store crossing points, gates to future child maps, and route continuations as explicit entities.

### 10.10 Labels and cartographic furniture

Label placement is a constrained optimization problem. Generate candidates for each feature, score legibility and association, penalize collisions and important geometry coverage, and optimize in stable priority order with bounded backtracking.

Labels retain their semantic anchor even when their rendered position moves. User-positioned labels become pinned overrides. Use licensed bundled fonts and record font identity in the style pack. The map border, title, scale bar, compass, legend, and optional coordinate grid belong to a layout layer rather than geographic space.

## 11. Procedural asset and hand-drawn style system

### 11.1 Asset definition

An asset generator produces vector geometry plus anchors and metadata, not a final bitmap. Examples include trees, mountain peaks, settlement icons, waves, marsh grass, stipple clusters, bridges, borders, compasses, and banners.

Each asset family has:

- semantic compatibility tags;
- parameter schema with sensible ranges;
- stable generation seed;
- named anchors and bounds;
- level-of-detail variants;
- collision and masking shape;
- style tokens rather than hard-coded colors;
- generator and schema versions.

### 11.2 Hand-drawn effect

The visual style should come from controlled imperfection:

- perturb vector centerlines with band-limited noise in world or print space;
- use two-pass ink strokes with subtly different widths/opacity;
- vary pressure along paths;
- generate hatched and stippled fills with clipped seeded patterns;
- introduce small seeded asymmetry in symbols;
- preserve major silhouettes and topology;
- make variation scale-aware so zooming or DPI changes do not redesign the map.

Never repeatedly distort already-distorted output. Always derive the styled path from canonical geometry plus a seed. This prevents accumulated damage after edits.

### 11.3 Style packs

Separate style from content through a versioned style-pack manifest containing palette, line hierarchy, motif families, typography, texture parameters, spacing, and print defaults. Begin with one excellent monochrome/limited-color ink style before supporting multiple themes.

Use data-driven style packs internally from the beginning, but do not promise a stable public style format until the first style is complete.

## 12. Geometry-aware drill-down

Although city and building generation are deferred, implement the regional side of a scale hierarchy now.

### 12.1 Map hierarchy

Each map has:

- a map ID and scale class;
- a footprint in parent-world coordinates;
- a local coordinate system and invertible transform to the parent;
- parent and child map links;
- inherited context snapshots;
- boundary portals and continuity constraints.

### 12.2 Context contract

When a user opens a regional settlement as a future city map, the parent supplies a typed `ChildMapContext` containing:

- clipped terrain/elevation and biome fields around the footprint;
- coastline, riverbanks, water levels, and floodplain geometry;
- every road and river crossing the boundary, with position, tangent, width, class, and identity;
- settlement center, class, population range, culture/style tags, and important landmarks;
- neighboring land uses and excluded areas;
- north direction, physical units, and parent/child transform;
- the versions and IDs of all source entities.

A city generator must honor these as boundary conditions. A river entering the city at a certain location and direction must leave its detailed map consistently. The same pattern later applies to city-to-building and region-to-dungeon relationships.

### 12.3 Propagation policy

Do not silently propagate changes across scales. Classify parent changes as:

- **Non-conflicting:** automatically refresh inherited context.
- **Reconcilable:** offer a previewed migration, such as bending an unpinned city road toward a moved regional gate.
- **Conflicting:** retain the child and show a repair task, such as a river moving through a pinned building district.

Child edits do not rewrite parent geography by default. An explicit **promote to parent** command may propose a parent constraint.

## 13. Editing and user experience

The main application should resemble a procedural inspector around a map, not a general-purpose illustration program.

### 13.1 Primary workflow

1. Create a world from a seed and regional preset.
2. Adjust high-level controls with low-resolution previews.
3. Generate through terrain, hydrology, ecology, settlements, and labels in stages.
4. Select any semantic feature to inspect its seed, generator, parameters, dependencies, and lock state.
5. Regenerate one aspect, edit constraints, or pin the accepted result.
6. Review warnings and dependency impacts.
7. Export at a chosen physical size or VTT scale.

### 13.2 Selection and editing

Hit testing uses source entity IDs attached to render nodes and the spatial index. The inspector should clearly separate:

- facts about the feature;
- generation controls;
- visual controls;
- manual constraints;
- regeneration history and warnings.

The reusable geometry tools initially need only move/add/delete control points, paint inclusion/exclusion, split/join, set waypoints/corridors, pin segments, and adjust influence radius. Different feature types configure those tools through their boundary policies. Avoid building a complete Bézier editor.

### 13.3 Responsiveness

- Show a coarse preview quickly, then refine it.
- Run generation off the UI thread with cancellation and progress.
- Cancel superseded preview jobs.
- Recompute only dirty graph nodes and dirty geographic tiles.
- Keep export rendering separate from interactive frame-rate requirements.

## 14. Export architecture

### 14.1 Canonical SVG

Make SVG the first authoritative export and the interchange between the scene graph and other renderers. It naturally represents paths, symbols, patterns, clipping, and text. Produce deterministic element ordering and stable IDs so diffs and golden tests are useful.

### 14.2 PNG and JPEG

Rasterize the normalized SVG/render tree with `resvg`/`tiny-skia`, using tiled rendering for very large outputs. PNG is the default lossless export. JPEG is useful for smaller textured backgrounds but should warn about transparency and line-art artifacts.

Expose dimensions in pixels or physical size plus DPI. Preview estimated memory and file size before extreme exports.

### 14.3 PDF and printing

Convert the SVG scene to vector PDF through `svg2pdf`, preserving paths and text where supported. Support standard paper sizes, orientation, margins, bleed, crop marks, poster tiling, and font embedding or conversion to paths.

Treat professional CMYK/color-profile workflows as a later capability. The initial PDF should be explicitly documented as an RGB print workflow and visually compared with the SVG and raster exports.

### 14.4 Foundry VTT

Implement Foundry as a versioned adapter because its scene schema changes over time. The initial export package should contain:

- a correctly scaled background image;
- scene dimensions, padding, grid type/size/distance/units;
- optional foreground/overlay assets;
- notes for settlements and named features;
- map regions or drawings where the chosen Foundry version supports them;
- a manifest recording exporter and target Foundry versions;
- an import module or documented import macro if direct portable scene import is not stable.

Regional maps generally do not need walls or lighting; keep those for future city/building/dungeon exporters. Maintain one adapter per supported major Foundry version and validate fixtures against that version's public Scene schema.

## 15. Extension and plugin strategy

Design for extension now, stabilize it later.

### 15.1 Internal extension points

All built-in generators implement the same traits and manifests intended for extensions. Conceptually:

```rust
trait Generator {
    fn manifest(&self) -> GeneratorManifest;
    fn plan(&self, context: &ReadContext, target: Target) -> GenerationPlan;
    fn generate(&self, context: &GenerationContext, plan: &GenerationPlan)
        -> Result<GenerationPatch, GenerationError>;
}
```

`GenerationPatch` is validated and applied transactionally. A generator never writes directly to SQLite, accesses the UI, or obtains unrestricted filesystem/network access.

### 15.2 External plugins

Rust does not have a stable native ABI, so do not load arbitrary dynamic Rust libraries. The first external plugin system should use a versioned manifest and a child-process protocol over stdin/stdout with JSON or MessagePack:

- the host sends a bounded context and deterministic seed service;
- the plugin returns a proposed patch and diagnostics;
- schemas and capabilities are negotiated;
- timeouts, cancellation, and output limits are enforced;
- plugins are offline and denied undeclared file access by policy;
- incompatible protocol versions fail clearly.

If untrusted third-party plugins become important, evaluate WASI/Wasmtime later. For personal development, an out-of-process protocol is simpler to debug and does not lock the project into a native ABI.

### 15.3 Compatibility policy

- Built-in trait APIs may evolve until the MVP is stable.
- The first public protocol is versioned independently from the application.
- Presets and style packs declare schema versions.
- Unknown fields are preserved where practical; unknown required capabilities are rejected.
- Plugins cannot invent unregistered entity kinds without supplying schema, validation, bounds, and render adapters.

## 16. Clean and maintainable code rules

These rules should be enforced in review and CI:

1. **Domain first.** UI widgets, SQL rows, SVG nodes, and Foundry documents never masquerade as domain entities.
2. **One source of truth.** Geographic rules live in Rust. TypeScript does not reimplement them.
3. **No hidden randomness.** Every randomized function takes an explicit deterministic context or RNG.
4. **No hidden units.** Use typed wrappers such as `WorldKm`, `MapPoint`, `ScreenPx`, `PrintPt`, and explicit transforms.
5. **Stable identity over array position.** References use typed entity IDs; names are editable labels, not keys.
6. **Pure generators where possible.** Inputs produce a patch plus diagnostics. Database writes and orchestration happen outside the algorithm.
7. **Validate at boundaries.** Validate plugin data, persisted records, geometry, IPC messages, and export settings before use.
8. **User edits are sacred.** Regeneration may not overwrite a lock or constraint without explicit authorization.
9. **Version behavior.** Changing generated output for the same inputs requires a generator-version change and migration story.
10. **Dependency direction is enforced.** Core crates never depend on application or adapter crates.
11. **Typed errors in libraries.** Do not panic on user data. Reserve panics for violated internal invariants and test them.
12. **Instrumentation is part of the feature.** Every stage reports timing, seed namespace, dirty bounds, warnings, and cache outcome.
13. **Prefer boring data formats.** Versioned SQLite plus JSON/schema contracts are easier to inspect and migrate than opaque object graphs.
14. **Keep unsafe Rust absent by default.** Any future `unsafe` block requires an isolated module, safety explanation, and tests.
15. **Document decisions.** Record architecture decision records for coordinate precision, RNG, persistence, rendering, and plugin compatibility.
16. **No premature microservices.** This is one offline application with libraries and process adapters, not a distributed system.
17. **Avoid framework leakage.** Tauri commands call application services; Tauri types do not cross into the engine.
18. **Review dependency health and licenses.** Prefer maintained, permissively licensed libraries and keep a generated attribution report.

### 16.1 Definition of done for a generator

A generator is not complete until it has:

- a manifest, parameter schema, and version;
- deterministic seed namespaces;
- documented inputs, outputs, and invalidation edges;
- validation and actionable diagnostics;
- unit/property tests and at least one fixed-seed fixture;
- cancellation/progress behavior where costly;
- a coarse-preview strategy;
- persistence round-trip tests;
- visual examples for any rendered output.

## 17. Testing strategy

### 17.1 Unit and property tests

Use ordinary unit tests for seed derivation, transforms, migrations, and scoring. Use property-based tests (`proptest`) for geometry and world invariants:

- coast polygons are valid and consistently wound;
- land and water do not overlap improperly;
- river paths terminate correctly and follow drainage;
- forest glyphs lie inside allowed regions;
- roads avoid impassable areas unless a crossing entity exists;
- serialized worlds reopen equivalently;
- regeneration of entity A cannot change unrelated entity B.

### 17.2 Determinism tests

For a matrix of fixed seeds and presets, hash canonical semantic outputs and canonical SVG. Run the matrix on macOS ARM64 and Linux. Normalize timestamps, metadata, float serialization, XML attribute ordering, and ZIP entry ordering before hashing.

Test determinism under different thread counts. Any mismatch blocks parallelization of that stage.

### 17.3 Visual regression

Render small standardized maps to PNG and compare perceptual differences within reviewed tolerances. Keep semantic hashes separate from visual snapshots so an intentional style update does not look like a geography regression.

### 17.4 Integration and recovery

Test complete CLI workflows, interrupted generation, cancellation, failed plugins, corrupt cache recovery, migration from every schema fixture, exports at extreme sizes, and round-tripping an edited world.

## 18. Performance plan

Set budgets only after the vertical slice provides measurements, but design around these principles:

- store dense continuous phenomena as tiled numeric fields, not millions of entities;
- store meaningful features such as rivers and forests as vector entities;
- use R-trees for spatial lookup and a graph for dependency lookup;
- cache by content hash and keep caches disposable;
- compute previews at reduced resolution;
- batch repeated vector symbols and strokes;
- stream or tile high-resolution raster exports;
- parallelize only independent deterministic work;
- set memory budgets for field tiles and preview layers;
- include a diagnostic view showing stage time, cache hits, entity count, and dirty region.

Avoid GPU compute in the first implementation. CPU generation is easier to reproduce on a headless server. Use GPU/WebGL only for viewport rendering if profiling justifies it.

## 19. Development roadmap

Each phase ends in a usable vertical capability rather than a collection of unfinished subsystems.

### Phase 0: Risk spikes

- Prove a Rust core can return a vector scene to Tauri and the CLI.
- Render the same seeded scene to SVG, PNG, and PDF on macOS ARM64 and Linux.
- Test geometry boolean/simplification behavior on adversarial coastlines.
- Confirm bundled SQLite with R*Tree on target platforms.
- Produce one minimal Foundry package against a declared target version.
- Measure IPC cost for coarse scene updates.

**Exit:** documented choices for geometry precision, scene representation, IPC payloads, and export pipeline.

### Phase 1: Deterministic world kernel

- Define typed IDs, units, coordinate transforms, entity/aspect records, seed derivation, generator API, dependency graph, and diagnostics.
- Implement SQLite persistence, migrations, transactions, locks/constraints, and CLI save/load/validate.
- Add determinism and isolation tests.

**Exit:** regenerating one mock entity leaves every unrelated entity byte-for-byte unchanged.

### Phase 2: Terrain-to-coast vertical slice

- Generate elevation, land/water, coastline, and islands.
- Implement canonical scene, one ink style, SVG/raster/PDF export, pan/zoom/select, and basic parameter controls.
- Add coarse previews and background cancellation.

**Exit:** attractive printable seeded landmass maps can be saved and reopened unchanged.

### Phase 3: Hydrology, climate, and biomes

- Add climate fields, watershed flow, rivers, lakes, biome regions, validation, and warnings.
- Add the reusable boundary/path constraint engine, initially exercised by coastlines, lakes, biomes, forests, and rivers, with dependency-impact previews.

**Exit:** generated rivers are explainably related to terrain, and constrained edits recompute locally.

### Phase 4: Procedural visual assets

- Add asset manifests and vector generators for mountains, evergreen/deciduous trees, marsh, waves, and terrain marks.
- Add forest regions, density fields, seeded placement, level of detail, and appearance-only regeneration.

**Exit:** one selected forest's trees can be redesigned without altering its boundary or any other forest.

### Phase 5: Settlements, roads, labels, and layout

- Add suitability-based settlements, terrain-aware road networks, procedural settlement symbols, labels, legend, compass, scale, and border.
- Add pinning and warnings for conflicts.

**Exit:** the application produces a complete, legible regional fantasy map with believable relationships.

### Phase 6: Editing, recovery, and export hardening

- Complete reusable region/path tools, shared-border topology, undo/redo, autosave, crash recovery, large exports, print layouts, and versioned Foundry export.
- Test cross-platform packages and old-world migrations.

**Exit:** the regional MVP meets the acceptance criteria below.

### Phase 7: Extension and scale hierarchy

- Publish internal generator/style manifests and the first versioned out-of-process plugin protocol.
- Implement child-map footprints, context contracts, portals, transforms, and conflict reporting.
- Prototype one city generator only after regional context is proven stable.

## 20. Regional MVP acceptance criteria

The MVP is ready when all of the following are true:

- A seed and preset produce the same canonical world on supported macOS and Linux builds for a recorded engine version.
- The saved world reopens without automatic regeneration or visual drift.
- A user can regenerate one forest's appearance without changing any other forest or semantic geography.
- A user can edit closed regions and open paths—including a coastline, river, lake, biome, and forest—preview affected dependents, commit, undo, and redo the edit.
- Shared boundaries are represented once: moving a future city-district or territory border updates both adjacent regions without gaps or overlaps.
- Every river passes defined hydrology validation or displays a specific unresolved warning.
- The map remains responsive through coarse previews while full generation is cancellable.
- SVG, PDF, and PNG exports visually agree at declared scale and page settings.
- JPEG export handles background/transparency explicitly.
- A supported Foundry version can import the exported regional scene at the correct physical/grid scale.
- The CLI can create, generate, validate, and export a world without a graphical session.
- Schema migration, deterministic isolation, geometry properties, and visual regressions run in CI.
- The project can add a new built-in terrain motif or generator without modifying the UI, persistence schema, and every exporter.

## 21. Principal risks and mitigations

| Risk | Mitigation |
|---|---|
| Believable simulation produces unattractive compositions | Keep semantic simulation separate from a style/layout pass; provide presets and bounded artistic relaxation that cannot violate topology |
| Geometry operations fail on noisy contours | Quantize, simplify carefully, validate/repair after every boundary operation, and maintain adversarial fixtures |
| Small edits trigger whole-map regeneration | Aspect-level dependency edges, dirty bounds, tiled fields, and transaction planning |
| Determinism breaks across platforms or threads | Explicit RNG streams, stable ordering, quantization, versioned algorithms, cross-platform golden tests |
| SVG becomes enormous with vegetation | LOD, symbol reuse, path batching, clip groups, and rasterized texture layers only when necessary |
| Tauri IPC becomes a bottleneck | Send coarse scene/tile updates and commands, not per-point chatter; profile during Phase 0 |
| Webview rendering differs by OS | Treat the Rust export renderer as authoritative; visual preview may be approximate |
| Foundry schemas change | Versioned export adapters and fixtures; no Foundry types in the domain |
| Plugin API freezes bad abstractions | Use common internal traits early but delay public compatibility promises; process boundary instead of Rust ABI |
| User edits are lost during upgrades/regeneration | Constraints and locks are authoritative, changes are transactionally previewed, old outputs remain materialized |
| Scope expands into a world simulator | Hold the MVP to regional cartography; add simulation only when it improves visible believability or child-map continuity |

## 22. Decisions to make during the spikes

These are implementation questions, not blockers for the overall architecture:

- exact quantization precision and whether persisted geometry uses scaled integers or canonical floating-point arrays;
- whether raster simulation tiles are persisted or always cached/rebuilt;
- the canonical in-memory scene representation and best IPC encoding;
- the first supported Linux distributions and architectures;
- the initial target Foundry major version at implementation time;
- which font license and bundled hand-lettered font best fit the chosen style;
- whether PDF font text should remain selectable or be converted to paths by default;
- the performance threshold that would justify PixiJS/WebGL preview rendering;
- the stable boundary between built-in generators and the public extension protocol.

## 23. Current technical references

These links support the recommended stack as of this plan; exact versions should be evaluated and locked during Phase 0:

- [Tauri architecture](https://v2.tauri.app/concept/architecture/) and [platform prerequisites](https://v2.tauri.app/start/prerequisites/)
- [`geo` planar geometry and algorithms](https://docs.rs/geo/latest/geo/)
- [`rand_chacha` deterministic random streams](https://docs.rs/rand_chacha/latest/rand_chacha/)
- [`noise` procedural fields](https://docs.rs/noise/latest/noise/)
- [SQLite R*Tree spatial indexes](https://www.sqlite.org/rtree.html)
- [`resvg` SVG rendering](https://docs.rs/resvg/latest/resvg/)
- [`svg2pdf` vector-preserving PDF conversion](https://docs.rs/svg2pdf/latest/svg2pdf/)
- [Foundry VTT Scene API](https://foundryvtt.com/api/classes/foundry.documents.Scene.html)

## 24. Final architectural position

The project should be a **world-generation engine with a map editor attached**, not a painting application with random brushes. Rust provides the authoritative, deterministic engine and portable headless operation. Tauri/Svelte provides the productive desktop experience. A semantic world model, explicit user constraints, aspect-scoped seeds, and a dependency graph make selective regeneration possible. A renderer-neutral vector scene makes the hand-drawn style and all required export formats consistent. Finally, parent/child transforms and context contracts preserve the path from regional maps to geometry-aware cities, buildings, and dungeons without forcing those larger scopes into the first release.
