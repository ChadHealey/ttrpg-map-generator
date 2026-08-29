# ADR-0020 — Process-bound observer command channel

- **Status:** Accepted
- **Date:** 2026-08-25
- **Decision owners:** Project maintainer
- **Supersedes:** None
- **Superseded by:** None
- **Amended by:** [ADR-0021](0021-defer-packaged-performance-evidence-to-milestone-9.md)

## Context

Milestone 2's packaged observer actions are installed by `App.svelte` as browser-window `keydown`
listeners. They delegate to the canonical fixture, state, cancellation, reopen, and export
authorities in the packaged dispatch modules, but require focus and synthesized keyboard input.
Issues #109–#117 established that focus cannot be qualified reliably enough for the blocked #104
replacement row. Issue #118 authorizes a design and isolated prototype, not production wiring or a
target run.

The replacement must be absent from ordinary builds, bind one external controller to the exact
launched candidate and session, remain independent of focus, and preserve the existing TypeScript
operation authorities. Endpoint, token, process, and local path values are private runtime data and
must not enter committed evidence.

## Decision drivers

- Compile-time absence from ordinary packages, followed by fail-closed runtime activation.
- Exact controller, candidate, and session binding against local untrusted processes.
- Bounded framing, ordering, acknowledgement, timeout, replay, and cleanup behavior.
- No new production dependency and no new product operation semantics.
- macOS qualification without breaking ordinary or all-feature Linux compilation.

## Options considered

### Private Unix-domain stream socket

A pathname socket supports a controller launched through the existing macOS package/session path,
owner-only filesystem permissions, byte-stream framing, and macOS peer-PID credentials. Once the
one authenticated connection is established, the pathname can be unlinked and the connected stream
remains process-bound.

### Loopback TCP

Loopback removes window focus but exposes an ambient port namespace, has weaker local peer-process
identity, and adds port selection and firewall/network-policy failure modes. A token alone does not
provide the selected exact-process binding.

### Filesystem mailbox or FIFO pair

A mailbox needs polling plus atomic claim, acknowledgement, stale-file, replay, and cleanup rules;
it has no connected peer identity. FIFOs add blocking/open-order and bidirectional-pair complexity
without solving exact peer authentication.

### Inherited unnamed socket pair

An inherited pair has the best namespace isolation, but `NSWorkspace` package launch does not give
the existing controller a reliable inherited-file-descriptor contract. Direct executable launch
would replace the package/session launch boundary that prior evidence validates.

XPC was also rejected: it adds Apple-specific service, signing, entitlement, and code-generation
surface without a demonstrated capability unavailable from a project-owned socket.

## Decision

Select one private pathname Unix-domain `SOCK_STREAM` socket for each observer candidate. The
implementation is observer-only instrumentation and is not a product API, plugin system, or
headless CLI.

### Build and activation gates

The Rust server, its Tauri event/command bridge, and macOS peer-credential adapter exist only behind
the Cargo feature `observer-command-channel`. The frontend bridge is included only when the
observer build sets the paired compile-time constant `VITE_OBSERVER_COMMAND_CHANNEL=1`. The
observer packaging command must set both gates and fail on mismatch. Ordinary builds set neither;
checks must prove their Rust binary and frontend assets contain no protocol magic, bootstrap
variable names, event names, command names, or listener code. A runtime flag alone is insufficient.

An observer-feature build still fails closed unless all five private bootstrap values are supplied
through `NSWorkspace.OpenConfiguration.environment`: `TTRPG_OBSERVER_SOCKET_PATH` (absolute socket
path), `TTRPG_OBSERVER_SESSION` (128-bit session ID), `TTRPG_OBSERVER_CAPABILITY` (256-bit
capability), `TTRPG_OBSERVER_CONTROLLER_PID` (expected controller PID), and
`TTRPG_OBSERVER_CANDIDATE_SHA256` (expected candidate executable digest). The values are strict
lowercase hexadecimal or decimal as appropriate. The candidate reads and validates them before
starting Tauri threads, removes them from its environment, and never logs or emits them.

The controller creates a unique directory directly beneath `/private/tmp`, verifies it is a real
owner-controlled directory with mode `0700`, and supplies a socket basename that keeps the complete
UTF-8 path within macOS `sun_path`. Collision, symlink, wrong owner/kind/mode, or path replacement is
terminal. The candidate binds with owner-only creation policy, verifies a socket with mode `0600`,
and accepts for at most five seconds.

Both peers verify effective UID and macOS `LOCAL_PEERPID` on the connected descriptor before the
capability is sent: the candidate requires the declared controller PID, while the controller
requires the exact newly launched candidate PID and revalidates its bundle, executable path, and
SHA-256. The candidate also hashes its current executable and matches the bootstrapped digest. The
candidate then authenticates the session/capability frame with a constant-time comparison. After
success it unlinks the socket pathname; no second connection or reconnect is allowed.

Owner-only permissions prevent other users from reaching the endpoint. Peer PIDs prevent a
same-user process that discovers or replaces the path from impersonating either endpoint; the
capability binds the connection to this launch. A same-user process with debugger, code-injection,
or task-memory authority is equivalent to compromise of the user session and remains outside this
test-instrumentation boundary. Denial of service remains possible and always invalidates the run.

### Wire protocol

Every frame is a four-byte unsigned big-endian payload length followed by this payload:

|     Bytes | Field                                                                          |
| --------: | ------------------------------------------------------------------------------ |
|         4 | ASCII magic `TMOC`                                                             |
|         2 | unsigned big-endian protocol version, exactly `1`                              |
|         1 | kind: `HELLO=1`, `READY=2`, `COMMAND=3`, `STARTED=4`, `COMPLETE=5`, `REJECT=6` |
|         1 | flags, exactly zero                                                            |
|        16 | raw session ID                                                                 |
|         8 | unsigned big-endian sequence                                                   |
| remaining | kind-specific body                                                             |

Payload length must be `32..=65_536`. Reads use `read_exact`; invalid length, EOF, unknown
version/kind/flags, malformed UTF-8, trailing fields, or invalid payload closes the session. Error
replies never echo a capability, endpoint, PID, path, or malformed bytes.

`HELLO` has sequence zero and exactly the 32-byte capability body. `READY` has sequence zero and an
empty body. `COMMAND` starts at sequence one and increases by exactly one. Its first body byte is
one allowlisted opcode:

|       Opcode | Operation                              | Remaining body                                               |
| -----------: | -------------------------------------- | ------------------------------------------------------------ |
|       `0x10` | configure canonical fixture            | one fixture code for the existing three IDs                  |
|       `0x11` | production coarse preview              | empty                                                        |
|       `0x12` | production full generation             | empty                                                        |
| `0x13..0x15` | preview cancellation early/middle/late | empty                                                        |
| `0x16..0x18` | full cancellation early/middle/late    | empty                                                        |
|       `0x19` | deterministic cancellation aftermath   | empty                                                        |
|       `0x1a` | prepare save/reopen                    | absolute UTF-8 `.mapworld` path, at most 1,024 bytes, no NUL |
|       `0x1b` | SVG export                             | empty                                                        |
|       `0x1c` | PNG export                             | empty                                                        |

There is no general method name, arbitrary JSON request, file read/write primitive, shell command,
or user-supplied fixture/control payload. The prepare path remains private and is validated again by
the existing save/export authorities.

`STARTED` has the command sequence and an empty body. `COMPLETE` has the same sequence and body
`status:u16`, `receiptLength:u32`, and exactly that many UTF-8 receipt bytes. Status is `0=ok`,
`1=authority-rejected`, `2=operation-failed`, `3=timeout`, or `4=session-aborted`; the receipt must
be the existing validated observer receipt or a stable diagnostic code. `REJECT` uses sequence zero
before authentication or the offending sequence afterward, with one unsigned 16-bit reason:
`1=unauthorized`, `2=malformed`, `3=version`, `4=sequence`, `5=busy`, `6=unsupported`, `7=timeout`,
or `8=lifecycle`. A reject is terminal.

Only one command may be in flight. A duplicate/replayed sequence, a gap, a command while busy, a
completion for the wrong sequence, or any frame from the wrong session is rejected and closes the
channel. The controller may not send the next command until matching `COMPLETE`.

### Rust and Svelte lifecycle

The feature-gated Rust server validates bootstrap state and listens during Tauri setup. It accepts
and authenticates one controller, then waits up to 30 seconds for the feature-gated Svelte bridge.
`App.svelte` registers one Tauri event listener on mount and invokes an internal `frontend_ready`
command; Rust sends `READY` only after that handshake. Neither step depends on window focus.

For a command, Rust validates framing/state and emits one typed, feature-gated event. Svelte
strictly switches the opcode, validates its body, invokes an internal `command_started` before the
operation, and delegates to the existing `gatedAtlasFixture`, `requestExactFixturePreview`,
generation-cancellation, aftermath, reopen, and export functions. Those functions remain the only
fixture/state/action authority. No validator is reimplemented in Rust or Swift. Svelte returns the
existing receipt or stable rejection through `command_completed`; only then does Rust send
`COMPLETE` and advance sequence.

The `STARTED` deadline is two seconds. A terminal completion has a 120-second safety deadline; this
does not replace or relax any operation, cancellation-acknowledgement, measurement, or release
budget. Authentication/listen has a five-second deadline and frontend readiness has a 30-second
deadline. Timeout, controller disconnect, webview teardown, duplicate listener, candidate exit, or
bridge error closes the session, unlinks any endpoint, drops queued data, and emits no success.
Existing production cancellation is requested on abort only when the in-flight operation already
supports it; otherwise the controller terminates the invalid candidate. No observer command is
retried automatically.

### Platform boundary and dependency decision

The runtime implementation is macOS-only under
`cfg(all(feature = "observer-command-channel", target_os = "macos"))`. The isolated peer-credential
FFI must be documented and tested. With the feature enabled on other targets, a no-listener stub
compiles and returns `observer.unsupported-platform`; Linux `--all-features` format, clippy, and test
lanes must pass. Ordinary packages on every platform omit the feature and the entire surface.

The design uses Rust standard-library Unix sockets, a small project-owned binary codec, existing
project SHA-256 code, Tauri's existing event/command facilities, and macOS system calls. It adds no
crate, npm package, service, entitlement, or capability dependency. **No dependency review is
required.** Adding a dependency later requires the normal review and reopens this decision's
no-dependency consequence.

### Threat review

| Threat                                              | Required result                                                                                                                                                                   |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local untrusted process                             | Other UIDs are excluded by `0700`/`0600`; same-UID impersonation is rejected by mutual peer PID, exact executable checks, and capability. Same-UID denial of service invalidates. |
| Symlink or path replacement                         | Strict owner/kind/mode checks and no collision removal precede bind/connect; connected peer PID and executable revalidation reject a substituted endpoint.                        |
| Stale endpoint, token, or session                   | Unique per-launch values, collision failure, exact `HELLO`, one connection, immediate post-auth unlink, and no reconnect reject reuse.                                            |
| Wrong candidate or controller                       | Both sides require the declared peer PID; the controller revalidates bundle/path/hash and the candidate validates its own hash.                                                   |
| Malformed, oversized, or truncated frame            | Fixed header, `32..=65_536` bound, exact reads, strict body validation, and terminal rejection prevent unbounded allocation or partial interpretation.                            |
| Disconnect, teardown, or timeout                    | Session closes, success is withheld, endpoint state is removed, and the invalid candidate is terminated without retry.                                                            |
| Duplicate, replayed, concurrent, or skipped command | Exact monotonic sequence and one in-flight state reject and close the channel.                                                                                                    |
| Ordinary build activation                           | Paired Cargo/Vite compile-time gates plus artifact scans prove the server and frontend bridge are absent rather than disabled.                                                    |

**Threat result:** PASS for bounded observer-build implementation, subject to the negative-path,
artifact-absence, and exact-candidate qualification required from the ordered children. This result
does not treat a compromised user session as a secure execution environment.

## Consequences

### Positive

- Commands reach the existing production actions without focus or synthesized input.
- Build absence, mutual process identity, a launch capability, strict framing, and one-shot cleanup
  form independent fail-closed layers.
- The socket codec and lifecycle can be tested without launching Tauri or the product.

### Negative

- The qualification implementation is macOS-specific and needs a narrow reviewed unsafe FFI
  adapter for peer PID credentials.
- The controller must retain private bootstrap state and exact candidate identity for the session.
- A hostile same-user process can still deny service, which invalidates rather than retries a run.

### Neutral or follow-up

- Existing keyboard observers remain unchanged until ordered implementation children replace their
  qualification use; they are not removed by this decision.
- #104 remains **UNCONSUMED**. Under ADR-0021, it and any successor packaged measurement belong to
  Milestone 9 and do not block Milestone 2. This ADR authorizes neither a package build nor a target
  operation.
- The process-bound channel is retained for release hardening, but the controller must prove typed
  component cleanup, kernel-truth termination, operation-error precedence, and the frozen-handle
  regression before another live qualification is authorized.

## Compatibility and migration

There is no world-document, persistence, generator, seed, parameter, context, style, semantic,
SVG, PNG, or fixture change. Accepted user work and prior evidence remain byte-identical. Ordinary
macOS and Linux builds retain current behavior; the observer feature is a non-product test surface.

## Validation

The isolated standard-library prototype at
`docs/investigations/issue-118/observer-channel-prototype.rs` proves Unix-stream fragmentation,
bounded framing, capability/session authentication, the allowlist, exact sequence, one in-flight
command, acknowledgement, replay rejection, and malformed/oversized/truncated fail-closed paths.
Production children must add build-absence scans, macOS peer-credential/path-race tests, Rust/Svelte
lifecycle tests, Swift-client interoperability, and a separate exact-candidate zero-operation
qualification before #104 can resume during Milestone 9. The controller-repair regressions required
by ADR-0021 precede that qualification.

## Revisit conditions

Revisit if `NSWorkspace` can safely supply an inherited descriptor, macOS removes required peer-PID
credentials, the ordinary-build absence scan fails, a same-user command-injection path survives
mutual PID/capability checks, or implementation requires a dependency, entitlement, service, or
general product IPC surface.
