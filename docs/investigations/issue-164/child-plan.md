# Ordered successor drafts — issue 164

These are issue drafts, not new GitHub issues or a tracking parent. Execute only a child whose
readiness dependencies are met. The human rejection of all twelve comparison images supports
**D1 next**. C1–C3 are conditional implementation drafts, explicitly NOT READY until a family is
selected and the indicated predecessor is complete. They must be revalidated against that selection;
this plan does not authorize implementing an unspecified v3 algorithm.

The existing #162 compatibility work is already on `main` at `14aca59`; do not recreate it. Keep
#161 open pending the morphology correction. #163 should eventually be closed as superseded/visual
acceptance not met, not successfully completed, only under separate authorization. #148's new
inherited-context evidence follows accepted v3 production geography; #150 follows that evidence.
Neither M3 issue is work inside these drafts.

## D1 — Test coverage-aware continental hierarchy inside separated spherical owners

**Outcome:** Determine whether a bounded hierarchy-first construction can retain convincing
continental lobes, peninsulas and embayments after coverage calibration, with one selected field
specification or another explicit no-selection decision.

**Background/start here:** Read this [no-selection report](README.md), the [human decisions](visual-review.md),
[visual contract](visual-contract.md), `morphology.mjs`'s `createField` and `calibrate`, then
[ADR-0029](../../adr/0029-separated-macro-landmass-field.md). Use `comparison/results.json` as the
unchanged two-family reference, not as accepted geography.

**In scope:** One investigation directory; at most two new realizations of the already compared
families, sharing an explicit pre-contour continental area budget. Test one bounded method of
building asymmetric lobe/embayment hierarchy before small islands. Compare against the retained
r2 matrix using the exact same four defaults/two controls. Quantify how calibration changes primary
owner shares and what fraction of retained coast touches a hard support/ownership guard. The key
hypothesis is that hierarchy must survive coverage selection rather than be added before a global
threshold that overwhelms it. Keep one shared angular gap proof.

**Out of scope:** Production edits, new public controls, semantic/renderer repair, M3/M4, extra
algorithm families, seed-search, dependencies, fixture registration, GitHub mutations.

**Acceptance criteria:**

1. Before/after calibration measurements distinguish intended hierarchy from realized component
   shares, and measure guard-contact coastline fractions for both old and proposed realizations.
   Publish the fixed traversal, weighting, and measurement interpretation.
2. No shape-producing term crosses another owner's declared 0.05-rad gap; seam-crossing, forced
   polar placement and nested anchors pass. The scalar field has a demonstrated continuous contour
   transition, with bounded deterministic infeasibility rather than clipping-based repair.
3. Twelve new 1600-by-800 unlabelled images (two realizations by six fixed inputs) and simplified
   shape reads repeat exactly with complete input/source hashes. A human judges every image against
   contract version 1 and records per-family diversity. No visual pass based solely on area ratios.
4. Explicitly test island placement relative to the realized coast; show that zero and abundant
   island/group controls retain their meaning without replacing missing broad hierarchy.
5. Choose one precise bounded field spec only if every default passes and both controls remain
   interpretable. Otherwise report no selection with the specific unsatisfied requirement; do not
   open-endedly tune, add families, or start production implementation.
6. A selected spec fixes production control mappings, bounded capacity/failure policy, field/stream
   version consequences and numeric portability risks. Revalidate C1–C3 before calling them ready.

**Verification:** Focused invariant/measurement tests; exact twice-run twelve-image matrix and human
review; `pnpm check`; scope audit. macOS/Linux numeric equality is required before production
adoption, with any unavailable lane explicitly recorded here.

**Dependencies/readiness:** READY as Discovery after issue-164's no-selection handoff; production
code not authorized, investigation scripts/evidence authorized. Dedicated review before publication.

**Execution profile (2026-09-05):** C4, 7/10: breadth 1 + uncertainty 2 + state-risk 1 + verification 2

- dependencies 1. Frontier, `gpt-5.6-sol` / high. Numeric design and visual acceptance justify the
  profile. Context fit PASS: one generation subsystem, two realizations/six inputs, bounded initial
  reading and one comparison outcome; no expected compaction. Stop if a third realization, tectonics,
  a dependency, production-path changes, or a third major boundary becomes necessary. A second
  failed bounded comparison produces a decision, not an implicit larger implementation task.

## C1 — Preserve v1/v2 and validate v3 macro provenance without generation

**Outcome:** Strictly decode and round-trip stored v3 macro records while preserving released
v1/v2 generator-free reopen and rejecting mixed/unsupported provenance.

**Start here:** Selected successor ADR, [compatibility proposal](proposed-adr.md),
`packages/core/src/atlas-geography-aspects.ts`,
`packages/persistence/src/atlas-macro-elevation-version-compatibility.ts`,
`apps/desktop/src/atlas-macro-elevation-version-compatibility.integration.test.ts`, and
[mapworld-v1.md](../../mapworld-v1.md).

**In scope:** Core accepted macro discriminants/validation and persistence DTO/version handling;
focused compatibility tests and owning format documentation. Extend the existing #162 pattern
only after the exact selected v3 record contract is known.

**Out of scope:** Generator implementation, ordinary desktop dispatch, new package layout,
regenerating records, accepted fixture replacement, upgrade UI, migration framework, M3 changes.

**Acceptance criteria:**

1. Valid stored v3 generator/seed/parameter/output provenance matches and round-trips through the
   supported `.mapworld` codecs with no generator invocation; cross-version mixtures fail with
   stable, actionable diagnostics. Unknown future versions fail explicitly.
2. Existing v1 and v2 accepted bytes and decoded state remain identical through generator-free
   reopen. Tests use actual canonical source evidence and arm generator tripwires.
3. Corrupt/missing required provenance fails without silently coercing versions or dropping work.
4. Keep record/package schemas when bytes/layout are unchanged; stop if selection requires a format
   redesign. Documentation distinguishes capability to read v3 from authority to generate/adopt it.

**Verification:** Focused core/DTO tests and the existing macro-version compatibility integration
lane, v1/v2 generator-free reopen checks, `pnpm check`. Dedicated read-only review and macOS/Linux
compatibility evidence before publication/adoption.

**Dependencies/readiness:** NOT READY, Implementation; selected field/ADR from D1 is missing.
Code becomes authorized only when assigned after that gate. Revalidate source paths and exact v3
record shape then. No dependency on recreating #162.

**Execution profile (2026-09-05):** C3, 6/10: breadth 1 + uncertainty 1 + state-risk 2 + verification 1

- dependencies 1. Balanced-plus, `gpt-5.6-terra` / high; persisted public-contract risk requires the
  compatibility review. Context fit PASS conditional on unchanged record layout: two boundaries
  (core/persistence), one version capability, existing test pattern, one validation pass. Split if
  an accepted-data migration or a third major production boundary appears.

## C2 — Implement the selected v3 field behind an explicit generation entry

**Outcome:** The selected v3 macro field produces valid proposals with the documented shape,
coverage, gap, controls, determinism and bounded failure, without changing ordinary desktop creation.

**Start here:** D1's selected formula and human matrix; [proposed compatibility boundary](proposed-adr.md);
`packages/generation/src/atlas-macro-elevation-field.ts`, `atlas-sampling-profiles.ts`,
`atlas-land-water-generator-contract.ts`, `atlas-land-water-generator-invariants.test.ts` in that
same directory; [M2 proof](../../milestone-2-atlas-proof.md).

**In scope:** Generation adapter, versioned manifest/control mapping, bounded diagnostics, focused
unit/integration tests, and issue-owned production-entry evidence. Use C1's supported v3 record
shape. Project-owned math only; stable production streams rather than the spike's counter-hash RNG.

**Out of scope:** Persistence/core redesign, normal desktop dispatch, accepted fixture updates,
renderer/semantic/coastline policy changes, M3/M4, upgrade UI, new dependency.

**Acceptance criteria:**

1. Exact selected field and macro generator behavior version `3`; fixed inputs repeat canonical
   full output. Existing explicit v1 behavior stays byte-identical where it remains callable.
2. Every positive term, including islands/groups/poles, obeys the declared angular gap at the
   accepted full contour. Continuous field evaluation, shape quality and documented coverage/control
   tolerances hold or return a bounded deterministic no-proposal diagnostic.
3. Production preview/full anchors, threshold, seam identity, unique poles, cancellation and stable
   traversal pass the existing contracts; a 128-seed default preview sweep has no proposal failure.
4. The six discovery inputs through the production field retain the selected morphology in human
   reviewed unlabelled atlas views, with source hashes and canonical measurements. No reinterpretation
   of connected components or style additions may rescue a failed row.
5. A read-only macOS/Linux lane proves canonical field/partition equality; no accepted gallery row
   is overwritten or promoted by this child.

**Verification:** Focused field, land/water, semantic and coastline invariants; fixed input repeats;
128-seed preview sweep; six human-reviewed production-entry images; `pnpm check` and the explicit
macOS/Linux lane. Dedicated read-only review before publication.

**Dependencies/readiness:** NOT READY, Implementation. Requires D1's exact selected formula/control
specification and completed C1. Re-score if the selected design exceeds these surfaces.

**Execution profile (2026-09-05):** C4, 7/10: breadth 1 + uncertainty 1 + state-risk 1 + verification 2

- dependencies 2. Frontier, `gpt-5.6-sol` / high. Context fit PASS conditional on a complete selected
  specification: one generation subsystem, fixed matrix and one sweep, no production adoption or
  compatibility design left to discover. Stop if production evidence materially changes the selected
  morphology, or if new major boundaries appear; no second architecture search inside implementation.

## C3 — Adopt proven v3 creation with the reviewed production atlas cohort

**Outcome:** A deliberate new-atlas workflow uses proven v3 geography and supplies the complete
reviewed production/reopen evidence while old accepted maps remain generator-free.

**Start here:** Completed C1/C2 results; [visual contract](visual-contract.md);
`apps/desktop/src/atlas-workflow-reopen.ts`, `atlas-workflow-generation.integration.test.ts` and
`atlas-macro-elevation-version-compatibility.integration.test.ts` in that directory;
[fixture conventions](../../07-fixture-conventions.md); [M2 proof](../../milestone-2-atlas-proof.md).

**In scope:** Desktop new-atlas dispatch using the existing proposal/accept transaction, additive
v3 fixture definitions/runners/reviews, owning workflow documentation, visible save/reopen/export
proof. Select existing public v3 generation; no field redesign.

**Out of scope:** V1/v2 replacement on load, automatic upgrades, migration UI/framework, field
calibration, renderer/classifier changes, historical fixture edits, M3 regeneration.

**Acceptance criteria:**

1. Starting a new atlas explicitly selects v3; loading existing v1/v2 keeps all accepted aspects,
   constraints, locks, edits and decoration untouched and invokes zero generators.
2. All twelve default seeds and six control rows produce unlabelled 1600-by-800 production PNGs.
   Each receives a human decision/rationale; defaults meet contract version 1 and distinct controls
   retain their existing semantics. No default rejection may be hidden by choosing a different seed.
3. Register additive v3 evidence through one targeted fixture update and new append-only review per
   fixture. Keep every historical v1/v2 source/review unchanged; no blanket acceptance command.
4. Visible preview, acceptance, save, unload, generator-free reopen, reroll and SVG/PNG export use
   the same accepted geography. Scope-relevant accessibility and interaction checks pass.
5. macOS/Linux canonical/visual equality and reopen evidence pass. Record the accepted v3 lineage
   required by #148; schedule its new context proof separately, followed by #150.

**Verification:** Focused desktop dispatch/reopen tests; targeted fixture checks and per-row human
review; `pnpm check`, `pnpm test:e2e`, read-only cross-platform fixture gate on macOS and Linux;
visible workflow inspection. Dedicated read-only review before publication.

**Dependencies/readiness:** NOT READY, Implementation. Requires C2's proven field and C1's
compatibility. Production source adoption/fixture writes become authorized only when assigned.

**Execution profile (2026-09-05):** C4, 8/10: breadth 1 + uncertainty 1 + state-risk 2 + verification 2

- dependencies 2. Frontier, `gpt-5.6-sol` / high. Context fit PASS conditional on no generation or
  format work: desktop/evidence boundaries, repetitive eighteen-row fixture execution, one adoption
  outcome, bounded initial reading, reserve for one review/repair pass. Stop on any visual failure
  that requires field tuning, a new upgrade workflow, or expected compaction before validation.

## Profile provenance

Profiles use the issue-authoring skill's 2026-08-17 policy, revalidated here on 2026-09-05 against
[GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol) and
[GPT-5.6 Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra): both support high reasoning;
Sol serves complex professional work and Terra balances intelligence/cost. These are bounded-task
recommendations, not changes to this task's user-selected model. Context-fit percentages are
conservative estimates (initial reading below 20%, full execution below 75%); no precise runtime
context allowance is claimed. Revalidate each draft before publication if the selected architecture,
paths, dependencies, model lineup or verification scope changes.
