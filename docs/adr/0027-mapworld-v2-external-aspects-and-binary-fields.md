# ADR-0027 — `.mapworld` v2 External Aspects and Binary Fields

- **Status:** Accepted — Linux corroboration deferred
- **Date:** 2026-08-31
- **Decision owners:** Project maintainers
- **Supersedes:** ADR-0026
- **Superseded by:** None
- **Resolves:** [Issue #152](https://github.com/ChadHealey/ttrpg-map-generator/issues/152)

## Context

[ADR-0026](0026-mapworld-v2-milestone-3-accepted-records.md) selected a strict package-v2
dispatch while retaining one canonical JSON map file as the owner of every accepted aspect. Its
mandatory measurement gate has now failed before #138: the accepted M2 map is 82,482,435 bytes and
one unavoidable full-profile UUID watershed array needs at least 81,709,135 additional JSON bytes.
Their 164,191,570-byte lower bound already exceeds the 128 MiB per-file limit by 29,973,842 bytes.

The reproducible issue-152 prototype uses the fixed M2 atlas plus all completed M3 physical
producers. On macOS the complete candidate sizes are:

| Option                              | Package bytes | Package headroom | Largest file | Result                                     |
| ----------------------------------- | ------------: | ---------------: | -----------: | ------------------------------------------ |
| Versioned binary field chunks       |   136,842,422 |       64,484,170 |   82,484,875 | Pass; selected                             |
| Separate canonical JSON field files |   390,190,844 |     −188,864,252 |   92,184,771 | Reject; package limit                      |
| Compact/dictionary JSON             |   189,500,644 |       11,825,948 |   82,484,875 | Reject; inadequate remaining-M3 margin/RSS |

All options repeat byte-for-byte and reconstruct the same nine fields without generators. Exact
commands, per-file sizes, timings, memory, and checksums are in the
[issue-152 investigation](../investigations/issue-152/README.md). The maintainers accept this
decision on the reproducible macOS evidence and resolved dedicated review. Matching Linux evidence
is deferred until a Linux environment is available; it no longer blocks this ADR or its
implementation children, but remains required before a production v2 writer is released.

## Decision drivers

- Fit the representative physical profile and later inherited-context/name/label records below the
  unchanged 128 MiB file and 192 MiB package limits with material margin.
- Preserve strict manifest-first version dispatch, exact authoritative checksums, deterministic
  bytes, project-owned readers, and generator-free reopen.
- Keep accepted-aspect identity and validation explicit rather than hiding all M3 fields in one
  opaque blob.
- Preserve exact v1 bytes and ADR-0008's package-level atomic replacement and recovery protocol.
- Prevent multiple byte encodings for one logical field.

## Options considered

### Option A — Versioned binary chunks behind external aspect records

Store each M3 accepted aspect as canonical JSON and each dense field component as one strictly
versioned, little-endian chunk. The aspect owns its metadata, feature vectors, logical provenance,
dictionary, and chunk descriptors. The manifest hashes every aspect and chunk. Project-owned
readers reconstruct the complete accepted record. This passes with 64,484,170 package bytes of
margin and is selected.

### Option B — Separate canonical JSON aspect and field files

Moving each field out of the map prevents a single-file failure, but the measured package is
390,190,844 bytes, 188,864,252 bytes above the package limit. No raising of the limit or speculative
compression is authorized. Rejected.

### Option C — Compact/dictionary JSON

Use no insignificant whitespace, decimal numeric values, and sorted dictionaries for repeated
strings. The representative package fits, but only by 11,825,948 bytes before inherited context,
names, and placements. It also measured about 1.44 GB peak encode RSS, above the binary prototype.
The margin is not adequate for the remaining declared M3 owners. Rejected.

## Decision

### Package and owner versions

The accepted design retains ADR-0026's compatibility boundary and changes its storage ownership:

| Contract                                 | Version | Owner and responsibility                                                                                        |
| ---------------------------------------- | ------: | --------------------------------------------------------------------------------------------------------------- |
| `manifest.json` package/schema           |       2 | Dispatch before other decoding; list every authoritative world, map, aspect, and field file with exact SHA-256. |
| Application compatibility                |         | `>=0.2.0`, `<0.3.0`.                                                                                            |
| `world.json`                             |       1 | Unchanged world index.                                                                                          |
| `maps/<map-id>.json` map document        |       2 | Own map state, inline v2 M1/M2 aspects, and sorted external M3 aspect references.                               |
| `data/<map-id>/aspects/<aspect-id>.json` |       2 | Own one complete M3 accepted-aspect envelope and all non-dense output values.                                   |
| `.mwf` field-file schema                 |       1 | Own one dense logical field component's exact payload bytes.                                                    |
| Accepted aspect in a v2 package          |       2 | Strict arm only; known M3 names cannot use a generic arm.                                                       |
| Recovery marker/protocol                 |       1 | Unchanged sibling ADR-0008 journal and package-fingerprint state machine.                                       |

The root map's `externalAcceptedAspects` is sorted by `aspectId`. Every entry contains exactly
`acceptedAspectSchemaVersion`, `aspectId`, `aspectName`, and `path`. Inline and external aspect IDs
form one unique sorted logical set. M3 physical aspects must be external; M1/M2 compatibility arms
remain inline so a v1-to-v2 candidate does not needlessly duplicate their large values. A decoder
rejects missing, duplicate, unreferenced, wrong-map, wrong-entity, wrong-name, or unexpected aspect
files.

A regional map continues to own its complete `parent.inheritedContext` snapshot inline in the
canonical map JSON under inherited-context contract version `1`. This snapshot is not an accepted
aspect and cannot borrow an aspect ID or external-aspect path. Its clipped `fields[].samples`,
geometry anchors, collar, portals, lineage, named anchors, and semantic checksum remain one strict
canonical JSON value exactly as ADR-0023 and ADR-0026 define. Schema-v1 inherited context does not
use `.mwf` chunks. If a representative snapshot later cannot fit, that is an explicit map-document
and inherited-context schema revisit rather than an invented external owner.

The manifest's authoritative path order is:

1. `world.json`;
2. map files sorted by stable map ID; then
3. external aspect and field files sorted by ASCII/code-point path.

The manifest remains outside its own checksum set. No cache, preview, temporary, or recovery file
is authoritative package content.

### Exact canonical JSON

World, map, manifest, external aspect, and dictionary/descriptor values use the existing v1
canonical JSON rules: UTF-8, LF, one final newline, two-space indentation, recursively sorted object
keys, safe integers, semantic array order, and no coercion or default insertion. Package-v2
ordering adds only the path and external-aspect rules above.

An external accepted aspect retains the complete v2 envelope selected by ADR-0026. A dense field's
former `values` property becomes this strict descriptor:

```json
{
  "byteOrder": "little-endian",
  "fieldFileSchemaVersion": 1,
  "path": "data/<map-id>/fields/<aspect-id>.<component>.mwf",
  "sampleCount": 2095106,
  "storageKind": "mapworld-field-binary",
  "valueEncoding": "i32"
}
```

Dictionary-coded fields additionally contain a `dictionary` array in the descriptor. Dictionaries
sort unique canonical strings by ASCII/code point. Every entry must be referenced, and every code
must be in range. The smallest allowed index width is mandatory, so one logical dictionary cannot
have multiple valid encodings.

`canonicalAspectBytes` and `canonicalAspectOutputBytes` remain semantic comparison boundaries, not
authoritative-file checksums. Their v2 implementation uses a framed canonical evidence sequence:

```text
8 bytes  ASCII "MWASPCT2" or "MWASOUT2"
4 bytes  unsigned little-endian owned-file count
repeat in ASCII/code-point path order:
  4 bytes  unsigned little-endian UTF-8 path length
  8 bytes  unsigned little-endian content length
  n bytes  UTF-8 path
  m bytes  exact authoritative aspect JSON or field chunk bytes
```

For full-aspect evidence, the owner set is the external aspect JSON followed by its referenced
chunks. For output evidence, persistence canonicalizes the strict accepted-output descriptor as a
synthetic owner path `$accepted-output.json`, then includes the same chunks. Paths and content
lengths prevent concatenation ambiguity. Implementations may stream this framing into SHA-256; they
must produce the same bytes when a caller requests the complete artifact.

### Exact `.mwf` bytes

Each field chunk is a 32-byte header followed by one dense payload. No alignment bytes, footer,
compression, platform word, locale, timestamp, or checksum is present.

| Offset | Bytes | Meaning                                                                                     |
| -----: | ----: | ------------------------------------------------------------------------------------------- |
|      0 |     8 | ASCII `MWFIELD2`.                                                                           |
|      8 |     2 | Unsigned little-endian field-file schema version, exactly `1`.                              |
|     10 |     1 | Encoding code: `1=i16`, `2=i32`, `3=u16`, `4=u32`, `5=dict-u8`, `6=dict-u16`, `7=dict-u32`. |
|     11 |     1 | Flags, exactly zero.                                                                        |
|     12 |     4 | Unsigned little-endian sample count.                                                        |
|     16 |     4 | Dictionary count; zero for numeric fields.                                                  |
|     20 |     4 | Payload byte length.                                                                        |
|     24 |     8 | Reserved, all zero.                                                                         |

The payload contains exactly `sampleCount` fixed-width values in canonical atlas traversal. The
payload length must equal count times width. The strict M3 component encodings are:

| Logical component                                | Encoding         |
| ------------------------------------------------ | ---------------- |
| Temperature ticks                                | `i16`            |
| Prevailing-wind Cartesian x/y/z normalized ticks | `i32`            |
| Prevailing-wind speed ticks                      | `u16`            |
| Moisture normalized ticks                        | `u32`            |
| Climate-zone keys                                | dictionary index |
| Biome keys                                       | dictionary index |
| Watershed entity IDs                             | dictionary index |

Encoding validates every logical value before allocation or write. A value outside the selected
integer range fails; it is never clamped, wrapped, promoted ad hoc, or written with a different
encoding. A future range that cannot fit requires a field-file schema/version decision.

### Checksums, size enforcement, and validation order

The field's core-owned provenance fingerprint continues to cover canonical logical values. The
manifest SHA-256 covers exact authoritative file bytes. Fixture integrity covers checked-in
evidence. These hashes remain separate even when values happen to agree.

Encode order is:

1. validate the complete domain document, aspect graph, readers, logical values, dictionaries,
   paths, versions, and file/package size arithmetic;
2. create exact world, map, external-aspect, and chunk bytes and their manifest SHA-256 values;
3. construct and canonicalize the manifest from that complete authoritative set;
4. enforce every native path/count bound, 128 MiB on every package entry, and 192 MiB on the exact
   complete package sum including the manifest;
5. decode the complete immutable candidate through the v2 reader; then
6. pass the validated byte plan to the unchanged ADR-0008 replacement adapter.

Decode order is:

1. before allocation, enforce at most 256 package entries including the manifest, at most eight
   relative-path components, at most 1,024 UTF-8 bytes per relative path, at most 255 UTF-8 bytes
   per basename, 134,217,728 bytes per entry, and 201,326,592 aggregate bytes;
2. decode only `manifest.json`, require package/schema `2`, exact application compatibility,
   record versions, recovery mode, ordered unique paths, and supported checksum algorithm;
3. require the declared authoritative set and reject missing, extra, duplicate, or unexpected
   files;
4. validate every exact-byte SHA-256 before parsing a referenced map, aspect, or chunk;
5. decode `world.json` and maps, then resolve external aspect references;
6. validate aspect JSON, field descriptors, header/reserved bytes, encoding, count, payload length,
   dictionary, value ranges, traversal, and logical provenance fingerprint;
7. construct project-owned immutable field readers and run core aspect/document invariants; and
8. expose one deeply readonly `WorldDocument` only after the whole graph succeeds.

Unknown package, schema, aspect, field, encoding, footprint, context, or transform versions return
`persistence.version.incompatible`. No path falls back to generic JSON, ignores a field, runs a
generator, or guesses a future encoding.

### Reader reconstruction

Persistence owns byte/header/dictionary validation and passes validated immutable typed storage to
core-owned reader factories. Core exposes only `WorldPhysicalFieldReader`; callers cannot inspect
the backing buffer. Numeric readers perform fixed-width indexed reads. Dictionary readers resolve
validated indices through the frozen descriptor dictionary. Reader iteration follows exact stored
order and reproduces the persisted logical fingerprint. No generator package is imported by the
reopen path.

### V1-to-v2 candidate, rollback, and recovery

Opening v1 remains generator-free and byte-preserving. Migration occurs only when an explicit user
operation accepts M3 state:

1. retain the complete valid v1 target and its manifest fingerprint `Vo`;
2. copy accepted M1/M2 logical values into v2 envelope records without changing their semantics;
3. add strict external M3 aspect/chunk owners and create a complete v2 candidate fingerprint `Vn`;
4. run the full encode/decode/size/checksum validation above; and
5. invoke ADR-0008 with `expectedPreviousFingerprint=Vo` and `candidateFingerprint=Vn`.

There is no in-place file conversion and no generator use during migration or reopen. Rollback
means selecting the preserved valid v1 target/backup by exact `Vo`, not teaching a v1 application
to read v2.

ADR-0008's artifacts, commit point, marker schema, native operation sequence P00–P17, stable result
codes, confirmation boundary, and sync/no-replace primitives do not change. A package fingerprint
remains lowercase SHA-256 of the exact canonical `manifest.json` bytes. The validated manifest in
turn covers the complete v1 or v2 authoritative set, including new data files. Every recovery case
applies as follows:

- `T`, `W`, and `B` validate by manifest-dispatched v1 or v2 readers and yield one fingerprint only
  after all declared aspect/chunk files validate;
- marker `Vo` may name v1 and `Vn` v2; version difference is not ambiguity when fingerprints and
  roles match the valid marker;
- F0–F6 and R0–R10 continue to choose complete valid packages only; a partial chunk makes that role
  invalid, never partially readable;
- P05/P06/P07/P08 parameterize over every added aspect/chunk file and `data/` directory;
- matching-marker cleanup may remove only the exact complete `Vo` backup or exact `Vn` duplicate;
- malformed/unknown chunks, wrong fingerprints, different valid candidates, and unowned non-empty
  data remain attention states under the existing stable codes; and
- no recovery branch runs migration, generators, chunk repair, dictionary repair, or logical
  fingerprint recomputation to invent missing bytes.

The extra files enlarge staging work but do not require a third package boundary or native protocol
redesign. If implementation proves otherwise, it hits issue 152's stop condition.

## Consequences

### Positive

- The representative physical profile has about 61.5 MiB of package headroom for remaining M3
  owners without changing transport limits.
- Dense fields have one deterministic fixed-width representation and remain hidden behind
  project-owned readers.
- Per-aspect metadata and vectors stay inspectable canonical JSON.
- Existing v1 bytes, package-level checksums, and native recovery semantics remain intact.

### Negative

- Persistence must support external accepted-aspect ownership, a binary codec, evidence framing,
  and more authoritative files.
- Human inspection of dense values requires a version-aware diagnostic tool rather than a text
  editor.
- The measured JavaScript prototype still peaks near 1.07 GB RSS while encoding; implementation
  should stream and avoid materializing logical arrays where the reader already provides traversal.

### Neutral or follow-up

- This discovery does not implement persistence, migration, context clipping, or native recovery.
- #138 must be re-authored after a bounded codec child implements this public format.
- #151 repeats the complete-M3 size matrix after names and labels exist.
- Compression remains excluded. A later compression proposal needs its own deterministic bytes,
  limits, validation, dependency review, and migration decision.

## Compatibility and migration

- **Accepted world documents:** unchanged as domain state. M1/M2 v1 packages remain generator-free.
- **Persisted schemas:** package/schema, map-document, and accepted-aspect v2 remain as ADR-0026;
  external field-file schema v1 and external aspect ownership are added.
- **Generator/seed/parameter/context/style versions:** unchanged by storage. The codec preserves
  logical values and their core fingerprints.
- **Fixtures:** v1 fixtures remain immutable. Implementation adds v2 migration, negative-version,
  chunk corruption, checksum, size, and ADR-0008 recovery fixtures.
- **Cross-platform:** identical inputs must produce identical manifest, map, aspect, chunk,
  canonical-evidence, and logical fingerprints on macOS and Linux.
- **Parent/child maps:** a regional inherited-context contract-v1 snapshot remains complete inline
  canonical JSON owned by `parent.inheritedContext`; it never borrows an aspect owner or reads a
  parent generator.

## Acceptance and deferred validation

The decision was accepted on 2026-08-31 after the macOS measurement repeated exact manifest,
file-set, and logical fingerprints for all three options and the dedicated C4 review's six
actionable findings were resolved. The accepted risk is evidentiary, not semantic: no Linux result
is being claimed.

Linux corroboration is deferred until a suitable environment is available. Before a production v2
writer is released, run the issue-152 measurement using the checked-in source hashes and confirm
that binary package/file bytes, manifest checksums, logical fingerprints, generator-free decode,
and limit results match macOS. Any difference is a stop-and-revisit condition, not an allowed
platform-specific encoding.

The representative inline inherited-context snapshot remains implementation-stage evidence for
#138 because its supplied #144/#145 fixture does not yet exist. #138 must repeat the complete
physical/context package measurement when that fixture is available; its absence does not reopen
the already-proven single-file JSON failure or block the storage-codec child.

The implementation children then prove strict header/encoding/path/version failures, per-file and
package limits before allocation, byte-identical repeated and insertion-order-varied encodes,
generator-free reader reconstruction, semantic fingerprint equality, explicit v1-to-v2 candidate
creation, and the complete ADR-0008 failure matrix with multi-file v2 candidates.

## Revisit conditions

Revisit if Linux bytes differ, a declared M3 field cannot use the selected fixed width, the complete
M3 fixture or representative inline inherited-context snapshot lacks safe file/package margin,
streaming cannot keep memory within an accepted workflow, native staging needs a protocol change,
or a future release needs an incompatible v3 package.
