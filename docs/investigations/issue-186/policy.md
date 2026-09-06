# Issue 186 preliminary policy and evidence plan

This is an unexecuted design for review. No six-row field was sampled, constructor rerun,
extractor executed or repository file changed while preparing it. The sole checkpoint is
issue-184/comparison-r1, with the issue's pinned manifest/results hashes. Its six original
rows remain in the specified order; its visual rejection is irrelevant to this independent
arithmetic test. Proposed identifiers below are unaccepted and are not production records.

## One normalization

Use N(F)=min(1,max(-1,F)) on the finite continuous evaluate(point) output. Reject non-finite
values. Canonicalize a zero result to +0. Do not call raw(), apply the private million-tick
quantizer, divide by an observed range, or choose a per-row scale. Apply the public production
quantizer once: ties away from zero at Q=2^24. N preserves sign and the exact zero set of every
finite F, because it is identity on [-1,1] and maps the two outside intervals to same-sign
endpoints. Quantization does not preserve the strict positive set: 0<F<1/(2Q) becomes zero.
Positive exact half quantum becomes +1; negative exact half quantum becomes -1.

Normalization is proposed field behavior 3, not an invisible change to behavior 1 or 2.
Saturation destroys an inverse-distance interpretation outside the unsaturated band. Clamping
is non-expansive as a scalar map, but that fact does not prove a global lower gradient bound.

## Exactly two candidate policies

H uses parseAtlasFieldValueTicks(0), then createAtlasContourLevel on that branded result.
The resulting doubled contour is 1. Classification is the unchanged public isAtlasLand:
2*tick>1, equivalent to tick>0. Extract with the unchanged public spherical-marching-cells
adapter version 1, including its exact BigInt determinant >=0 pairing and polar triangle
fans. This is not a zero contour: interpolation locates +1/2 tick in the quantized field.
Zero edges, zero samples and plateaus are ordinary water values for H. The existing public
adapter's diagnostics or downstream topology failures return no proposal, never repair.

Z is a private regular-domain genuine-zero policy, proposed extraction version 2. Its input
type has an explicit fixed-zero policy discriminant and no AtlasContourLevel argument. Land
is tick>0; zero is water for classification. Before extraction, any quantized zero anchor
returns zero-anchor-degeneracy with exact count and first canonical address. This explicitly
rejects exact-anchor crossings, adjacent-zero edges, plateaus and sampled zero tangencies;
it does not perturb them, omit their vertices or select a favorable incidence resolution.
An alternating-sign quad with ac-bd=0 also returns zero-saddle-degeneracy before extraction.
A nonzero determinant uses the unchanged sign of the determinant for pairing. All other
cells use the existing spherical marching-cell boundary: exact integer sign decisions,
BigInt rational zero interpolation, ties-away displacement rounding followed by integer
translation, source transitions,
land-left orientation, canonical seam and unique poles. Invalid topology returns no proposal.

The private Z implementation may copy the bounded existing extractor and its small geometry
helpers with attribution, changing only the type/version, fixed-zero sign arithmetic and
preflight degeneracy rule. It imports public core/generation types and public topology adapter;
no private production imports, unsafe zero brand cast or fabricated version-1 adapter exists.
If preserving this boundary needs a broader graph or representation redesign, Z is rejected
with the concrete conflict; a third policy or topology architecture is outside this issue.

This restricted Z policy deliberately does not solve the general endpoint-incidence problem.
Source correction during implementation preparation: the existing stitch graph keys by
coordinate alone; coordinate-plus-transition keys only canonicalize ring ordering. A zero
sample can place several edge incidences at one coordinate and violate the graph's required
in/out degree of one. Resolving every such incidence needs its own exact contract. This is not a claim that all genuine-zero representations
are impossible. Undetected subcell tangencies remain a sampled-data limitation for both
policies, and cannot be reported as proved absent in the original continuous field.

## Eight declared synthetics

One scalar vector plus seven sparse lattice fixtures; no alternate successful fixtures.
Lattice fixtures use the genuine public preview profile (512x256, unique poles), default
value -16 ticks, and the literal overrides below. Integer ticks enter through the public
parser. Small refers to literal support size, not a made-up branded sampling profile.
Array rows increase in latitude and columns increase in longitude. Coordinates are sample
addresses, not authored geographic polygons. Both policies see the exact same arrays.

1. quantizer-boundaries: continuous [-2,-1,-1/(2Q),-1/(4Q),-0,+0,1/(4Q),1/(2Q),1,2];
   expected normalized ticks [-Q,-Q,-1,0,0,0,0,1,Q,Q]. Record signs/zeros/saturation.
2. plateau: at longitude 100..103, latitude 100..103, rows [[16,16,16,16],[16,0,0,16],[16,0,0,16],[16,16,16,16]]. Z rejects; H's actual closed rings and source coverage are measured without assuming the plateau becomes a hole.
3. anchor-crossing: at longitude 100..102, latitude 100..102, rows [[-16,0,16],[-16,0,16],[-16,0,16]]. Z rejects; H is evaluated normally.
4. saddles: disjoint 2x2 blocks at (100,100) [[16,-16],[-16,16]] and at (110,100) [[32,-16],[-16,16]], plus a third at (120,100) [[17,-16],[-16,17]]. Their Z determinants are 0, 256 and 33 tick-squared respectively. H uses doubled shifted signs 2*tick-1, yielding determinants -128, 864 and 0 respectively. Thus the first block is a Z tie only, and the third is an actual H tie. Z rejects the complete fixture with all three blocks retained; H executes its unchanged >=0 pairing on the third block and reports the complete result without omitting the other blocks.
5. seam: +16 at longitudes {510,511,0,1} and latitudes {127,128,129}; all others -16.
   Test closure, wrap aliases, transitions and component identity without duplicating a seam.
6. poles: north pole +16, all longitudes of rows 254/255 +16; south pole +16 and all
   longitudes of rows 1/2 +16. All others -16. Exactly two unique pole samples, not 512
   independent evaluations per pole; classification and fan closure checked for both caps.
7. neck-and-island: at (100,100), rows [[16,16,-16,-16,-16,16,16], [16,16,16,16,16,16,16],[16,16,-16,-16,-16,16,16]], plus isolated +16 at (112,101). Record connected foreground, retained isolated component, raw/simplified topology and any sampled neck loss. This does not prove an arbitrary subcell neck survives.
8. tangent-contact: one zero anchor at (100,100), all other values -16. Z rejects;
   H emits no land ring. This exact sampled tangent is distinct from unsampled tangency.

Any unexpected result is retained. No synthetic image is needed unless a failure needs a
source/contour overlay; at most six diagnostic panels across the entire issue.

## Proposed complete version tuples (both unaccepted)

Common: generator/macro field pair (3,3); macro parameter schema 2 with upstream water;
sampling policy 1; preview world-atlas-preview-v1, full world-atlas-full-v1; quantizer Q=2^24
with ties-away identity unchanged; seed derivation/stream algorithms 1; classification parameter
schema 2, classification behavior 2 and realization 2, because fixed contour replaces percentile
selection. Schema 2 is required to persist the explicit fixed-policy discriminator and bind it
to the matching output behavior; keeping schema 1 would conceal the removal of preview threshold
selection. Realization 2 identifies the changed accepted land/water contour decision even for H,
whose stored odd integer happens to remain representable. These are new proposed values after
current classification/schema/realization 1, not assertions of released support. Semantic policy 1 and geography contract 1 are not changed or proved by this work.

H: explicit fixed-half-tick policy H1, existing odd doubled representation equal to 1;
coastline geometry behavior 1, extraction 1, simplification 1, topology validation 1.
Z: explicit fixed-zero regular-domain policy Z1, new discriminated zero representation;
coastline geometry behavior 2 and extraction 2; unchanged simplification 1/topology validation 1.
The geometry behavior version distinguishes new zero/extraction semantics even if point/ring
shape types remain identical. No private proposal is assigned to the released literal-1
accepted types by casting. Reusing unchanged simplification/topology versions means executing
those exact public algorithms, not asserting that they certify roles.

Persistence needs a strict additive classification-parameter and realization variant binding
these tuples. H can retain integer seaLevelContourDoubledTicks=1, but must record fixed policy
provenance and reject legacy percentile semantics. Z cannot occupy the existing odd-contour
field: a tagged zero representation and exact behavior dispatch are required. Existing package
versions are proposed retained only if reviewed strict DTO extensions fit their existing
compatibility rules; no migration or parser implementation is performed here. Old records must
round-trip unchanged, mixed tuples reject, and macro schema 2 binds generator/field 3. A tuple
is selected only if its complete claimed obligations pass; D3/control/visual selection remain
separate and no production family is selected by arithmetic evidence.

## Frozen sampling and measurements

One pass evaluates each fixed row/profile once, then shares unmodified arrays across Z/H.
Canonical traversal is south pole, each interior latitude row west-to-east, north pole.
Retain IEEE754 binary64 little-endian normalized sample hashes, Int32 little-endian tick hashes,
and one uint8 per anchor (0 water/1 land) for bit hashes. Normalize -0 before hashing. Record
unique counts 130562/2095106, exact shared factor-four anchors, zero counts, saturated negative/
positive counts, per-owner bits and weighted coverage. No arrays are persisted in full.

Source correction during implementation preparation: classifyAtlasLandWater IS exported by
the current generation public index. Execute that unchanged public classifier for the common
H/Z tick>0 sample bits and coverage (even when Z extraction rejects). Do not claim that its
contour argument is zero: it receives actual H=1, whose integer anchor bits are exactly Z's.
The following attributed equations describe its measurements rather than a necessary copy: row weight is ties-away
round(cos(latitude)*2^20), poles weight zero, total=sum(rowWeight*width); percent is ties-away
round((part/whole)*100*1e6)/1e6, canonical zero (whole=0 yields zero). Production then computes
error basis points as stableDecimal(abs(realizedWaterPercent-targetWaterPercent)*100), where
stableDecimal is the same six-decimal ties-away function. This second rounding is retained
exactly before the <=25 basis-point comparison. Source references are
atlas-land-water-classification.ts:sphericalRowWeight, stableRatioPercent, stableDecimal and
classifyAtlasLandWater. Poles participate in classification but contribute zero area weight.
Total weight is accumulated in canonical row order; all integer weights/totals are safe
integers at both declared profiles, so per-row multiplication and repeated addition agree.
Reference checks compare these equations to the owning source and public point/rounding APIs.
Owner percent uses the same stableRatioPercent(ownerWeight,totalWeight); owner preview error
is abs(ownerPercent-100*originalOwnerQuota), compared directly with <=0.25/count percentage
points, with no further error rounding. This is separately labelled private contract. Preserve
unrounded ratios as diagnostics. Full owner error is diagnostic. Weighted sample coverage is
not polygon spherical area.

Keep original owner ids, islands and role witnesses fixed. Assign source transition provenance
from the original classified land anchor's actual owner (using original geometry/frames; do not
change the field evaluator to fabricate ownership). Mixed-owner rings and component mergers are
failures. Raw transition identities must cover every classified neighbor transition once.
Guarded simplification is separate: ring closure/orientation/source subset, same component membership,
no newly introduced intersections, seam/pole anchors protected, and raw-to-simplified displacement.

Transient component correspondence is defined before simplification. Build a land-anchor
disjoint-set graph from classified sphere-neighbor edges (including seam and unique pole
fans). In an alternating quad, add the land diagonal only when the exact policy saddle
pairing connects that land pair: SW/NE for determinant>=0, or SE/NW for determinant<0. Z
preflight rejects its tie; H retains its released tie. Component keys are SHA-256 of sorted
ascending UInt32LE canonical member indices, prefixed only as private diagnostic strings.
They are not semantic EntityIds. Every raw ring's transition-land and left-land anchors must
identify one component; ambiguity or absent membership rejects. Multiple raw rings may bound
one component (outer coast and holes). A raw ring predecessor key is its canonical extraction
index plus the hash of its exact raw points/transitions/left-land cycle.

Call simplification once per raw ring and keep its raw predecessor key and component key
externally on that call's result. Never recompute identity from the filtered transition list.
Validate every simplified point/transition pair as an order-preserving cyclic subsequence of
that exact raw ring; retain the original membership hash even though leftLandSampleIndices
is dropped. A missing predecessor, ambiguous correspondence, ring loss/merger or new
intersection rejects. No newly inferred cuts or surviving-piece relabeling is allowed.
Sampled role/witness observations remain diagnostics, never replacement role certificates.

## Error ledger and anticipated hard boundary

Normalization contributes exactly zero boundary displacement in real arithmetic. Floating
coordinate/evaluator arithmetic still needs its own qualified error term; no interval proof is
silently assumed. Quantizer error <=1/(2Q). H adds +1/(2Q) quantized contour bias; Z does not.
These are field-unit quantities, not angular distances by themselves.

A local near-coast inverse-distance argument must first establish that the winning field equals
its LAEA signed polygon distance: the 0.02 negative clipping and radius guard must be inactive
there, and all other owners negative. The certified 0.05 guard gap suggests a small band but
is not alone a global theorem. On an actual chart band with angular radius alpha<pi, the LAEA
singular-value bounds c=cos(alpha/2) and 1/c give c*d_sphere <= |h| <= d_sphere/c, subject to
nearest-point/path staying in that band. Derive and charge that domain explicitly before using
quantum/c. Saturation outside it does not supply a lower gradient bound.

Cell interpolation error requires a local Lipschitz bound and chart-aware cell diameter;
corner agreement alone is insufficient. Conservative lat+lon path diameters are about .02454
radians at preview and .00614 at full; a usable sharper bound must be proved, not selected from
observed proximity. Planet-coordinate rounding contributes at most half a tick per coordinate,
with a conservative spherical sum <=2*pi/2^32. Simplification tolerance 524288 ticks is about
.000767 radians in one equatorial coordinate; its exact chord-distance/topology contract is
not a blanket role-area/collar theorem. Explicit conservative displacement may be too large
for the adopted feature margins, and that is a valid failure.

The likely unresolved claim is complete extracted-role certification: public raw/simplified
rings carry land/water sample transitions, not certified interior cuts or mapped continuous
role/coast correspondences. A global sampled Hausdorff diagnostic cannot establish body/lobe
area, first disks, collar separating widths, peninsula extent or bay aperture under the fixed
witnesses. The smallest successor must supply a conservative original-to-extracted role
correspondence and stability/error contract if this cannot be proved here. Do not infer a new
cut, relabel a surviving piece, relax a floor, or declare success from topology alone.

## Execution freeze and replay

Extend the trusted issue-185 public-entry TypeScript loader to core AND generation, resolving
only declared public package exports and an explicit source allowlist. Pin transitive source
bytes, package manifests, lock/tool versions, helper/policy sources and exact checkpoint rows.
Validate trusted current/pinned source and checkpoint hashes BEFORE compiling/importing code;
never execute an arbitrary self-consistent snapshot. No production export is added. Type-check
public boundaries with no unsafe zero cast. Preliminary helper/synthetic tests precede the
source freeze, which precedes six-field evidence. Each admitted policy gets one whole cohort,
then one read-only exact replay of samples/extraction/simplification. A policy-wide rejection
never switches a row to the other policy. Hash-only verification is labelled separately from
actual computation replay. Root and independent design review must clear this plan first.

Source arithmetic precision: interpolateContourTick rounds the rational displacement before
adding the integer start coordinate. For start=-2, end=-1 and signs=-1/+1, the output is -1,
not roundAway(-1.5)=-2. Z retains the exact released expression. This distinction does not
increase the half-tick coordinate error bound; a helper regression fixes it without another
synthetic lattice case.

## Pre-capture measurement clarification

The source-level stronger inverse/crossing arguments and actual retained feature-margin
comparison are in error-budget.md. They distinguish coordinate-affine from shortest-geodesic
segment interpretations and raw-to-original from original-to-raw distance. The latter remains
unproved. The harness measures actual removed raw vertices against their exact simplified
predecessor chord, records fixed original role membership at source land anchors, and records
fixed original interior/collar/bay witnesses against vertex-mapped LAEA raw/simplified chords.
These witness distances omit internal collar cuts and are explicitly diagnostics, not new role
certificates. This clarification fixes measurement definitions before any six-field execution.
A failed shared-anchor comparison retains both computed profile results and an explicit failure;
it does not abort and lose the offending arrays' hashes or quietly change sampling.

Original paid-component identity is also fixed before extraction: every owner body and paid
island/archipelago member has its retained ID and an anchor-count slot, including zero counts.
A quantized-positive anchor's unique guard selects its owner; actual original island-polygon
membership (with bounding-box rejection only as an acceleration) distinguishes paid islands
from that owner's body. Hash the per-anchor component indices as signed Int32 little endian,
with -1 for water. Missing sampled original components, multiple original components joined
in one raw ring, or one original component split among different raw anchor-component keys
are explicit failures. This does not rename unsampled components or infer new role cuts.
Per-policy exceptions retain the completed sample/classification hashes and still attempt the
other predeclared policy on the same arrays; sampling failures label both policies not attempted.
