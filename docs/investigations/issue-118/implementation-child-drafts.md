# Issue 118 ordered implementation-child drafts

These are drafts only. Create them in order after #118 integrates; replace `Child N` references
with live issue links. Each child has one independently verifiable outcome and context-fit **PASS**.
No child authorizes #104 product activity until Child 4 is valid.

## Child 1 — Implement the feature-gated native observer transport

### Outcome

Implement ADR-0020's observer-build-only Rust Unix-domain socket server, codec, authenticated
single-session state machine, and internal Tauri bridge surface, while proving ordinary builds have
no observer command channel.

### Background and evidence

ADR-0020 selects the transport and protocol. `apps/desktop/src-tauri/src/lib.rs`, `Cargo.toml`, and
`capabilities/default.json` currently expose only ordinary webview commands and no observer feature.
The issue #118 prototype proves the codec/state-machine shape without Tauri.

### In scope

- Add the exact Cargo feature and macOS-only server/peer-credential adapter from ADR-0020.
- Add strict bootstrap, path, permissions, frame, authentication, timeout, replay, and cleanup
  validation with stable errors.
- Add feature-gated internal Tauri events/commands needed by the later frontend bridge.
- Add a non-listening unsupported-platform implementation so Linux `--all-features` compiles.
- Add ordinary-build binary/symbol/source-surface absence tests.

### Out of scope

- `App.svelte` or packaged dispatch changes; Swift client/controller work; package launch or target
  qualification; fixture, generation, cancellation, reopen, export, or #104 activity.
- New dependency, entitlement, plugin, general IPC, product command, or headless CLI.

### Acceptance criteria

- [ ] Ordinary builds compile without the server, bootstrap variables, protocol magic, event/command
      names, and listener symbols; a runtime flag cannot activate them.
- [ ] Observer-feature activation requires every private bootstrap value and exact self identity.
- [ ] Owner-only path/socket policy, mutual UID/PID checks, capability authentication, exact
      framing/allowlist/sequence, one in-flight command, deadlines, and terminal cleanup match
      ADR-0020.
- [ ] Wrong peer, wrong token/session/candidate, collision/symlink/replacement, malformed/oversized
      frame, disconnect, timeout, duplicate, replay, and sequence gap fail closed in focused tests.
- [ ] No success receipt includes endpoint, capability, PID, executable/local path, or malformed
      input bytes.
- [ ] macOS feature tests pass and Linux ordinary plus `--all-features` compilation passes.
- [ ] No dependency is added; prior evidence and protected observer sources are unchanged.

### Start here

1. `docs/adr/0020-process-bound-observer-command-channel.md` — exact contract.
2. `docs/investigations/issue-118/observer-channel-prototype.rs` — isolated proof.
3. `apps/desktop/src-tauri/src/lib.rs`, `Cargo.toml`, and `capabilities/default.json` — native surface.
4. `apps/desktop/src-tauri/src/mapworld_native/platform_ffi.rs` — existing unsafe-adapter pattern.

### Implementation constraints

- Keep unsafe macOS calls in one documented adapter; use standard library/Tauri facilities only.
- Never log private bootstrap values. Keep the server observer-only and one-shot.
- Do not duplicate fixture or workflow authority in Rust.

### Verification

- Focused: Rust codec, authentication, peer/path, lifecycle, timeout, and negative-path tests.
- Broader: Rust fmt/clippy/test with ordinary and all features on macOS; Linux cross-compile/CI lane;
  ordinary-build absence, privacy, authorized-surface, protected-evidence, and diff gates.

### Dependencies

- #118 and ADR-0020 integrated.

### Risks and unknowns

- macOS `LOCAL_PEERPID` FFI and Tauri setup/teardown are security and concurrency boundaries. Stop
  if they require a dependency, entitlement, or changed protocol.

### Readiness

- State: READY
- Execution kind: Implementation
- Rationale: One native transport outcome with a fixed protocol and isolated tests.
- Code changes: Authorized only for the native observer feature, tests, and owning docs.
- Recommended labels: existing `bug`; add `codex-ready`/`complexity:C4` only if they exist.

### Codex execution profile

- Complexity: C4 — Complex
- Complexity score: 1 breadth + 1 uncertainty + 2 state-risk + 2 verification + 1 dependency = 7/10
- Complexity rationale: Narrow native surface, but authentication, unsafe peer credentials,
  concurrency, compile-time absence, and cross-platform verification are high impact.
- Critical risk flags: authentication/authorization; local IPC; unsafe FFI; concurrency; privacy
- Execution class: Frontier
- Current recommendation: `gpt-5.6-sol` / high
- Recommendation date: 2026-08-25
- Context fit: PASS — one Rust/Tauri subsystem, fixed ADR, focused negative paths, one final gate.
- Expected reading: Medium
- Change surface: Tauri Rust feature/server/adapter/tests plus minimal build documentation.
- Verification surface: focused Rust security/state tests, cross-platform compile, absence/privacy.
- Split or escalation trigger: dependency, entitlement, protocol change, or frontend implementation.

## Child 2 — Bind observer commands to existing frontend authorities

### Outcome

Implement the feature-gated Rust-to-Svelte lifecycle and bind every ADR-0020 opcode to the existing
canonical fixture/state/action validators without changing product behavior.

### Background and evidence

`App.svelte` currently installs three focus-dependent dispatch listeners. The packaged atlas and
export modules already own canonical fixture, cancellation, reopen, and export authority. Child 1
provides the authenticated native transport and internal lifecycle only.

### In scope

- Add the compile-time observer frontend bridge, mount/unmount lifecycle, strict opcode/body switch,
  `frontend_ready`, `command_started`, and `command_completed` calls.
- Reuse the existing fixture, preview/full, cancellation/aftermath, reopen, and export functions.
- Accept the private save path only for prepare-reopen and pass it through existing path/state
  validation.
- Add focused lifecycle, authority-rejection, single-completion, teardown, and ordinary-bundle
  absence tests.

### Out of scope

- Rust transport changes beyond defects against ADR-0020; Swift client/controller; packaged target
  launch; observer/focus executables; operation semantics, fixtures, budgets, persistence, render,
  export format, or #104 activity.

### Acceptance criteria

- [ ] `READY` is impossible before one mounted frontend listener has registered.
- [ ] Each opcode calls only the existing operation authority and returns its validated receipt or a
      stable rejection; Rust/Svelte/Swift contain no duplicate fixture or workflow validator.
- [ ] Focus, key events, Accessibility writes, synthesized input, and visible UI interaction are not
      required.
- [ ] One command produces exactly one `STARTED` and one terminal completion; stale/unmounted/wrong
      session/sequence completions fail closed.
- [ ] Disconnect or teardown cleans the bridge and uses existing cancellation only where already
      supported.
- [ ] Ordinary frontend output excludes the bridge/protocol surface; observer and ordinary TypeScript
      checks pass.
- [ ] Existing packaged-dispatch tests and all protected evidence remain unchanged and passing.

### Start here

1. ADR-0020 — lifecycle and allowlist.
2. Child 1 native bridge contract and tests.
3. `apps/desktop/src/App.svelte` — current action delegation.
4. `packaged-atlas-observer-dispatch.ts` and `packaged-export-observer-dispatch.ts` — authorities.

### Implementation constraints

- Compile-time gating must remove the frontend bridge from ordinary bundles.
- Preserve current receipt schemas and operation time/budget meaning.
- Keep the bridge as orchestration; do not move product rules into Svelte or Rust.

### Verification

- Focused: frontend bridge unit/component tests and Rust/Svelte lifecycle integration harness.
- Broader: packaged dispatch suites, type/lint/format/root checks, ordinary-bundle absence, privacy,
  authorized-surface, protected-evidence, and diff gates. No app launch.

### Dependencies

- Child 1 integrated.

### Risks and unknowns

- Async completion and teardown can produce duplicate or stale acknowledgements. Any need to change
  operation semantics or receipt schemas stops and re-scopes the issue.

### Readiness

- State: READY
- Execution kind: Implementation
- Rationale: One fixed native/frontend lifecycle and one existing-authority binding surface.
- Code changes: Authorized for the observer frontend bridge, wiring, tests, and owning docs.
- Recommended labels: existing `bug`; add `codex-ready`/`complexity:C4` only if they exist.

### Codex execution profile

- Complexity: C4 — Complex
- Complexity score: 2 breadth + 1 uncertainty + 2 state-risk + 1 verification + 1 dependency = 7/10
- Complexity rationale: The protocol is fixed, but asynchronous Rust/Svelte lifecycle and preserved
  product authority cross two major boundaries.
- Critical risk flags: authentication/authorization; concurrency; ordinary-build absence
- Execution class: Frontier
- Current recommendation: `gpt-5.6-sol` / high
- Recommendation date: 2026-08-25
- Context fit: PASS — exactly two boundaries, fixed opcodes, focused harness, no target operation.
- Expected reading: Medium
- Change surface: feature-gated frontend bridge, `App.svelte`, dispatch adapters, focused tests.
- Verification surface: lifecycle/authority tests, ordinary-bundle scan, root/static gates.
- Split or escalation trigger: schema/operation change, third major boundary, or target launch.

## Child 3 — Implement the exact-session Swift observer client

### Outcome

Implement a standalone Swift client/controller component that provisions ADR-0020 bootstrap state,
launches the exact observer candidate, mutually authenticates the socket, and drives the fixed
command protocol against no-app-launch interoperability harnesses.

### Background and evidence

The issue #100/#116 controller already validates the exact package, executable digest, active GUI
session, and one fresh candidate. The protected issue #90/#94/#96/#97/#98 observers must remain
unchanged. Children 1–2 provide the server and operation bridge.

### In scope

- Create the private `0700` endpoint directory, unpredictable session/capability, and strict
  `NSWorkspace.OpenConfiguration.environment` bootstrap.
- Retain exact package/session checks and add controller-side peer PID/executable revalidation.
- Implement the binary codec, exact sequence, single-in-flight, ack deadlines, private receipt
  handling, and terminal cleanup.
- Add Swift negative-path tests plus interoperability with the isolated Rust server harness, without
  launching Tauri or the packaged app.

### Out of scope

- Product/App/Svelte/Rust implementation; modifying protected observer executables; GUI, focus,
  keyboard, Accessibility action, package build/launch, product command, sampler, measurement, or
  #104 activity.

### Acceptance criteria

- [ ] Bootstrap values are unpredictable, supplied only to the exact launch environment, retained
      privately, and absent from public output.
- [ ] Controller validates socket peer PID, exact candidate bundle/path/digest, frame/session,
      sequence, acknowledgement, deadline, and cleanup before trusting a reply.
- [ ] Wrong/replaced candidate, socket/path replacement, stale endpoint/token, wrong version,
      malformed/oversized/truncated frame, replay, busy, disconnect, timeout, and cleanup failure
      invalidate without retry.
- [ ] Rust/Swift golden vectors and fragmented-stream interoperability match ADR-0020 byte-for-byte.
- [ ] No existing protected observer/controller evidence is rewritten.
- [ ] No dependency is added and public receipts contain no private runtime values.

### Start here

1. ADR-0020 and the issue #118 prototype — protocol.
2. Child 1 codec/server tests — interoperability authority.
3. `docs/investigations/issue-100/target-session-readiness-controller.swift` and platform support —
   exact launch identity.
4. `docs/investigations/issue-117/README.md` — terminal focus-path boundary to replace.

### Implementation constraints

- Reuse exact candidate/session validation; delete no colliding path and follow no symlink.
- Keep paths, tokens, PIDs, and local diagnostics out of committed evidence.
- The client is observer qualification tooling, not a product or general automation API.

### Verification

- Focused: Swift codec/security/lifecycle suite and Swift↔Rust no-launch interoperability harness.
- Broader: Swift format/warnings-as-errors, Rust focused tests, privacy, authorized-surface,
  protected-evidence, formatting, and diff gates.

### Dependencies

- Children 1 and 2 integrated.

### Risks and unknowns

- `NSWorkspace` environment propagation and mutual peer PID timing must be validated without a
  target run. A package launch or protocol change requires a separate issue.

### Readiness

- State: READY
- Execution kind: Implementation
- Rationale: One fixed Swift client/controller outcome against an existing no-launch harness.
- Code changes: Authorized for new client/controller tooling, tests, and owning docs.
- Recommended labels: existing `bug`; add `codex-ready`/`complexity:C4` only if they exist.

### Codex execution profile

- Complexity: C4 — Complex
- Complexity score: 1 breadth + 1 uncertainty + 2 state-risk + 2 verification + 1 dependency = 7/10
- Complexity rationale: Bounded Swift tooling with security-critical identity and cross-language
  interoperability verification.
- Critical risk flags: authentication/authorization; secrets; local IPC; privacy; interoperability
- Execution class: Frontier
- Current recommendation: `gpt-5.6-sol` / high
- Recommendation date: 2026-08-25
- Context fit: PASS — one client subsystem and one harness boundary; no package or product run.
- Expected reading: Medium
- Change surface: new Swift client/controller support and no-launch tests/evidence.
- Verification surface: Swift negatives, Rust interoperability, privacy/protected evidence.
- Split or escalation trigger: package launch, protected observer edit, dependency, or protocol drift.

## Child 4 — Qualify one zero-operation exact-candidate channel session

### Outcome

Build one observer-enabled candidate and qualify exactly one fresh macOS session through mutual
socket authentication and frontend `READY`, with zero product commands, then leave #104
**UNCONSUMED** for a separately authorized resume.

### Background and evidence

Issues #109–#117 exhausted focus-dependent readiness and ended at `44511f7`. Children 1–3 replace
that prerequisite with ADR-0020's process-bound channel. #104 remains the authority for the target
cancellation row and is not part of this qualification.

### In scope

- Run all predecessor, focused, ordinary-build-absence, package, identity, privacy, surface, and
  protected-evidence gates before target use.
- Build exactly one observer-enabled unsigned candidate using the paired compile-time gates.
- Launch exactly one fresh exact candidate, authenticate one exact controller/session, receive
  frontend `READY`, send no `COMMAND`, terminate, and prove endpoint/process cleanup.
- Record one sanitized valid/invalid receipt and minimal owning evidence. No retry.

### Out of scope

- Fixture configuration, preview/full generation, cancellation, aftermath, reopen, export, sampler,
  artifact/destination, measurement, issue #95, issue #104, GUI, focus, Computer Use, Accessibility
  action, synthesized input, or keyboard dispatch.
- Code correction after the target attempt; any defect requires a new child.

### Acceptance criteria

- [ ] All pre-target gates pass from a clean committed implementation base and reproduce exact tool
      and candidate identities.
- [ ] Ordinary candidate artifacts contain no observer channel surface; observer candidate contains
      only the approved feature surface.
- [ ] Exactly one fresh candidate/controller session mutually validates peer PID, executable,
      session, and capability, then reaches frontend `READY` without focus.
- [ ] No `COMMAND` frame or product operation occurs; #104 remains **UNCONSUMED**.
- [ ] Disconnect/termination leaves zero candidate processes and no endpoint, directory, token, or
      publication temporary. Cleanup failure invalidates.
- [ ] Public evidence contains no path, token, PID, user identity, local diagnostic, or private
      receipt and preserves all prior evidence exactly.
- [ ] Valid evidence updates #98/#104/M2 direction so #104 can be separately resumed through the
      new client. Invalid evidence stops without retry or reinterpretation.

### Start here

1. ADR-0020 and Children 1–3 evidence — selected mechanism and identities.
2. Live #104 — unconsumed target authority.
3. `docs/investigations/issue-117/README.md` — immutable predecessor stop.
4. `docs/milestone-2-atlas-proof.md` and `milestone-2-release-evidence.md` — owning evidence.

### Implementation constraints

- One candidate, one session, zero commands, no retry.
- Stop before target use on any drift, collision, privacy issue, or cleanup uncertainty.
- Commit implementation/evidence boundaries as required by the live qualification issue before use.

### Verification

- Focused/predecessor: all Child 1–3 suites and protected Swift observer suites.
- Broader: ordinary and observer feature builds, exact identity reproduction, root/static gates,
  privacy, authorized-surface, fixture/production-surface, protected-evidence, and diff checks.
- Hardware: one zero-operation exact-candidate handshake on the named Milestone 2 Mac.

### Dependencies

- Children 1–3 integrated; fresh explicit owner authority for one target launch.

### Risks and unknowns

- Hardware/session/environment propagation is the remaining bounded uncertainty. Any failure is a
  consumed qualification attempt and does not authorize #104.

### Readiness

- State: READY
- Execution kind: Target-host qualification
- Rationale: One zero-operation one-shot with fixed predicates and no conditional product work.
- Code changes: Evidence-only after the implementation base; no correction authorized post-attempt.
- Recommended labels: existing `bug`; add `codex-ready`/`complexity:C4` only if they exist.

### Codex execution profile

- Complexity: C4 — Complex
- Complexity score: 1 breadth + 1 uncertainty + 2 state-risk + 2 verification + 2 dependencies = 8/10
- Complexity rationale: Narrow outcome, but exact hardware evidence, secrets, immutable state, and
  multiple integrated predecessors demand frontier review.
- Critical risk flags: authentication/authorization; hardware/session; immutable evidence; privacy
- Execution class: Frontier
- Current recommendation: `gpt-5.6-sol` / high
- Recommendation date: 2026-08-25
- Context fit: PASS — one zero-operation session, no correction loop, one final validation pass.
- Expected reading: Medium
- Change surface: qualification tooling invocation and minimal sanitized evidence only.
- Verification surface: predecessor/package/privacy gates plus one named-host handshake.
- Split or escalation trigger: product command, retry, implementation correction, or changed protocol.
