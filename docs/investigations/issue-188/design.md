# Bounded whole-body bay adjacency contract and two literal component fixtures

This is a proposal only. No geometry was executed, no repository file was changed, and no
successor is authorized by this document. Issue 187's two numerically passing states are finally
rejected for R3. Another adjustment to those lips is not proposed.

## Specific expressiveness restriction

Issue 167 defines the bay coast on the surviving body's connected coast, and reserves its water
against the intended union. It does not require that coast to belong entirely to B. Frozen
178 certificates.mjs nevertheless requires every nonmouth pocket edge on B, stitches the precut
pocket only into B, and rejects all role/pocket contact. Frozen 172 coast-partition.mjs rejects
any bay/role interval overlap. Frozen 176 wedge-mouth.mjs grants shoulder incidence to B and the
whole body but not roles. Together these prevent a required peninsula or lobe from forming a
natural bank of the required bay. A separate peninsula elsewhere is then needed to fill the
primary inventory.

That is a demonstrated representational restriction, not a theorem that B-only bays always look
bad. The proposed mechanism is shared anatomical structure: a gulf between B and a required
peninsula, rather than a separate bay notch plus an independent terminal peninsula. The private
certificate change establishes expressiveness only. A future literal primary would still need
actual visual review; no R3 improvement is inferred from component fixtures.

## Selected opt-in contract

Use a new private certificate option `bayCoastMode: 'whole-body'`. Missing mode and explicit
`'interior'` delegate to frozen 178 without changes, preserving full result equality. Unknown
modes reject. Initially allow whole-body mode only with `mouthKind: 'wedge-geodesic'`; reject
other kinds rather than fallback. Preserve `collarWidthUpperMode: 'root-and-far'`, all geometric
thresholds, area accounting, clearance and binary64 diagnostic assurance.

Let S be the surviving attached body B union all declared roles. Let E be the planar pocket.
Let U0 be the predeclared precut body obtained by closing this pocket with its mouth chord.
These are separate stages: do not subtract E again from S's paid quota.

1. Run all existing bounded input, simple-ring, role-disjointness, exact root attachment,
   sole attachment, collar/far/whole-disk, marginal area, extent, and exact stitched-boundary
   checks. Require the stitched oriented boundary S to be a single simple polygon and to
   equal the submitted body boundary. Shared root cancellation, pairwise disjoint interiors
   and the area ledger establish that all B/role interiors lie in S. If any such proof gate
   fails, do not use whole-S wedge exclusion as a replacement proof.
2. Normalize S and E privately to positive orientation, reversing E's ordered mouth together
   with its ring if necessary. Reject a mouth whose original pair is not its actual directed
   ring edge. The remaining E edges must exactly equal the oppositely oriented edges of ONE
   contiguous proper arc of S. Check every consecutive vertex, not merely edge-set membership.
   No skipped edge, partial subdivision, repeated edge, disconnected arc or internal root
   chord qualifies. Mouth endpoints must be existing S vertices and, in this first class,
   must not equal any attachment root endpoint. Bay shoreline may cross a root endpoint
   internally when both adjacent shoreline segments are actual exposed S edges.
3. Enumerate every S/E segment pair. Exempt only the declared exact shared reversed edges
   and their necessary shared endpoint incidences; reject other touch, overlap or crossing.
   Reject either polygon's strictly interior vertices/edge interiors in the other. A shared
   root endpoint does not authorize overlap along its internal root chord. As a redundant
   audit, enumerate each B/role versus E, deriving its allowed edges from the already proven
   E/S exterior arc, never from a caller whitelist. A role with no shared arc receives no
   contact exemption.
4. Stitch E onto S, require one simple precut ring U0 and the area identity
   area(U0) = area(S) + area(E) under the unchanged diagnostic residual policy. Equivalently,
   the declared coastal arc of S is replaced by the single mouth edge; verify that identity.
   The pocket witness is strictly inside E and outside S and every positive component.
   Islands remain wholly detached from S and disjoint from E with no contact exception.
5. Run frozen 175/176 whole-segment wedge exclusion on S and every island, NOT on internal
   B/role boundaries as if those were exposed coasts. Only the two genuine S shoulder
   incidences receive the existing exact active-face derivative treatment. Every nonincident
   edge uses the conservative expanded-wedge clipping. This excludes S interior by the
   bounded-polygon escape-ray proof, hence excludes every role already proven contained in S.
   It does not grant blanket `structuralShoulders` permission to a role.
6. Preserve ordered mouth, origin and nonmouth E/witness side margins, cap <=1.4, whole-mouth
   lens theorem and the existing c bounds. Opening remains [c*w,w/c], depth lower is
   c*distance(witness,infinite mouth line), and credited removed area lower is planar area(E).
   The empty lens can enlarge the actual curved water pocket but is never credited as positive
   land or as an unverified exact removed area. All original primary/subordinate applicability
   rules remain active, including primary .02Q removed area and all declared role angular limits.

Finite scope: <=256 unique boundary vertices, <=8 roles and <=11 islands as before; no polygon
Boolean library, general curve intersection or new transcendental acceptance primitive. An
explicit conservative ceiling of 32*256*256 segment-pair predicates covers the added whole-body
and per-role/pocket comparisons. Return an ambiguity/budget failure, never simplify or search.
All existing numeric tolerances retain their investigation-only limitations.

## Private partition entry

Keep the existing mother-coast-first API and nonoverlapping fixed role intervals. Permit the
fixed bay interval to overlap role COAST intervals; do not mark bay samples removed from S.
Roles and B are the same surviving partition produced before quota fitting. E is separately
formed from the declared contiguous S interval plus the mouth chord. Do not infer a favorable
role after fitting. All root/far/disk identities remain literal. Certificate validation, not a
relaxed interval check by itself, decides eligibility.

## Two complete, unexecuted component fixtures

These are deliberately `primary:false` full-certificate fixtures: each has B, one declared
attachment and a bay. They test all applicable angular/collar/water/topology gates, not the
absent complete primary inventory. They must not be relabelled primary passes. No islands,
random draws, fit search, anatomical variation or template family is included. Set each quota
once from its own declared surviving B plus role shoelace area divided by 4*pi. Use the same
coordinates directly, nominal clearance .05 and root-and-far mode. Freeze both literals before
any useful-fixture geometry execution; retain both outcomes even if one fails.

### Fixture P: lower bank is peninsula coast

Define:

- r=(.10,-.25), h=(.10,0), k=(.13,.11)
- a=(.40,-.08), b=(.39,.16)
- f=(.40,-.18), t=(.44,-.13)
- B=[(-.60,-.50),(.10,-.50),r,h,k,b,(.36,.50),(-.60,.50)]
- P=[r,f,t,a,h], root=[r,h], far=[f,a], disk=(.20,-.12)
- E=[a,b,k,h], ordered mouth=[a,b], witness=(.21,.05)
- interior witness=(-.20,0)
- S=[(-.60,-.50),(.10,-.50),r,f,t,a,h,k,b,(.36,.50),(-.60,.50)]
- U0 is the same S sequence with a,h,k,b replaced by a,b.

The full bay shore a,h,k,b crosses from P into B at root endpoint h. Shoulder a lies on P
but is not a root endpoint. The internal root r,h never enters the credited bay shoreline.
This is exactly the configuration excluded by the frozen B-only rules.

Hand-derived feasibility rationale, not executed receipts: B area .80315, P area .0545 and
E area .04915. Maximum chart vertex radius is sqrt(.61), giving c=sqrt(1-.61/4) > .92.
The collar is the trapezoid r,f,a,h with minimum opposing-chain separation .10 at the far cut;
its first disk center has planar boundary clearance greater than .09. Root-and-far width is
bounded below by .10c and above by .10/c. Peninsula extent bounds use ORIGINAL root r,h:
planar maximum .34, so [.34c,.34/c] lies inside .20..45 and its ratio lower exceeds 2.
Mouth width sqrt(.0577) lies between .24 and .241; the opening bounds lie within .12..30.
Witness line distance is .0443/sqrt(.0577) > .184, so depth lower exceeds .169. The pocket
area is not a primary-share proof; the fixture remains explicitly subordinate.

The P distal point is outside the mouth sector: det(a,t)=-.0168. The exterior after b leaves
on the opposite radial side. All nonmouth pocket vertices are strictly origin-side. These
simple inequalities support feasibility; the actual full finite predicate remains decisive.

### Fixture L: upper bank is lobe coast

Start from the same literal construction, replace r by (.10,-.28), f by (.40,-.21), t by
(.46,-.145), and kind by `lobe`. Retain h,k,a,b and the disk point. Then apply the exact
reflection (x,y)->(x,-y) to EVERY point in B, role/root/far/disk, S, E and both witnesses.
Reverse the reflected polygon rings to positive orientation, and reverse the ordered mouth
with E. This is a complete fixed transformation, not a search or post-fit relabelling.

B area remains .80315; lobe area becomes .0654. Its collar root width is .28 and far separation
.13, so c*.13 > .119 exceeds the declared lobe .10 attachment floor. The first disk clearance
remains greater than .09 and supplies the required .05 spherical disk. The bay bounds are
unchanged by reflection. No peninsula extent claim applies to this lobe fixture. This tests
both shoreline traversal orientation and a different role's stricter lower attachment width.

## Verification and stopping rule

Independent literal/proof review precedes implementation. Default/explicit interior mode must
match all retained 178 results exactly; unknown modes and unsupported combinations reject.
New-mode tests must include role intrusion, internal root substituted for coast, hidden or
partial edge, wrong orientation, disconnected contacts, shoulder at root junction, extra bridge,
disk cut, filled mouth, island in planar E and island in the outward lens. Tests must prove the
new mode cannot skip the full role certificate. A standalone topology pass is not a full result.

After independent implementation review, capture both frozen useful fixtures once, repeat and
replay with trusted source verification, and retain a native/half paired local panel. No third
fixture or adjusted failed fixture is authorized; source defects may be repaired transparently
without changing literals. Any failing prescribed fixture remains in the disposition. No world,
134-case or family experiment follows. The bounded success is a sound expressiveness extension
with its actual local outcomes, not a claim of attractive or selected v3 geometry.

## Smaller implementation route: unchanged-body delegation

Source review supports a wrapper instead of cloning the 178 certificate. For new mode only,
validate the entire new bay schema privately, then call frozen 178 with the original id,
primary flag, B, attachments, islands, body boundary, quota and options, changing only bay to
null in an independently owned shallow candidate record. Never downgrade primary to false.
The old source has exactly one intentional missing-bay site, after its primary lobe/peninsula
inventory checks. Remove only the exact record
`{code:'missing-bay',featureId:candidate.id,actual:null,required:'declared protected bay'}`
when primary is true, and require exactly one such record before accepting the delegation.
For primary false require none. Preserve every other failure; if one exists, the whole result
fails and cannot claim the whole-S containment prerequisites. An early invalid-input return
with no missing-bay record cannot qualify as a primary pass.

The wrapper must replace ALL omitted old bay responsibilities: bounded finite/simple E,
ordered mouth and witness, exact actual coast, pocket/component disjointness, precut topology
and area, islands versus E, cap/witness coverage, support/wedge proof and numeric bay targets.
Because every accepted E vertex is an exact S vertex, removing E from the delegated ring list
does not reduce its unique vertex maximum or containing radius. Validate that identity before
using the delegated radius. The witness is separately checked exactly as before. The source
contains no other conditional bay-dependent positive-role logic outside the old bay block and
island/E contact check. New output metadata must explicitly identify whole-body mode.

Regress a primary with each required role removed or malformed, a primary with too-small
surviving shares, a bad quota, an invalid far cut, and a valid-looking bay with a role intrusion.
None may pass through removal of the one intentional missing-bay diagnostic. Legacy delegation
must preserve exact historical outputs, while new-mode receipts are independently versioned.
This is a proposed implementation route requiring independent proof-to-code review, not code
already executed or an assurance upgrade.

Independent analytic checkpoint: the surface-audit agent read this contract and both literal
fixtures without executing geometry and found no analytic contradiction. In particular it
checked the P disk side-clearance formulas, .10 far width, .34 original-root extent and L's
.13 lower-width witness. To make the staging explicit, U0 above is the chord-closed PLANAR
precut body; its true geodesic counterpart also contains the empty outward lens. Neither the
planar pocket nor lens is surviving paid land. Implementation and actual fixture receipts
remain unperformed and require their own review.
