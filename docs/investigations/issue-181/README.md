# Issue 181 — Proposed v3 production contract and conditional delivery plan

This is a **documentation discovery**, not family selection, production implementation or an
accepted ADR. Parent [#161](https://github.com/ChadHealey/ttrpg-map-generator/issues/161) remains
responsible for the v3 outcome. [Issue #181](https://github.com/ChadHealey/ttrpg-map-generator/issues/181)
can close when this proposal is reviewed without making its conditional implementation children
ready.

The retained [issue-179 r2 review](../issue-179/visual-review-r2.md) gives four ordinary rows
provisional assistant passes, but rejects the balanced control for R3. Family recommendation is
withheld. Human decisions remain pending. Neither a favorable subset nor numerical certificates
selects a production family. [Issue #180](https://github.com/ChadHealey/ttrpg-map-generator/issues/180)
is a separate control/robustness audit; its findings may inform later decisions and are not a
prerequisite for this documentation. No issue-180 result is assumed here.

## Deliverables

- [Production contract](production-contract.md): verified current ownership and exact proposed
  water/version boundary, with the unresolved threshold, profile and stream decisions identified.
- [Proposed ADR](proposed-adr.md): issue-owned successor proposal; accepted ADR-0029 is unchanged.
- [Conditional child drafts](child-plan.md): bounded discovery gates and separately scoped C1
  compatibility, C2 generation and C3 adoption/evidence work. These are drafts, not created or
  READY implementation issues.

## What can proceed autonomously

Source inspection, private bounded probes, proposed contracts, compatibility test design and
conditional issue authoring do not require a claim of visual acceptance. This issue performs only
the documentation portion. A new experiment or implementation needs its own bounded scope.

The actual adoption gates come from the owning documents, not an inferred general approval rule:

- [Issue-164 visual contract](../issue-164/visual-contract.md) says of assistant observations:
  “They do not substitute for the issue's human visual decisions.” The fixed rows, rejected evidence and per-row
  decisions must remain visible.
- [Issue-164 proposed ADR](../issue-164/proposed-adr.md) states: “This unnumbered proposal remains
  issue-owned until a maintainer resolves the decision”. This proposal follows that boundary.
- [Git workflow](../../05-git-workflow.md) requires an ADR for decisions that affect compatibility
  and says: “Supersede an old ADR rather than rewriting its history.”
- [Fixture conventions](../../07-fixture-conventions.md) state: “A runner never accepts its own
  output.” Accepted fixture promotion requires the specified review record and explicit update.

These gates prevent calling C1–C3 ready under the retained [conditional child
plan](../issue-165/child-plan.md). They do not prevent publishing an honest proposal now. The
user's authorization to continue investigations is not recorded as a human decision on images
that had not yet been produced.

## Decision register

| Decision                                                     | Status in this proposal                       | What closes it                                                              |
| ------------------------------------------------------------ | --------------------------------------------- | --------------------------------------------------------------------------- |
| Production family and visual selection                       | Unresolved; issue-179 recommendation withheld | Fixed comparison meets the visual contract and maintainer records selection |
| Water belongs upstream of v3 quota construction              | Proposed required dependency                  | Accepted successor ADR and exact version-aware contract                     |
| Macro behavior/generator 3; macro parameter schema 2         | Proposed, not implemented                     | C1 contract review after remaining tuple decisions                          |
| Zero contour versus production threshold policy              | Blocked                                       | D1 supplies measured survival and an exact threshold/version contract       |
| Existing production profiles and quantization                | Preferred retention, unproven for this field  | D1 proves them or proposes new identities for changed contracts             |
| Production owner/subfeature stream mapping                   | Blocked                                       | D2 publishes typed scope, names, ordering, budgets and exact examples       |
| Ocean/polar realization and failure semantics                | Blocked                                       | D3 demonstrates outcomes or records unsupported modes honestly              |
| Human fixture approval, production cohort and both platforms | Not performed                                 | C2/C3 evidence, not private replay                                          |

## Review and verification boundary

Sources were inspected at the issue-179 local checkpoint, including current core, generation,
persistence and desktop compatibility tests. [The contract](production-contract.md) names the
symbols rather than relying on earlier investigation descriptions of production behavior.
The [independent source and contract review](independent-review.md) is complete. Documentation
links, formatting, public-content and repository precommit checks accompany the local commit.
No production files, old evidence, accepted ADRs or fixtures are changed here. This completes
the documentation discovery; its proposed ADR remains unaccepted and C1–C3 remain NOT READY.

The M2 visible exit remains the [project plan](../../PROJECT_PLAN.md) and
[atlas proof](../../milestone-2-atlas-proof.md): an attractive generated atlas that can be accepted,
saved, reopened, rerolled and exported. Packaged reference-machine performance/cancellation
release-hardening evidence belongs to the explicitly deferred M9 boundary; it is not invented
as an additional blocker for this documentation or M2 product proof.
