# Issue 84 partial Apple M5 release-protocol evidence

- **Status:** INCOMPLETE — proof and fragmented-islands attempts lack the required accepted-atlas
  first-paint endpoint; control-max fixture configuration could not be qualified before dispatch
- **Measured:** 2026-08-23
- **Candidate commit:** `1e11b5f2887e12d6629603dae0c5dec0e854cd6d`
- **Packaged executable SHA-256:**
  `0327af7dcc5ab794e0d3f191a89bb62dcde60f5c985c7a56cb5acc944c4fa548`
- **Structured sanitized evidence:** [raw-results.json](raw-results.json)

This run resumed the still-outstanding full-generation lane after the complete issue #89 preview
matrix. It does not claim that issue #84 or Milestone 2 passes. The exact candidate passed
`corepack pnpm check`, the issue #90 observer and retention tests, and the observer-enabled unsigned
packaged build before measurement. The issue-required focused cross-platform, native-recovery,
end-to-end, visual, and PNG-export checks were not run on this candidate. No production behavior,
schema, fixture, workload, hardware, or numeric budget changed.

## Environment and method

The run used MacBook Pro `Mac17,2`, Apple M5, 10 cores, 24 GB unified memory, macOS 26.5.1
(`25F80`), AC power, and Low Power Mode off. Toolchain versions were Node 24.11.0, pnpm 11.19.0,
rustc 1.97.1, and Xcode 26.4 (`17E192`). The packaged candidate had no debugger or development
server attached and used only packaged local assets.

Every attempted full-generation process first ran the unchanged issue #90 observer against the
normal production coarse-preview path. A valid preview receipt required the complete changed 512
by 256 crop, bounded land/water populations, uninterrupted foreground ownership, the final
Accessibility state, and baseline/completion equality for one application, GPU, Networking, and
WebContent process. The full-generation sampler reused that observer-resolved PID set. The exact
accepted Accessibility status was used as the operation endpoint, membership was revalidated with
the same issue #90 parser and role rules, and the issue #90 RSS validator checked aggregate
arithmetic, nonzero per-process samples, endpoint coverage, sample count, and the 20 ms cadence
limit. This endpoint did not establish the contract's first fully painted accepted full atlas, so
the retained timing and RSS measurements have no release-budget conclusion.

Raw PID-bearing preview and full-generation CSVs were moved immediately into the operator-approved
private archive. The public structured evidence records only opaque artifact identifiers, hashes,
byte lengths, sanitized role counts, and measurements. It contains no private archive path, PID,
service UUID, coalition identifier, executable path, or raw CSV content.

## Full-generation diagnostic measurements

The untimed proof-fixture warm-up reached the Accessibility endpoint at 5,195 ms and 451.92 MiB peak
additional RSS. The retained fresh-process measurements were:

| Run                                     |  Elapsed | Baseline RSS |   Peak RSS | Additional RSS | Samples | Maximum interval |
| --------------------------------------- | -------: | -----------: | ---------: | -------------: | ------: | ---------------: |
| `issue84-final-full-proof-1`            | 5,120 ms |   339.44 MiB | 785.31 MiB |     445.88 MiB |     834 |         8.020 ms |
| `issue84-final-full-proof-2`            | 5,106 ms |   335.86 MiB | 775.27 MiB |     439.41 MiB |     832 |         6.380 ms |
| `issue84-final-full-proof-3`            | 5,129 ms |   330.14 MiB | 770.02 MiB |     439.88 MiB |     835 |         8.330 ms |
| `issue84-final-full-proof-4`            | 5,138 ms |   332.59 MiB | 772.97 MiB |     440.38 MiB |     838 |         6.379 ms |
| `issue84-final-full-proof-5`            | 5,152 ms |   330.59 MiB | 773.92 MiB |     443.33 MiB |     836 |         6.430 ms |
| `issue84-final-full-fragmented-1`       | 6,441 ms |   380.31 MiB | 797.14 MiB |     416.83 MiB |   1,050 |         6.400 ms |
| `issue84-final-full-fragmented-2`       | 6,393 ms |   380.56 MiB | 818.20 MiB |     437.64 MiB |   1,041 |         8.472 ms |
| `issue84-final-full-fragmented-3-retry` | 6,371 ms |   380.48 MiB | 794.25 MiB |     413.77 MiB |   1,039 |         6.479 ms |
| `issue84-final-full-fragmented-4`       | 6,390 ms |   380.95 MiB | 798.80 MiB |     417.84 MiB |   1,041 |         6.409 ms |
| `issue84-final-full-fragmented-5`       | 6,379 ms |   380.17 MiB | 794.92 MiB |     414.75 MiB |   1,039 |         8.605 ms |

The proof attempts have diagnostic median and worst elapsed times of 5,129 ms and 5,152 ms, with
diagnostic median and worst additional RSS of 440.38 MiB and 445.88 MiB. The fragmented-islands
attempts have diagnostic median and worst elapsed times of 6,390 ms and 6,441 ms, with diagnostic
median and worst additional RSS of 416.83 MiB and 437.64 MiB. None has a budget conclusion because
the accepted-atlas first-paint endpoint was not observed. Exact byte values, per-process peaks,
preview qualifications, and private-retention receipts are in the structured evidence.

The first fragmented-islands run-3 attempt is retained as invalid evidence. Its sampler reported a
25.579 ms maximum interval, so it has no timing or RSS budget conclusion. A fresh replacement was
permitted by the cadence protocol, sampled at 6.479 ms maximum cadence, and is the run-3 row above;
it remains unqualified for the separate first-paint reason.

## Stop decision

The release protocol is also blocked at control-max before observer dispatch. The required seven numeric controls were set with
exact readback, but two materially different native popup methods could not set and read back the
three required enum controls. The approved Accessibility menu-item path did not expose a native
menu, and a real mouse/key path did not produce the exact requested values. No control-max sampler
or product-operation receipt was created.

Issue #84 does not authorize a new production fixture loader, another test-only dispatch, a changed
fixture, or a weaker configuration claim. The skill repair budget also stops after two materially
different fixes leave the same blocker. Control-max full generation, all SVG/PNG measurements, and
all cancellation trials therefore remain not run. This is an evidence-harness blocker, not a valid
product timing, memory, export, or cancellation failure.

## Verification and provenance recorded

| Command / check                             | Result                                                                                    |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Issue #90 observer core and retention tests | **PASS**                                                                                  |
| `corepack pnpm check`                       | **PASS** — 72 TS/JS files, 553 passed, 1 skipped; semantic-retention proof; 52 Rust tests |
| Observer-enabled packaged release build     | **PASS**                                                                                  |
| `corepack pnpm test:cross-platform`         | **NOT RUN** on candidate `1e11b5f…`                                                       |
| `corepack pnpm test:native-recovery`        | **NOT RUN** on candidate `1e11b5f…`                                                       |
| `corepack pnpm test:e2e`                    | **NOT RUN** on candidate `1e11b5f…`                                                       |
| `corepack pnpm test:visual`                 | **NOT RUN** on candidate `1e11b5f…`                                                       |
| `corepack pnpm test:png-export`             | **NOT RUN** on candidate `1e11b5f…`                                                       |
| Proof full-generation matrix                | **INVALID** — accepted-atlas first paint was not observed                                 |
| Fragmented-islands full-generation matrix   | **INVALID** — accepted-atlas first paint was not observed; one cadence invalidation       |
| Control-max full-generation matrix          | **NOT RUN** — pre-dispatch fixture setup blocker                                          |
| SVG, PNG, and cancellation lanes            | **NOT RUN** — stop decision                                                               |

The durable record contains exact commands for the repository gate and packaged build only. The
observer, fixture setup, full-generation dispatch, sampler, validation, membership-revalidation,
and retention command transcript was not retained. Tool hashes and private raw-artifact receipts
remain recorded, but they do not substitute for the issue-required exact command record.
