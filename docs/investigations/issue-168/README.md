# Issue 168 — explicit anatomy inside separated spherical envelopes

**Decision: specify one candidate for a bounded implementation experiment. No generator is
selected.** The user adopted [issue 167's targets](../issue-167/README.md) for this design
investigation. This proposal retains those targets, immutable squared-size quotas and the
0.05-rad envelope gap. It replaces the failed implicit ellipse expansion with explicit role
polygons whose area is fitted before placement. It does not certify a successful input or
amend the [visual contract](../issue-164/visual-contract.md).

The [geometry specification](geometry.md) gives the construction predicates and their bounds.
[Verification](verification.md) records review and checks separately. This is the design output
for [issue 168](https://github.com/ChadHealey/ttrpg-map-generator/issues/168), following the
[fixed-cap insufficiency finding](../issue-166/README.md).

## Construction sequence

1. Validate the unchanged nine public controls. Declare stable owner IDs in input order,
   inherited template sizes, squared-size shares and `q_i=(1-water/100)size_i²/sum(size²)`.
   Declare main-body/primary roles before placement. Preserve every owner slot. Ordinary
   varied controls retain the inherited one-to-three primary declaration; verify the actual
   body-area half-largest rule after accounting for islands. Equal balanced bodies are all
   primary. Never relabel a failed primary or convert an intended body into an island.
2. Build each owner in a unitless local plane using the attachment recipe below. The initial
   implementation freezes its finite template table and ordered seed perturbations before
   rendering. Templates encode distinct arrangements of a broad interior, two unequal lobes,
   a terminal peninsula, a bay and margin-island sites. Polygon edges may finely sample
   asymmetric curved outlines; high-frequency noise is not a substitute for macro anatomy.
3. Compute the complete union area, including protected cuts, detached islands and any finite
   polar reserve. Scale all its planar coordinates by `s=sqrt(4πq_i/A_i)`. This establishes
   the continuous owner quota algebraically. Scale no owner using another owner's deficit.
   Apply the geometric predicates after scaling; failure discards the candidate, not a target.
4. Determine a cap radius containing the complete scaled land with nominal clearance at least
   0.05 rad. Select separated placements using the finite search below. Check every pair,
   including pairs whose owners were not adjacent in the search order.
5. Evaluate the fixed-zero continuous field specified in geometry.md. Its permitted contour
   interval is exactly `{0}` and contour motion `D=0`. There is no post-placement sampled
   threshold search. Check the inherited preview/full sampled coverage limits independently;
   exact continuous area does not excuse a sampled failure.

## A falsifiable attachment recipe

Start with one simple interior polygon `B0` and four named boundary sockets: two lobe roots,
one peninsula root, and one bay mouth. Sockets are nonadjacent; their interiors cannot overlap.
The bay socket lies on a single ray from the chart origin, giving an exact geodesic mouth after
mapping. Its inward polygon pocket `E` lies inside `B0`, touches its exterior boundary only at
the mouth, and leaves `B=B0\E` connected. At least one explicit interior disk must survive.

For a land socket with endpoints `a,b`, let `w=|b-a|`, unit tangent `t=(b-a)/w` and outward
unit normal `n`. Glue the collar rectangle `[a,b,b+h n,a+h n]` to that edge. Attach a simple
head polygon at its far edge. With midpoint `m=(a+b)/2`, its vertices are
`m+w α_j t+(h+H β_j)n` in the socket frame,
with a shared base from `α=-1/2` to `1/2`, `β=0`; the remaining vertices have positive `β`.
Choose fixed asymmetric coefficients with positive shoelace coefficient `C`, so head area is
`w H C`. For desired exterior area `A`, set `H=(A-w h)/(w C)` and reject nonpositive `H`.
No iterative shape-area solver is needed. A lobe may have a broad head; the peninsula's head
and collar must pass its independent extent/root bounds. Refined curved head templates retain
the same affine coordinate form and area calculation.

The required primary starting partition is surviving `B=.70Q`, `L1=.15Q`, `L2=.09Q`,
`P=.06Q`; this gives lobe sum `.24Q` and ratio `5/3`. Choose the bay before these attachments,
then let `Q=area(B)/.70` and size the three exterior patches from that `Q`. Check the removed
bay area against `.02Q`; do not pretend every chosen bay satisfies it. Polygon intersection
checks reject self-crossings, extra attachments, role overlap and any positive term entering
`E`. Thus the final body is the disjoint-area union of B and the three glued exteriors.
Subordinates use the same attachment machinery when features are declared, with the adopted
subordinate targets rather than a mandatory full primary inventory.

Islands are separate simple polygons assigned to declared realized margin sites. Declare their
total owner-area share before normalization; zero abundance removes its category. Unequal
sizes, irregular spacing and protected channels are construction inputs followed by intersection
and detachment checks. The complete union, rather than nominal term counts, pays the quota.
Polar changes must be finite accounted polygon changes before normalization/certification;
the inherited additive scalar bias is not part of this candidate. The first experiment must
freeze its explicit abundance, polar and fragmentation mappings; this design does not claim
that an unspecified mapping already makes all control rows interpretable.

## Finite ordered search and failure

The first experiment permits eight owners, at most 16 local template candidates per owner,
one main body and at most 11 island polygons per owner, and at most 256 total boundary vertices
per owner, including roles, water pockets and islands. Each candidate uses direct area fitting
once. Exhaustively check the bounded segment pairs, component adjacency and witness predicates;
no adaptive subdivision or geometry-repair loop is permitted. Missing or numerically ambiguous
predicates reject the candidate. Retain the first passing local candidate in declared order.

Try at most 64 complete placement attempts. Within each, place owners by descending required
radius, stable ID on ties, considering at most 128 seeded sphere directions per owner. Retain
the first direction satisfying every placed cap inequality. A failed owner ends that attempt.
No backtracking inside an attempt; no seed substitution between attempts. This bounds proposed
center evaluations by `64*8*128=65,536`. Template, feature and placement streams use separately
named scopes plus stable owner/feature IDs; their exact spellings become part of the experiment
revision. The search is a bounded heuristic, not a complete packing solver.

Return stable failures for invalid input, cap capacity, missing role, area/width/extent/depth
failure, multiple attachment, water intrusion, island floor above quota, role hierarchy conflict,
unresolved numeric predicate, exhausted template/placement budget, and sampled coverage. Include
input/owner/witness IDs, requested quota, actual bound or threshold and candidate count. A failed
inequality proves rejection of that candidate; exhausted search proves no global impossibility.
Do not render a failure diagnostic as an accepted proposal or silently fall back to another policy.

## Controls and version boundary

Circumference scales physical units only; angular targets remain fixed. Water target sets quotas;
count and distribution set owners and shares. Fragmentation changes declared cuts/attachments
within certificates. Island/archipelago abundance changes their reserved components and channels.
Polar character changes accounted local geometry/placement before certification. Ocean connectivity
remains a checked classification responsibility, with no unaccounted post-generation water carving.
All valid inputs may fail explicitly, but an all-failure family cannot meet the visible proof.

This is not a drop-in implementation of the existing macro aspect. The current
[parameter test](../../../packages/generation/src/atlas-land-water-generator-contract.test.ts)
explicitly excludes `targetWaterCoveragePercent` from macro parameters; the
[metadata](../../../packages/generation/src/atlas-land-water-generator-metadata.ts) assigns it
to classification. Quota-first geometry depends on that value upstream. Any selected production
v3 must version the macro input/parameter schema, generator identity, dependency/invalidation
rules, receipt provenance, threshold behavior and compatibility tests accordingly. A water-target
change would invalidate v3 macro geometry and its dependent classification. Keep legacy v1/v2
ownership and generator-free reopening unchanged. This design does not make that production change.

## Next experiment and selection boundary

Freeze a small explicit template/control table, then implement only local construction, certificates,
the bounded placement and fixed-zero evaluator. First test synthetic successes and failures,
including extra bridges, erased bays, unequal marginal areas, post-scale angular failures and the
mandatory retained normal-01 cap rejection. Stop for a design repair if no primary can pass its
continuous certificate; do not spend a full image comparison proving an all-failure policy.

Once that local gate passes, use the unchanged six inputs and source hashes from issue 165.
Retain both sampled coverage checks, per-owner preview errors, seam/pole and nested-anchor checks,
two deterministic repeats and native/half-size images, including every failure. Record actual
body/owner/sphere denominators and every role witness. Assistant visual observations are provisional.
Selection still requires all four ordinary rows to pass the unchanged human visual review and both
control rows to be interpretable; production C1–C3, expanded cohorts and macOS/Linux evidence remain
later gates. This design authorizes a falsifiable experiment, not visual or production acceptance.
