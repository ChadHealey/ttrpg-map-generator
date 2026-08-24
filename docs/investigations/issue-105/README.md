# Issue 105 reusable target-session readiness stabilization stop

This directory records the bounded issue #105 correction and its one authorized non-measurement
readiness preflight. The correction changed only the external issue #100 controller, controller-only
stabilization support, and focused tests. Ordinary builds install no controller or observer
behavior. The preflight did not qualify, so issue #104 remains blocked and its replacement row
remains unconsumed.

## Exact correction

The implementation commit is `bdad48f7b2fcd7c01b4f2aa4f2161bfdb4c7ce13`, based on
`03a640fe91bf2cf7bdd14309e7bde6b5445a8355`. It replaces the immediate
activation-to-`AXRaise` sequence with separate fail-closed authorities for:

1. AppKit activation-request acceptance;
2. a controller-only 20,000-ms retained-candidate stabilization policy with 50-ms polling;
3. exact application, executable, Accessibility-window, GUI-session, and visibility retention on
   every observation;
4. explicit `AXRaise` support and result, retrying only `cannotComplete` before any product setup;
5. explicit `AXFrontmost` settable support and write result;
6. terminal retained Accessibility and `NSWorkspace` frontmost readback; and
7. the unchanged independent issue #100 observer followed by one final retained-identity readback.

The controller receipt now reports sanitized activation, observation, raise, retryable-raise, and
frontmost-write counts; stabilization duration and policy; and terminal predicates. It fails closed
on timeout, wrong session, stale/zero/multiple candidates or windows, executable/application/window
drift, invisibility, unsupported or failed actions, and foreground loss. Focused deterministic tests
cover delayed activation, permanent activation failure, transient and permanent raise failure,
unsupported actions, frontmost-write failure, drift, ambiguity, foreground loss, and timeout.

## Pre-target verification

Before target use, all issue #90/#91/#94/#96/#97/#98/#100 and new issue #105 Swift core suites
passed. The focused packaged dispatch suite passed 14 tests. The observer-enabled unsigned package
built with 338 frontend modules and reproduced the unchanged executable SHA-256
`5cf14de9836e9da96655572b35bb0e194d8ebc30360b6d6516f88825dcf7a15d`.

The unchanged issue #104 cancellation observer, sampler, retention utility, and independent
readiness observer reproduced, respectively:

- `dee96628ba9b9cec31a49b0bd627466a636921f1f73535f1aac421834fbc0e6d`;
- `1da835b06e7b2ffbe588e99fee2692d7cfa25f9e8117641c74a5abe73acc3dfe`;
- `c3b2d618b4dbddf9568d4d39334be9a3d0b074ae0b7a5464b4b7e30c5686441b`; and
- `9662c1664d44e93f58dc690a0fb78f08eb1f4751d84fc5790256866e768811ce`.

The corrected controller SHA-256 was
`0079b8fae359d691172fe4c577b7d72b752c8239a84063ca6c32320193538d95`. The root gate passed
74 test files with 578 tests passed and one skipped, the semantic-retention proof, 24 Rust unit
tests, and 28 native recovery tests. Privacy, authorized-surface, fixture/production-surface,
protected-evidence hash, and diff checks passed. No product, UI, generator, render, export,
persistence, native-write, fixture, workload, budget, or timeout owner changed.

## Single preflight outcome

Exactly one fresh non-measurement preflight ran on MacBook Pro `Mac17,2`, Apple M5, 24 GB,
macOS 26.5.1 (`25F80`). The activation request was accepted. At the first stabilization
observation, 9 ms after the request, the retained exact Accessibility window was not yet visible.
The controller failed closed under `accessibility` authority before `AXRaise`, `AXFrontmost`, or the
independent observer ran, then terminated the invalid candidate. A separate read-only process check
confirmed no candidate remained.

The one preflight recorded one activation request, one stabilization observation, zero raise
attempts, zero retryable raise failures, and zero frontmost writes. It did not reach terminal
visibility or frontmost predicates. This is a target-session setup stop, not cancellation evidence
and not a product failure. No retry ran.

The result shows that activation settling can also precede initial visibility, while the
implemented policy currently treats first-observation invisibility as terminal. A successor needs
new authority to decide whether exact retained-window visibility may settle within the existing
bounded pre-dispatch policy and then to perform a new qualification. This task does not silently
expand the retry policy or spend another preflight.

## Privacy and zero-operation proof

The sanitized receipt is
[`qualification-2026-08-24/raw-results.json`](qualification-2026-08-24/raw-results.json). It
contains no user name, PID, local path, service UUID, coalition, screenshot, pixels, CSV, or private
archive location.

The preflight configured no fixture, started no sampler, created no raw artifact or target
artifact/destination, dispatched no preview/full/SVG/PNG operation, measured no target path, ran no
issue #95 operation, and consumed no issue #104 row. The three historical #98/#102/#103 invalid
rows, their retention records, and issue #104's zero-operation stop remain byte-identical and are
not reinterpreted.
