# Issue 97 packaged SVG/PNG completion qualification

This directory closes the packaged export-completion authority gap identified by
[issue #95](../issue-95/release-protocol-2026-08-23/README.md). It qualifies one SVG and one PNG
success observation per gated fixture; it does not run, pass, fail, or replace issue #95's
five-fresh-process release matrix.

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

Target-host qualification is recorded after the exact implementation commit is built and the six
required single-run observations complete. These are diagnostic authority qualifications only;
they make no SVG/PNG release-budget conclusion and do not run issue #95's matrix.

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

## Privacy

Public receipts contain only the gated fixture values and definition hash, approved host/build and
tool hashes, sanitized role counts, canonical accepted-state hashes, Boolean replacement/temporary/
format/foreground/membership predicates, destination hash/byte length/ceiling, timing/RSS summary,
opaque retention receipt, and sanitized invalidation authority/reason. Package paths, export paths,
private archive roots, pixels, CSV content, PIDs, UUIDs, coalitions, user names, executable paths,
and other local paths remain private.
