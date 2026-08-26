# Issue 124 SIGPIPE-safe zero-command observer qualification

This directory owns the two-phase, one-shot qualification authorized by issue #124. It starts from
exact integrated commit `be26deb16cca44897b9d805de08d867e77c9a7d0`, reuses the integrated issue
#121 SIGPIPE-safe client and immutable issue #122 launch wrapper, and permits no product command or
operation. Issue #104 remains **UNCONSUMED**.

## Phase A boundary

**ARMED — NOT LAUNCHED.** Phase A completed from the exact integrated source commit and is committed
before target use. The Phase A commit is reported in the handoff because a commit cannot contain its
own identity.

The complete no-launch gate set passed:

- issue #121/#123: 39 Swift tests with strict formatting and warnings as errors;
- production Rust/Swift interoperability: 2/2 explicit no-app-launch cases;
- immutable issue #122 wrapper: 6/6 injected-launch tests without calling `NSWorkspace`;
- issue #119: 26 focused observer transport tests and 2/2 ordinary-absence tests;
- issue #120 and packaged-dispatch compatibility: 71/71 tests;
- protected issue #90/#91/#94/#96/#97/#98 observer/retention suites: 6/6 executables;
- root: 77 files, 619 passed and one intentional skip, one semantic-retention proof, 50 Rust unit
  tests, and 28 native recovery tests;
- deterministic cross-platform: six PNG comparisons and all eight registered fixture sets.

One ordinary unsigned package transformed 339 frontend modules and contained none of the protocol,
five bootstrap values, listener/event/lifecycle commands, client, or server surface. Its bundle ID
is `app.ttrpgmap.generator`; its Info.plist SHA-256 is
`0692bc6d426d65118ab78c94a7dfc9e5db79a1da5a2693196b2a5cdbd21ef66a`; and its executable SHA-256
is `25686c85f7b92516202a55a5f2939aa24a66c7d39a059f4b91594e6926c104ab`.

Exactly one observer package used `VITE_OBSERVER_COMMAND_CHANNEL=1` together with Cargo feature
`observer-command-channel` and transformed 341 frontend modules. It has the same bundle and
Info.plist identities, includes only the approved bootstrap, server/peer, listener/event, and
lifecycle-command surface, and has executable SHA-256
`657e6cacad7499e6e5fd4f6e29bb7414a392f9e434ef2939dc5a47d26fefc13f`. Both executables are thin
arm64 Mach-O bundles with ad-hoc linker signatures and no Team ID.

The exact warnings-as-errors qualification controller SHA-256 is
`44fc89949aaa4811b3e3b93a6e8f48a46f515a6a0e5c2b96709a0bcc9a35a9ef`. The integrated client tree
Git identity is `68e9701aa1b064be85905cfe00ee85bc5268572f`; the immutable wrapper blob identity is
`e435b4438fd33f366be86bd43e51b5bbb1e5b66e`.

Privacy, authorized-surface, product/fixture, dependency/lockfile, capability/entitlement,
protected-evidence, staged-file, formatting, and diff gates passed. Immediately before this
boundary there were zero matching candidates and zero observer runtime nodes, and the active GUI
session matched the controller user. No candidate, GUI, controller session, COMMAND frame, product
operation, issue #95 action, or issue #104 activity occurred.

The sanitized machine-readable boundary is
[`qualification-2026-08-25/phase-a.json`](qualification-2026-08-25/phase-a.json).

## Phase B result

**INVALID — CONTROLLER CLEANUP UNCERTAINTY.** Phase B began only from clean committed Phase A HEAD
`32f3376253e2a1de62e83956391ffdbd778e89f2`. The controller, observer candidate, bundle, Info.plist,
paired-gate surface, active GUI session, zero-process state, zero-runtime-node state, privacy, and
protected surfaces all reproduced exactly before target use.

The exact controller was invoked once and launched one fresh nonactivating exact observer
candidate/session. It emitted the sanitized terminal authority `observer-client.cleanup`, reported
`commandCount: 0`, and did not qualify terminal cleanup. Cleanup uncertainty makes the complete
attempt INVALID; mutual authentication and frontend READY are not claimed or reinterpreted.

The committed qualification path calls issue #121's READY-only `qualify()` with an empty command
list. It has no call to `execute`, constructs no COMMAND frame, and invokes no product authority.
The attempt therefore sent zero COMMAND frames and invoked zero product operations.

Independent terminal scans found zero matching candidate processes, zero observer runtime
directories, and zero observer socket nodes. No endpoint, session, capability, PID, path, user
identity, raw diagnostic, or private receipt is recorded. There was no retry, fallback, activation,
input, fixture, sampler, artifact/destination, dispatch, measurement, issue #95 action, issue #104
activity, or code correction after Phase B began. Issue #104 remains **UNCONSUMED** and NOT READY.
A future attempt requires a separately authored successor with fresh authority.

The sole sanitized result is
[`qualification-2026-08-25/result.json`](qualification-2026-08-25/result.json).
