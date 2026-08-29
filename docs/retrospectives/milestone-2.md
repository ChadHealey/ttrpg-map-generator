# Milestone 2 retrospective — Whole-world atlas postcard

- **Status:** Complete
- **Prepared:** 2026-08-17
- **Candidate visible exit:** The application creates, saves, reopens, selectively rerolls, and
  exports an attractive whole-world atlas with recognizable continents and oceans.
- **Release evidence:** [Milestone 2 release-evidence report](../milestone-2-release-evidence.md)

The implementation reaches the visible product flow and the Milestone 2 evidence boundary is closed.
The packaged workflow, deterministic exports, reviewed visual gallery, local and remote gates,
functional cancellation semantics, and Apple M5/24-GB coarse-preview matrix pass. Under
[ADR-0021](../adr/0021-defer-packaged-performance-evidence-to-milestone-9.md), the remaining
reference-machine operation matrices and packaged cancellation-acknowledgement trials retain their
limits and evidence history as Milestone 9 release-hardening requirements.

## What is implemented on the candidate branch

- Deterministic spherical macro geography, accepted land/water classification, stable landmass,
  island-group, and water-body semantics, and canonical planet-native coastline geometry.
- A seam- and pole-aware atlas projection plus one restrained ink scene with accepted coastline
  appearance, water decoration, and paper treatment.
- Validated atlas controls, labelled coarse preview, separate full acceptance, and transactional
  geography/appearance rerolls with visible fixed/change declarations.
- Persistence-owned accepted atlas records, native atomic save/recovery, true unload, and
  generator-free reopen while preserving the released Milestone 1 package contract.
- Deterministic `atlas-svg-v1` and bounded-band `atlas-png-v1` export from the reopened accepted
  scene, including the 8192 × 4096 production PNG profile.
- Six registered seeds/control cases intended to keep canonical semantics, geometry, SVG structure,
  PNG visuals, package authority, and performance evidence independently reviewable.

## What took longer or required iteration

- Spherical continuity was not just a renderer concern. Collapsed poles, the longitude seam,
  quantized contour topology, ring nesting, and projection splitting all needed compatible
  contracts before a favorable postcard could count as canonical geography.
- Stable semantic identities had to survive changing topology. Classification, containment,
  connectivity, source matching, dependency updates, and selective rerolls needed one atomic patch
  rather than a map-sized output blob.
- Appearance isolation required persisted projection-neutral decisions. Rebuilding attractive ink
  directly from a scene or SVG would have made reopen and appearance-only reroll claims circular.
- High-resolution deterministic PNG was a resource problem as well as an encoder problem. A bounded
  band rasterizer, explicit filter/DEFLATE behavior, native atomic replacement, cancellation, and
  independently reconstructed rows were needed before repeat bytes had useful meaning.
- The full 2048 × 1024 accepted workload exposed test-organization and repeated-generation costs.
  Costly end-to-end evidence needed deliberate serialization and focused gates so an orchestration
  proof did not starve unrelated geometry tests or hide a release-budget gap.
- The desktop interface could only become a thin, honest proof after persistence, export, and
  generator-free reconstruction existed. Adding save/reopen buttons earlier would have created a
  second, weaker workflow instead of exercising the released boundaries.

## Deliberately cut or deferred

- Milestone 2 has no climate, mountain systems, hydrology, lakes, names, labels, or regional map.
  Those belong to the world-to-region handoff and later physical-region milestones.
- General editor operations, arbitrary feature rerolls, file-dialog UX, Save As/overwrite flows,
  autosave, undo/redo, plugins, cloud features, and a supported production CLI remain deferred.
- Display projection remains disposable; canonical geography is planet-native. More projections
  are deferred rather than broadening the accepted schema for one postcard.
- Signing and notarization, Linux/Windows packaging, and distribution automation are not required
  for the local unsigned macOS proof.
- The contract now designates the available Apple M5/24-GB MacBook Pro as the reference machine.
  [ADR-0019](../adr/0019-coarse-preview-release-budget.md) revises the coarse-preview hard limit to
  `900 ms`, retains `750 ms` as a reported stretch target, and records a passing corrected
  three-fixture matrix. Full-generation, export, and packaged cancellation measurements move to
  Milestone 9 under their unchanged limits; the invalid/consumed records remain historical evidence.

## Next milestone proof

Milestone 3 must make the world-to-region handoff visible. A user selects a footprint on the exact
accepted atlas and sees the terrain, coast, climate, biome, watershed/major-water, named-feature,
and projection constraints that will govern its future regional child. The persisted inherited
context must carry exact source lineage, versions, transforms, boundary collar, anchors, and
checksum, including seam and near-pole cases, without generating the regional map yet.

That proof should reuse Milestone 2's accepted world identity and canonical geometry rather than
reaching through a world generator or clipping styled atlas paths. The first visible M3 review
should pair the selected footprint with an inspectable context summary so continuity is a product
promise before regional detail is introduced.

## Release-hardening follow-up

The [release-evidence report](../milestone-2-release-evidence.md) keeps the deferred rows and their
history visible. Milestone 9 must qualify the repaired observer controller, then run the retained
full-generation/export and packaged cancellation matrices before the world-to-regional MVP closes.
