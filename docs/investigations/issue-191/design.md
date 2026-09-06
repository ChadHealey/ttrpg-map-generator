# Issue 191 — frozen state 1 design

Declared before any useful field evaluation. One state is selected for this run; there is no
state 2 declaration or automatic retry. The complete numeric parameter table is
[state-1.json](state-1.json); all intervals are uniform half-open intervals. Angles are radians,
areas are fractions of the unit sphere, and local coordinates are the geodesic logarithmic map
at the owner center. Binary64 is used except the deliberately integer hash and production ticks.

The scope is issue 191's private field comparison. ADR-0029 is unchanged. No anatomy measurements,
semantic proof, production acceptance, fixture updates or public control changes are authorized.
The exact corpus is the six issue-183 retained inputs followed by default-001 through default-012
from issue 180. Sweep is default-001 through default-128, in order, without substitutions.

## Quotas and placement

Before geometry, allocate all 1..8 requested slots. Balanced weights are 1; varied weights are
squares of seeded sizes in [0.65,1.9); oneDominant uses weight 5 for owner0 and 1 for each other
slot. Normalize weights once to requested land fraction. No later transfer/drop is possible.
Each owner cap radius is acos(1 - 2 * quota * 1.55) + 0.05. Invalid capacity is explicit failure.
The guard is cap radius minus 0.05: all positive contributions vanish outside it. Placement
mirrors issue 170: 64 attempts, 128 directions per owner, 64 refinement sweeps, steps
[0.08,0.04,0.015,0.005], pair gap 0.05 plus 1e-12 binary64 comparison reserve, stable ID ties.
Placement exhaustion is no proposal, never an infeasibility theorem unless the pair bound proves it.

## Field terms

The soft anisotropic envelope is exp(-2*((u/a)^2+(v/b)^2)), with a = 0.72*guard*sqrt(elongation),
b = 0.72*guard/sqrt(elongation). Seeded placement orientation supplies the axis bearing.
Inside the same envelope support add two unequal Gaussian lobe log-score terms at independent
seeded radial positions and separated bearings. Their distance/width intervals are guard fractions.
The peninsula is a smooth curved ridge starting at a seeded body radius, with nominal length
0.20..0.45 and width 0.08..0.16. Its lateral quadratic curve has a seeded signed bend. The bay is
an outward-open smooth depression with a quadratic curved centerline, nominal depth 0.15..0.30
and opening 0.12..0.30. Fragmentation strengthens this depression continuously. These are nominal
construction parameters, not surviving-anatomy certificates; the measurement child owns survival.

Warp the local coordinates using two independently keyed gradient fields at wavelength 1.4,
amplitude 0.13 before evaluating these structures. Add exactly two detail octaves at wavelengths
0.8 and 0.4 with amplitudes 0.22 and 0.10. The project-owned noise uses 32-bit integer hashing,
eight axis/diagonal gradients and quintic polynomial fade; it does not consume per-point RNG draws.

Multiply the positive envelope/structural score by a quintic guard taper of width 0.10. Add
seeded soft island and archipelago caps at irregular owner margins; their total support-cap area
is bounded by quota * (0.04*islandRatio + 0.05*archipelagoRatio). Cap radii are further restricted
by available margin clearance, which only reduces reserve use. Overlap counts once at calibration.
Island abundance zero creates zero isolated terms; archipelago abundance zero creates zero group
terms. Nonzero counts are ceil(4*ratio) and ceil(7*ratio); group bearings share an initial seeded
bearing with independently seeded offsets. These are construction slots, not promised components.

A global polar draw realizes a planet-pole term with probability 0.35 under neutral, 0.85 under
landBiased and 0 under oceanBiased. A hemisphere draw selects north or south. When realized,
rotate the entire separated layout so its largest owner is centered on that actual planet pole;
rotate local frames identically, preserving pair distances. Add a soft pole-centered radius-0.42
score of 0.7 within that owner guard. Under oceanBiased subtract the declared pole depression
from the body log-score at both actual poles. Finite polar land consumes the owner's quota in
exactly the same union accounting as body/island land. Realization intention and actual pole
classification are separately reported. This does not promise that every selected term survives.

## Calibration and production sampling

One fixed preview-anchor score pass precedes sampling. For each owner, sort its positive scores
by descending score, stable anchor index on ties, and choose the midpoint at its immutable
weighted quota. The weight is production's round-away(cos(latitude)*2^20); poles have zero area
weight. Insufficient positive support is explicit no proposal. No geometry parameter is changed.
For positive owner score s and selected cutoff c, scalar = (s-c)/(s+c); outside all guards it is
exactly -1. This monotone normalization maps each quota contour to zero, counting the entire
union once, including islands and polar terms. It is continuous at the guard. Production
quantization and preview threshold selection then determine the shared accepted contour.
No outside-owner land is masked away: any such sample or threshold at/below the ocean floor
is an explicit failure. Owner errors above 25/count bp are also reported as no proposal.

Sample both production profiles independently (do not reuse preview bytes) to prove shared
anchor equality. Hash explicitly big-endian ticks. Each phase also checks canonical seam and
pole alias identities without extra field calls. Retain weighted per-owner areas, primary count
from largest connected body per owner at least half the largest, global coverage errors,
and exact nearest inter-owner land-anchor distance via a Euclidean 3D bounding tree (chord to
angle). This is the requested gap diagnostic, not the deferred anatomy suite.

Rasterize the full classification with nearest canonical anchors at 1600x800, dark land and
light water, then retain its exact even-address 800x400 mask. No smoothing or geometry repair.
No-proposal placement rows retain explicitly identified all-water diagnostic images and null
unavailable measurements; they are never presented as successful sampled worlds.

## Stream registry and budgets

Every name starts `worldTerrain.macroElevation.v3.issue191.`. Scope hash inputs are the exact
seed string, full scope and zero-based draw counter, JSON-framed then SHA-256, first BE uint32
scaled by 2^-32. This private counter stream follows issue 185's concern structure but does
not claim to implement its proposed production xoshiro stream. Every created scope and actual
consumption is retained. Reopening a scope or exceeding its limit throws.

| Suffix                                     | Limit | Draw meaning                                                                                                                                                                                |
| ------------------------------------------ | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| global.quotas                              |     8 | One size draw per requested slot, also consumed for balanced/dominant                                                                                                                       |
| global.polar                               |     2 | Realization and hemisphere                                                                                                                                                                  |
| placement.attemptA.codeRotation            |     3 | Quaternion rotation                                                                                                                                                                         |
| placement.attemptA.ownerO.centerDirections |   256 | Two draws per candidate direction                                                                                                                                                           |
| placement.attemptA.ownerO.refinement       |    64 | One bearing per sweep                                                                                                                                                                       |
| placement.attemptA.ownerO.orientation      |     1 | Envelope frame bearing                                                                                                                                                                      |
| ownerO.structure                           |    24 | Elongation; lobe bearing/separation, distances, widths, weights; ridge bearing, root, extent, width, bend; bay bearing, depth, opening, bend; four noise keys; group bearing; reserved draw |
| ownerO.islandM                             |     3 | Bearing, margin distance, unequal area weight                                                                                                                                               |
| ownerO.archipelagoMemberM                  |     3 | Bearing offset, margin distance, unequal area weight                                                                                                                                        |

O=0..7, A=0..63, isolated M=0..3, group M=0..6. State 1 has 146 useful calibrated
world builds per phase: 18 full rows plus 128 preview sweep = 146 (the twelve overlapping seeds
are intentionally evaluated in both workloads). Exactly one initial and one repeat phase.
Per successful build: one 130562-anchor raw calibration pass, one 130562-anchor preview sample,
plus one 2095106-anchor full sample for cohort rows. Maximum evaluations per phase are
146*261124 + 18*2095106 = 75836012. Unit tests use only synthetic non-corpus points, budgeted
separately at at most 10000 evaluations per invocation; retained evidence tests use zero calls.

## Evidence and pre-execution review

The runner exclusively reserves the state folder and each initial/repeat claim before work.
Capture source closure, package/lock/tool configuration, design, parameters and fixed inputs first.
Each phase retains reports and image digests; repeat retains its own images and reports so a
mismatch cannot destroy initial evidence. Source hashes must still match before repeat.
A read-only verifier imports no evaluator or field and makes zero field evaluations. It checks
exact inventory, source closure hashes, claims, counts and initial/repeat equality. Hashes and
repeat receipts detect accidental drift, not malicious coherent rewriting; dedicated review
must examine and pin the manifest digest. No independent computational replay is claimed.

Assistant pre-execution design review: the single literal state covers all requested terms;
quotas are immutable, every positive term is under one guard, polar rotation preserves gaps,
and calibration has a finite single order-statistic pass. Main risks: rounded envelope grammar,
guard taper dominating low contours, satellites disappearing into body land, and low-water
placement exhaustion. Keep every failure. There is no per-row adjustment or third state.
This is a design review by the implementing assistant, not the later dedicated read-only review.
