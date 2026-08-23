# Issue 95 Apple M5 release-protocol stop evidence

- **Status:** STOPPED — observer-authority drift was confirmed before measured dispatch
- **Audited:** 2026-08-23
- **Starting/base commit:** `45f084dc06d18f62191aeca4dbc229cba0cf9938`
- **Observer-enabled packaged executable SHA-256:**
  `c72e62f837cbe0d1aa8e3f90d075712349bd49763620ac2cb75ce1b9d5fdbeca`
- **Structured sanitized evidence:** [raw-results.json](raw-results.json)

Issue #95 required the complete preview, full-generation, SVG, PNG, and cancellation matrix from
one unchanged packaged candidate. It also required an operation-specific observer receipt for every
measurement and required an immediate stop on observer-authority drift. The integrated #94 candidate
does not provide all of those authorities. No measured product operation was dispatched, no timing or
RSS observation was made, and no release-budget row receives a pass, failure, or invalid result.

## Candidate and environment

The dedicated branch started at the integrated #94 documentation commit
`45f084dc06d18f62191aeca4dbc229cba0cf9938`, which contains implementation commit
`4d65cdf7e405232687803a5b063647a0ce1d30d1`. The clean observer-enabled package was built with:

```sh
VITE_PACKAGED_ATLAS_OBSERVER_DISPATCH=1 \
  corepack pnpm --filter @ttrpg-map/desktop tauri build --bundles app --no-sign --ci
```

The arm64 executable is 10,000,528 bytes and has SHA-256
`c72e62f837cbe0d1aa8e3f90d075712349bd49763620ac2cb75ce1b9d5fdbeca`, exactly matching the
executable qualified by issue #94. The audit ran on MacBook Pro `Mac17,2`, Apple M5, 24 GB, macOS
26.5.1 (`25F80`), arm64, AC power, and Low Power Mode off. Toolchain versions were Node 24.11.0,
pnpm 11.19.0, rustc 1.97.1, and Xcode 26.4 (`17E192`). Accessibility was enabled. The already
approved owner-only private archive was recovered by opaque issue #94 artifact identity, had mode
`0700`, and contained all three prior qualification artifacts. Its path remains private.

The unchanged sources were compiled into an issue #95 full-atlas observer with SHA-256
`2a5a2eeb623bc529b6c1c225752bbce2095eb5c4d93de21aeb2a18f882305843`, RSS sampler SHA-256
`2d4d46a819d509b67ba5da63bf3c5098ebdadcc899e36f20740ed4573b8d93f2`, and retention utility
SHA-256 `1d81fd3e1a4c1a848df82606a1323426e9cb54976aa6605aab20baeeb474a4ce`. These
newly compiled binaries passed their focused tests but were not used for measurement.

## Confirmed authority drift

The stop is source-backed and precedes the first required measured fixture row:

1. The approved issue #90 preview observer measures a labelled complete preview first paint, helper
   membership, and RSS, but accepts no fixture ID or fixture definition and emits no exact seed or
   nine-control receipt. Issue #95 requires every preview observation to prove exact gated-fixture
   identity. Running it after an unaudited setup action would create a composite authority that the
   owning contract does not approve.
2. The issue #94 successor imports and proves the three gated definitions, qualifies a production
   preview, then starts sampling only for full generation and emits only the accepted-atlas
   measurement. It cannot emit the required preview timing/RSS row. Reusing its internal preview as
   a preview measurement would change the approved endpoint and receipt meaning.
3. The package exposes no approved observer-only SVG or PNG dispatch/completion path. Production UI
   receipts prove successful native output, and automated tests prove atomic replacement, but no
   packaged observer proves request-to-verified-destination timing, foreground continuity, exact
   process membership/cadence, and unchanged reopened accepted state for a gated fixture.
4. The package exposes no approved early/middle/late cancellation observer. Product tests prove
   safe points and deterministic aftermath, but no packaged receipt measures request-to-terminal
   acknowledgement while also proving no later accepted-state commit, completed-export
   presentation, or destination replacement.

Creating a Swift/JXA wrapper, adding test-only chords, combining separate receipts, polling a new
Accessibility endpoint, or inferring destination completion from an unapproved filesystem watcher
would change the observer authority. Issue #95 expressly forbids that repair. Prior issue #89
preview measurements and issue #94 single-run full qualifications remain valid for their recorded
scope; neither may be relabelled as this candidate's complete matrix.

## Protocol outcome

| Required lane                                                             | Exact outcome                                                                                                      |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Preview warm-ups and five fresh processes on three gated fixtures         | **NOT RUN** — exact-fixture preview receipt authority is absent                                                    |
| Full-generation warm-ups and five fresh processes on three gated fixtures | **NOT RUN** — global stop occurred before the first measured lane; #94 qualifications remain diagnostic only       |
| SVG/PNG timing and RSS on three gated fixtures                            | **NOT RUN** — packaged completion authority is absent                                                              |
| Six-fixture SVG/PNG destination ceilings and atomic replacement           | **NOT RUN on packaged candidate** — automated gates passed, but they are not substituted for the packaged protocol |
| Five early/middle/late preview/full/SVG/PNG cancellations                 | **NOT RUN** — packaged acknowledgement and aftermath authority is absent                                           |
| Progress cadence and operation-specific completion ordering               | **PASS in focused automated checks only** — no Apple M5 measurement conclusion                                     |

There were zero valid measurements, zero invalid measurement attempts, zero repeatable valid product
contract failures, and zero new raw sampler/capture artifacts. The private archive was therefore
not mutated. Issue #95 stopped on an observer-authority blocker, not a timing, RSS, export-size, or
cancellation-latency blocker.

## Verification

| Command or check                                                                                                                     | Result                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Issue #90 preview observer core tests                                                                                                | **PASS**                                                                                                     |
| Issue #94 atlas observer core tests                                                                                                  | **PASS**                                                                                                     |
| Issue #91 private-retention tests                                                                                                    | **PASS**                                                                                                     |
| Focused fixture dispatch, generation safe-point, progress, deterministic-aftermath, SVG/PNG orchestration, and native-boundary tests | **PASS** — 9 files, 50 tests                                                                                 |
| `corepack pnpm test:cross-platform`                                                                                                  | **PASS** — 6 PNG checks and 8 registered fixture sets                                                        |
| `corepack pnpm test:e2e`                                                                                                             | **PASS** — 22 TS/JS tests and 2 native workflow tests                                                        |
| `corepack pnpm test:visual`                                                                                                          | **PASS** — 13 tests and 8 registered fixture sets                                                            |
| `corepack pnpm test:png-export`                                                                                                      | **PASS** — 68 TS/JS, 6 Rust unit, and 4 Rust integration tests                                               |
| `corepack pnpm test:native-recovery`                                                                                                 | **PASS** — 28 APFS tests                                                                                     |
| `corepack pnpm check` on the clean starting candidate                                                                                | **PASS** — 73 files, 561 TS/JS passed, 1 skipped; semantic-retention proof; 24 Rust unit and 28 native tests |
| Final `corepack pnpm check` on the evidence tree                                                                                     | **PASS** — recorded in the branch handoff                                                                    |
| Observer-enabled packaged release build                                                                                              | **PASS** — 334 frontend modules and one unsigned arm64 `.app`                                                |

The final handoff records the documentation commit and the post-commit status check. No GitHub issue,
milestone, branch, release, or remote ref was mutated.

## Minimum executable child split

One replacement implementation issue would fail the context-fit gate: it would cross preview frame
qualification, accepted/reopened export state, native destination observation, four cancellation
families, and target-host qualification. The minimum context-fit plan is four ordered executable
children. Each child authorizes observer-only code and documentation; none authorizes product,
generator, renderer, persistence schema, fixture, workload, resolution, hardware, budget, or timeout
changes.

### Child A — qualify exact-fixture packaged preview receipts

- **Outcome:** one fail-closed preview observer accepts exactly the three gated definitions, proves
  the live seed and all nine controls immediately before unchanged production preview dispatch, and
  emits one target-host qualification receipt per fixture.
- **Permitted files:** `apps/desktop/src/packaged-atlas-observer-dispatch.ts`, its test,
  `apps/desktop/src/App.svelte` for observer-flag wiring only, new successor Swift sources and
  receipts under `docs/investigations/<child>/`, and the owning atlas-proof/release-evidence docs.
  Issue #90/#94 sources may be reused; production workflow/generation sources are read-only.
- **Dependencies:** integrated #94 and #91 retention. No other new child.
- **Execution profile:** C3 (5/10: 1 breadth + 1 uncertainty + 0 state risk + 2 verification +
  1 dependency), Frontier because false-positive release evidence is high impact;
  `gpt-5.6-sol` / high, 2026-08-23. Context fit: PASS, two boundaries (test-only dispatch and
  ScreenCaptureKit/Accessibility observer).

### Child B — qualify packaged SVG/PNG success completion

- **Outcome:** one fail-closed export observer reaches an exact registered accepted atlas through
  unchanged production save/reopen paths and qualifies SVG and PNG completion only after verified
  atomic destination replacement, with timing/RSS, size, foreground, membership, and unchanged-state
  receipts.
- **Permitted files:** a new `apps/desktop/src/packaged-export-observer-dispatch.ts` and focused test,
  `apps/desktop/src/App.svelte` for observer-flag wiring only, new Swift observer/retention sources
  and receipts under `docs/investigations/<child>/`, and owning contract/evidence docs.
  `atlas-svg-export-orchestrator.ts`, `atlas-png-export-orchestrator.ts`, native boundaries, Tauri
  filesystem code, fixtures, and production workflows are read-only and must be invoked unchanged.
- **Dependencies:** Child A for exact gated-fixture setup/receipt and #91 retention.
- **Execution profile:** C4 (7/10: 2 breadth + 1 uncertainty + 1 destination-state risk +
  2 verification + 1 dependency), `gpt-5.6-sol` / high, 2026-08-23. Context fit: PASS, two major
  boundaries (packaged dispatch/state and native destination observer).

### Child C — qualify preview/full cancellation acknowledgement

- **Outcome:** one fail-closed generation-cancellation observer qualifies early, middle, and late
  preview/full acknowledgement endpoints and proves no accepted commit plus deterministic next
  completion, once per required class on the target host.
- **Permitted files:** `apps/desktop/src/packaged-atlas-observer-dispatch.ts`, its test,
  `apps/desktop/src/App.svelte` for observer-only cancel wiring, new Swift sources/receipts under
  `docs/investigations/<child>/`, and owning docs. Generation, workflow cancellation semantics,
  progress cadence, fixtures, and timeouts are read-only.
- **Dependencies:** Child A for exact-fixture preview authority and integrated #94 for accepted-atlas
  observation.
- **Execution profile:** C3 (5/10: 1 breadth + 1 uncertainty + 0 state risk + 2 verification +
  1 dependency), Frontier for cancellation/concurrency and false-positive release risk;
  `gpt-5.6-sol` / high, 2026-08-23. Context fit: PASS, two boundaries (generation dispatch/progress
  and terminal UI/observer receipt).

### Child D — qualify SVG/PNG cancellation acknowledgement

- **Outcome:** one fail-closed export-cancellation observer qualifies early, middle, and late SVG/PNG
  acknowledgement and proves no post-acknowledgement completion presentation or destination
  replacement, recognizable temporary cleanup, and deterministic next export.
- **Permitted files:** the Child B packaged-export observer dispatch and test, `App.svelte` for
  observer-only cancel wiring, new successor Swift sources/receipts under
  `docs/investigations/<child>/`, and owning docs. Render/export algorithms, native atomic-write
  code, fixtures, output dimensions, ceilings, and timeouts are read-only.
- **Dependencies:** Child B's verified success/destination authority and #91 retention.
- **Execution profile:** C4 (7/10: 2 breadth + 1 uncertainty + 1 destination-state risk +
  2 verification + 1 dependency), `gpt-5.6-sol` / high, 2026-08-23. Context fit: PASS, two major
  boundaries (export cancellation/progress and native destination aftermath).

Combining Children C and D would exceed the two-boundary context-fit limit because generation
cancellation has accepted-state/first-paint authority while export cancellation adds native
destination and temporary-file aftermath. Combining B and D would give one issue two primary
outcomes and duplicate the target-host early/middle/late matrix during observer design. After all
four qualifications are integrated, issue #95 can be revalidated and rerun unchanged. The children
must not run its five-observation release matrix or close #70/#95 themselves.
