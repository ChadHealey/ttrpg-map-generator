# ADR-0022 — Milestone 3 World Physical-Context Contract

- **Status:** Accepted
- **Date:** 2026-08-29
- **Decision owners:** Project maintainers
- **Supersedes:** None
- **Superseded by:** None
- **Resolves:** [Issue #127](https://github.com/ChadHealey/ttrpg-map-generator/issues/127)

## Context

Milestone 2 accepts a projection-neutral, planet-native world surface on the fixed
`world-atlas-full-v1` lattice. Milestone 3 needs to expose terrain, climate, ecology,
and major hydrology as exact inherited context for a regional child. The context must
remain deterministic at the seam and poles, survive save/load without invoking a
generator, and be clip-able to a footprint without reaching into generator internals.

This decision extends the accepted M2 aspect vocabulary; it does not implement the
generators, persistence DTOs, renderer, or regional simulation. The governing evidence
is [the M2 atlas-proof contract](../milestone-2-atlas-proof.md), [the project plan's
world pipeline and context contract](../PROJECT_PLAN.md#81-whole-world-pipeline),
[ADR-0005](0005-planet-and-regional-coordinate-contract.md),
[ADR-0006](0006-seed-derivation-and-deterministic-streams.md), and
[ADR-0009](0009-spherical-fields-and-quantized-contours.md).

## Decision drivers

- Preserve M2's exact planet-native lattice, horizontal wrap, canonical poles, and fixed-point rules.
- Make every field and meaningful feature independently versioned, owned, seeded, validated, and stale-able.
- Provide useful boundary conditions at atlas scale without attempting plate tectonics, general circulation, or regional-scale simulation.
- Permit bounded footprint clipping and adjacent-child continuity from persisted accepted state.
- Keep the existing project-owned sample-reader seam and canonical JSON persistence decision until representative M3 projects prove a new storage boundary is necessary.

## Repository evidence

| Evidence                                                                                                                                                                  | Consequence for this contract                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `MacroElevationField` already uses `world-atlas-full-v1`, canonical south-pole/row/north-pole traversal, and `2^24` signed fixed-point ticks.                             | Continuous M3 fields use the same profile and traversal, with a field-specific version and quantized component policy.           |
| `AtlasSampleReader` hides backing arrays and already has compact full-profile readers.                                                                                    | Numeric fields are exposed through project-owned readers; implementations may pack storage without changing the domain boundary. |
| M2 owns land/water, stable landmass/water-body IDs, and canonical coastline geometry, but explicitly emits no climate, mountains, hydrology, lakes, or inherited context. | M3 consumes those accepted aspects and adds only the missing physical-context aspects.                                           |
| M2 aspect definitions use stable owner-scoped IDs, `map/entity` seeds, direct dependency kinds, behavior versions, and first-invalidated controls.                        | M3 records follow the same aspect metadata and dependency-DAG policy.                                                            |
| The project plan requires tiled or multiresolution numeric fields when appropriate and vector entities for meaningful features.                                           | Broad scalar/vector phenomena are split accordingly: fields for continuous values, records for ridges and hydrologic features.   |
| Persistence currently starts with canonical JSON and reserves `data/` for authoritative chunks; ADR-0018 already establishes compact in-memory full-profile storage.      | No binary persistence format is selected by this discovery. A measured storage spike remains the explicit trigger for one.       |

## Representations and canonical policies

### Shared field domain

Every continuous or categorical atlas field is anchored to the accepted full-profile
lattice. Its record contains:

- `fieldKind`, owner aspect ID, source aspect IDs, and a field behavior version;
- `samplingProfileId`, sampling-policy version, longitude/latitude dimensions, and canonical traversal;
- a declared value encoding and quantization scale, with no implicit unit conversion;
- a deterministic field fingerprint over canonical values and provenance.

Continuous values use signed fixed-point integers. Normalized scalar fields use the
existing `[-1, 1]` / `2^24` policy unless the field row below declares a more useful
physical range. Vector fields store two independently quantized tangent-plane-free
planet-native components in a declared basis; they never store display-projection x/y.
Categorical fields store stable class keys per anchor, not display names or array indexes.

The full field may be evaluated at a coarser disposable profile for preview, but an
accepted M3 record names the exact source profile and cannot substitute preview values.
Clipping for inherited context selects a footprint plus a padded collar and preserves
the source field fingerprint, profile, transform, and boundary samples. It does not
re-sample into a new authoritative field.

### Stable identity

Singleton fields and field-derived classification aspects use the owning world-surface
entity and a semantic key. Meaningful vector features use a semantic key containing
feature kind and a canonical quantized root-coordinate signature; it is not derived from
display name, traversal order, array position, or a renderer path. A feature that no
longer exists after an explicit regeneration may receive a new ID; save/load and reorder
must not change an existing accepted ID. Child context references opaque source IDs.

All accepted records are ordered by stable ID (and, where a graph requires it, by a
separate explicit semantic key). Stable ordering is serialization policy, not identity.

## Required M3 records

The following table is the complete physical-context contract for the M3 world map. Every
row is an accepted aspect or an entity-owned record with the stated minimum invariant.

| Output / owner                                                       | Representation and stable identity policy                                                                                                                                                                                                                                                                                                           | Direct dependencies                                                                                                           | Versions and quantization                                                                                                                                    | Minimum invariant                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `worldTerrain.mountainSystems` / world-surface singleton             | Vector ridge-system records. Each system contains one or more closed-or-ended planet-native centerlines, quantized influence width, elevation/prominence envelope, and boundary portals. ID = `mountain-system/<canonical root signature>`. A derived normalized ridge-influence field may be cached, but is not a second accepted mountain entity. | `worldTerrain.macroElevation`; M2 land/water classification; M3 `worldTerrain.uplift` only if added by #134                   | Aspect behavior 1, ridge geometry 1, centerline points in ADR-0005 planet ticks, widths/elevations in typed millimeters/meters or declared normalized ticks. | Centerlines are valid planet-native polylines, remain on land except at explicit crossings, have deterministic endpoint/portal order, and do not self-intersect after quantization.                                                                 |
| `worldClimate.temperature` / world-surface singleton                 | Quantized scalar field on the full profile, plus min/max envelope metadata for clipping. Values are signed fixed-point degrees Celsius in `0.1°C` ticks with an explicit accepted range.                                                                                                                                                            | Latitude/planet coordinate; M2 macro elevation; M2 coastline/water bodies; M3 mountain systems only for lapse-rate adjustment | Aspect behavior 1, field encoding 1, `0.1°C` quantum, canonical full-profile traversal.                                                                      | Every anchor has a finite in-range value; seam-identical anchors and the one-pole anchors agree exactly; a clipped envelope contains all clipped samples.                                                                                           |
| `worldClimate.prevailingWinds` / world-surface singleton             | Quantized vector field with eastward and northward planet-native components plus a calm flag derived from the component magnitude. No projection-space arrows are authoritative.                                                                                                                                                                    | Latitude/planet coordinate; temperature; M2 coastline/water bodies; M3 mountain systems                                       | Aspect behavior 1, vector encoding 1, components in signed normalized `2^24` ticks, canonical full-profile traversal.                                        | Components are finite and bounded; calm is true only below the declared threshold; seam and pole basis conversion is deterministic; no vector points into an undefined pole direction.                                                              |
| `worldClimate.moisture` / world-surface singleton                    | Quantized normalized scalar field plus source/influence summary metadata for context inspection.                                                                                                                                                                                                                                                    | M2 water bodies/coastline; prevailing winds; mountain systems; temperature                                                    | Aspect behavior 1, field encoding 1, normalized `2^24` ticks in `[0, 1]`.                                                                                    | Values stay in `[0, 1]`; seam/pole samples are canonical; the field records enough provenance to distinguish coastal, windward, and rain-shadow inputs without storing renderer data.                                                               |
| `worldClimate.zones` / world-surface singleton                       | Categorical climate-zone field and versioned class definitions. Class keys are semantic (`tropical`, `arid`, etc.); definitions carry ordered threshold bands and do not use display names as identity.                                                                                                                                             | Temperature; moisture; M2 latitude and land/water classification                                                              | Aspect behavior 1, classification policy 1, class keys are canonical strings; no floating thresholds in accepted output.                                     | Every land anchor has exactly one zone; water anchors are either explicitly `water` or omitted by a documented mask; classification is deterministic from the cited fields and policy.                                                              |
| `worldEcology.biomeBelts` / world-surface singleton                  | Categorical biome field with stable biome definitions and canonical land-connected belt/polygon summaries for clipping and visual inspection. Belt IDs use biome key plus canonical root signature.                                                                                                                                                 | Climate zones; moisture; temperature; M2 macro elevation/landmass classification                                              | Aspect behavior 1, classification policy 1, field keys canonical; polygon points use planet ticks and the M2 quantization policy.                            | Land anchors have exactly one compatible biome; belt summaries are closed or explicitly boundary-clipped, non-self-intersecting, and agree with the categorical field at sampled anchors.                                                           |
| `worldHydrology.watersheds` / world-surface singleton                | Directed watershed graph: basin entities own catchment summaries, divide polylines, outlet IDs, and boundary portals; a categorical basin-assignment field is authoritative for anchor ownership. Basin ID = `watershed/<canonical outlet/root signature>`.                                                                                         | M2 macro elevation and land/water; mountain systems; moisture                                                                 | Aspect behavior 1, graph policy 1, basin field uses canonical categorical keys, divides use planet ticks.                                                    | Each land anchor belongs to exactly one basin or explicit endorheic basin; the outlet graph has no cycles; divides do not cross improperly; every outlet is on a valid downstream edge or boundary portal.                                          |
| `worldHydrology.majorRivers` / river entities owned by world-surface | Directed vector drainage graph. A river has ordered centerline points, source/outlet references, discharge/width samples, watershed ID, and boundary portals. River ID = `river/<canonical head-and-outlet signature>`.                                                                                                                             | Watersheds; M2 coastline/water bodies; macro elevation; moisture; temperature only if used in runoff policy                   | Aspect behavior 1, graph policy 1, centerlines in planet ticks, discharge/width in typed SI units with declared quanta.                                      | Every river has a valid head and sink/portal; joins reference existing rivers; no improper crossings; downstream width does not decrease except at a declared lake/outlet policy; water endpoints terminate in accepted water or a boundary portal. |
| `worldHydrology.majorLakes` / lake entities owned by world-surface   | Canonical planet-native closed rings with outlet references, basin/watershed ID, depth/elevation envelope, and source links. Lake ID = `lake/<canonical basin-and-ring signature>`.                                                                                                                                                                 | Watersheds; macro elevation; M2 land/water/coastline; major rivers where outlets exist                                        | Aspect behavior 1, lake geometry 1, ring points use planet ticks, scalar metadata uses declared SI quanta.                                                   | Rings are closed, non-self-intersecting, valid on the planet topology, contained in land, and do not overlap; an outlet is absent only for an explicit endorheic lake; river/lake portals agree in both directions.                                 |

`worldTerrain.uplift` is not a required independent accepted output in this decision.
Mountain generation may use an internal deterministic uplift intermediate, but #134 must
not persist it as a second authoritative aspect unless evidence shows that regional
handoff or selective invalidation needs it. If it becomes required, stop #134 and split a
contract amendment before implementation.

## Aspect dependency and controls

The proposed M3 DAG extends the M2 roots as follows:

```text
worldTerrain.macroElevation + M2 land/water/coast/water-body records
  -> worldTerrain.mountainSystems
  -> worldClimate.temperature
  -> worldClimate.prevailingWinds
  -> worldClimate.moisture
  -> worldClimate.zones
  -> worldEcology.biomeBelts
  -> worldHydrology.watersheds
  -> worldHydrology.majorRivers
  -> worldHydrology.majorLakes
```

The implementation contract must record direct dependencies by opaque aspect ID, not by
the descriptive names in this ADR. Hydrology may depend directly on temperature only if
the selected runoff policy uses it; otherwise it must not acquire an undeclared edge.
Climate zones and biome belts consume accepted fields, never generator working state.

M3 adds two atlas-scale controls to the existing M2 controls:

| Control            | Unit and bounded meaning                                                                                                        | First invalidated aspect       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Mountain character | versioned enum such as `low`, `varied`, `rugged`; controls broad ridge prominence, not raw noise                                | `worldTerrain.mountainSystems` |
| Climate character  | versioned enum such as `temperate`, `varied`, `extreme`; controls broad temperature/moisture realization within physical bounds | `worldClimate.temperature`     |

Exact enum values, numeric ranges, and parameter-schema details belong to #131. They must
be accepted controls with stable defaults and must not expose noise frequencies. A control
change proposes a complete dependency-closed patch and cannot replace accepted state until
all rows' invariants pass. A parent edit marks child context stale; it never rewrites the
accepted child automatically.

## Persistence decision

No new chunked or binary persistence format is required by this discovery. M3 continues
the existing canonical-JSON package decision: field metadata, feature records, provenance,
checksums, and context snapshots are authoritative JSON records, while the project-owned
sample-reader boundary permits compact typed storage during generation and in-memory
accepted state. A future `data/` chunk is allowed by the existing package shape, but no
M3 child may invent its bytes, checksum semantics, or migration policy implicitly.

This is a bounded decision, not a claim that full-profile JSON arrays are efficient for
all future projects. Before #138 integrates accepted full-profile fields, a representative
serialization measurement must record package size, load/save time, peak memory, and
checksum behavior. If canonical JSON exceeds the repository's existing practical budget,
stop #138 and split a storage-format discovery issue. That issue must compare a versioned
binary chunk against canonical JSON and define migration/recovery before production use.

## Ordered implementation-child plan

The existing children of tracking issue #13 remain the implementation plan, in this order:

1. **#131 — Add versioned world physical-context contracts.** Owns the core records,
   aspect catalogue, controls, IDs, quantization, validation DTOs, and context clipping
   types. It crosses core and generation contracts only. Stop if a field needs a new
   persisted storage boundary; split the storage discovery described above.
2. **#134 — Generate deterministic broad mountain systems.** Owns mountain fields,
   ridge records, and their invariants. It crosses generation and core records only.
   Stop if uplift must become an accepted independent aspect.
3. **#135 — Generate temperature and prevailing-wind fields.** Owns the two climate
   fields and their seam/pole evidence. It crosses generation and core records only.
4. **#136 — Generate moisture, climate zones, and biome belts.** Owns those dependent
   fields/classifications and their evidence. It crosses generation and core records only.
5. **#137 — Generate major watersheds, rivers, and lakes.** Owns the hydrology graph,
   vector features, portal rules, and invariant diagnostics. It crosses generation and
   core records only. Stop if lake/river topology requires a new geometry dependency.
6. **#138 — Integrate physical aspects into accepted atlas state.** Owns document
   ownership, dependency invalidation, persistence, and context clipping. It crosses
   core and persistence boundaries only; it does not redesign generators.
7. **#139 — Render and visually verify world physical layers.** Owns renderer-neutral
   scene adapters, atlas presentation, and the reviewed gallery. It crosses render and
   desktop presentation boundaries only; it does not change authoritative records.

Each child must remain within its stated two major boundaries. A child stops and returns
for re-scoping when it introduces a third boundary, needs an undeclared accepted aspect,
changes the planet-native quantization or identity grammar, requires a new dependency,
or cannot prove seam/pole/footprint continuity with the selected representation.

## Compatibility and migration

- **Accepted world documents:** M2 documents remain valid and contain no M3 physical-context records. Loading them must not invoke M3 generators.
- **Persisted schemas and migrations:** No schema change is selected by this discovery. #138 adds explicit versioned records and migrations only when its child is ready.
- **Generator, seed, parameter, context, or style versions:** Each M3 aspect starts at behavior/version `1`, parameter schema `1`, and its own M2-compatible `map/entity` seed scope. Context snapshots record the source aspect versions and a checksum.
- **Canonical semantic/SVG/visual fixtures:** No fixture bytes change in this discovery. M3 children add focused seam, pole, clipping, and paired-context fixtures.
- **macOS and Linux determinism:** The same fixed-point values, canonical traversal, stable ordering, and project-owned readers are required on both platforms.
- **Parent and child maps:** The world map owns these records. A regional child receives a persisted clipped snapshot with collar, portals, lineage, versions, and checksum; it never reads the world generator directly.

## Validation

The contract is proven incrementally:

- #131 validates record schemas, stable ordering, quantization, dependency metadata, and context clipping against M2 seam/pole fixtures.
- #134–#137 run fixed-seed matrices and property checks for field bounds, exact seam/pole agreement, graph validity, topology, and deterministic reruns.
- #138 proves save/load without generation, accepted-state immutability, stale-context checks, and adjacent-footprint portal agreement.
- #139 reviews a representative gallery containing varied climate, rugged/low mountain, sparse/dense moisture, seam, near-pole, and paired world/footprint views.
- Before #138, the storage measurement described above decides whether canonical JSON remains sufficient; it does not silently introduce binary chunks.

## Revisit conditions

Reopen this ADR if a representative M3 field cannot be represented on the M2 lattice,
if a required invariant needs a new coordinate space or geometry dependency, if full
accepted fields exceed the measured canonical-JSON budget, if adjacent children cannot
agree from a shared collar/root-coordinate namespace, or if the M3 visible exit requires
an authoritative output omitted from the table.
