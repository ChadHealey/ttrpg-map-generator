# Issue 107 exact minimized-window restoration stop

This directory records the bounded issue #107 correction and its one authorized replacement
non-measurement readiness preflight. The correction changed only the external issue #100/#105/#106
controller, stabilizer, platform adapter, sanitized diagnostics, and focused tests. Ordinary builds
install no readiness controller or changed launch/window behavior. The preflight did not qualify,
so issue #104 remains blocked and its replacement row remains unconsumed.

## Exact correction

The implementation commit is `6195f9389a7aa18636b56220c3bf280cb65b0fc7`, based on
`35046679efa1a067845ed3019a72142e59f57449`. It preserves the existing 20,000-ms timeout and
50-ms poll interval while adding one exact-window restoration boundary before issue #105's
unchanged raise/frontmost sequence:

1. every observation independently requires the one retained application, Accessibility window,
   executable identity, and designated GUI session;
2. a hidden application fails immediately because the controller has no unhide authority;
3. a minimized exact window requires `AXMinimized` support and settable verification, followed by
   an `AXMinimized=false` write;
4. the same retained window must then read back non-minimized and positive-frame-visible; and
5. only after those separate predicates pass may existing Workspace-frontmost stabilization,
   `AXRaise`, `AXFrontmost`, terminal retained readback, and the independent Accessibility and
   `NSWorkspace` observer run.

Only a pre-dispatch `cannotComplete` from the minimize support/write boundary is retryable inside
the unchanged policy. Unsupported or non-settable attributes, permanent support/write failure,
hidden application, ambiguity, identity/session drift, success without non-minimized readback,
persistent minimized/invisible state, and post-restoration visibility loss fail closed. Focused
deterministic tests cover each path, separate non-minimized and frame-visible readbacks, and prove
the action order prevents raise/frontmost writes before restoration.

## Pre-target verification

All issue #90/#91/#94/#96/#97/#98/#100/#105/#106 predecessor Swift suites and the corrected
readiness suite passed. The focused packaged dispatch suite passed 14 tests. The observer-enabled
unsigned package built with 338 frontend modules and reproduced the unchanged candidate executable
SHA-256 `5cf14de9836e9da96655572b35bb0e194d8ebc30360b6d6516f88825dcf7a15d`.

The unchanged issue #104 cancellation observer, sampler, retention utility, and independent
readiness observer retained, respectively:

- `dee96628ba9b9cec31a49b0bd627466a636921f1f73535f1aac421834fbc0e6d`;
- `1da835b06e7b2ffbe588e99fee2692d7cfa25f9e8117641c74a5abe73acc3dfe`;
- `c3b2d618b4dbddf9568d4d39334be9a3d0b074ae0b7a5464b4b7e30c5686441b`; and
- `9662c1664d44e93f58dc690a0fb78f08eb1f4751d84fc5790256866e768811ce`.

The corrected readiness controller SHA-256 was
`c8e6286107967224b8d2c4dbffc8bec4aee7252468a58da7cd0373a63b6260b6`. The root gate passed
74 test files with 578 tests passed and one skipped, the semantic-retention proof, 24 Rust unit
tests, and 28 native recovery tests. Privacy, authorized-surface, fixture/production-surface,
protected-evidence hash, and diff checks passed. No product, UI, generator, render, export,
persistence, native-write, fixture, workload, safe-point, budget, ceiling, sampling, or timeout
owner changed.

## Single replacement preflight outcome

Exactly one fresh replacement non-measurement preflight ran on MacBook Pro `Mac17,2`, Apple M5,
24 GB, macOS 26.5.1 (`25F80`). At the first observation, the application was not hidden and the
exact application/window/executable identity was retained, but the window was minimized and had no
visible positive frame. The controller made one `AXMinimized` support/settable query. The platform
returned `attributeUnsupported`, so no `AXMinimized=false` set-attribute write was performed.

The controller failed closed under `accessibility` authority after 13 ms. Action order was only
`activation-request` then `minimize-attribute-unsupported`: one activation request and one retained
observation, zero set-attribute writes, raises, frontmost writes, independent observer runs, or
product actions. It terminated the invalid candidate, and a separate read-only process check
confirmed no candidate remained. No retry ran.

This result validates the fail-closed support predicate but does not establish reusable
target-session readiness. The authorized exact-window Accessibility write cannot proceed on the
observed platform element. Any broader session-control mechanism, manual interaction, UI scripting,
unhide policy, or production window/launch change remains outside issue #107 and requires a new
owner decision. Issue #104 remains blocked and its replacement remains **UNCONSUMED**.

## Privacy, preservation, and zero-operation proof

The sanitized receipt is
[`qualification-2026-08-24/raw-results.json`](qualification-2026-08-24/raw-results.json). It
contains no user name, PID, local path, service UUID, coalition, screenshot, pixels, CSV, or private
archive location.

The preflight configured no fixture, started no sampler, created no raw artifact or target
artifact/destination, dispatched no preview/full/SVG/PNG operation, measured no target path, ran no
issue #95 operation, and consumed no issue #104 row. The #98/#102/#103 rows and #104/#105/#106 stop
records remain byte-identical and are not reinterpreted.
