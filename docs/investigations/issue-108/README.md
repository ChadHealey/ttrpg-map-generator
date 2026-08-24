# Issue 108 frontmost capability-ordering stop

This directory records the bounded issue #108 correction and its one authorized replacement
non-measurement readiness preflight. The correction changed only the external issue
#100/#105/#106/#107 controller, controller-only stabilizer/platform adapter, sanitized diagnostics,
and focused tests. Ordinary builds install no readiness tooling or changed application behavior.
The preflight did not qualify, so issue #104 remains blocked and its replacement row remains
unconsumed.

## Exact correction

The implementation commit is `e144fff323c4f1e682d1f5db54ecb374e9f7d133`, based on
`26d52070b810679067e0f5c6b288a1963df49e5b`. It preserves the existing 20,000-ms timeout and
50-ms poll interval while correcting the controller-only capability model and action order:

1. `AXMinimized`, position/size frame visibility, and application `AXFrontmost` reads are recorded
   as a supported Boolean value or an explicit unavailable reason (`no-value`,
   `attribute-unsupported`, `cannot-complete`, `invalid-value`, or `read-error`); unsupported or
   unreadable values are never published as observed `true`/`false` values.
2. After accepted AppKit activation, every observation still proves the exact application,
   executable, Accessibility window, and GUI session before any action.
3. The exact application must support settable `AXFrontmost`; the controller writes
   `AXFrontmost=true`, then independently awaits supported-true Accessibility readback and
   `NSWorkspace` foreground before it considers the window.
4. The same exact window must then provide a supported positive position/size frame. An explicitly
   observed `AXMinimized=true` prevents visibility, while unavailable `AXMinimized` is diagnostic
   rather than invented minimized state. No `AXMinimized` write or unhide authority exists.
5. Only after frontmost and supported positive-frame predicates pass may `AXRaise` run. Final
   retained-state validation and the unchanged independent Accessibility/`NSWorkspace` observer
   remain required.

Only documented pre-dispatch `cannotComplete` results may retry inside the unchanged bound.
Unsupported/non-settable capability, nonretryable action/read error, hidden application,
ambiguity, identity/session drift, or a verified foreground/visibility loss fails immediately.
Focused tests cover unsupported versus observed minimized state, missing frame attributes,
frontmost-before-window/raise ordering, delayed Workspace and frame success, support/settable/
write/readback failures, bounded `cannotComplete`, drift, ambiguity, timeout, and predecessor
failure paths.

## Pre-target verification

All issue #90/#91/#94/#96/#97/#98/#100/#105/#106/#107 predecessor Swift suites and the corrected
readiness suite passed. The focused packaged dispatch suite passed 14 tests. The observer-enabled
unsigned package built with 338 frontend modules and reproduced the unchanged candidate executable
SHA-256 `5cf14de9836e9da96655572b35bb0e194d8ebc30360b6d6516f88825dcf7a15d`.

The unchanged issue #104 cancellation observer, sampler, and retention utility reproduced,
respectively:

- `dee96628ba9b9cec31a49b0bd627466a636921f1f73535f1aac421834fbc0e6d`;
- `1da835b06e7b2ffbe588e99fee2692d7cfa25f9e8117641c74a5abe73acc3dfe`;
- `c3b2d618b4dbddf9568d4d39334be9a3d0b074ae0b7a5464b4b7e30c5686441b`.

The original protected-readiness-observer gate was incomplete before the preflight: it compiled
and hashed the noncanonical artifact described below instead of replaying the authoritative issue
#98 build. All other listed pre-target gates and reused identities passed. A post-preflight,
no-GUI provenance audit corrected this evidence before handoff.

The corrected readiness controller was
`ade48973c2631381b221bfe8e92fbbd5ee31f1c5affda26a79574f7058cb0e04`. A provenance audit replayed
the original issue #98 task log's authoritative observer build: `-module-cache-path
/private/tmp/issue100-swift-module-cache`, `-warnings-as-errors`, `-parse-as-library`, the AppKit,
ApplicationServices, CryptoKit, and Foundation frameworks, and these inputs in order: preview core,
preview security, readiness core, readiness platform, readiness support, and the observer entry
point. Compiled to the canonical `/private/tmp/issue98-readiness-observer` output path, the unchanged
sources reproduced the protected observer SHA-256 exactly:
`9662c1664d44e93f58dc690a0fb78f08eb1f4751d84fc5790256866e768811ce`.

The preflight command had instead received
`f2c9b54561c68d8dea89ced7253316b7e1604db1b2eac42683e7d1609be4f023`, built with readiness support
before readiness platform and the different `/private/tmp/issue108-target-session-readiness-observer`
output path. That noncanonical artifact passed the controller's supplied-file hash check but is not
the protected observer identity. The controller stopped before observer launch, so the artifact was
never executed and contributed no independent-observer verification to the preflight outcome. The
observer's canonical sources and verification behavior remain unchanged.

The root gate passed 74 test files with 578 tests and one intentional skip, the semantic-retention
proof, 24 Rust unit tests, and 28 native recovery tests. Swift formatting, privacy,
authorized-surface, fixture/production-surface, protected-evidence, and diff checks passed. No
product, UI, generator, render, export, persistence, native-write, fixture, workload, safe-point,
budget, ceiling, sampling, or timeout owner changed.

## Single replacement preflight outcome

Exactly one fresh replacement non-measurement preflight ran on MacBook Pro `Mac17,2`, Apple M5,
24 GB, macOS 26.5.1 (`25F80`). One activation request was accepted. The exact
application/window/executable/session identity survived all 292 observations through the unchanged
20,000-ms bound.

On the first exact-identity observation, application `AXFrontmost` was supported and settable. The
controller performed one `AXFrontmost=true` write and it returned success before any Workspace,
window-frame, or raise requirement. Accessibility readback nevertheless remained a supported
`false` value, and `NSWorkspace` never reported the candidate frontmost. Initial and terminal
`AXMinimized` and position/size frame reads were both explicitly unavailable with reason
`attribute-unsupported`; they were not recorded as observed minimized or frame-invisible values.

The controller timed out fail-closed under `foreground` authority with reason
`the packaged candidate did not reach retained frontmost readiness before the stabilization
timeout`. Action order was exactly `activation-request`, `frontmost-write-succeeded`: one
frontmost support/settable check and write, zero `AXMinimized` writes, zero raises, zero independent
observer runs, and zero product actions. Because frontmost readback never qualified, frame
availability was never awaited as a readiness stage. The invalid candidate was terminated, a
separate read-only check found no candidate process, and no retry ran.

This result proves the corrected capability/order diagnostics and isolates a new platform fact: on
this exact session, a successful supported/settable application `AXFrontmost=true` write does not
produce supported-true Accessibility readback or Workspace foreground. It does not establish
reusable target-session readiness. Any successor action requires new authority; this task does not
invent another write, a retry, UI scripting, manual interaction, or a broader session mechanism.

## Privacy, preservation, and zero-operation proof

The sanitized receipt is
[`qualification-2026-08-24/raw-results.json`](qualification-2026-08-24/raw-results.json). It
contains no user name, process identifier, local path, service UUID, coalition, screenshot, pixels,
CSV, or private archive location.

The preflight configured no fixture, started no sampler, created no raw artifact or target
artifact/destination, dispatched no preview/full/SVG/PNG operation, measured no target path, ran no
issue #95 operation, and consumed no issue #104 row. The #98/#102/#103 rows and #104/#105/#106/#107
stop records retain their exact prior SHA-256 values and are not reinterpreted. Issue #104 remains
**UNCONSUMED**, every conditional row remains unauthorized/unrun, and there is no cancellation,
first-paint, issue #95 matrix, or release-budget conclusion.
