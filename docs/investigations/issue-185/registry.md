# Proposed v3 transient concern registry

This is the single proposed resolution of [issue 181 D2](../issue-181/child-plan.md#d2--specify-production-deterministic-owner-and-subfeature-scopes).
The existing closed core seed input and released derivation/stream algorithms can express the
required independent concerns. No alternative registry or core API change is needed for this
proposal. This private executable contract does not adopt a production generator or select geometry.

## Authoritative seed fields

Every record is a `MapEntitySeedInput` parsed through core's public entry point. Its ten exact
fields are:

| Field                        | Proposed value/ownership                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `seedDerivationVersion`      | `1`, unchanged algorithm and framing                                                                            |
| `deterministicStreamVersion` | `1`, unchanged xoshiro256** stream                                                                              |
| `seedScope`                  | `map/entity`                                                                                                    |
| `worldSeed`                  | Canonical unsigned 64-bit decimal at parsing; core's branded bigint internally                                  |
| `mapId`                      | Actual authoritative world map ID                                                                               |
| `entityId`                   | Actual world-surface singleton derived from that map with `deriveAtlasSingletonEntityIds`; checked for equality |
| `generatorId`                | `worldTerrain.macroElevation`                                                                                   |
| `generatorVersion`           | Proposed `3`; current production compatibility does not yet accept this tuple                                   |
| `aspectName`                 | Exact derived descriptive concern name from the finite registry below                                           |
| `variantRevision`            | The authoritative macro-elevation variant revision; no invented per-owner revision                              |

The synthetic evidence world uses seed `81985529216486895`, map
`a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7`, and its actual derived world-surface singleton
`eaa0cecc-8c5d-559f-b18a-bbd0c53248ac`. These are public synthetic test identities, not user data.
The singleton relationship is the same public identity operation used by current atlas generation.
The registry never substitutes an owner UUID, creates an accepted aspect, or allocates semantic
landmass/island-group IDs. Transient slots are proposal-local construction roles only.

The accepted parent aspect would retain its normal `worldTerrain.macroElevation` name and ID.
The derived names below are complete independent stream namespaces underneath that parent, not
new accepted aspect records or dependency references. Integration must explicitly document the
registry version in the generator-3 implementation and provenance/contract decision; it must not
change the parent record's name merely to initialize a child stream.

## Exact finite names and budgets

All names begin `worldTerrain.macroElevation.v3.`. Each index is an integer encoded in its unique
unpadded base-10 spelling, immediately following the fixed alphabetic segment prefix. Runtime
inputs reject strings, negative zero, fractions, out-of-range values, missing fields and extra
fields. Segment boundaries prevent concatenation ambiguity. Core additionally validates the
complete aspect-name grammar and its 128-character limit.

| Concern suffix                               | Index range         | Fixed float draw limit and meaning                                                 |
| -------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------- |
| `global.primaryCount`                        | One scope           | 1: `floor(3*u)` choice; count/distribution still determine actual role realization |
| `global.layoutOrder`                         | One scope           | 1: cyclic ordinary-layout order                                                    |
| `ownerO.anatomyBase`                         | O = 0..7            | 3: initial layout draw, then two anatomy coordinates                               |
| `ownerO.anatomyLarge`                        | O = 0..7            | 3: separate large-branch initial layout draw, then two anatomy coordinates         |
| `ownerO.candidateC.islandM`                  | C = 0..15, M = 0..3 | 4: starting site, site direction, angle, shape                                     |
| `ownerO.candidateC.archipelagoMemberM`       | C = 0..15, M = 0..6 | 4: starting site, site direction, angle, shape                                     |
| `placement.attemptA.codeRotation`            | A = 0..63           | 3: quaternion rotation uniforms                                                    |
| `placement.attemptA.ownerO.centerDirections` | A = 0..63, O = 0..7 | 256: two uniforms per each of 128 candidate directions                             |
| `placement.attemptA.ownerO.refinement`       | A = 0..63, O = 0..7 | 64: one tangent-direction uniform per refinement sweep                             |
| `placement.attemptA.ownerO.orientation`      | A = 0..63, O = 0..7 | 1: final local-frame angle                                                         |

Only `nextFloat64` is used by the proposal harness. Each call advances released stream v1 by
exactly one raw uint64 word. `nextInt` uses unbiased rejection internally and has no fixed worst-case
number of raw advances; this registry does not pretend a bounded number of `nextInt` calls would
prove a bounded raw draw count. Geometry consumers retain their declared `floor(k*u)`/angle
transforms; changing those transforms later is an output-changing generator decision.

The largest reserved universe is 3,026 scopes and 170,226 float draws for eight owner slots,
sixteen candidates, four isolated members, seven archipelago members and all sixty-four placement
attempts. This is a conservative reservation, not a claim that the current constructor evaluates
all candidates or refines all placement attempts. A consumer may skip unused scopes or unused
suffix draws; it must never share a mutable stream across named concerns. The private `evaluate`
function returns precisely the bounded vector. A production adapter must likewise enforce these
limits instead of handing arbitrary stream mutation capability to unrelated concerns.

## Mapping from the frozen private construction

The inventory follows [179 templates](../issue-179/templates-r2.mjs),
[182 templates](../issue-182/templates.mjs) and [170 placement](../issue-170/placement.mjs):

- Private global `primary-count` and `issue-179-r1/layout-order` consume one draw each. Primary
  count is capped by the requested count; balanced/one-dominant quota recipes do not gain extra
  random draws. Owner slot `O` is allocated in increasing declared order before placement sorting.
  It is not reassigned from accepted rank, centroid, array completion order or a later semantic ID.
- Both private anatomy scopes consume three draws even when the initial layout preference is
  supplied and the first draw is discarded. Ordinary candidates reuse the owner's two anatomy
  values across twelve candidates; the four large candidates use the separate large anatomy.
  Lobe, peninsula, bay, collar and root geometry is authored from these parameters and fixed
  recipes; it does not currently have an additional random stream that needs to be invented.
- Detached members consume four draws once, then try at most twenty-four deterministic sites:
  six declared edges times four offsets. Shape inventory and offset tables are fixed; payment
  weights and category quotas introduce no new random draw. The private `archipelagoCount`
  means up to seven paid member polygons, not seven semantic groups. `archipelagoMemberM`
  preserves that distinction. A future semantic grouping algorithm needs its own reviewed concern
  contract rather than treating this label as an accepted island-group identity.
- The new detached names use the complete candidate ordinal, deliberately differing from the
  old private layout/variation-string scopes. Base candidates occupy 0..11 and large candidates
  12..15. An output-changing reordering or insertion requires a new registry/generator decision;
  a failing candidate does not renumber later candidates or members.
- Placement uses at most 64 complete attempts, 128 center candidates per owner, 64 refinement
  sweeps, and one final orientation. Owners are processed by descending guard radius with stable
  owner-slot tie-breaking, then results are returned in increasing slot order. Guided spherical
  codes consume three rotation draws on attempt 1, also attempt 0 for six owners. Their guided
  first center consumes no center-direction draw; subsequent random candidates consume successive
  pairs from the owner's center stream. Reserve 256 even though at most 254 are used on that path.
- Refinement uses one stream per owner/attempt and one draw per sweep. Only a complete initial
  placement reaches refinement; the current routine returns after that refinement/final check.
  Reserving refinement streams for every possible attempt is an upper bound, not an assertion of
  64 actual refinement phases. Center acceptance, radius sorting and refinement acceptance remain
  mutually dependent geometric operations even though the underlying concern streams are isolated.

## Evaluation and invalidation

Canonical enumeration is global count/order, then owner slots increasing, base/large anatomy,
candidates increasing with isolated members before archipelago members, then placement attempts
increasing with rotation followed by each owner's centers/refinement/orientation. Canonical
receipts sort by revision then ASCII aspect name. Reverse evaluation must produce identical keyed
records. Actual production placement still uses its declared sorted sequential acceptance order;
stream independence does not authorize rearranging that stateful algorithm.

Count is not a seed field. Shared owner slots keep the same concern seeds when count changes
between 1, 4 and 8. Island/group zeros skip only their own namespaces and do not shift the other
category's stream. Paid body/island areas, site conflicts, guards and whole-world placement may
nevertheless change when count or category controls change. No geometry invariance follows.

A macro reroll increments its authoritative `variantRevision` and changes every namespace in
this registry. The fixed revision-0 classification sentinel remains immutable; this establishes
namespace independence only. Classifier output can change after macro input changes even when
its own seed metadata is unchanged. Independent owner-only rerolls are not introduced by this
proposal.

The released private experiments use SHA counter streams with different names and 32-bit float
sampling; this proposal uses core's released 53-bit `nextFloat64`. Consequently **none of the old
private seed cohorts, images or output hashes is production-v3 evidence**. Actual generator-3
integration must regenerate and review the entire production corpus, control outcomes and
cross-platform evidence. Generator version 3 changes output identity; derivation/stream version 1
and all old canonical fixtures remain unchanged. Changing this registry after adoption would be
another output-changing version decision, not a harmless naming refactor.

## Executable evidence and remaining gates

`registry.ts` imports only `@ttrpg-map/core`. The private compilation adapter resolves that declared
public entry to `packages/core/src/index.ts` and its complete transitive source closure. It does
not import core implementation symbols directly or copy a hash RNG. Evidence SHA-256 hashes are
checksums only and never supply generation randomness.

The fixed matrix contains 48 rows: counts 1/4/8, forward/reverse evaluation, isolated-member counts
0/4, archipelago-member counts 0/7, and variant revisions 0/1. It re-derives fresh streams, compares
all overlapping scopes to the complete eight-owner reference, and checks the observed reroll
changes. The 6,052 retained vectors contain exact core inputs, encoded preimages, seed digests,
first float values and hashes of each complete bounded draw vector. Collision-free names follow
from the disjoint grammar and bounded canonical indices; finite seed/output uniqueness checks do
not claim a mathematical impossibility of cryptographic collisions for all worlds.

Source text and hashes are captured before execution, including core's public-entry closure,
package lock and transpiler version. Read-only replay compares the exact retained source inventory
and text to the trusted current closure before compilation, uses only that trusted current source,
then replays vectors and checks source stability afterward. A changed historical implementation
requires its separate preserved environment; this narrow verifier does not execute arbitrary
retained code or silently reinterpret drifted evidence.

Remaining gates are the accepted ADR and exact generator-3 persistence tuple, contour/quantization
contract, ocean/polar/control realization, selected geometry, complete production integration,
human visual selection, cross-platform verification and production corpus. This D2 result removes
the namespace specification gap only; it does not make C1/C2/C3 ready or close the parent v3 work.
