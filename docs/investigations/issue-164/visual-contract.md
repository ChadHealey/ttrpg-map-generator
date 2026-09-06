# M2 macro-morphology visual contract — proposed version 1

Scope: whole-atlas geography viewed unlabelled at 1600 by 800, before mountains, climate,
hydrology, biome fill, names, paper, coastal echoes, or regional refinement. This is an issue-164
proposal; it does not retroactively accept or replace any registered evidence.

## Positive observations required

1. **Primary masses:** ordinary controls yield one to three visually primary continental masses.
   Similarly sized co-primary continents are allowed. No globally dominant continent is required.
   Primary count and arrangement vary deterministically with seeds and controls; four equal repeated
   owners are not made acceptable by assigning only three of them the name “primary.” Count intent
   still governs generation intent; a production implementation must document and validate its
   realization, never silently clamp the public `1..8` input to three.
2. **Internal hierarchy:** each primary has a readable broad interior, secondary lobes, at least one
   substantial peninsula, and an embayment that changes its macro outline. Subordinate features must
   differ in size, attachment width, direction, and curvature. A cluster of overlapping circles is
   not sufficient. Balanced co-primary area does not excuse missing hierarchy within each.
3. **Orientation and arrangement:** continent axes, spacing, facing margins, and ocean openings vary
   across the world and across the fixed seed cohort. A rotated copy of one evenly spaced layout is
   insufficient diversity. Projected polar width alone is not evidence of continental dominance.
4. **Water relationships:** open ocean is a coherent negative space; some opposing margins produce
   distinguishable broad recesses or marginal waters. Not every channel should look like a constant
   width inset of a polygon. These are visual relationships, not new semantic bay/strait entities.
5. **Margin islands:** retained isolated islands and groups relate to particular continental ends or
   margins, with unequal sizes and irregular spacing. Abundance controls must not turn them into
   repeating dotted necklaces. Zero abundance does not require islands for a visual pass.
6. **Scale:** the above remains apparent when the atlas is viewed at half size (800 by 400).
   Additional pixels may improve silhouette edges; they must not supply the missing macro structure.
   Regional coves, beach geometry, high-frequency coastline noise, or scientific tectonics are not
   requirements. M3 physical overlays and M4 regional detail cannot supply M2's missing proof.

## Explicit rejection classes

| Code                          | Reject when                                                                                                                                    | Does not reject                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| R1 ribbon                     | A principal body is a long narrow or repeatedly necked chain joining remote lobes.                                                             | A broad body with a subordinate peninsula.                       |
| R2 rounded interchangeability | Rounded owners share essentially one outline grammar, with weak internal hierarchy.                                                            | Two similarly sized but individually structured continents.      |
| R3 geometric excavation       | Circular/elliptical punches, repeated semicircular bites, hard circular support clipping, or visibly geometric slabs determine the silhouette. | An isolated curved bay integrated with a varied margin.          |
| R4 regular arrangement        | Similar owner spacing/orientation, or uniform channels, dominate the atlas.                                                                    | A particular pair of parallel margins.                           |
| R5 mechanical islands         | Even dots, repeated triplets, bead strings, or satellites unrelated to a realized margin.                                                      | An irregular island group related to one margin.                 |
| R6 cosmetic detail            | Added noise, marks, or tiny islands leave the failing macro form unchanged.                                                                    | Modest edge detail on an already readable continental hierarchy. |

## Review protocol

Review every fixed row at native whole-atlas scale, then compare each family's complete cohort at
half size. Record pass/fail, primary count as seen (not generator owner count), positive observations,
rejection codes, and one concise rationale. A failing row stays visible; no seed substitutions or
unreviewed entries count as passes. Assess seed-driven diversity separately from the two control
rows; extremes cannot rescue ordinary seeds. A family recommendation requires all four default
comparison rows to pass and both control cases to be interpretable under their stated semantics.
The later production gate expands to all twelve default rows, all six control rows, and the
128-seed preview sweep retained from ADR-0029.

Measurements of component area and gap are explanatory evidence, not aesthetic thresholds. Inspect
seam-connected pieces as one spherical body. One unique pole may appear as a wide edge band in an
equirectangular view; distinguish that distortion from an actual ribbon or missing broad interior.
The scalar/guard geometry must already be valid on the sphere: no renderer-side joining, splitting,
water carving, or cosmetic rescue is allowed.

The assistant's observations are explicitly identified as such in [the review](visual-review.md).
They do not substitute for the issue's human visual decisions.
