# Issue 98 packaged generation-cancellation qualification stop

This directory implements only the observer, test, and documentation boundary authorized by issue
#98. The packaged hooks call the existing production preview, full-generation, and cancellation
actions. The target observer reuses issue #96's exact-fixture preview authority, issue #94's
accepted-atlas first-paint authority, issue #90's process/RSS observer, issue #91's private
retention utility, and issue #100's target-session controller. No production generation,
cancellation, safe-point, progress, fixture, workload, render, export, persistence, budget, or
timeout contract changed.

## Fail-closed observer contract

The test-only packaged dispatch exposes one chord for each preview/full × early/middle/late class.
The app-side receipt requires the exact checked-in fixture, the normal empty pre-state for preview
or exact disposable preview pre-state for full generation, one production operation identity,
bounded monotonic progress, and the declared safe-point range. It timestamps the unchanged
production cancellation action through the terminal cancelled operation receipt. Terminal
validation requires costly scheduling to have stopped, the previous state to remain present, and
no accepted commit at acknowledgement. A separate aftermath chord invokes the same production
full-generation action and accepts completion only when the persistence-owned canonical aspect,
output, and coastline hashes equal the checked-in fixture authority.

The independent macOS observer requires the approved host, exact candidate/tool identities, one
application/GPU/Networking/WebContent membership set, uninterrupted foreground ownership, ≤20-ms
sampling with dispatch and acknowledgement endpoint coverage, the app receipt, and a one-second
post-acknowledgement canvas/Accessibility quiet window. It then requires the next completed full
operation to produce issue #94's changed accepted-atlas first paint and final Accessibility state.
Every PID-bearing CSV is handed to issue #91 retention before its observer receipt is inspected.

## Build and negative-path checks

The implementation commit is `19686859b9c6f88a771134afbf8fc31533a4ad2b`. The observer-enabled
candidate and exact tools reproduced these SHA-256 identities before the target attempt:

| Authority                      | SHA-256                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| Packaged executable            | `5cf14de9836e9da96655572b35bb0e194d8ebc30360b6d6516f88825dcf7a15d` |
| Cancellation observer          | `eedee77c2825652dd03dac05e965a8ff309dcd6af6b4f4defb46940bb850e6b8` |
| RSS sampler                    | `1da835b06e7b2ffbe588e99fee2692d7cfa25f9e8117641c74a5abe73acc3dfe` |
| Retention utility              | `c3b2d618b4dbddf9568d4d39334be9a3d0b074ae0b7a5464b4b7e30c5686441b` |
| Target-session controller      | `613e5f10a63f7293ca9e4aa4c2ab483185594d54560a4e286a145abcbf98a337` |
| Independent readiness observer | `9662c1664d44e93f58dc690a0fb78f08eb1f4751d84fc5790256866e768811ce` |

The issue #90 preview, issue #94 accepted-atlas, issue #96 exact-preview, issue #91 retention,
issue #100 readiness, and new issue #98 core negative-path suites all passed before target use. The
focused TypeScript generation/cancellation suite passed 39 tests. Deterministic cross-platform,
visual, E2E, root, and observer-enabled packaged-build gates passed. The root gate passed 74 test
files with 578 tests passed and one skipped, semantic-retention validation, and 24 plus 28 Rust
tests. The source/privacy audit found only the authorized packaged observer wiring, tests, native
observer sources, and owning documentation; production and fixture owners were unchanged.

## Consumed invalid trial and stop

Issue #100 readiness qualified one fresh exact process on MacBook Pro `Mac17,2`, Apple M5, 24 GB,
macOS 26.5.1 (`25F80`) without configuring a fixture, starting a sampler, or consuming a trial.
The first required trial then dispatched preview cancellation in the early safe-point class for
`milestone-2-atlas-proof`. Its app receipt passed the bounded progress, terminal cancellation,
≤100-ms acknowledgement, stopped-scheduling, previous-state, and no-accepted-commit prerequisites.
The sampler receipt contained 74 valid rows over 449.164 ms with a maximum observed interval of
6.391 ms.

The overall target trial is nevertheless **INVALID, CONSUMED**. During the mandatory one-second
quiet window, the independent observer rejected the combined post-acknowledgement presentation,
state, or foreground predicate. The sanitized invalidation authority is `screen-capture` and its
reason is `post-acknowledgement presentation, state, or foreground changed`. Because the combined
predicate failed, there is no acknowledgement-latency qualification, deterministic-aftermath
qualification, or cancellation-path authority from this run.

The PID-bearing sampler CSV was retained owner-only before the sanitized observer receipt was
inspected. Its temporary source was removed. The opaque artifact identifier is
`issue98_preview_early`, its retained byte length is 4,879, and its SHA-256 is
`9bff1541c47955afed1526bc4e9b611659c0fdc228d73ea7172c64091a2bc46e`. No private archive path,
PID, raw row, user identity, or local package/repository path is published.

Per issue #98's non-retry rule, execution stopped immediately after this first consumed invalid
trial. Preview/middle, preview/late, and all three full-generation cancellation classes were not
run. There was no silent retry and no replacement authority was invented. Issue #98 therefore
remains unqualified, and issue #95's five-run release matrix remains unrun.

The complete sanitized machine-readable receipt is in
[`qualification-2026-08-23/raw-results.json`](qualification-2026-08-23/raw-results.json).
