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

Not started. Exactly one target attempt is permitted only after every Phase A gate passes from the
clean committed implementation boundary.
