# `.mapworld` version 2 accepted design contract

This document owns the accepted package-v2 byte contract selected by
[ADR-0027](adr/0027-mapworld-v2-external-aspects-and-binary-fields.md). It is an accepted design,
not yet a released writer. Linux corroboration is deferred until an environment is available and
must pass before production v2 writer release; it does not block implementation. Version 1 remains
owned by [`mapworld-v1.md`](mapworld-v1.md) and its bytes never change.

## Versions and compatibility

| Compatibility value                   | v2 value       |
| ------------------------------------- | -------------- |
| Package version                       | `2`            |
| Package schema version                | `2`            |
| `world.json` record schema version    | `1`            |
| Map-document record schema version    | `2`            |
| Accepted-aspect record schema version | `2`            |
| External field-file schema version    | `1`            |
| Minimum application version           | `0.2.0`        |
| Maximum application version           | `<0.3.0`       |
| Recovery marker/protocol version      | `1`, unchanged |

Unknown package, record, aspect, field, encoding, footprint, context, or transform versions fail
with `persistence.version.incompatible` before an accepted document is exposed.

## Package shape and authoritative order

```text
MyWorld.mapworld/
  manifest.json
  world.json
  maps/<map-id>.json
  data/<map-id>/aspects/<aspect-id>.json
  data/<map-id>/fields/<aspect-id>.<component>.mwf
```

The manifest lists `world.json`, map files sorted by stable map ID, then all `data/` files sorted by
ASCII/code-point path. Every entry uses exact-byte SHA-256. The manifest remains outside its own
checksum set. Cache, preview, temporary, and ADR-0008 sibling recovery artifacts are not package
contents.

`world.json` is byte-compatible with its schema-v1 owner. A schema-v2 map contains inline strict
v2 M1/M2 compatibility aspects plus `externalAcceptedAspects`, sorted by `aspectId`. Each external
reference contains exactly `acceptedAspectSchemaVersion`, `aspectId`, `aspectName`, and `path`.
Inline and external IDs form one unique logical aspect set.

Every M3 physical aspect, accepted `worldFeature.nameContent`, and accepted `label.placement` is an
external canonical JSON file. Generic accepted aspects cannot use this ownership arm, and these M3
aspects cannot appear inline. Each file stores the complete accepted-aspect v2 envelope. Name and
placement owners never use `.mwf` chunks. Their exact generated or manual text, comparison bytes,
integer metrics, glyph identity, variant, revision, dependency, and semantic array order remain
authoritative; decode does not normalize, regenerate, or reflow them. Placement decoration remains
a separate reference to its accepted placement owner.

Physical owners additionally store feature/vector values, provenance, dictionaries, and field
descriptors. A dense `values` sequence is replaced by a descriptor containing:

- `fieldFileSchemaVersion: 1`;
- `storageKind: "mapworld-field-binary"`;
- `byteOrder: "little-endian"`;
- canonical package-relative `path`;
- exact `sampleCount`;
- exact `valueEncoding`; and
- a sorted unique `dictionary` for dictionary-index fields.

A regional map owns its complete inherited-context contract-v1 snapshot inline at
`parent.inheritedContext`. It remains canonical JSON with its clipped `fields[].samples`, geometry
anchors, collar, portals, lineage, names, and semantic checksum. It is not an accepted aspect, does
not borrow an aspect ID, and does not reference `.mwf` files. Externalizing that snapshot would
require a new map-document and inherited-context schema decision.

## Canonical JSON and binary bytes

All JSON retains the version-1 canonical rules: UTF-8 without BOM, LF, one final newline, two-space
indentation, recursively ASCII/code-point-sorted object keys, safe integers, and explicit semantic
array order. No v2 path uses compact JSON.

The two domain outputs whose in-memory quantum is `0.1` use exact fixed rational DTOs so no binary
floating-point number enters canonical JSON:

```json
{
  "quantumCelsius": {
    "denominator": 10,
    "numerator": 1
  }
}
```

```json
{
  "speedQuantumMetersPerSecond": {
    "denominator": 10,
    "numerator": 1
  }
}
```

These are strict literal objects, not a generic rational-number facility. The encoder accepts only
the corresponding domain constant `0.1`, writes exactly the objects above, and never serializes the
domain number directly. The decoder accepts only integer numerator `1` and denominator `10`, then
reconstructs the existing domain constant `0.1`. Missing fields, extra fields, reversed values,
alternate equivalent fractions such as `2/20`, decimal numbers, strings, and default insertion all
fail strict schema validation. This lossless DTO conversion does not change field provenance,
logical-value fingerprints, `.mwf` payloads, or the safe-integer JSON rule.

Each `.mwf` file is a 32-byte header plus exactly one dense payload:

| Offset | Size | Value                                                                       |
| -----: | ---: | --------------------------------------------------------------------------- |
|      0 |    8 | ASCII `MWFIELD2`                                                            |
|      8 |    2 | little-endian unsigned schema version `1`                                   |
|     10 |    1 | `1=i16`, `2=i32`, `3=u16`, `4=u32`, `5=dict-u8`, `6=dict-u16`, `7=dict-u32` |
|     11 |    1 | zero flags                                                                  |
|     12 |    4 | little-endian unsigned sample count                                         |
|     16 |    4 | little-endian unsigned dictionary count, zero for numeric fields            |
|     20 |    4 | little-endian unsigned payload byte length                                  |
|     24 |    8 | zero reserved bytes                                                         |

The payload is `sampleCount` fixed-width values in canonical atlas traversal. Payload length equals
count times width. Temperature is `i16`; wind x/y/z is `i32`; wind speed is `u16`; moisture is
`u32`; and climate, biome, and watershed values use the smallest canonical dictionary index width.
Out-of-range values fail rather than clamp, wrap, or select an undeclared width.

## Hash and evidence boundaries

- Core field provenance fingerprints cover reconstructed canonical logical values.
- Manifest SHA-256 entries cover exact authoritative file bytes.
- `canonicalAspectBytes` frames the external aspect JSON and its referenced chunks with
  `MWASPCT2`, owned-file count, and per-file path/content lengths.
- `canonicalAspectOutputBytes` uses `MWASOUT2`, the synthetic `$accepted-output.json`, and the same
  chunks.
- Fixture-integrity hashes cover checked-in evidence only.

The exact evidence framing is defined by ADR-0027. Implementations may stream it but cannot omit
path or length framing.

## Limits and decode order

The unchanged native bounds are 256 package entries including `manifest.json`, eight relative-path
components, 1,024 UTF-8 bytes per relative path, 255 UTF-8 bytes per basename, 134,217,728 bytes per
entry, and 201,326,592 aggregate bytes including the manifest. All are enforced before allocation
and before native staging.

Decode validates, in order: manifest version/compatibility; ordered unique authoritative set;
exact-byte checksums; world/map schemas; external references and aspect schemas; chunk header,
reserved bytes, encoding, count, payload length, dictionary, values, and logical fingerprint; then
core aspect/document invariants. Only then does it expose a deeply readonly document. Reader
reconstruction imports no generator and exposes no backing buffer.

Name and placement reconstruction additionally verifies derived aspect IDs and requires every
placement to reference the exact same-map name owner, entity, revision, and display text. Missing,
duplicate, stale, cross-map, mixed-pack, reordered, generic, inline, or undeclared owners fail
before any accepted document is exposed.

## Migration, rollback, and recovery

Opening v1 is read-only compatibility, not automatic migration. An explicit M3 acceptance creates
a complete v2 candidate from the preserved v1 logical state plus new strict M3 owners, validates it
through v2 encode/decode, then invokes unchanged ADR-0008 replacement with exact old/new manifest
fingerprints. No file is converted in place.

ADR-0008 roles, marker schema, P00–P17 operations, commit points, result codes, confirmations, and
cleanup rules do not change. Each `T`, `W`, or `B` role is valid only when its manifest-dispatched
v1 or v2 package and every declared data file validate. A partial or corrupt chunk makes the whole
candidate invalid; recovery never regenerates or repairs it.

Native readback recognizes the existing v1 `maps/` tree plus only the v2
`data/<map-id>/{aspects,fields}/` directory grammar. This closes the v2 read-after-write gap without
changing recovery roles, markers, commit points, policy, limits, or protocol versions; other nested
directory shapes remain invalid.

## Complete M3 measurement evidence

Issue 151's macOS receipt is checked in at
[`investigations/issue-151/macos-results.json`](investigations/issue-151/macos-results.json), with
reproduction instructions in [`investigations/issue-151/README.md`](investigations/issue-151/README.md).
The measured candidate contains all nine physical aspects and fields, 13 accepted names including
one manual override, 13 accepted placements, and one regional inherited-context snapshot. Two
fresh encode/decode runs produced identical package bytes, manifest checksums, physical
fingerprints, label state, context checksum, file order, framed evidence, and decoded counts with
zero generator calls during decode. The 134,820,435-byte package and its largest 82,288,604-byte
entry remain inside the unchanged native limits. Linux corroboration remains a pre-release gate,
as recorded by the receipt; it is not an implementation blocker.
