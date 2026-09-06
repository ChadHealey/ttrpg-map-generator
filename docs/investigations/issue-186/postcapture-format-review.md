# Independent review of the post-capture formatting repair

**The retained evidence remains valid under the narrowly defined historical integrity verifier. No captured source, result or computational replay was replaced.** The precommit formatting failure exposed a difference in current `policy.md` formatting after the experiment had already been captured and replayed. This review covers only that documentary transition and the new read-only verifier.

The original [run.mjs](run.mjs) is unchanged. I confirmed that its `--hashes-only` command now rejects current authority because the policy digest differs. The earlier successful hash check in the [result review](independent-result-review.md) occurred before formatting and remains a historical observation; it is not a claim that the original command accepts current files.

[verify-retained.mjs](verify-retained.mjs) independently pins the original manifest, compressed source snapshot and completion bytes. The completion pin prevents coherently replacing a result together with its checksum. The source manifest pin and exact snapshot inventory/digests prevent substituting executable source, including coherently rehashed source. Fixed artifact names are checked before their reads; unknown files reject.

The only current-source exception is `policy.md`. The final helper first asserts the exact original policy digest, then joins only original lines 73, 74, 76, 78–83 and 90–92 to their preceding paragraph with one space. Every selected line must have exactly 33 leading spaces. It formats this fixed transformation with the declared Markdown parser and print width, requires a second format to be identical, and requires current policy bytes to equal that unique result. A separate non-whitespace equality assertion checks that no policy text changed; it is not a general acceptance rule for arbitrary whitespace edits. Every other trusted source, public package entry, checkpoint reference and recorded Node/TypeScript/Prettier version remains exact. Source authority is checked again after artifact verification. The verifier imports current read-only capture helpers but neither compiles/executes captured modules nor evaluates fields.

The captured policy digest is `a8d894cc16732639d454c58877b8dd8158af4ea60813672692b9f440b4d26db6`; the verified current formatting digest is `32cb152db64d6bd3976b672ee6e5841d0bc4ca72da217575bc7700d6e8831670`. The frozen manifest remains `cd1ffe9c03da9284f49c45faedac3d487adf023241635779c64eb0dd278ff478`.

The interim formatter-only transition, with policy digest `82d309fc77a5696509f61de248748a466cb4aa62d5a00d9702e47a79960905ef`, passed the initial integrity tests but failed the next formatting hook. Independently formatting the original snapshot in memory reproduced Prettier 3.9.6 adding three spaces on every pass: the 12 lines grow 33→36→39 spaces. A proposed 33→3-space reduction also grows 3→6→9 and was rejected before finalization. The final paragraph-join transformation avoids that instability. These documentary attempts changed no captured artifact and evaluated no fields.

Independent checks passed:

- `pnpm exec vitest run docs/investigations/issue-186/verify-retained.test.mjs`: six tests. They reject changed policy meaning, changed executable source, coherent source/manifest replacement, changed tool/checkpoint metadata, coherent result/completion replacement, unhashed result changes and extra files.
- `node docs/investigations/issue-186/verify-retained.mjs`: verified=true, replay=false, evaluatedFieldSamples=0, 116 sources and 26 output artifacts.
- `pnpm exec prettier --check docs/investigations/issue-186/policy.md`: passes on the final joined-paragraph text; the verifier also checks formatter idempotence on every invocation.
- The original `run.mjs --hashes-only` fails with the expected current-authority mismatch. That rejection is preserved deliberately.

No actionable correctness or provenance finding remains in this bounded repair. The original one-pass/one-replay budget is unchanged and spent. This later verifier establishes retained-byte integrity under a specific formatting transition; it is not a new computational replay, a general historical-source exception or a relaxation of the rejected experiment's acceptance criteria.
