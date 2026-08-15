# 0002 — Zod for Milestone 1 Persistence Boundaries

- Date reviewed: 2026-08-15
- Scope: the `.mapworld` v1 read boundary owned by [issue #8](https://github.com/ChadHealey/ttrpg-map-generator/issues/8)
- Decision: adopt `zod` `4.4.3` as a direct runtime dependency of `@ttrpg-map/persistence` when #8 implements the boundary. This review does not add it.

## Capability and Milestone 1 schemas

The persistence boundary receives JSON parsed from files and is therefore `unknown`, even when
the package was written by an earlier version of this application. Zod supplies composable,
strict structural DTO validation and machine-readable issues before a value can enter the
domain. It does not replace the domain's parsers, canonicalization rules, ownership validation,
or checksum verification.

The #8 implementation must define project-owned Zod DTO schemas with these names and
responsibilities. `Dto` means a JSON-shaped value, not a core domain type.

| Schema                                                                                                           | Required Milestone 1 validation                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mapworldManifestDtoSchema`                                                                                      | Exact package/schema versions and compatibility range; canonical authoritative file paths; SHA-256 checksums; and only the recovery metadata supported by v1. It must reject duplicate paths and entries outside the declared authoritative set.                                                                                                                                                                                     |
| `worldIndexDtoSchema`                                                                                            | Canonical world-document ID, canonical decimal `worldSeed`, root map ID, and the complete declared map-file index. It must not treat a display name or array position as an identity.                                                                                                                                                                                                                                                |
| `mapDocumentDtoSchema`                                                                                           | A strict discriminated union for `world` and `regional` map kinds, with scale class, map ID, display name, coordinate-system DTO, extent DTO, entities, accepted aspects, constraints, locks, decoration, and layout. The regional arm additionally requires its parent record and versioned transform fields.                                                                                                                       |
| `acceptedAspectDtoSchema`                                                                                        | Accepted address, descriptive aspect name, generator and parameter-schema versions, seed scope and `seedMetadata`, revision, dependency references/provenance, accepted diagnostics, and an accepted output. It accepts only `generationStatus: 'accepted'`; proposed or invalid records cannot be loaded as accepted work.                                                                                                          |
| `seedInputDtoSchema`                                                                                             | Strict `map/entity`, `root-coordinate`, and `shared-boundary` discriminated arms. World seeds remain canonical base-10 strings; versions and revisions are safe integers; IDs, symbolic labels, and coordinate ticks are not coerced or normalized.                                                                                                                                                                                  |
| `proofAcceptedOutputDtoSchema`                                                                                   | A discriminated union keyed by the fixed M1 proof aspect IDs/names: `proof.outline` has an ordered closed `PlanetPoint` polygon, while `proof.markers` has exactly the stable marker IDs and ordered `PlanetPoint` placements. Its parameter DTOs enforce the fixed proof values from the [kernel-proof contract](../milestone-1-kernel-proof.md). A generic `unknown` accepted output is insufficient at this persistence boundary. |
| `aspectReferenceDtoSchema`, `constraintDtoSchema`, `lockDtoSchema`, `decorationDtoSchema`, and `layoutDtoSchema` | Canonical opaque IDs and explicit reference arrays. Constraint and lock targets must address accepted aspect IDs, never labels.                                                                                                                                                                                                                                                                                                      |
| `planetPointDtoSchema`, `regionalExtentDtoSchema`, `worldRadiusDtoSchema`, and `diagnosticDtoSchema`             | JSON primitives only: safe integer ticks/millimetres without `-0`; explicit units; bounded symbolic diagnostic code and severity; and complete actionable diagnostic text.                                                                                                                                                                                                                                                           |

The parser must use strict object schemas at every persisted-record boundary, reject unknown
required-record fields rather than silently discard them, and never use coercion, defaults,
transforms, locale-aware operations, or implicit date handling. Forward compatibility is an
explicit schema-version/migration decision, not a permissive object parser.

After structural validation, #8 must separately verify package file names and checksums, map
index completeness, unique IDs, map/root/parent relationships, aspect ownership and dependency
references, proof-specific geometric invariants, and canonical collection ordering. The
existing core parsers remain the source of truth for stable IDs, symbolic labels, coordinate
values, seed inputs, and version values; `validateWorldDocumentOwnership` and the dependency
graph remain the source of truth for cross-record domain invariants.

## DTO-to-domain adapter

The adapter boundary is one-way and project-owned:

```text
JSON bytes -> JSON.parse(): unknown -> Zod DTO schemas -> package/reference checks
  -> core parsers + domain invariant checks -> newly built, deep-readonly WorldDocument
```

`decodeMapworld` must return a project-owned result such as
`PersistenceResult<Readonly<WorldDocument>>`, not `z.infer` or a Zod schema. It must construct
new domain records, call the existing `parseStableId`, symbolic-value, coordinate, seed-input,
and compatibility parsers for every branded primitive, and freeze arrays and records before
exposing them. The conversion must preserve canonical textual values exactly: it cannot repair
uppercase UUIDs, re-quantize geometry, reorder a received collection, replace unknown data with
a default, or invoke a generator. Zod errors are translated at this adapter to stable
persistence diagnostic codes with a file and field path; user-facing code must not match Zod's
human-readable messages.

The reverse serializer takes only readonly project-owned domain records, produces separately
owned DTO values in declared canonical key and collection order, then serializes them. Zod
schemas, inferred DTO types, parse results, and `ZodError` instances stay private to
`@ttrpg-map/persistence`; `core`, `generation`, `render`, and the desktop UI do not import Zod.

## Alternatives considered

| Option                                                                       | Benefits                                                                                                                                                                            | Reason not selected for this boundary                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Small project-owned validator                                                | No dependency and total control over diagnostics and canonical checks.                                                                                                              | The M1 package needs a strict nested discriminated-union grammar, recursive record validation, issue paths, migration entry points, and adversarial-input tests. Rebuilding that generic structural layer would be more code and maintenance than the domain-specific checks the project must own anyway. |
| [Valibot 1.4.2](https://www.npmjs.com/package/valibot/v/1.4.2)               | Maintained MIT alternative with no runtime dependencies and a smaller published unpacked package (1.84 MB). It declares TypeScript `>=5`, which fits this workspace's TypeScript 6. | Credible, but would introduce a different validation DSL from the project plan's named Zod choice. Its size advantage is not yet measured in this application's production persistence chunk. Keep it as the reassessment candidate if that measurement misses the #8 budget.                             |
| [TypeBox 0.34.52](https://www.npmjs.com/package/@sinclair/typebox/v/0.34.52) | Actively maintained schema-first alternative with no runtime dependencies.                                                                                                          | Its JSON-Schema/compiler-oriented approach adds a less direct fit for the small, handwritten persistence DTO grammar. Its npm metadata says MIT while GitHub's current license detection is `NOASSERTION`, so a future adoption would first need a source-license review.                                 |

## Maintenance, license, runtime, and compatibility evidence

At review time, [Zod 4.4.3](https://www.npmjs.com/package/zod/v/4.4.3) was the current stable
release, published 2026-05-04; its repository had a current release and commits on 2026-08-15.
It is MIT-licensed, compatible with this private `UNLICENSED` workspace, and publishes its own
TypeScript declarations. The package declares no Node engine, peer, or runtime dependencies in
the npm metadata. That makes the proposed direct resolution dependency-only: Zod 4.4.3 adds no
production transitive packages and does not require a native build or system library.

The workspace currently uses Node 24.11.0 and TypeScript 6.0.2. Zod's published metadata has
no TypeScript peer range, so #8 must prove the exact resolution with `pnpm typecheck` rather
than treating this review as a compatibility guarantee. The dependency must be an exact version,
not a range, because the workspace policy requires reproducible lockfile resolutions.

The Zod tarball reports a 4.56 MB unpacked package. That is package distribution size, not a
bundled or compressed application cost. It will run only on persistence reads/writes and must
not be imported by deterministic generation or rendering modules. #8 must measure the desktop
production bundle after adding its actual imports, record the persistence-chunk change in its
issue evidence, and reconsider Valibot only if that measured cost is material. No current
lockfile entry provides Zod; its only AJV entry is transitive tooling and is not an available
application validator.

Sources consulted on 2026-08-15:

- [Zod npm package metadata](https://www.npmjs.com/package/zod/v/4.4.3), [release v4.4.3](https://github.com/colinhacks/zod/releases/tag/v4.4.3), and [MIT license](https://github.com/colinhacks/zod/blob/main/LICENSE)
- [Valibot npm package metadata](https://www.npmjs.com/package/valibot/v/1.4.2) and [release v1.4.2](https://github.com/open-circle/valibot/releases/tag/v1.4.2)
- [TypeBox npm package metadata](https://www.npmjs.com/package/@sinclair/typebox/v/0.34.52) and [repository metadata](https://github.com/sinclairzx81/typebox)

## Determinism and containment

Zod does not generate or canonicalize output. Its risk is accidental input transformation:
coercion, defaults, and schema transforms could silently change persisted bytes or accept a
noncanonical encoding. The required strict, validation-only schemas and DTO-to-domain adapter
eliminate that risk. Validation failures must leave the previous accepted package untouched;
load never calls a generator, advances a random stream, reads a clock, or applies a dependency
upgrade.

Zod may validate structural shape at the persistence adapter only. It cannot decide geometry
validity, stable ordering, checksum inputs, seed derivation, canonical serialization, aspect
invalidation, or the meaning of a lock. Those decisions stay in project-owned `core` and
`persistence` code and are covered by the fixed-seed, save/reopen, corrupted-package, and
canonical-byte tests required by #8. A Zod upgrade is output-sensitive boundary work: review its
release notes and rerun the relevant fixed-seed, persistence, and cross-platform fixtures before
adoption.

## Adoption plan for issue #8

This issue deliberately makes no package or lockfile change. When #8 begins its persistence
implementation, make one focused dependency commit before schema implementation:

```text
build(persist): add zod 4.4.3 for mapworld validation

Refs #8
```

That commit changes only `packages/persistence/package.json`, adding the exact production
dependency `"zod": "4.4.3"`, and `pnpm-lock.yaml`. It runs `pnpm install --filter
@ttrpg-map/persistence`, verifies `pnpm typecheck`, and does not upgrade any existing package.
The subsequent #8 commits implement and test the v1 DTO schemas and adapter, canonical
serializer and checksums, fixtures, and bundle measurement described above. Any later Zod
version change repeats this review's maintenance, license, transitive, deterministic, and
measured bundle checks.

## Issue #8 measured production impact

Issue #8 adopted exact `zod` `4.4.3` in commit `3a40f07`. On 2026-08-15, the current desktop
production control build was 51,600 bytes minified JavaScript and 19,870 bytes gzip; persistence was
not yet reachable from that UI entry and was correctly tree-shaken out.

The implemented persistence public entry was therefore measured directly with the same installed
Rolldown 1.2.4 production bundler and minification, with `@ttrpg-map/core` external in both cases.
Bundling Zod produced 102,927 bytes minified and 27,912 bytes gzip. Treating only Zod as external
produced 36,817 bytes minified and 10,544 bytes gzip. The measured Zod contribution is therefore
66,110 minified bytes and 17,368 gzip bytes. Commands used no source maps and gzip level 9.

The relative increase is visible because the current desktop proof is intentionally small, but the
absolute 17,368-byte compressed boundary cost is modest, adds no runtime transitive or native
dependency, and remains outside generation and rendering. Valibot was reconsidered as required; its
smaller potential bundle does not outweigh replacing the accepted validation DSL before a real load
latency or application-size budget is missed. Reassess if persistence becomes an eager startup chunk
or this measured contribution prevents a declared bundle target.
