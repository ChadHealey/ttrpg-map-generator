# Issue 121 standalone observer client

This directory owns ADR-0020's standalone Swift controller/client and its no-app-launch evidence
boundary. It creates private session state, constructs the exact future `NSWorkspace` launch
configuration, authenticates one retained candidate process, and implements the fixed `TMOC` v1
controller lifecycle. It does not contain an app-launch call, product authority, fixture logic,
Accessibility action, input synthesis, focus operation, or reusable automation API.

## Boundaries

- `observer-client-core.swift` owns the pure codec, fragmented stream decoder, command table,
  receipt privacy checks, fixed deadlines, and single-in-flight controller state machine.
- `observer-client-platform.swift` owns exact package, bundle, process-path, and executable-digest
  identity validation.
- `observer-client-ipc.swift` owns secure randomness, direct-`/private/tmp` namespace checks, future
  launch-configuration construction, Unix socket access, effective-UID checks, and `LOCAL_PEERPID`.
  Every live-connected or test-adopted descriptor must pass centralized `SO_NOSIGPIPE` installation
  and readback before the wrapper can be constructed; failure closes the descriptor and returns the
  existing `observer-client.disconnect` authority.
- `observer-client-controller.swift` binds the pure state machine to the macOS adapters. It verifies
  the connected peer and retained candidate again before sending `HELLO`, accepts no new command
  before matching `COMPLETE`, exposes a bounded READY-only zero-command qualification, and treats
  candidate or endpoint cleanup uncertainty as terminal.
- `observer-client-main.swift` exposes only the no-launch interoperability command and qualification
  modes. It removes the harness bootstrap environment before connecting and emits a fixed sanitized
  result.
- `observer-client-test-support.swift`, `observer-client-codec-tests.swift`,
  `observer-client-security-tests.swift`, and `observer-client-tests.swift` form the focused Swift
  security, codec, lifecycle, path, peer, privacy, deadline, disconnect, and cleanup suite. The
  focused executable also starts one child with default `SIGPIPE` disposition, closes its peer, and
  requires normal child exit with the typed disconnect instead of signal termination.
- `apps/desktop/src-tauri/tests/observer_swift_interop.rs` directly imports the production #119
  Rust protocol and peer-credential sources. Its ignored focused tests are run explicitly with the
  freshly compiled Swift executable. The one-command test compares Swift's raw `HELLO` and
  `COMMAND` bytes with the production Rust encoder and fragments every frame into one-byte writes.
  The qualification test validates the same authenticated READY boundary, then proves controller
  EOF with zero post-READY bytes, zero COMMAND frames, sanitized `commandCount: 0`, and complete
  endpoint cleanup.

The interoperability harness's one `0x11` frame is consumed by the isolated production Rust state
machine and returns a fixed harness receipt. It does not start Tauri, a webview, a packaged app, or
the product operation represented by that opcode.

## No-launch verification

```sh
mkdir -p /private/tmp/issue121-swift-module-cache

xcrun swift-format lint --strict docs/investigations/issue-121/*.swift

xcrun swiftc -module-cache-path /private/tmp/issue121-swift-module-cache \
  -warnings-as-errors -parse-as-library \
  -o /private/tmp/issue121-observer-client-tests \
  docs/investigations/issue-121/observer-client-core.swift \
  docs/investigations/issue-121/observer-client-platform.swift \
  docs/investigations/issue-121/observer-client-ipc.swift \
  docs/investigations/issue-121/observer-client-controller.swift \
  docs/investigations/issue-121/observer-client-test-support.swift \
  docs/investigations/issue-121/observer-client-codec-tests.swift \
  docs/investigations/issue-121/observer-client-security-tests.swift \
  docs/investigations/issue-121/observer-client-tests.swift
/private/tmp/issue121-observer-client-tests

xcrun swiftc -module-cache-path /private/tmp/issue121-swift-module-cache \
  -warnings-as-errors -parse-as-library \
  -o /private/tmp/issue121-observer-client \
  docs/investigations/issue-121/observer-client-core.swift \
  docs/investigations/issue-121/observer-client-platform.swift \
  docs/investigations/issue-121/observer-client-ipc.swift \
  docs/investigations/issue-121/observer-client-controller.swift \
  docs/investigations/issue-121/observer-client-main.swift

ISSUE121_SWIFT_CLIENT=/private/tmp/issue121-observer-client \
  cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml \
    --features observer-command-channel --test observer_swift_interop \
    rust_swift_production_authority_fragmented_round_trip \
    -- --ignored --exact --test-threads=1

ISSUE121_SWIFT_CLIENT=/private/tmp/issue121-observer-client \
  cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml \
    --features observer-command-channel --test observer_swift_interop \
    rust_swift_production_authority_zero_command_qualification \
    -- --ignored --exact --test-threads=1
```

The final command may require a narrow sandbox exception to create the owner-only Unix socket
directly beneath `/private/tmp`. That exception authorizes only this process-local harness; it does
not authorize an app or package launch.

## Limitation and next boundary

This issue proves the five-value `NSWorkspace.OpenConfiguration.environment` and its nonactivating
flags by construction and provides the READY-only zero-command client lifecycle. Issue #123 adds
only the per-socket macOS write hardening and signal-sensitive no-launch regression after issue
#122 exposed the missing descriptor policy. Issue #122 remains immutable, **INVALID/CONSUMED**, and
is not retried or reinterpreted. Environment propagation and a fresh exact packaged-candidate
qualification remain evidence-only work for a separately authorized successor. Issue #104 remains
**UNCONSUMED**.
