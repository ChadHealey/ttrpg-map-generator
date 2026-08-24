# Issue 109 operator-assisted focus-handoff qualification

This directory owns the bounded issue #109 correction and its exactly one authorized
operator-assisted, non-measurement readiness preflight. The implementation changes only the
external issue #100/#105-#108 controller, controller-only stabilizer/platform adapter, sanitized
diagnostics, and focused tests. Ordinary builds install no readiness tooling or handoff UI.

## Two-phase handoff contract

Receipt version `issue109-target-session-readiness-v6` replaces the unsuccessful automated
frontmost write with an explicit pre-dispatch operator handoff:

1. The controller validates the approved host and console session, exact package/executable,
   absence of a stale candidate, exactly one fresh application, and exactly one Accessibility
   window. It separately retains the process/window identity and proves a distinct initial
   foreground application.
2. With the canonical zero-operation receipt still zero, the controller emits a sanitized
   `awaiting-operator-focus` prompt to standard error. The invocation must declare exactly one
   operator focus action; zero or more than one fails before launch.
3. The operator clicks the packaged app window or its Dock icon exactly once. The controller does
   not synthesize a click, key, Accessibility focus action, AppleScript, GUI script, or Dock action.
4. Inside the unchanged 20,000-ms timeout and 50-ms poll interval, the controller independently
   detects the retained exact candidate becoming both `NSWorkspace` frontmost and supported-true
   Accessibility frontmost. The same exact window must then expose a supported positive frame.
5. Only after those predicates pass may the controller perform supported `AXRaise`. A subsequent
   retained-state observation and the unchanged canonical issue #98 readiness observer must both
   verify exact identity, visibility, and Accessibility/Workspace frontmost state.

The initial foreground application may remain unchanged while the controller awaits the declared
action. Focus moving to any other application fails immediately. Candidate/window ambiguity,
identity or console-session drift, hidden state, post-focus minimization or invisible frame,
nonretryable Accessibility failure, focus loss, observer disagreement, or timeout also fails
closed. Only pre-dispatch `cannotComplete` readback/raise results may settle or retry within the
fixed bound.

## Sanitized prompt and diagnostics

The prompt receipt includes only the controller version, public bundle identifier,
`awaiting-operator-focus` state, declared action count, 20,000-ms timeout, exact action text, and
the zero-operation receipt. It contains no process identifier, initial foreground identity, local
path, user identity, screenshot, or pixels.

The terminal receipt records the sanitized handoff state transitions, wait duration and
observation count, declared action count, focus-transition detection, initial/terminal focus
classifications, Accessibility/Workspace/frame readback, raise action/result, retained predicates,
tool identities, and zero-operation proof. The controller records zero activation requests and
zero `AXFrontmost` writes for this path.

## Build and focused checks

```sh
mkdir -p /private/tmp/issue109-swift-module-cache

xcrun swiftc -module-cache-path /private/tmp/issue109-swift-module-cache \
  -warnings-as-errors -parse-as-library \
  -o /private/tmp/issue109-readiness-core-tests \
  docs/investigations/issue-100/target-session-readiness-core.swift \
  docs/investigations/issue-100/target-session-readiness-support.swift \
  docs/investigations/issue-100/target-session-readiness-stabilization-core.swift \
  docs/investigations/issue-100/target-session-readiness-core-tests.swift
/private/tmp/issue109-readiness-core-tests
```

The focused suite covers explicit awaiting state, the valid post-click transition, delayed
Accessibility/frame readiness, transient raise failure, wrong-application focus, application/
window/executable drift or ambiguity, timeout/no action, duplicate declared action, post-focus
loss, hidden/minimized/invisible state, raise and independent-observer failure, strict
zero-operation ordering, and predecessor issue #100 failure paths.

Before target use, also run every issue #90/#91/#94/#96/#97/#98/#100/#105/#106/#107/#108 Swift
suite, the 14-test packaged dispatch suite, the observer-enabled unsigned package build, root
`corepack pnpm check`, exact candidate/controller/observer/sampler/retention identity reproduction,
Swift formatting, privacy, authorized-surface, fixture/production-surface, protected-evidence, and
`git diff --check` gates. The protected issue #98 readiness-observer sources and build recipe must
reproduce canonical SHA-256
`9662c1664d44e93f58dc690a0fb78f08eb1f4751d84fc5790256866e768811ce` unchanged.

## Clean one-shot implementation boundary

Before commit, the corrected readiness suite and all six issue #90/#91/#94/#96/#97/#98
predecessor executables passed. The focused packaged dispatch suite passed 14 tests. The
observer-enabled unsigned package built with 338 frontend modules. The root `corepack pnpm check`
gate passed formatting, lint, type checks, 74 files / 578 tests with one intentional skip, the
isolated semantic-retention proof, 24 Rust unit tests, and 28 native recovery tests.

The exact identities at this boundary are:

| Authority                              | SHA-256                                                            |
| -------------------------------------- | ------------------------------------------------------------------ |
| Packaged executable                    | `5cf14de9836e9da96655572b35bb0e194d8ebc30360b6d6516f88825dcf7a15d` |
| Issue #104 cancellation observer       | `dee96628ba9b9cec31a49b0bd627466a636921f1f73535f1aac421834fbc0e6d` |
| RSS sampler                            | `1da835b06e7b2ffbe588e99fee2692d7cfa25f9e8117641c74a5abe73acc3dfe` |
| Retention utility                      | `c3b2d618b4dbddf9568d4d39334be9a3d0b074ae0b7a5464b4b7e30c5686441b` |
| Canonical protected readiness observer | `9662c1664d44e93f58dc690a0fb78f08eb1f4751d84fc5790256866e768811ce` |
| Corrected operator-handoff controller  | `478ba18ade87c5a0a479f743d7fe652c911c626ab715b90939f06d02dfa257c4` |

Swift formatting, public-privacy, authorized-surface, fixture/production-surface,
protected-evidence preservation, and diff checks passed. The canonical readiness observer sources
remain byte-unchanged from `37a85c0`; all prior raw evidence receipts remain unchanged. No product,
UI, generator, render, export, persistence, native-write, fixture, workload, safe-point, budget,
ceiling, sampling, or target-timeout owner changed.

## Exactly one assisted preflight

The clean committed controller is invoked with the existing exact package/observer identities and
one additional final argument declaring the single operator focus action:

```sh
<readiness-controller> \
  <exact-observer-enabled-app-path> \
  app.ttrpgmap.generator \
  <candidate-executable-sha256> \
  <canonical-readiness-observer> \
  9662c1664d44e93f58dc690a0fb78f08eb1f4751d84fc5790256866e768811ce \
  1
```

When the controller emits `awaiting-operator-focus`, the exact operator action is:

> Click exactly once on the packaged app window or its Dock icon, then do not interact with it
> again.

The handshake timeout was 20,000 ms. Exactly one fresh assisted preflight was authorized, with no
retry regardless of outcome. The run configured no fixture, started no sampler, created no artifact
or destination, dispatched or measured no operation, did not run issue #95, and did not consume
issue #104. The sanitized result was recorded only after the process terminated and a separate
read-only check proved no invalid candidate remained.

## Qualification state

**INVALID — PRE-DISPATCH STOP.** Exactly one coordinated operator-assisted preflight reached
`awaiting-operator-focus`, but the controller did not independently detect the exact candidate
becoming Accessibility or Workspace frontmost before the 20,000-ms timeout. The initial and
terminal Workspace focus classification remained `awaiting-initial-application` across 286
observations. The action order stopped at `exact-candidate-validated`,
`awaiting-operator-focus`; focus-transition detection was false.

The controller performed zero activation requests, `AXFrontmost` writes, raises, independent
observer runs, fixture/sampler/artifact/destination setup, dispatches, or measurements. It
terminated the invalid candidate, and a separate read-only process check found zero remaining
candidate processes. No retry ran. Issue #104 remains blocked and its replacement row remains
**UNCONSUMED**. This result is not cancellation, first-paint, issue #95 matrix, target-operation, or
release-budget evidence. The complete sanitized receipt is in
[`qualification-2026-08-24/raw-results.json`](qualification-2026-08-24/raw-results.json).
