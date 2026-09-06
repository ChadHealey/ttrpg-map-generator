# Issue 185 verification

The private typed registry and source-bound canonical evidence exercise the released public core
entry point. Production source, old canonical fixtures and historical investigations were not edited.

The fixed matrix evaluates 48 rows with fresh streams, including counts 1/4/8, forward/reverse
ordering, independent isolated/archipelago zeros, and variant revisions 0/1. Its 6,052 vectors
retain exact seed inputs, encoded preimages, derived seed digests, the first four available floats
and a checksum of every complete bounded draw vector. The maximum reserved universe has 3,026
names and 170,226 float draws. Reservation is a conservative ceiling, not an executed placement
or geometry budget claim.

Commands:

```sh
pnpm exec tsc -p docs/investigations/issue-185/tsconfig.json --pretty false
pnpm exec vitest run docs/investigations/issue-185/registry.test.mjs docs/investigations/issue-185/evidence.test.mjs packages/core/src/seed-input.test.ts packages/core/src/seed-derivation.test.ts packages/core/src/deterministic-random-stream.test.ts packages/core/src/identity.test.ts packages/core/src/generated-aspects.test.ts
node docs/investigations/issue-185/run.mjs --verify
```

All 73 tests in seven files pass: eight private registry/evidence tests and 65 unchanged core
seed-input, derivation, stream, identity and generated-aspect tests. The strict private TypeScript
check, investigation format/lint checks, relative-link check and machine-path scan pass. The
recorded evidence and read-only replay both report 48 rows, 6,052 vectors and 76 captured sources.
The [independent review](independent-review.md) is complete with no remaining
actionable finding. The main task also replayed all evidence, ran strict typechecking
and verified the same 73 focused tests across its two focused runs. Repository
precommit applies the whole-repository formatting/lint boundary. Unchanged broad
production/native stages retain the [recorded timeout and recovery](../issue-179/verification.md);
this is not a claim of a new clean root `pnpm check` run.

Independent review found one malformed-key acceptance before the first capture: joining sorted
keys with commas could alias a single `member,owner` property with two required fields. The final
boundary compares key-array lengths and individual strings; the exact malformed detached concern
is rejected by regression. No retained evidence had to be rewritten. A separate deliberate-name
alias test proves the finite-name check fails when concerns collide.

Other negative cases cover unknown concerns/free aspect names, missing/extra fields, coerced or
out-of-range indices, fabricated world-surface identities, extra core seed fields, advancing an
unrelated mutable stream, coherently rehashed source injection, changed saved vector bytes and a
coherently rehashed matrix-row substitution. The evidence verifier first
compares its exact source inventory and text with a trusted closure and checks the declared core
package name/export. It compiles only current trusted source through that public entry, then
replays artifact bytes and checks source stability again. Node, TypeScript and Prettier versions
are explicit; no cross-platform equality is claimed from this local run.

The registry's observed variant change and unchanged classification namespace are seed evidence
only. They establish neither classifier output invariance nor a successful new geometry family.
No production contour, control policy, persisted generator-3 tuple, human visual selection or
production corpus is accepted by these checks.
