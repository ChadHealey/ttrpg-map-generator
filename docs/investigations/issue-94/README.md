# Issue 94 packaged full-atlas qualification observer

This directory extends the issue #90 target-host observer with one fail-closed packaged path for
qualifying the first completely painted accepted atlas. It does not run, pass, fail, or replace the
five-run release protocol.

## Authorized app path

Set `VITE_PACKAGED_ATLAS_OBSERVER_DISPATCH=1` only while building the qualification candidate. An
ordinary build installs neither the fixture-selection handler nor the full-generation handler. The
observer-enabled build accepts exactly these checked-in definitions:

- `milestone-2-atlas-proof` through Command-Control-Option-J;
- `milestone-2-atlas-fragmented-islands` through Command-Control-Option-K; and
- `milestone-2-atlas-control-max` through Command-Control-Option-L.

The app imports those three `fixture-definition.json` files directly, validates their version,
fixture ID, canonical unsigned-64 seed, and complete nine-control record, and exposes a structured
Accessibility receipt only while the live app state still matches. Command-Control-Option-P calls
the same `preview` action as **Generate coarse preview**. Command-Control-Option-F calls the same
`acceptFull` action as **Accept full atlas**. Those actions retain the unchanged
`AtlasWorkflow.requestPreview` and `AtlasWorkflow.acceptFull` paths. The dispatch never injects a
preview, accepted state, scene, or canvas.

## Observation and completion boundary

Before full-generation sampling or dispatch, the observer validates the requested registered
definition, configures it through the fixture chord, parses the exact `configured` receipt, and
qualifies the production disposable preview through the issue #90 frame and Accessibility
predicates. It then obtains a fresh baseline membership receipt and disposable-preview frame.

The measured dispatch boundary is the posting of Command-Control-Option-F to the candidate PID.
From that boundary until the accepted frame qualifies, the observer performs no Accessibility
traversal and no scroll, reveal, pan, zoom, focus, or framing action. A ScreenCaptureKit frame
qualifies only when it is complete, displayed after dispatch, changed from the disposable-preview
baseline, and observed with uninterrupted foreground ownership. Within the 512 by 256 crop it must
contain at least 100 pixels each near the accepted land (`#c9c39a`) and water (`#afbec0`) colors,
at least eight pixels near accepted ink (`#282a24`), and no more than 500 pixels each near the two
disposable-preview colors. All comparisons use the existing per-channel tolerance of 10. This
rejects a partial/stale/unchanged frame, a disposable preview, and a background-only or ink-free
intermediate.

Only after that frame qualifies does one final structured Accessibility receipt verify the
accepted canvas label and caption, absence of the disposable label/caption, disabled **Accept full
atlas**, exact accepted fixture receipt, and frontmost state. Completion of that receipt is the
wall-clock and RSS endpoint. Accessibility completion alone cannot qualify.

The observer reuses issue #90's target-host check, ScreenCaptureKit crop, foreground monitor,
`launchctl print` PID-domain/resource-coalition resolver, executable identity validation, sampler,
RSS arithmetic/cadence/coverage validation, and completion membership equality. The issue #91
retention utility remains the only cleanup path for PID-bearing CSVs.

## Build and focused checks

```sh
mkdir -p /private/tmp/issue94-swift-module-cache

xcrun swiftc -module-cache-path /private/tmp/issue94-swift-module-cache \
  -warnings-as-errors -parse-as-library -framework CryptoKit \
  -o /private/tmp/issue94-atlas-observer-core-tests \
  docs/investigations/issue-90/packaged-preview-observer-core.swift \
  docs/investigations/issue-90/packaged-preview-observer-rss.swift \
  docs/investigations/issue-90/packaged-preview-observer-security.swift \
  docs/investigations/issue-94/packaged-atlas-observer-core.swift \
  docs/investigations/issue-94/packaged-atlas-observer-core-tests.swift
/private/tmp/issue94-atlas-observer-core-tests

xcrun swiftc -module-cache-path /private/tmp/issue94-swift-module-cache \
  -warnings-as-errors -parse-as-library \
  -framework AppKit -framework ApplicationServices -framework ScreenCaptureKit \
  -framework CoreMedia -framework CoreVideo -framework CryptoKit -framework Foundation \
  -o /private/tmp/issue94-packaged-atlas-observer \
  docs/investigations/issue-90/packaged-preview-observer-core.swift \
  docs/investigations/issue-90/packaged-preview-observer-platform.swift \
  docs/investigations/issue-90/packaged-preview-observer-rss.swift \
  docs/investigations/issue-90/packaged-preview-observer-security.swift \
  docs/investigations/issue-90/packaged-preview-observer-support.swift \
  docs/investigations/issue-94/packaged-atlas-observer-core.swift \
  docs/investigations/issue-94/packaged-atlas-observer-platform.swift \
  docs/investigations/issue-94/packaged-atlas-observer-support.swift \
  docs/investigations/issue-94/packaged-atlas-observer.swift

clang -O2 -Wall -Wextra -Werror \
  -o /private/tmp/issue94-rss-timeline \
  docs/investigations/issue-76/rss-timeline.c

VITE_PACKAGED_ATLAS_OBSERVER_DISPATCH=1 \
  corepack pnpm --filter @ttrpg-map/desktop tauri build --bundles app --no-sign --ci
```

Run the issue #90 core and issue #91 retention checks unchanged in addition to the new parser and
predicate tests. The final verification commands remain the root commands listed in issue #94.

## Exact target-host sequence

The operator supplies an approved owner-only private archive root outside the repository. Its
value is private state and is never copied into public evidence.

```sh
REPOSITORY_ROOT="$(git rev-parse --show-toplevel)"
CANDIDATE_APP="$REPOSITORY_ROOT/apps/desktop/src-tauri/target/release/bundle/macos/TTRPG Map Generator.app"
CANDIDATE_EXECUTABLE="$CANDIDATE_APP/Contents/MacOS/ttrpg-map-desktop"
OBSERVER=/private/tmp/issue94-packaged-atlas-observer
SAMPLER=/private/tmp/issue94-rss-timeline
RETENTION=/private/tmp/issue94-retention

test -n "$APPROVED_PRIVATE_ARCHIVE_ROOT"
test "$(stat -f '%Lp' "$APPROVED_PRIVATE_ARCHIVE_ROOT")" = 700
open -na "$CANDIDATE_APP"

"$OBSERVER" app.ttrpgmap.generator \
  milestone-2-atlas-proof \
  "$REPOSITORY_ROOT/fixtures/fixed-seeds/milestone-2-atlas-proof/fixture-definition.json" \
  <candidate-executable-sha256> "$SAMPLER" <sampler-sha256> \
  /private/tmp/issue94-proof-rss.csv

"$RETENTION" "$REPOSITORY_ROOT" /private/tmp/issue94-proof-rss.csv \
  "$APPROVED_PRIVATE_ARCHIVE_ROOT" issue94-qualification-proof
```

Repeat from a fresh candidate process with the fragmented-islands definition/raw name and opaque
ID `issue94-qualification-fragmented-islands`, then with control-max and opaque ID
`issue94-qualification-control-max`. Do not reuse a raw path or artifact ID. Stop immediately on an
invalid observer or retention receipt. Do not continue into export, cancellation, or five-run
matrix work under this issue.

## Qualification result

The exact implementation candidate was commit `b6d62b37a82d94c067d0344124aeef032d198b8a`.
Its packaged executable SHA-256 was
`c72e62f837cbe0d1aa8e3f90d075712349bd49763620ac2cb75ce1b9d5fdbeca`. The successful runs used
observer SHA-256 `232ec1e222dc04eaf43d884a548c0da1683cdadab7d19fc8403ecd755812090a`, sampler
SHA-256 `974fcf7c72b66d39e3851e8ca06910b0d8b8cdace4b7796bbe83cdb2f687fef6`, and retention
SHA-256 `d967f2662b952898ecf659699117e4e43d65db54f562b67a0a2d76a735164052`.

On MacBook Pro `Mac17,2`, Apple M5, 24 GB, macOS 26.5.1 (`25F80`), AC power, and Low Power Mode
off, one fresh process per gated fixture produced a valid full-atlas receipt:

| Fixture                                | Diagnostic elapsed | Diagnostic peak additional RSS | Max interval | Result    |
| -------------------------------------- | -----------------: | -----------------------------: | -----------: | --------- |
| `milestone-2-atlas-proof`              |        5,491.61 ms |                     413.33 MiB |     7.916 ms | **VALID** |
| `milestone-2-atlas-fragmented-islands` |        6,934.09 ms |                     410.78 MiB |    12.296 ms | **VALID** |
| `milestone-2-atlas-control-max`        |        4,860.74 ms |                     419.95 MiB |     8.877 ms | **VALID** |

Every result proved exact fixture seed/controls, complete changed accepted land/water/ink paint,
disposable-preview rejection, uninterrupted foreground, final accepted Accessibility state, one
application/GPU/Networking/WebContent role, completion membership equality, valid RSS arithmetic,
endpoint coverage, and cadence. Each raw CSV was retained in the approved private archive and its
temporary copy removed. The sanitized receipts and pre-dispatch invalidations are in
[`qualification-2026-08-23/raw-results.json`](qualification-2026-08-23/raw-results.json).

These timings are diagnostic qualification observations only. They make no release-budget
conclusion and do not replace issue #95's complete release matrix.

## Privacy and invalidation

The public receipt contains only the registered fixture values and definition hash, target
host/build identity, executable/sampler hashes, sanitized role counts, Boolean visual and
Accessibility predicates, endpoint labels, timing/RSS summary, and an invalid authority/reason
when applicable. Raw pixels, CSV content, PIDs, service UUIDs, coalition identifiers, user names,
private archive locations, executable paths, and other local paths remain private.

Unknown fixtures, wrong definitions, partial/extra/malformed receipts, seed/control drift, wrong
workflow phase, unavailable permission, target drift, missing or replaced helpers, identity drift,
unsafe raw paths, partial/stale/unchanged/wrong-mode frames, foreground loss, Accessibility
contradiction, missing endpoint coverage, bad RSS arithmetic/cadence, or retention failure all fail
closed and emit no release conclusion.
