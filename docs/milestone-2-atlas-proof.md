# Milestone 2 whole-world atlas-proof contract

This document is the normative composition, isolation, evidence, and visible-workflow contract
for the [Milestone 2 whole-world atlas postcard](PROJECT_PLAN.md#milestone-2--whole-world-atlas-postcard).
It resolves [issue #55](https://github.com/ChadHealey/ttrpg-map-generator/issues/55) for the
geography, coastline, rendering, persistence, export, interface, and end-to-end work that
follows.

Milestone 2 proves one attractive, deterministic whole-world atlas. It is the first geographic
proof, but it is not the final regeneration interface. Later milestones may expose one
entity/aspect, one feature with its declared dependents, or a selected region. The aspect
boundaries below must not prevent operations such as rerolling one future `forest.boundary` or
rerolling its `forest.motifShapes` while preserving that boundary and every other forest.

> **Release status (2026-08-17):** The implementation candidate is release-pending. The
> [Milestone 2 release-evidence report](milestone-2-release-evidence.md) records local, packaged,
> visual, reference-hardware, CI, and issue-closeout status. That report does not alter this
> contract: the designated Apple M5/24-GB reference protocol and every other acceptance requirement
> below remain in force until their evidence is complete.

## Fixed proof composition

The proof contains one `WorldDocument`, its one root `WorldMap`, stable world-surface,
world-coastline, and atlas-presentation singleton entities, plus the generated semantic entities
below. It contains no `RegionalMap`. Singleton identities derive from the world-map ID and fixed
semantic keys; generated entity and aspect identities derive from stable owner identity and
canonical semantic keys, never traversal order or display names.

The `WorldMap` uses the authoritative spherical planet topology and quantization from
[ADR-0005](adr/0005-planet-and-regional-coordinate-contract.md). A display projection is versioned
metadata and never authoritative geography. The initial projection is the version-1
equirectangular display-tick and seam-splitting contract in
[ADR-0012](adr/0012-equirectangular-atlas-display-projection.md): it shows the complete world in a
rectangular postcard, handles both poles explicitly, and places its horizontal split at the
canonical longitude seam. The proof scene has a 2:1 logical extent independent of screen or export
resolution.

Accepted state consists of:

- validated atlas controls and the canonical unsigned-64 world seed;
- accepted instances of the nine generated-aspect kinds in this contract;
- stable landmass, island-group, and water-body entities and their relationships;
- canonical planet-native coastline geometry;
- accepted style choices and deterministic decorative state required to reopen without visual
  drift; and
- all owning IDs, aspect IDs, entity IDs, revisions, dependencies, generator/style/parameter
  versions, seed metadata, diagnostics, and locks or constraints when present.

Preview fields and contours, display-projected paths, styled render paths, `RenderScene` values,
Canvas state, hit-test indexes, raster tiles, thumbnails, progress, and export intermediates are
disposable. They are never the only copy of accepted user work.

## Milestone 2 semantic vocabulary

The individual landmass kinds are:

| Kind          | Meaning in this milestone                                                            |
| ------------- | ------------------------------------------------------------------------------------ |
| `continent`   | A connected landmass classified as continental at the accepted atlas scale.          |
| `majorIsland` | A connected non-continental landmass retained as an individually significant entity. |
| `island`      | A smaller connected landmass retained by the accepted atlas-scale threshold.         |

An individual landmass has exactly one of those kinds. Group relationships are separate so an
island does not acquire two incompatible kinds:

| Group kind    | Meaning in this milestone                                          |
| ------------- | ------------------------------------------------------------------ |
| `islandChain` | An ordered or elongated relationship among stable island entities. |
| `archipelago` | A clustered relationship among stable island entities.             |

An island-group entity references two or more stable `majorIsland` or `island` members. In
Milestone 2 the two group kinds are mutually exclusive and a member belongs to at most one group;
`islandChain` is ordered/elongated while `archipelago` is clustered rather than linear. Issue #59
owns the versioned numeric thresholds and deterministic tie-breaking that realize these meanings.

The generated water-body kinds are:

| Kind         | Meaning in this milestone                                                      |
| ------------ | ------------------------------------------------------------------------------ |
| `oceanBasin` | A primary open-ocean region, including the single global-ocean case.           |
| `sea`        | A marine-scale marginal or enclosed region retained by the accepted threshold. |

Connectivity and containment are explicit relationships, not names inferred by the renderer.
Accepted water regions form a non-overlapping segmented partition: every accepted water location
belongs to exactly one `oceanBasin` or `sea`. A marginal sea may be connected to an ocean basin
through a neck selected by a versioned enclosure rule; that connection is an edge in the marine
connectivity graph rather than proof that both regions are one entity. A qualifying atlas-scale
enclosed body may also be a `sea`; smaller enclosed water is suppressed or merged during the
proposed land/water classification before acceptance because Milestone 2 does not emit a semantic
lake.

Milestone 2 does not generate lakes, gulfs or bays, straits, climate, mountains, hydrology,
names, labels, inherited regional context, or regional geography. It creates no placeholder
aspects or entities for those later concerns.

## Authoritative aspect graph

The stable world-surface, world-coastline, and atlas-presentation singleton entities belong to
the root `WorldMap`. Each semantic feature owns its classification aspect. This per-entity
boundary is required for later feature-level rerolls; semantic geography is not hidden inside
one indivisible map-wide collection. Issue #57 defines the project-owned records and exact stable
IDs without changing this ownership boundary.

All initial behavior, parameter-schema, and style versions are `1`. Every aspect starts at
variant revision `0`. All use the ADR-0006 `map/entity` seed scope with their own owning map,
owning entity, generator ID, aspect name, and revision. A generator that makes no random draw
still records the scope and seed metadata; it does not borrow another aspect's stream.

| Aspect                                       | Generator ID                           | Owner                        | Direct dependencies                                                                                               | Additional version           | Accepted output and invalidation                                                                                                                                                                          |
| -------------------------------------------- | -------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `worldTerrain.macroElevation`                | `worldTerrain.macroElevation`          | world-surface singleton      | none                                                                                                              | field version 1              | Quantized macro elevation and field provenance. Invalidated by circumference, continent-count intent, continent distribution, fragmentation, island abundance, archipelago abundance, or polar character. |
| `worldSurface.landWaterClassification`       | `worldSurface.landWaterClassification` | world-surface singleton      | `worldTerrain.macroElevation`                                                                                     | classification version 1     | Accepted land/water partition and connectivity-support data. Invalidated by macro elevation, target water coverage, or ocean-connectivity intent.                                                         |
| `landmass.classification` [one per landmass] | `landmass.classification`              | stable landmass entity       | `worldSurface.landWaterClassification`                                                                            | classification version 1     | Exactly one landmass kind plus canonical component and containment data. Invalidated by land/water classification or classification-version change.                                                       |
| `islandGroup.classification` [one per group] | `islandGroup.classification`           | stable island-group entity   | `worldSurface.landWaterClassification` and member `landmass.classification` aspects                               | classification version 1     | Group kind, stable membership, and ordering where applicable. Invalidated by the partition, any member classification, or classification-version change.                                                  |
| `waterBody.classification` [one per body]    | `waterBody.classification`             | stable water-body entity     | `worldSurface.landWaterClassification` and relevant `landmass.classification` aspects                             | classification version 1     | Water-body kind, connectivity, adjacency, and containment. Invalidated by the partition, referenced landmass classification, or classification-version change.                                            |
| `worldCoastline.geometry`                    | `worldCoastline.geometry`              | world-coastline singleton    | `worldSurface.landWaterClassification`, all `landmass.classification`, and all `waterBody.classification` aspects | geometry version 1           | Quantized planet-native rings with stable source links and order. Invalidated by any direct dependency or geometry-version change; island grouping alone does not change physical coast.                  |
| `atlas.coastlineAppearance`                  | `atlas.coastlineAppearance`            | atlas-presentation singleton | `worldCoastline.geometry`                                                                                         | atlas style ID and version 1 | Accepted bounded ink decisions needed to reproduce pressure, width, and controlled imperfection from canonical geometry. Invalidated by canonical coastline or style-version change.                      |
| `atlas.waterDecoration`                      | `atlas.waterDecoration`                | atlas-presentation singleton | `worldSurface.landWaterClassification`, all `waterBody.classification`, and `worldCoastline.geometry`             | atlas style ID and version 1 | Accepted coastal echoes and water-mark placements with stable source links/order. Invalidated by any dependency or style-version change.                                                                  |
| `atlas.paperTreatment`                       | `atlas.paperTreatment`                 | atlas-presentation owner     | none                                                                                                              | atlas style version 1        | Accepted paper color/grain decisions and parameters, not raster pixels. Invalidated only by its own appearance reroll, parameters, generator version, or style version.                                   |

Dependencies are stored by opaque aspect ID; the names above are descriptive compatibility
labels, not references. The dependency DAG is acyclic:

```text
worldTerrain.macroElevation
└─ worldSurface.landWaterClassification
   ├─ landmass.classification [0..n]
   │  ├─ islandGroup.classification [0..n]
   │  ├─ waterBody.classification [0..n]
   │  └─ worldCoastline.geometry
   ├─ waterBody.classification [0..n]
   │  ├─ worldCoastline.geometry
   │  └─ atlas.waterDecoration
   ├─ worldCoastline.geometry
   │  ├─ atlas.coastlineAppearance
   │  └─ atlas.waterDecoration
   └─ atlas.waterDecoration

atlas.paperTreatment
```

Display projection and scene construction consume the accepted aspects but do not become accepted
aspects. `atlas.coastlineAppearance` stores projection-neutral ink decisions and
`atlas.waterDecoration` stores canonical planet anchors, source links, and projection-neutral
decoration decisions—not projected or styled paths. Deterministic scene construction applies
those accepted decisions after projection without invoking an appearance generator. Changing a
display projection therefore invalidates only disposable projected paths, scenes, and exports.
Changing an output-affecting generator, classifier, geometry algorithm, parameter meaning, style
behavior, or seed scope increments the smallest truthful compatibility version and never rewrites
already accepted output on load.

Style ID and style version are explicit typed provenance in each accepted `atlas.*` payload. They
do not masquerade as generator or parameter-schema versions. Issue #57 adds the smallest strict
record required to preserve that provenance; it does not add a public style/plugin system.

## Atlas controls

Controls are canonical accepted inputs. UI values use the units and enumerations below; worker,
persistence, and generator boundaries validate them without coercion. Percent values are integer
percentage points. A control change proposes regeneration and cannot replace the previous
accepted atlas until full-resolution validation and transactional commit succeed.

| Control                | Unit/values | Default        | Accepted range or values                              | Step   | First invalidated aspect               |
| ---------------------- | ----------- | -------------- | ----------------------------------------------------- | ------ | -------------------------------------- |
| World circumference    | km          | `40000`        | `10000..80000`                                        | `1000` | `worldTerrain.macroElevation`          |
| Target water coverage  | %           | `65`           | `45..80`                                              | `1`    | `worldSurface.landWaterClassification` |
| Continent-count intent | count       | `4`            | `1..8`                                                | `1`    | `worldTerrain.macroElevation`          |
| Continent distribution | enum        | `varied`       | `balanced`, `varied`, `oneDominant`                   | —      | `worldTerrain.macroElevation`          |
| Fragmentation          | %           | `35`           | `0..100`                                              | `1`    | `worldTerrain.macroElevation`          |
| Island abundance       | %           | `35`           | `0..100`                                              | `1`    | `worldTerrain.macroElevation`          |
| Archipelago abundance  | %           | `25`           | `0..100`                                              | `1`    | `worldTerrain.macroElevation`          |
| Ocean connectivity     | enum        | `singleGlobal` | `singleGlobal`, `connectedMajority`, `multipleBasins` | —      | `worldSurface.landWaterClassification` |
| Polar character        | enum        | `neutral`      | `oceanBiased`, `neutral`, `landBiased`                | —      | `worldTerrain.macroElevation`          |

Count and coverage values are documented intents, not permission to violate topology. Issue #58
defines measurable realization tolerances and reports a stable diagnostic when a valid result
cannot satisfy them. `oneDominant` affects relative continental area; it does not require every
other retained landmass to become an island. Island and archipelago abundance are independent so
the generator can produce isolated islands without forcing groups, or groups without filling the
atlas with unrelated islands.

Realization version 1 measures water coverage over the accepted full-profile anchors with fixed
integer-quantized spherical row weights. Its maximum absolute error is 25 basis points, where one
basis point is 0.01 percentage points. The shared preview anchors select the exact classification
threshold used by both profiles; a full result outside that tolerance returns
`atlas.land-water.water-coverage-unsatisfied` and no proposed full patch. Shared field ticks and
classification values have zero tolerance, the longitude seam has zero canonical-identity
tolerance, and each pole has exactly one sample.

Before #59, ocean intent may only prefer a transient sampled-component proxy among thresholds no
more than 10 basis points from target when such candidates exist. The proxy treats one sampled
water component as `singleGlobal`, at least two as `multipleBasins`, and a largest-component share
of at least 90% as `connectedMajority`. It never emits or proves semantic oceans, seas, landmasses,
or containment. Every result therefore reports
`atlas.land-water.ocean-connectivity-unverified`; an unmet proxy additionally reports
`atlas.land-water.ocean-connectivity-unsupported` without invalidating an otherwise valid
land/water partition.

Ocean-connectivity values have these exact outcome meanings under #59's versioned enclosure
policy:

- `singleGlobal` requires one qualifying open-marine graph component rooted at one ocean-basin
  entity; disconnected enclosed seas may remain and do not count as another ocean basin.
- `connectedMajority` requires the largest open-marine graph component to meet #58's versioned
  share of non-enclosed marine area; smaller qualifying ocean-basin components may remain.
- `multipleBasins` requires at least two qualifying disconnected graph components rooted at
  ocean-basin entities.

Marginal seas participate in their connected open-marine component but remain distinct semantic
regions. Enclosed seas are excluded from ocean-basin component counts and the connected-majority
area denominator. All seas still count toward total target water coverage.

Issue #59 realizes these meanings through semantic-classification policy version 1, recorded in
[ADR-0010](adr/0010-atlas-semantic-classification-and-identity.md). Components use the accepted
wrapped four-neighbor rows and single pole vertices. Integer spherical area uses the `2^20` row
weight scale already used by #58. A land component is a `continent` at 20% of retained land
weight, a non-continent is a `majorIsland` at 2%, and every remaining accepted component is an
`island`. The classifier does not edit or suppress #58 samples.

Open-marine clearance cores contain water farther than 16 accepted full-profile graph edges from
land. They distinguish basin roots and marginal seas without changing exact cell ownership:
`singleGlobal` and `connectedMajority` retain one basin root and connect marginal seas through
reciprocal neck edges, while `multipleBasins` requires at least two clearance cores separated at
that atlas-scale policy. Other raw water components are enclosed seas. Connected-majority retains
the #58 90% minimum over non-enclosed marine area.

Island grouping budgets
`floor(nonContinentalCount * archipelagoAbundancePercent / 100)` candidates by nearest spherical
centroid distance. A compact archipelago seed has at most 750 milliradians member separation;
island-chain neighbors have at most 1800 milliradians separation. A budget of at least four may
realize one compact archipelago and one disjoint ordered chain. Stable-ID ties resolve every
otherwise equal choice.

World circumference also owns the `WorldMap` coordinate-system radius. Issue #57 defines the
versioned circumference-to-radius calculation and ADR-0005 integer-millimeter quantization. A full
control acceptance atomically updates and validates the persisted circumference, derived radius,
coordinate record, and all invalidated aspects. A circumference edit is the only control edit
permitted to change that coordinate-system radius.

Changing the world seed is not an aspect reroll. It invalidates every generated aspect because
the seed is an input to every namespace. Changing only an appearance aspect's variant revision
does not alter the world seed or any geography parameter.

## Preview and acceptance boundary

The coarse preview is a deterministic, visibly labelled proposal. It uses the same validated
world seed, controls, generator behavior, parameter meanings, topology, and style meaning as full
generation, but uses a separately versioned preview-resolution profile in a disposable cache key.
Proof profile `world-atlas-preview-v1` has an effective 512 by 256 field workload; accepted profile
`world-atlas-full-v1` has an effective 2048 by 1024 workload. Sampling-policy version 1 is fixed by
[ADR-0009](adr/0009-spherical-fields-and-quantized-contours.md). A profile has `W` wrapped
longitude cells and `H` equiangular latitude bands. Interior anchors are exact ADR-0005 ticks at
`-pi + 2*pi*x/W` and `-pi/2 + pi*y/H`; each pole is one canonical anchor, the seam is the cell from
longitude index `W - 1` to `0`, and the polar bands are triangle fans. Canonical traversal is south
pole, interior rows south-to-north and west-to-east, north pole. Preview has 130,562 unique anchors,
full has 2,095,106, and preview address `(x, y)` maps to full `(4*x, 4*y)` with both poles mapped to
their one canonical full pole. An implementation may add, never omit, work required by its accepted
full profile. Profile IDs, effective dimensions, anchor policy, and sampling-policy version are
generator-parameter compatibility inputs.

Preview may omit geometry below its declared level of detail. Both profiles evaluate the same
pointwise behavior and reuse classification thresholds derived from the shared preview anchors. At
every declared preview anchor, normalized `2^-24` field ticks and land/water classification exactly
equal the corresponding full-profile evaluation: the numeric tolerance is zero ticks. The maximum
displacement for a retained disposable preview boundary is one preview-cell angular diagonal,
`sqrt(2) * pi / 256` radians. Preview simplification may not move a retained semantic boundary
outside that visual tolerance, invent a semantic entity, repair invalid full geography, relax
accepted full geometry, or change accepted records.

Preview output has no accepted aspect ID, accepted revision, `accepted` status, or authoritative
package path. The interface must not expose preview output as saveable accepted geography. An
**Accept full atlas** operation performs full-resolution generation from the accepted inputs,
validates the complete proposed patch, and commits it transactionally. It never promotes or
upsamples preview bytes. Scheduling, cancellation, or completion order of previews cannot change
the full proposal.

Cancellation or failure preserves the previous accepted document byte-for-byte, removes or
invalidates incomplete disposable output, and returns an actionable stable diagnostic. Progress
is monotonic within one operation and identifies its operation ID, stage, completed work, total
work when known, and whether cancellation has been requested.

## Required reroll operations

Both operations preview their change set before generation and commit one validated immutable
document patch. Locks and constraints remain materialized. If a proposed topology would delete or
invalidate a locked or constrained feature, the complete patch is rejected with a specific
conflict diagnostic until the user resolves it; the feature is never silently deleted, rewritten,
or left outside an otherwise accepted partition.

### Reroll geography

This operation increments only `worldTerrain.macroElevation.variantRevision`. It then regenerates
the selected aspect and all declared dependents in dependency order. Dependent revisions do not
increment merely because their accepted outputs are recomputed.

Permitted changes are:

- `worldTerrain.macroElevation` metadata and output;
- recomputed dependents' accepted outputs, dynamic dependency references, accepted diagnostics,
  and generation status;
- landmass, group, water-body, and coastline-ring/source identities only where the versioned
  stable-identity matching rules determine that the corresponding old feature no longer exists or
  a new feature exists; the stable singleton owners do not change; and
- `atlas.coastlineAppearance` and `atlas.waterDecoration` outputs derived from changed coastline,
  while their style parameters, style version, and variant revisions remain fixed.

The atlas-presentation owner, `atlas.paperTreatment` complete accepted record, style choices,
controls, world/map identities, world seed, constraints, locks, and unrelated records remain
canonically unchanged. Recomputed dependents retain their generator/parameter/style versions,
fixed parameters, seed scope, and variant revision. At least the selected macro output and one
canonical downstream geography output must differ, or the operation returns a stable
no-visible-alternative diagnostic and does not commit an indistinguishable reroll.

### Reroll appearance

This operation atomically increments the revisions of `atlas.coastlineAppearance`,
`atlas.waterDecoration`, and `atlas.paperTreatment`, derives independent streams for each new
revision, validates their combined proposal, and commits them together.

Every geography aspect record, every semantic entity and relationship, every canonical coastline
byte, all geography controls, the world seed, stable map identity/kind/scale, coordinate system,
extent, entity ownership, constraints, locks, and layout references remain canonically unchanged.
Containing map/package bytes and authoritative checksums may change only because they contain the
new appearance aspect records. The complete appearance set and rendered composite must differ;
otherwise the operation reports a stable no-visible-alternative diagnostic and leaves the
accepted document unchanged.

Milestone 2 need not expose a separate ink-only, decoration-only, or paper-only button. Its data
model and transaction boundary must still allow those aspect-addressed operations later without
schema replacement or a shared sequential random stream.

For example, a later `forest.motifShapes` reroll preserves `forest.boundary`,
`forest.motifPlacement`, other forests, and unrelated geography. If replacement shapes cannot
satisfy the preserved placement's fit or collision constraints, validation rejects the narrow
proposal and may offer **Feature and dependents**; it never silently moves the placements.

### Required transaction capability

The Milestone 1 single-aspect reroll command deliberately cannot represent initial geographic
creation or a changing topology. Issues #57 and #64 therefore add validated Milestone 2 proposal
modes and one document operation that can atomically:

- create the initial singleton and semantic entities and all accepted aspect instances;
- update accepted controls when the operation is control-driven rather than a reroll;
- add and remove generated semantic entities and their owned aspects;
- replace the selected aspect and any recomputed dependents in stable dependency order;
- update dynamic dependency references after entity membership changes;
- distinguish explicit reroll from dependency recomputation so only explicit targets increment
  variant revision while recomputed dependents retain their revision/seed and may receive declared
  dependency updates; a separate control-driven proposal mode may update declared parameters; and
- preflight locks, constraints, identity collisions, stale source revisions, and the complete
  proposed partition before any commit.

Validation failure, stale input, cancellation, or a lock conflict commits nothing. This operation
extends the existing immutable proposal/transaction model without weakening or reinterpreting the
released Milestone 1 reroll command and fixtures. It is not a general editor, undo system, or
permission for a generator to mutate the document.

## Registered fixture matrix

The matrix uses six planned registered fixture IDs because fixture-manifest version 1 owns exactly
one world seed. Every fixture owns the conventional
`fixed-seeds/<fixture-id>/fixture-runner.mjs`; those thin runner files may import one shared
implementation module, but a manifest never hides a seed array or a second case. All seeds are
canonical base-10 unsigned-64 strings. `milestone-2-atlas-proof` drives the complete visible
workflow; the other rows expand semantic, geometry, control, and visual coverage without
multiplying native workflow tests.

Values not shown are the defaults above.

| Fixture ID                             | World seed             | Non-default controls                                                                                                                                                                                                             | Required proof                                                                                                                         |
| -------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `milestone-2-atlas-proof`              | `81985529216486895`    | none                                                                                                                                                                                                                             | Default recognizable world; complete preview, accept, both rerolls, save/reopen, SVG, and PNG workflow.                                |
| `milestone-2-atlas-fragmented-islands` | `18364758544493064720` | water `70`, continent count `5`, fragmentation `90`, island abundance `95`, archipelago abundance `95`                                                                                                                           | Fragmented but coherent land, major islands, individual islands, an island chain, an archipelago, and retained channels.               |
| `milestone-2-atlas-connected-majority` | `1085102592571150095`  | water `60`, continent count `6`, distribution `balanced`, fragmentation `55`, island abundance `55`, archipelago abundance `50`, ocean connectivity `connectedMajority`                                                          | The largest marine component satisfies the versioned majority tolerance without being forced into the single-global-ocean mode.        |
| `milestone-2-atlas-seam-crossing`      | `12297829382473034410` | none                                                                                                                                                                                                                             | At least one retained landmass and canonical coastline ring cross the longitude seam while the default global ocean remains connected. |
| `milestone-2-atlas-control-min`        | `6148914691236517205`  | circumference `10000`, water `45`, continent count `1`, distribution `balanced`, fragmentation `0`, island abundance `0`, archipelago abundance `0`, polar character `landBiased`                                                | Declared numeric minima, a second distribution mode, coherent low-fragmentation behavior, and the land-biased polar mode.              |
| `milestone-2-atlas-control-max`        | `16045690984503098046` | circumference `80000`, water `80`, continent count `8`, distribution `oneDominant`, fragmentation `100`, island abundance `100`, archipelago abundance `100`, ocean connectivity `multipleBasins`, polar character `oceanBiased` | Declared numeric maxima, the remaining enum values, multiple basins, and bounded visually interpretable output.                        |

Before the fixture is registered, issues #56 through #64 may refine only the exact algorithmic
realization tolerances and prove that these fixed rows satisfy their required proof. They may not
replace an inconvenient seed silently. A required seed change updates this owning contract,
states why the old row could not represent the intended product behavior, and follows the normal
review process before generated evidence exists.

Each source definition records its fixed owner and aspect IDs, complete controls, seed, versions,
checkpoint revisions, assertions, and review purpose required by
[07 — Deterministic Fixture Conventions](07-fixture-conventions.md). A fixture is added to
`fixtures/registry.json` only with a working runner and complete first review record; placeholder
registry entries are forbidden. Registry entries and generated artifact paths remain sorted.

## Checkpoints and comparison boundary

`milestone-2-atlas-proof` has one disposable preview phase followed by these accepted checkpoints:

1. `baseline` — accepted full-resolution atlas at revision `0` for every aspect.
2. `geography-rerolled` — geography reroll committed from `baseline`.
3. `appearance-rerolled` — appearance reroll committed from `geography-rerolled`.
4. `reopened` — the saved `appearance-rerolled` package loaded with all generator entry points
   armed to fail if invoked.

Deterministic SVG and PNG are evidence at the accepted checkpoints, not additional document-state
checkpoints. The other five fixtures require `baseline` only.

Canonical aspect bytes mean the complete accepted record defined by the persistence serializer;
canonical output bytes mean only its accepted output. Semantic evidence is recorded separately
for every accepted aspect at `baseline`, `geography-rerolled`, and `appearance-rerolled`.
`reopened` compares decoded accepted bytes with `appearance-rerolled` rather than duplicating
identical semantic goldens.

| Transition                                   | Required equal evidence                                                                                                           | Required different evidence                                                                                                                                                                                      | Forbidden changes                                                                            |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| no atlas → `preview`                         | Existing accepted document, if any                                                                                                | Disposable preview only                                                                                                                                                                                          | Any accepted aspect, revision, entity, package checksum, or saved authoritative byte.        |
| `preview` → `baseline`                       | Seed, controls, owner IDs, style choice                                                                                           | New validated accepted aspects, semantic entities, scene, SVG, and PNG                                                                                                                                           | Promotion of preview bytes or accepted preview metadata.                                     |
| `baseline` → `geography-rerolled`            | Paper aspect; controls; seed; style parameters/version; document/map/singleton IDs; locks/constraints; every unselected revision  | Macro aspect/revision/output; downstream semantic and coastline outputs; owned feature-entity membership and ring/source IDs where topology changes; coastline-dependent scene, SVG, PNG, and appearance outputs | Paper output/revision, style revision, singleton identity, user intent, or ambient metadata. |
| `geography-rerolled` → `appearance-rerolled` | All geography aspect/output bytes, semantic entities, canonical coastline, geography controls, seed, ownership, locks/constraints | Three appearance aspect records/revisions/outputs; style/decorative scene nodes; SVG; PNG                                                                                                                        | Any semantic, canonical geometry, classification, or geography revision change.              |
| `appearance-rerolled` → saved package        | All accepted canonical aspect/output bytes                                                                                        | None required; the new package must validate and decode to the exact accepted state                                                                                                                              | Generator invocation, semantic/style output change, preview/cache promotion.                 |
| saved package → `reopened`                   | All accepted records, authoritative checksums, rebuilt scene semantics, canonical SVG, and deterministic PNG bytes                | Disposable cache identities may differ                                                                                                                                                                           | Any generator invocation, accepted drift, revision change, or visual drift.                  |
| `reopened` → export                          | Entire accepted document and scene semantics                                                                                      | New external SVG/PNG files only                                                                                                                                                                                  | Document mutation, generator invocation, renderer-side geography repair.                     |

Containing authoritative files and checksums are permitted to differ from packages written at an
earlier reroll checkpoint; save itself does not require an arbitrary byte difference. Repeated
generation from identical accepted inputs and versions is byte-identical at the canonical semantic
boundary. Repeated SVG export is byte-identical. Repeated PNG export is byte-identical under the
versioned `atlas-png-v1` encoder/profile contract; it contains no time, host, locale, or
nondeterministic encoder metadata. Semantic equality is never inferred from SVG or PNG equality.

`atlas-png-v1` export-profile version 1 supports exactly `1600 × 800`, `4096 × 2048`, and
`8192 × 4096` pixels; the desktop default and fixed release workload are `8192 × 4096`. It uses an
opaque paper background and a fixed PNG signature, 8-bit truecolor type-2 `IHDR`, rendering-intent-0
`sRGB`, consecutive `IDAT`, and `IEND` sequence. It emits no alpha, physical-size/DPI, time, host,
locale, text, or other ancillary chunk.

The production rasterizer scales then quantizes scene geometry to `1/256` output pixel and averages
four fixed binary-coverage samples at quarter-pixel offsets. Even-odd fills and capsule round
strokes replace opaque sample colors in scene painter order. It renders row-major full-width bands
with 64 core rows and an 8-pixel vertical halo, keeps exactly one expanded four-sample RGB band and
two RGB scanline buffers live, and never allocates a complete raster duplicate. At 8192 pixels wide
the largest live band is exactly `8192 × 80 × 12 = 7,864,320` bytes.

The first row uses PNG `Sub` filtering and later rows use `Up`. A project-owned zlib stream with
header `0x78 0x01` contains one final fixed-Huffman DEFLATE block. Greedy equal-byte runs restart at
each scanline and use only distance-1 matches of at most 258 bytes; canonical Adler-32 closes the
stream. Consecutive `IDAT` chunks partition that one stream into 1-MiB payloads without resetting it.
The complete raster, band, filter, compression, chunk, progress/cancellation, diagnostic, and native
atomic-commit compatibility boundary is fixed by
[ADR-0016](adr/0016-deterministic-whole-world-atlas-png-export.md). Changing any output byte is an
explicit PNG evidence and compatibility review.

`atlas-svg-v1` version 1 uses the fixed `0 0 2048 1024` scene viewBox and whole-millimetre 2:1
physical dimensions from `200 × 100 mm` through `1600 × 800 mm`; desktop export defaults to
`400 × 200 mm`. It serializes the complete normal-detail `AtlasRenderScene` in node/z-order with
stable element IDs, source entity/aspect links, sorted related-source links, versioned metadata,
six-decimal numeric formatting, and one stable user-space clip definition/reference. Font policy
`no-rendered-text-v1` rejects rendered text and embeds no font because Milestone 2 requires no
labels. Output above 32 MiB is rejected before destination commit. The validated UTF-8 bytes are
written through a same-directory temporary file, flushed, read back, atomically replaced, and read
back again without invoking a generator or changing the document. Stable diagnostics cover
unsupported scene/style versions, dimensions, fonts, source links, geometry, z-order, size,
cancellation, destination conflicts, fingerprints, and native I/O. The complete rationale and
compatibility boundary are recorded in
[ADR-0015](adr/0015-deterministic-whole-world-atlas-svg-export.md).

The other matrix rows require baseline semantic evidence and the focused classifications,
connectivity, containment, seam, control, and geometry assertions named above. Every fixture owns
a baseline canonical SVG and reviewed 1600 by 800 deterministic PNG produced by the production #67
export path. The 8192 by 4096 PNG is generated twice through that same path in a disposable
benchmark directory and is byte-compared, size-checked, and visually sampled; six large exports
are not checked into the gallery merely to prove their dimensions. Issue #68's review record or
retrospective retains each large export's SHA-256, encoder/profile version, dimensions, byte size,
reference environment, and explicit seam, pole, fine-ink, and tile-boundary crop-review result.

## Geometry and visual review goals

Every accepted matrix row validates closed, consistently wound, non-self-intersecting canonical
rings; correct nesting and source links; exact classification coverage; connectivity and
containment; stable identity/order; post-quantization validity; explicit pole behavior; and
continuity across the canonical seam. Narrow channels and retained islands may not disappear
during topology repair or scale simplification.

At the default controls, a reviewer should immediately perceive a small hierarchy of coherent
continental silhouettes, major islands, and surrounding ocean rather than noise-shaped blobs,
uniform confetti, or one accidental supercontinent. Fragmented and island-heavy cases remain
recognizably intentional at normal viewing size. The seam is not visible as a geographic or ink
artifact.

The initial style is restrained monochrome or limited-color ink on warm paper. Coastline wobble
and pressure variation add controlled imperfection without changing classification. Coastal echo
lines reinforce large coastal forms without filling narrow channels or competing with the primary
coastline. Water marks have clear hierarchy and do not become semantic features. Paper grain is
subtle at normal viewing size, has no visible tile repetition or seam, and does not reduce
land/water legibility. The appearance reroll is plainly visible while the underlying silhouettes
remain pixel-aligned at their canonical projected boundary.

Visual review covers a normal 1440 by 900 viewport, canonical SVG at the proof's 2:1 logical
extent, and deterministic 8192 by 4096 PNG produced by the production export path. Reviewers
inspect full views plus seam, pole, narrow-channel, small-island, echo-line, and
raster-tile-boundary crops. Automated PNG and reconstructed boundary-row comparisons have zero
byte/pixel tolerance; human review accepts no visible seam, clipping, repetition, or decoration
discontinuity. A favorable screenshot cannot substitute for the registered gallery.

## Performance, progress, cancellation, and resource budgets

Wall-clock release budgets are measured on the designated Apple M5 MacBook Pro with 24 GB unified
memory, an idle release build, packaged local assets, power connected, Low Power Mode off, and no debugger,
developer tools, or network dependency. The report records application and operating-system
versions. After one untimed warm-up, five fresh-process runs are measured; all five must meet the
limit and the median and worst run are reported. Aggregate resident memory for the application
process tree, including newly created WebView or helper processes, uses a sampling interval no
greater than `20 ms`; the maximum sampled delta from the settled pre-operation baseline is reported
for every run. CI enforces deterministic output, dimensions, file-size ceilings, bounded
tile/surface allocation, progress/cancellation semantics, and deterministic aftermath; it does not
enforce shared-runner wall-clock or cancellation-acknowledgement latency.

### Approved packaged-preview measurement authorities

The following narrowly scoped authorities apply only to the Milestone 2 coarse-preview release
measurement on MacBook Pro `Mac17,2`, Apple M5, 24 GB, macOS 26.5.1 (`25F80`). They preserve the
workload and every numeric budget in this contract; they make the existing visible-first-paint and
application-process-tree boundaries observable. A different host, OS build, helper-role layout, or
measurement method invalidates the observation until this contract is reviewed again.

- The release observer may use a bounded, test-only desktop dispatch that invokes the same coarse
  preview request and workflow path as **Generate coarse preview**, without changing controls,
  preview resolution, generator inputs, scheduling, progress, cancellation, or accepted state. It
  must leave the preview canvas visible from dispatch through the final receipt. It may not scroll,
  reveal, pan, zoom, or otherwise modify the viewport after dispatch. The observer records the
  dispatch boundary and proves the normal production request path was used.
- A qualifying first paint requires all of: a complete ScreenCaptureKit frame displayed after
  dispatch; a changed `512 × 256` canvas crop; calibrated bounded populations of the production
  land and water palette colors; uninterrupted foreground ownership by the packaged candidate; and
  one final structured Accessibility receipt confirming the labelled disposable preview, its
  caption, and the enabled **Accept full atlas** control. The final receipt completion is the
  wall-clock and RSS endpoint. Missing or contradictory evidence invalidates the run.
- For this pinned host and OS only, `launchctl print` output is the expressly accepted application
  process-tree membership authority despite the `launchctl(1)` warning that it is not a supported
  API. The resolver must fail closed on unexpected output, OS/build mismatch, missing, duplicate,
  replaced, late-created, exited, or unresolvable helpers. It must identify the Tauri app and every
  GPU, Networking, and WebContent helper from the accepted PID-domain/resource-coalition mapping;
  executable paths may establish a helper role only after that membership check. PID proximity,
  launch order, and BSD parentage alone are not membership evidence. Membership is revalidated at
  both the settled baseline and final receipt so new or replaced helpers are included.
- Raw receipts containing transient PIDs, service UUIDs, coalition identifiers, local paths, or
  machine-specific diagnostics remain outside the public repository. The retained public evidence
  records only sanitized role counts, host/build identity, command and executable hashes, sampling
  summary, measurements, and invalidation reason when applicable.

These authorities are an owner-approved, fail-closed release-measurement exception, not a general
macOS process-inspection API or a production instrumentation feature. Any need for a privilege,
entitlement, private interface, production UI change, post-dispatch reveal action, or changed
measurement meaning stops the protocol and requires a new owner decision.

### Approved packaged full-atlas qualification authority

The following successor authority qualifies the observer and gated-fixture setup needed to measure
the accepted full-atlas first paint. It is pinned to the same MacBook Pro `Mac17,2`, Apple M5,
24-GB, macOS 26.5.1 (`25F80`) environment and inherits the packaged-preview process-tree, executable
identity, RSS, cadence, endpoint-coverage, private-retention, and fail-closed requirements above.
It qualifies the measurement path only; it does not itself run or decide the five-fresh-process
release gate.

- An observer-enabled package may accept exactly the three registered performance fixtures:
  `milestone-2-atlas-proof`, `milestone-2-atlas-fragmented-islands`, and
  `milestone-2-atlas-control-max`. The app must import each checked-in fixture definition directly
  and validate its fixture ID, canonical unsigned-64 seed, and complete nine-control record. A
  structured Accessibility receipt must prove that the live seed, controls, and workflow phase
  still match that definition before preview and full-generation dispatch. Unknown fixtures,
  partial configuration, malformed definitions or receipts, and any seed/control/state drift
  invalidate the observation.
- The gated preview and full-generation dispatches must invoke the same actions and unchanged
  `AtlasWorkflow` request paths as **Generate coarse preview** and **Accept full atlas**. They may
  not inject or replace preview data, accepted state, generated records, render scenes, or canvas
  output. An ordinary package must install neither gated fixture selection nor full-generation
  dispatch.
- Before measured full dispatch, the observer qualifies a production disposable preview using the
  packaged-preview authority, then obtains a fresh process-membership receipt and baseline frame.
  From measured dispatch until a qualifying accepted frame arrives, it performs no Accessibility
  traversal and no scroll, reveal, pan, zoom, focus, framing, or other application action.
- A qualifying first fully painted accepted atlas requires a complete `512 × 256`
  ScreenCaptureKit crop displayed after dispatch, changed from the disposable-preview baseline,
  with uninterrupted foreground ownership. With per-channel tolerance `10`, the crop must contain
  at least `100` pixels each near accepted land `#c9c39a` and water `#afbec0`, at least `8` pixels
  near accepted ink `#282a24`, and no more than `500` pixels near either disposable-preview palette
  color. A partial, stale, unchanged, preview-mode, background-only, or ink-free frame invalidates
  the observation.
- Only after that frame qualifies may one final Accessibility traversal confirm the accepted
  canvas label and caption, absence of the disposable-preview label and caption, disabled
  **Accept full atlas**, exact accepted fixture receipt, and frontmost state. Completion of that
  receipt remains the wall-clock and RSS endpoint. Accessibility completion without the visual
  predicate cannot qualify.
- Every raw PID-bearing sampler CSV is handed immediately to the approved issue #91 retention
  utility. Public evidence may contain only sanitized fixture values and hashes, host/build and
  tool identities, role counts, Boolean predicates, timing/RSS summary, opaque retention receipt,
  and invalidation authority/reason. Pixels, CSV content, PIDs, UUIDs, coalitions, user names,
  private archive locations, executable paths, and other local paths remain private.

The implementation, exact target-host sequence, negative predicates, and single-run qualification
receipts are recorded in the
[issue #94 packaged full-atlas observer evidence](investigations/issue-94/README.md). Any change to
the registered fixture authority, production actions, crop/palette predicate, completion boundary,
membership authority, retention behavior, host/build, or numeric release limits requires renewed
review. The complete release protocol remains separate downstream work.

### Approved exact-fixture packaged-preview qualification authority

Issue #96 combines the approved preview first-paint boundary with the exact three-fixture authority
without changing either production action or measurement meaning. It is pinned to the same MacBook
Pro `Mac17,2`, Apple M5, 24-GB, macOS 26.5.1 (`25F80`) environment and inherits the process-tree,
executable-identity, RSS, cadence, endpoint-coverage, private-retention, and fail-closed requirements
above. It qualifies the path only; it does not run or decide the five-fresh-process release gate.

- The observer-enabled atlas package may install a preview chord only alongside the existing exact
  fixture handler. On that chord it synchronously revalidates the live fixture ID, canonical seed,
  and complete nine-control record against the directly imported registered definition before it
  delegates to the same `preview` action as **Generate coarse preview**. Unknown authority or any
  live seed/control drift dispatches no preview. Ordinary packages install no atlas-observer
  handler.
- The operator may wait for the initial packaged Accessibility UI to materialize before observer
  start. This is an unmeasured readiness precondition, not a changed timeout. The observer then
  prepares the visible crop, configures the requested fixture, obtains stable membership and a
  baseline frame, and parses the exact `configured` receipt immediately before measured dispatch.
  From dispatch until the qualifying frame it performs no Accessibility traversal, scrolling,
  reveal, pan, zoom, focus, framing, or other application action.
- The existing preview-frame predicate remains unchanged: a complete post-dispatch `512 × 256`
  frame must differ from baseline, retain uninterrupted foreground ownership, and contain bounded
  populations of both production preview palette colors. Only after that frame qualifies may one
  final bounded Accessibility snapshot prove the labelled disposable preview and caption, enabled
  **Accept full atlas**, exact `preview` fixture receipt, and frontmost state. That snapshot's
  completion remains the wall-clock and RSS endpoint.
- Accessibility traversal is bounded by unique `CFEqual` elements so repeated WebKit nodes cannot
  exhaust the limit or weaken exact-count checks. Every created PID-bearing CSV is handed
  immediately to issue #91 retention. Public evidence retains only the approved sanitized fields;
  retention failure invalidates the attempt and produces no measurement conclusion.

The implementation, invalid attempts, exact target-host sequence, and one valid single-run receipt
per gated fixture are recorded in the
[issue #96 exact-fixture preview evidence](investigations/issue-96/README.md). Those observations
make no release-budget conclusion and do not authorize issue #95's matrix until its other bounded
observer-authority children are integrated.

### Approved packaged SVG/PNG completion qualification authority

Issue #97 combines the exact-fixture authority above with the unchanged production
save/unload/reopen and SVG/PNG actions. It is pinned to MacBook Pro `Mac17,2`, Apple M5, 24 GB,
macOS 26.5.1 (`25F80`) and inherits the process-tree, executable-identity, RSS, cadence/coverage,
private-retention, and fail-closed requirements above. It qualifies the completion path only; it
does not run or decide issue #95's five-fresh-process release gate.

- The observer-enabled package may install one preparation chord and one SVG/PNG chord only beside
  the existing exact-fixture handler. Preparation synchronously revalidates the accepted baseline,
  exact fixture ID, canonical seed, all nine controls, and a fresh private save target before it
  calls the same reviewed reroll, save, unload, and generator-free reopen methods as the production
  controls. Export dispatch synchronously revalidates exact reopened canonical/package evidence,
  zero reopen generator calls, no preview/busy state, and the fixed private sibling destination
  before it delegates to the unchanged `AtlasWorkflow.exportSvg` or `AtlasWorkflow.exportPng`
  method. Ordinary packages install none of these handlers or receipts.
- Before measured dispatch, the observer requires the existing complete exact-reopened receipt and
  records a fresh owner-only stale regular destination's device, inode, SHA-256, and byte length.
  From dispatch until replacement is observed, it performs no Accessibility traversal and no
  application scroll, reveal, pan, zoom, focus, framing, or other action. It may poll only that
  exact destination while independently monitoring foreground ownership and process-tree RSS.
- Completion requires a same-filesystem inode-changing atomic replacement whose complete SHA-256
  and byte length match the app's verified native receipt; absence of the format-specific native
  temporary; exact `atlas-svg-v1` 400 by 200 mm or `atlas-png-v1` 8192 by 4096 RGB structure; the
  unchanged 32-MiB SVG or 64-MiB PNG ceiling; and one final bounded Accessibility receipt proving
  the same fixture, canonical accepted-state hashes, manifest fingerprint, generator-free reopen,
  verified completion, and frontmost state. Completion of that receipt is the wall-clock and RSS
  endpoint.
- Accepted object identity and canonical aspect/output/coastline/scene/package evidence must remain
  unchanged across export. Baseline and completion membership must be equal, every sampler row
  must contain all required roles with exact aggregate arithmetic and endpoint coverage, and the
  maximum interval remains 20 ms. Every created PID-bearing CSV is immediately handed to issue #91
  retention, including an invalid attempt. Retention failure invalidates the attempt.

Stale or in-place destinations, missing replacement, partial output, a recognizable temporary,
bad hash/size/profile/dimensions/ceiling, accepted-state drift, foreground or helper drift, sampler
invalidity, or retention failure yields no measurement conclusion. A required trial is consumed
only by measured export dispatch and is never silently rerun. The implementation, target-host
sequence, invalid attempts, qualification status, privacy boundary, and sanitized receipts are in
the [issue #97 packaged export evidence](investigations/issue-97/README.md). Its current target-host
run stopped before measured dispatch because the packaged candidate could not acquire the approved
visible/frontmost readiness state in this Codex desktop session; therefore it records no valid
SVG/PNG qualification and makes no release-budget conclusion.

### Approved export target-session readiness authority

Issue #100 closes only issue #97's external target-session launch/readiness gap. A test-only
controller may launch the exact observer-enabled package by path in the active logged-in console
GUI session after proving the approved host, exact bundle/executable identity, and zero stale
candidate applications. It must then require exactly one matching application and one
Accessibility window, activate the application, perform `AXRaise`, write `AXFrontmost`, and obtain
an independent read-only observer receipt that retains the same application/window identity while
proving the window is visible and both Accessibility and `NSWorkspace` report the candidate
frontmost.

Wrong identity, stale/zero/multiple candidates or windows, invisible/minimized windows,
activation/raise/frontmost-write failure, foreground loss, or identity replacement fails closed.
The controller and observer remain external test tools under
[`investigations/issue-100`](investigations/issue-100/README.md); ordinary packages install no new
behavior. A narrowly approved unsandboxed GUI/session invocation is permitted when the execution
sandbox would otherwise deny this in-scope launch/activation action, but sandbox denial itself is
not target-host product evidence.

The issue #100 receipt is an unmeasured readiness qualification only. It configures no fixture,
starts no sampler, creates no destination, dispatches no SVG/PNG, consumes no issue #97 required
trial, and makes no timing, RSS, completion-authority, or release-budget conclusion. Its valid
qualification authorizes a new task to revalidate and resume issue #97's unchanged final candidate
and six unconsumed trials; it neither reinterprets issue #97's six invalid pre-dispatch attempts nor
qualifies export completion by itself.

| Operation       | Fixed workload                                                                                | Wall-clock | Peak additional memory | Output-size ceiling       |
| --------------- | --------------------------------------------------------------------------------------------- | ---------- | ---------------------- | ------------------------- |
| Coarse preview  | dispatch through first fully painted labelled 512 × 256 effective preview                     | `900 ms`   | `256 MiB`              | not applicable            |
| Full generation | dispatch through validated commit and first fully painted accepted full atlas                 | `10 s`     | `768 MiB`              | not applicable            |
| SVG export      | reopened accepted atlas, request through atomically written and verified complete 2:1 output  | `3 s`      | `512 MiB`              | `32 MiB` destination file |
| PNG export      | reopened accepted atlas, request through atomically written and verified `8192 × 4096` output | `15 s`     | `1 GiB`                | `64 MiB` destination file |

The coarse-preview gate also reports how many fresh runs complete within the original `750 ms`
stretch target. That target is diagnostic and does not block release; `900 ms` is the hard maximum.
The measured rationale and unchanged boundaries are recorded in
[ADR-0019](adr/0019-coarse-preview-release-budget.md).

`pnpm test:png-export` enforces deterministic bytes, dimensions, the file-size ceiling, bounded
band/surface allocation, progress/cancellation state semantics, native replacement behavior, and
deterministic aftermath. It is not the release benchmark. The designated Apple M5/24-GB
coarse-preview time and aggregate-memory matrix is recorded as passing in the release evidence. The
remaining operation measurements and 500-ms cancellation-acknowledgement proof remain outstanding
to issue #68 until rerun under the protocol below.

Wall-clock and memory gates run for `milestone-2-atlas-proof`,
`milestone-2-atlas-fragmented-islands`, and `milestone-2-atlas-control-max`; all six rows must meet
the SVG and PNG file-size ceilings. Save is measured from immutable snapshot capture through
successful durable native commit. Reopen is measured from open request through checksum/schema
validation, generator-free restoration, scene reconstruction, and first painted frame. Save and
reopen time/peak memory are recorded for the proof and largest-package fixtures but remain
report-only until an owning contract approves release limits.

Field implementation may exceed the fixed effective proof profiles but may not omit their declared
anchors or lower semantic resolution only to pass timing. PNG work larger than the single-surface
budget is tiled. Tests bound tile dimensions and live tile count so the implementation cannot meet
the memory limit by relying on an unmeasured full-size duplicate. MiB and GiB use binary units;
file size is exact destination length.

An operation lasting over `250 ms` emits its first progress event within `250 ms`, has no interval
greater than `250 ms` between successive progress events or between its last progress event and
terminal event, never moves backward, and never reports completion before validation and the
operation-specific output boundary. Preview cancellation is acknowledged within `100 ms`; full
generation and either export acknowledge it within `500 ms`. Acknowledgement means costly work has
stopped scheduling, the operation is terminally cancelled, no partial proposal or external export
is presented as complete, and the previous accepted document remains unchanged. Latency limits
use the same five-run maximum rule on the reference Mac.

Cancellation is exercised at early, middle, and late declared safe points five times each. No
accepted commit or destination replacement may occur after acknowledgement, and cancellation or
progress scheduling may not change a later completed operation's canonical output. Temporary
exports remain recognizable and safely cleanable. Native package commit is not cancellable after
its durable commit sequence begins. This contract requires observable progress/cancellation
semantics but does not select a worker or other transport; issues #58 and #64 choose the smallest
implementation that meets the budget and existing boundary rules.

A budget adjustment is a deliberate product-contract change. It records the representative
measurements, bottleneck, attempted bounded remedies, user-visible consequence, and updated limit
in this document before the final proof can claim success. The coarse-preview limit was revised
from `750 ms` to `900 ms` by [ADR-0019](adr/0019-coarse-preview-release-budget.md) after the complete
post-repair fixture matrix; `750 ms` remains a reported stretch target. A faster development machine
or an unreported lower-resolution workload does not silently redefine a budget.

## Visible desktop workflow

The final Milestone 2 proof demonstrates, in order:

1. enter or select seed `81985529216486895` for `milestone-2-atlas-proof` and inspect validated
   default controls;
2. request a visibly labelled deterministic coarse preview, then cancel and restart one preview;
3. accept a separately generated, validated full-resolution atlas;
4. inspect stable semantic landmass and water-body identities;
5. preview and commit **Reroll geography**, confirming the declared fixed/change sets;
6. preview and commit **Reroll appearance**, confirming semantic and coastline hashes remain fixed;
7. save through the native immutable-snapshot and atomic-directory boundary;
8. close or unload the document, arm the generator-free reopen tripwire, and reopen it;
9. inspect the identical atlas and canonical evidence; and
10. export deterministic SVG and 8192 by 4096 PNG from the reopened accepted document.

One high-value desktop orchestration test covers that sequence. Focused package, generator,
geometry, persistence, render, export, and component tests own the combinatorial details. The
workflow does not duplicate those suites or introduce a supported production CLI.

## Downstream ownership

This contract fixes product proof and comparison boundaries while leaving implementation choices
with their owning issues:

- [#56](https://github.com/ChadHealey/ttrpg-map-generator/issues/56) selects deterministic
  field, contour, topology, and dependency approaches.
- [#57](https://github.com/ChadHealey/ttrpg-map-generator/issues/57) defines the project-owned
  records, IDs, parameter schemas, ordering, diagnostics, and the topology transaction payload.
- [#58](https://github.com/ChadHealey/ttrpg-map-generator/issues/58) implements macro elevation,
  land/water generation, preview resolution, control realization tolerances, progress, and
  cancellation.
- [#59](https://github.com/ChadHealey/ttrpg-map-generator/issues/59) implements stable semantic
  classification, thresholds, connectivity, containment, and tie-breaking.
- [#60](https://github.com/ChadHealey/ttrpg-map-generator/issues/60) owns canonical coastline
  extraction, repair, simplification, quantization, and geometry validation; its accepted
  version-1 policy is recorded in [ADR-0011](adr/0011-canonical-world-coastline-policy.md).
- [#61](https://github.com/ChadHealey/ttrpg-map-generator/issues/61) implements the versioned
  display projection and adversarial seam handling recorded in
  [ADR-0012](adr/0012-equirectangular-atlas-display-projection.md).
- [#62](https://github.com/ChadHealey/ttrpg-map-generator/issues/62) composes disposable,
  deterministic renderer-neutral scenes from accepted records.
- [#63](https://github.com/ChadHealey/ttrpg-map-generator/issues/63) implements accepted ink,
  coastal decoration, paper treatment, and the reviewed visual goal.
- [#64](https://github.com/ChadHealey/ttrpg-map-generator/issues/64) owns controls, preview/full
  separation, atomic topology acceptance, reroll orchestration, progress, cancellation, and
  inspection.
- [#65](https://github.com/ChadHealey/ttrpg-map-generator/issues/65) persists and reopens the
  accepted state without generation while preserving Milestone 1 compatibility.
- [#66](https://github.com/ChadHealey/ttrpg-map-generator/issues/66) owns deterministic SVG.
- [#67](https://github.com/ChadHealey/ttrpg-map-generator/issues/67) owns deterministic tiled PNG.
- [#68](https://github.com/ChadHealey/ttrpg-map-generator/issues/68) proves the complete packaged
  workflow, release gates, gallery review, and retrospective.

No implementation issue may promote preview or render data to semantic authority, infer semantic
types in a renderer, use a display projection as accepted geometry, share a sequential random
stream across aspects, or weaken canonical comparisons to make its fixture pass.
