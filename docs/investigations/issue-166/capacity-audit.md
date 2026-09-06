# Capacity audit — normal-01

## Inputs, units and source trace

Read `reports.find(r => r.family === 'envelope' && r.input.id === 'normal-01')` in the retained
[receipt](../issue-165/comparison-r1/results.json), rather than interpreting the rounded README
table as raw data. The input is seed `1`, circumference 40000 km, water target 65%, count intent 4,
distribution `varied`, fragmentation 35%, islands 35%, archipelagos 25%, ocean connectivity
`singleGlobal`, polar character `neutral`. Angles are radians on the unit sphere. Area fractions
use the entire sphere as denominator; multiply by 100 for percent or by 4π for steradians.
Physical sphere area would be circumference²/π km²; it is not needed for these angular checks.

[Baseline construction](../issue-164/morphology.mjs), `createField`, gives sizes
`[0.95, 0.95, 0.55, 0.55]`. [Quota source](../issue-165/field.mjs), `budgetShares`, squares and
normalizes them: sum of weights = 2.41; primary share = 0.9025/2.41 = 0.3744813278008298.
`calibrate` sets q = (1 − 65/100) × share, so each first owner requests
0.13106846473029043 of sphere area. Each remaining owner requests 0.04393153526970954.
These are construction-owner quotas, not semantic continent areas or a public visual-count rule.

## What the receipt's capacity means

`calibrate` visits x = 0..399 and y = 1..199 with latitude π/2 − yπ/200. For each owner it keeps
points with positive guard, sums cos(latitude) for positive **rounded** scalar ticks, and divides
by `400 × sum_y cos(latitude)`. Poles carry zero area; the seam has no duplicate column.
Its `capacity` is that sampled area at threshold −4,000,000 ticks (−4 scalar units), not an
analytic integral of the cap. Its `floor` is sampled area at +4,000,000 ticks, not a general proof
that all possible broad terms vanish there. The retained fixed island terms can impose a floor.

Each owner gets 24 integer bisections within those endpoints, followed by the smaller-error
endpoint (high wins ties). `capacity < quota` or `floor > quota` fails before the error-tolerance
test. A failed row retains its diagnostic contour; it is not accepted. No quota is transferred.

| Owner index | Requested sphere % | Sampled capacity % | Shortfall, percentage points | Selected ticks | Receipt status  |
| ----------- | -----------------: | -----------------: | ---------------------------: | -------------: | --------------- |
| 0           |    13.106846473029 |    12.372378143625 |               0.734468329404 |       −4000000 | capacity-failed |
| 1           |    13.106846473029 |    11.709597391319 |               1.397249081710 |       −4000000 | capacity-failed |

The owner tolerance is 0.25/4 = 0.0625 percentage points of sphere area; both deficits exceed it.
The unchanged preview/full total-water tolerance is 0.25 percentage points. Summing all four
realized owner fractions gives preview water 67.1324455742691%, agreeing with the receipt's
67.13244557426923% within 1.3 × 10⁻¹³ percentage points (different summation order). Full water is
67.14310782076103%, an error of +2.1431078207610312 percentage points. The latter is retained
evidence, not a new full-grid measurement.

## Independent analytic upper bound for these fixed caps

For a spherical cap of radius r, direct integration gives
`A(r) = (1/(4π)) × integral_0^r 2π sin(t) dt = (1 − cos(r))/2`.
The continuous guard requires every positive term to stay inside that cap. Therefore q ≤ A(r)
is a **necessary**, not sufficient, exact-area condition for any shape in this fixed support.
It is not a quadrature error estimate. Even allowing the entire owner tolerance, q − 0.000625
exceeds each analytic cap below.

| Owner | Reconstructed r, rad | Analytic cap, sphere % | Analytic shortfall, pp | Minimum r for q with no shape/water reserve, rad | Cap at r − 0.02, sphere % |
| ----- | -------------------: | ---------------------: | ---------------------: | -----------------------------------------------: | ------------------------: |
| 0     |       0.718621905077 |        12.364314518591 |         0.742531954438 |                                   0.740897525854 |           11.713537307267 |
| 1     |       0.698415653018 |        11.706905436511 |         1.399941036518 |                                   0.740897525854 |           11.071601562499 |

`r_required = acos(1 − 2q)` assumes every point of the cap may be land. Any guard clearance,
embayment or other reserved water increases the required capacity. The illustrative 0.02-rad
erosion uses the existing contact diagnostic distance; it is **not** an accepted feature margin.
The sampled capacities exceed the analytic caps by approximately 0.008064 and 0.002692 percentage
points. A sampled estimate must not be cited as the exact support area.

The [gap proof](../issue-165/geometry.md) uses rᵢ = (nearestᵢ − 0.05)/2; hence
`rᵢ + rⱼ + 0.05 ≤ d(cᵢ,cⱼ)`. All terms, including satellites and positive polar bias, are under
the final guard. Enlarging a cap at fixed placement is not automatically admissible: recheck
every pair. The negative result here is for the retained caps/quotas. It proves neither global
packing impossibility nor failure of every placement or either algorithm family.

## Why maximum expansion erases the hierarchy

For these first two owners all lobe/cut/island axes are in (0, π/2), and their radii are below 2.
For `signedEllipse`, the rotated tangent norm is at most one. Dividing by the smaller sine axis
then multiplying by that sine bounds its first term below by sin(min-axis) − 1 ≥ −1; the
center-facing dot-minus-cos term is at least −2. Thus each signed ellipse is at least −2.
Its first term is at most 1, so the cut maximum is at most 1. Consequently
`broad = min(max(lobes), −max(cuts)) ≥ −2` for neutral polar bias.

At the selected −4-unit threshold, `broad − threshold ≥ 2 > radius ≥ guard`. The final owner
scalar is therefore exactly its guard throughout the sphere, regardless of islands. Positive
analytic land fills the open cap; rounding only removes its thin near-zero boundary band.
This is a concrete failed feature-survival obligation: the initial cuts and lobe hierarchy
cannot survive that expansion. Other owners' guards are negative inside this cap.

This agrees with the retained human rationale (featureless support caps) and the
[measurement source](../issue-165/measure.mjs): `measure` weights estimated coast edges, while
`guardContact` classifies envelope clearance ≤ 0.02 rad as contact. Normal-01's confirmed fraction
is 0.5810141168196012 after quotas versus baseline 0.31129641801402136. These fractions include
all owners/islands and approximate coast length; they do not mean that 58.1% of land area is guard.
`islandEffects` reports winning samples and distance to the largest realized owner component's
sampled coast. A vanished term can be occluded, and a related center does not certify a retained
island, detached status, or visual quality.

The old and new normal-01 initial water happen to equal 87.80689994998355% on this grid.
Nevertheless issue 165 also repaired scalar continuity (chord ellipses, continuous islands,
continuous guards). This was not a quota-only controlled comparison. Do not attribute every
old/new visual or contact difference solely to quotas.

## Reproduce the bounded arithmetic

Run from the repository root with Node. This reads the retained receipt, verifies its seven
source hashes, and reconstructs unchanged owner descriptors; it never calls calibration,
sampling, rendering, fixture generation, or a new policy implementation. Binary64 calculations
are reported to 12 decimal places; the derivations above are real-arithmetic statements, not
formal bounds on floating-point error. Do not infer cross-platform equality from this run.

```sh
node --input-type=module <<'JS'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createField, budgetShares } from './docs/investigations/issue-165/field.mjs';
const dir = 'docs/investigations/issue-165/';
const receipt = JSON.parse(fs.readFileSync(dir + 'comparison-r1/results.json'));
for (const [path, expected] of Object.entries(receipt.sources)) {
  const actual = createHash('sha256').update(fs.readFileSync(dir + path)).digest('hex');
  if (actual !== expected) throw new Error('Source mismatch: ' + path);
}
const row = receipt.reports.find(r => r.family === 'envelope' && r.input.id === 'normal-01');
const field = createField('envelope', row.input);
const shares = budgetShares(field.owners);
const cap = r => (1 - Math.cos(r)) / 2;
for (let i = 0; i < 2; i++) {
  const owner = field.owners[i];
  const r = owner.radius;
  const axes = [...owner.lobes, ...owner.cuts, ...owner.islands]
    .flatMap(s => [s.major, s.minor]);
  if (!(r < 2 && axes.every(a => a > 0 && a < Math.PI/2)))
    throw new Error('Guard-saturation proof assumptions failed');
  const q = (1 - row.input.controls.targetWaterCoveragePercent / 100) * shares[i];
  const stored = row.calibration.owners[i];
  if (row.input.controls.polarCharacter !== 'neutral' || stored.threshold !== -4000000)
    throw new Error('Guard-saturation input changed');
  if (Math.abs(q - stored.quota) > 1e-15) throw new Error('Quota mismatch');
  if (!(q - 0.000625 > cap(r))) throw new Error('Negative case did not reproduce');
  console.log(i, [r, 100*q, 100*stored.capacity, 100*(q-stored.capacity),
    100*cap(r), 100*(q-cap(r)), Math.acos(1-2*q), 100*cap(r-0.02)]
    .map(v => v.toFixed(12)).join(' '));
}
console.log('preview water', 100*(1-row.calibration.owners.reduce((s,o)=>s+o.realized,0)));
JS
```
