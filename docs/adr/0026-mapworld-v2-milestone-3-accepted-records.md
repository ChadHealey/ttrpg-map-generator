# ADR-0026 — `.mapworld` v2 for Milestone 3 Accepted Records

- **Status:** Accepted
- **Date:** 2026-08-30
- **Decision owners:** Project maintainers
- **Supersedes:** None
- **Superseded by:** None
- **Resolves:** [Issue #133](https://github.com/ChadHealey/ttrpg-map-generator/issues/133)

## Context

The released `.mapworld` v1 package is a strict, canonical JSON format. Its manifest, world
index, map documents, and accepted aspects all use version `1` and declare application support
from `0.1.0` through `<0.2.0`. The v1 accepted-aspect union has exact arms for the M1 proof and
M2 atlas records, but its generic arm permits other aspect names. M2 could remain v1 because no
released M2 save predated its strict arms.

Milestone 3 now adds durable accepted records that a `0.1.x` reader cannot safely understand:

- the nine ADR-0022 physical-context aspects and their full-profile field provenance;
- ADR-0024 `worldFeature.nameContent` records, including manual overrides;
- ADR-0025 `label.placement` records and their pinned glyph-pack reference; and
- the ADR-0023 footprint and clipped inherited-context snapshot, collar, portals, lineage, and
  checksum for a regional child.

The latter belongs structurally to a regional map's parent relationship; it is not disposable
render state or a generic accepted payload. The existing `RegionalMapParent.contextStatusAspectId`
is already the cross-map invalidation boundary, but v1 has no strict snapshot record attached to
that parent relationship.

ADR-0007 requires old accepted state to reopen without generation, and ADR-0008 requires an
interrupted replacement to recover either a complete prior package or a complete validated
candidate. ADR-0022 permits no implicit data chunk and requires a representative serialization
measurement before production persistence writes full-profile M3 records.

## Decision drivers

- Make an M3 package reject in a v1 reader at the manifest boundary, before any generic aspect can
  be reconstructed.
- Preserve exact v1 bytes and generator-free reopen for M1 and M2 packages.
- Give every M3 authoritative record a strict schema owner without turning fields into generic
  canonical JSON.
- Keep the established canonical JSON, checksum, and atomic-recovery protocol unless measured
  evidence requires a separate storage decision.
- Preserve a regional child's accepted context independently of later parent generation or edits.

## Options considered

### Option A — Add M3 strict arms to package v1

This would follow the M2 extension pattern, but an already-shipped v1 reader can accept an unknown
M3 aspect through its generic arm before later document validation rejects a mixed atlas. Its
manifest would still claim `0.1.x` compatibility, producing the wrong failure boundary and no
durable contract for the new regional parent fields. Rejected.

### Option B — Add canonical JSON package v2 with strict M3 records

Keep the package directory, canonical JSON rules, manifest checksums, and recovery protocol, but
add a manifest-dispatched v2 reader/writer and strict record variants. A v1 package remains
unchanged; an M3 save is an explicit v2 package. Selected.

### Option C — Add a binary `data/` chunk now

This could reduce field-array size, but no representative M3 serialization measurement exists.
It would add chunk/checksum/migration/recovery behavior before evidence justifies it. Rejected;
the measurement gate below can create a separate discovery issue.

## Decision

### Version and file ownership

M3 accepted packages use these values:

| Contract or file                           | Version / owner            | M3 responsibility                                                                                                          |
| ------------------------------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `manifest.json` package and package schema | `2`                        | Dispatch v1 versus v2 before map or aspect decoding; retain authoritative-file checksums and `recovery: { mode: "none" }`. |
| Manifest application compatibility         | `>=0.2.0`, `<0.3.0`        | A v2 writer is released only with an application in that range. A v1 reader rejects the package as incompatible.           |
| `world.json`                               | world-index schema `1`     | No new M3 world-index field; root/map ownership remains in the existing index.                                             |
| `maps/<world-map-id>.json`                 | map-document schema `2`    | Holds the root map's strict accepted-aspect v2 records.                                                                    |
| `maps/<regional-map-id>.json`              | map-document schema `2`    | Adds the strict `parent.inheritedContext` record alongside the existing parent IDs and `contextStatusAspectId`.            |
| Every accepted aspect in a v2 map          | accepted-aspect schema `2` | Uses strict M1/M2 compatibility arms or strict M3 arms; a known M3 aspect cannot use the generic arm.                      |

`parent.inheritedContext` is the single authoritative record for the selected
`regional-rectangle-v1` footprint, explicit transform/radius, source lineage and aspect versions,
clipped field and vector context, padded collar, ordered boundary portals, named-anchor records,
and snapshot checksum. It duplicates none of those values as map decoration or a renderer cache.
The regional context-status aspect remains the dependency/invalidation node; its accepted output
reports only status/provenance required by the core transaction contract and does not replace the
snapshot.

The strict v2 accepted-aspect catalogue contains exact arms for the existing M1/M2 records, the
nine `WorldPhysicalContextAspectKind` values declared in
`world-physical-context-aspects.ts`, `worldFeature.nameContent`, and `label.placement`. The
`worldFeature.nameContent` arm preserves source entity ID, name kind, behavior and lexicon
versions, variant revision, origin, display name, and comparison key. The `label.placement` arm
preserves accepted placement identity, source links, resolved integer metrics/origins, ordering,
and the ADR-0025 pinned glyph-pack reference/fingerprint. Each field is lossless and already
canonical; no decode path normalizes coordinates, text, fields, or ordering.

The v2 map-document schema keeps the v1 root and regional map shapes where unchanged. It adds only
the required regional `parent.inheritedContext` record. Any future new map-level field needs its
own map-document version decision; it must not be placed in the generic aspect arm.

### Read, write, migration, and rollback

The persistence boundary dispatches by the manifest before decoding records:

1. A v1 package continues through the v1 schemas and reconstructs its existing M1 or M2 accepted
   document without generators, selectors, renderers, defaults, or byte rewriting.
2. A v2 package uses only v2 schemas. Unknown package, record, aspect, footprint, context, or
   transform versions fail with `persistence.version.incompatible` before any accepted document is
   exposed.
3. Opening v1 in a v2-capable application is read-only compatibility, not automatic migration.
   An explicit user action that accepts M3 records writes a complete v2 candidate; it never edits
   v1 files in place or silently changes their canonical bytes.
4. A v2 package cannot be opened by a v1 application. The v1 manifest parser rejects it before a
   generic v1 aspect parser or document reconstruction runs.
5. The candidate must pass v2 encode, exact canonical-byte validation, checksum validation, and
   v2 decode before ADR-0008 replacement begins. Before its commit point the v1 target remains
   intact. After an interrupted replacement, ADR-0008 selects only a complete valid v1 or v2
   package by the recorded manifest fingerprint; it never exposes a partially migrated document.

There is no semantic in-place migration of an already accepted v1 record. The explicit v2 writer
copies accepted values into the v2 schema and changes only documented envelope/version fields and
their resulting canonical checksums. Returning to a prior accepted v1 state means selecting the
preserved valid v1 package or the recovery-selected backup; an older v1 application does not try to
read v2 bytes.

### Serialization measurement gates

Before #138 adds production physical/context v2 persistence, it must serialize a fixed,
representative world with all nine physical aspects and at least one seam/pole regional
inherited-context snapshot. On the documented macOS and Linux reference environments it records:

- complete package and individual authoritative-file byte sizes;
- repeated v2 encode and generator-free decode wall time;
- peak process memory during encode and decode; and
- repeated canonical-byte and SHA-256 equality, including the inherited-context checksum.

The measurement must use checked-in, non-private fixtures and report the exact command, machine
configuration, package bytes, and observations. It is not a pass/fail performance budget invented
by this ADR: the existing 128 MiB per-file and 192 MiB package native transport limits remain hard
adapter limits. If the representative package exceeds either limit, cannot complete without
unbounded memory, or demonstrates unacceptable project workflow latency that the maintainers
cannot accept from the recorded evidence, #138 stops. A separate storage-format discovery issue
must then compare a versioned binary chunk with canonical JSON and specify its checksums,
migration, rollback, and ADR-0008 recovery behavior before code changes resume.

After #138, #140, and #141 complete, [#151](https://github.com/ChadHealey/ttrpg-map-generator/issues/151)
adds the strict v2 name-content and label-placement arms and repeats this matrix for a complete M3
fixture. That fixture includes required names and a dense accepted placement set. This ordered
second measurement prevents #138 from depending on #140 while still establishing complete-M3
evidence before a label-capable package is treated as released.

## Consequences

### Positive

- Old applications fail deterministically at the package boundary instead of ambiguously accepting
  generic M3 data.
- M1/M2 fixture bytes and generator-free reopen remain stable.
- M3 semantic fields, user names, label placement, and child context have explicit persistence
  ownership and a strict validation path.
- Canonical JSON and native recovery stay unchanged until measurement shows a real need.

### Negative

- M3 implementation must support two schema families and add explicit v1-to-v2 fixture evidence.
- An M3 save is not readable by the released v1 application.
- The v2 writer cannot proceed if the representative measurement shows the existing transport
  limits are insufficient.

### Neutral or follow-up

- #138 owns the physical/context v2 persistence path, v1 compatibility fixtures,
  migration/recovery tests, physical-aspect integration, and `parent.inheritedContext` validation.
- #140 and #141 supply name-content and label-placement records. #151 persists those records and
  completes the M3-wide measurement; #142 only consumes accepted placement through renderer/export
  contracts.
- A later data-chunk proposal must be a separate discovery issue, not an extension of #138.

## Compatibility and migration

- **Accepted world documents:** v1 M1 and M2 documents remain valid and generator-free. v2 M3
  documents contain the strict additional records above; partial M3 graphs are invalid.
- **Persisted schemas and migrations:** package/schema, map-document, and accepted-aspect versions
  become `2` for a v2 package; world-index remains `1`. The only authorized transition is explicit
  v1-to-v2 candidate creation under the atomic replacement protocol.
- **Generator, seed, parameter, context, or style versions:** M3 aspect behavior and parameter
  versions remain independently versioned. Footprint shape/transform remains v1. Context source
  versions and checksum are persisted, never regenerated. Existing export-profile decisions remain
  separate from this package decision.
- **Canonical semantic/SVG/visual fixtures:** v1 fixtures are immutable baselines. #138 adds v2
  physical/context packages, v1-to-v2 compatibility fixtures, negative-version packages, and
  recovery fixtures. #151 adds name/label round trips and the complete-M3 measurement fixture.
  SVG/PNG v1 bytes remain label-free and unchanged.
- **macOS and Linux determinism:** both platforms must produce identical v2 canonical bytes,
  authoritative checksums, context checksums, and rejection diagnostics for the same fixtures.
- **Parent and child maps:** the regional map persists the exact footprint and inherited snapshot.
  Later parent changes can mark its context status stale but never replace the accepted child or
  snapshot automatically.

## Validation

The #138 implementation must prove:

1. unchanged v1 M1 and M2 fixtures decode generator-free and re-encode to their original v1 bytes;
2. a complete physical/context v2 package round-trips with exact canonical bytes and checksums;
3. v1 rejects v2 at `manifest.json`, while v2 rejects unknown future versions before domain
   reconstruction;
4. a missing, malformed, reordered, or generic-bypass physical/context M3 record fails before
   exposing accepted state;
5. explicit v1-to-v2 candidate creation preserves accepted semantics, and each ADR-0008
   interrupted-save/recovery case leaves a valid old or new package with no partial state; and
6. the physical/context representative serialization measurement satisfies the first gate above on
   both supported platforms.

#151 must then prove strict name-content and label-placement persistence, generator-free reopen
without text normalization or placement reflow, and the complete-M3 measurement gate on both
supported platforms.

## Revisit conditions

- A required M3 record cannot fit the strict v2 owners without a new coordinate, identity, or
  parent-context contract.
- Representative measurement requires a data chunk or changes to package limits/recovery.
- A later application release needs to read or write an incompatible v3 package.
- A future map kind needs a different parent-context model rather than the scale-generic regional
  relationship selected here.
