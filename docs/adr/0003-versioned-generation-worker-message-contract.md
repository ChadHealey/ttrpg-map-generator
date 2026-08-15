# ADR-0003 — Versioned generation-worker message contract

- **Status:** Accepted
- **Date:** 2026-08-14
- **Decision owners:** Project maintainers
- **Supersedes:** None
- **Superseded by:** None

## Context

Milestone 0 does not need a background worker: its fixed render proof is cheap to
draw synchronously. The project plan nevertheless requires a durable decision for
worker messaging before later regional-generation previews become costly. Workers
must not create an alternate owner for accepted world state or allow result timing
to affect deterministic output.

The architecture requires validation at worker boundaries, explicit cancellation
and progress behavior, stable diagnostics, and document commits controlled by the
desktop application.

## Decision drivers

- Generation remains deterministic regardless of worker scheduling or completion
  order.
- Workers cannot mutate accepted world documents, Svelte state, or UI state.
- A stale result must never overwrite newer user work.
- Protocol evolution and malformed cross-thread data must have explicit handling.

## Options considered

### Option A — Let workers mutate shared application state

Have a worker write generated output into UI stores or persistence records. This
obscures ownership, cannot safely model stale results, and breaks the rule that
generators propose while the document service commits.

### Option B — Define messages ad hoc for each worker

Use one-off payloads and callbacks as workers are added. This is initially small
but creates incompatible validation and cancellation behavior at every boundary.

### Option C — Use versioned, validated request and response envelopes

Make the desktop application send immutable, structured requests. Workers return
only progress, proposals, diagnostics, cancellation acknowledgements, or failures
inside a versioned envelope identified by a request ID and source revision.

## Decision

Adopt Option C. Do not implement a production worker in Milestone 0.

When a generation worker is introduced, every message uses a versioned,
discriminated envelope. Requests include a protocol version, opaque request ID,
operation kind, immutable validated inputs, and the source document or aspect
revision against which work was requested. Responses include the same request ID
and are one of `progress`, `completed`, `failed`, or `cancelled`.

Workers generate proposals and diagnostics only. They do not save files, mutate
the world document, mutate Svelte stores, or invoke rendering APIs. The desktop
orchestration layer validates every inbound and outbound message, discards stale
responses, validates a completed proposal, and performs the sole transactional
commit. Cancellation is advisory: it may stop unnecessary work, but it cannot
change the deterministic result of a request that completes.

## Consequences

### Positive

- Worker timing and cancellation cannot become hidden generation inputs.
- The accepted world document retains one explicit commit authority.
- Progress and failures have stable, inspectable contracts.
- Protocol versions make later message evolution compatible and reviewable.

### Negative

- Inputs and proposals must be serializable, cloned, and validated at the boundary.
- The desktop layer must retain enough request metadata to identify stale results.

### Neutral or follow-up

- The exact schema library and message fields are deferred until the first worker
  implementation; they must satisfy this envelope contract and the project’s
  boundary-validation requirement.
- Milestone 6 is the first planned production use for cancellable worker previews.
- Worker messages are an adapter contract, not a public plugin protocol.

## Compatibility and migration

- **Accepted world documents:** None. No worker or world document exists in
  Milestone 0.
- **Persisted schemas and migrations:** None. Worker messages are transient and
  are not saved as authoritative project data.
- **Generator, seed, parameter, context, or style versions:** Future requests
  carry the relevant declared versions; this ADR introduces none.
- **Canonical semantic/SVG/visual fixtures:** None change. A worker must produce
  the same canonical proposal as its equivalent synchronous generator path.
- **macOS and Linux determinism:** Scheduling, progress timing, and cancellation
  must not affect completed canonical output on either platform.
- **Parent and child maps:** None. Future cross-map generation requests must use
  persisted inherited-context snapshots rather than parent-generator internals.

## Validation

The first worker implementation must add schema-validation tests for every message
variant, deterministic tests under differing completion order, cancellation and
progress tests, stale-result rejection tests, and an integration test that proves
only the desktop transaction commits a completed proposal. It must also run the
fixed-seed fixtures on macOS and Linux.

## Revisit conditions

Revisit when the first worker exposes a missing message variant, when structured
clone or payload-size measurements require transferables or chunking, or when a
new execution environment requires a different but equivalent adapter.
