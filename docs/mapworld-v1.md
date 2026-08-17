# `.mapworld` version 1

This document owns the released byte and package contract implemented by
`@ttrpg-map/persistence`. The product boundary remains the authoritative `WorldDocument` from
[`01 — Architecture`](01-architecture.md); this format restores that state without defining
domain behavior or invoking generation. The durable choice is recorded in
[ADR-0007](adr/0007-canonical-mapworld-v1.md).

## Scope and versions

Version 1 stores exactly one root `WorldMap` and zero or more direct child `RegionalMap` records.
It does not define settlement, battle, underground, interior, or plugin map kinds.

| Compatibility value                   | v1 value |
| ------------------------------------- | -------- |
| Package version                       | `1`      |
| Package schema version                | `1`      |
| `world.json` record schema version    | `1`      |
| Map-document record schema version    | `1`      |
| Accepted-aspect record schema version | `1`      |
| Minimum application version           | `0.1.0`  |
| Maximum application version           | `<0.2.0` |

The manifest repeats all record schema versions. Each `world.json`, map, and accepted-aspect
record also carries its own version. An unknown value is incompatible; it is never treated as a
request to drop fields or run a generator.

## Package and authoritative set

The complete in-memory package uses this canonical file order:

```text
manifest.json
world.json
maps/<root-map-id>.json
maps/<regional-map-id>.json  # zero or more, ordered by map ID
```

`manifest.json` declares `world.json` followed by the same ordered map-file list as authoritative.
Each entry uses `checksumAlgorithm: "sha256"` and hashes the exact canonical file bytes. Lowercase
64-character hexadecimal is the only digest representation. The manifest is excluded from its own
authoritative checksum set to avoid recursion. Version 1 has no cache, preview, asset, data-chunk,
or recovery file; an undeclared or unsupported file is rejected.

The manifest's only recovery metadata is `recovery: { "mode": "none" }`. Sibling temporary-package
replacement, backup, commit-marker, durability, and interrupted-save behavior follow
[ADR-0008](adr/0008-mapworld-directory-commit-recovery.md) and belong to issue #46's native adapter
implementation; those artifacts are not package contents.

`world.json` contains the world-document ID and display name, canonical decimal `worldSeed`, root
map ID, and the complete map-file index. Index identity comes from stable map IDs, never labels or
array positions. A regional entry names its root parent. Each map file is authoritative for that
map's coordinate system, extent, entities, accepted aspects, constraints, locks, decoration, and
layout references.

## Canonical JSON

Every JSON file and canonical aspect artifact uses:

- UTF-8 without a byte-order mark;
- LF line endings and exactly one final newline;
- two-space indentation;
- object keys sorted by ASCII/code-point order at every depth;
- safe-integer JSON numbers only, with `-0` forbidden;
- no coercion, default insertion, locale ordering, clock value, or ambient metadata.

Every own enumerable string key is data, including names such as `__proto__` and `constructor`;
validation and canonical construction preserve those keys without assigning through an object
prototype. Accessors, symbol or non-enumerable keys, sparse arrays, cycles, functions, exotic
prototypes, unsafe numbers, and negative zero are rejected rather than invoked, omitted, or
normalized.

Coordinates are already quantized domain values. Planet points encode signed integer
`longitudeTicks` and `latitudeTicks`; regional extents and world radii encode integer millimetres.
Decode calls the owning `core` parser and never wraps, clamps, rounds, or re-quantizes received
values. The unsigned 64-bit world seed remains a canonical base-10 string because it may exceed the
JavaScript safe-integer range.

Order-insensitive domain collections are encoded as follows:

- the root map precedes regional maps, which sort by map ID;
- entities, aspects, constraints, and locks sort by their stable ID;
- dependency, decoration, and layout references sort by stable aspect ID and provenance;
- diagnostics use the `core` diagnostic order;
- proof markers sort by stable marker ID.

Outline points and other ordered geometry remain in semantic order. Arrays in generic accepted
parameter/output payloads also retain their declared semantic order. Decode compares received bytes
with the schema-aware canonical form, so reordering a canonical collection or changing whitespace is
an error rather than an implicit repair.

## Accepted aspects and proof evidence

Persistence DTO and Zod types are private. Public functions accept readonly project-owned domain
records or unknown package input and return `PersistenceResult` values. Decode follows:

```text
unknown package -> UTF-8/JSON -> strict Zod DTO -> checksums/references
  -> core parsers and invariants -> new deeply readonly WorldDocument
```

The accepted-aspect DTO records the map/entity/aspect address, aspect name, generator and parameter
versions, parameters, seed scope and complete seed metadata, variant revision, dependencies and
cross-map provenance, accepted diagnostics, `generationStatus: "accepted"`, and materialized output.
Unknown record fields are rejected. Output/parameter payloads for other known domain aspects remain
canonical JSON governed by their generator and parameter-schema versions; the two Milestone 1 proof
aspects cannot use that generic arm.

`proof.outline` and `proof.markers` have exact strict schemas for their fixed IDs, names, generator
versions, parameter values, seed scope, dependencies, output shape, point counts, and marker count.
Domain validation additionally checks the closed simple counterclockwise outline, exact derived
marker IDs and order, and strict marker containment.

The nine Milestone 2 atlas aspect kinds also use exact strict v1 arms. Their DTOs preserve the
accepted full-profile macro-elevation ticks and land/water samples; semantic component memberships,
classification, containment, adjacency, and marine connectivity; canonical planet-native coastline
rings and source fingerprints; canonical controls and generator parameters; and the three
projection-neutral appearance outputs with explicit style provenance. Nested entity, aspect,
surface-component, and coastline-ring IDs are parsed through `core`, as are every persisted
`PlanetPoint` and style semantic key. Persistence then asks the core-owned accepted-atlas
reconstructor to validate the complete aspect graph, exact singleton/feature ownership, required
dependencies, controls, semantic partition, coastline, and appearance provenance before exposing
the document.

Milestone 2 does not change the released package, map-document, or accepted-aspect schema version.
Version 1 already reserved strict known-domain aspect arms beside its generic arm, and no released
Milestone 2 save predates these records. The generic arm now explicitly rejects all nine atlas names
so a malformed atlas cannot bypass their strict DTOs. Milestone 1 v1 packages remain byte-compatible
and require no migration.

Atlas order-insensitive collections have these additional canonical rules:

- component sample ranges sort by their half-open start/end indexes;
- land/water adjacency, enclosure, connectivity, and coastline water-body references sort by stable
  ID;
- landmass, water-body, coastline-ring, ink-decision, and decoration-path records sort by their
  stable entity, ring, source-ring, or decoration ID;
- archipelago members sort by stable landmass ID, while island-chain members retain semantic chain
  order; and
- macro samples, classification samples, coastline points, and decoration-path points retain their
  declared canonical geographic traversal.

`canonicalAspectBytes` returns the canonical bytes of the complete accepted-aspect DTO, including its
record version and metadata. `canonicalAspectOutputBytes` returns only canonical `acceptedOutput`
bytes. Neither is a containing-map checksum or an authoritative-file checksum.

## Failures and restoration

Failures include a stable persistence code, package file path, JSON field path, explanation, and
suggested action. The stable code families distinguish malformed UTF-8/JSON, noncanonical bytes,
strict-schema failures, incompatible versions, missing/duplicate/unexpected paths, SHA-256 mismatch,
ownership, dependency/reference, seed, proof, and immutable-snapshot failures.

Decode constructs new arrays and records, then deep-freezes the result. It does not accept a
generator registry, import a generator package, advance a stream, migrate, upgrade, or repair an
accepted record. Disposable rendering and caches may be rebuilt by later orchestration only after a
valid document has been exposed.

For a complete accepted atlas, desktop orchestration reconstructs the disposable `RenderScene`
from the decoded geography and appearance records through the renderer-neutral scene composer. The
reopen path imports no generator package and accepts no generator registry. Deleting the prior
scene, preview, projected paths, hit-test indexes, or raster intermediates therefore cannot change
accepted bytes or the rebuilt scene semantics.

The bounded native transport permits at most 128 MiB for one authoritative package file and
192 MiB for a complete package. TypeScript and Rust enforce the same values. These are adapter
safety bounds sized for the full-profile Milestone 2 sample arrays, not persisted schema fields, so
their increase from the kernel-proof limits does not change a v1 compatibility identifier.
The injected desktop/native command carries those already-validated immutable bytes as strict
canonical base64 strings; Rust decodes them under the same limits before applying the unchanged
atomic directory-commit protocol. Base64 is transport framing only and never appears inside a
`.mapworld` package.

## Deliberate exclusions

Version 1 does not place filesystem replacement/recovery state inside the package. The desktop
adapter implements [ADR-0008](adr/0008-mapworld-directory-commit-recovery.md) with fixed sibling
artifacts around this unchanged byte contract. Autosave, migration UI, binary chunks, SQLite,
imported assets, generator upgrades, and a production headless CLI remain excluded. Future
capabilities must compose around this byte contract without weakening accepted-state restoration.
