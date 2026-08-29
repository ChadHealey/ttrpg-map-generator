# Milestone 9 observer-controller repair

This directory records the no-product-launch controller repair seeded by the Milestone 2 Path B
closure. It is release-hardening infrastructure under
[ADR-0021](../../adr/0021-defer-packaged-performance-evidence-to-milestone-9.md), not Milestone 2
evidence and not authority to consume issue #104 or launch an observer-enabled product package.

**Status (2026-08-29): repair verified; live product qualification not run or authorized.** The
issue #121 focused suite passes 39 tests, the expanded issue #122 injected suite passes 17 tests,
strict Swift formatting and warnings-as-errors compilation pass, and the non-product stub-bundle
harness passes on the designated Mac.

The repair:

- emits separate candidate, endpoint, and combined cleanup authorities;
- preserves a pending operation error instead of masking it with a cleanup error;
- uses `proc_pidpath`-backed kernel truth for retained-candidate liveness;
- keeps exact-bundle replacement, multiple-candidate, PID, path, digest, and endpoint checks
  fail-closed; and
- covers the retained-handle-frozen-live/process-gone skew that invalidated issues #124 and #126.

The injected suite also proves kernel-live/scan-absent waits to the deadline, all cleanup token
combinations, operation-error precedence, sanitization, and candidate-before-endpoint ordering.

## Stub-bundle harness

`stub-bundle-harness.swift` copies its own compiled executable into an ephemeral, non-product `.app`,
launches that exact bundle through the production qualification wrapper, and runs terminal cleanup
while the controller remains on the main actor. It uses no TTRPG Map Generator package, observer
socket session, COMMAND frame, fixture, product operation, Accessibility action, or input synthesis.
The harness removes its temporary bundle after the exact candidate is gone.

```sh
mkdir -p /private/tmp/m9-observer-controller-module-cache

xcrun swiftc -module-cache-path /private/tmp/m9-observer-controller-module-cache \
  -warnings-as-errors -parse-as-library \
  -o /private/tmp/m9-observer-cleanup-stub-harness \
  docs/investigations/issue-121/observer-client-core.swift \
  docs/investigations/issue-121/observer-client-platform.swift \
  docs/investigations/issue-121/observer-client-ipc.swift \
  docs/investigations/issue-121/observer-client-controller.swift \
  docs/investigations/issue-122/observer-qualification-wrapper.swift \
  docs/investigations/milestone-9-observer-controller/stub-bundle-harness.swift

/private/tmp/m9-observer-cleanup-stub-harness
```

A passing run prints only `milestone-9 observer cleanup stub harness: passed`. Any candidate,
endpoint, or temporary-bundle uncertainty exits nonzero.
