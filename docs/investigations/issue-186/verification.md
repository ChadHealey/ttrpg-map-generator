# Issue 186 verification

The one authorized evidence pass and exactly one computational replay completed successfully. This verifies reproducibility of a rejected bounded proposal, not production readiness.

## Immutable source and result boundary

The [source manifest](evidence-r1/source-manifest.json) pins 116 source files and has SHA-256:

`cd1ffe9c03da9284f49c45faedac3d487adf023241635779c64eb0dd278ff478`

Root verified this exact manifest and current trusted source equality before authorizing field evaluation. The checkpoint is issue184 comparison-r1, with manifest hash `e84aced071922f04e360a52e7f3bb97fb824d007cb27d619e521791217623aa4` and results hash `5de2b6cc06b690b8925d7b5b19c3f1fac2aeb7f1c106a136eec2409f8832a6ae`. Later issue184 geometry and evidence are not substituted.

The retained directory contains the source manifest and compressed source closure, eight synthetic results, 12 profile receipts, 12 paired Z/H ring archives, a decision and completion hashes: 29 files. Original owner geometry is bound through the pinned checkpoint rather than duplicated or regenerated. The [completion record](evidence-r1/completion.json) names all 26 output artifacts exactly. Full sample arrays remain ephemeral; explicit canonical little-endian scalar/tick/component and byte land/owner hashes bind them.

All runtime and declaration bytes were frozen before capture. Captured bytes remain unchanged;
the current policy document has the formatting-only transition described below. This README/findings/verification set is a later, uncaptured interpretation. The independent pre-capture review is also separate from computational evidence.

## Completed commands

The authorized sequence was:

`node docs/investigations/issue-186/run.mjs --prepare`

After separate exact-manifest clearance:

`node docs/investigations/issue-186/run.mjs --run`

Then exactly once:

`node docs/investigations/issue-186/run.mjs --verify`

The final replay returned verified=true, replay=true, rows=6, profiles=2, plannedPolicyEvaluations=24, policyEvaluations=24, synthetics=8 and sources=116. It recalculated both profiles and policies from the captured, trusted-equal source and compared every output. Both pass and replay exit with code 0 while retaining all scientific/policy failures. No second computational replay or renderer was run.

For a bounded read-only integrity check without more sampling, use:

`node docs/investigations/issue-186/verify-retained.mjs`

That command validates pinned original source/checkpoint and result authority, the single
policy formatting transition, exact inventory and retained hashes. It does not perform computational replay. The computational command is documented as reproduction provenance, not a request to exceed this investigation's spent replay budget.

## Focused verification

Before capture, 13 private tests and 14 unchanged production tests passed: **27 tests in 6 files**. The [independent implementation review](independent-implementation-review.md) separately passed that same selection and strict TypeScript checking. Coverage includes all eight synthetics, actual public classification, zero/tie refusal, exact displacement rounding, seam/pole topology, component/predecessor identity, hostile source/input rejection before execution, exact artifact inventories, and independent failure retention. The existing seam synthetic supplies the complete pipeline smoke; it is not a ninth fixture.

The reproducible focused commands are:

`corepack pnpm exec vitest run docs/investigations/issue-186/policy.test.mjs docs/investigations/issue-186/evidence.test.mjs packages/generation/src/atlas-sampling-profiles.test.ts packages/generation/src/atlas-coastline-adversarial.test.ts packages/generation/src/atlas-land-water-classification.test.ts packages/generation/src/atlas-surface-topology.test.ts`

`corepack pnpm exec tsc -p docs/investigations/issue-186/tsconfig.json --noEmit`

Focused ESLint passed before capture. An earlier focused Prettier check passed, but the final
policy append was not rechecked before capture; the resulting precommit failure and repair are
recorded below. Root's combined `pnpm exec vitest run docs/investigations` passed 343 tests in 59 files, with one historical test in one additional file skipped. The skipped issue-152 suite requires its separately supplied `ISSUE_152_SOURCE_DIR`; no new test is skipped. The [independent retained-result review](independent-result-review.md) is complete. It verified
trusted hashes, all 12 receipt/decision entries and all 23 decompressed extraction results without
repeating the spent computational replay.

These are focused and combined investigation checks, not a new clean root `pnpm check` result. The broader workspace limitation retains the earlier [timeout and focused/native recovery record](../issue-168/verification.md); this discovery does not recast that record as an unqualified pass.

## Result scope

All 12 total-coverage gates and preview owner checks pass. Shared anchors match exactly. All 24 policies are attempted; Z rejects one full profile, while 23 extractions complete. No proposal passes the complete preservation contract. [Findings](findings.md) identify exact component failures and distinguish successful topology validation from original-role certification. There is no new visual or human-acceptance claim and no production change.

## Post-capture policy formatting transition

The first local commit attempt failed the whole-repository Prettier hook on `policy.md`. The
pre-capture formatting report had relied on an earlier check and missed the final policy append.
No commit was made by that attempt and no hook was bypassed. A second attempt exposed a
Prettier 3.9.6 non-idempotence: those array-leading list continuations gain three spaces on
every formatting pass (33→36→39). Reducing indentation to three also grows it on each pass.
The final paragraph-join repair avoids that parser behavior; CLI format checking and the
verifier's explicit idempotence check pass. The interim formatter-only policy was not committed
or substituted into evidence.

The exact original policy remains in the immutable compressed source snapshot. The current
policy differs only in whitespace, through the exact list-continuation repair below. The new [historical integrity verifier](verify-retained.mjs)
pins the original source manifest, compressed snapshot and completion bytes. It joins only the
12 pinned original continuation lines (73, 74, 76, 78–83 and 90–92), each checked for exactly
33 leading spaces, onto its preceding paragraph with one space. The bound formatter then yields
exactly the current text; a second format must be identical and all non-whitespace text must
match the original. All other trusted source, metadata, checkpoint and artifact bytes must still
match. A self-consistent rehashed replacement result cannot satisfy the pinned completion hash.

Original policy SHA-256: `a8d894cc16732639d454c58877b8dd8158af4ea60813672692b9f440b4d26db6`.
Current formatted policy SHA-256: `32cb152db64d6bd3976b672ee6e5841d0bc4ca72da217575bc7700d6e8831670`.
The original `run.mjs --hashes-only` now deliberately rejects current policy drift. Its earlier
pre-format integrity pass and completed computational replay remain historical results. Use
`verify-retained.mjs` for current read-only verification; it evaluates zero field samples and
executes no captured module. Neither evidence artifacts nor runtime source were regenerated.

Six focused transition tests pass. They cover the valid transition, changed policy meaning,
changed executable source, coherently rehashed source/results, changed tool/checkpoint metadata,
and altered or unexpected artifacts. The earlier 343-test combined run precedes these six tests;
it is not represented as a later 349-test combined run.

The [independent formatting-transition review](postcapture-format-review.md) records this repair
and preserves the pre-format checks as historical results.
