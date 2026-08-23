# Issue 90 packaged-preview qualification observer

This directory implements the approved, target-host-only observer from
[`milestone-2-atlas-proof.md`](../../milestone-2-atlas-proof.md#approved-packaged-preview-measurement-authorities).
It qualifies one coarse-preview observation as `valid` or `invalid`; it does not run, pass, fail,
or replace the five-run release gate from issue #84.

## Dispatch and observation method

Set `VITE_PACKAGED_PREVIEW_OBSERVER_DISPATCH=1` only while building the packaged qualification
candidate. That build installs Command-Control-Option-P as a test-only window key dispatch. Both
the visible **Generate coarse preview** button and the chord call the same `preview` action, which
uses the unchanged `AtlasWorkflow.requestPreview` request and presentation path. An ordinary build
does not install the handler. The dispatch changes no controls or viewport state.

Before dispatch, the observer:

1. rejects any host other than `Mac17,2`, Apple M5, 24 GiB, macOS 26.5.1 (`25F80`);
2. resolves the one visible packaged window through ScreenCaptureKit;
3. reads the app PID domain with `launchctl print`, requires one live UUID-suffixed GPU,
   Networking, and WebContent service, and verifies each service PID has the same active resource
   coalition and bundle ID;
4. validates executable role names only after membership is established and requires the running
   candidate executable and precompiled sampler to match caller-supplied SHA-256 identities;
5. passes exactly the app/GPU/Networking/WebContent PID set to the existing RSS sampler;
6. scrolls the single canvas visible, computes its window-local crop, starts a 512 by 256 BGRA
   ScreenCaptureKit stream, and obtains one complete baseline frame.

The observer then posts the test-only chord directly to the app PID. It makes no Accessibility
call and performs no scroll, reveal, pan, zoom, focus, or framing action until a qualifying frame
arrives. A frame qualifies only when it is complete, displayed after dispatch, differs from the
baseline, contains bounded populations of both production palette colors within the calibrated
per-channel tolerance, and foreground ownership remained uninterrupted.

Exactly one final Accessibility traversal verifies the disposable-preview label, its caption, an
enabled **Accept full atlas** control, and frontmost state. Receipt completion is the wall-clock and
RSS endpoint. The resolver then repeats the full membership and role check and requires exact
equality with the baseline set. The RSS receipt must contain a nonzero value for every resolved
process in every row, exact aggregate arithmetic, strictly increasing timestamps, a sampler-summary
count matching the CSV, no interval over 20 ms, and samples no more than 20 ms from either side of
the dispatch-to-completion interval.

## Build and focused checks

Compile the observer, its deterministic parser/predicate tests, and the existing sampler before
opening the candidate:

```sh
mkdir -p /private/tmp/issue90-swift-module-cache
xcrun swiftc -module-cache-path /private/tmp/issue90-swift-module-cache \
  -warnings-as-errors -parse-as-library -framework CryptoKit \
  -o /private/tmp/issue90-observer-core-tests \
  docs/investigations/issue-90/packaged-preview-observer-core.swift \
  docs/investigations/issue-90/packaged-preview-observer-rss.swift \
  docs/investigations/issue-90/packaged-preview-observer-security.swift \
  docs/investigations/issue-90/packaged-preview-observer-core-tests.swift
/private/tmp/issue90-observer-core-tests

xcrun swiftc -module-cache-path /private/tmp/issue90-swift-module-cache \
  -warnings-as-errors -parse-as-library \
  -framework AppKit -framework ApplicationServices -framework ScreenCaptureKit \
  -framework CoreMedia -framework CoreVideo -framework CryptoKit -framework Foundation \
  -o /private/tmp/issue90-packaged-preview-observer \
  docs/investigations/issue-90/packaged-preview-observer-core.swift \
  docs/investigations/issue-90/packaged-preview-observer-platform.swift \
  docs/investigations/issue-90/packaged-preview-observer-rss.swift \
  docs/investigations/issue-90/packaged-preview-observer-security.swift \
  docs/investigations/issue-90/packaged-preview-observer-support.swift \
  docs/investigations/issue-90/packaged-preview-observer.swift

clang -O2 -Wall -Wextra -Werror \
  -o /private/tmp/issue90-rss-timeline \
  docs/investigations/issue-76/rss-timeline.c

xcrun swiftc -module-cache-path /private/tmp/issue90-swift-module-cache \
  -warnings-as-errors -parse-as-library -framework CryptoKit \
  -o /private/tmp/issue91-preview-retention-tests \
  docs/investigations/issue-90/packaged-preview-observer-core.swift \
  docs/investigations/issue-90/packaged-preview-observer-security.swift \
  docs/investigations/issue-90/packaged-preview-retention-model.swift \
  docs/investigations/issue-90/packaged-preview-retention-core.swift \
  docs/investigations/issue-90/packaged-preview-retention-command.swift \
  docs/investigations/issue-90/packaged-preview-retention-tests.swift
/private/tmp/issue91-preview-retention-tests

xcrun swiftc -module-cache-path /private/tmp/issue90-swift-module-cache \
  -warnings-as-errors -parse-as-library -framework CryptoKit \
  -o /private/tmp/issue91-preview-retention \
  docs/investigations/issue-90/packaged-preview-observer-core.swift \
  docs/investigations/issue-90/packaged-preview-observer-security.swift \
  docs/investigations/issue-90/packaged-preview-retention-model.swift \
  docs/investigations/issue-90/packaged-preview-retention-core.swift \
  docs/investigations/issue-90/packaged-preview-retention-command.swift \
  docs/investigations/issue-90/packaged-preview-retention.swift
```

Build the test-only packaged candidate with the environment flag set for the frontend build. Give
the observer Accessibility and Screen Recording permission before the attempt, configure the
fixture through the normal controls, scroll the canvas visible, and leave the candidate frontmost.
Compute SHA-256 values from the exact packaged executable being observed and the exact sampler
binary. The raw destination must be a fresh direct child of `/private/tmp`; the sampler creates it
with owner-only permissions and refuses an existing file or symlink. Run:

```sh
/private/tmp/issue90-packaged-preview-observer \
  app.ttrpgmap.generator \
  <candidate-executable-sha256> \
  /private/tmp/issue90-rss-timeline \
  <sampler-sha256> \
  /private/tmp/issue90-preview-rss.csv
```

The CSV is a raw receipt because its header contains transient PIDs. Keep it outside the public
repository. Do not remove it manually; use the retention sequence below immediately after every
observer attempt, including an invalid attempt that produced a CSV.

## Private raw-CSV retention

The operator must approve a durable private archive root before capture. The utility has no
default destination, does not select a service, and rejects a relative, aliased, symlinked,
group/world-accessible, or repository-contained archive root. The root must already exist, be
owned by the operator, and have mode `0700`. The caller must also choose a fresh opaque artifact
identifier containing only letters, digits, hyphens, or underscores; it must not encode a PID,
host name, user name, local path, or other private data.

Use this sequence for each attempt. The shell variables are deliberately unset here: their values
are operator-approved private state and must not be copied into repository evidence.

```sh
test -n "$APPROVED_PRIVATE_ARCHIVE_ROOT"
test -n "$OPAQUE_ARTIFACT_ID"
test "$(stat -f '%Lp' "$APPROVED_PRIVATE_ARCHIVE_ROOT")" = 700

/private/tmp/issue90-packaged-preview-observer \
  app.ttrpgmap.generator \
  <candidate-executable-sha256> \
  /private/tmp/issue90-rss-timeline \
  <sampler-sha256> \
  /private/tmp/issue90-preview-rss.csv \
  > /private/tmp/issue90-sanitized-observer-receipt.json

/private/tmp/issue91-preview-retention \
  "$(git rev-parse --show-toplevel)" \
  /private/tmp/issue90-preview-rss.csv \
  "$APPROVED_PRIVATE_ARCHIVE_ROOT" \
  "$OPAQUE_ARTIFACT_ID" \
  > /private/tmp/issue91-sanitized-retention-receipt.json

test ! -e /private/tmp/issue90-preview-rss.csv
node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))' \
  /private/tmp/issue91-sanitized-retention-receipt.json
```

The retention utility opens the source without following symlinks and requires its existing
owner-only sampler permissions. Within the approved archive root, it creates an owner-only staging
directory, copies to a new owner-only file, synchronizes it, and proves source/archive SHA-256 and
byte-length equality. It writes and rereads the sanitized metadata receipt, synchronizes the
staging directory, and publishes the artifact directory with an exclusive same-filesystem rename.
It then synchronizes and reopens the published artifact, emits the sanitized receipt, and only
after that emission succeeds checks that the source path still names the locked, verified file and
removes that temporary source. It never replaces an artifact.

The only stdout object is the sanitized retention receipt. A successful receipt has
`version`, `status`, `artifactIdentifier`, `sha256`, and `byteLength`; a safe failure may add only
`failureCategory` and omits unavailable hash/length fields. It contains no archive root, temporary
path, CSV header or content, PID, or machine-specific diagnostic. Future issue #84 public evidence
must retain the receipt's opaque artifact locator, SHA-256, byte length, status, and version, but
must not retain or infer the private archive path. Exit status `0` additionally proves temporary
source cleanup. Exit status `2` means the receipt and private archive are valid but the source is
still present; the command emits no second JSON object after the retained receipt.

Any rejection, collision, permission/copy/verification/receipt-emission failure, or interruption
before the atomic publish boundary removes only the known incomplete staging files and leaves the
temporary source available. A receipt-emission failure or interruption after publish also leaves
the source available and the immutable private artifact in place. Do not retry the same identifier
by deleting or replacing that artifact: privately verify its stored receipt and exact bytes, or
obtain approval for a fresh identifier. On exit status `2`, preserve and inspect the source, then
remove that exact temporary file manually only after the private verification is accepted. Never
copy private diagnostics from a failed run into public evidence.

The operator or private-store owner is responsible for retention duration, backup, access review,
and eventual private archive deletion. This utility owns only the one-way handoff and temporary
source cleanup; it never deletes a committed private artifact.

## Receipt and invalidation schema

The observer writes one sanitized JSON object. A valid receipt contains:

- the observer schema version and approved host/build identity;
- the verified candidate-executable and sampler SHA-256 identities;
- one sanitized count for each required role;
- Boolean visual and Accessibility predicates;
- completion-time membership revalidation;
- elapsed time, settled baseline aggregate RSS, peak additional RSS, sample count, and maximum
  sampling interval.

An invalid receipt contains `status: "invalid"`, `invalidAuthority`, and a sanitized
`invalidReason`. Its visual, Accessibility, role-count, and measurement fields are absent or null,
so an invalid attempt cannot emit a timing or RSS budget conclusion.

The observer fails closed on host drift, unavailable permissions, missing or multiple windows,
partial/stale/unchanged/off-palette frames, foreground loss, Accessibility mismatch, unsupported
`launchctl print` shape, an inactive or mismatched coalition, missing/duplicate/unexpected WebKit roles,
unresolvable executable roles, exited processes, sampling failure, cadence above 20 ms, missing
dispatch/completion coverage, malformed or internally inconsistent RSS rows, identity mismatch,
unsafe or pre-existing raw destinations, or late/replaced membership at completion. Raw capture
pixels, PIDs, UUIDs, coalition identifiers,
executable paths, local paths, and machine-specific diagnostics are never written to the sanitized
receipt or committed here.
