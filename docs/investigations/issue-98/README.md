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
post-acknowledgement presentation-observation window. Every complete post-acknowledgement frame is
evaluated against issue #90's completed-preview signature for preview cancellation or issue #94's
accepted-atlas first-paint signature for full cancellation. Any matching signature remains a
sticky invalidation even if later frames return to the previous UI. Raw pixel changes are retained
only as sanitized diagnostic counts and are not independently qualifying or invalidating. Final
Accessibility must still prove the previous presentation state. The observer then requires the
next completed full operation to produce issue #94's changed accepted-atlas first paint and final
Accessibility state. Every PID-bearing CSV is handed to issue #91 retention before its observer
receipt is inspected.

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

## Issue 102 replacement correction and stop

Issue #102 corrected only the issue #98 observer and tests. Observer version
`packaged-generation-cancellation-host-observer-v2` ignores every frame at or before the observed
terminal acknowledgement, establishes the quiet-window screen baseline from the first complete
frame strictly after acknowledgement, and compares only later complete frames. Screen-frame
absence/change, Accessibility state drift, foreground loss, membership drift, sampling failure,
and retention failure now retain separate fail-closed authorities and reasons. Production app,
generation, cancellation, safe-point, progress, fixture, workload, budget, timeout, render,
export, persistence, and native-write surfaces are unchanged.

The exact observer-enabled packaged executable remained
`5cf14de9836e9da96655572b35bb0e194d8ebc30360b6d6516f88825dcf7a15d`. The corrected observer was
`62b580279bd67ab850ac39e0ca10bc5d56340c29832fd966358a97b0ca6429e3`; the sampler, retention,
readiness controller, and readiness observer reproduced their issue #98 identities unchanged.
Focused temporal and independent-invalidation tests plus every predecessor, deterministic, E2E,
visual, root, unsigned-package, privacy, authorized-surface, fixture-diff, and diff gate passed
before target use.

Issue #100 readiness then qualified one fresh exact process without consuming a trial. The single
authorized replacement preview/early row dispatched once. Its app receipt reported early-stage
work `28/1000`, two monotonic progress samples, terminal cancellation in **2 ms** against the
unchanged 100-ms prerequisite, stopped costly scheduling, preserved previous state, and no
accepted commit at acknowledgement. Sampling retained 69 valid rows across 418.223 ms with a
6.371-ms maximum interval, exact four-role arithmetic, and dispatch/acknowledgement endpoint
coverage.

The replacement is nevertheless **INVALID, CONSUMED**. The corrected screen authority established
its first complete post-acknowledgement baseline and observed at least one later complete frame,
but that later frame changed from the baseline. The independent sanitized authority is
`screen-capture`; the exact reason is `post-acknowledgement quiet-window pixels changed`. This is
not acknowledgement-latency, deterministic-aftermath, cancellation-path, or release-budget
authority.

The replacement CSV was retained owner-only before either sanitized receipt was inspected, and
its temporary source was removed. Its opaque identifier is
`issue102_preview_early_replacement`, retained byte length is 4,554, and SHA-256 is
`2f6957fdcb7d454a36028a25a2eb9afcb149e82b434175ea88171d3e8cb1ecbc`. No private path or raw
content is published. The original `issue98_preview_early` invalid trial and its retained bytes
remain separately unchanged, invalid, consumed, and owner-only.

Execution stopped immediately. Preview/middle, preview/late, and all full-generation rows were
not run. There was no retry, no invented authority, no issue #95 matrix execution, and no release-
budget conclusion. The sanitized replacement stop is in
[`replacement-qualification-2026-08-23/raw-results.json`](replacement-qualification-2026-08-23/raw-results.json).

## Issue 103 completed-presentation correction

Issue #103 corrects only the issue #98 observer, focused tests, and owning documentation. Observer
version `packaged-generation-cancellation-host-observer-v3` requires a complete previous-state
frame before dispatch and at least two complete canvas frames after the observed terminal
acknowledgement. It continuously calls the unchanged issue #90 preview-frame predicate for a
cancelled preview or the unchanged issue #94 accepted-atlas predicate for a cancelled full
generation. Detection is sticky across later frames. Pixel-change presence and changed-frame count
remain sanitized diagnostics; neither is a qualification predicate.

The app receipt, final Accessibility previous-state authority, no-accepted-commit proof,
uninterrupted foreground monitor, exact four-role membership, ≤20-ms RSS cadence and endpoint
coverage, deterministic next completion, and issue #91 owner-only retention remain independent and
fail closed. Focused tests cover pixel-only change, first-frame late preview completion followed by
UI return, first-frame late accepted-atlas completion followed by UI return, missing complete
frames, Accessibility drift, foreground loss, membership drift, sampling failure, and retention
failure. Both historical rows and their owner-only artifacts remain unchanged, **INVALID,
CONSUMED**; this correction does not reinterpret either row.

Before target use, the new and predecessor Swift suites, focused 14-test packaged dispatch suite,
cross-platform, E2E, visual, root, unsigned-package, privacy, authorized-surface, fixture-diff, and
diff gates pass. The package remains byte-identical at SHA-256
`5cf14de9836e9da96655572b35bb0e194d8ebc30360b6d6516f88825dcf7a15d`. The corrected observer is
SHA-256 `ffe1589c3841ac577d726800c68e2d5cc3733432cfd4f55f7b2947453cba0018`; the sampler,
retention utility, readiness controller, and readiness observer reproduce their issue #98
identities unchanged. Target outcomes are appended only after the authorized one-shot sequence.

The implementation commit is `e783ac5f78c2747698e106d6638644e3046450f4`. Issue #100 readiness
qualified one fresh exact process with zero fixture, sampler, measurement, or raw-artifact
activity. One pre-dispatch observer invocation then rejected a non-direct temporary raw path before
target capture; it configured no fixture, started no sampler, created no raw artifact, dispatched
no operation, and consumed no row.

The single authorized issue #103 preview/early replacement then dispatched once. Its app receipt
reported early-stage work `28/1000`, two monotonic progress samples, terminal acknowledgement in
**2 ms** against the unchanged 100-ms prerequisite, stopped costly scheduling, preserved previous
state, no accepted commit at acknowledgement, and a recorded canonically deterministic next
completion. Sampling had 63 valid rows over 379.503 ms with a 6.396-ms maximum interval, exact
four-role arithmetic, and dispatch/acknowledgement endpoint coverage. The corrected cancellation
presentation authority established its previous-state baseline, observed the required complete
post-acknowledgement frames, detected no cancelled-preview completion signature, retained
foreground, and passed final Accessibility previous-state authority. Exact pixel-change diagnostic
counts were not published because the observer later emitted only its fail-closed invalid receipt.

The replacement is nevertheless **INVALID, CONSUMED**. Although the app receipt recorded a
canonically deterministic aftermath completion, the independent observer did not qualify issue
#94's required accepted-atlas aftermath frame. Its sanitized authority is `screen-capture`; the
reason is `the deterministic accepted aftermath did not qualify`. The first retention invocation
also rejected a symlinked archive-root argument as `unsafeArchiveRoot`; without rerunning the row,
the same intact raw CSV was then retained through the canonical owner-only root before further
evidence inspection. The retained opaque identifier is `issue103_preview_early_replacement`, byte
length is 4,164, and SHA-256 is
`48f1cd3a2375664bdce48370c4da3ccbb054a10a865590bc294e9d4b6b1acec5`; its temporary source was
removed and no private location is published.

Execution stopped immediately after the invalid row. Preview/middle, preview/late, and all full
rows were not run; there was no row retry, no issue #95 matrix activity, and no release-budget
conclusion. Both historical rows and private artifacts remain separately unchanged, **INVALID,
CONSUMED**, and owner-only. The complete sanitized receipt is in
[`operation-signature-qualification-2026-08-23/raw-results.json`](operation-signature-qualification-2026-08-23/raw-results.json).
