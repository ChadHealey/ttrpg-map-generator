# Conditional v3 discovery and implementation drafts

These are proposed scopes, not newly created issues. **C1, C2 and C3 are NOT READY.** This plan
refines the [issue-164](../issue-164/child-plan.md) and [issue-165](../issue-165/child-plan.md)
conditional sequence without promoting their private algorithms to production.

## Bounded decisions before implementation

Each discovery below can be authored and run without claiming human visual acceptance. A discovery
must freeze its input list, source and work budget before running; one report with explicit
failure is a valid outcome. It cannot alter targets, production records or accepted evidence.

### D1 — Resolve production zero-boundary realization

**Question:** Can the proposed fixed zero boundary survive current 512×256 / 2048×1024 profiles,
`2^24` ties-away quantization and production coastline extraction while meeting adopted geometry
and 25-basis-point coverage? Prefer a separately versioned zero policy; compare a permitted
half-tick policy only as an explicitly declared alternative, not a fallback on favorable rows.

**Bound:** One fixed private source checkpoint, the six retained input rows and a small declared
synthetic set covering exact-zero samples, half ticks, poles, seam, narrow features and tangency.
At most two predeclared realization policies, one pass each, no template or seed search. Use
read-only production adapters or private harnesses; no accepted fixture generation.

**Deliver:** Exact field normalization/range contract, contour encoding/tie rule, sampling and
quantization identities, classification/realization/parameter tuple, numerical displacement
budget and extracted-feature survival receipts. Saturation to the production tick range, if
proposed, belongs to new field behavior 3 and must preserve the zero sign/boundary; it cannot be
silently inserted under behavior 1/2. Specify whether saturation affects distance/gradient bounds.
Record any unsupported rounding/platform obligation instead of claiming an interval proof.

**Exit:** A precise proposal suitable for ADR/C1 review, or a falsified hypothesis. An interface
or topology change beyond the declared adapters requires another design child. The broader
128-seed production proof belongs to C2, not this bounded discovery.

### D2 — Specify production deterministic owner and subfeature scopes

**Question:** How do stable transient owner roles, anatomy, placement candidates and paid islands
use the released closed `MapEntitySeedInput` and stream contract without private counter RNG?

**Bound:** One proposed scope/name registry and one alternative only if the first cannot express
the required independence. Test a fixed seed with owner counts 1, 4 and 8, reordered evaluation,
independent island/group zeros and one reroll revision. No world comparison or geometry tuning.

**Deliver:** Every scope field/name and stable ID derivation, per-concern draw/order budget,
canonical examples, reroll/invalidation behavior and collision/independence tests. Distinguish
transient generator identities from semantic entity IDs. Retain released derivation/stream
versions unless an actual algorithm change is separately reviewed. Missing implementation alone
does not block choosing a registry; an unresolved scope-contract conflict does.

**Exit:** Exact selected registry and version implications, or a narrowly identified contract
design follow-up. No open-ended stream-name invention inside C2.

### D3 — Resolve supported ocean/polar/control behavior

**Question:** Does the proposed family satisfy the public controls, and which controls must be
upstream of geometry? Incorporate [#180](https://github.com/ChadHealey/ttrpg-map-generator/issues/180)
when available; drafting this child does not depend on its completion.

**Bound:** One retained constructor with a predeclared paired-control matrix covering all three
ocean modes, all three polar modes and the analytically exposed capacity extremes. Freeze seed,
budget, diagnostic definitions and mode comparisons before evaluation. Stop on an analytic
domain obstruction; do not spend an arbitrary seed search on it.

**Deliver:** Distinguish raw water components from semantic clearance cores/open-marine outcomes;
measure planet-pole response, coverage, roles, guards and explicit unsupported/no-proposal
behavior. Publish which controls invalidate macro and their exact proposed parameter fields.
Public count/water/island-zero/distribution boundaries need declared expected outcomes. A
restriction of the public UI domain is a new product decision, not an implicit constructor clamp.

**Exit:** Exact semantic/input contract for the ADR, or a bounded construction/policy successor.
No semantic classifier changes, public-control relaxation or accepted output edits in this child.

## C1 draft — Strict accepted v3 compatibility

**Outcome:** Add the selected v3 accepted-record variant while preserving old documents exactly.

**Hard prerequisites:** Maintainer visual selection and accepted successor ADR; D1/D2/D3 decisions
closed into one exact version/parameter/provenance contract. This docs proposal is insufficient.

**Scope:** Core macro supported-version definitions and accepted types; strict persistence DTO
variants/version diagnostics and both package decode paths; generator-free desktop compatibility
integration tests; synchronized persistence ownership documentation. Starting files are
[core aspects](../../../packages/core/src/atlas-geography-aspects.ts),
[core model](../../../packages/core/src/atlas-geography-model.ts),
[DTO schema](../../../packages/persistence/src/atlas-accepted-aspect-dto-schema.ts),
[version compatibility](../../../packages/persistence/src/atlas-macro-elevation-version-compatibility.ts)
and [desktop compatibility tests](../../../apps/desktop/src/atlas-macro-elevation-version-compatibility.integration.test.ts).

**Acceptance:**

- Decode the exact selected generator/seed/parameter/output tuple; reject every mixed or unknown
  combination and missing/extra required water fields. Preserve exact v1/v2 schema-1 variants.
- Reopen v1/v2/v3 accepted records with generator tripwires proving zero generation. Round-trip
  each accepted fixture byte-identically under its package contract.
- Keep the ordinary generator default unchanged. No generation algorithms, upgrade prompt,
  package-layout migration, accepted output replacement or M3 implementation.
- Demonstrate the version-aware input/invalidation contract at its type/validation boundary;
  live generation dispatch and workflow wiring stay in C2/C3 respectively.

**Verification:** Focused core/persistence/desktop compatibility tests, unknown-version and
mixed-provenance negatives, read-only fixture checks and `pnpm check`. Record macOS/Linux
canonical decode evidence as required by the accepted contract. Do not invent a newly accepted
geography fixture merely to make a decoder test pass; use explicitly synthetic records where
appropriate and label them.

**Split/stop:** A package migration, generic seed-contract redesign or unselected contour format
returns to design. Execution profile: C4, frontier/high, context fit requires bounded symbol
reads and independent review; re-estimate when authored as an executable issue.

## C2 draft — Explicit v3 production generation entry

**Outcome:** Implement the selected field through an explicit opt-in production entry, leaving
ordinary new-atlas dispatch unchanged.

**Hard prerequisites:** C1 complete; accepted ADR and exact control/threshold/profile/stream
registry. No private source label or assistant visual pass supplies those prerequisites.

**Scope:** Generation-owned quota construction, certified geometry/placement, field adapter,
sampling/classification realization, metadata and focused tests behind declared public entry
points. Starting seams are [generator contract](../../../packages/generation/src/atlas-land-water-generator-contract.ts),
[generator](../../../packages/generation/src/atlas-land-water-generator.ts),
[metadata](../../../packages/generation/src/atlas-land-water-generator-metadata.ts),
[profiles](../../../packages/generation/src/atlas-sampling-profiles.ts) and
[classification](../../../packages/generation/src/atlas-land-water-classification.ts).

**Acceptance:**

- Fixed quotas/roles/streams before placement; declared finite budgets and deterministic
  no-proposal diagnostics. No seed replacement, quota redistribution, hidden body-count clamp,
  uncertified islands or post-classifier geometry rescue.
- Implement selected water dependency and proposal provenance. Reject mismatched macro and
  classification inputs; preserve legacy classification behavior and generator entry.
- Prove production shared-anchor identity, canonical seam/poles, full-profile coverage, actual
  threshold/quantization/extraction survival and cooperative cancellation/progress behavior.
- Run the fixed 128 additional ordinary preview seeds with no placement/calibration failures,
  as required by ADR-0029's retained validation boundary. No filtering or replacement seeds.
- Retain the six production-entry diagnostic rows for human review. These do not replace C3's
  full 12-default/6-control cohort or establish semantic outcomes merely by rendering.
- Produce exact canonical field/classification evidence on macOS and Linux; repeat on one OS
  is deterministic replay only. Keep old fixtures unchanged.

**Verification:** Focused algorithm/property/negative/cancellation tests, production-profile
receipts, deterministic sweep, independent numerical/code review, visual inspection and
`pnpm check`. Scope these as bounded lanes; the full-profile proof is not inferred from preview.

**Split/stop:** Any proposed semantic classifier, renderer, coastline contract, core persistence,
dependency or public-control change exceeds this generation issue. If construction cannot meet
the selected contract, record failure and return to a bounded design child. Execution profile:
C4/frontier/high; split implementation and evidence lanes if the exact selected algorithm cannot
fit one reviewable context. Do not begin an unbounded combined rewrite.

## C3 draft — Adopt v3 for new atlases with complete product evidence

**Outcome:** Wire the proven v3 generator into ordinary new-atlas creation and the existing
accept/save/reopen/reroll/export workflow with additive reviewed evidence.

**Hard prerequisites:** C2 complete; maintainer accepts production-entry visual evidence and the
selected ADR; compatibility and both-platform requirements are met. Existing accepted worlds
remain on their retained version unless explicitly replaced through the accepted transaction.

**Scope:** Desktop generation selection/workflow integration, additive fixture definitions and
review records, updated proof/provenance documentation. Locate current adapters during issue
authoring rather than copying historical UI paths blindly.

**Acceptance:**

- Ordinary new-atlas dispatch selects the documented v3 tuple; explicit legacy behavior remains
  reproducible where supported. Water edits use the correct version-aware invalidation policy.
- Save, unload, reopen, reroll and export accepted v3 state; compare persisted semantic/field/
  partition/export hashes, and prove v1/v2 reopen invokes no generator.
- Retain and human-review all 12 fixed ordinary defaults and six declared controls using the
  production 1600×800 review PNG composition. Do not substitute the private six-row matrix,
  128-preview sweep or selectively passing ordinary rows.
- Produce canonical and visual evidence on macOS and Linux under fixture conventions, with
  explicit append-only review records and read-only checks before commit. Keep rejected and
  old accepted evidence intact; no runner may approve its own output.
- Preserve parent/child context boundaries. Resume #148 only after accepted v3 geography;
  #150 follows the relevant context/evidence work separately, not through automatic regeneration.

**Verification:** Focused workflow integration/e2e, read-only cross-platform and visual fixture
commands, save/reopen generator tripwires, independent review and `pnpm check`. M9 packaged
reference-machine release-hardening is not silently imported as an M2 closure prerequisite.

**Split/stop:** Migration UI, generic persistence redesign, region generation, style rescue or
further geometry tuning returns to its own issue. Execution profile: C4/frontier/high; keep
workflow edits separate from evidence preparation if either stops being bounded.
