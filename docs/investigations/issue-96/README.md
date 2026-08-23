# Issue 96 exact-fixture packaged-preview qualification

This directory closes the exact-fixture preview-authority gap identified by
[issue #95](../issue-95/release-protocol-2026-08-23/README.md). It qualifies one packaged coarse-
preview observation per gated fixture; it does not run, pass, fail, or replace issue #95's five-run
release matrix.

## Observer-only dispatch

`VITE_PACKAGED_ATLAS_OBSERVER_DISPATCH=1` installs the existing three fixture-selection chords plus
an exact-fixture Command-Control-Option-P dispatch. Immediately on that chord, the app synchronously
revalidates the live fixture ID, canonical unsigned-64 seed, and all nine controls against the
directly imported checked-in definition. Only an exact match delegates to the same `preview` action
as **Generate coarse preview**, retaining the unchanged `AtlasWorkflow.requestPreview` and
presentation path. Drift or missing fixture authority dispatches no preview. Ordinary builds install
none of this atlas-observer handler.

The successor Swift observer inherits issue #90's target-host, process-membership, executable-
identity, ScreenCaptureKit frame, foreground, RSS, cadence/coverage, and security authorities; it
inherits issue #94's strict three-definition and packaged-receipt parser; and it uses issue #91's
retention utility unchanged. Its Accessibility walker bounds unique elements and uses `CFEqual` to
deduplicate repeated WebKit nodes without weakening exact-count predicates.

## Measurement boundary

The operator launches one fresh package and waits for the initial packaged Accessibility tree to
materialize before starting the observer. This readiness pause is outside the measured interval and
changes no timeout. The observer scrolls the canvas visible, configures the requested fixture,
settles membership and RSS sampling, obtains a complete baseline frame, and parses the exact
`configured` fixture receipt immediately before dispatch. The packaged handler then performs its own
synchronous exact readback and delegates to production preview.

From dispatch until a changed complete preview frame qualifies, the observer performs no
Accessibility traversal, scrolling, reveal, pan, zoom, focus, or framing action. One final bounded
Accessibility snapshot then proves the disposable-preview image and caption, enabled **Accept full
atlas**, exact `preview` fixture receipt, and frontmost state. Completion of that receipt is the
wall-clock and RSS endpoint. Completion membership must equal baseline membership, every RSS row
must cover all four roles with exact aggregate arithmetic, and no sample interval may exceed 20 ms.

## Build and focused checks

```sh
mkdir -p /private/tmp/issue96-swift-module-cache

xcrun swiftc -module-cache-path /private/tmp/issue96-swift-module-cache \
  -warnings-as-errors -parse-as-library -framework CryptoKit \
  -o /private/tmp/issue96-exact-preview-observer-core-tests \
  docs/investigations/issue-90/packaged-preview-observer-core.swift \
  docs/investigations/issue-90/packaged-preview-observer-rss.swift \
  docs/investigations/issue-90/packaged-preview-observer-security.swift \
  docs/investigations/issue-94/packaged-atlas-observer-core.swift \
  docs/investigations/issue-96/packaged-exact-preview-observer-core-tests.swift
/private/tmp/issue96-exact-preview-observer-core-tests

xcrun swiftc -module-cache-path /private/tmp/issue96-swift-module-cache \
  -warnings-as-errors -parse-as-library \
  -framework AppKit -framework ApplicationServices -framework ScreenCaptureKit \
  -framework CoreMedia -framework CoreVideo -framework CryptoKit -framework Foundation \
  -o /private/tmp/issue96-packaged-exact-preview-observer \
  docs/investigations/issue-90/packaged-preview-observer-core.swift \
  docs/investigations/issue-90/packaged-preview-observer-platform.swift \
  docs/investigations/issue-90/packaged-preview-observer-rss.swift \
  docs/investigations/issue-90/packaged-preview-observer-security.swift \
  docs/investigations/issue-90/packaged-preview-observer-support.swift \
  docs/investigations/issue-94/packaged-atlas-observer-core.swift \
  docs/investigations/issue-96/packaged-exact-preview-observer-platform.swift \
  docs/investigations/issue-96/packaged-exact-preview-observer-support.swift \
  docs/investigations/issue-96/packaged-exact-preview-observer.swift

clang -O2 -Wall -Wextra -Werror \
  -o /private/tmp/issue96-rss-timeline \
  docs/investigations/issue-76/rss-timeline.c

VITE_PACKAGED_ATLAS_OBSERVER_DISPATCH=1 \
  corepack pnpm --filter @ttrpg-map/desktop tauri build --bundles app --no-sign --ci
```

The issue #90 observer-core, issue #94 fixture-parser, and issue #91 retention tests also run
unchanged. The focused TypeScript test is
`apps/desktop/src/packaged-atlas-observer-dispatch.test.ts`. Final broader gates are
`corepack pnpm test:cross-platform`, `corepack pnpm test:e2e`, `corepack pnpm test:visual`, and
`corepack pnpm check`.

The completed verification record is:

| Check                                         | Result                                                                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Focused packaged dispatch                     | **PASS** — 1 file, 9 TypeScript tests                                                                          |
| Issue #90 preview observer core               | **PASS**                                                                                                       |
| Issue #94 fixture parser and predicates       | **PASS**                                                                                                       |
| Issue #96 exact-preview parser and predicates | **PASS**                                                                                                       |
| Issue #91 private retention and failure paths | **PASS**                                                                                                       |
| `corepack pnpm test:cross-platform`           | **PASS** — 6 PNG checks and 8 registered fixture sets                                                          |
| `corepack pnpm test:e2e`                      | **PASS** — 22 TypeScript tests and 2 native workflow bridges                                                   |
| `corepack pnpm test:visual`                   | **PASS** — 13 tests and 8 registered fixture sets                                                              |
| `corepack pnpm check`                         | **PASS** — 73 files, 562 passed and 1 skipped TS/JS test; semantic retention; 24 Rust unit and 28 native tests |
| Observer-enabled packaged build               | **PASS** — 334 frontend modules and one unsigned arm64 `.app`                                                  |
| Privacy review and `git diff --check`         | **PASS** — no fixture or private-path changes                                                                  |

## Exact target-host sequence

The already approved private archive root remains owner-only external state and is never printed or
copied into public evidence. For each fixture, start from no running candidate, launch the exact
package, allow its initial UI to become Accessibility-ready while it remains frontmost, then run:

```sh
/private/tmp/issue96-packaged-exact-preview-observer \
  app.ttrpgmap.generator \
  <gated-fixture-id> \
  <registered-fixture-definition-path> \
  <candidate-executable-sha256> \
  /private/tmp/issue96-rss-timeline \
  <sampler-sha256> \
  <fresh-private-temporary-csv-path>

/private/tmp/issue96-retention \
  <repository-root> \
  <fresh-private-temporary-csv-path> \
  <approved-private-archive-root> \
  <fresh-opaque-artifact-id>
```

Run retention immediately after every attempt that creates a CSV, including an invalid attempt.
Stop and diagnose on an invalid receipt; do not reinterpret or combine evidence. Use a fresh app
process, raw path, and opaque artifact ID for every subsequent attempt. Do not proceed into full
generation, exports, cancellation, or the five-run matrix.

## Qualification result

The exact implementation candidate was commit
`714be9b092a4780dd2ecb1e7e9c20684ea77edf7`. Its observer-enabled packaged executable SHA-256 was
`9e19555d1fbcdd7a72515c8a6c91400cf2f86a07e48ef95c29cd61947a4a2471`. Successful runs used observer
SHA-256 `b99a95264b4bac7b3238dd463e698dc9b9ef576f72becb187059bda003f3a221`, sampler SHA-256
`131c6a94db91430dbd595f871c4a43e7890ae5f3ee2f92fc960739adb6f2ffed`, and retention SHA-256
`bbb64eb2e208bb72e590cacff0113c030c74190e3df1b4662dd82569726b85c4`.

On MacBook Pro `Mac17,2`, Apple M5, 24 GB, macOS 26.5.1 (`25F80`), arm64, AC power, and Low Power
Mode off, one fresh process per gated fixture produced a valid exact-fixture preview receipt:

| Fixture                                | Diagnostic elapsed | Diagnostic peak additional RSS | Max interval | Result    |
| -------------------------------------- | -----------------: | -----------------------------: | -----------: | --------- |
| `milestone-2-atlas-proof`              |          604.26 ms |                     118.42 MiB |     6.411 ms | **VALID** |
| `milestone-2-atlas-fragmented-islands` |          628.08 ms |                     125.69 MiB |     6.468 ms | **VALID** |
| `milestone-2-atlas-control-max`        |          701.72 ms |                     131.22 MiB |     9.256 ms | **VALID** |

Every valid receipt proves immediate exact seed/control readback, unchanged production preview
delegation, complete changed preview paint, bounded land/water palette populations, uninterrupted
foreground, exact final Accessibility state, one application/GPU/Networking/WebContent role,
completion membership equality, valid RSS arithmetic, endpoint coverage, and cadence. The three raw
CSVs are retained in the approved private archive and their temporary sources are removed.

Two proof-fixture attempts failed closed before sampler start or production preview dispatch. The
first exposed repeated WebKit elements exhausting the inherited traversal bound; the successor was
corrected to bound unique elements. The second started before the packaged WebKit Accessibility
subtree had materialized; the runbook now requires verified initial UI readiness before observer
start without changing a timeout. Neither invalid attempt created a raw artifact or measurement.

The sanitized run details, exact controls, invalidations, tool identities, role counts, predicates,
measurements, and retention receipts are in
[`qualification-2026-08-23/raw-results.json`](qualification-2026-08-23/raw-results.json). These are
single-run diagnostic qualifications only. They make no release-budget conclusion and do not run or
replace issue #95's matrix.

## Privacy and invalidation

Public evidence contains only registered fixture values/hashes, host/build and tool identities,
sanitized role counts, Boolean predicates, timing/RSS summaries, opaque retention receipts, and
sanitized invalidation reasons. Pixels, CSV content, PIDs, UUIDs, coalitions, user names, private
archive locations, executable paths, and other local paths remain private.

Unknown fixtures, wrong definitions, incomplete/extra/malformed receipts, seed/control/state drift,
ordinary-build dispatch, unavailable permission, target drift, missing/replaced helpers, identity
drift, unsafe raw paths, partial/stale/unchanged/wrong-palette frames, foreground loss, Accessibility
contradiction, missing endpoint coverage, bad RSS arithmetic/cadence, or retention failure all fail
closed and emit no release conclusion.
