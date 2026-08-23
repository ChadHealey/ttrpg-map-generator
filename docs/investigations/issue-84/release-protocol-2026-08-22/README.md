# Issue 84 Apple M5 release-protocol evidence

- **Status:** STOPPED — first measured fresh-process preview exceeded the unchanged wall-clock
  limit
- **Measured:** 2026-08-22
- **Candidate commit:** `ba10bc4a2902cb8c56137bc90b44fe3764bf02a7`
- **CI-tested implementation commit:** `713dc1039f59cd18864be6581b0d603adb2072c1`
- **Packaged executable SHA-256:**
  `931235e8a989a3980533c7ba5387ba3622520762f3a05ae551856eb6eec116ee`
- **Structured result:** [raw-results.json](raw-results.json)
- **Exact sanitized observer receipts:**
  [warm-up](observer-receipt-proof-warmup.json) and
  [proof fresh process 1](observer-receipt-proof-fresh-1.json)

The candidate commit adds only the issue #71 evidence report above the CI-tested implementation
commit. The observer-enabled unsigned release bundle was built from the exact candidate after its
required local gates passed. No production behavior, schema, fixture, workload, hardware, or
numeric budget changed.

## Host, build, and observer

The run used MacBook Pro `Mac17,2`, Apple M5, 10 cores, 24 GB unified memory, macOS 26.5.1
(`25F80`), AC power, and Low Power Mode off. Toolchain versions were Node 24.11.0, pnpm 11.19.0,
and rustc 1.97.1. The packaged candidate had no debugger or development server attached and used
only packaged local assets.

The test-only dispatch was enabled only for the packaged qualification build:

```text
VITE_PACKAGED_PREVIEW_OBSERVER_DISPATCH=1 corepack pnpm \
  --filter @ttrpg-map/desktop tauri build --bundles app --no-sign --ci
```

The issue #90 observer and issue #76 sampler were compiled from the candidate tree. Their SHA-256
identities were, respectively,
`334f789791f919f368095227ee2853d0cb54c4bfea8949f904e4ae8fc970d2dc` and
`17b1b2ccdd693c3ab569e322b95d64d97f1bc2621c2930ea8e469d0124f9fbe5`.
The observer was invoked once per fresh packaged process using the documented command shape:

```text
/private/tmp/issue84-packaged-preview-observer \
  app.ttrpgmap.generator \
  931235e8a989a3980533c7ba5387ba3622520762f3a05ae551856eb6eec116ee \
  /private/tmp/issue84-rss-timeline \
  17b1b2ccdd693c3ab569e322b95d64d97f1bc2621c2930ea8e469d0124f9fbe5 \
  <fresh-private-raw-csv>
```

Each retained receipt qualified the same production preview request and presentation path with no
post-dispatch viewport manipulation. Both exact observer outputs record a complete changed 512 by
256 ScreenCaptureKit crop, bounded land and water palette populations, uninterrupted foreground
ownership, the final labelled-preview Accessibility state, four expected process roles, and exact
baseline/completion membership equality.

## Result and stop decision

The warm-up was observer-valid but was not a gated run. The first measured fresh process was also
observer-valid and exceeded the unchanged 750 ms limit. Its 118.80 MiB additional process-tree RSS
was below the 256 MiB limit.

| Run                   |   Elapsed | Baseline RSS |   Peak RSS | Additional RSS | Samples | Maximum interval | Result                |
| --------------------- | --------: | -----------: | ---------: | -------------: | ------: | ---------------: | --------------------- |
| Untimed warm-up       | 872.04 ms |   232.28 MiB | 544.14 MiB |     311.86 MiB |     143 |         6.741 ms | Not gated             |
| Proof fresh process 1 | 861.25 ms |   213.83 MiB | 332.62 MiB |     118.80 MiB |     141 |         6.506 ms | **FAIL — wall clock** |

Per-process peaks during the measured fresh-process interval were 107.06 MiB application,
38.92 MiB GPU, 15.13 MiB Networking, and 171.55 MiB WebContent. The independently timed process
peaks do not sum to the aggregate peak at one instant.

One failed run fails the five-run gate. The issue #84 stop condition therefore prohibited running
the remaining four proof observations, either other gated fixture, full generation, SVG/PNG
exports, or cancellation trials. Median and five-run worst calculations are unavailable, and no
conclusion is recorded for the unrun rows. Release planning must decide a separately authorized
response before the unchanged protocol is rerun.

## Observer and private raw receipts

The exact sanitized JSON emitted by the observer is retained per observation:

| Receipt                       | SHA-256                                                            | Bytes |
| ----------------------------- | ------------------------------------------------------------------ | ----: |
| Untimed warm-up observer JSON | `5b311e272cf91b64349668df51529aea0a34b6b4832aaec0e37b8d93038a225e` | 1,105 |
| Proof fresh observer JSON     | `44f7f7bb31b246c9bd04c64417571fdf43a3ceb37fde4fc1c642d1289c949bf5` | 1,107 |

The PID-bearing sampler CSVs were held outside the public repository in ephemeral private
temporary storage during measurement. Dedicated review found that they had not been moved to an
approved durable private store and were no longer available. Their recorded identities are:

| Receipt                 | SHA-256                                                            |  Bytes |
| ----------------------- | ------------------------------------------------------------------ | -----: |
| Untimed warm-up CSV     | `b69a8023494505d435d13c871114f72048ae79729754ece4b50c41752bc047a8` | 17,462 |
| Proof fresh process CSV | `623d37e26f965d7df294ca4a545da420e767f10eed5038690cedd957588d0fa3` | 19,084 |

No raw capture pixels, PIDs, service UUIDs, coalition identifiers, executable paths, or
machine-specific local paths are committed. Because the raw CSV contents and durable private
locations cannot be re-audited, raw-artifact retention remains an explicit unmet evidence
limitation. The valid sanitized observer receipts remain authoritative for the stop decision; the
measurement was not rerun because that decision prohibited further protocol work. A future
authorized rerun must archive each raw CSV privately before its temporary copy is removed.

## Candidate gates

The exact measured candidate passed all required premeasurement checks:

| Command / check                         | Result                                                               |
| --------------------------------------- | -------------------------------------------------------------------- |
| Issue #90 observer core tests and build | **PASS**                                                             |
| Focused compact atlas reader            | **PASS** — 6 tests                                                   |
| `corepack pnpm check`                   | **PASS** — 71 TS/JS files, 552 passed, 1 skipped; 52 Rust tests      |
| `corepack pnpm test:cross-platform`     | **PASS (84.10 s)** — 8 fixture sets                                  |
| `corepack pnpm test:visual`             | **PASS (86.52 s)** — 13 tests and 8 fixture sets                     |
| `corepack pnpm test:png-export`         | **PASS (96.07 s)** — 68 TS/JS, 6 Rust unit, 4 Rust integration tests |
| `corepack pnpm test:e2e`                | **PASS (490.24 s)** — 22 TS/JS and 2 native workflow tests           |
| `corepack pnpm test:native-recovery`    | **PASS (242.40 s)** — 28 APFS tests                                  |
| Observer-enabled packaged release build | **PASS (43.64 s)**                                                   |

The existing issue #71 matrix remains the macOS/Linux evidence for implementation commit
`713dc1039f59cd18864be6581b0d603adb2072c1`. The documentation-only candidate difference was
validated locally as recorded above; no later CI run was started by this local verification task.
