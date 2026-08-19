# Issue 83 full-profile packed-buffer inventory

- **Profile:** `world-atlas-full-v1`
- **Canonical sample count:** 2,095,106
- **Checked peak:** 44,263,215 bytes (42.213 MiB)
- **Limit:** less than 134,217,728 bytes (128 MiB)
- **Automated arithmetic:** `scripts/atlas-compact-generation-source.test.mjs`

This inventory covers every full-profile typed or bit-packed buffer that can be live on the
generation-through-accepted-presentation path. Preview buffers have 130,562 samples and are not
full-profile buffers. Small component-index, checksum, render-row, and spherical-row metadata is
bounded independently; the 4,100-byte full set of spherical row weights is included in the peak
anyway. Persistence DTO arrays exist only at save/reopen adapters and are not live on the measured
generation path.

| Owner and purpose                |                 Width |     Count |     Bytes | Lifetime and release point                                                                                                        |
| -------------------------------- | --------------------: | --------: | --------: | --------------------------------------------------------------------------------------------------------------------------------- |
| Full macro field sampler         | 4-byte signed integer | 2,095,106 | 8,380,424 | Created by full-profile sampling; released when `generateAtlasLandWaterFull` returns after the compact proposal copy is complete. |
| Accepted compact macro elevation | 4-byte signed integer | 2,095,106 | 8,380,424 | Owned by the proposal, accepted document, and presentation; replaced only by an accepted geography transaction or unload.         |
| Classification producer bits     |                 1 bit | 2,095,106 |   261,889 | Created during full classification; released after the compact reader owns its copy or immediately on cancellation.               |
| Accepted compact classification  |                 1 bit | 2,095,106 |   261,889 | Owned by the proposal, accepted document, and presentation; replaced only by an accepted geography transaction or unload.         |
| Surface partition labels         | 4-byte signed integer | 2,095,106 | 8,380,424 | Retained by semantic analysis and its proof; released when semantic classification returns.                                       |
| Surface partition queue          | 4-byte signed integer | 2,095,106 | 8,380,424 | Local to partition discovery; released when partition discovery returns.                                                          |
| Marine clearance                 |                1 byte | 2,095,106 | 2,095,106 | Retained while water regions are segmented; released when semantic classification returns.                                        |
| Marine distance queue            | 4-byte signed integer | 2,095,106 | 8,380,424 | Local to distance-from-land traversal; released when that traversal returns.                                                      |
| Marine core labels               | 4-byte signed integer | 2,095,106 | 8,380,424 | Retained during water-region segmentation; released when semantic classification returns.                                         |
| Marine core-discovery queue      | 4-byte signed integer | 2,095,106 | 8,380,424 | Local to core discovery; released when core discovery returns.                                                                    |
| Marine region labels             | 4-byte signed integer | 2,095,106 | 8,380,424 | Retained by semantic proof and adjacency; released when semantic classification returns.                                          |
| Marine assignment queue          | 4-byte signed integer | 2,095,106 | 8,380,424 | Local to primary-region assignment; released when assignment returns.                                                             |
| Semantic owner labels            | 4-byte signed integer | 2,095,106 | 8,380,424 | Local to accepted semantic membership validation; released when validation returns.                                               |
| Semantic connectedness visits    |                1 byte | 2,095,106 | 2,095,106 | Local to connectedness validation; released when validation returns.                                                              |
| Semantic connectedness queue     | 4-byte signed integer | 2,095,106 | 8,380,424 | Local to connectedness validation; released when validation returns.                                                              |
| Coastline land ownership map     | 4-byte signed integer | 2,095,106 | 8,380,424 | Retained during coastline extraction/proof; released when coastline generation returns.                                           |
| Coastline water ownership map    | 4-byte signed integer | 2,095,106 | 8,380,424 | Retained during coastline extraction/proof; released when coastline generation returns.                                           |

## Simultaneously-live peak

The conservative peak occurs while assigning primary marine regions. It includes the accepted
compact macro field (8,380,424), accepted compact classification (261,889), surface partition labels
(8,380,424), marine clearance (2,095,106), marine core labels (8,380,424), new marine region labels
(8,380,424), the assignment queue (8,380,424), and spherical row weights (4,100). Their exact sum is
44,263,215 bytes (42.213 MiB), leaving 89,954,513 bytes of packed-buffer headroom below 128 MiB.

The semantic-proof peak substitutes owner labels, connectedness visits, and the connectedness queue
for clearance, core labels, and assignment buffers and has the same byte total. Coastline source
maps total 16,760,848 bytes and are created only after cached semantic validation; they do not
overlap the semantic-analysis peak by ownership or lexical lifetime.
