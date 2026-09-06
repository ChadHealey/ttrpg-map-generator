# Preserved v2 cohort — issue 164 inspection

Source: `investigation/issue-163-envelope-v2`, exact commit
`736e1ddbbda804fa2c9e74e63d0d1ea3c99b83e1`. All eighteen original production PNGs were extracted
read-only with `git show` and inspected individually at 1600 by 800. No source PNG was regenerated,
recompressed, cropped, or copied into the accepted gallery on `main`. The complete path, seed,
controls, byte length, and SHA-256 of each is recorded in [v2-provenance.json](v2-provenance.json).
Byte-identical copies are retained under `v2-source/<row>.png` in this investigation directory.
The focused test verifies their pinned SHA-256, length and dimensions without requiring the
candidate commit in the checkout's Git object database. They remain rejected investigation
evidence, outside the registered gallery.

The [maintainer's rejection](https://github.com/ChadHealey/ttrpg-map-generator/issues/163#issuecomment-5544357502)
is the human disposition for this cohort. The observations below are the assistant's independent
inspection, not invented per-row quotations from that review. “Positive” means a useful local
property; none of these observations reverses the cohort's rejection.

All image links below use that immutable commit. Prefix `normal` means default controls and seeds
1 through 12; the other six exact inputs are in the provenance file.

| Row                                                                                                                                                                                                | Positive observed                                             | Rejection exemplar / limitation                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [normal-01](https://github.com/ChadHealey/ttrpg-map-generator/blob/736e1ddbbda804fa2c9e74e63d0d1ea3c99b83e1/fixtures/visual-gallery/milestone-2-atlas-v2-normal-01/baseline.png)                   | Broad separated interiors; a southern polar body.             | Three similar rounded mid-latitude owners, repeated island triplets; little internal hierarchy (R2/R5/R6).                                                    |
| [normal-02](https://github.com/ChadHealey/ttrpg-map-generator/blob/736e1ddbbda804fa2c9e74e63d0d1ea3c99b83e1/fixtures/visual-gallery/milestone-2-atlas-v2-normal-02/baseline.png)                   | Seam-crossing broad body; open water.                         | Repeated rounded owners; a circular bite at the right seam and dot strings (R2/R3/R5).                                                                        |
| [normal-03](https://github.com/ChadHealey/ttrpg-map-generator/blob/736e1ddbbda804fa2c9e74e63d0d1ea3c99b83e1/fixtures/visual-gallery/milestone-2-atlas-v2-normal-03/baseline.png)                   | Polar and mid-latitude masses remain separated.               | Circular interior holes and repeated beads, weak lobes (R2/R3/R5). Polar stretch is not itself an R1 ribbon.                                                  |
| [normal-04](https://github.com/ChadHealey/ttrpg-map-generator/blob/736e1ddbbda804fa2c9e74e63d0d1ea3c99b83e1/fixtures/visual-gallery/milestone-2-atlas-v2-normal-04/baseline.png)                   | Modest orientation variation and broad interiors.             | Near-equivalent rounded owners, tiny punched hole, short regular chains (R2/R3/R5).                                                                           |
| [normal-05](https://github.com/ChadHealey/ttrpg-map-generator/blob/736e1ddbbda804fa2c9e74e63d0d1ea3c99b83e1/fixtures/visual-gallery/milestone-2-atlas-v2-normal-05/baseline.png)                   | Clear ocean separation.                                       | Round holes plus a conspicuous elongated cut in the southern margin; repeated rounded silhouettes (R2/R3).                                                    |
| [normal-06](https://github.com/ChadHealey/ttrpg-map-generator/blob/736e1ddbbda804fa2c9e74e63d0d1ea3c99b83e1/fixtures/visual-gallery/milestone-2-atlas-v2-normal-06/baseline.png)                   | Broad non-ribbon interiors, separate islands.                 | Interchangeable outlines; polar projection stretches small satellites into ovals without adding hierarchy (R2/R5/R6).                                         |
| [normal-07](https://github.com/ChadHealey/ttrpg-map-generator/blob/736e1ddbbda804fa2c9e74e63d0d1ea3c99b83e1/fixtures/visual-gallery/milestone-2-atlas-v2-normal-07/baseline.png)                   | Open water route between polar and central bodies.            | Very similar central cookies and regular triplets (R2/R4/R5).                                                                                                 |
| [normal-08](https://github.com/ChadHealey/ttrpg-map-generator/blob/736e1ddbbda804fa2c9e74e63d0d1ea3c99b83e1/fixtures/visual-gallery/milestone-2-atlas-v2-normal-08/baseline.png)                   | Central continent has a broader east-west axis.               | Axis variation does not create internal hierarchy; small round cuts and bead groups persist (R2/R3/R5).                                                       |
| [normal-09](https://github.com/ChadHealey/ttrpg-map-generator/blob/736e1ddbbda804fa2c9e74e63d0d1ea3c99b83e1/fixtures/visual-gallery/milestone-2-atlas-v2-normal-09/baseline.png)                   | Distinct broad owners and visible islands.                    | Similar size and outline grammar, regularly spaced miniature satellites (R2/R4/R5).                                                                           |
| [normal-10](https://github.com/ChadHealey/ttrpg-map-generator/blob/736e1ddbbda804fa2c9e74e63d0d1ea3c99b83e1/fixtures/visual-gallery/milestone-2-atlas-v2-normal-10/baseline.png)                   | Owners have different orientations.                           | Circular/oval holes dominate the modest shape detail; beads repeat (R2/R3/R5).                                                                                |
| [normal-11](https://github.com/ChadHealey/ttrpg-map-generator/blob/736e1ddbbda804fa2c9e74e63d0d1ea3c99b83e1/fixtures/visual-gallery/milestone-2-atlas-v2-normal-11/baseline.png)                   | Broad north and south masses; separated ocean spaces.         | Rounded owners lack subordinate peninsulas; repeated triplets persist (R2/R5/R6).                                                                             |
| [normal-12](https://github.com/ChadHealey/ttrpg-map-generator/blob/736e1ddbbda804fa2c9e74e63d0d1ea3c99b83e1/fixtures/visual-gallery/milestone-2-atlas-v2-normal-12/baseline.png)                   | No dominant connected ribbon.                                 | Similar smooth silhouettes with small repeated satellite strings (R2/R4/R5).                                                                                  |
| [proof](https://github.com/ChadHealey/ttrpg-map-generator/blob/736e1ddbbda804fa2c9e74e63d0d1ea3c99b83e1/fixtures/visual-gallery/milestone-2-atlas-v2-proof/baseline.png)                           | Separated broad land areas; intact seam presentation.         | Circular interior holes, regular beads, weak secondary structure (R2/R3/R5).                                                                                  |
| [seam-crossing](https://github.com/ChadHealey/ttrpg-map-generator/blob/736e1ddbbda804fa2c9e74e63d0d1ea3c99b83e1/fixtures/visual-gallery/milestone-2-atlas-v2-seam-crossing/baseline.png)           | Seam/polar continuity remains visually useful.                | Rounded central owners and circular/elliptical hole in the right body (R2/R3).                                                                                |
| [connected-majority](https://github.com/ChadHealey/ttrpg-map-generator/blob/736e1ddbbda804fa2c9e74e63d0d1ea3c99b83e1/fixtures/visual-gallery/milestone-2-atlas-v2-connected-majority/baseline.png) | More separate broad bodies and open water.                    | Six-owner layout repeats a regular rounded grammar, not richer continental hierarchy (R2/R4/R5). A PNG does not prove semantic ocean connectivity.            |
| [fragmented-islands](https://github.com/ChadHealey/ttrpg-map-generator/blob/736e1ddbbda804fa2c9e74e63d0d1ea3c99b83e1/fixtures/visual-gallery/milestone-2-atlas-v2-fragmented-islands/baseline.png) | Many detached islands are visibly distinct from continents.   | Strongest R3/R5 exemplar: overlapping circular bites, holes, and mechanically spaced bead strings.                                                            |
| [control-min](https://github.com/ChadHealey/ttrpg-map-generator/blob/736e1ddbbda804fa2c9e74e63d0d1ea3c99b83e1/fixtures/visual-gallery/milestone-2-atlas-v2-control-min/baseline.png)               | One large retained interior; zero islands matches this input. | Giant smooth body with conspicuous horizontal shoulders (R3); one-owner gap is vacuous. Projection-wide polar extent alone does not prove a spherical ribbon. |
| [control-max](https://github.com/ChadHealey/ttrpg-map-generator/blob/736e1ddbbda804fa2c9e74e63d0d1ea3c99b83e1/fixtures/visual-gallery/milestone-2-atlas-v2-control-max/baseline.png)               | Strong fragmented-island evidence and separated bodies.       | Round punch-outs and repeated necklaces overwhelm broad shape structure (R2/R3/R5).                                                                           |

## Class coverage and absence

Broad interiors: normal-01, normal-08, control-min. Separated landmasses: normal-02, proof,
seam-crossing. Detached island/archipelago appearance: fragmented-islands and control-max.
Varied orientations: normal-04 and normal-10. These are successes under the narrower v2 goal.

No v2 row supplies a convincing complete positive exemplar of the proposed internal hierarchy and
margin relationship contract. That absence must remain explicit. R1 is not asserted for a v2 row:
the historical v1 [proof baseline](../../../fixtures/visual-gallery/milestone-2-atlas-proof/baseline.png)
is the ribbon exemplar diagnosed by [issue 160](../issue-160/README.md). R2–R6 have exemplars above;
R6 describes why extra tiny detail fails to repair those same broad outlines. The investigation
adds no positive fixture merely to populate a taxonomy.

## Source mechanism and causal limits

At the preserved ref, `createOwnerEnvelope` gives each owner one radial broad envelope, harmonics
2/3/5, at most three spherical cuts, evenly stepped isolated-island bearings, and three members per
archipelago at regular bearing/distance increments. `rotatedFibonacciCenters` rotates a fixed
placement grammar. These are direct source observations; their visual correspondence is strong.

The new prototypes challenge the sufficiency of richer local lobes and of a different ownership
family. They are not a single-variable ablation of v2, so they do not prove one coefficient caused
every failed image. In particular the envelope comparison shows a further interaction: coverage
calibration can grow small owners to their circular guard, obscuring the intended area hierarchy.
The cellular comparison shows that removing radial support does not itself create a convincing
continental hierarchy. Neither conclusion rules out every implementation of either family.
