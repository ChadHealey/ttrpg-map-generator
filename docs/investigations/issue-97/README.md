# Issue 97 packaged SVG/PNG completion qualification

This directory records the bounded packaged export-completion authority work identified by
[issue #95](../issue-95/release-protocol-2026-08-23/README.md), including the preserved issue #97
stops and issue #101's explicitly authorized replacement sequence. The observer qualifies one SVG
and one PNG success observation per gated fixture. None of these observations runs, passes, fails,
or replaces issue #95's five-fresh-process release matrix.

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

### Preserved initial stop

The final bounded implementation candidate is commit
`35a2db5cd105cd32133888f8a84c4ab59691dd1d`. Its observer-enabled packaged executable SHA-256 is
`94b5a8b5f3fcd43a361589f35e3449c72cf3aad13610737140c3dd749737cf4e`; observer SHA-256 is
`0c0d3979f3c6c50ffa375fe2459b53b7dd49fad58bd5e3b4b246aaf221db38bd`; sampler SHA-256 is
`d8b07a40f50d6254faa012bc25cbb5cc8daaa4add35dec1ff670ff759fd775fd`; and retention SHA-256 is
`87c2e27e24d559f50780383840290dfe7afdfb5cb1ab15cc33928032ceecde83`.

The initial target-host qualification was **BLOCKED BEFORE MEASURED DISPATCH**. The raised-window successor
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

### Resumed qualification stop

The qualification resumed from base
`312836caf7fec00af5f32c261ddced3f9b4a11cd` using issue #100's approved controller and the
unchanged packaged executable. The executable SHA-256 remained
`94b5a8b5f3fcd43a361589f35e3449c72cf3aad13610737140c3dd749737cf4e`; controller SHA-256 was
`68c23690dcdb7f4dd329e0b2152b699ba1d6ef4248d211088aa26bb98c9475c3`; its independent
readiness-observer SHA-256 was
`9f9c3254ee523f0151ce05f3b5d2573139a26e6bc432ce2c365e1b83d57419ff`; sampler and retention
identities remained the values above.

Four resumed proof/SVG attempts failed before measured dispatch and did not consume a required
trial. Three exposed the pinned WebKit save-target field's live Accessibility contract: its title
is uppercase, its stable identifier is `AXDOMIdentifier`, and direct `AXValue` assignment does not
emit the controlled browser input event. The corrected observer requires the exact title plus DOM
identifier, focuses that one field, sends the private path as a process-targeted Unicode keyboard
event, and verifies exact readback. The fourth pre-dispatch attempt completed the production
save/reopen workflow but exposed that the hidden reopened paragraph is not reactively republished.
The corrected observer instead requires the exact disabled target plus the unique visible reopened
ready status before dispatch; the unchanged packaged dispatch gate still rejects anything without
full exact-fixture reopened authority, and the final receipt proves the exact accepted hashes and
unchanged state. These four attempts created no sampler CSV and each has retention status
`not-created`.

The next fresh proof/SVG process passed every issue #100 readiness predicate and reached measured
dispatch using observer SHA-256
`406de0abd9120cf7535a23b86da09b4c8962e98bda798e59159ba6f6945b8642`. It was the first consumed
required trial and failed closed at destination validation. Immediate post-run diagnostics proved:

- verified inode- and hash-changing destination replacement;
- final SHA-256 `c72f6261534171e7c7048f1cccc304b6a148296ba22090c11e7a1c132e8318db`
  and 852,650 bytes, matching the exact native completion receipt;
- profile `atlas-svg-v1` version 1, dimensions `400x200mm`, and the unchanged 32-MiB ceiling pass;
- exact accepted/reopened canonical hashes, PASS reopen comparison, zero reopen generator calls,
  and `acceptedStateUnchanged: true`;
- the native temporary absent and a complete production SVG present; and
- one raw RSS artifact immediately retained in the approved owner-only archive under opaque ID
  `issue97-proof-svg-qualification`, SHA-256
  `2096a3f940e63928264f7438fa8907c71a8d0c6740b99f95c3b695c16a4707f5`, 7,545 bytes, with no
  temporary raw CSV left behind.

The only failed predicate required the `<svg>` element at byte zero, while the unchanged complete
production SVG correctly begins with `<?xml version="1.0" encoding="UTF-8"?>`. The observer-only
format predicate and negative-path tests now admit that exact production declaration; the stopped,
corrected observer SHA-256 is
`1b84fb183fc2c34b2b652d2dc168050babb91d35f3fd983b657a4e8b05190d2f`. It was compiled and tested
but was not used for another qualification because the consumed-invalid rule requires an immediate
global stop.

| Fixture                                | SVG                                               | PNG                                 |
| -------------------------------------- | ------------------------------------------------- | ----------------------------------- |
| `milestone-2-atlas-proof`              | **INVALID, CONSUMED** — observer format predicate | **NOT RUN** — consumed-invalid stop |
| `milestone-2-atlas-fragmented-islands` | **NOT RUN** — global consumed-invalid stop        | **NOT RUN** — global stop           |
| `milestone-2-atlas-control-max`        | **NOT RUN** — global consumed-invalid stop        | **NOT RUN** — global stop           |

There are zero valid qualifications and zero measurement conclusions. No remaining required trial
or issue #95 matrix operation ran, and no SVG/PNG release-budget pass or fail is claimed. The
smallest blocker is procedural after an observer defect: the exact production SVG predicate is
corrected, but the already consumed invalid proof/SVG trial may not be rerun without new authority.
The complete sanitized resumed-attempt record is appended without modifying the six preserved
initial attempts in
[`qualification-2026-08-23/raw-results.json`](qualification-2026-08-23/raw-results.json).

### Issue #101 authorized replacement qualification

Issue #101 supplied the bounded authority that the resumed issue #97 sequence correctly did not
infer. The qualification started from task base
`73f4c579b35037a91874442f1e39dfdfed95baa7` and reproduced the unchanged implementation candidate
`35a2db5cd105cd32133888f8a84c4ab59691dd1d`. Before the replacement trial, the package and all
external tools reproduced these exact identities:

| Artifact                                  | SHA-256                                                            |
| ----------------------------------------- | ------------------------------------------------------------------ |
| Observer-enabled packaged executable      | `94b5a8b5f3fcd43a361589f35e3449c72cf3aad13610737140c3dd749737cf4e` |
| Corrected packaged export observer        | `1b84fb183fc2c34b2b652d2dc168050babb91d35f3fd983b657a4e8b05190d2f` |
| RSS sampler                               | `d8b07a40f50d6254faa012bc25cbb5cc8daaa4add35dec1ff670ff759fd775fd` |
| Private retention utility                 | `87c2e27e24d559f50780383840290dfe7afdfb5cb1ab15cc33928032ceecde83` |
| Issue #100 readiness controller           | `68c23690dcdb7f4dd329e0b2152b699ba1d6ef4248d211088aa26bb98c9475c3` |
| Issue #100 independent readiness observer | `9f9c3254ee523f0151ce05f3b5d2573139a26e6bc432ce2c365e1b83d57419ff` |

The narrowly approved unsandboxed issue #100 controller invocation reproduced one fresh exact app,
one visible Accessibility window, successful activation/raise/frontmost actions, retained
application/window identity, and independent Accessibility plus `NSWorkspace` frontmost state.
Its receipt configured no fixture, sampler, destination, export, or measurement. The same readiness
mechanism established a fresh process for each later row.

The replacement proof/SVG row was run exactly once. It was **VALID**, so the remaining five rows
were authorized and run once each in the prescribed order. There were no retries and no
stop-triggering invalid row:

| Fixture / format         | Result    | Destination SHA-256 / bytes                                                    | Profile / dimensions                | Elapsed / peak additional RSS / max interval |
| ------------------------ | --------- | ------------------------------------------------------------------------------ | ----------------------------------- | -------------------------------------------- |
| proof / SVG replacement  | **VALID** | `c72f6261534171e7c7048f1cccc304b6a148296ba22090c11e7a1c132e8318db` / 852,650   | `atlas-svg-v1` v1 / 400 × 200 mm    | 443.49 ms / 16.95 MiB / 6.409 ms             |
| proof / PNG              | **VALID** | `981befbd11122dd20aaa944105494438a887213810480a4c81c57b9244932e72` / 1,201,973 | `atlas-png-v1` v1 / 8192 × 4096 RGB | 13,394.75 ms / 110.47 MiB / 6.649 ms         |
| fragmented-islands / SVG | **VALID** | `022c45e9b7b3e6be7122435377a5fd0ccfac9ef550bf5f48583f5cc45cef2446` / 921,077   | `atlas-svg-v1` v1 / 400 × 200 mm    | 464.56 ms / 12.23 MiB / 6.962 ms             |
| fragmented-islands / PNG | **VALID** | `078b0407d360f3d54bf43ef3f334c0ee0a8e332f0351cd200acdf4c6da7e9e21` / 1,221,450 | `atlas-png-v1` v1 / 8192 × 4096 RGB | 12,794.41 ms / 3.63 MiB / 11.146 ms          |
| control-max / SVG        | **VALID** | `f341b22505fd5751ec0980565857a046e2182a54e6ee9d955b73fe6b5fa80d0b` / 767,851   | `atlas-svg-v1` v1 / 400 × 200 mm    | 438.63 ms / 3.44 MiB / 6.366 ms              |
| control-max / PNG        | **VALID** | `9012be2ed269ac9373a12a8fb40bc23c7161d4a93f8d2bfec6b32a675eaabf4f` / 1,129,326 | `atlas-png-v1` v1 / 8192 × 4096 RGB | 11,084.42 ms / 20.94 MiB / 6.730 ms          |

Every row proved exact fixture ID, seed, and nine controls; exact accepted/reopened state; an
inode- and hash-changing same-filesystem atomic replacement; native receipt/hash/size agreement;
the unchanged format profile, dimensions, and ceiling; absence of the native temporary; unchanged
accepted object, aspect/output/coastline/scene/package evidence; PASS reopen comparison; zero reopen
generator calls; uninterrupted foreground; equal baseline/completion membership with one
application, GPU, Networking, and WebContent process; exact sampler arithmetic and endpoint
coverage; and a maximum interval below 20 ms. Each SVG began with the exact XML declaration followed
by the SVG root. Each PNG also passed an independent complete-container check covering CRCs,
canonical `IHDR`/`sRGB`/consecutive `IDAT`/`IEND` order, full stream inflation, scanline filters,
Adler-32, and exact RGB dimensions.

The six PID-bearing CSVs were each handed to the approved owner-only retention utility immediately
after observer termination and before receipt or output inspection. All six retention receipts are
valid, all temporary CSV sources were removed, and no private path or raw content is published. The
opaque artifact identifiers are `issue101-proof-svg-replacement`, `issue101-proof-png`,
`issue101-fragmented-islands-svg`, `issue101-fragmented-islands-png`,
`issue101-control-max-svg`, and `issue101-control-max-png`; their sanitized hashes and byte lengths
are in the machine-readable receipt.

The earlier consumed proof/SVG attempt remains separately **INVALID, CONSUMED** under observer
identity `406de0abd9120cf7535a23b86da09b4c8962e98bda798e59159ba6f6945b8642`, with its original private
retention receipt and invalidation unchanged. Its identical production SVG bytes do not make that
historical observer-invalid trial valid. The current result is six valid completion-authority rows
plus one separately preserved consumed invalid attempt. These single-row qualification diagnostics
make no issue #95 matrix, timing/RSS budget, cancellation, or release-budget conclusion.

## Privacy

Public receipts contain only the gated fixture values and definition hash, approved host/build and
tool hashes, sanitized role counts, canonical accepted-state hashes, Boolean replacement/temporary/
format/foreground/membership predicates, destination hash/byte length/ceiling, timing/RSS summary,
opaque retention receipt, and sanitized invalidation authority/reason. Package paths, export paths,
private archive roots, pixels, CSV content, PIDs, UUIDs, coalitions, user names, executable paths,
and other local paths remain private.
