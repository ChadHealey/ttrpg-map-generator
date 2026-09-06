# Proposed v3 production contract

Every statement marked **current** describes inspected source. Every **proposed** choice needs
the successor ADR; **blocked** means no exact production contract has yet been selected.

## Current control ownership

The authoritative values and invalidation roots are `ATLAS_CONTROL_DEFINITIONS` and
`ATLAS_CONTROL_INVALIDATION_ROOTS` in [atlas-geography-aspects.ts](../../../packages/core/src/atlas-geography-aspects.ts).
`AtlasControls` and its defaults live in [atlas-geography-model.ts](../../../packages/core/src/atlas-geography-model.ts).
Here M means `worldTerrain.macroElevation`; L means `worldSurface.landWaterClassification`.

| Control                       | Current default and domain                                 | Current root / persisted parameter | Proposed v3 consequence                                                                                                  |
| ----------------------------- | ---------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `worldCircumferenceKm`        | 40000; 10000–80000, step 1000                              | M / macro                          | Retain physical-units ownership; angular geometry must not acquire accidental scale dependence                           |
| `targetWaterCoveragePercent`  | 65; 45–80, step 1                                          | L / classification only            | Add to macro parameters; invalidate M because total paid land quota depends on it; retain downstream coverage validation |
| `continentCountIntent`        | 4; 1–8, step 1                                             | M / macro                          | Determines declared owner budget before placement; semantic continent count remains separately classified                |
| `continentDistribution`       | `varied`; `balanced`, `varied`, `oneDominant`              | M / macro                          | Fixed quota allocation before placement; no favorable reallocation on failure                                            |
| `fragmentationPercent`        | 35; 0–100, step 1                                          | M / macro                          | Explicit anatomy response with a finite declared recipe; no hidden retries changing intent                               |
| `islandAbundancePercent`      | 35; 0–100, step 1                                          | M / macro                          | Independent paid isolated-island control, including zero                                                                 |
| `archipelagoAbundancePercent` | 25; 0–100, step 1                                          | M / macro                          | Independent paid group control, including zero; private group labels are not semantic acceptance                         |
| `oceanConnectivity`           | `singleGlobal`; also `connectedMajority`, `multipleBasins` | L / classification                 | Preserve semantic obligation; whether v3 must also invalidate M is blocked on D3                                         |
| `polarCharacter`              | `neutral`; also `oceanBiased`, `landBiased`                | M / macro                          | Actual planet-pole response must be demonstrated before adopting a formula                                               |

Current `AtlasMacroElevationParameters` and `atlasMacroElevationParameters` in
[atlas-land-water-generator-contract.ts](../../../packages/generation/src/atlas-land-water-generator-contract.ts)
persist seven controls and omit water/ocean. `AtlasLandWaterClassificationParameters` persists
water and ocean, plus threshold/profile/realization metadata. Its type test explicitly rejects
water as a macro parameter. The strict [accepted DTO schema](../../../packages/persistence/src/atlas-accepted-aspect-dto-schema.ts)
matches that separation; adding a water property to an old macro record is not compatible.

`ATLAS_ASPECT_DEFINITIONS` currently gives macro no aspect dependency and classification a macro
dependency; semantic landmass/island-group/water-body aspects and coastline follow classification.
Water becoming a macro **control input** does not introduce a cyclic dependency on classification.
Invalidation must propagate through the existing downstream graph, not silently rewrite accepted
semantic entities, decoration or child-map context.

## Current versions and accepted records

| Boundary                                              | Current identity / source                                                                                                                                                                                                                                                               | Proposed disposition                                                                                                                                                                                          |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accepted macro behavior / generator                   | Supported exact pairs `(1,1)` and `(2,2)` in `ATLAS_MACRO_ELEVATION_VERSION_DEFINITIONS`; ordinary catalog still defaults to 1                                                                                                                                                          | Add exact `(3,3)` only; preserve old pairs/default until C3                                                                                                                                                   |
| Generator entry/manifest                              | `generateAtlasLandWaterFull` / `generateAtlasLandWaterPreview` in [generator](../../../packages/generation/src/atlas-land-water-generator.ts); `ATLAS_LAND_WATER_GENERATOR_MANIFEST_VERSION = 1` in [metadata](../../../packages/generation/src/atlas-land-water-generator-metadata.ts) | Separate explicit v3 entry in C2; truthful generator/behavior 3 metadata. Manifest 3 is proposed only if its identity versions the changed composition; retain an unchanged manifest-format version otherwise |
| Macro parameters                                      | Schema 1; full profile v1; sampling 1; behavior 1 in current generator, strict accepted DTO variants for behavior 1/2                                                                                                                                                                   | Proposed macro schema 2 with water added and field behavior 3                                                                                                                                                 |
| Classification parameters/output                      | Schema 1, behavior 1, realization 1; persisted `seaLevelContourDoubledTicks`                                                                                                                                                                                                            | Exact successor tuple blocked on D1/D3; unchanged output semantics may retain their versions, changed behavior may not                                                                                        |
| Geography / semantic classification                   | `ATLAS_GEOGRAPHY_CONTRACT_VERSION = 1`, semantic policy 1 in core model                                                                                                                                                                                                                 | Retain only if contract unchanged; do not alter semantic thresholds to rescue geometry                                                                                                                        |
| Accepted full lattice                                 | `world-atlas-full-v1`, 2048×1024 cells, 2095106 unique anchors                                                                                                                                                                                                                          | Preferred unchanged, pending D1 proof                                                                                                                                                                         |
| Preview lattice                                       | `world-atlas-preview-v1`, 512×256 cells, 130562 unique anchors                                                                                                                                                                                                                          | Preferred unchanged, pending D1 proof                                                                                                                                                                         |
| Scalar ticks / traversal                              | `2^24`, ties away from zero, normalized `[-1,1]`; south pole, rows, north pole                                                                                                                                                                                                          | Preferred unchanged; private `10^6`/`Math.round` is not this contract                                                                                                                                         |
| Seed derivation / stream                              | Both version 1 in [seed-input.ts](../../../packages/core/src/seed-input.ts)                                                                                                                                                                                                             | Retain algorithms; block exact new scope/name mapping on D2                                                                                                                                                   |
| Coastline geometry/extraction/simplification/topology | All version 1 in core model                                                                                                                                                                                                                                                             | Retain unless D1 proves a separate contract change necessary; then split scope                                                                                                                                |
| Package and record schemas                            | Existing `.mapworld` [v1](../../mapworld-v1.md) and [v2](../../mapworld-v2.md), independently versioned from macro behavior                                                                                                                                                             | No package migration proposed; additive strict parameter variant must fit existing package contracts                                                                                                          |

The compatibility reader [atlas-macro-elevation-version-compatibility.ts](../../../packages/persistence/src/atlas-macro-elevation-version-compatibility.ts)
checks generator version, seed generator version, parameter field behavior and output field
behavior before strict DTO decoding. C1 must reject unsupported or mixed tuples, not coerce
them into 3. The schema must additionally bind macro schema 2 to behavior/generator 3; legacy
schema 1 remains exact. [atlas-accepted-aspect-from-dto.ts](../../../packages/persistence/src/atlas-accepted-aspect-from-dto.ts)
reconstructs accepted sample readers without generation. Both package decode paths must retain
that behavior. The existing [desktop compatibility test](../../../apps/desktop/src/atlas-macro-elevation-version-compatibility.integration.test.ts)
is a regression foundation, not a substitute for new v3 cases.

## Proposed version-aware water transition

The [issue-168 dependency consequence](../issue-168/README.md) is unavoidable for quota-first
geometry: target water sets the land budget before fitting shapes. The proposed macro schema 2
is exactly the seven existing macro control fields plus `targetWaterCoveragePercent`, with
`parameterSchemaVersion: 2`, `fieldBehaviorVersion: 3`, and the selected sampling metadata.
If D3 also makes ocean an upstream input, this exact draft must be revised before C1; do not
silently add another field during implementation.

| Operation                                                  | Required proposed behavior                                                                                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Reopen accepted v1/v2/v3                                   | Decode retained samples/partition/parameters without invoking any generator; no normalization or implicit upgrade            |
| Edit water on an accepted v1/v2 workflow                   | Preserve legacy L-root behavior and legacy parameter ownership                                                               |
| Edit water for explicitly selected v3 generation           | Invalidate M and every dependent derived aspect; quota, field and classification are one consistent proposal                 |
| Explicitly replace legacy geography with v3                | Use existing user acceptance transaction; replace relevant records together and retain recoverability; never upgrade on load |
| Stale preview or proposal after water edit                 | Reject by current input/provenance identity; cached v3 macro work must include water and selected version/profile contract   |
| Downstream child context after explicit parent replacement | Mark context stale according to its owning contract; do not regenerate accepted child maps                                   |

Dispatch invalidation by the explicit target generation version for a new proposal and the
retained version for a legacy workflow. A mutable global “latest” flag is insufficient. The
current unversioned invalidation table must remain the legacy policy or gain an explicit
version-aware selector; it cannot simply be changed globally from L to M.

Water remains recorded in classification parameters because coverage is validated there. Within
a v3 proposal its value must equal the macro quota input and the accepted controls; mismatched
water/provenance must fail at the validated proposal boundary. Do not retrofit this extra-field
rule onto legacy macro records. Include generator/behavior, parameter schema, selected profiles,
seed scope/revision and water in provenance/cache identity using the owning canonical encoding;
no ambient state or unpersisted selection flag may determine reproduction.

## Blocked contour, profiles and field realization

Current [atlas-sampling-profiles.ts](../../../packages/generation/src/atlas-sampling-profiles.ts)
defines `AtlasContourLevel` as an **odd doubled field tick**. `createAtlasContourLevel` uses
`2 * lowerTick + 1`; `isAtlasLand` compares `2 * fieldTick > contourLevel`. Zero is not a valid
production contour under this type. The [classifier](../../../packages/generation/src/atlas-land-water-classification.ts)
selects a shared threshold from preview samples, then the generator uses that same threshold on
the full profile. The full partition must meet 25 basis points coverage error or produce no
proposed full patch.

The [private experiment](../issue-179/experiment.md) instead certifies continuous `F > 0`, motion
`D = 0`, and 400×200 / 1600×800 anchors, with an 800×400 review render. Those dimensions are not
the production lattices, nor are output-image pixels field anchors. Continuous area, raw-zero
classification and the existing binary64 certificate do not prove production quantized contour
survival, extracted coastline topology or the same feature measurements.

D1 must select exactly one coherent policy and record its complete version tuple:

1. Retain production threshold selection only after proving all permitted selected contours
   preserve certificates, quota tolerance and shared-anchor identity. A zero-motion certificate
   does not currently provide this proof.
2. Use a fixed permitted half-tick contour with explicit quantization/contour displacement
   bounds and coverage rejection. This changes threshold selection behavior even if the stored
   contour representation stays unchanged; assign a new behavior/realization identity as needed.
3. Introduce a genuine zero-contour representation only with reviewed boundary/tie/extraction
   semantics and corresponding version changes. Do not pass zero through the existing odd-tick
   API or reuse classification behavior 1 for altered rules.

The proposed ADR prefers option 3 as the hypothesis for D1; no production option is selected.
D1 must give a numerical slack/error budget for the actual quantizer,
shared profiles and extractor, not silently enlarge adopted feature targets. Keep current
profiles, quantization and coordinate traversal if they pass; changing their meaning requires
new identifiers, persistence impact review and re-authoring C1. The existing investigation's
EPS/slack policy is binary64 diagnostic evidence, not a formal interval or cross-platform proof.

## Blocked deterministic scope mapping

Current macro/classification generator IDs and aspect names equal their aspect-kind strings in
`ATLAS_ASPECT_DEFINITIONS`. `MapEntitySeedInput` is a closed typed scope containing world seed,
map/entity IDs, generator/aspect identity, generator version and variant revision.
[ADR-0006](../../adr/0006-seed-derivation-and-deterministic-streams.md) requires a complete typed
seed for an independent concern; it does not expose arbitrary owner-string fork scopes.

The exact production owner, anatomy, placement and island stream names/mapping are **blocked**.
D2 must publish every typed scope field, stable owner/subfeature index or ID mapping, ordering,
draw budget and reroll behavior, with repeatable examples. It must explain how transient owners
avoid masquerading as accepted semantic entity IDs. Reuse the released derivation and stream
algorithms if their contracts suffice; do not copy the investigation's SHA-256 counter stream,
ad hoc string names, or add unrecognized scope fields. New generator 3 changes output identity;
that alone does not authorize changing seed derivation version 1's meaning.

## Ocean, polar and other missing evidence

The [M2 proof](../../milestone-2-atlas-proof.md) distinguishes transient threshold proxies from
semantic outcomes: `singleGlobal` needs one qualifying open-marine component rooted at one basin;
`connectedMajority` needs at least 90% of non-enclosed marine area in the largest such component;
`multipleBasins` needs at least two qualifying disconnected components. Enclosed seas do not
count as additional ocean basins. The semantic classifier consumes accepted samples; it does not
edit them to make the requested ocean mode true.

The current threshold proxy can report connectivity unsupported without invalidating an otherwise
valid partition; it always reports the proxy as unverified at this generation stage. A fixed
zero contour cannot assume this threshold preference still exists. D3 must specify whether
geometric construction, a compatible downstream policy, or explicit unsupported outcomes realize
each mode. Connected raw water alone does not rule out multiple semantic clearance cores; use
the actual semantic policy rather than infer the result from an unlabelled water mask. If macro
geometry must respond to ocean intent, add ocean to its proposed input and
invalidation contract before C1. No extra water carving or semantic relabeling is authorized.

All six issue-179 rows use neutral polar intent. Private local-axis stretching for nonneutral
controls does not demonstrate bias at the actual planet poles. Production's current field uses
a planet-axis polar term; replacing it requires a measured pole-aware response that preserves
quotas, separation and all certificates. D3 needs paired `oceanBiased`/`neutral`/`landBiased`
evidence, not three control values that produce a rotated local shape.

The six rows also do not establish every public count (1–8), water extreme (45–80), independent
island/group zeros, distribution, fragmentation extreme, physical-size invariant, ordinary-seed
success rate or production semantic continent count. There is already an analytic support limit
in the frozen wedge-mouth family: its owner cap radius is at most 1.4 radians, so every owner's
total paid body-plus-island fraction is at most `(1 - cos(1.4)) / 2 = 0.41501642854987947`.
Count 1 at 45% water requires fraction 0.55 and cannot fit that family under any seed. This is a
restriction of the present certificate/construction class, not an impossibility theorem for the
adopted morphology targets. D3 must resolve this public-domain mismatch rather than hide it with
retries or a control clamp. Private primary labels and paid owner
counts are not the semantic classifier's 20%-of-land continent test. #180 can expose these gaps;
it cannot select the production policy or replace the required 128-seed and visual/platform proof.
