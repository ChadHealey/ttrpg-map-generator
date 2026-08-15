# Milestone 1 kernel-proof contract

This document is the normative composition and comparison contract for the
[Milestone 1 deterministic kernel](PROJECT_PLAN.md#milestone-1--deterministic-kernel). It
resolves [issue #48](https://github.com/ChadHealey/ttrpg-map-generator/issues/48) for the
identity, generator, transaction, persistence, fixture, and end-to-end work that follows.

The proof is deliberately synthetic. Names beginning with `proof.` do not describe geography
and must not grow production landmass behavior, worker execution, editing controls, or new
reroll modes.

## Fixed composition

The fixture contains one world document, its root `WorldMap`, one owned proof entity, and no
`RegionalMap`. The persisted identity literals and inputs are fixed:

```yaml
worldDocumentId: 29646d87-2997-44f8-8b6d-7153f93e6e99
worldMapId: a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7
proofEntityId: c6f4a17b-dfaf-4dce-9904-9a900d300da4
worldSeed: '81985529216486895'
seedDerivationVersion: 1
proofInputExtent: 10000
proofInputToPlanetTransformId: proof-input-to-planet
proofInputToPlanetTransformVersion: 1
```

`worldSeed` is a base-10 unsigned-integer string so the fixture does not depend on the
JavaScript safe-integer range. `ProofInputCoordinate` is a project-owned, branded signed
32-bit integer used only by the synthetic generators. Its exact quantization step is `1`, its
canonical form is a base-10 integer with no fractional or negative-zero form, and its extent is
`(0, 0)` through `(10000, 10000)`, with `x` increasing rightward, `y` increasing upward, and
counterclockwise polygon winding.

`ProofInputCoordinate` is not accepted world geometry and is not interchangeable with a
planet-native, regional, screen, render, or print coordinate. The generator plan applies the
explicit, versioned `proof-input-to-planet` transform to produce the root `WorldMap`'s branded
`PlanetPoint` values. [Issue #49](https://github.com/ChadHealey/ttrpg-map-generator/issues/49)
owns the transform's topology, physical units, tolerances, and fixed validation vectors;
[issue #42](https://github.com/ChadHealey/ttrpg-map-generator/issues/42) owns its implementation
and canonical planet-native quantization. The accepted outline and marker outputs contain
only those quantized `PlanetPoint` values. The proof transform must select an extent that does
not cross a seam or touch a pole; #42 tests those topology cases separately.

The entity owns exactly these generated aspects:

| Field                    | Outline                                                            | Markers                                          |
| ------------------------ | ------------------------------------------------------------------ | ------------------------------------------------ |
| Aspect ID                | `54b92092-3d5f-4bca-a12c-353185de1557`                             | `42928679-db9b-4de2-a8d4-0baecd709cc9`           |
| Aspect name              | `proof.outline`                                                    | `proof.markers`                                  |
| Generator ID             | `proof.outline`                                                    | `proof.markers`                                  |
| Generator version        | `1`                                                                | `1`                                              |
| Parameter-schema version | `1`                                                                | `1`                                              |
| Seed scope               | map/entity                                                         | map/entity                                       |
| Initial variant revision | `0`                                                                | `0`                                              |
| Dependencies             | none                                                               | Aspect ID `54b92092-3d5f-4bca-a12c-353185de1557` |
| Parameters               | `pointCount: 8`, `insetPermille: 120`, `radialJitterPermille: 180` | `markerCount: 9`, `edgeClearancePermille: 40`    |

`proof.outline` produces one closed, simple, counterclockwise polygon owned by the proof entity.
`proof.markers` produces nine point placements strictly inside that accepted polygon. Marker
identities derive from the proof entity and fixed semantic keys `marker-000` through
`marker-008`; rerolling changes their positions while retaining the same nine identities,
count, and canonical ID order. Names such as `proof.outline` are labels; every canonical
dependency or target reference encodes the fixed opaque aspect ID.

The fixture also contains a fixed constraint targeting the outline and a fixed lock retaining
the accepted outline. Their final schemas and encoded ID grammar belong to the identity and
document-model work, but their fixture identities, target, and intent are fixed here:

```yaml
constraintId: ac35a7ae-3f2c-4433-9351-e23d52c65870
constraintKind: proof.keep-within-extent
constraintTargetAspectId: 54b92092-3d5f-4bca-a12c-353185de1557
lockId: 1562f399-119d-4702-aafd-66349098c85f
lockTargetAspectId: 54b92092-3d5f-4bca-a12c-353185de1557
```

These records are intentionally inert during the marker reroll. They exist so isolation is
proved for accepted user intent as well as generated output.

## Required operation

The only demonstrated reroll is `proof.markers` revision `0 -> 1`.

1. Address the root map, proof entity, and `proof.markers` aspect by stable ID.
2. Require expected previous revision `0`.
3. Keep the world seed, generator and parameter versions, parameters, seed scope, dependency,
   and accepted outline unchanged.
4. Derive the marker stream for revision `1`, generate and validate a replacement proposal,
   then commit it atomically through the document transaction boundary.
5. Do not select or implicitly regenerate a dependent. The selected aspect has no dependent in
   this composition.

For the fixed inputs, revision `1` marker positions and canonical accepted-output bytes must
differ from revision `0`; a revision-metadata difference alone does not pass. Repeating the
revision `1` proposal from the same accepted inputs must reproduce the same output bytes. The
command increments only the selected aspect revision; it does not mutate a generator-owned
document or advance a shared sequential random stream.

## Canonical comparison boundary

`canonicalAspectBytes` means the canonical encoding of one complete accepted aspect record,
not its containing entity, map file, or package. The record includes:

- map, entity, and aspect identity;
- aspect name, generator ID, generator version, and parameter-schema version;
- canonical parameters, seed scope and seed metadata, and variant revision;
- stable dependency references, generation status, and accepted diagnostics;
- the accepted canonical output, including stable child identities and ordering.

`canonicalAspectOutputBytes` encodes only that accepted output. It excludes aspect metadata,
especially `variantRevision`, so it separately proves that the selected placements changed.

The canonical serializer and quantization rules are owned by the `.mapworld` v1 work. They
must provide this per-record encoding in addition to authoritative-file encoding. Caches,
render nodes, viewport state, timestamps, object addresses, and collection insertion order
are never part of canonical aspect bytes.

Use three named checkpoints:

- `baseline`: both aspects accepted at revision `0`;
- `rerolled`: only `proof.markers` accepted at revision `1`;
- `reopened`: the `rerolled` world document decoded from the saved `.mapworld` package.

| Compared evidence                                                                    | Required result |
| ------------------------------------------------------------------------------------ | --------------- |
| Repeated `baseline` outline bytes                                                    | identical       |
| Repeated `baseline` marker bytes                                                     | identical       |
| `baseline` vs. `rerolled` outline bytes and revision                                 | identical       |
| `baseline` vs. `rerolled` marker bytes                                               | different       |
| `baseline` vs. `rerolled` marker output bytes                                        | different       |
| Repeated revision `1` marker proposals                                               | identical       |
| Repeated revision `1` marker output bytes                                            | identical       |
| `rerolled` vs. `reopened` outline bytes                                              | identical       |
| `rerolled` vs. `reopened` marker bytes                                               | identical       |
| `baseline` vs. `reopened` outline bytes                                              | identical       |
| Constraint, lock, ownership, and all other accepted-record bytes at every checkpoint | identical       |

Across both marker revisions, marker IDs, count, and canonical ID order are identical even
though positions and accepted-output bytes differ.

The containing map JSON, `manifest.json`, authoritative-file checksum, package checksum, and
selected marker-aspect bytes are permitted to change after the reroll. An assertion that
compares any of those values as though it were an unrelated-aspect byte assertion is invalid.

The transaction boundary is therefore explicit:

| Permitted to change                                              | Forbidden to change                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `proof.markers` accepted output and variant revision             | `proof.outline` output, metadata, or revision                                  |
| Containing map/package bytes and affected checksums              | World, map, entity, aspect, constraint, and lock identities                    |
| Disposable render scenes and caches derived after commit         | Generator/seed/parameter versions, parameters, seed scope, or dependency edges |
| Visible marker render nodes derived from the new accepted output | Constraint, lock, ownership, or any other unselected accepted-record bytes     |

Loading must expose the accepted `reopened` records without invoking either proof generator.
Tests must make generator invocation during decode observable and fail if it occurs.

## Visible workflow and render boundary

The thin desktop or development-harness proof must let a reviewer:

1. accept the fixed seed (with the fixture seed as the default) and generate `baseline`;
2. see the outline and markers through the shared `RenderScene` path;
3. inspect both aspect revisions and canonical evidence;
4. invoke an explicitly labelled **Reroll markers** action;
5. save, close, and reopen the minimal `.mapworld` package; and
6. see the restored composition and passing isolation/reopen evidence.

The scene adapter emits the outline as a `RenderPolygon` and each marker using existing
render-scene primitives in stable marker-ID order. Render nodes retain the proof entity as
their source. The adapter maps the accepted, quantized `PlanetPoint` outline and marker
coordinates to render pixels; generator-only `ProofInputCoordinate` values and their transform
are never render inputs. The scene and render mapping are disposable derived data: neither is
accepted aspect output or persistence proof. Canvas and SVG continue to consume the same scene
semantics.

Visual review confirms that both aspects appear, the marker reroll is visible, and reopen does
not visibly drift. Canonical semantic assertions—not screenshots or SVG—prove determinism,
isolation, and restoration.

## Fixture and cross-platform evidence

macOS and Linux run the same checked-in input and expected canonical evidence through one
fixture command. The exact fixture directories, file names, hash algorithm, generated-file
headers, and update command are owned by
[issue #53](https://github.com/ChadHealey/ttrpg-map-generator/issues/53). That work must not
change the composition or comparison boundary above.

Any fixture update records the intended behavior change and its version consequence. Broad
snapshot updates and hand-edited generated evidence are forbidden.

## Downstream work

This contract is consumed by:

- [#49 — coordinate topology and quantization decision](https://github.com/ChadHealey/ttrpg-map-generator/issues/49);
- [#42 — coordinate and transform implementation](https://github.com/ChadHealey/ttrpg-map-generator/issues/42);
- [#5 — stable IDs, versions, and revisions](https://github.com/ChadHealey/ttrpg-map-generator/issues/5);
- [#43 — generator and aspect contracts](https://github.com/ChadHealey/ttrpg-map-generator/issues/43);
- [#45 — transactional selective rerolls](https://github.com/ChadHealey/ttrpg-map-generator/issues/45);
- [#8 — canonical `.mapworld` v1 persistence](https://github.com/ChadHealey/ttrpg-map-generator/issues/8);
- [#53 — deterministic fixture conventions](https://github.com/ChadHealey/ttrpg-map-generator/issues/53); and
- [#47 — the end-to-end Milestone 1 proof](https://github.com/ChadHealey/ttrpg-map-generator/issues/47).

Those issues may refine their owned types, algorithms, storage layout, and evidence tooling.
They may not weaken this proof, make render data authoritative, or broaden it into Milestone 2
geography.
