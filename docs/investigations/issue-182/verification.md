# Issue 182 verification

The large-primary runtime was frozen after one material recipe and before the manifest-first
128-input recovery replay. Later additions are tests, read-only comparison/local-panel helpers
and documentation; runtime/source hashes remain unchanged. The root task owns local commit,
precommit, tracking and issue disposition. No push is authorized.

## Completed focused checks

```sh
pnpm exec vitest run docs/investigations/issue-182/*.test.mjs
pnpm exec eslint docs/investigations/issue-182/*.mjs
pnpm exec prettier --check docs/investigations/issue-182
node docs/investigations/issue-182/verify-local.mjs
node docs/investigations/issue-182/run.mjs --verify
node docs/investigations/issue-182/compare-baseline.mjs
node docs/investigations/issue-182/render-local.mjs --verify
```

Twelve tests pass. They cover the five actual paid-quota anatomy cases, fixed role/root/site
identities, input immutability and malformed anatomy; exact six-row construction and old-twelve
delegation compatibility; first appended recovery with independent category payments; all four
fallback variants with independent island/group zeros; candidate bounds and explicit unchanged
unsupported-cap exhaustion; trusted local-stage identity and coherently rehashed source/path
tampering rejected before saved-source execution. Formatting and lint pass. Local documentation references resolve
and the new source/docs contain no private machine paths.

The guarded local-stage verifier checks the exact known entry, safe inventory, dependencies and
entire source closure against current trusted source before invoking the inherited replay helper.
Self-reported hashes alone do not authorize executing saved code. It then replays all five
certificates and reproduces the exact PNG. Use `verify-local.mjs` as the verification entry;
the inherited local-evidence helper alone is not the trust boundary. The paid-owner renderer reproduces one
400×400 local chart panel from `default-001` owner 0, at fixed span 2.8; it performs no world render.
The complete recovery verifier checks the immutable 128-probe manifest, source closure and
artifact inventory, performs 256 strict repeated calls and compares each retained compressed
receipt and summary. It passes with zero raster calls in the recovery lane.

The separate baseline comparison passes: 90 exact prior successes, 38 recoveries, selected index
at most 12, every original candidate receipt preserved, every original accepted owner preserved,
and exact old placement for prior successes. It ties its result to these completion hashes:

- Issue-180 final: `3a95d22feac54adda8fbf04edecaf68e64a5e4d389f645a05ae1aa8a07f5708e`.
- Issue-182 recovery: `1d6d4c91fde962d90c8f0e091421f6cd86cf689500d22c9b0f0a6698753919a7`.

## Independent and acceptance boundary

The root independently inspected recipe-1's exact local PNG and confirmed the numerical repair
does not establish whole-world visual acceptance. It also inspected the paid-owner panel and
ran the guarded local replay and exact baseline comparison. The combined investigation suite
passes **243 tests in 40 files**. The [independent code/provenance review](independent-review.md)
is complete. Precommit is recorded by the root task at the local commit checkpoint.
These focused private checks do not stand in for `pnpm check` on a production change, the
production 128-preview sweep, the 12-default/6-control human cohort, or macOS/Linux proof.

The existing `.mapworld` files, v1/v2 state, accepted fixtures, issue-179 comparisons and all
frozen certificate/placement sources remain unchanged. The exact counterexamples and visual
failures from previous issues remain part of the evidence record.

The previous broad root timeout and successful focused/native recovery are retained accurately
in [issue 168 verification](../issue-168/verification.md). Unchanged production/native stages
are reused; this is not represented as one clean root command. All continuation commits are local.
