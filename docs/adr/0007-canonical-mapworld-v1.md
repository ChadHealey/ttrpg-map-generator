# ADR-0007 — Canonical JSON `.mapworld` version 1

- **Status:** Accepted
- **Date:** 2026-08-15
- **Decision owners:** Project maintainer
- **Supersedes:** None
- **Superseded by:** None

## Context

Milestone 1 must prove that an accepted composition survives save/reopen without regeneration or
drift. The format must preserve stable identity, generator compatibility metadata, coordinates,
user intent, dependencies, and accepted output while producing byte evidence that agrees on macOS
and Linux. Issue #8 implements this boundary after the identity, coordinate, generator,
transaction, dependency, fixture, and Zod review contracts landed.

## Decision drivers

- Preserve accepted state without invoking generator implementations during load.
- Make repeated and insertion-order-varied encodes byte-identical.
- Reject corrupt or incompatible required data instead of silently stripping or repairing it.
- Keep DTO/schema concerns private to persistence and domain behavior in `core`.
- Provide inspectable fixtures before representative scale justifies a binary store.

## Options considered

### Canonical JSON directory package

Use strict versioned records, explicit canonical ordering, and per-authoritative-file SHA-256.
This is human-inspectable, deterministic, and sufficient for the small Milestone 1 proof.

### Seeds and edits only

This is compact but would require generator execution on open and would silently change accepted
work as algorithms or dependencies evolve.

### Binary chunks or SQLite

These can support large numeric fields or query workloads later, but add format, migration, and
recovery complexity before a representative project demonstrates the need.

## Decision

Adopt the version-1 contract in [`docs/mapworld-v1.md`](../mapworld-v1.md). The package contains
canonical `manifest.json`, `world.json`, and one map JSON file per root or regional map. The manifest
hashes exact authoritative bytes with SHA-256. Strict Zod DTO schemas validate JSON structure, then
project-owned adapters call `core` parsers and invariant validators to construct a new deeply
readonly `WorldDocument`. Encoding performs the reverse conversion and canonical ordering.

The package is an in-memory byte contract in #8. Filesystem atomicity and recovery remain a separate
adapter decision in #46.

## Consequences

### Positive

- Accepted state and user intent are materialized and generator-free on reopen.
- Exact bytes and checksums provide deterministic and corruption evidence.
- Human-readable fixtures can become migration baselines.
- Future storage optimization can retain the public domain boundary.

### Negative

- Canonical JSON is larger than a binary representation.
- Strict v1 readers reject unknown record fields and versions until an explicit compatibility path
  exists.
- The serializer must maintain explicit collection ordering and proof-output validation.

### Neutral or follow-up

- Issue #46 adds atomic replacement and recovery around these bytes.
- Later milestones may add versioned binary authoritative chunks only after measurement.
- A released schema change requires a new migration fixture; v1 is never rewritten in place.

## Compatibility and migration

This decision releases package, package-schema, world-index, map-record, and accepted-aspect version
`1`. It does not change generator, seed-derivation, parameter-schema, transform, or style versions,
and does not mutate accepted world or regional records. The new saved-project fixture is the source
baseline for a future migration. Canonical semantic and authoritative-file evidence is added; SVG
and visual evidence do not change. The same fixture runner verifies macOS and Linux bytes.

## Validation

Unit and integration evidence covers repeated and insertion-order encoding, strict schema/version
failures, malformed JSON, missing/extra files, checksum mismatch, reference and dependency
invariants, proof geometry, root/regional transforms, deep-readonly reconstruction, round trip, and
canonical aspect/output comparisons. The registered Milestone 1 fixture independently regenerates
the rerolled package and reopens it without generation.

## Revisit conditions

Revisit canonical JSON when representative saved projects demonstrate unacceptable size or latency,
or when a released v2 schema needs a migration. Revisit checksum coverage when binary authoritative
chunks enter scope. Do not revisit merely to add caches or previews, which remain disposable.
