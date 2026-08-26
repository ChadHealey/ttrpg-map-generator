# Issue 122 zero-command observer qualification

This directory owns the one-shot launch wrapper and sanitized qualification record for issue #122.
It starts from exact integrated commit `f30a4a928ec342ec46cc0e4601e66f0f9fa47072` and preserves
ADR-0020, issues #119–#121, all product and fixture sources, and every historical evidence file.

## Boundary

`observer-qualification-wrapper.swift` adds only the launch orchestration missing from issue #121.
It requires zero pre-existing matching candidates, constructs issue #121's exact nonactivating
five-value `NSWorkspace.OpenConfiguration`, retains the one application returned by
`NSWorkspace.shared.openApplication`, requires that it is the sole exact running candidate, and
delegates the authenticated READY-only session to `Issue121ObserverController.qualify()`. It never
calls `execute`, constructs a COMMAND frame, or invokes a product authority. Every terminal path
requires exact-candidate termination, zero matching candidates, and private endpoint cleanup.

The focused injected-launch suite exercises the successful launch boundary, pre-existing, zero,
multiple, and wrong-returned candidate states, exact termination, cleanup, and termination
uncertainty without calling `NSWorkspace` or launching the app.

## Phase A state

**ARMED — NOT LAUNCHED.** The implementation and package source tree is exact integrated commit
`f30a4a928ec342ec46cc0e4601e66f0f9fa47072`; the Phase A commit is reported in the handoff because
a commit cannot contain its own identity. No candidate, GUI, or product operation was launched.

The focused no-launch wrapper suite passed 6 tests. Issue #121 passed 36 Swift tests and both
explicit Rust/Swift interoperability cases. Issue #119 passed 26 focused Rust tests and 2 ordinary
absence tests. Issue #120 and packaged-dispatch compatibility passed 71 tests. The six protected
issue #90/#91/#94/#96/#97/#98 Swift observer/retention test executables passed with warnings as
errors. Strict Swift formatting passed for the complete issue #121/#122 source boundary.

Root `corepack pnpm check` passed formatting, lint, type checks, 77 test files with 619 tests passed
and one intentional skip, semantic retention, 50 Rust unit tests, and 28 native recovery tests.
The named cross-platform gate passed six PNG comparisons and all eight registered deterministic
fixture sets. The Swift 6.3 controller was compiled with warnings as errors; its SHA-256 is
`a915fa3afd2d206b752690bb59975dd62d4e513c862bf82c5073ec310cbfed32`.

The ordinary unsigned package compiled 339 frontend modules. Its bundle identifier is
`app.ttrpgmap.generator`, Info.plist SHA-256 is
`0692bc6d426d65118ab78c94a7dfc9e5db79a1da5a2693196b2a5cdbd21ef66a`, and executable SHA-256 is
`25686c85f7b92516202a55a5f2939aa24a66c7d39a059f4b91594e6926c104ab`. An artifact-wide scan found
none of the protocol magic, five bootstrap names, listener/event/command names, peer adapter,
server symbols, or frontend bridge names.

Exactly one observer package build used `VITE_OBSERVER_COMMAND_CHANNEL=1` together with Cargo
feature `observer-command-channel` and compiled 341 frontend modules. It retained the same bundle
and Info.plist identities and produced executable SHA-256
`657e6cacad7499e6e5fd4f6e29bb7414a392f9e434ef2939dc5a47d26fefc13f`. Artifact scans found the
five bootstrap names, macOS peer adapter and server symbols, frontend listener, event, and lifecycle
command names. Both packages have only the expected ad-hoc linker signature; dependencies,
lockfiles, capabilities, entitlements, product, fixture, and protected sources are unchanged.

Privacy, authorized-surface, product/fixture, protected-evidence, dependency/lockfile,
capability/entitlement, staged-file, and diff checks passed. The final pre-commit scan found zero
matching candidate processes and no observer endpoint/runtime node. Issue #104 remains
**UNCONSUMED**.

## Phase B result

**INVALID — CONTROLLER SIGNAL BEFORE RECEIPT.** Phase B began from clean committed Phase A HEAD
`ddae9ba372f2463b51f2c6155bbee5fb8563a6a3` only after the controller, observer candidate,
Info.plist, paired-gate surface, active GUI session, zero-process, zero-runtime-node, privacy, and
protected-surface checks reproduced exactly.

The controller was invoked once and `NSWorkspace` launched exactly one fresh nonactivating exact
candidate. The controller then terminated by signal before it emitted a sanitized mutual-
authentication/frontend-READY receipt or ran its own terminal cleanup. That absence cannot be
reinterpreted as a qualified session, so the one attempt is INVALID. The committed wrapper calls
only issue #121's `qualify()` with an empty command list; it has no call to `execute` and no product
authority. Therefore it emitted zero COMMAND frames and invoked zero product operations, but it did
not qualify mutual authentication or frontend READY.

An independent terminal check found one exact-name candidate and one private runtime directory.
One termination signal stopped that exact candidate. Its endpoint had been removed, leaving the
owner-only runtime directory empty; the directory was then removed. Independent final checks found
zero candidate processes and zero observer endpoint/runtime nodes. No private endpoint, session,
capability, PID, local path, user identity, or raw diagnostic is recorded.

There was no retry, fallback, activation, input, fixture, sampler, artifact/destination, product
operation, #95 action, or #104 activity, and no code was corrected after Phase B began. Issue #104
remains **UNCONSUMED** and NOT READY. The sole sanitized result is
[`qualification-2026-08-25/result.json`](qualification-2026-08-25/result.json).

## Issue #125 idempotent cleanup correction

Issue #125 corrects only the wrapper's retained-candidate terminal cleanup from exact integrated
commit `400b42ad8c82c49ee762811f3b6e4a50f9d3b46f`. An already-terminated retained handle now succeeds
without another termination request only when its PID relationship is unchanged and a fresh exact
bundle scan finds zero running candidates. A live candidate still passes the complete retained and
scanned identity checks before one termination request. A false return from that request is treated
as a possible race, never as success: the wrapper waits within the existing five-second bound and
requires both retained termination and a fresh zero-candidate scan.

Replacement, multiple, wrong-PID, wrong-identity, nonterminating, and deadline states remain
fail-closed. Candidate cleanup still completes before endpoint cleanup is attempted. The expanded
injected suite passes 14 no-launch cases, including explicit absence-before-endpoint-cleanup
ordering. Issue #121/#123 passes 39 Swift tests and both no-app-launch Rust/Swift interoperability
cases; issue #119 passes 26 focused and two ordinary-absence tests; issue #120 plus packaged
dispatch passes 71 tests; and all six protected Swift executables pass.

Root `corepack pnpm check` passes 77 files with 619 tests and one intentional skip, semantic
retention, 50 Rust unit tests, and 28 native recovery tests. The named cross-platform gate passes
six PNG comparisons and all eight registered fixture sets; the named APFS recovery gate passes all
28 cases. Privacy, authorized-surface, product/fixture, protocol/server/frontend, dependency/
lockfile, capability/entitlement, protected-evidence, staged-file, formatting, and diff gates pass.

The correction built and launched no packaged candidate, created no live observer endpoint, sent no
COMMAND frame, invoked no product operation, and performed no issue #95 or #104 action. Issue #124
and all historical evidence remain byte-identical, **INVALID/CONSUMED**, and uninterpreted. Issue
#104 remains blocked and **UNCONSUMED**; any new zero-command qualification requires separate
authority after this correction integrates.
