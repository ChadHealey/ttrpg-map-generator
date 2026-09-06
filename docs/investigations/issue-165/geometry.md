# Geometry and continuity argument — issue-165-r1

This proof describes the [fixed experiment](experiment.md), not a production acceptance contract.
The focused tests are [field.test.mjs](field.test.mjs); exact matrix receipts are in
[results.json](comparison-r1/results.json).

## Every land-forming term obeys the 0.05-rad gap

For envelopes with distinct centers separated by d(i,j), the inherited radius is half the nearest
center distance minus half g, where g = 0.05 rad. Thus r(i)+r(j) ≤ d(i,j)−g. A retained point has
positive final guard, hence lies strictly inside its owner cap. Triangle inequality bounds the
distance between retained points of different owners strictly above g. Single-owner separation
is vacuous; its cap remains finite. Broad lobes, margin cuts, islands/groups and polar bias all
occur inside min(shape, guard). No contour offset or positive satellite can bypass this min.

For cellular fields, each site dot product has geodesic Lipschitz constant at most one. Maximum
preserves that bound; adding independently warped waves gives

```text
L_owner ≤ 1 + (0.065*3 + 0.035*6 + 0.01*11)*(0.65 + fragmentation/100)
        ≤ 1.84975 < L = 1.86.
```

For owners i and j the score difference has bound 2L. A positive final field of i requires
score_i−score_j > L*g+0.000002; a retained point of j requires the opposite strict inequality.
The change exceeds 2L*g, so the points must be more than g apart. Other owners do not weaken
this pairwise condition. Bias constants do not alter derivative bounds. The same guard contains
all island and polar terms, including the abundant, land-biased focused probes.

Positive quantized ticks imply a positive pre-quantized scalar, so rounding cannot create a
new positive point outside this proof. This is an analytic argument with a small numeric margin;
it is not a formal IEEE-754 error bound or a proof of a production interpolated coastline.

## Scalar continuity, ownership and poles

Each chord ellipse uses dot products, hypot, positive constant axis divisors and a center-facing
cap. Each is continuous everywhere on the sphere, including the antipode; no log-map sentinel
or positive island step is retained. Maxima of lobes and islands, minima with cuts/guards,
sinusoidal owner waves and polynomial polar terms preserve continuity. Great-circle distance is
continuous even where its derivative is singular. Independent constant contour offsets preserve
continuity. The final field is a maximum over every guarded owner, including negative values;
it never switches an arbitrary scalar on a hard ownership branch. Owner indices may switch in
water, while the scalar remains continuous. The selected analytic contour is zero.

The tests bisect hundreds of retained contour crossings, converge from both sides to zero,
probe shape-cap/center/antipode limits, and converge at every owner margin. They also test
seam limits and every shared preview/full scalar and owner anchor. Those samples support the
continuous formulas; they are not offered as a substitute for them.

All geometry starts with canonical unit vectors. The test-only forced-pole hook rotates the
entire owner construction, including all local frames, sites, waves and ocean competitors,
to place owner zero at each pole. It preserves angular separation and reconstructs the
latitude-dependent polar modifier at the forced position. Positive land is asserted at both
forced poles. Longitude aliases produce exactly one pole coordinate and sample; rendering repeats
that sample across the pole row only. Each matrix row has retained seam land, not merely an
all-water alias check. Every row verifies 80,400 nested anchors and 722 pole aliases.

## Bounded failure and diagnostic limitations

The inherited placement budget and finite subfeature counts are unchanged. Quota calibration
always uses 24 integer bisections per owner with endpoints ±4,000,000 ticks and first deterministic
tie choice (high on equal error). Capacity, island floor and quota-error failures are explicit;
there is no retry, quota redistribution or gap reduction. Synthetic no-capacity, island-floor
and indivisible-area cases exercise deterministic failure. The real matrix supplies three failed
envelope rows, including failure after maximum broad expansion.

Guard contact is defined against original construction support, not a rendered stroke. Exact
cap clearance is available for envelopes. The cellular normalized score slack is only a lower
bound on distance to a guard. A slack larger than delta excludes contact; otherwise 32 tangent
probes may prove a boundary within delta by continuity. Undetected contacts remain unresolved,
reported in the upper fraction. The diagnostic never calls this direction sampling an exact
nearest-boundary solver. Grid edges and dual lengths approximate the realized coast; feature
survival and component classification remain resolution-sensitive.
