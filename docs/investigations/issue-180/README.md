# Issue 180: frozen-family coverage audit

This discovery audit tests construction and bounded placement for the frozen
[issue-179 r2 family](../issue-179/revision-r2.md). It does not tune that family,
render additional worlds, or qualify production or semantic behavior.

The manifest is written before execution. It declares 128 additional decimal
seeds with default controls, followed by 32 seed-1 control probes. The latter
cover every enum, the count/water/circumference endpoints, both detached-category
endpoints, fragmentation band boundaries and selected combined extremes. This
is a finite diagnostic corpus, not exhaustive coverage or a statistical sample.

Run from the repository root:

```sh
node docs/investigations/issue-180/verify.mjs --final
node docs/investigations/issue-180/verify.mjs --initial
node docs/investigations/issue-180/run-final.mjs --show default-001
corepack pnpm exec vitest run docs/investigations/issue-180/audit.test.mjs
```

The verifier checks the trusted current source closure against the captured source
and issue-179 hashes before executing captured modules. It checks the exact
artifact inventory, then replays all 160 probes twice without writing files.
`--show` expands one compressed receipt for inspection. The retained source
closure is shared once; each probe stores one complete result and both exact
repeat hashes. Gzip is lossless. Strict deep equality is checked before JSON
serialization; this is a same-runtime repeat, not cross-platform determinism.

The historical writer sequence for each of `run.mjs` and `run-final.mjs` was
`--prepare` then `--run`. Their original embedded verifier has a JSON summary
comparison bug; use `verify.mjs` above for both immutable captures. Both refuse to
replace retained artifacts. Do not rerun the writer against this evidence.
Missing or incomplete evidence is an audit failure, never permission to select
another seed. See [findings](findings.md) for results and control limitations.

The [independent review](independent-review.md) is complete. The combined focused
investigation suite passes **231 tests in 37 files**; the main task also replayed
the final 160-row capture successfully. Both historical and final captures were
independently replayed. This completes the audit with a failure diagnosis, not a
production qualification. [Issue 182](https://github.com/ChadHealey/ttrpg-map-generator/issues/182)
addresses the ordinary large-primary construction failure separately. Commits
remain local, with no push.
