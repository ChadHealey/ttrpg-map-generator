# Issue 152 ordered implementation-child drafts

These drafts are not live GitHub issues. Create the storage-codec child first, then re-author #138
with its live issue link. ADR-0027 is accepted and its dedicated-review findings are resolved, so
the storage-codec child is ready to start. Linux corroboration is deferred until an environment is
available and must pass before production v2 writer release; it is not an implementation
predecessor.

## Child 1 — Implement `.mapworld` v2 external aspects and binary field chunks

### Outcome

Implement ADR-0027's strict package-v2 storage codec so persistence can encode and generator-free
decode external M3 accepted-aspect JSON plus deterministic `.mwf` chunks behind project-owned
readers, without integrating physical aspects into accepted atlas transactions.

### In scope

- Manifest-first v1/v2 dispatch and exact v2 manifest/map/external-aspect/field schemas.
- `.mwf` header and payload encode/decode for every ADR-0027 field encoding.
- Ordered paths, canonical JSON, dictionaries, checksums, size limits, unknown-version failures, and
  project-owned immutable reader reconstruction.
- V2 canonical aspect/output evidence framing and focused corruption/version/range/order tests.
- A synthetic v2 codec fixture small enough for focused review; immutable v1 fixtures remain exact.

### Out of scope

- Accepted atlas transaction integration, physical-context clipping, regional snapshots, UI,
  rendering, names/labels, migration execution, native recovery changes, or package-limit changes.
- Compression, SQLite, a generic data API, or a production CLI.

### Acceptance criteria

- [ ] V1 packages still decode generator-free and re-encode byte-for-byte; a v1 reader rejects v2
      at the manifest boundary.
- [ ] V2 exact bytes match ADR-0027 for manifest order, external refs/aspects, every `.mwf` header
      and encoding, dictionary width, and canonical aspect/output framing.
- [ ] Decode bounds sizes before allocation, validates checksums before referenced content, rejects
      all unknown/malformed/noncanonical/path/dictionary/range/count cases, and exposes state only
      after core validation.
- [ ] Reconstructed readers reproduce every logical field fingerprint without importing or invoking
      generation and expose no backing storage.
- [ ] Per-file/package limit edge tests agree across TypeScript and the existing native boundary;
      no native protocol or limit changes.
- [ ] Repeated and insertion-order-varied encodes are byte-identical on macOS; run the same Linux
      proof when an environment is available and before production v2 writer release.

### Start here

1. `docs/mapworld-v2.md` and ADR-0027 — exact accepted contract and rationale.
2. `docs/investigations/issue-152/` — prototype, measurements, and per-file evidence.
3. `packages/persistence/src/mapworld-{encode,decode}.ts`, DTO schemas, and canonical JSON.
4. `packages/core/src/world-physical-context-{model,readers}.ts` — reader boundary.
5. ADR-0007 and ADR-0008 — v1 compatibility and unchanged recovery semantics.

### Dependencies and stop conditions

- Depends on accepted ADR-0027 and its completed dedicated review; Linux corroboration is a
  deferred pre-release gate.
- #138 depends on this child.
- Stop if implementation needs a third package boundary, a production dependency, a transport-limit
  change, a native recovery-protocol change, or a different public encoding.

### Readiness and execution profile

- State: READY — ADR-0027 is accepted and the discovery review findings are resolved.
- Execution kind: Implementation.
- Complexity: C4 — Complex; public format, data integrity, memory, and cross-platform determinism.
- Recommendation: `gpt-5.6-sol` / high, dated 2026-08-30.
- Context fit: PASS — persistence plus the narrow core reader factory; native behavior is unchanged.
- Dedicated review: required before publication.

## Re-authored #138 — Integrate M3 physical state and inherited context using the v2 codec

### Outcome

Integrate all nine physical aspects into accepted atlas state and persist/reopen an exact supplied
#144 regional inherited-context snapshot through the completed ADR-0027 codec, with explicit
v1-to-v2 candidate creation and unchanged ADR-0008 rollback/recovery behavior.

### In scope

- Strict accepted-aspect transaction ownership, dependencies, invalidation, locks, and immutability
  for all nine M3 physical records.
- Strict parent ownership and persistence for one supplied seam/pole representative #144 regional
  inherited-context contract-v1 snapshot, collar, portals, lineage, versions, and checksum inline
  at `parent.inheritedContext`; it does not borrow an aspect ID or `.mwf` owner.
- Explicit user-authorized v1-to-v2 candidate construction using the codec child.
- V1/v2 generator-free round trips, rollback, stale-context behavior, adjacent-footprint continuity,
  and every ADR-0008 fingerprint/recovery state with multi-file v2 candidates.
- Repeat the physical/context package measurement on macOS; retain matching Linux evidence as a
  deferred pre-release gate.

### Out of scope

- Codec redesign, package-limit changes, generator redesign, #145 snapshot building/clipping,
  names, labels, UI orchestration, renderer changes, native protocol changes, or migration of an
  accepted v1 package in place.

### Acceptance criteria

- [ ] One accepted world owns exactly the nine strict physical aspects with canonical dependency
      order, revision isolation, locks, diagnostics, and no generic-arm bypass.
- [ ] One regional child persists an exact supplied #144 footprint, transform, clipped
      fields/vectors, collar, ordered portals, lineage, source versions, and context checksum
      without generator use on reopen; no #145 builder runs in persistence.
- [ ] Accepted values remain immutable across save/reopen; stale parent context marks status but
      never replaces the child snapshot.
- [ ] Explicit v1-to-v2 creation preserves all M1/M2 accepted semantics and original v1 fixture
      bytes; rollback selects a complete preserved package by exact fingerprint.
- [ ] Every applicable ADR-0008 F0–F6/R0–R10 and P00–P17 case returns a complete valid v1 or v2
      package, including partial/corrupt external aspect and chunk failures.
- [ ] Representative macOS bytes and checksums remain below both transport limits and decode
      invokes zero generators; matching Linux evidence is required before production v2 release.

### Start here

1. Accepted ADR-0027 and the completed storage-codec child.
2. ADR-0022, ADR-0023, and ADR-0026's retained compatibility requirements.
3. `packages/core/src/world-physical-context-*` and inherited-context contracts.
4. Existing atlas acceptance transactions and persistence/recovery fixtures.

### Dependencies and stop conditions

- Depends on Child 1, #144's completed snapshot contract, and the implemented #134–#137 producers.
- #139 consumes the accepted state after #138; #151 later adds name/label persistence.
- Stop if supplied context needs a different selected field format, a third production package
  boundary appears, or native recovery semantics must change.

### Readiness and execution profile

- State: READY after Child 1; NOT READY before it.
- Execution kind: Implementation.
- Complexity: C4 — Complex; accepted-state integration, migration/rollback, context continuity, and
  recovery carry critical data-integrity risk.
- Recommendation: `gpt-5.6-sol` / high, dated 2026-08-30.
- Context fit: PASS after codec extraction — core integration and persistence orchestration only.
- Dedicated review: required before publication.

## Re-authored #151 — Persist deterministic names and labels

#151 remains ordered after #140 and #141 and after re-authored #138. It consumes ADR-0027 external
aspect ownership for strict name-content and label-placement records and repeats the complete-M3
macOS package measurement, with matching Linux evidence retained as a deferred pre-release gate.
Its current “binary/data chunk out of scope” constraint must be replaced with “consume but do not
redesign ADR-0027”; name/placement payloads remain canonical JSON unless separate measured evidence
requires another decision. Current execution profile remains C4, `gpt-5.6-sol` / high; no new
storage child is required unless the final measurement hits an ADR-0027 revisit condition.
