# Issue 110 durable operator-ready latch qualification

This directory owns the bounded issue #110 correction and its exactly one authorized
operator-assisted, non-measurement readiness preflight. The implementation changes only the
external issue #100/#105-#109 readiness controller, controller-only latch/stabilizer/platform
support, sanitized diagnostics, and focused tests. Ordinary builds install no readiness tooling,
latch, or handoff UI.

## Durable latch contract

Receipt version `issue110-target-session-readiness-v7` retains issue #109's real-operator focus
handoff and adds an explicit coordinator-visible boundary:

1. The invocation supplies one explicit marker path directly beneath `/private/tmp` and one
   explicit unique token. Both use strict issue #110 lowercase-hex scopes; the controller performs
   no ambient filesystem discovery.
2. Before launch, the controller validates the path/token and fails closed if either the marker or
   its private publication temporary already exists. It never removes a colliding marker it does
   not own.
3. The controller proves the approved host and console session, exact fresh package/application/
   window/executable identity, a distinct initial foreground application, and the canonical
   zero-operation receipt before publication.
4. It writes a complete owner-only marker temporary, flushes it, and creates the visible marker
   with an atomic no-replace hard link. The marker's sanitized `awaiting-operator-ready` payload
   includes the explicit token, public bundle/candidate identities, exact candidate/session
   validation, one declared action, the zero-operation receipt, and the 120,000-ms handoff bound.
5. Only after atomic publication does the 120,000-ms / 50-ms operator-focus interval begin. The
   coordinator polls the exact marker directly, checks the exact token and all predicates, and only
   then asks the owner for one real click on the packaged app window or its Dock icon.
6. Issue #109's unchanged detection remains authoritative: the controller independently observes
   exact-candidate Accessibility and Workspace frontmost, a supported positive frame, retained
   identity, supported `AXRaise`, and the canonical independent observer. No input is synthesized.
7. The controller removes its marker on success, timeout, invalidation, signal, or launch failure.
   Publication or cleanup failure invalidates the preflight. Public terminal diagnostics record
   only the approved path policy, validation/collision/publication/cleanup booleans, the configured
   duration, and ordered sanitized states; they publish no path, token, PID, username, or raw
   artifact location.

The exact marker path and token are task-coordination values, not repository evidence. They are
reported privately at the clean implementation boundary and must be absent before the one-shot
controller is launched.

## Deterministic tests

The focused suite compiles the controller-only latch support and covers:

- approved and rejected explicit path/token shapes;
- owner-only atomic marker publication and exact decoded content;
- existing-marker collision without overwrite;
- exact candidate/session/zero-operation publication ordering;
- refusal to begin focus observation before publication;
- delayed coordinator observation inside the bound and a valid click transition;
- timeout, wrong-app focus, application/window/executable drift or replacement, post-focus loss,
  unsupported frame/raise, and independent-observer disagreement;
- zero, duplicate, or nonzero product/measurement action declarations; and
- required marker absence on success, timeout, invalidation, signal, and launch-failure terminal
  paths.

```sh
mkdir -p /private/tmp/issue110-swift-module-cache

xcrun swiftc -module-cache-path /private/tmp/issue110-swift-module-cache \
  -warnings-as-errors -parse-as-library \
  -o /private/tmp/issue110-readiness-core-tests \
  docs/investigations/issue-100/target-session-readiness-core.swift \
  docs/investigations/issue-100/target-session-readiness-support.swift \
  docs/investigations/issue-100/target-session-readiness-stabilization-core.swift \
  docs/investigations/issue-100/target-session-readiness-stabilization-support.swift \
  docs/investigations/issue-100/target-session-readiness-core-tests.swift
/private/tmp/issue110-readiness-core-tests

xcrun swiftc -module-cache-path /private/tmp/issue110-swift-module-cache \
  -warnings-as-errors -parse-as-library \
  -framework AppKit -framework ApplicationServices -framework CryptoKit \
  -framework Foundation \
  -o /private/tmp/issue110-readiness-controller \
  docs/investigations/issue-90/packaged-preview-observer-core.swift \
  docs/investigations/issue-90/packaged-preview-observer-security.swift \
  docs/investigations/issue-100/target-session-readiness-core.swift \
  docs/investigations/issue-100/target-session-readiness-platform.swift \
  docs/investigations/issue-100/target-session-readiness-support.swift \
  docs/investigations/issue-100/target-session-readiness-stabilization-core.swift \
  docs/investigations/issue-100/target-session-readiness-stabilization-platform.swift \
  docs/investigations/issue-100/target-session-readiness-stabilization-support.swift \
  docs/investigations/issue-100/target-session-readiness-controller.swift
```

Before target use, also run every issue #90/#91/#94/#96/#97/#98/#100/#105-#109 predecessor Swift
suite, the 14-test packaged dispatch suite, the observer-enabled unsigned package build, root
`corepack pnpm check`, exact candidate/controller/observer/sampler/retention identity reproduction,
Swift formatting, public-privacy, authorized-surface, fixture/production-surface,
protected-evidence, and `git diff --check` gates. The protected issue #98 readiness-observer
sources and canonical SHA-256
`9662c1664d44e93f58dc690a0fb78f08eb1f4751d84fc5790256866e768811ce` remain unchanged.

## Clean one-shot implementation boundary

The implementation and all required gates are committed before any packaged candidate or preflight
launch. The exact implementation commit, controller identity, reused package/tool identities,
explicit marker path/token, polling predicate, and handoff duration are recorded in the task
handoff. That committed state is the only source permitted for the one assisted preflight.

The focused issue #110 suite and all six issue #90/#91/#94/#96/#97/#98 predecessor executables
passed. The packaged dispatch suite passed 14 tests. The observer-enabled unsigned package built
with 338 frontend modules. Root `corepack pnpm check` passed formatting, lint, type checks, 74 test
files / 578 tests with one intentional skip, the isolated semantic-retention proof, 24 Rust unit
tests, and 28 native recovery tests. `test:cross-platform` passed six PNG checks and verified all
eight registered deterministic fixture sets. Swift formatting, public-privacy,
authorized-surface, fixture/production-surface, protected-evidence, and diff gates passed.

The exact identities at this boundary are:

| Authority                              | SHA-256                                                            |
| -------------------------------------- | ------------------------------------------------------------------ |
| Packaged executable                    | `5cf14de9836e9da96655572b35bb0e194d8ebc30360b6d6516f88825dcf7a15d` |
| Issue #104 cancellation observer       | `dee96628ba9b9cec31a49b0bd627466a636921f1f73535f1aac421834fbc0e6d` |
| RSS sampler                            | `1da835b06e7b2ffbe588e99fee2692d7cfa25f9e8117641c74a5abe73acc3dfe` |
| Retention utility                      | `c3b2d618b4dbddf9568d4d39334be9a3d0b074ae0b7a5464b4b7e30c5686441b` |
| Canonical protected readiness observer | `9662c1664d44e93f58dc690a0fb78f08eb1f4751d84fc5790256866e768811ce` |
| Durable-latch readiness controller     | `2e941986cf8d3a38e25e5319d84da93daa1572c95ce329ba512cea5a3c23fb51` |

All prior raw receipts and consumed/unconsumed status records remain byte-unchanged. No product,
UI, generator, render, export, persistence, native-write, fixture, workload, safe-point, budget,
ceiling, sampling, or target-operation timeout owner changed. The only widened time boundary is
the issue #110-authorized pre-dispatch operator handoff after marker publication.

At this boundary the target preflight is **NOT RUN**. No packaged candidate has been launched, no
marker has been published for coordination, and no operator action has been requested. No fixture,
sampler, raw artifact, destination, dispatch, measurement, issue #95 action, or issue #104 action
has occurred. Issue #109's invalid stop remains immutable and issue #104's replacement row remains
**UNCONSUMED**.

## Exactly one assisted preflight

After coordinator follow-up, compile the committed controller and invoke it once with the exact
package/observer identities plus the declared action, explicit marker path, and explicit token:

```sh
<readiness-controller> \
  <exact-observer-enabled-app-path> \
  app.ttrpgmap.generator \
  <candidate-executable-sha256> \
  <canonical-readiness-observer> \
  9662c1664d44e93f58dc690a0fb78f08eb1f4751d84fc5790256866e768811ce \
  1 \
  <explicit-private-tmp-marker-path> \
  <explicit-issue110-token>
```

The coordinator polls only that exact path and accepts readiness only when one complete JSON value
matches `issue110-operator-ready-latch-v1`, `awaiting-operator-ready`, the exact supplied token,
the exact package identity, 120,000 ms, one declared action, both candidate/session validation
Booleans, and the complete zero-operation receipt. The owner then performs exactly one click on the
packaged app window or its Dock icon and does not interact with it again.

Exactly one fresh assisted preflight is authorized, with no retry regardless of outcome. It
configures no fixture, starts no sampler, creates no artifact or destination, dispatches or
measures no operation, does not run issue #95, and does not consume issue #104. A sanitized outcome
is recorded only after the process terminates, the explicit marker is absent, and a separate
read-only check proves no invalid candidate remains.

## Qualification state

**NOT RUN — AWAITING COORDINATOR FOLLOW-UP.** The repository is intentionally stopped at the clean
committed one-shot boundary. Issue #104 remains blocked and **UNCONSUMED**.
