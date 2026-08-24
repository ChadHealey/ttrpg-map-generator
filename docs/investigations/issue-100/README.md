# Issue 100 packaged export target-session readiness qualification

This directory closes only the external visible/frontmost target-session gap recorded by
[issue #97](../issue-97/README.md). It contains a test-only controller and independent observer;
ordinary packages install neither. The one valid qualification below did not configure a fixture,
start a sampler, create an export destination, dispatch SVG or PNG, produce a measurement, or run
any issue #95 matrix operation.

## Fail-closed controller boundary

The controller accepts an exact `.app` path, bundle identifier, packaged executable SHA-256,
readiness-observer path, and readiness-observer SHA-256. Before launch it requires the approved
host, the active logged-in console GUI session, a matching package/bundle/executable identity, and
zero existing applications with the candidate bundle identifier. It then:

1. launches that exact package through `NSWorkspace` in the active console session;
2. proves exactly one matching live application and waits only for the fresh WebKit Accessibility
   window to materialize;
3. requires exactly one Accessibility window, activates the exact application, performs `AXRaise`,
   and writes `AXFrontmost`; and
4. runs a separate no-window observer process that independently reads the exact candidate
   executable identity, one application, one non-minimized positive-frame Accessibility window,
   Accessibility frontmost state, and `NSWorkspace` frontmost state twice while retaining the same
   application and window identities.

Any wrong identity, stale or duplicate process, zero or multiple candidate applications/windows,
session mismatch, activation/raise/frontmost-write failure, invisible window, foreground loss, or
identity replacement fails closed. An invalid post-launch attempt asks the exact running
application to terminate so it cannot silently satisfy the next fresh-process precondition.

The controller reuses issue #96/#97's `app.ttrpgmap.generator` identity, SHA-256 executable
authority, exact-one-candidate rule, single Accessibility-window boundary, `AXRaise`,
`AXFrontmost`, and independent Workspace foreground predicate. It does not weaken or reinterpret
issue #97's six pre-dispatch invalidations.

## Build and checks

```sh
mkdir -p /private/tmp/issue100-swift-module-cache

xcrun swiftc -module-cache-path /private/tmp/issue100-swift-module-cache \
  -warnings-as-errors -parse-as-library \
  -o /private/tmp/issue100-readiness-core-tests \
  docs/investigations/issue-100/target-session-readiness-core.swift \
  docs/investigations/issue-100/target-session-readiness-core-tests.swift
/private/tmp/issue100-readiness-core-tests

# Compile the controller and observer with AppKit, ApplicationServices, CryptoKit, and the
# predecessor executable-identity support. Then build the unchanged issue #97 package:
VITE_PACKAGED_ATLAS_OBSERVER_DISPATCH=1 \
VITE_PACKAGED_EXPORT_OBSERVER_DISPATCH=1 \
  corepack pnpm --filter @ttrpg-map/desktop tauri build --bundles app --no-sign --ci
```

The issue #90 preview, issue #94 accepted-atlas, issue #96 exact-preview, and issue #97 export
observer core suites are the predecessor gate. The root `corepack pnpm check`, privacy review,
fixture/production-surface audit, and `git diff --check` close the local repository gate.

| Check                                               | Result                                                                                  |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Issue #100 negative-path core suite                 | **PASS** — wrong identity; stale/zero/multiple app/window; activation/raise; foreground |
| Issue #90/#94/#96/#97 predecessor core suites       | **PASS**                                                                                |
| Observer-enabled packaged build                     | **PASS** — 335 frontend modules and one unsigned `.app`                                 |
| Exact #97 candidate/observer identity reproduction  | **PASS** — both SHA-256 identities reproduced                                           |
| One target-session readiness qualification          | **VALID** — one fresh application/window, raised, visible, and retained frontmost       |
| Fixture/production-surface and public-privacy audit | **PASS** — only issue #100 tooling/evidence and owning M2 docs changed                  |
| `corepack pnpm check`                               | **PASS** — 74 files, 573 passed/1 skipped TS/JS; semantic retention; 24+28 Rust tests   |
| `git diff --check`                                  | **PASS**                                                                                |

No rendered or fixture output changed, so this test/evidence-only correction requires no new
visual comparison.

## Exact target-session sequence

Compile the controller and observer to fresh private temporary executables and verify their
SHA-256 identities. Start with no candidate process, then invoke the controller outside a sandbox
that would prohibit the otherwise authorized GUI launch/activation action:

```sh
<readiness-controller> \
  <exact-observer-enabled-app-path> \
  app.ttrpgmap.generator \
  <candidate-executable-sha256> \
  <readiness-observer> \
  <readiness-observer-sha256>
```

The narrow unsandboxed invocation is the session mechanism required by this host. The controller
itself still fail-closes on the exact active-console session, app/bundle/executable identity,
application/window counts, and foreground predicates. No manual user interaction was required.

## Qualification result

The implementation commit is `6fabe0bad82a293b60746b98326e4d8f5e374a16`. It retains issue
#97's final candidate source represented by integrated commit
`8228b48139ae125432448d376cc1b8ef917257db` and reproduces the unchanged observer-enabled
packaged executable SHA-256
`94b5a8b5f3fcd43a361589f35e3449c72cf3aad13610737140c3dd749737cf4e`. The issue #97
observer at its documented identity reproduced SHA-256
`0c0d3979f3c6c50ffa375fe2459b53b7dd49fad58bd5e3b4b246aaf221db38bd`.

The final readiness controller SHA-256 was
`68c23690dcdb7f4dd329e0b2152b699ba1d6ef4248d211088aa26bb98c9475c3`; the independent
readiness observer SHA-256 was
`9f9c3254ee523f0151ce05f3b5d2573139a26e6bc432ce2c365e1b83d57419ff`.

On MacBook Pro `Mac17,2`, Apple M5, 24 GB, macOS 26.5.1 (`25F80`), exactly one fresh
non-measurement qualification was **VALID**. The exact application had exactly one Accessibility
window; the window was visible, `AXRaise` succeeded, the Accessibility frontmost write succeeded,
and the independent observer retained the same application/window identity while both
Accessibility and `NSWorkspace` reported it frontmost.

One earlier controller integration attempt launched the exact candidate but failed closed while
the fresh WebKit Accessibility service returned its transient startup `cannotComplete` state. It
occurred before activation/raise, fixture configuration, sampler start, destination creation, or
dispatch. The correction retries only that specific materialization response inside the bounded
fresh-process window wait; every other Accessibility error remains terminal. This preliminary
attempt is not the valid readiness qualification and makes no product or release conclusion.

The sanitized machine-readable receipt is in
[`qualification-2026-08-23/raw-results.json`](qualification-2026-08-23/raw-results.json). Issue #97
may now be revalidated and resumed in a new task using its unchanged final candidate and all six
unconsumed required trials. Issue #100 does not itself qualify SVG/PNG completion or any release
budget.

## Privacy and zero-operation proof

The public receipt contains only approved host/build values, bundle ID, executable/tool hashes,
Boolean readiness predicates, counts, the sanitized session mechanism, and zero-operation fields.
It contains no user name, PID, application path, local repository path, executable path, service
UUID, coalition, screenshot, pixel data, CSV, private archive location, package, or export.

There were zero configured fixtures, samplers, export destinations, SVG/PNG dispatches,
measurements, raw CSVs, retained artifacts, and consumed issue #97 trials. The six issue #97
pre-dispatch invalidations remain unchanged and invalid.
