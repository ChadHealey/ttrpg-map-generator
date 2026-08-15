# 07 — Deterministic Fixture Conventions

This document owns the layout, provenance, integrity, update, and review rules for durable
generated fixtures. Canonical serialization and `.mapworld` authoritative-checksum semantics
remain owned by the persistence work; this document defines how fixture tooling consumes that
evidence without creating a second serializer or checksum contract.

The first consumer is the
[Milestone 1 kernel proof](milestone-1-kernel-proof.md). These conventions deliberately do not
create its golden files before the identity, coordinate, generator, transaction, and v1
persistence contracts can produce them.

## Commands

The repository exposes exactly two fixture operations:

```bash
pnpm test:cross-platform
pnpm fixtures:update -- --fixture <fixture-id> --review-record <path>
```

`test:cross-platform` is read-only. It validates the registry, provenance, review records, and
fixture-integrity hashes, then asks every registered fixture runner to regenerate into a
temporary location and compare its expected evidence byte-for-byte. The same command runs on
macOS and Linux.

`fixtures:update` targets exactly one registered fixture. It has no `--all`, glob, snapshot
`-u`, or implicit accept mode. The review record must be a newly added, append-only file for
that fixture. A fixture runner generates into a temporary directory, validates its output and
allowed file list, then replaces only the named fixture's generated paths. Run the read-only
command again before committing.

These commands are development evidence tooling, not a supported production CLI.

## Registry and layout

[`fixtures/registry.json`](../fixtures/registry.json) is the stable, explicitly ordered list of
durable fixture sets. Registry entries use an ASCII kebab-case `fixtureId` and identify one
generated manifest and one checked-in runner. Unregistered generated evidence is an error.

Use these locations:

```text
fixtures/
  registry.json
  fixed-seeds/
    <fixture-id>/
      fixture-definition.json
      fixture-runner.mjs
      expected/
        <checkpoint>/
          <aspect-name>.aspect.canonical
          <aspect-name>.output.canonical
      reviews/
        0001-initial-acceptance.md
  manifests/
    <fixture-id>.fixture.generated.json
  saved-projects/
    v1/
      <fixture-id>/
        <checkpoint>.mapworld/
  canonical-svg/
    <fixture-id>/
      <checkpoint>.svg
  visual-gallery/
    <fixture-id>/
      <checkpoint>.png
```

Only create evidence classes required by the fixture. `canonical-svg/` is needed when render
scene or SVG behavior is under review. `visual-gallery/` is reserved for reviewed images when
visual evidence enters scope; issue #53 does not add PNG regression infrastructure.

The Milestone 1 fixture ID is `milestone-1-kernel-proof`. Its checkpoint names are `baseline`,
`rerolled`, and `reopened`. Persist the `rerolled` project as the v1 saved-project fixture;
reopen assertions compare the decoded records with `rerolled` evidence rather than duplicating
an identical set of `reopened` golden files.

`fixture-definition.json` and review records are human-reviewed source. Files below
`expected/`, `manifests/*.fixture.generated.json`, saved-project packages, and canonical SVG or
visual evidence are generated. Never hand-edit generated files.

Each runner is a checked-in Node module invoked only by the shared orchestrator. It receives
`--fixture-id`, disposable read-only copies of the source definition and review record, the
fixture-relative review-record path, and an orchestrator-created `--output-root`. It writes a
complete candidate manifest and candidate artifacts below that output root and receives no
checked-in generated-evidence paths. Node filesystem permissions allow the runner to read the
repository but to write only inside its disposable candidate directory. The shared command
validates the candidate file allowlist and hashes, runs its assertions, and byte-compares or
installs it. A runner never accepts its own output.

## Generated manifest

Every registered set has a generated JSON manifest with `fixtureManifestVersion: 1`,
`generated: true`, and `editPolicy: "regenerate-only"`. It records:

- the fixture ID and exact targeted generating command;
- the source definition path and SHA-256;
- the world seed as a base-10 string;
- every stable world, map, entity, aspect, constraint, lock, and stable child ID relevant to
  the fixture;
- all relevant package/record schema, generator, parameter-schema, seed-derivation, transform,
  and style versions;
- aspect revisions at each named checkpoint;
- one or more structured expected assertions and a non-empty review purpose; assertion
  operators are `bytes-equal`, `bytes-not-equal`, and `runner-pass`, with artifact operands
  required for byte comparisons;
- the current append-only review-record path and SHA-256; and
- every generated artifact, sorted by POSIX repository-relative path, with its evidence kind,
  checkpoint and aspect ID when applicable, byte length, evidence-specific SHA-256 when
  applicable, and fixture-integrity SHA-256.

Do not record timestamps, absolute or temporary paths, operating-system names, locale output,
directory iteration order, or package-manager noise. Paths use `/` and artifact names are
case-distinct on both supported platforms. Generated JSON remains valid JSON and therefore has
no comment header; its filename plus the `generated` and `editPolicy` fields are the generated
file warning.

The verifier rejects symlinks in any path component, path traversal, duplicate or unsorted
artifact paths, case-colliding paths, evidence owned by another fixture, unregistered generated
trees, missing or extra candidate files, failed structured assertions, and hashes that do not
match the exact checked-in bytes.

## Three SHA-256 boundaries

All fixture digests use SHA-256 with lowercase hexadecimal output, but their names and inputs
must remain separate.

### Canonical aspect evidence

The v1 persistence serializer supplies `canonicalAspectBytes` for one complete accepted aspect
record and `canonicalAspectOutputBytes` for only its accepted output. Fixture tooling writes
the returned bytes unchanged and hashes those exact bytes. It does not prescribe their media
type, encoding, or newline policy, extract an aspect by parsing a containing map file, or
reserialize the value itself. Those canonical encoding decisions remain with issue #8.

Record aspect and output evidence separately for each required checkpoint. An output hash
proves that a reroll changed accepted output rather than only its revision metadata. An aspect
hash proves the complete accepted record. Neither hash is an authoritative-file checksum.
The generated manifest names these hashes `canonicalAspectSha256` and
`canonicalAspectOutputSha256`; canonical SVG uses `canonicalSvgSha256`. Their values equal the
fixture-integrity hash when both cover the same exact artifact, but the distinct field names
preserve their different review meanings.

### Authoritative `.mapworld` checksums

The saved package's `manifest.json` owns checksums for canonical authoritative files such as
`world.json`, sorted `maps/...`, and later `data/...`. Cache and preview paths are excluded.
Their exact coverage, path normalization, recursion handling, and compatibility behavior are a
v1 persistence decision owned by issue #8 and its ADR, not by fixture tooling.

Fixture verification asks the persistence implementation to validate these checksums. It does
not infer them from aspect hashes or invent a whole-package checksum.

### Fixture-integrity hashes

The generated fixture manifest records `fixtureIntegritySha256` for each generated artifact,
including the saved package's own `manifest.json`. These hashes detect a hand edit or stale
checked-in artifact. They are not semantic evidence or persisted authoritative checksums. The
generated fixture manifest does not hash itself; independent regeneration and comparison
protect it.

## Review records and safe updates

Review records are numbered, append-only Markdown files. Each record contains non-empty
sections with these exact headings:

```text
## Intended behavior
## Changed evidence
## Version and compatibility consequence
## Evidence reviewed
```

The record states why the change is intended, lists every generated artifact path allowed to
change, identifies the smallest truthful version consequence, and says whether
semantic, SVG, visual, and authoritative-file evidence were reviewed or were not applicable.
An explicit `none` consequence explains why canonical output and compatibility remain
unchanged. It also identifies unrelated aspects or accepted records that were confirmed
unchanged when isolation is part of the fixture.

`Changed evidence` contains only sorted Markdown bullets with fixture-relative generated
artifact paths, for example:

```text
- `fixed-seeds/milestone-1-kernel-proof/expected/baseline/proof-outline.aspect.canonical`
```

The generated manifest is expected to change because it records the new review; do not list
the manifest itself. The shared updater calculates added, changed, and removed artifacts and
requires an exact match with this list before it installs anything. It also generates and
compares the candidate twice before installation, refuses to overwrite a pre-existing path not
owned by the stored manifest, and retains rollback bytes through post-install validation.

The update command rejects an unknown fixture, a missing or existing edited review record, or
an update that affects more than the named fixture. The pre-commit staged-file check rejects
generated evidence from more than one fixture and requires a newly added review record for the
same fixture. It also rejects edits or deletion of historical review records and registry
removal until a dedicated reviewed fixture-retirement workflow is defined. CI regeneration
remains the final guard against editing an artifact and its hash together.

Never use Vitest snapshot update mode, a repository-wide golden rewrite, or a script that
accepts all current output. A fixture update is a reviewed compatibility operation, not a way
to make a failing check green.

## Evidence is reviewed separately

| Evidence                      | Review when                                                                                              | What it proves                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Semantic aspect/output bytes  | Generator, seed, identity, ordering, quantization, transaction, or accepted persistence behavior changes | Determinism, output change, isolation, and exact accepted state                |
| Authoritative files/checksums | Persistence encoding, package layout, schema, or checksum behavior changes                               | Exact saved authoritative content and package integrity                        |
| Canonical SVG                 | Render-scene adaptation, backend serialization/order, or SVG semantics change                            | Stable structural render output, not semantic determinism                      |
| Visual evidence               | A rendered proof, style, density, layout, or visible interaction changes                                 | Human-visible quality, expected reroll difference, and absence of reopen drift |

A failure in one class does not authorize updating another. A style-only visual change may
leave semantic evidence untouched. A persistence-only encoding change may require
authoritative-file review while decoded semantic aspect bytes remain identical. A rendered
change still needs semantic review when it also changes accepted world data.

For the Milestone 1 proof, visual review confirms that outline and markers are visible, the
marker reroll is visible, and reopen does not drift. Canonical semantic assertions—not SVG or
screenshots—prove deterministic generation, selective isolation, and restoration.
