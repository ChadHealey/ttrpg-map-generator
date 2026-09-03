# Issue 151 complete M3 `.mapworld` v2 evidence

This investigation measures a complete accepted M3 package containing all nine physical aspects
and logical fields, 13 accepted feature names, 13 accepted label placements, one manual name
override, and a regional map with supplied inherited context. It exercises strict external v2
owners, generator-free decode, canonical evidence framing, physical fingerprints, and the native
per-file and aggregate package limits.

## Reproduce on macOS

Use the repository-pinned Node.js and pnpm versions, then run:

```sh
node docs/investigations/issue-151/complete-m3-measurement.mjs --output
```

The harness launches each encode and decode in a fresh process, repeats the measurement twice, and
fails unless package files, checksums, framed aspect evidence, physical fingerprints, accepted
label state, inherited-context checksum, decoded counts, and limit decisions repeat exactly. The
decode process imports only core and persistence entry points and records zero generator calls.
Each encode also byte-compares a physical/context-only candidate with issue 138's checked-in file
inventory and manifest checksum.

## macOS result

The checked-in [`macos-results.json`](macos-results.json) receipt records the exact command, source
hashes, base commit, toolchain, host, timings, peak RSS, file inventory, canonical hashes, and
headroom calculations. On the recorded Apple M5 host with Node.js 24.11.0 and pnpm 11.19.0:

| Observation              | Result              |
| ------------------------ | ------------------- |
| Package bytes            | `134,820,435`       |
| Aggregate-limit headroom | `66,506,157` bytes  |
| Largest entry            | `82,288,604` bytes  |
| Per-file-limit headroom  | `51,929,124` bytes  |
| Authoritative files      | `48`                |
| External aspects         | `35`                |
| Decode generator calls   | `0` in both repeats |

The package remains within the unchanged 128 MiB per-file and 192 MiB aggregate native limits.

## Deferred Linux corroboration

Linux measurement is intentionally deferred until an appropriate environment is available. Before
the production v2 writer can ship, Linux must reproduce the canonical package bytes, checksums,
fingerprints, decoded state, counts, and limit results recorded here. Timing and RSS are
observations, not byte-compatibility criteria.
