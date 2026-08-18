# 0003 — Milestone 2 Global Geography Algorithms

- Date reviewed: 2026-08-16
- Scope: issue [#56](https://github.com/ChadHealey/ttrpg-map-generator/issues/56), before
  production macro geography, classification, or canonical coastline implementation
- Resolution: use project-owned spherical field, sampled-grid, component, contour, and exact
  quantized-validation code for Milestone 2; add no production dependency

## Required capabilities and containment

Milestone 2 needs pointwise seeded macro fields on the authoritative ADR-0005 sphere, a nested
512 by 256 preview and 2048 by 1024 full sampling policy, land/water thresholding, spherical
connected components, seam/pole-aware contour extraction, conservative simplification, and
post-quantization topology validation. It does not yet need arbitrary user polygon booleans,
projection-space GeoJSON processing, a general GIS engine, climate, hydrology, or production
geography records.

Every candidate must remain behind the project-owned interfaces in
`packages/generation/src/geography-algorithm-adapters.ts`. A dependency-specific noise function,
GeoJSON tuple, polygon, geometry collection, exception, or diagnostic cannot enter `core`, an
accepted aspect, persistence, or a public generator proposal. The adapter receives canonical
`PlanetPoint` values and returns fixed-point field ticks, proposed planet-native rings, and stable
project diagnostics.

## Candidate evidence

Published size below is npm's unpacked tarball size, not a measured production bundle. Missing
dependency or declaration fields mean the official npm metadata did not advertise one at review
time. Every candidate is pure JavaScript or TypeScript and has no native/system requirement;
that avoids a build-platform risk but does not prove identical output across JavaScript engines.

| Capability       | Candidate and current evidence                                                                                                                                                                                                                               | Correctness and deterministic fit                                                                                                                                                                                                                                                                | Runtime, types, transitive, license, and maintenance                                                                                                                                                                         | Decision                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Seeded fields    | Project-owned analytic spherical basis field over unit-vector dot products, seeded by ADR-0006                                                                                                                                                               | Continuous on the sphere by construction; the seam is only a chart boundary and each pole is one location. Fixed-point output and the existing explicit stream make output/version consequences visible.                                                                                         | No dependency, native code, transitive package, or third-party type. The spike implementation is private and tree-shaken unless its harness is run.                                                                          | **Selected family.** #58 owns the production kernel and tuning.                                                         |
| Seeded noise     | [`simplex-noise` 4.0.3](https://www.npmjs.com/package/simplex-noise/v/4.0.3), [official repository](https://github.com/jwagner/simplex-noise.js), MIT, released 2024-07-26                                                                                   | Credible 3D noise can be sampled on a unit sphere and accepts an injected PRNG. Its default uses `Math.random()`, and its official changelog records output changes in major versions. It would still need project-owned octave, control, quantization, seam, and pole policy.                   | 108,997 unpacked bytes, built-in declarations, no runtime dependencies, repository last pushed 2024-07-26. Pure JS supports Node/browser, but the exact release becomes generator compatibility.                             | Not selected: it replaces only a small kernel while adding output-sensitive compatibility.                              |
| Seeded noise     | [`fastnoise-lite` 1.1.1](https://www.npmjs.com/package/fastnoise-lite/v/1.1.1), [official repository](https://github.com/Auburn/FastNoiseLite), MIT, released 2024-03-05                                                                                     | Broad, credible 2D/3D noise family with explicit seeds and portable language ports. It supplies far more algorithms and mutable configuration than the first macro field needs; port parity is not accepted-output proof.                                                                        | 134,576 unpacked bytes, no runtime dependencies. The official repository includes JavaScript and TypeScript ports and was pushed 2026-06-21, but npm metadata advertised no top-level declaration entry.                     | Not selected: capability and cross-port surface exceed the measured need.                                               |
| Contours         | Project-owned marching quads plus polar triangles with an exact integer asymptotic decider                                                                                                                                                                   | Directly models the wrapped longitude cells and single-pole triangle fans. Half-tick levels avoid equal-vertex degeneracy; shared edges interpolate to identical ADR-0005 ticks using `bigint` rational rounding.                                                                                | No dependency or foreign geometry. Work is linear in sampled cells plus emitted segments.                                                                                                                                    | **Selected.** #60 owns production winding, nesting, identity, and canonical-ring policy.                                |
| Contours         | [`d3-contour` 4.0.2](https://www.npmjs.com/package/d3-contour/v/4.0.2), [official documentation](https://d3js.org/d3-contour), ISC, released 2023-01-11                                                                                                      | Established marching squares over a rectangular numeric array and returns planar MultiPolygons. It has no spherical wrap, collapsed-pole, or planet-tick contract, so seam padding, polar repair, coordinate conversion, ordering, and validation remain project code.                           | 49,313 unpacked bytes plus `d3-array ^3.2.0`; npm metadata advertised no built-in declaration entry. Repository last pushed 2024-11-26.                                                                                      | Not selected: the adapter/repair code would be larger and less direct than the selected cell topology.                  |
| Polygon booleans | [`polygon-clipping` 0.15.7](https://www.npmjs.com/package/polygon-clipping/v/0.15.7), [official repository](https://github.com/mfogel/polygon-clipping), MIT, tagged 2023-12-18                                                                              | Credible Martinez-Rueda-Feito union/intersection/difference/xor with normalized planar MultiPolygon output. It operates on floating planar coordinates, permits invalid input repair semantics, and does not promise project ordering, quantization, spherical behavior, or compatibility bytes. | 350,159 unpacked bytes, built-in declarations, dependencies `robust-predicates ^3.0.2` and `splaytree ^3.1.0`; repository last pushed 2024-04-19. Its global environment safety limits are another ambient input to isolate. | Do not adopt now. It is the leading focused candidate only if #60 proves a real boolean requirement.                    |
| Simplification   | Project-owned topology-guarded vertex removal in an unwrapped local chart                                                                                                                                                                                    | Ranks removable vertices deterministically, retains seam/pole anchors, and accepts a removal only after exact quantized intersection and sample-anchor coverage checks. It rejects rather than silently collapsing a channel or island.                                                          | No dependency. ADR-0011 fixes the quarter-cell tolerance, candidate ordering, tie-breaking, and complete post-simplification validation.                                                                                     | **Selected and implemented by #60.**                                                                                    |
| Simplification   | [`simplify-js` 1.2.4](https://www.npmjs.com/package/simplify-js/v/1.2.4), [official repository](https://github.com/mourner/simplify-js), BSD-2-Clause, released 2020-02-03                                                                                   | Small and established radial-distance plus Douglas-Peucker polyline simplification. It does not preserve polygon topology, spherical meaning, narrow channels, nesting, seam anchors, or stable candidate ordering by itself.                                                                    | 7,105 unpacked bytes, built-in declarations, no dependencies; repository last pushed 2022-11-14.                                                                                                                             | Not selected: the missing topology guard is the actual hard part.                                                       |
| Exact predicates | Project-owned `bigint` orientation and rational interpolation over ADR-0005 ticks                                                                                                                                                                            | Exact for the bounded integer coordinates used by the sampled chart and does not inherit binary64 predicate ambiguity.                                                                                                                                                                           | No dependency and the smallest reviewed surface.                                                                                                                                                                             | **Selected for the initial quantized checks.**                                                                          |
| Exact predicates | [`robust-predicates` 3.0.3](https://www.npmjs.com/package/robust-predicates/v/3.0.3), [official repository](https://github.com/mourner/robust-predicates), Unlicense, released 2026-03-22                                                                    | Strong Shewchuk orientation/incircle predicates for floating 2D/3D values. It is not a topology validator, ring nester, contour tracer, or spherical polygon model, and its documented y-down sign convention needs an adapter.                                                                  | 293,521 unpacked bytes, built-in declarations, no dependencies; repository last pushed 2026-05-25.                                                                                                                           | Not selected because accepted checks already have exact integer inputs. Reconsider for unavoidable floating predicates. |
| General topology | [`jsts` 2.12.1](https://www.npmjs.com/package/jsts/v/2.12.1), [official repository](https://github.com/bjornharrtell/jsts), released 2024-12-06                                                                                                              | Comprehensive JTS port and the most capable validation/operation option. Its own README documents precision-related `TopologyException` cases and precision reduction; it remains a planar Simple Features model rather than the authoritative sphere.                                           | 3,697,503 unpacked bytes, `fastpriorityqueue ^0.7.5`, Node `>=18`, no npm declaration entry. npm declares EDL-1.0 OR EPL-1.0 while GitHub detection was `NOASSERTION`; repository last pushed 2025-01-02.                    | Not selected: capability, bundle, type, licensing-review, and adapter costs are disproportionate.                       |
| Modular GIS      | [`@turf/boolean-valid` 7.4.0](https://www.npmjs.com/package/@turf/boolean-valid/v/7.4.0) and [`@turf/simplify` 7.4.0](https://www.npmjs.com/package/@turf/simplify/v/7.4.0), [official repository](https://github.com/Turfjs/turf), MIT, released 2026-08-03 | Maintained typed GeoJSON operations, but validity and simplification remain planar, projection-shaped operations. `boolean-valid` is not a repair-free spherical accepted-geometry validator.                                                                                                    | Built-in declarations. `boolean-valid` directly lists 12 packages and `simplify` lists 6; their transitive graph is substantially broader than the selected primitives. Pure JS, repository last pushed 2026-08-12.          | Not selected: broad GeoJSON/transitive surface and projection leakage risk.                                             |

The private project-owned spike is intentionally representative rather than production geography.
It combines seeded spherical basis functions, quantized samples, one shared half-tick sea level,
spherical four-neighbor components, marching cells, exact segment stitching, and self-intersection
rejection. It does not create accepted aspects, stable semantic features, persisted geometry,
style, UI, climate, or hydrology.

## Sampling, precision, ordering, and compatibility proof

Sampling-policy version 1 uses `W` wrapped longitude cells and `H` latitude bands. Interior
anchors are exact ADR-0005 ticks at `(-pi + 2*pi*x/W, -pi/2 + pi*y/H)`. Each pole is one anchor,
not `W` coincident vertices. Canonical storage and evaluation order is south pole, interior rows
south-to-north and west-to-east, then north pole. The seam is the cell joining longitude index
`W - 1` to `0`; the polar bands are deterministic triangle fans.

The preview `(W, H) = (512, 256)` anchors map to the full `(2048, 1024)` anchors by multiplying
both non-pole indices by four. Preview has 130,562 unique anchors and full has 2,095,106. Tests
exhaustively compare all shared `PlanetPoint` ticks. Both profiles use the same pointwise field
kernel and sea level selected only from the shared preview anchors, so shared fixed-point field
ticks and land/water classification have zero tolerance: they are exactly equal.

Normalized field values use signed ticks with scale `2^24`, ties away from zero, canonical
positive zero, and no clamping at the adapter. A contour level is an odd doubled tick, placing it
between two possible field samples. Intersections use exact rational `bigint` arithmetic and the
ADR-0005 ties-away rule before producing canonical `PlanetPoint` ticks. Saddle decisions use the
integer bilinear determinant; a zero determinant takes the fixed non-negative branch. Ring and
diagnostic collections are sorted from canonical tick keys, never insertion, map, worker, or
completion order. The allowed disposable preview-boundary displacement is one preview-cell
angular diagonal, `sqrt(2) * pi / 256` radians; accepted geometry gets no such relaxation.

Changing the sampling policy, dimensions, anchor placement, pole fan, field quantum, rounding,
half-tick convention, saddle rule, traversal, or ordering is output-sensitive. It requires the
smallest truthful profile/parameter, field, classification, geometry, generator, and fixture
compatibility changes described by ADR-0009. It never rewrites already accepted output on load.

## Representative six-row observations

Command:

```bash
pnpm --config.engine-strict=false exec vitest bench \
  scripts/atlas-algorithm-spike.bench.mjs --run --reporter=verbose
```

Environment: Apple M5 MacBook Pro, 24 GB memory, macOS 26.5.1 arm64, Node 24.11.0 child runtime,
pnpm 11.19.0, Vitest 4.1.10. Each row below was observed twice at the full 2048 by 1024 profile in
a reused process. This is not the Milestone 2 release protocol: it has no packaged app, paint,
worker, progress, cancellation, semantic classification, save, or render work and does not
substitute for #68's designated Apple M5/24-GB five-fresh-process measurements.

| Fixed row                              | Observed time (ms) | Field fingerprint  | Land / water components | Rings / segments | Seam rings | Pole land (S/N) |
| -------------------------------------- | -----------------: | ------------------ | ----------------------: | ---------------: | ---------: | --------------- |
| `milestone-2-atlas-proof`              |        1,160–1,188 | `52f0a33eab6dd46a` |                   5 / 1 |        5 / 6,576 |          1 | no / no         |
| `milestone-2-atlas-fragmented-islands` |        1,911–1,954 | `1c53121b0c82834a` |                  12 / 1 |      12 / 11,988 |          3 | yes / yes       |
| `milestone-2-atlas-connected-majority` |        2,088–2,120 | `13c349fd36306c76` |                   3 / 1 |        3 / 7,020 |          1 | no / no         |
| `milestone-2-atlas-seam-crossing`      |        1,438–1,469 | `f88718416e67201f` |                   7 / 1 |        7 / 8,654 |          1 | no / no         |
| `milestone-2-atlas-control-min`        |        2,052–2,091 | `2d3cdf2dea32f671` |                   2 / 1 |        2 / 5,136 |          1 | yes / yes       |
| `milestone-2-atlas-control-max`        |        1,441–1,463 | `bc3a3884eae96bc6` |                  10 / 2 |       11 / 9,098 |          2 | no / no         |

The field plus one exact-capacity component bitmap and queue is 18,855,954 bytes (18.0 MiB) for
every full row. Coarse before/after RSS deltas in the reused process ranged from 0 after reuse to
31,948,800 bytes (30.5 MiB); this is neither a sampled peak nor a release gate. Segment/ring object
storage scales with the counts above and is included in RSS, not that exact buffer total.

All rows produced non-empty land and water, closed degree-two ring graphs, no post-quantization
self-intersection diagnostic, explicit pole classifications, and deterministic 64-bit spike
fingerprints. These are algorithm-family observations, not proof that the provisional basis field
meets #58's control-realization or #59's semantic classification criteria.

## Determinism and supported-platform risk

The selected topology, interpolation, classification, component traversal, and ordering steps use
safe integers or `bigint`. The analytic field still evaluates ECMAScript binary64 trigonometric
functions when converting canonical sphere anchors to transient unit vectors. The `2^-24`
quantization is much coarser than ordinary libm error, but ECMAScript does not specify every
transcendental bit. Before #58 can accept production field output, the exact full matrix must pass
the repository's macOS and Linux Node fixture jobs and a focused WebView/worker comparison must
show identical quantized ticks or add a versioned rounding guard/one-engine execution boundary.
This is the main remaining cross-engine risk; adopting a noise package would not remove it.

All reviewed libraries are portable JavaScript/TypeScript with no native build. JSTS requires
Node 18 or newer; the selected code targets the workspace's Node 24 and browser worker toolchain.
No Rust/WASM, host filesystem, locale, clock, environment setting, or network input enters the
selected deterministic path.

## Dependency and commit consequence

No production package is adopted. `package.json` files and `pnpm-lock.yaml` remain unchanged, so
there is no dependency commit to identify. The review and ADR precede the project-owned contract
and spike commit. If #60 later proves polygon booleans necessary, it must update this review for
the then-current exact `polygon-clipping` release and land one focused dependency-only commit
before implementation; unrelated upgrades remain forbidden.
