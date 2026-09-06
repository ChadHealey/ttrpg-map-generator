# Issue 169 — explicit-anatomy experiment

This experiment implements the independently reviewed [issue-168 design](../issue-168/README.md)
against the [adopted investigation targets](../issue-167/README.md). It is not a production generator.
The maintainer authorized continued v3 iteration and issue updates with local commits, **no pushes**.

## Order and gates

Freeze the explicit template/control recipe in templates.mjs and its source hash before rendering.
First run the local construction gate on the exact normal-01 input: two construction runs must
match, and a complete primary must pass every computed geometric certificate. A failed certificate
is retained with its witness, actual value and threshold. Do not generate a six-row image matrix
if no complete primary passes. An all-failure result requires a bounded design repair.

After the local gate passes, compare exactly the six input records returned by the retained
issue-165 `inputs()` helper, which verifies both historical families agree. Keep every seed and
all nine controls. The new policy uses exact-area geometry normalization, independent quota-aware
cap placement and the fixed zero contour. No sampled threshold search, quota transfer, owner drop,
seed substitution, guard filling, new support policy or relaxed target is allowed.

The field is sampled at the retained 400×200 preview and 1600×800 full anchors. Land is positive
rounded scalar ticks; owner ordering is stable. Report total target error at both scales and each
owner's whole-sphere preview error, with limits 0.25 percentage points and 0.25/count respectively.
Geometry certificates remain continuous-geometry evidence; sampled tolerances do not prove feature
survival through future production quantization or extraction.

Each row runs twice. Compare scalar/owner bytes in explicit big-endian order, masks, both PNG sizes
and complete deterministic receipts. Check seam, unique poles and all nested anchors. A construction
or placement failure has no invented world image; retain its complete no-proposal receipt and mark
its image unavailable. A placed coverage-failing contour may be shown only as a failed diagnostic.
Outputs use new revision directories and never overwrite retained evidence.

## Review and disposition

Review native 1600×800 and half 800×400 images against every positive requirement and R1–R6 in the
unchanged visual contract. Record primary masses as observed, anatomy, water and margin-island
relationships, rejection codes and concise rationale. Assess four ordinary seeds separately from
the two control cases. Assistant observations are provisional; human decisions remain pending.
No numeric result or local repeat selects a production v3 field or proves macOS/Linux equality.

One implementation pass, independent review/repair, and at most one revised comparison are in this
issue. A new geometry rule or repeated failure must be recorded in a separately bounded successor;
keep all old diagnostics. Production provenance, input/invalidation changes, C1–C3, expanded
cohorts and accepted-state preservation remain separate gates.
