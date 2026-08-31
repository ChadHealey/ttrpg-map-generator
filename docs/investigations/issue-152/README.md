# Issue 152 — bounded `.mapworld` v2 storage

## Decision status

**Select external canonical aspect records plus versioned binary field chunks.** The macOS
measurement passes both existing transport limits with 64,484,170 bytes of package headroom and
51,732,853 bytes of per-file headroom. Canonical JSON files exceed the package limit by
188,864,252 bytes. Compact dictionary JSON fits, but leaves only 11,825,948 bytes before the
remaining inherited-context, name, and label records and has higher measured encode memory than
the binary option.

The storage decision and public contract are accepted in
[ADR-0027](../../adr/0027-mapworld-v2-external-aspects-and-binary-fields.md). The maintainers
accepted the reproducible macOS evidence after the dedicated C4 review findings were resolved and
explicitly deferred Linux corroboration until an environment is available. This deferral permits
implementation work but does not claim Linux evidence or permit platform-specific bytes; matching
Linux verification remains required before production v2 writer release. Production persistence
changes are not part of this discovery.

## Issue acceptance status

| Criterion                                                                                                                    | Status                 | Evidence or remaining work                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Representative macOS and Linux measurement, including the complete inherited-context fixture                                 | Accepted with deferral | macOS covers the immutable M2 atlas and every completed M3 physical producer. Linux verification is deferred until an environment exists; the supplied #144/#145 inherited-context fixture remains #138 evidence. |
| At least three authoritative-storage options compared                                                                        | Complete               | The same logical values were measured as binary chunks, separate canonical JSON files, and compact/dictionary JSON.                                                                                               |
| Selected option has quantified safety margin on macOS and Linux                                                              | Accepted with deferral | macOS has 64,484,170 package bytes and 51,732,853 per-file bytes of headroom. Matching Linux bytes remain a pre-release requirement, not an ADR blocker.                                                          |
| Exact ownership, schemas, versions, checksums, readers, unknown-version behavior, migration, rollback, and ADR-0008 recovery | Complete               | ADR-0027 and `docs/mapworld-v2.md` define the accepted contract; implementation proof belongs to the storage-codec child.                                                                                         |
| Owning docs and ordered child plan updated                                                                                   | Complete               | The repository docs and child drafts are updated. No live GitHub issue was created or mutated.                                                                                                                    |

## Representative source and lower bound

The source test runs the checked-in `milestone-2-atlas-proof` seed through the complete M2
full-profile producer using the accepted fixture's macro-elevation revision `1` and land/water
revision `0`. Before producing M3, it checks the generated M2 proposal envelope, parameters, seed
metadata, provenance, and complete field hashes against the exact accepted fixture. It then runs
the completed mountain, atmosphere, ecology, and hydrology producers and stages all nine M3
physical aspects and nine logical field components in a disposable directory. No staged bytes are
checked in and no generator runs during the measured decode.

The immutable accepted M2 map is 82,482,435 bytes. A JSON values array containing 2,095,106 UUIDs
needs at least 81,709,135 bytes: 38 bytes per quoted UUID, 2,095,105 separators, and two brackets.
The resulting 164,191,570-byte lower bound exceeds the 134,217,728-byte file cap by 29,973,842
bytes before indentation or any other M3 output.

## Options measured

All options use the same strict v2 map reference, one canonical JSON record per external M3 aspect,
the same manifest checksum coverage, and the same logical field values. This isolates the field
storage choice.

| Option                              | Package bytes | Package margin | Largest file | Encode elapsed, two runs | Decode elapsed, two runs |  Peak encode RSS |  Peak decode RSS | Result   |
| ----------------------------------- | ------------: | -------------: | -----------: | -----------------------: | -----------------------: | ---------------: | ---------------: | -------- |
| Versioned binary chunks             |   136,842,422 |     64,484,170 |   82,484,875 |         2,397 / 2,389 ms |         2,047 / 1,947 ms | 1,070 / 1,070 MB |     885 / 886 MB | Selected |
| Separate canonical JSON field files |   390,190,844 |   −188,864,252 |   92,184,771 |         2,874 / 2,908 ms |         2,756 / 2,813 ms | 1,217 / 1,217 MB | 1,487 / 1,488 MB | Rejected |
| Compact/dictionary JSON             |   189,500,644 |     11,825,948 |   82,484,875 |         2,608 / 2,625 ms |         2,299 / 2,267 ms | 1,454 / 1,454 MB | 1,028 / 1,028 MB | Rejected |

RSS values are each fresh child process's high-water resident set from
`process.resourceUsage().maxRSS`, converted from KiB to bytes. They include input loading and output
writing and are therefore conservative for the encode/decode phase. Times are evidence for
comparing these prototypes, not a new product budget.

Every repeated option produced identical authoritative bytes and package fingerprint. Every decode
reconstructed nine aspects and nine fields without generators and produced the same logical field
set fingerprint:

```text
598e92f5ba1bda4f55d891fccb37e751f76da14a44cbcb883102c15f78a47dc8
```

Exact host/toolchain data, per-file bytes, repeat times, RSS, and fingerprints are retained in
[`macos-results.json`](macos-results.json). Linux evidence is intentionally not recorded because no
environment is available; the deferred run must use the same source hashes.

## Reproduction commands

Run from the repository root with the pinned Node and pnpm versions:

```sh
node docs/investigations/issue-152/storage-measurement.mjs
```

That command prints the exact checked receipt schema. To write the platform receipt directly:

```sh
node docs/investigations/issue-152/storage-measurement.mjs \
  --output docs/investigations/issue-152/macos-results.json
```

To repeat only one option:

```sh
ISSUE_152_OPTION=binary-chunks node docs/investigations/issue-152/storage-measurement.mjs
ISSUE_152_OPTION=canonical-json-files node docs/investigations/issue-152/storage-measurement.mjs
ISSUE_152_OPTION=compact-dictionary-json node docs/investigations/issue-152/storage-measurement.mjs
```

The command creates one temporary source, runs each encode and decode twice in a fresh child
process, reads each child's own high-water RSS, emits the normalized receipt, and removes the
temporary tree. The receipt captures OS release, kernel without hostname, processor, logical CPU
count, memory, repository filesystem, toolchain, exact measurement-source hashes, every package
path/size/checksum, and both repeat observations. macOS adds `sw_vers` and model identifier; Linux
adds `/etc/os-release`'s distribution name. It records no hostname, username, serial number,
hardware UUID, or local absolute path.

The deferred Linux pre-release run must confirm:

- the two package fingerprints for each option repeat exactly within that Linux run;
- all three logical field fingerprints equal the value above;
- binary package/file bytes and checksums equal the macOS receipt;
- binary remains below both limits; and
- the same generator-free decode and strict version checks pass.

## Measurement boundaries

- The candidate package is a storage prototype, not a released fixture or production serializer.
- It reuses the immutable M2 world/map values, upgrades only the candidate envelope to v2, and adds
  external M3 aspect records and fields.
- The representative profile covers the complete producers available before #138. It does not
  invent a clipped inherited-context snapshot, name content, or label placement; the binary margin
  is reserved for those later records.
- Package fingerprints are ADR-0008 SHA-256 of exact canonical `manifest.json` bytes. A separate
  file-set fingerprint hashes the ordered path/length/checksum receipt; manifest entries hash exact
  authoritative file bytes. The logical field fingerprint hashes reconstructed values. None
  substitutes for fixture-integrity hashes.
- The prototype validates manifest dispatch and checksums before aspect/chunk decoding, validates
  exact JSON/binary versions and sizes, reconstructs values without generators, and rejects unknown
  versions. Production validation and recovery tests remain implementation-child work.

## Ordered implementation plan

1. **New storage-codec child before #138:** implement the ADR-0027 package-v2 manifest dispatch,
   external-aspect references, strict `.mwf` codec, project-owned reader reconstruction, canonical
   aspect/output evidence framing, size enforcement, and negative-version/checksum tests inside
   persistence/core. Recommended profile: C4, `gpt-5.6-sol` / high. Stop on a third package boundary,
   changed transport limit, or native protocol redesign.
2. **#138, re-authored against ADR-0027:** integrate the nine physical aspects into accepted atlas
   state, persist a supplied #144 inherited-context snapshot (building/clipping remains #145),
   implement explicit v1-to-v2 candidate creation, and prove rollback plus every ADR-0008
   fingerprint/recovery row using the codec child. Recommended profile remains C4,
   `gpt-5.6-sol` / high.
3. **#151, re-authored after #140/#141:** add strict name/label external records and repeat the
   complete-M3 macOS/Linux package measurement. Replace its obsolete “no binary/data chunk”
   constraint with “consume but do not redesign ADR-0027”; names and placements remain canonical
   JSON unless their own measured evidence requires a new decision.

These are plans only. This discovery does not create, close, or mutate GitHub issues.
