# ADR-0018 — Compact full-profile atlas memory

- **Status:** Accepted
- **Date:** 2026-08-18
- **Decision owners:** Project maintainers
- **Supersedes:** None
- **Superseded by:** None

## Context

Milestone 2 must complete the packaged full-generation workflow on the designated Apple M5 Mac
within 10 seconds and at no more than 768 MiB additional aggregate process-tree RSS. Issue
[#76](https://github.com/ChadHealey/ttrpg-map-generator/issues/76) measured the exact clean
candidate `60285e2385a9ee50ff9c2a1997d25f68e20a1c73` with the same settled-baseline,
maximum-sampled-delta accounting required by the release protocol. Full acceptance completed in
8.248 seconds but reached 1,694.8 MiB additional RSS, 926.8 MiB over the limit. WebContent alone
peaked at 1,854.1 MiB.

The [investigation](../milestone-2-javascriptcore-rss-investigation.md) attributed the clean result
with a temporary production-scheduling marker build. Aggregate additional RSS was 950.7 MiB after
field and partition generation, 1,498.9 MiB after semantic classification, 1,756.5 MiB after
coastline generation, and 1,763.9 MiB when the accepted scene was presented. At quiescence,
WebKit malloc still held about 829.2 MiB of allocator payload. Clearing the accepted document,
geography, appearance, scene, and preview references did not materially lower RSS within the
observed fifteen seconds.

The accepted full profile currently exposes 2,095,106 macro-elevation values as a frozen JavaScript
array and the same number of `land` or `water` strings as another frozen JavaScript array. Several
generation and validation phases also materialize full-profile arrays. The numeric elevation range
fits exactly in a signed 32-bit element, and a two-state classification fits in one bit. Their
project-owned packed payloads therefore require 7.99 MiB and 0.25 MiB respectively, before small
metadata. Other existing full-profile labels and queues already use bounded integer buffers. The
measured gap between those bounded payloads and the WebKit transitions makes JavaScript element,
freeze, copy, and retained-allocation overhead the dominant actionable boundary.

Accepted `WorldDocument` state remains authoritative and immutable. Generators continue to return
proposals, and desktop orchestration remains the sole transactional commit authority. The released
`.mapworld` v1 schema, canonical JSON, accepted semantic values, stable identities, and fixture
hashes must not change merely to alter the live representation.

## Decision drivers

- Reduce the same maximum additional process-tree RSS measured by the Milestone 2 release protocol,
  rather than only lowering post-operation or on-disk size.
- Preserve deterministic values, canonical traversal, accepted-state ownership, and generator-free
  reopen.
- Avoid a persisted-format migration when persistence is absent from the failing generation path.
- Keep the change behind project-owned public package entry points and avoid a new runtime
  dependency.
- Retain at least 128 MiB of measured headroom below the 768 MiB limit before the complete five-run
  release proof.

## Options considered

### Option A — Bounded-lifetime worker or process only

A worker could isolate generation allocations and provide a hard logical lifetime. It does not,
however, remove those allocations from the release measurement: the protocol includes the complete
application process tree and records the maximum delta before the accepted atlas is first painted.
A Web Worker also has no measured guarantee of returning JavaScriptCore pages to the operating
system when terminated. Structured cloning the current arrays could temporarily duplicate them.

A separate sidecar process would still be part of the application process tree and would introduce
a packaged production runtime or headless-generation boundary that the current project plan
explicitly defers. Moving generation to Rust or WASM lacks the representative compatibility and
profiling case required by the architecture.

This option is rejected because it does not directly remove the measured peak and introduces a new
transport, cancellation, stale-result, and packaging boundary.

### Option B — Compact in-memory full-profile representation

Use project-owned immutable packed sample contracts from generator output through accepted state.
Macro elevation uses signed 32-bit storage. Land/water classification uses a deterministic packed
two-state representation. Full-profile algorithms use bounded numeric buffers and indexed readers;
they do not materialize full-profile JavaScript number, string, or object arrays. The wrappers do
not expose mutable typed arrays or their backing buffers.

Persistence converts between these domain readers and the existing strict v1 DTO arrays at its
adapter boundary. Canonical JSON values and bytes remain unchanged, and decode constructs compact
accepted values without invoking a generator. No raw platform-endian buffer becomes authoritative.

This option directly attacks both the field/partition transition and the representation retained
through later semantic, coastline, validation, commit, and scene phases. A bounded implementation
inventory must keep all simultaneously live full-profile packed buffers below 128 MiB. Combined
with the measured settled application baseline of about 212 MiB and the small accepted semantic,
coastline, appearance, and scene records, that leaves a credible path to the 640 MiB pre-proof
target and at least 128 MiB of release-limit headroom.

### Option C — Compact persisted representation

Move large numeric fields into a new binary chunk or change the `.mapworld` accepted-output schema.
This may reduce file size or decode overhead, but persistence is not executed during the measured
full-generation peak. Eagerly reconstructing the current JavaScript arrays would reproduce the live
cost. A format change would also require new schema identifiers, migration fixtures, unsupported-
version behavior, rollback policy, and compatibility evidence without addressing the measured
operation directly.

This option is rejected for Milestone 2. It can be reconsidered only from measured save, reopen, or
package-size evidence.

### Option D — Worker plus compact representation

This combines Option B with Option A. Compaction would still provide the peak reduction, while the
worker would add validated envelopes, transfer rules, cancellation acknowledgement, stale-result
rejection, and a second scheduling boundary. Issue #76 did not measure an incremental peak-RSS
benefit from that boundary, and the current cooperative generator already satisfies the ownership
model without it.

This option is rejected as speculative breadth. If the compact implementation passes its bounded-
buffer requirements but a clean packaged run remains above 640 MiB, reopen this ADR with a measured
worker-termination and transfer trial. Any selected worker must conform to
[ADR-0003](0003-versioned-generation-worker-message-contract.md): validated versioned envelopes,
cloned or explicitly transferred inputs, proposal-only results, cancellation acknowledgement, and
stale-result rejection before the desktop transaction commits.

## Decision

Adopt Option B: compact the live full-profile atlas representation without changing persisted
schema or canonical output.

Add project-owned immutable sample contracts in `packages/core` for macro-elevation and land/water
values. They expose length, validated indexed access, and deterministic traversal without exposing
mutable buffers. Use exact signed 32-bit elevation storage and a canonical packed two-state
classification. Generation, semantic analysis, coastline construction, validation, appearance,
render-scene composition, transaction comparison, and fixture hashing consume those contracts
through declared package entry points. No full-profile JavaScript element array may be created on
the generation-through-presentation path.

Keep `.mapworld` package, map-document, and accepted-aspect schema versions at v1. Persistence owns
explicit domain-to-DTO and DTO-to-domain adapters. Encoding emits the same ordered JSON arrays and
canonical bytes as before. Decoding validates the same strict DTOs and constructs compact immutable
domain values before exposing the accepted document. The in-memory wrapper is not serialized and
does not become a file-format promise.

Project maintainers accept this decision after the dedicated issue #77 review. Acceptance
authorizes only the ordered reader-contract, compact-domain/persistence-adapter, and packaged-proof
work recorded under issue #75; it does not authorize a worker or persisted-format change.

## Consequences

### Positive

- Full-profile payload size is bounded by numeric storage rather than JavaScript element and freeze
  behavior.
- The selected boundary reduces memory on the measured generation path and in quiescent accepted
  state.
- Canonical semantic values, `.mapworld` v1 bytes, SVG, PNG, stable IDs, aspect revisions, and
  deterministic scheduling remain acceptance oracles.
- Existing and newly saved v1 packages remain readable by older v1-compatible applications because
  their persisted representation is unchanged.
- No runtime dependency, native generation engine, or new production process is introduced.

### Negative

- The public internal atlas contracts no longer promise JavaScript array methods or array identity;
  all consumers must use the project-owned indexed/traversal API.
- Snapshot, deep-comparison, validation, canonical-hash, and persistence adapters must explicitly
  recognize the immutable packed domain values.
- Encoding canonical v1 JSON may still allocate significant save-time buffers. Save and reopen are
  report-only for Milestone 2, but their memory remains observable and must not corrupt accepted
  state.
- A compact representation can improve memory without improving every algorithmic traversal; the
  existing 10-second limit must still pass independently.

### Neutral or follow-up

- Representation-only changes do not increment generator, seed, parameter, style, geography, or
  persisted schema versions because accepted values and bytes are unchanged.
- A small in-memory representation identifier may be used for diagnostics, but it is neither
  persisted authority nor a compatibility substitute.
- Workers remain available for a later measured responsiveness need under ADR-0003; this decision
  does not reject that architectural contract.

## Compatibility and migration

- **Accepted world documents:** Semantic values, aspect ownership, revisions, locks, and accepted
  diagnostics are unchanged. Compact wrappers are immutable accepted domain values, not caches.
- **Persisted schemas and migrations:** `.mapworld` v1 DTOs and canonical JSON are unchanged. No
  migration fixture is added because there is no new persisted version. Existing v1 fixtures must
  decode into compact state and re-encode byte for byte. Unknown or malformed v1 values retain their
  existing stable failures.
- **Rollback:** A package saved after this change remains a valid old v1 package. Rolling back the
  application therefore requires no data conversion. If exact old-reader fixtures diverge, the
  change is rejected rather than shipped with a silent migration.
- **Generator, seed, parameter, context, and style versions:** None change. The same inputs must
  produce the same accepted values, proposal ordering, diagnostics, and reroll isolation.
- **Canonical semantic, scene, SVG, and PNG fixtures:** Every registered hash and byte artifact must
  remain unchanged. A fixture update is not an allowed way to land this representation change.
- **Cancellation, stale results, and error recovery:** Existing cooperative cancellation and desktop
  transaction ownership remain. Cancellation exposes no partial packed value, and validation or
  conversion failure retains the previous accepted document. No worker means no new stale-response
  state.
- **macOS and Linux determinism:** Indexed numeric access is defined in values, not raw native byte
  order. Node/macOS/Linux and packaged WebKit must agree exactly. Shared memory and platform-specific
  buffer APIs are unsupported.
- **Parent and child maps:** None. Milestone 2 has no accepted regional children, and the semantic
  world contract is unchanged.

## Implementation split

The production work is ordered as three executable children of issue #75:

1. Add the project-owned indexed sample-reader contracts and migrate every consumer while the
   existing JavaScript arrays remain valid producers. This child owns the public reader seam and
   leaves runtime representation, persistence bytes, and canonical output unchanged.
2. Switch generation, immutable snapshots, accepted state, and persistence adapters to compact
   full-profile storage. This child owns the atomic representation cutover, exact old-package
   rollback, the live-buffer inventory, unchanged canonical fixtures, and one clean packaged Apple
   M5 preflight below 640 MiB additional RSS.
3. Run the unchanged issue #70 Apple M5 release protocol. This child owns the warm-up plus five
   fresh processes for all three gated fixtures, export and cancellation evidence, and the release-
   evidence update. It does not authorize another production fix.

The first child remains `NOT READY` until this ADR is accepted and the issue #76 evidence commit is
available from the repository. Each later child remains `NOT READY` until its immediate predecessor
is complete. A failure at any stop condition returns to this decision instead of widening a child.

## Validation

Implementation proceeds in an ordered, fail-closed sequence:

1. Prove the indexed reader contract against the existing arrays and migrate generation, core,
   assets, render, desktop, persistence encoding, and fixture consumers without changing producers
   or accepted runtime values.
2. Prove compact sample constructors, immutability, bounds, indexed equality, deterministic
   traversal, snapshot reuse, and comparison behavior, then switch generation and persistence
   decode to those values in one atomic cutover.
3. Prove every existing v1 atlas fixture decodes to compact accepted state and re-encodes to the
   exact prior authoritative bytes and checksums without generator access. Remove full-profile
   JavaScript arrays from the generation-through-presentation path, record a bounded live-buffer
   inventory below 128 MiB, and preserve all registered semantic, scene, SVG, and PNG hashes.
4. Run `corepack pnpm check`, `corepack pnpm test:cross-platform`, `corepack pnpm test:e2e`, and the
   relevant persistence and visual gates.
5. Build the packaged release candidate on the designated Apple M5 host. A clean proof-fixture
   preflight must complete below 640 MiB additional process-tree RSS using the issue #70 sampler
   accounting before the full unchanged warm-up-plus-five-fresh-process protocol runs for all three
   gated fixtures. The final acceptance limit remains 768 MiB; 640 MiB is implementation headroom,
   not a product-contract change.

If compact state cannot preserve exact canonical bytes, cannot keep simultaneously live
full-profile buffers below 128 MiB, or the clean packaged preflight remains above 640 MiB, stop and
reopen this ADR. Do not introduce a worker, binary persisted format, lower-resolution fixture, or
weaker budget within an implementation child.

## Revisit conditions

- A clean compact candidate remains above 640 MiB additional process-tree RSS on the designated
  Apple M5 host.
- A measured worker termination and zero-copy transfer trial demonstrates additional peak-RSS
  reduction that the compact synchronous path cannot provide.
- Representative save, reopen, or package-size evidence shows that unchanged v1 JSON is itself the
  dominant resource problem.
- A future supported environment cannot implement the project-owned immutable sample contract with
  exact deterministic indexed values.
