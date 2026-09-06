# Verification

State 1 source freeze contains 25 sources. The main task independently checked the prospective
manifest before authorizing execution. Its SHA-256 is
`6647a27aa04465a6c373bb7a60a9ea9dd6ce4beb419acd80d908b75f64439a43`;
the retained manifest is identical. The external authority was independently recomputed and
pinned by the main task after the authorized replay, with SHA-256
`09fba4b6511d2db5b4f85b22ad6fcb46fba9957e0475a5c695ef7c34c11971db`.

The initial, repeat and replay phases each reserved 60 slots and made exactly 60 constructor
and 60 body-certificate calls. All phases passed 60 cases. Repeat and replay outputs match the
initial encoded outputs exactly. The replay is spent; do not run record or replay again.
The retained [claims, receipts and artifacts](evidence/state-1/summary.json) are pinned by
[external authority](authority/state-1.json).

Safe repeatable commands, with zero useful geometry calls:

```sh
node docs/investigations/issue-190/run.mjs --verify state-1
pnpm exec vitest run docs/investigations/issue-190/pure.test.mjs docs/investigations/issue-190/evidence.test.mjs
pnpm exec prettier --check docs/investigations/issue-190
pnpm exec eslint docs/investigations/issue-190
```

Nine focused tests pass: six pre-capture pure schema, corpus, counter, declaration and static
phase-wiring checks, plus three post-capture retained-evidence tests. The latter verify external
authority, reject altered source/inventory/image bytes in temporary copies, and decode the saved
PNGs to prove exact half-size decimation. They import no useful constructor, evaluator,
certificate or renderer. Source and image checks re-encode or read saved data only.

The author and main reviewer inspected both actual images and rejected local R3, as recorded
in the [disposition](disposition-state1.md). The [independent result review](independent-local-review.md) agrees with the rejection and
independently passes the nine tests and zero-call verification. Numerical
success establishes the fixed local certificate outcome, not organic appearance, family
selection, human visual acceptance or production readiness.

The main task's combined investigation check passed 41 tests in six files in 1.60 seconds:

```sh
pnpm exec vitest run docs/investigations/issue-188 docs/investigations/issue-189 docs/investigations/issue-190
```

This run spends no additional issue-190 useful geometry calls. Earlier unchanged broad repository
checks retain their recorded timeout and recovery limitations; this is not a new clean root
`pnpm check`. All captured sources and the original evidence remain unchanged.
