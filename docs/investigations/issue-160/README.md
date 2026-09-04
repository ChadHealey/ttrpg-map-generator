# Issue 160 — macro-landmass silhouette diversity

## Decision

Recommend the project-owned, deterministic **separated continent-envelope field v2** recorded in
[ADR-0029](../../adr/0029-separated-macro-landmass-field.md). It remains an analytic spherical
field over unit vectors and uses no new dependency, but broad continent envelopes must be placed
and evaluated as distinct owners rather than as an unconstrained sum of overlapping positive caps.
An explicit ocean-gap guard must prevent broad-owner envelopes from merging at the selected sea
level. Local, owner-scoped shape variation and fragmentation may alter an envelope or split it into
islands, but must not create an unintended bridge to a different broad owner.

This is a recommendation for the implementation child below, not a retroactive change to any
accepted M2 atlas. Existing accepted records remain version-1 geography and reopen as stored.

## Reproduction and reviewed evidence

The normal desktop accepted-atlas path was reviewed through the six registered M2 rows. Their
production `atlas-png-v1` 1600 by 800 outputs are the reviewed evidence, generated from the exact
accepted `AtlasRenderScene` rather than a diagnostic renderer:

| Named row                                                                                                |                 Seed | Controls relevant to morphology                                             | Observed whole-atlas silhouette                                                                      |
| -------------------------------------------------------------------------------------------------------- | -------------------: | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [proof baseline](../../../fixtures/visual-gallery/milestone-2-atlas-proof/baseline.png)                  |    81985529216486895 | defaults                                                                    | One dominant, long curved connected body plus small islands.                                         |
| [seam crossing](../../../fixtures/visual-gallery/milestone-2-atlas-seam-crossing/baseline.png)           | 12297829382473034410 | defaults                                                                    | The same dominant connected arc crosses the seam; seam handling is not the cause.                    |
| [connected majority](../../../fixtures/visual-gallery/milestone-2-atlas-connected-majority/baseline.png) |  1085102592571150095 | 60% water, 6 balanced continents, 55% fragmentation                         | One dominant connected arc remains despite a different control family.                               |
| [fragmented islands](../../../fixtures/visual-gallery/milestone-2-atlas-fragmented-islands/baseline.png) | 18364758544493064720 | 70% water, 5 varied continents, 90% fragmentation, 95% islands/archipelagos | Islands decorate a still-dominant winding body instead of creating a clearly different macro family. |
| [control minimum](../../../fixtures/visual-gallery/milestone-2-atlas-control-min/baseline.png)           |  6148914691236517205 | 45% water, 1 balanced continent, no fragmentation, land-biased poles        | The extreme low-control case becomes a near-global horizontal band.                                  |
| [control maximum](../../../fixtures/visual-gallery/milestone-2-atlas-control-max/baseline.png)           | 16045690984503098046 | 80% water, 8 continents, 100% fragmentation, ocean-biased poles             | Separates into many islands; it is a useful contrasting family but is an extreme control row.        |

To measure ordinary seed behavior without changing accepted data, the current desktop preview/full
generation code was run for seeds `1` through `8` with default controls. Each preview used the
same contour level as its full proposal; every full proposal met water coverage tolerance. The
largest connected land component held 91.50%, 98.00%, 98.76%, 97.82%, 78.74%, 92.55%, 79.21%, and
86.95% of land area, respectively. That is six of eight seeds at or above 86% and none below 78%.
The result supports the visual finding: normal seed variation commonly changes lobes and satellites
without changing the dominant connected macro form.

The reproduction uses the same `generateAtlasLandWaterPreview` and
`generateAtlasLandWaterFull` entry points composed by the desktop workflow. Existing invariant
coverage proves that the full sampler reuses every preview anchor and its classification, so this
is not a coarse-preview-only artifact.

## Diagnosis

### Causal stages

1. `createAtlasMacroElevationFieldAdapter` is the primary source of the bias. It creates broad,
   island, and archipelago positive spherical caps and negative fragmentation caps, then **adds**
   all their smooth contributions to one field. Broad centers are random (or only latitude-spaced
   in `balanced` mode), radii scale as `1 / sqrt(continentCount)`, and there is no minimum
   broad-owner separation, non-overlap constraint, ocean corridor, or component-shape objective.
   Overlapping positive tails raise the saddle between centres; a sea-level cut can therefore join
   separated intended continents into a long chain. The global `xy + yz - zx` perturbation adds
   asymmetry but cannot reserve water between owners.
2. Threshold selection contributes to the realized connection but is not its origin. It chooses a
   shared-preview contour primarily for target water coverage and water-connectivity preference.
   It has no land-component or silhouette criterion. Once the additive field has raised saddles,
   the coverage-contour may preserve them as narrow necks.
3. Land/water classification faithfully applies that contour to preview and full samples. The
   matching preview/full contour and anchors rule out divergent sampling as the observed cause.
4. Semantic classification faithfully assigns stable identity to each connected full-profile
   component. It cannot split a connected ribbon without falsifying accepted land/water data;
   its component and identity behavior is not the source.
5. Canonical coastline extraction and the equirectangular presentation faithfully trace the
   classified transitions with seam and pole protection. The seam-crossing row preserves the
   same topology rather than fabricating the arc, so coastline extraction/simplification and
   presentation are not remedies for the macro morphology.

### Options compared

| Option                                                                        | Deterministic, seam-safe fit                                                                                                                                                                 | Expected effect                                                                                                                                                                              | Decision                                                                                         |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Retune v1 radii, amplitudes, and cut counts                                   | Preserves the analytic unit-vector field and all existing boundary machinery.                                                                                                                | Can reduce a few joins but has no invariant preventing a different seed's caps from overlapping into a ribbon. It also makes user-facing controls carry an undocumented morphology contract. | Reject as the primary fix; retain only as a v2 calibration tool.                                 |
| Seeded spherical cellular/Voronoi ownership with independently warped regions | Can be project-owned and seam/pole safe because ownership uses dot products on unit vectors.                                                                                                 | Strong separation and varied regions, but adds a new field family, tie policy, boundary behavior, and broad visual calibration surface.                                                      | Do not choose for this bounded repair. It remains a future option if v2 cannot meet the matrix.  |
| Separated continent-envelope field v2                                         | Keeps the current analytic, quantized unit-vector representation, sampling profiles, and adapters. Deterministic centre placement and envelope ownership work identically at seam and poles. | Supplies explicit inter-owner ocean space while allowing bounded local lobes, cuts, islands, and archipelagos.                                                                               | **Select.** Smallest bounded change that addresses the causal absence of a separation invariant. |

## M2 visual-diversity contract for the follow-up

The follow-up must introduce a small, versioned fixed-seed **silhouette matrix** in addition to the
existing control matrix. It must include twelve normal default-control seeds, the existing six
control rows, and one registered production PNG per seed. It must use the normal desktop preview,
accepted-atlas, and reopen/render paths; a diagnostic-only image is insufficient.

For each matrix row, the generated review record must state the reviewed macro family and the
evidence for it:

- **broad continent:** one or more landmasses read as broad areas rather than a principally
  corridor-like chain;
- **separated landmasses:** two or more visually distinct atlas-scale land areas have an open
  water route between them;
- **fragmented islands/archipelago:** a coherent set of separately retained islands is visibly
  distinct from its nearest continental owner; and
- **rejected ribbon:** one dominant connected landmass primarily reads as a long, narrow or
  repeatedly necked chain across remote lobes, even if it has satellite islands.

The default-control twelve-seed cohort must show at least three accepted macro families across the
cohort, including broad-continent and separated-landmass examples. No individual default row may
be accepted as a rejected ribbon. A row may have one dominant continent; diversity does not impose
a continent-count aesthetic. The reviewer must judge the unlabelled 1600 by 800 atlas PNG at whole
atlas scale and record the corresponding full-profile component count, largest-land share, and any
retained island-group evidence. Those measurements are diagnostic context, not a substitute for
the visual decision.

The existing control rows retain their declared proofs. The minimum/maximum rows may demonstrate
extremes but cannot satisfy the ordinary-seed diversity cohort by themselves.

## Compatibility and upgrade policy

- Increment the macro field behavior version and macro-elevation generator version to `2`; update
  the land/water generator manifest and every persisted macro-field provenance value that names
  version `1`. Keep sampling, quantization, seam, pole, seed-derivation, and classification
  versions unchanged unless the implementation demonstrably changes one of those contracts.
- A v2 macro field invalidates its dependent land/water partition, all land/water-derived semantic
  identities and groups, canonical coastline, and dependent appearance/physical outputs. This is
  expected for an explicit geography replacement, not a reason to rewrite data in place.
- Existing version-1 accepted maps and fixtures remain immutable and reopen generator-free. The
  desktop must offer v2 only as an explicit new-atlas or explicit geography-upgrade/replacement
  operation after load; it must never silently regenerate an accepted v1 map.
- The implementation must add v2 fixtures and append review records under the fixture conventions.
  It must not hand-edit v1 golden data or replace existing accepted packages. The implementation
  issue must decide whether the current v1 fixture rows remain the permanent legacy lane or gain
  paired v2 rows; either choice requires byte-stable v1 reopen proof.

## Next executable issue

**Proposed title:** `M2: Add a versioned separated macro-landmass field and silhouette matrix`

**Outcome:** A v2 project-owned macro elevation implementation produces visibly diverse ordinary
atlas silhouettes while preserving deterministic unit-sphere sampling and every existing v1
accepted map unchanged.

**Authorized change surface:** `packages/generation` macro field, its metadata/contracts and
focused tests; the desktop workflow only for explicit v2 generation/upgrade selection if its
existing version dispatch cannot express it; fixture definitions, generated evidence, and review
records; the owning M2/version documentation. No production dependency, migration that rewrites
packages, renderer rewrite, semantic-policy redesign, or M3 work.

**Acceptance criteria:**

1. V2 uses deterministic, finite seeded placement of broad owners on unit vectors and an explicit
   gap rule that prevents broad owners from joining through additive overlap at the selected
   contour. Local deformation and fragmentation remain owner-scoped and deterministic.
2. Same v2 inputs, versions, IDs, revisions, and streams reproduce byte-identical output; seam
   identity, pole behavior, quantization, fixed traversal, cancellation, and exact preview/full
   shared-anchor correspondence still pass.
3. The existing semantic and coastline suites demonstrate that v2 land/water components retain
   stable identity and valid seam-safe topology. No semantic or coast renderer is used to hide a
   v2 topology defect.
4. The twelve-seed normal-control matrix meets the visual-diversity contract above in reviewed
   production gallery PNGs, while existing six control proofs retain their required semantics.
5. V1 accepted packages reopen without generator invocation or byte changes. V2 appears only via
   a deliberate new-atlas or explicit geography replacement/upgrade action; the UI explains that
   it replaces downstream accepted geography.
6. Fixture provenance records both version and review purpose. Any changed v2 fixed-seed outputs
   are generated through the targeted fixture command with new append-only review records.

**Verification:** Focused macro-field, land/water, semantic, and coastline seam/pole/determinism
tests; the selected v1 reopen lane; the v2 visual matrix through the production PNG exporter; then
`pnpm check` and the read-only fixture integrity check. ADR-0029 records the selected field-family
and compatibility boundary.

**Execution profile:** C3, `gpt-5.6-terra` at high reasoning effort. Stop and split if version
dispatch requires a third major package boundary, an accepted-data migration cannot remain
explicit, or the visual matrix reveals that the chosen envelope model cannot meet the contract.

## Verification performed for this diagnosis

```sh
corepack pnpm vitest run \
  packages/generation/src/atlas-land-water-generator-invariants.test.ts \
  packages/generation/src/atlas-land-water-classification.test.ts \
  packages/generation/src/atlas-semantic-classifier.test.ts \
  packages/generation/src/atlas-coastline-generator.test.ts \
  packages/generation/src/atlas-coastline-adversarial.test.ts
```

Result: 5 files and 22 tests passed. The run covers current macro-field determinism, shared
preview/full anchors, seam/pole handling, land/water classification, semantic identity, and
canonical coastline topology. It verifies the diagnosis against the current contract; it does not
claim that v2 has been implemented.
