# Issue 106 bounded exact-window visibility settling stop

This directory records the bounded issue #106 correction and its one authorized replacement
non-measurement readiness preflight. The correction changed only the external issue #100/#105
controller stabilizer, its sanitized receipt, and focused tests. Ordinary builds install no
readiness controller or observer behavior. The preflight did not qualify, so issue #104 remains
blocked and its replacement row remains unconsumed.

## Exact correction

The implementation commit is `13101539eb1e0487badfb7716db06e84b91b067e`, based on
`0aa337a4bc8707675710b7d7594b06c5fc451bb3`. It preserves the existing 20,000-ms timeout and
50-ms poll interval while splitting two authorities:

1. every observation independently requires exactly one application and Accessibility window,
   the retained application/window identities, and the exact executable identity; and
2. before any session action, `applicationHidden`, `windowMinimized`, and `windowFrameVisible`
   may remain pending only inside that unchanged bound.

Invisibility never qualifies readiness. The controller performs neither `AXRaise` nor an
`AXFrontmost` write until the exact retained window is visible. Zero/multiple candidates or
windows, process/window/executable/session drift, observation failure, unsupported/non-retryable
actions, and post-action visibility or foreground loss remain immediately terminal. Persistent
pre-action invisibility fails closed at the existing bound. Terminal readiness still requires a
visible exact window, Workspace frontmost state, successful raise and frontmost write, retained
identity, and the independent Accessibility/`NSWorkspace` observer.

The version-3 sanitized receipt adds the initial and terminal values of all three visibility
subpredicates plus their combined result, pending observation count, and pending duration.
Focused deterministic tests cover initially invisible success, hidden and frame-not-visible
settling, persistent invisibility, no premature action, drift and ambiguity while invisible,
session drift, post-action visibility loss, delayed activation, transient raise success, and
permanent action/foreground failures.

## Pre-target verification

Before target use, all issue #90/#91/#94/#96/#97/#98/#100 predecessor Swift suites and the
corrected readiness suite passed. The focused packaged dispatch suite passed 14 tests. The
observer-enabled unsigned package built with 338 frontend modules and reproduced the unchanged
executable SHA-256
`5cf14de9836e9da96655572b35bb0e194d8ebc30360b6d6516f88825dcf7a15d`.

The unchanged issue #104 cancellation observer, sampler, retention utility, and independent
readiness observer reproduced, respectively:

- `dee96628ba9b9cec31a49b0bd627466a636921f1f73535f1aac421834fbc0e6d`;
- `1da835b06e7b2ffbe588e99fee2692d7cfa25f9e8117641c74a5abe73acc3dfe`;
- `c3b2d618b4dbddf9568d4d39334be9a3d0b074ae0b7a5464b4b7e30c5686441b`; and
- `9662c1664d44e93f58dc690a0fb78f08eb1f4751d84fc5790256866e768811ce`.

The corrected readiness controller SHA-256 was
`b3108470757a17c6573f29b1df91dd52baa2a9c9635633476a1edb1d28f93226`. The root gate passed
74 test files with 578 tests passed and one skipped, the semantic-retention proof, 24 Rust unit
tests, and 28 native recovery tests. Privacy, authorized-surface, fixture/production-surface,
protected-evidence hash, and diff checks passed. No product, UI, generator, render, export,
persistence, native-write, fixture, workload, budget, ceiling, safe-point, sampling, or timeout
owner changed.

## Single replacement preflight outcome

Exactly one fresh replacement non-measurement preflight ran on MacBook Pro `Mac17,2`, Apple M5,
24 GB, macOS 26.5.1 (`25F80`). The activation request was accepted and exactly one retained
application/window/executable identity survived every observation. Initially and terminally, the
application was not hidden, but the window was minimized, had no visible positive frame, and was
therefore not visible.

The window remained pending for 295 observations and 19,985 ms within the unchanged policy. At
20,000 ms the controller failed closed under `accessibility` authority because the exact retained
window had not become visibly ready. It performed zero raise attempts, zero retryable raise
failures, zero frontmost writes, and zero independent observer runs, then terminated the invalid
candidate. A separate read-only process check confirmed that no candidate remained. No retry ran.

This result validates the corrected bounded classification and its persistent-invisibility stop,
but it does not establish target-session readiness. It is setup evidence, not cancellation or
product evidence. Issue #104 remains blocked and its replacement remains **UNCONSUMED**.

## Privacy, preservation, and zero-operation proof

The sanitized receipt is
[`qualification-2026-08-24/raw-results.json`](qualification-2026-08-24/raw-results.json). It
contains no user name, PID, local path, service UUID, coalition, screenshot, pixels, CSV, or
private archive location.

The preflight configured no fixture, started no sampler, created no raw artifact or target
artifact/destination, dispatched no preview/full/SVG/PNG operation, measured no target path, ran
no issue #95 operation, and consumed no issue #104 row. The #98/#102/#103 rows and the #104/#105
stop records remain byte-identical and are not reinterpreted.
