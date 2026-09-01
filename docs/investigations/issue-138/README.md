# Issue 138 — accepted physical/context v2 measurement

## Result

The production `.mapworld` v2 codec passes the required representative macOS measurement for an
accepted M2 atlas, all nine accepted M3 physical aspects, all nine logical field components, and a
supplied contract-v1 south-pole inherited-context snapshot stored inline at
`parent.inheritedContext`.

Two fresh encode/decode observations produced the same canonical package entries, entry SHA-256
checksums, manifest checksum, framed aspect/output evidence, physical-field fingerprints, and
inherited-context semantic checksum. Both decodes reconstructed all nine physical aspects without
importing or invoking generation.

| Evidence                       |                                                             Result |
| ------------------------------ | -----------------------------------------------------------------: |
| Package bytes                  |                                                        134,746,661 |
| 192 MiB package-limit headroom |                                                         66,579,931 |
| Largest entry                  |                                                   82,279,962 bytes |
| 128 MiB entry-limit headroom   |                                                         51,937,766 |
| Encode elapsed, two runs       |                                                 31,341 / 32,663 ms |
| Decode elapsed, two runs       |                                                 15,562 / 15,877 ms |
| Peak encode RSS, two runs      |                                1,879,326,720 / 2,456,174,592 bytes |
| Peak decode RSS, two runs      |                                1,381,941,248 / 1,299,202,048 bytes |
| Manifest SHA-256               | `d4c51bee5745fa9bd3eb7f9516054c9377e35c6770b58459867166a76a5c9ef0` |
| Context semantic checksum      | `d6ea3051c08269c96536652b99c4eeb39183d205f51a9fbba0f9a6fb8495c9dc` |

The encode high-water RSS is deliberately conservative: each fresh encode process includes the
complete deterministic M2/M3 source generation needed to create the accepted in-memory candidate.
Each decode runs in a fresh process whose measurement test imports only core and persistence.

Exact host/toolchain data, every package path/size/checksum, all nine framed evidence records,
logical fingerprints, source hashes, timings, and peak-memory observations are retained in
[`macos-results.json`](macos-results.json). The measured host was Apple M5 arm64 on macOS 26.5.1
(`25F80`) with an APFS repository filesystem.

## Reproduction

From the repository root with the pinned Node and pnpm versions:

```sh
node docs/investigations/issue-138/physical-context-measurement.mjs --output
```

The harness creates disposable directories under the operating-system temporary directory, runs
two fresh production encode and generator-free decode children, compares their exact evidence,
writes the normalized receipt, and removes the disposable candidates. It never writes a partial
candidate to the repository.

## Deferred Linux gate

Matching Linux evidence remains explicitly deferred and required before production v2 writer
release. The Linux run must use the same checked measurement sources and confirm matching package
bytes, checksums, framed evidence, logical fingerprints, snapshot checksum, complete
generator-free reconstruction, and limit outcomes. This macOS result does not claim Linux
corroboration.
