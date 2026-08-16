# ADR-0004 — Stable identity grammar and derivation

- **Status:** Accepted
- **Date:** 2026-08-15
- **Decision owners:** Project maintainers
- **Supersedes:** None
- **Superseded by:** None

## Context

Milestone 1 needs stable references for its world document, root map, proof entity, aspects,
constraint, lock, and generated markers. [Issue #5](https://github.com/ChadHealey/ttrpg-map-generator/issues/5)
requires identity to survive renaming and reordering, validate at unknown-input boundaries, and
derive generated-subfeature identity without ambient randomness. The fixed composition is
defined by the [kernel-proof contract](../milestone-1-kernel-proof.md).

Identity grammar and derivation bytes become compatibility promises as soon as accepted world
documents persist them. They must remain deterministic on macOS and Linux, while staying
separate from generator seed derivation and the persistence format.

## Decision drivers

- Opaque references must not encode display names, collection positions, or mutable metadata.
- Canonical text must compare and serialize identically across supported platforms.
- Generated marker identity must survive rerolls while its position changes.
- Boundary failures need stable codes and actionable messages without coercing input.
- The implementation must not add a runtime dependency or an ambient random source.

## Options considered

### Option A — Unprefixed UUID records with UUIDv5 generated children

Use lowercase hyphenated UUID text for record identity, inject UUID creation, and derive
generated children through RFC UUIDv5 from a stable parent namespace and a validated semantic
key. Keep the record kind in the UUIDv5 name for domain separation.

### Option B — Prefixed UUIDs per record kind

Prefixes make IDs recognizable in logs, but make the persisted grammar project-specific and
duplicate type information already carried by each record field.

### Option C — Structured path or content-derived IDs

Paths are readable, but renames, moves, and reordered collections can change identity.
Content-addressed IDs also change whenever accepted content changes, which conflicts with
selective reroll and edit preservation.

## Decision

World-document, map, entity, aspect, constraint, lock, boundary-portal, root-surface,
surface-component, and coastline-ring IDs are distinct branded TypeScript types with one
canonical representation: an unprefixed, lowercase,
hyphenated `8-4-4-4-12` UUID string. Parsing unknown values does not coerce or normalize them;
uppercase UUID text receives a stable non-canonical diagnostic that identifies the lowercase
replacement. The nil UUID is reserved as a sentinel and rejected because it cannot identify a
record. Equality is canonical string equality. Ordering is ascending ASCII order of the canonical
string, and canonical encoding emits that string unchanged.

`GeneratorId` is a separate branded symbolic ID. It uses two or more lower-camel dot-separated
segments; segments begin with a lowercase letter and otherwise contain ASCII letters, digits, or
internal hyphens.
`proof.outline`, `proof.markers`, and `worldTerrain.macroElevation` are canonical examples. Symbolic
generator IDs and semantic keys are at most 128 ASCII characters.

Generated-subfeature semantic keys contain lowercase ASCII letters or digits separated by a
single dot, underscore, or hyphen. They are validated without trimming or Unicode
normalization. `marker-000` through `marker-008` are the Milestone 1 keys.

Generated identity uses RFC UUIDv5. The stable parent UUID supplies the UUID namespace. The
exact ASCII name bytes are:

```text
ttrpg-map/stable-id/v1/<target-kind>/<semantic-key>
```

Including the target kind prevents the same parent and key from aliasing records in different
identity domains. The derivation prefix is versioned because changing any byte changes every
derived ID. UUID creation for user-created or imported records is supplied through an explicit
injected interface and its result is validated by the same parser.

`BoundaryPortalId` is the single boundary/portal identity needed now. A root-surface namespace
belongs to seed derivation and is deferred to issue #6. This UUIDv5 decision derives identity
only; it does not specify or version any generator seed algorithm. Coordinates, generator and
document records, persistence I/O, and future map kinds remain outside this ADR.

### Compatibility versions and revisions

`BehaviorVersion` and `ParameterSchemaVersion` are distinct branded positive safe integers
starting at 1. `VariantRevision` is a third branded type: a non-negative safe integer starting at
0 that advances only through an explicit, overflow-checked increment. These values cannot be
exchanged as ordinary numbers. Invalid unknown input reports compatibility-specific stable
diagnostic codes. A world-document or record schema version is intentionally not defined here;
persistence will introduce its own distinct type when that boundary is implemented.

## Consequences

### Positive

- Renames, reordering, and rerolls cannot alter identity unless callers explicitly replace it.
- UUIDv5 produces standard, reproducible identities without runtime randomness or dependencies.
- Branded types reject common cross-domain reference mistakes during TypeScript checking.
- Canonical validation catches drift before it reaches persistence or worker boundaries.

### Negative

- Unprefixed UUIDs do not reveal their record kind when viewed without their containing field.
- Supporting a broader key grammar later requires a compatibility decision rather than silent
  normalization.
- The core owns a small SHA-1 implementation because UUIDv5 mandates SHA-1.

### Neutral or follow-up

- Persistence schemas will call these parsers and translate identity diagnostics into their
  boundary-level diagnostic envelope.
- Issue #6 separately defines seed namespaces and seed derivation.

## Compatibility and migration

No released world-document schema or accepted fixture exists, so no migration or accepted data
changes. The compatibility primitives define behavior and parameter-schema version domains but
do not increment any generator, seed, parameter, context, or style version. The Milestone 1
proof IDs remain exactly as specified, and its marker identity is now fixed by the derivation
byte grammar above. Semantic, SVG, and PNG fixtures do not yet change. UUIDv5, ASCII validation,
equality, and ordering have identical behavior on macOS and Linux. Parent and child map behavior
is unchanged.

## Validation

Focused core tests exercise every ID kind, invalid and non-canonical unknown input, injected
creation, rename/reorder stability, canonical equality and ordering, UUID version and variant
bits, domain separation, and a UUIDv5 value independently computed from the specified bytes.
Compile-time tests prove that record kinds and symbolic generator identity are not assignable.

## Revisit conditions

- A required external interoperability contract uses a different UUID canonical form.
- A concrete generated subfeature cannot be assigned a stable ASCII semantic key.
- Persisted Unicode identifiers become a product requirement with an explicit normalization
  and migration policy.
