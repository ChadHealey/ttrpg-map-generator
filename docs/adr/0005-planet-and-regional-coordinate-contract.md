# ADR-0005 — Planet-native and regional coordinate contract

- **Status:** Accepted
- **Date:** 2026-08-15
- **Decision owners:** Project maintainers
- **Supersedes:** None
- **Superseded by:** None

## Context

Milestone 1 needs one compatibility contract for accepted planet-surface geometry before
[coordinate types and transforms](https://github.com/ChadHealey/ttrpg-map-generator/issues/42),
root-coordinate seed keys, map records, or canonical persistence encode it. The
[kernel-proof contract](../milestone-1-kernel-proof.md) also requires an exact
`proof-input-to-planet` transform so its synthetic accepted output contains `PlanetPoint`
values rather than generator-local coordinates.

The project plan requires world geometry to remain continuous across the atlas seam, regional
maps to use local physical coordinates with an invertible mapping to the world, and display
projections never to become authoritative. The choices below resolve
[issue #49](https://github.com/ChadHealey/ttrpg-map-generator/issues/49) within the boundaries
established by [Rule 8](../01-architecture.md#rule-8--coordinate-spaces-and-units-are-types) and
[ADR-0002](0002-render-scene-viewport-coordinate-boundary.md).

There is no released coordinate-bearing world-document schema or accepted geographic fixture.
This is therefore the last point at which these choices can be made without a migration, but
they become persisted and deterministic-output compatibility promises when the downstream work
lands.

## Decision drivers

- One surface location must have one canonical persisted identity at the seam and poles.
- macOS and Linux must quantize and compare accepted geometry identically.
- A regional child must use physical units and invert to its parent without depending on an
  atlas projection.
- The representation must support seam and pole fixtures without introducing production
  geography in Milestone 1.
- Coordinate, render, screen, and print values must remain impossible to mix accidentally in
  public domain contracts.
- The first implementation must remain project-owned and small enough to review mathematically.

## Options considered

### Option A — Quantized spherical longitude/latitude plus a local azimuthal projection

Represent the root surface as a sphere and persist canonical longitude/latitude integer ticks.
Map a bounded child region with an azimuthal equidistant projection centered on its selected
origin. This makes the atlas seam a chart boundary rather than a break in the surface and gives
regional geometry explicit physical units.

### Option B — Normalized three-dimensional surface vectors

Persist unit Cartesian vectors and derive longitude/latitude only for interchange. This removes
the chart seam and gives poles a single representation, but quantizing three dependent
components either violates unit length or requires a second canonical normalization rule. It
also makes root-coordinate keys and human inspection less direct.

### Option C — Cube-sphere or other multi-face coordinates

Persist a face identifier and two local coordinates. This avoids one global seam and can support
uniform spatial sampling, but introduces face-edge and corner transitions before Milestone 1
has a terrain workload that benefits from them. Face selection and cross-face canonicalization
would become additional compatibility contracts.

### Related local-chart and quantization alternatives

A local equirectangular chart would be simpler but would make scale and round-trip quality depend
strongly on latitude. A gnomonic chart would make great-circle paths straight but becomes
singular at the chosen hemisphere boundary and does not preserve radial physical distance. The
azimuthal equidistant chart is chosen because distance and direction from the regional origin are
its primary parent-to-child meanings. Although the projection remains one-to-one almost to the
antipode, version 1 stops at a closed hemisphere to avoid the antipodal singularity and extreme
distortion before a product requirement justifies them.

Persisted floating radians or decimal-degree ticks would be readable, but would either retain
floating canonicalization concerns or fail to represent one full turn and both poles with the
same exact binary subdivision. `2^32` turn ticks make every topological boundary exact while
remaining safe integers. Integer millimeters give regional geometry substantially finer precision
than its planet quantization at ordinary planet radii without introducing decimal JSON or a
scale-general coordinate policy. Coarser meter ticks were rejected because they would discard
useful edit precision for no reduction in schema complexity.

## Decision

Adopt Option A for Milestone 1.

### Authoritative planet topology and units

The authoritative `WorldMap` surface is an oriented sphere. A world's positive radius is an
explicit `WorldKilometers` value; no transform reads an ambient Earth radius. Changing the
radius of an accepted world is an explicit world-setting change that can make physical child
context stale; it never silently rescales accepted child geometry.

`PlanetPoint` is a project-owned immutable record containing canonical quantized longitude and
latitude. Its conceptual angular unit at calculation and API boundaries is radians:

- longitude increases eastward and has the canonical interval `[-pi, pi)`;
- latitude increases northward and has the closed interval `[-pi / 2, pi / 2]`;
- `(longitude, latitude) = (0, 0)` lies where the prime meridian crosses the equator; and
- non-finite angles and latitudes outside the closed interval are invalid rather than clamped or
  reflected.

Longitude wraps because `-pi` and `+pi` are the same meridian. Canonicalization maps every
finite longitude modulo one turn into `[-pi, pi)`, so exact `+pi` becomes `-pi`. Algorithms may
temporarily unwrap a path to maintain local continuity, but unwrapped longitude is neither a
`PlanetPoint` nor accepted state.

All longitudes at an exact pole describe the same surface location. A canonical north or south
pole therefore has longitude zero. A point whose quantized latitude is not a pole retains its
quantized longitude; a near-pole input that quantizes onto a pole does not. Geometry algorithms
must treat the surface as a sphere, not interpolate the canonical longitude/latitude rectangle
as though its seam or pole edges were distinct geography.

Angles use radians at domain boundaries and carry a `Rad` suffix when exposed as raw numbers.
Physical distances use kilometers and carry a `Km` suffix. Degrees are UI/import/export values
that require explicit conversion. Screen pixels, render pixels, print points, ratios, and grid
cells remain separate units.

### Canonical planet quantization

Let one turn be `tau = 2 * pi`. Planet angles use `2^32` uniform ticks per turn. A persisted
`PlanetPoint` contains integer `longitudeTicks` and `latitudeTicks` with these invariants:

```text
longitudeTicks: [-2^31, 2^31 - 1]
latitudeTicks:  [-2^30, 2^30]
if abs(latitudeTicks) == 2^30, longitudeTicks == 0
angleRad = ticks * tau / 2^32
```

The longitude range has one canonical seam value, `-2^31`. The latitude limits represent both
poles exactly. The largest per-component angular quantization error is
`planetHalfStepRad = pi / 2^32`. A tick is approximately `1.462918e-9` radians; its physical
length depends on the world's explicit radius.

Computed angles are quantized by round-to-nearest, with exact ties away from zero. Longitude is
wrapped before rounding; if rounding produces the excluded `+2^31` seam value it wraps to
`-2^31`. Latitude is range-validated before rounding, so an out-of-range value cannot snap onto
a pole. After rounding, a pole forces longitude to zero. Every zero is canonical positive zero.

Unknown persisted values are not normalized: they must already be integers in range and obey
the pole invariant or parsing fails with a stable diagnostic. Serializers emit the integer ticks
and never independently round an already canonical point.

### Regional physical coordinates

Each `RegionalMap` owns its own right-handed local tangent frame and `RegionalPoint` space:

- its projection origin is a canonical `PlanetPoint` and maps to `(0, 0)`;
- at the projection origin, positive x is tangent east and positive y is tangent north wherever
  those directions are defined;
- away from the origin, x and y are azimuthal-equidistant chart coordinates rather than local
  geodetic east and north; and
- viewed from outside the sphere, positive x crossed with positive y points outward.

At an exact pole, where local north is not unique, the frame is fixed by the prime meridian. At
the north pole, positive x points toward the equator at longitude `+pi / 2` and positive y points
toward the equator at longitude `-pi`. At the south pole, positive x points toward longitude
`+pi / 2` and positive y points toward longitude `0`. This is an orientation rule for the local
projection, not a second longitude for the canonical pole.

Accepted regional coordinates, physical extents, and the planet radius use integer millimeter
ticks while their domain unit remains kilometers:

```text
xKm = xMillimeters / 1000000
yKm = yMillimeters / 1000000
distanceKm = distanceMillimeters / 1000000
```

Finite computed values are rounded to the nearest millimeter with exact ties away from zero;
negative zero becomes zero. Persisted millimeter values must be safe integers. A
`RegionalExtent` is an axis-aligned closed rectangle with
`minXMillimeters <= maxXMillimeters` and `minYMillimeters <= maxYMillimeters`; a point on an
edge or corner is inside. Extent and geometry invariants are evaluated after quantization so
tests see the same geometry that can be persisted. Other footprint shapes and clipping policy
are not defined by this ADR.

A coordinate system is valid only when rounding its maximum supported projected radius is safe:

```text
ceil(planetRadiusKm * pi / 2 * 1000000) <= Number.MAX_SAFE_INTEGER
```

Every regional coordinate and extent component must independently be a safe integer and remain
inside that supported disk. This prevents a valid persisted radius from producing coordinates
that its own canonical representation cannot encode.

### Milestone 1 transforms

Milestone 1 defines exactly two versioned domain transform contracts.

#### `proof-input-to-planet`, version 1

For the synthetic integral `ProofInputCoordinate` extent from `(0, 0)` through
`(10000, 10000)`, the forward transform is exact in accepted planet ticks:

```text
longitudeTicks = (x - 5000) * 65536
latitudeTicks  = (y - 5000) * 65536
```

Its image is the lattice subset of the closed tick rectangle `[-327680000, 327680000]` on both
axes whose two coordinates are divisible by 65536. That lattice is far from the seam and poles.
The partial inverse is defined exactly on this image. Forward followed by the partial inverse is
exact; no floating-point tolerance or second quantization is permitted. The transform has no
physical-distance claim and remains synthetic generator plumbing.

#### `planet-regional-azimuthal-equidistant`, version 1

The world-to-region transform is the spherical azimuthal equidistant projection parameterized by
the canonical planet origin and positive planet radius. It maps shortest great-circle distance
from the origin to radial distance in kilometers and maps initial bearing into the regional
frame. Its inverse maps the same local plane back to `PlanetPoint`.

The continuous formula domain is the closed hemisphere whose central angle from the origin is at
most `pi / 2`. The canonical public range uses a deterministic inward boundary:

```text
hemisphereRadiusMillimeters = floor(planetRadiusKm * pi / 2 * 1000000)
```

After component quantization, planet-to-regional tests disk membership with exact integer
arithmetic:

```text
xMillimeters^2 + yMillimeters^2 <= hemisphereRadiusMillimeters^2
```

The comparison uses `bigint` or an equivalent project-owned arbitrary-precision integer operation
because squaring safe integers can exceed JavaScript's safe-integer range. A result outside the
disk is rejected and never clamped inward. Regional-to-planet applies the same exact comparison.
Consequently, a continuous hemisphere-edge point whose nearest-millimeter result rounds outward
can be rejected even though the unquantized formula is defined there.

A `RegionalMap` extent is round-trip safe only if every corner lies within
`hemisphereRadiusMillimeters / 1000000 - B` kilometers, where `B` is the public
post-quantization bound defined below. The disk is convex, so checking all rectangle corners
covers its interior. The antipode and any geometry outside the continuous hemisphere are always
rejected. These bounds keep the accepted map extent one-to-one and closed under the declared
round-trip error without deciding production limits or shapes for selectable footprints.

For center longitude `lambda0` and latitude `phi0`, implementations derive only transient unit
vectors:

```text
origin = (cos(phi0) * cos(lambda0), cos(phi0) * sin(lambda0), sin(phi0))
east   = (-sin(lambda0), cos(lambda0), 0)
north  = origin cross east
```

The same formula produces the fixed pole frames because canonical pole longitude is zero. For a
target unit vector `point`, the forward transform is:

```text
a = point dot east
b = point dot north
d = point dot origin
s = hypot(a, b)
c = atan2(s, d)
xKm = radiusKm * c * a / s
yKm = radiusKm * c * b / s
```

When `s == 0` and `d > 0`, the target is the origin and maps directly to `(0, 0)`. When `s == 0`
and `d < 0`, it is the rejected antipode. For regional `(xKm, yKm)`, the inverse is:

```text
rho = hypot(xKm, yKm)
c = rho / radiusKm
point = cos(c) * origin + (sin(c) / rho) * (xKm * east + yKm * north)
```

The inverse returns `origin` directly when `rho == 0`, normalizes the reconstructed vector once,
and converts it with `atan2` before applying planet canonicalization. Implementations use these
stable `atan2`-based formulas rather than recovering distance with inverse cosine. The transient
vectors and basis are never persisted or exposed as domain geometry.

Typed transforms compose only when one transform's destination space exactly matches the next
transform's source space. The synthetic composition is
`ProofInputCoordinate -> PlanetPoint -> RegionalPoint`; its inverse is partial because the proof
inverse accepts only its fixed tick image. Latitude/longitude values must never be treated as an
affine x/y matrix. Each public transform produces its canonical destination type, so public
composition quantizes at the `PlanetPoint` boundary and again at the final `RegionalPoint`
boundary. An implementation may fuse operations through private continuous vectors to avoid an
unnecessary intermediate quantization, but such a value is not a `PlanetPoint`, cannot be
accepted or persisted, and is not the public composition above. Serializers never add another
rounding pass.

### Error budgets

For finite valid inputs in the transform's supported hemisphere, the private continuous formula
implementation is tested before constructing a public coordinate:

- planet -> regional -> planet has great-circle angular error at most `1e-12 rad`; and
- regional -> planet -> regional has Euclidean error at most
  `planetRadiusKm * 1e-12 + 1e-9 km`.

Pole comparisons use great-circle separation, so canonical pole longitude does not create a
false error. Seam comparisons use the shortest wrapped longitude difference.

These raw bounds are diagnostic requirements for the private math, not the contract of a public
typed round trip. Every public `PlanetPoint <-> RegionalPoint` round trip constructs and
quantizes its intermediate coordinate and therefore uses the post-quantization bound below.

Let `A = tau / 2^32 rad` be one planet tick, `D = 0.000001 km` be one regional tick, and
`E = R * 1e-12 + 1e-9 km` be the raw physical allowance for radius `R`. The conservative
post-quantization bound is:

```text
B = 2 * R * A + 2 * D + E kilometers

PlanetPoint -> stored RegionalPoint -> PlanetPoint:
  great-circle angular error <= B / R radians

RegionalPoint -> stored PlanetPoint -> RegionalPoint:
  Euclidean error <= B kilometers
```

Tests report private arithmetic and public post-quantization failures separately. They do not
relax an arithmetic failure merely because the larger public budget would hide it.

### Canonicalization order and authority boundaries

At an unknown or calculation boundary, implementations:

1. validate type, finiteness, latitude/radius/range preconditions, and transform domain;
2. transform using explicit source and destination types;
3. canonicalize and quantize for the accepted destination space;
4. validate topology, extent, and other invariants on the quantized result; and
5. persist or compare the already canonical integers.

Root-coordinate seed keys use canonical `PlanetPoint` ticks, never raw floating-point angles or
display coordinates. Changing the tick policy therefore requires a seed-compatibility decision
as well as a persistence migration.

`PlanetPoint` and `RegionalPoint` are authoritative semantic coordinates. World-atlas display
projections, the Milestone 1 proof's fit-to-scene mapping, `RenderScene` pixels, Canvas backing
pixels, viewport/screen coordinates, and print points are derived values in distinct types.
They are not accepted geometry, root-coordinate keys, inherited context, or canonical aspect
bytes. A pointer selection can become geography only after an explicit inverse display mapping
produces and validates a canonical `PlanetPoint`.

The proof scene adapter consumes accepted quantized `PlanetPoint` geometry and emits disposable
render pixels as required by the kernel-proof contract. It never consumes `ProofInputCoordinate`
directly. Milestone 1 does not establish a production world-atlas projection or print transform.

### Fixed compatibility vectors

The following vectors are permanent inputs for the issue #42 unit/property-style tests. `Q`
means `2^32` ticks per turn. Exact tick expectations have zero tolerance.

| Case                  | Angular input                        | Expected `(longitudeTicks, latitudeTicks)` |
| --------------------- | ------------------------------------ | ------------------------------------------ |
| Equator origin        | `(0, 0)`                             | `(0, 0)`                                   |
| Positive seam         | `(+pi, 0)`                           | `(-2147483648, 0)`                         |
| Negative seam         | `(-pi, 0)`                           | `(-2147483648, 0)`                         |
| East seam neighbor    | `(+pi - tau / Q, 0)`                 | `(2147483647, 0)`                          |
| West seam neighbor    | `(-pi + tau / Q, 0)`                 | `(-2147483647, 0)`                         |
| North pole            | `(+pi / 2, +pi / 2)`                 | `(0, 1073741824)`                          |
| South pole            | `(-pi / 2, -pi / 2)`                 | `(0, -1073741824)`                         |
| Near north pole       | `(+pi / 2, +pi / 2 - tau / Q)`       | `(1073741824, 1073741823)`                 |
| Snap to north pole    | `(+pi / 2, +pi / 2 - tau / (4 * Q))` | `(0, 1073741824)`                          |
| Positive half-step    | `(tau / (2 * Q), 0)`                 | `(1, 0)`                                   |
| Negative half-step    | `(-tau / (2 * Q), 0)`                | `(-1, 0)`                                  |
| One-and-a-half tie    | `(3 * tau / (2 * Q), 0)`             | `(2, 0)`                                   |
| Negative-zero input   | `(-0, -0)`                           | `(0, 0)`                                   |
| Latitude out of range | `(0, pi / 2 + tau / Q)`              | rejected                                   |

Regional millimeter quantization uses the same tie rule:

| Kilometer input | Expected millimeter ticks |
| --------------- | ------------------------- |
| `+0.0000005`    | `1`                       |
| `+0.0000015`    | `2`                       |
| `-0.0000005`    | `-1`                      |
| `-0.0000015`    | `-2`                      |
| `-0`            | `0`                       |

For the following projection vectors, use radius `R = 1000 km`. Expected regional values are
analytic pre-quantization values; the parenthesized millimeter ticks are the accepted quantized
values. Every successful interior forward/inverse pair must meet both error budgets above.

| Origin planet ticks | Target planet ticks       | Expected regional point                   |
| ------------------- | ------------------------- | ----------------------------------------- |
| `(0, 0)`            | `(536870912, 0)`          | `(R * pi / 4, 0)` = `(785398163, 0)` mm   |
| `(0, 0)`            | `(0, 536870912)`          | `(0, R * pi / 4)` = `(0, 785398163)` mm   |
| `(1879048192, 0)`   | `(-1879048192, 0)`        | `(R * pi / 4, 0)` = `(785398163, 0)` mm   |
| `(0, 1073741824)`   | `(0, 536870912)`          | `(0, -R * pi / 4)` = `(0, -785398163)` mm |
| `(0, 1073741824)`   | `(1073741824, 536870912)` | `(R * pi / 4, 0)` = `(785398163, 0)` mm   |
| `(0, 0)`            | `(-2147483648, 0)`        | rejected antipode                         |

The seam-crossing row proves that the shortest wrapped delta is used. The pole rows prove the
fixed prime-meridian frame. At `R = 1000 km`, the continuous hemisphere edge is
`1570.796326794...` km, so its canonical radius is `1570796326` mm. The exact north-pole target
from an equatorial origin would round outward to `(0, 1570796327)` mm and is rejected; inverse
mapping accepts `(0, 1570796326)` mm and rejects `(0, 1570796327)` mm. Round-trip property inputs
remain at least `B` inside the accepted radius.

An extent with `minX = -1000`, `maxX = 1000`, `minY = -2000`, and `maxY = 2000` millimeter ticks
contains all four exact corners and rejects a point one millimeter beyond any edge.

The proof transform has these exact vectors:

| `ProofInputCoordinate` | Expected planet ticks      |
| ---------------------- | -------------------------- |
| `(0, 0)`               | `(-327680000, -327680000)` |
| `(5000, 5000)`         | `(0, 0)`                   |
| `(10000, 10000)`       | `(327680000, 327680000)`   |
| `(10000, 0)`           | `(327680000, -327680000)`  |

These vectors may change only through a superseding compatibility decision that accounts for
accepted documents, seed keys, transform versions, and canonical fixtures.

### Milestone 1 exclusions

This decision does not implement or select:

- a production world-atlas display projection or projection controls;
- arbitrary regional-map rotation, overlapping footprints, geographic clipping, or production
  footprint size/shape policy;
- an ellipsoid, height/depth coordinate, terrain field, spatial index, or third-party geometry
  library;
- screen-to-geography editing, print layout, or export units; or
- settlement, underground, building, battle-map, or other deferred scale coordinates.

Those features must consume this contract or explicitly supersede the affected part when their
active milestone demonstrates a different need.

## Consequences

### Positive

- The seam and poles have one canonical persisted representation while algorithms retain the
  correct spherical topology.
- Planet quantization represents a full turn and both poles exactly with safe integers.
- Regional geometry uses readable physical units and an invertible projection independent of
  atlas display.
- The proof transform produces accepted planet ticks with exact integer arithmetic.
- Canonical root-coordinate keys and cross-platform fixtures do not depend on floating-point
  serialization.

### Negative

- Longitude/latitude still requires seam-aware path and polygon algorithms.
- One-millimeter regional quantization is deliberately scale-specific and will not automatically
  suit later battle-map or building coordinates.
- Azimuthal equidistant projection preserves distance and direction only from its origin; shape,
  area, and distances between arbitrary off-origin points are distorted.
- Spherical worlds exclude ellipsoidal or non-spherical planet models until a later compatibility
  decision justifies them.

### Neutral or follow-up

- [Issue #42](https://github.com/ChadHealey/ttrpg-map-generator/issues/42) implements the branded
  records, validation, quantizers, transforms, and fixed tests.
- [Seed derivation](https://github.com/ChadHealey/ttrpg-map-generator/issues/6) and
  [persistence](https://github.com/ChadHealey/ttrpg-map-generator/issues/8) consume canonical
  ticks but retain their own version and schema decisions.
- [Map and parent-context records](https://github.com/ChadHealey/ttrpg-map-generator/issues/7)
  persist the versioned transform parameters and source provenance; this ADR does not define
  that record schema.
- A later world-atlas issue selects a derived display projection without changing authoritative
  planet geometry.

## Compatibility and migration

- **Accepted world documents:** No released document contains these coordinates. Future accepted
  points use the canonical ticks above; a replacement policy requires explicit migration and
  must not silently rewrite child geometry.
- **Persisted schemas and migrations:** This ADR creates no schema. The first `.mapworld` schema
  must encode integer planet ticks, integer millimeter ticks, planet radius, and transform
  identity and version without re-rounding.
- **Generator, seed, parameter, context, or style versions:** No existing version changes. Future
  root-coordinate seed and inherited-context versions depend on these exact ticks; changing them
  requires the smallest truthful compatibility version changes.
- **Canonical semantic/SVG/visual fixtures:** Existing Milestone 0 fixtures do not contain domain
  coordinates and remain unchanged. The Milestone 1 semantic fixture will adopt the exact proof
  vectors; render and SVG mappings remain derived evidence.
- **macOS and Linux determinism:** Integer canonical forms, explicit ties-away-from-zero rounding,
  and fixed validation vectors must produce identical accepted bytes on both platforms.
- **Parent and child maps:** The transform defines the future `WorldMap -> RegionalMap` physical
  relationship. A parent radius, origin, transform-version, or source-context change marks an
  affected child stale according to reconciliation policy; it does not mutate the child.

## Validation

Issue #42 must add focused unit and property-style tests for every fixed vector, invalid input,
seam equivalence, pole canonicalization, near-pole transform, hemisphere boundary, extent edge,
round trip, composition, and quantization budget. Randomized transform tests record a seed and
minimized counterexample. The same vectors run on macOS and Linux through the shared fixture
path when they become persisted evidence.

Review must also confirm that public domain APIs expose qualified branded coordinates rather than
an unqualified `{ x: number, y: number }`, that display/render types cannot be assigned to domain
points, and that the proof render adapter receives accepted `PlanetPoint` values only.

## Revisit conditions

- A representative world workload demonstrates unacceptable seam or pole complexity with the
  longitude/latitude chart.
- A required region cannot fit within one origin-centered hemisphere or the projection's measured
  distortion violates its product needs.
- A supported map scale needs physical precision that cannot be expressed by a distinct
  scale-owned coordinate policy.
- Ellipsoidal or non-spherical planets become an active product requirement.
- Cross-platform tests demonstrate that the stated arithmetic error budgets are insufficient for
  valid inputs despite stable formulas and implementations.
