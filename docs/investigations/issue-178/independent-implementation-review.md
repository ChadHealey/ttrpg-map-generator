# Issue 178 independent implementation and local evidence review

**No actionable implementation or evidence-contract finding remains.** The private
[certificate](certificates.mjs) implements the upper-witness change cleared by the
[independent design checkpoint](independent-design-review.md). This review clears
that bounded change and its local evidence, not an accepted owner family or world.

## Proof-to-code mapping

The new mode uses the exact far endpoints returned only after existing collar
validation. That validation establishes T's endpoint identity, interior position,
absence of additional contact, the two simple C/D components, actual exposed coast
prefixes and their separation. An invalid far cut returns no collar and cannot
contribute an upper witness.

The explicit `root-and-far` mode computes the conservative root and far upper
bounds, takes their minimum and records both values plus the selected witness.
Root wins an exact tie. The opposing-chain distance remains solely a lower bound;
the implementation never substitutes it for the validated root or far upper witness.
The original root still determines peninsula extent, all of C union D remains
credited feature area, and whole-disk, lower-width, topology, role share, bay,
guard and quota checks remain unchanged. A smaller upper bound cannot erase their
failures.

Absent or explicit `root` preserves the previous metrics schema and failure
records. Unknown modes reject before geometry work; no fallback changes the mode
after a failed fit. The change adds bounded arithmetic within the existing
attachment budget. Its assurance remains binary64 EPS/slack diagnostics, not
formally outward-rounded interval arithmetic.

## Compatibility and adversarial verification

Independently compared **81 saved owner receipts** from issue-172 comparisons r1
and r2 and issue-177 comparison r1. Every complete receipt matches in both default
and explicit-root modes. This comparison read saved candidates and receipts directly;
it did not regenerate a historical constructor or write old evidence. Supporting
and wedge success/failure compatibility is also covered by the focused tests.

Reviewed and ran the two focused test files: **17 tests pass**. They cover broad-root taper acceptance
only in the explicit new mode, deterministic root/far selection, unchanged extent
and area fields, invalid mode and nonfinite/degenerate inputs, narrow throats,
missing/distal/clipped disks, invalid or coast-coincident far cuts, extra contacts,
hidden coast, alternate bridges and unrelated primary/owner failures.

The final spiral regression supplies a concrete outside-C minimizing chord. Its
sampled inner/outer coast chains produce a valid collar and whole first disk, but
the closest opposing-chain connection runs across the exterior end gap. The test
matches that endpoint distance to the exhaustive chain minimum and verifies its
midpoint lies outside C. The new upper still uses only R/T and remains more than
five times delta/c; delta/c is not accepted as an upper witness. Expected width and extent
target failures remain visible; the fixture is not presented as an accepted
peninsula. This final fixture was reviewed separately from the earlier five-point
spiral discussed during design review.

## Local evidence and resolved finding

Reviewed [primary-check.mjs](primary-check.mjs): it captures recursive source closure
before and after execution, preserves three literal local attempts and their
default/new-mode receipts, asserts all three final cases pass, and uses create-new
directory writes. Its verification mode is read-only and reproduces source text,
full report contents and image bytes. The evidence is explicitly bare primary
geometry without detached islands, complete paid owners, placement or a world field.

One concrete input-provenance finding was corrected before authoritative evidence:
the writer initially applied the ordinary detached fraction .0095 to the balanced
case too. The retained balanced control requires .016. The final writer and each
receipt now record explicit fractions .0095, .0095 and .016, yielding actual body
quotas .12982331431535268, .10394491279069766 and .0656, within binary64 representation.

Ran the corrected writer's `--verify` path successfully: **nine complete reports
and three PNGs reproduce exactly**. The initial attempt retains its lobe-ratio
failures and smallest-case width failure; the intermediate attempt retains the
smallest-case first-disk failure. The final geometry passes at all three body sizes.
Root-only mode still rejects its peninsula width upper bound and ratio. Also
replayed [corroborate.mjs](corroborate.mjs) and deep-compared its parsed output with
[corroboration.json](corroboration.json): exact equality. Reviewed implementation,
tests and writer pass ESLint.

Viewed all three local PNGs. The broad-root taper removes the conspicuously pinched
club junction seen in issue 177. Its pointed triangular outline and familiar
round-ended bay remain local visual concerns. These single chart panels do not
establish peninsula recognizability in a varied world cohort, half-atlas visual
acceptance or human selection. Earlier source/evidence and the design checkpoint
were not edited by this review.
