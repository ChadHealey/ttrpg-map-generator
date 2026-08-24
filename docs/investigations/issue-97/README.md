# Issue 97 packaged SVG/PNG completion qualification

This directory records the bounded attempt to close the packaged export-completion authority gap
identified by [issue #95](../issue-95/release-protocol-2026-08-23/README.md). The observer is
designed to qualify one SVG and one PNG success observation per gated fixture; this run stopped
before measured dispatch and does not run, pass, fail, or replace issue #95's five-fresh-process
release matrix.

## Observer-only dispatch and exact reopened state

Build the candidate with both `VITE_PACKAGED_ATLAS_OBSERVER_DISPATCH=1` and
`VITE_PACKAGED_EXPORT_OBSERVER_DISPATCH=1`. The first flag retains issue #96's exact three-fixture
setup plus issue #94's unchanged preview/full actions. The second installs only three additional
chords:

- Command-Control-Option-R sequences the unchanged reviewed geography/appearance rerolls, save,
  unload, and generator-free reopen after an exact accepted-baseline and private save-target check;
- Command-Control-Option-V invokes the existing `AtlasWorkflow.exportSvg` method; and
- Command-Control-Option-N invokes the existing `AtlasWorkflow.exportPng` method.

Ordinary builds install neither export chord nor the export receipt. Immediately before either
dispatch, the app revalidates the exact fixture seed and all nine controls, generator-free
`reopened` phase, saved/reopened canonical evidence, authoritative-package fingerprint, zero reopen
generator calls, and the absence of preview or busy state. The dispatch captures the accepted
object identity and canonical evidence, delegates to the unchanged production export orchestrator
and native destination boundary, then emits completion only if the same accepted identity and
evidence remain active and the exact native receipt matches the profile, dimensions, hash, byte
length, platform, and existing ceiling.

Preparation uses the unchanged production controls and actions: exact-fixture selection, preview,
full acceptance, both reviewed rerolls, save, unload, and reopen. The observer sets one fresh
private `.mapworld` destination through the existing labelled input, then the observer-only
preparation chord calls those existing workflow methods in the same order as their production
buttons. Export targets are fixed private siblings of that saved package and are passed through the
already supported production target parameter; no renderer, serializer, rasterizer, native writer,
fixture, schema, dimension, ceiling, workload, budget, timeout, or production UI changes.

## Completion boundary and fail-closed predicates

Before measured dispatch the observer creates one owner-only stale regular destination and records
its device, inode, hash, and size. From dispatch until replacement is independently visible, it
performs no Accessibility traversal and no application action. It polls only that exact destination
while the packaged candidate remains continuously frontmost. A candidate replacement qualifies
only after all of these agree:

- the destination is a direct regular file on the same filesystem with a different inode and hash;
- its complete SHA-256 and byte length match the app's verified native receipt;
- its profile and exact `400 × 200 mm` SVG or `8192 × 4096` RGB PNG structure match;
- its byte length is within the unchanged 32-MiB SVG or 64-MiB PNG ceiling;
- the format-specific native temporary file is absent; and
- one final bounded Accessibility traversal proves the exact fixture, unchanged reopened canonical
  state, verified completion receipt, and frontmost state.

That final receipt completion is the wall-clock and RSS endpoint. Baseline and completion
`launchctl print` membership must be identical, all application/GPU/Networking/WebContent roles
must remain resolvable with the expected executable identities, every sampler row must cover all
roles with exact arithmetic, endpoint coverage must be complete, and no interval may exceed 20 ms.
Stale or partial output, a remaining temporary, absent or in-place destination, bad hash/size,
wrong format/dimensions/profile, ceiling excess, state drift, foreground loss, membership drift,
sampler invalidity, or retention failure invalidates the attempt and yields no measurement
conclusion.

## Build and focused checks

```sh
mkdir -p /private/tmp/issue97-swift-module-cache

xcrun swiftc -module-cache-path /private/tmp/issue97-swift-module-cache \
  -warnings-as-errors -parse-as-library -framework CryptoKit \
  -o /private/tmp/issue97-export-observer-core-tests \
  docs/investigations/issue-90/packaged-preview-observer-core.swift \
  docs/investigations/issue-94/packaged-atlas-observer-core.swift \
  docs/investigations/issue-97/packaged-export-observer-core.swift \
  docs/investigations/issue-97/packaged-export-observer-core-tests.swift
/private/tmp/issue97-export-observer-core-tests

xcrun swiftc -module-cache-path /private/tmp/issue97-swift-module-cache \
  -warnings-as-errors -parse-as-library \
  -framework AppKit -framework ApplicationServices -framework ScreenCaptureKit \
  -framework CoreMedia -framework CoreVideo -framework CryptoKit -framework Foundation \
  -o /private/tmp/issue97-packaged-export-observer \
  docs/investigations/issue-90/packaged-preview-observer-core.swift \
  docs/investigations/issue-90/packaged-preview-observer-platform.swift \
  docs/investigations/issue-90/packaged-preview-observer-rss.swift \
  docs/investigations/issue-90/packaged-preview-observer-security.swift \
  docs/investigations/issue-90/packaged-preview-observer-support.swift \
  docs/investigations/issue-94/packaged-atlas-observer-core.swift \
  docs/investigations/issue-97/packaged-export-observer-core.swift \
  docs/investigations/issue-97/packaged-export-observer-platform.swift \
  docs/investigations/issue-97/packaged-export-observer-support.swift \
  docs/investigations/issue-97/packaged-export-observer.swift

clang -O2 -Wall -Wextra -Werror \
  -o /private/tmp/issue97-rss-timeline \
  docs/investigations/issue-76/rss-timeline.c

VITE_PACKAGED_ATLAS_OBSERVER_DISPATCH=1 \
VITE_PACKAGED_EXPORT_OBSERVER_DISPATCH=1 \
  corepack pnpm --filter @ttrpg-map/desktop tauri build --bundles app --no-sign --ci
```

The unchanged issue #90 observer core, issue #94 fixture parser, issue #96 exact-preview parser,
and issue #91 retention tests also run. Focused product checks cover the packaged dispatch, SVG/PNG
orchestrators, native boundaries, export progress/aftermath, and native atomic replacement.

The completed non-hardware verification record is:

| Check                                         | Result                                                                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Focused export observer and product paths     | **PASS** — 6 TypeScript files, 27 tests                                                                        |
| Issue #90, #94, #96, and #97 observer suites  | **PASS** — all Swift parser, predicate, and observer-core suites                                               |
| Issue #91 private retention and failure paths | **PASS**                                                                                                       |
| `corepack pnpm test:cross-platform`           | **PASS** — 6 PNG checks and 8 registered deterministic fixture sets                                            |
| `corepack pnpm test:png-export`               | **PASS** — 68 TypeScript tests, 6 Rust unit tests, and 4 native integration tests                              |
| `corepack pnpm test:native-recovery`          | **PASS** — 28 native recovery tests                                                                            |
| `corepack pnpm test:e2e`                      | **PASS** — 22 TypeScript tests and 2 native workflow bridges                                                   |
| `corepack pnpm test:visual`                   | **PASS** — 13 tests and 8 registered fixture sets                                                              |
| `corepack pnpm check`                         | **PASS** — 74 files, 573 passed and 1 skipped TS/JS test; semantic retention; 24 Rust unit and 28 native tests |
| Observer-enabled packaged build               | **PASS** — 335 frontend modules and one unsigned `.app`; executable hash matched the recorded candidate        |
| Privacy, fixture-diff, and `git diff --check` | **PASS** — no fixture/render/native-production changes, private paths, raw CSVs, or whitespace errors          |

This branch changes no rendered output, so the passing visual gate required no new human render
comparison. The first root-check invocation stopped at formatting for two evidence documents; the
documents were formatted and the complete root check was rerun from the beginning to the passing
result above.

## Exact target-host sequence

For each format/fixture pair, start a fresh observer-enabled packaged process and wait for its
initial WebKit Accessibility tree to materialize. Supply a fresh direct-child private work root,
raw CSV path, and opaque retention artifact ID:

```sh
/private/tmp/issue97-packaged-export-observer \
  app.ttrpgmap.generator \
  <gated-fixture-id> \
  <registered-fixture-definition-path> \
  <svg-or-png> \
  <candidate-executable-sha256> \
  /private/tmp/issue97-rss-timeline \
  <sampler-sha256> \
  <fresh-private-temporary-csv-path> \
  <fresh-private-work-root>

/private/tmp/issue91-preview-retention \
  <repository-root> \
  <fresh-private-temporary-csv-path> \
  <approved-private-archive-root> \
  <fresh-opaque-artifact-id>
```

Retention runs immediately after every attempt that creates a CSV, valid or invalid. A consumed
required format/fixture trial is never silently rerun. An invalid receipt stops the sequence until
its sanitized evidence and private retention status are recorded and reviewed. Private work roots
and completed package/export artifacts are removed only after the sanitized result and raw sampler
retention receipt are secured.

## Qualification result

The final bounded implementation candidate is commit
`35a2db5cd105cd32133888f8a84c4ab59691dd1d`. Its observer-enabled packaged executable SHA-256 is
`94b5a8b5f3fcd43a361589f35e3449c72cf3aad13610737140c3dd749737cf4e`; observer SHA-256 is
`0c0d3979f3c6c50ffa375fe2459b53b7dd49fad58bd5e3b4b246aaf221db38bd`; sampler SHA-256 is
`d8b07a40f50d6254faa012bc25cbb5cc8daaa4add35dec1ff670ff759fd775fd`; and retention SHA-256 is
`87c2e27e24d559f50780383840290dfe7afdfb5cb1ab15cc33928032ceecde83`.

Target-host qualification is **BLOCKED BEFORE MEASURED DISPATCH**. The raised-window successor
could not establish the approved unmeasured visible/frontmost readiness predicate in this Codex
desktop session. The exact target-host outcomes are:

| Fixture                                | SVG                                   | PNG                |
| -------------------------------------- | ------------------------------------- | ------------------ |
| `milestone-2-atlas-proof`              | **NOT RUN** — readiness blocker       | **NOT RUN** — stop |
| `milestone-2-atlas-fragmented-islands` | **NOT RUN** — global fail-closed stop | **NOT RUN** — stop |
| `milestone-2-atlas-control-max`        | **NOT RUN** — global fail-closed stop | **NOT RUN** — stop |

No attempt reached sampler start, stale-destination creation, or measured export dispatch. There
are zero measurements, zero consumed required trials, zero raw CSVs, and zero new private retained
artifacts. The approved owner-only archive was ready but unmodified. No SVG/PNG timing, RSS,
completion-authority, or release-budget conclusion exists, and issue #95's matrix was not run.
The complete sanitized stop evidence is in
[`qualification-2026-08-23/raw-results.json`](qualification-2026-08-23/raw-results.json).

One proof/SVG preparation attempt on the initial observer implementation became non-progressing
before native save. A filesystem-only check proved that no package, stale export destination,
sampler CSV, or measured export dispatch existed. The process was stopped, the required SVG trial
remained unconsumed, and the successor moved the same unchanged lifecycle actions behind one
exact-baseline observer chord with bounded low-frequency receipt polling. There is no timing, RSS,
retention, or release conclusion for that invalid pre-dispatch harness attempt.

Two subsequent proof/SVG readiness attempts also failed closed before fixture configuration or
sampler start because foreground ownership did not survive external application activation into
observer startup. Neither created a package, destination, CSV, retained artifact, or measured
dispatch. The successor now acquires and verifies the candidate's frontmost state through the same
unmeasured Accessibility precondition pattern used by the approved predecessor, before preparation
or measurement; foreground remains strictly uninterrupted after measured dispatch.

A third proof/SVG readiness attempt showed that Accessibility frontmost assignment alone did not
survive on this host. It failed before fixture setup or sampler start and likewise created no
package, destination, CSV, retained artifact, or measured dispatch. The bounded successor first
activates the exact running candidate through AppKit, then verifies Accessibility frontmost state;
this remains an unmeasured readiness action and does not alter the measured continuity predicate.

The AppKit-only successor also failed closed before fixture setup or sampling. The final bounded
readiness method requires exactly one candidate Accessibility window, raises it, sets the
application frontmost, and verifies that state before doing any preparation. This is the same class
of visible-window setup authorized for #96 and still occurs before the measured dispatch boundary.

That final readiness attempt failed because the candidate Accessibility window could not be raised.
Issue #97 therefore stops without weakening the visible-window or foreground authority. The
smallest blocker is target-session UI arbitration: the designated host is correct, but this Codex
desktop session cannot give the packaged candidate the approved visible/frontmost preparation
state. A successor may rerun the unchanged final candidate only after that external session state
changes; it must not reinterpret these invalid attempts or claim their absent measurements.

## Privacy

Public receipts contain only the gated fixture values and definition hash, approved host/build and
tool hashes, sanitized role counts, canonical accepted-state hashes, Boolean replacement/temporary/
format/foreground/membership predicates, destination hash/byte length/ceiling, timing/RSS summary,
opaque retention receipt, and sanitized invalidation authority/reason. Package paths, export paths,
private archive roots, pixels, CSV content, PIDs, UUIDs, coalitions, user names, executable paths,
and other local paths remain private.
