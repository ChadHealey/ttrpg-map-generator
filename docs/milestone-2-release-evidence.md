# Milestone 2 release evidence

- **Status:** Complete under ADR-0021's Milestone 2 evidence boundary
- **Prepared:** 2026-08-22
- **Updated:** 2026-08-29
- **Issue:** [#68 — Prove the Milestone 2 whole-world atlas workflow end to end](https://github.com/ChadHealey/ttrpg-map-generator/issues/68)
- **Normative contract:** [Milestone 2 whole-world atlas proof](milestone-2-atlas-proof.md)
- **Retrospective:** [Milestone 2 retrospective](retrospectives/milestone-2.md)
- **RSS attribution:** [Apple M5 / JavaScriptCore RSS investigation](milestone-2-javascriptcore-rss-investigation.md)

This report keeps functional, semantic, package, render, visual, resource, and release-hardware
evidence separate. A `PASS` may be recorded only beside reproduced evidence whose exact tested
tree is named. `FAIL` records valid evidence that misses a contract requirement. `NOT RUN` records
downstream work prohibited by a stop condition. `PENDING` means the final command or review has not
yet been recorded. `OUTSTANDING` means the required reference protocol has not yet passed.
`EXTERNAL` means completion requires a remote action that was deliberately prohibited while
preparing issue #68. `DEFERRED — M9` preserves an unrun or consumed release-hardening row under
[ADR-0021](adr/0021-defer-packaged-performance-evidence-to-milestone-9.md); it is not a pass and does
not block Milestone 2.

Milestone 2 cannot be called complete while an M2-owned row is `FAIL`, `NOT RUN`, `PENDING`,
`OUTSTANDING`, or `EXTERNAL`. The current Apple M5/24-GB development machine remains the designated
reference environment. The issue #89 coarse-preview matrix passes the revised wall-clock and
unchanged memory limits. ADR-0021 moves the other operation and packaged cancellation lanes, with
their existing limits and history intact, to Milestone 9 release hardening.

## Candidate and environment

| Item                      | Recorded value                                                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch                    | `main`                                                                                                                                          |
| Starting integration HEAD | `3d967a5da7abadb8d8fc4bbc751e0a26b8ae2b20`                                                                                                      |
| Local evidence HEAD       | `0168c7c1b52a4334773d861e438ef70dbf6657cd`                                                                                                      |
| Remote CI release HEAD    | [`713dc1039f59cd18864be6581b0d603adb2072c1`](https://github.com/ChadHealey/ttrpg-map-generator/commit/713dc1039f59cd18864be6581b0d603adb2072c1) |
| Documentation HEAD        | The commit containing this report; its exact hash is recorded in the issue handoff                                                              |
| Host                      | MacBook Pro `Mac17,2`, Apple M5, 10 cores, 24 GB unified memory                                                                                 |
| Operating system          | macOS 26.5.1, build `25F80`                                                                                                                     |
| Node / pnpm / Rust        | Node 24.11.0 / pnpm 11.19.0 / rustc 1.97.1                                                                                                      |
| Package form              | Unsigned local v0.1.0 arm64 `.app`; 9.6 MiB bundle, ad-hoc linker signature                                                                     |
| Reference-hardware claim  | Designated reference environment for Milestone 2 release measurements                                                                           |

The starting HEAD identifies the already reviewed #65–#67 chain before #68 changes. The local
evidence HEAD is the exact code/fixture tree used by the costly local gates and packaged exercise
below. Issue #71's remote CI release HEAD adds the compact-reader timeout correction and is the
exact commit exercised by the linked macOS/Linux matrix. This documentation-only report records
that evidence separately because a commit cannot contain its own hash.

## Acceptance matrix

| Contract lane                | Required evidence                                                                                                                              | Status            | Evidence record                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------- |
| Registered desktop inputs    | Seed `81985529216486895` and all nine validated default controls are visible in the packaged app                                               | **PASS**          | Packaged workflow steps 1–2 below                                            |
| Preview boundary             | Cancel and restart one labelled coarse preview; preview remains disposable and cannot become accepted bytes                                    | **PASS**          | Packaged workflow step 3 plus focused orchestration tests                    |
| Full acceptance              | Full profile is generated separately, validated, and committed atomically; stable semantic identities are inspectable                          | **PASS**          | Packaged workflow step 4 and canonical fixture lane                          |
| Geography reroll             | Macro revision and declared dependents change while paper, user intent, seed, versions, locks, and unrelated revisions stay canonical          | **PASS**          | `baseline` → `geography-rerolled` canonical comparison                       |
| Appearance reroll            | Three appearance aspects/revisions and render composite change while all semantic geography and canonical coastline bytes stay fixed           | **PASS**          | `geography-rerolled` → `appearance-rerolled` canonical comparison            |
| Native save and unload       | Immutable accepted snapshot is committed atomically and accepted document plus scene are truly unloaded                                        | **PASS**          | Packaged workflow steps 7–8 and native recovery gate                         |
| Generator-free reopen        | Native package validates; accepted aspect/output bytes, package fingerprint, scene semantics, SVG, and PNG agree; generator call count is zero | **PASS**          | Packaged workflow step 9, tripwire test, and saved-project fixture           |
| Milestone 1 compatibility    | Released Milestone 1 projects and migrations reopen without drift or generator invocation                                                      | **PASS**          | Cross-platform, native-recovery, and end-to-end gates                        |
| Reopened SVG export          | `atlas-svg-v1`, 400 × 200 mm, deterministic bytes, native atomic receipt, accepted document unchanged                                          | **PASS**          | Packaged workflow step 10 and artifact record                                |
| Reopened PNG export          | `atlas-png-v1`, 8192 × 4096, deterministic repeat bytes, native atomic receipt, accepted document unchanged                                    | **PASS**          | Packaged workflow step 10, PNG gate, and artifact record                     |
| Evidence separation          | Canonical aspects, accepted outputs, package checksums, geometry, scene/SVG structure, PNG pixels, and performance remain distinct lanes       | **PASS**          | Fixture manifest/review records and sections below                           |
| Geometry                     | Closed/wound/non-self-intersecting rings; exact partition; identity/order; containment/connectivity; seam/pole and post-quantization validity  | **PASS**          | Root check, cross-platform fixtures, and geometry review                     |
| Visual gallery               | Six registered 1600 × 800 gallery rows plus full-size seam, pole, channel, island, echo, fine-ink, and raster-boundary crops inspected         | **PASS**          | Visual review table below                                                    |
| Deterministic resource gates | PNG dimensions, file ceiling, bounded band/surface allocation, progress/cancellation semantics, and deterministic aftermath pass               | **PASS**          | `pnpm test:png-export`; this is not the release benchmark                    |
| Packaged macOS app           | Unsigned `.app` builds and the complete visible workflow is exercised through that bundle                                                      | **PASS**          | Package and workflow records below                                           |
| Apple M5/24-GB budgets       | M2 coarse preview passes; retained full-generation/export and packaged cancellation matrices remain visible                                    | **DEFERRED — M9** | Preview passes revised budget; ADR-0021 moves remaining lanes to Milestone 9 |
| macOS/Linux release matrix   | Exact final commit passes required CI on both platforms with filesystem evidence                                                               | **PASS**          | [Issue #71 matrix](#remote-ci-and-milestone-state)                           |
| Milestone issue state        | Every included issue is closed or explicitly moved out                                                                                         | **PASS**          | Retained release work moved to Milestone 9; superseded records closed        |

## Exact local command record

The costly commands and packaged exercise below ran from the evidence implementation HEAD. The
root check recorded below ran against the completed documentation tree immediately before its
docs-only commit; it is rerun on that exact final HEAD and the commit hash/result are recorded in
the local handoff. Capture the exit code, duration, and any artifact directory without replacing a
failed result with a narrower command.

| Command                                                                                 | Result              | Notes                                                                                                                                   |
| --------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm check`                                                                   | **PASS (382.13 s)** | Completed documentation tree passed 66 files / 525 TS/JS tests and 52 Rust tests; exact committed-HEAD rerun is recorded in the handoff |
| `corepack pnpm test:cross-platform`                                                     | **PASS (240.92 s)** | Six PNG fixture checks and all eight registered fixture sets passed locally on macOS; Linux remains CI evidence                         |
| `corepack pnpm test:native-recovery`                                                    | **PASS (302.45 s)** | 28 native tests passed on macOS/APFS, including released M1 and M2 recovery workflows                                                   |
| `corepack pnpm test:e2e`                                                                | **PASS (857.80 s)** | 4 TS files / 22 tests and both native M1/M2 workflow bridges passed; reopen called zero generators                                      |
| `corepack pnpm test:visual`                                                             | **PASS (242.54 s)** | 13 visual tests plus all eight registered fixture sets passed; human review is below                                                    |
| `ATLAS_PNG_PROOF_OUTPUT_DIR=<temporary-output-directory> corepack pnpm test:png-export` | **PASS (100.23 s)** | 8 TS files / 68 tests, 6 Rust unit tests, and 4 Rust integrations passed; retained six large outputs                                    |
| `corepack pnpm build`                                                                   | **PASS (1.48 s)**   | 327 modules; production bundle 479.62 kB JavaScript / 134.69 kB gzip                                                                    |
| `corepack pnpm --filter @ttrpg-map/desktop tauri build --bundles app --no-sign --ci`    | **PASS (14.31 s)**  | Built the expected unsigned arm64 `.app`                                                                                                |

Focused iteration checks may be listed in the issue handoff, but only the complete commands above
close their corresponding release rows.

## Packaged visible-workflow record

Use a fresh `.mapworld` destination in an existing temporary parent. Before launch, confirm the
default Downloads SVG and PNG do not exist or move them aside. Exercise the installed bundle, not a
Vite development window or a test-only CLI.

| Step | Visible action and assertion                                                                 | Status / evidence                                                                                                                       |
| ---- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Launch the unsigned packaged macOS `.app`; record bundle path and application version        | **PASS** — v0.1.0 arm64 bundle launched through `open -n`                                                                               |
| 2    | Confirm seed `81985529216486895` and all default controls                                    | **PASS** — seed plus nine defaults read from named Accessibility controls                                                               |
| 3    | Start, cancel, and restart the labelled coarse preview; no accepted state changes            | **PASS** — Cancel became available and was pressed after 36 ms; `atlas.land-water.cancelled`, `EMPTY`, then restart completed in 573 ms |
| 4    | Accept the independently generated full atlas; inspect stable landmass/water identities      | **PASS** — production acceptance completed in 31.045 s and populated render/semantic inspection                                         |
| 5    | Preview then commit geography reroll; inspect its fixed/change declaration and hashes        | **PASS** — review ready in 39 ms; production transaction completed in 47.313 s                                                          |
| 6    | Preview then commit appearance reroll; confirm semantic/coastline hashes remain fixed        | **PASS** — review ready in 35 ms; visible accepted receipt confirmed declared isolation                                                 |
| 7    | Save through a fresh absolute `.mapworld` destination; record native package fingerprint     | **PASS** — fresh first-save completed atomically in 97.973 s; fingerprint below                                                         |
| 8    | Unload; confirm accepted document, preview, scene, receipts, and inspection state are absent | **PASS** — 37 ms; phase `CLOSED`, all work/export controls disabled, only reopen enabled                                                |
| 9    | Reopen natively; confirm equality `PASS`, identical atlas, and zero generator calls          | **PASS** — 46.943 s; reopen evidence `PASS`, generator calls `0`, hashes below                                                          |
| 10   | Export SVG and 8192 × 4096 PNG from reopened state; record verified receipts                 | **PASS** — both native receipts verified; PNG completed in 10.766 s on this non-reference host                                          |

### Packaged artifacts

| Artifact          | Path                                                                         | SHA-256 / fingerprint                                                                                                                                            | Bytes / dimensions                                     | Status   |
| ----------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------- |
| Unsigned `.app`   | `apps/desktop/src-tauri/target/release/bundle/macos/TTRPG Map Generator.app` | executable `af2050fab3ccd7acc4c3becbdb08ecf05515a922df853b03e9f010aaf746cf5f`; code-directory `958471821e69686cc8fbd06d30a3b605b5e2701146dcff5184818f69326b7824` | 9.6 MiB bundle; arm64; v0.1.0; ad-hoc linker signature | **PASS** |
| Saved `.mapworld` | Temporary local package (not retained)                                       | manifest `98f0689bb0ed066483edc7f0de778a32c4dbf23f73469fcf46dbf451a562aaee`; map `f7cfdce090d98974da55ef06d5acf3471ba3826bb3b8faf6023785cd836a1667`              | 79 MiB package; canonical map 82,482,435 bytes         | **PASS** |
| Reopened SVG      | `atlas-81985529216486895.svg`                                                | `d1907f45b173d3d008b72de320d845541316549b2e8f52dbeaa30883e2c0d7d5`                                                                                               | 852,650 bytes; 400 × 200 mm; viewBox 2048 × 1024       | **PASS** |
| Reopened PNG      | `atlas-81985529216486895.png`                                                | `981befbd11122dd20aaa944105494438a887213810480a4c81c57b9244932e72`                                                                                               | 1,201,973 bytes; 8192 × 4096 RGB                       | **PASS** |

The temporary package and Downloads exports are local exercise artifacts, not registered fixture
goldens. Both export destinations were confirmed absent before the first native commit.

## Independent evidence lanes

Record each lane independently. Equal PNGs do not establish semantic equality, and an equal
package fingerprint does not establish that the renderer used the accepted scene without repair.

| Evidence class             | Boundary and comparison                                                                                         | Status / location                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Canonical accepted records | Persistence-owned complete aspect bytes and set digest at baseline, geography-rerolled, and appearance-rerolled | **PASS** — checkpoint `accepted-aspects.aspects.index.canonical` files          |
| Canonical accepted outputs | Output-only bytes and set digest at the same accepted checkpoints                                               | **PASS** — same indexes record every output length and SHA-256                  |
| Canonical coastline        | `worldCoastline.geometry` output digest and exact equality across appearance reroll/reopen                      | **PASS** — appearance/reopen package comparison and displayed digest            |
| Authoritative package      | Manifest plus required-file SHA-256 values after native save and recovery                                       | **PASS** — registered saved project and packaged artifact above                 |
| Reopen comparison          | Decoded appearance-rerolled vs reopened records, outputs, coastline, and scene semantics                        | **PASS** — `expected/reopened/accepted-atlas.reopen.canonical`; zero generators |
| Geometry/property          | Topology, classification, identity, seam, pole, quantization, and projection assertions                         | **PASS** — root, cross-platform, and adversarial/property gates                 |
| Render structure / SVG     | Stable scene sources/order and canonical `atlas-svg-v1` bytes                                                   | **PASS** — scene checkpoints and four SVG checkpoints                           |
| PNG visual/raster          | Production `atlas-png-v1` bytes, independently reconstructed rows, and reviewed images/crops                    | **PASS** — gallery, large-output gate, and human review below                   |
| Resource semantics         | Bounded raster allocation and progress/cancellation/deterministic-aftermath assertions                          | **PASS** — PNG gate; distinct from process-tree RSS benchmark                   |
| Reference performance      | Packaged Apple M5 timing, process-tree RSS, and acknowledgement latency                                         | **DEFERRED — M9** — retained under ADR-0021                                     |

## Visual and large-export review

The six registered fixtures each retain a reviewed 1600 × 800 gallery PNG. Generate two disposable
8192 × 4096 exports from the production path, byte-compare them, and record their hashes and byte
sizes. Review the normal whole view and the contract crops; a successful visual test process is not
human approval.

| Fixture                                | 8192 run 1 SHA-256 / bytes                                                     | 8192 run 2 SHA-256 / bytes | Full, seam, pole, channel/island, echo/fine ink, raster-boundary review      |
| -------------------------------------- | ------------------------------------------------------------------------------ | -------------------------- | ---------------------------------------------------------------------------- |
| `milestone-2-atlas-proof`              | `f3fd51eb9ea14854a9e7946d5a48ced856a47dc259ed40bf5ae98793174b1c28` / 1,068,694 | identical                  | **PASS** — full view, poles, seam, fine ink, and band joins clean            |
| `milestone-2-atlas-fragmented-islands` | `080fb0dc741fefaed94be29551f1084e2f6c8a05cbcdb81812616614f632917f` / 1,186,716 | identical                  | **PASS** — narrow channels and small islands remain open and distinct        |
| `milestone-2-atlas-connected-majority` | `3c42f39413e66a76e193300784979c9cb7732ba7edbca1b29cd1c673ded8f6b1` / 1,150,157 | identical                  | **PASS** — wrapped majority landmass, marine holes, poles, and islands clean |
| `milestone-2-atlas-seam-crossing`      | `316fca31ca694aefba5672169cb7e09fac77eb7412a30d0cad2e325260735cce` / 1,106,318 | identical                  | **PASS** — paired seam edges agree without closure stroke or clipped echo    |
| `milestone-2-atlas-control-min`        | `a592a55e07541ec7aadf5d9c466d8f07a5a431504f1179b2d1b91eecc23eec60` / 888,743   | identical                  | **PASS** — polar regions, long edges, and band transitions clean             |
| `milestone-2-atlas-control-max`        | `e8e8c39533e999188bc58b3bfcdd60a8c4d397413e9cb8aede851db3e202d159` / 1,128,083 | identical                  | **PASS** — all separated land paths and smallest islands remain legible      |

Record the encoder/profile as `atlas-png-v1` version 1, exact `8192 × 4096` dimensions, and the
reference environment with every row. The two in-memory runs compared byte-for-byte; one file per
row was retained temporarily for visual review. All nine registered 1600 × 800 gallery checkpoints
were also reviewed. Geography reroll changes the silhouettes; appearance reroll keeps
the geography-rerolled compound-path geometry hash fixed; appearance and reopened PNGs are
byte-identical at SHA-256 `875b15f71e962c8b2c811bf8b79e1f8ef30d2c58fe789069a2ec84bcc928e6cb`.
Their SVGs are also identical at the reopened SVG hash above. The packaged 8192 × 4096 reopened PNG
was separately inspected at normal scale and shows clean seams, poles, channels, coastline ink,
echo strokes, and band joins. Its wrapped-edge mean absolute RGB difference is `0.1632/255`; only
four isolated high-difference rows occur at coastline antialiasing intersections. Its worst
absolute 64-row band join is `1.3026/255`, lower than its local neighbors, and both 14-pixel polar
margins contain zero near-black coastline or echo-color pixels. The reviewed reopened-app screenshot
records locked accepted controls, reopened status, the fresh package target, verified PNG path, and
completed progress without overlap or clipping. Any intentional fixture update also requires its
independent, append-only review record under [fixture conventions](07-fixture-conventions.md).

## Independent review and corrections

- The original desktop candidate exposed generation and export but no visible save, unload, or
  reopen lifecycle. The workflow now drives the released native persistence boundary and displays
  separate canonical/package/reopen evidence.
- The original six M2 fixtures were explicitly pre-persistence baselines. All six were migrated
  one at a time with append-only review records; the old kernel/scene/SVG/PNG bytes remain
  unchanged, while persistence-owned indexes and the main authoritative saved project were added.
- The latest pre-#68 remote Linux and macOS runs (`31976706397` and `32044550190`) failed because a
  redundant full coastline generation exceeded the unchanged 60-second test timeout. The duplicate
  generation was removed without loosening the timeout or revision assertions; the focused test
  completed locally in 32.90 seconds. A fresh remote matrix is still required.
- Persisted phases originally allowed generation/reroll calls to escape `saved`, `closed`, or
  `reopened` state. The final policy makes those phases read-only, adds stable phase diagnostics,
  locks UI controls and the target while busy, clears stale diagnostics after success, and permits
  export only from reopened state.
- Focused state-machine tests now cover successful save/close/reopen, native failure atomicity,
  delayed concurrent persistence calls, and every invalid post-save generation/reroll transition.
  The final independent follow-up found no remaining actionable lifecycle issue; its fast workflow
  set passed 11/11 and the desktop check reported zero errors and warnings.

## Performance and resource evidence

### Current development Mac

Results from this Apple M5/24-GB host establish the designated reference environment for release
measurements as well as deterministic output, file ceilings, allocation bounds, and
progress/cancellation state semantics. The coarse-preview protocol is complete. The remaining
formal protocol is required in Milestone 9 under ADR-0021; record it without replacing a failed
result with a narrower command.

Issue #76 attributes the full-generation failure in the
[Apple M5 / JavaScriptCore RSS investigation](milestone-2-javascriptcore-rss-investigation.md).
The exact committed clean packaged proof remains over budget at 1,694.8 MiB additional RSS. Production-scheduling phase and
unload observations show both a large transient WebContent high-water mark and a substantial live
accepted representation; no production behavior or release limit changed.

| Workload                     | Elapsed observation                                                                             | Memory observation | Interpretation                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------- |
| Preview / full generation    | Preview 573 ms; full 31.045 s; geography reroll 47.313 s                                        | Not sampled        | Existing observation; full generation exceeds the 10 s budget   |
| Save / reopen                | Save 97.973 s; unload 37 ms; reopen 46.943 s                                                    | Not sampled        | Report-only by contract on every host                           |
| SVG export                   | Not instrumented; verified atomic receipt                                                       | Not sampled        | Deterministic 852,650-byte result; not a budget claim           |
| 8192 × 4096 PNG export       | 10.766 s                                                                                        | Not sampled        | Report-only; bounded-band test is not aggregate RSS             |
| Cancellation acknowledgement | Cancel control became available and was pressed after 36 ms; visible cancelled receipt followed | Not sampled        | Accessibility observation, not protocol acknowledgement latency |

### Required Apple M5/24-GB protocol — valid preview failure

> **Issue #88 preview observation (2026-08-20): INVALID — no release determination.** The
> foreground-preserving clean packaged attempt did not establish the required fully painted
> first-paint boundary or verified process tree. Its timing/RSS rows are retained only as invalid
> harness evidence in
> [`investigations/issue-84/preview-gate-2026-08-20`](investigations/issue-84/preview-gate-2026-08-20/decision.md).
> They must not be used to pass, fail, stop, or resume the release protocol.

> **Owner decision (2026-08-21):** the release observer may use the approved test-only,
> no-scroll preview dispatch and the pinned, fail-closed `launchctl print` process-tree resolver
> defined in the [Milestone 2 atlas-proof contract](milestone-2-atlas-proof.md#approved-packaged-preview-measurement-authorities).
> This authorization preserves the existing workloads and numeric limits. It does not make the
> invalid issue-88 observations valid; a bounded observer implementation must first demonstrate
> the approved boundaries before issue #84 resumes.

Issue #84 resumed the protocol on 2026-08-22 with the approved issue #90 observer. The exact
documentation candidate `ba10bc4a2902cb8c56137bc90b44fe3764bf02a7` contains the CI-tested
implementation commit `713dc1039f59cd18864be6581b0d603adb2072c1` plus only this report's issue #71
evidence. The observer-enabled packaged executable SHA-256 was
`931235e8a989a3980533c7ba5387ba3622520762f3a05ae551856eb6eec116ee`.

Both the untimed warm-up and first fresh-process proof-fixture observations produced valid issue #90
receipts. The measured fresh process completed in **861.25 ms**, exceeding the unchanged 750 ms
limit, while its 118.80 MiB additional process-tree RSS passed the 256 MiB limit. One failed run
fails the five-run gate, so the protocol stopped before the remaining fixtures, operations, and
cancellation trials. The complete sanitized result, per-process peaks, raw-receipt identities,
commands, host state, candidate gates, and limitations are recorded in the
[issue #84 release-protocol evidence](investigations/issue-84/release-protocol-2026-08-22/README.md).
The exact sanitized observer outputs are durable, but the PID-bearing sampler CSVs were not moved
from ephemeral private temporary storage before they became unavailable. Raw-artifact retention is
therefore an explicit unmet evidence limitation and must be corrected on any authorized rerun.

### Issue #89 post-repair coarse-preview proof (2026-08-23)

[ADR-0019](adr/0019-coarse-preview-release-budget.md) revises only the coarse-preview wall-clock
limit to `900 ms` and retains `750 ms` as a reported stretch target. The fixed workload, labelled
first-paint endpoint, five-fresh-process rule, `256 MiB` peak additional process-tree RSS limit,
observer authorities, progress and cancellation requirements, and all other operation limits remain
unchanged.

Issue #89 removed the attributed repeated water-component traversal without expanding into workers,
scheduling, or observer changes. The packaged candidate was based on local HEAD
`2d4e9a216b0ec4ccd1bbe20f706cfda7e9007d7d`; its executable SHA-256 was
`0327af7dcc5ab794e0d3f191a89bb62dcde60f5c985c7a56cb5acc944c4fa548`. Observer
`packaged-preview-observer-v2` had SHA-256
`a0f1959fcc8b200c900094a845b77fb63c86582904acf97211323779ac2a079a` and used sampler SHA-256
`2e74843ef4e566c0aa27e95efdb000cdd4d17a2caa6c9b834ab1c256382781f6` on MacBook Pro
`Mac17,2`, Apple M5, 24 GB, macOS 26.5.1 (`25F80`). Every run revalidated one application, one GPU,
one Networking, and one WebContent process; the maximum observed RSS sample interval was `7.13 ms`.

The proof fixture's untimed warm-up completed in `756.73 ms` at `119.30 MiB` peak additional RSS.
The required early clean-process checkpoint then passed at `731.69 ms` and `117.75 MiB`, so the
full matrix proceeded without expanding into workers, scheduling, or observer changes. The final
corrected fresh-process matrix was:

| Fixture                                | Run 1                  | Run 2                  | Run 3                  | Run 4                  | Run 5                  | Median    | Worst     | ≤750 ms |
| -------------------------------------- | ---------------------- | ---------------------- | ---------------------- | ---------------------- | ---------------------- | --------- | --------- | ------- |
| `milestone-2-atlas-proof`              | 750.31 ms / 125.06 MiB | 770.10 ms / 127.77 MiB | 756.46 ms / 115.23 MiB | 761.62 ms / 122.45 MiB | 750.98 ms / 122.14 MiB | 756.46 ms | 770.10 ms | 0/5     |
| `milestone-2-atlas-fragmented-islands` | 789.86 ms / 157.72 MiB | 795.20 ms / 156.77 MiB | 744.92 ms / 153.61 MiB | 746.26 ms / 155.64 MiB | 803.13 ms / 156.33 MiB | 789.86 ms | 803.13 ms | 2/5     |
| `milestone-2-atlas-control-max`        | 745.19 ms / 132.39 MiB | 794.54 ms / 132.72 MiB | 807.35 ms / 133.28 MiB | 790.15 ms / 132.86 MiB | 809.40 ms / 133.16 MiB | 794.54 ms | 809.40 ms | 1/5     |

All fifteen corrected fresh runs passed `900 ms` and `256 MiB`; three met the `750 ms` stretch
target. Four earlier control observations are excluded because the required control-max seed had not
been set in the app. They remain retained as misconfigured-attempt evidence and are not counted in
the fixture matrix.

The warm-up, early checkpoint, and all fifteen qualifying sampler CSVs are retained under the
approved private archive using artifact identifiers `issue89-final-proof-warmup`,
`issue89-final-proof-checkpoint`, `issue89-final-proof-1` through `issue89-final-proof-5`,
`issue89-final-fragmented-islands-1` through `issue89-final-fragmented-islands-5`, and
`issue89-final-control-max-1` through `issue89-final-control-max-5`. Retention receipts record each
raw artifact's byte length and SHA-256 without publishing transient PIDs, coalition identifiers,
service UUIDs, or local paths. This corrects the raw-artifact retention limitation from issue #84.

The required environment is an idle release build with packaged local assets, power connected, Low
Power Mode off, no debugger/developer tools, and no network dependency. After one untimed warm-up,
measure five fresh processes. Sample aggregate additional RSS for the complete application process
tree at intervals no greater than 20 ms and report every run plus median and worst.

| Operation                            | Fixed limit                                                                     | Required evidence status                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Coarse preview                       | ≤900 ms and ≤256 MiB additional process-tree RSS; report ≤750 ms stretch target | **PASS** — all 15 final fresh runs passed; worst time 809.40 ms, worst RSS 157.72 MiB            |
| Full generation                      | ≤10 s and ≤768 MiB additional process-tree RSS                                  | **DEFERRED — M9** — issue #95 stopped before measured dispatch                                   |
| SVG export                           | ≤3 s, ≤512 MiB, destination ≤32 MiB                                             | **DEFERRED — M9** — completion path qualified by #101; matrix remains unrun                      |
| PNG export                           | ≤15 s, ≤1 GiB, destination ≤64 MiB                                              | **DEFERRED — M9** — completion path qualified by #101; matrix remains unrun                      |
| Preview cancellation                 | Acknowledgement ≤100 ms                                                         | **DEFERRED — M9** — #98/#102/#103 and #122/#124/#126 remain invalid/consumed; #104 is unconsumed |
| Full-generation/SVG/PNG cancellation | Acknowledgement ≤500 ms                                                         | **DEFERRED — M9** — observer path remains unimplemented and trials remain unrun                  |

### Issue #84 partial full-generation rerun (2026-08-23)

Issue #84 resumed the remaining full-generation lane on exact candidate
`1e11b5f2887e12d6629603dae0c5dec0e854cd6d`, whose observer-enabled packaged executable SHA-256
was `0327af7dcc5ab794e0d3f191a89bb62dcde60f5c985c7a56cb5acc944c4fa548`. The repository gate,
issue #90 observer/retention tests, and packaged build passed before measurement.

Five proof-fixture and five fragmented-islands fresh-process measurements were retained, but their
Accessibility endpoint did not establish the required first fully painted accepted atlas. They
therefore have no release-budget conclusion. Their diagnostic medians and worst values, together
with one separately cadence-invalidated fragmented-islands attempt, remain available for
investigation only.

The protocol stopped before control-max observer dispatch because two materially different native
popup methods failed exact readback of its three required enum controls. No weaker fixture claim,
new production fixture loader, or additional test-only production path was authorized. Control-max
full generation, all exports, and all cancellation trials remain unrun. The sanitized per-run
values, per-process peaks, observer qualifications, private raw-artifact receipts, known tool
hashes, missing-command limitation, and stop record are in the
[issue #84 partial protocol evidence](investigations/issue-84/release-protocol-2026-08-23/README.md).

### Issue #94 packaged full-atlas qualification (2026-08-23)

Issue #94 added the bounded observer-only path that issue #84 lacked, without changing production
generation, registered fixture authority, or release limits. The implementation candidate was
`b6d62b37a82d94c067d0344124aeef032d198b8a`; its observer-enabled packaged executable SHA-256 was
`c72e62f837cbe0d1aa8e3f90d075712349bd49763620ac2cb75ce1b9d5fdbeca`. The successful runs used
observer SHA-256 `232ec1e222dc04eaf43d884a548c0da1683cdadab7d19fc8403ecd755812090a`, sampler
SHA-256 `974fcf7c72b66d39e3851e8ca06910b0d8b8cdace4b7796bbe83cdb2f687fef6`, and retention
SHA-256 `d967f2662b952898ecf659699117e4e43d65db54f562b67a0a2d76a735164052`.

One fresh packaged process for each required fixture produced a valid first-fully-painted accepted
atlas receipt on MacBook Pro `Mac17,2`, Apple M5, 24 GB, macOS 26.5.1 (`25F80`):

| Fixture                                | Diagnostic elapsed | Diagnostic peak additional RSS | Max interval | Qualification |
| -------------------------------------- | -----------------: | -----------------------------: | -----------: | ------------- |
| `milestone-2-atlas-proof`              |        5,491.61 ms |                     413.33 MiB |     7.916 ms | **VALID**     |
| `milestone-2-atlas-fragmented-islands` |        6,934.09 ms |                     410.78 MiB |    12.296 ms | **VALID**     |
| `milestone-2-atlas-control-max`        |        4,860.74 ms |                     419.95 MiB |     8.877 ms | **VALID**     |

Every receipt proves the exact checked-in seed and all nine controls; a complete changed
accepted-land/water/ink frame that rejects the disposable preview; uninterrupted foreground;
final accepted Accessibility state; one application, GPU, Networking, and WebContent process;
completion membership equality; valid RSS arithmetic; endpoint coverage; and cadence. The raw
CSVs were retained privately and their temporary copies removed under opaque artifact identifiers
`issue94-qualification-proof`, `issue94-qualification-fragmented-islands`, and
`issue94-qualification-control-max`. Their sanitized retention SHA-256 values are respectively
`283bafd2efc9b3fceb83f9899616f7cded9a46758e21ed5bc92e29035b7d2743`,
`f22e9e6f7b2d63e667dc88bab5d692d3fb3fce5e6fd92764a5c2d100e532e073`, and
`b195d559a186454f06fae2f8497589e76771e407e3b96fd45f46dbb0cea81393`.

Three pre-dispatch fixture-receipt mismatches failed closed before any measured full-generation
dispatch or raw artifact. They have no timing, RSS, or release conclusion. Complete sanitized
receipts, definition hashes, invalidations, runbook, privacy boundary, and retained-artifact byte
lengths are in the
[issue #94 qualification evidence](investigations/issue-94/README.md).

These three observations qualify the path only. They are not a warm-up plus five-fresh-process
matrix, do not establish a full-generation budget pass or fail, and do not authorize continuing
into exports or cancellation. Issue #95 owns the complete successor release protocol.

Run wall-clock and memory gates for `milestone-2-atlas-proof`,
`milestone-2-atlas-fragmented-islands`, and `milestone-2-atlas-control-max`; apply SVG/PNG file
ceilings to all six fixtures. Exercise early, middle, and late cancellation five times at each safe
point and verify no commit/replacement occurs after acknowledgement. The detailed protocol and its
unchanged acceptance meanings remain owned by the
[atlas-proof contract](milestone-2-atlas-proof.md#performance-progress-cancellation-and-resource-budgets).

### Issue #95 observer-authority stop (2026-08-23)

Issue #95 audited and built the exact integrated #94 candidate at
`45f084dc06d18f62191aeca4dbc229cba0cf9938`. Its observer-enabled packaged executable SHA-256 was
`c72e62f837cbe0d1aa8e3f90d075712349bd49763620ac2cb75ce1b9d5fdbeca`, exactly matching #94's
qualified binary. The named focused observer, deterministic generation, export, native recovery,
visual, E2E, cancellation, cross-platform, root, and packaged-build gates passed.

The hardware matrix stopped before measured dispatch because the integrated authorities cannot
produce every receipt #95 requires without an observer change. The issue #90 preview observer does
not prove gated fixture identity; the issue #94 observer proves exact fixture identity but samples
and emits only full generation; and the candidate has no approved packaged SVG/PNG completion or
early/middle/late cancellation acknowledgement/aftermath observer. Automated product checks remain
valid but cannot substitute for target-host timing/RSS/acknowledgement evidence.

No measured operation ran, so there are no valid observations, invalid attempts, medians, worst
values, or budget failures to report. The approved private archive was ready, but no new raw
artifact was created or retained. The complete sanitized authority audit, exact outcomes, tool
hashes, gate results, commands, privacy status, and minimum four-child executable split are in the
[issue #95 stop evidence](investigations/issue-95/release-protocol-2026-08-23/README.md). Issue #95
did not pass; it stopped on the contract-required observer-authority blocker without repairing it.

### Issue #96 exact-fixture packaged-preview qualification (2026-08-23)

Issue #96 added the bounded observer-only preview authority that issue #95 found missing, without
changing production generation, fixtures, workload, hardware, budgets, or timeouts. The exact
implementation candidate was `714be9b092a4780dd2ecb1e7e9c20684ea77edf7`; its observer-enabled
packaged executable SHA-256 was
`9e19555d1fbcdd7a72515c8a6c91400cf2f86a07e48ef95c29cd61947a4a2471`. Successful runs used
observer SHA-256 `b99a95264b4bac7b3238dd463e698dc9b9ef576f72becb187059bda003f3a221`, sampler
SHA-256 `131c6a94db91430dbd595f871c4a43e7890ae5f3ee2f92fc960739adb6f2ffed`, and retention
SHA-256 `bbb64eb2e208bb72e590cacff0113c030c74190e3df1b4662dd82569726b85c4`.

One fresh packaged process for each gated fixture produced a valid exact-fixture preview receipt on
MacBook Pro `Mac17,2`, Apple M5, 24 GB, macOS 26.5.1 (`25F80`):

| Fixture                                | Diagnostic elapsed | Diagnostic peak additional RSS | Max interval | Qualification |
| -------------------------------------- | -----------------: | -----------------------------: | -----------: | ------------- |
| `milestone-2-atlas-proof`              |          604.26 ms |                     118.42 MiB |     6.411 ms | **VALID**     |
| `milestone-2-atlas-fragmented-islands` |          628.08 ms |                     125.69 MiB |     6.468 ms | **VALID**     |
| `milestone-2-atlas-control-max`        |          701.72 ms |                     131.22 MiB |     9.256 ms | **VALID**     |

Every receipt proves the exact checked-in fixture ID, seed, and all nine controls immediately
before unchanged production preview dispatch; a complete changed 512 × 256 preview frame;
uninterrupted foreground; final exact Accessibility state; one application, GPU, Networking, and
WebContent process; completion membership equality; valid RSS arithmetic; endpoint coverage; and
cadence. The three PID-bearing CSVs were retained privately, their temporary sources removed, and
their opaque receipts recorded without publishing the archive path.

Two proof-fixture pre-dispatch attempts failed closed on Accessibility readiness/traversal and
created no sampler artifact or measurement. The successor walker now bounds unique elements, and
the runbook treats initial WebKit Accessibility materialization as an unmeasured precondition rather
than changing a timeout. Full sanitized receipts, invalidations, definition hashes, tool identities,
retention status, and the privacy boundary are in the
[issue #96 qualification evidence](investigations/issue-96/README.md).

These observations qualify only the exact-fixture preview path. They do not replace issue #89's
already passing preview release matrix, make a new release-budget conclusion, run issue #95's
five-observation matrix, or qualify its still-missing export and cancellation authorities.

### Issue #97 packaged SVG/PNG completion qualification stop (2026-08-23)

Issue #97 implemented the bounded packaged export observer authorized after issue #95 without
changing production export/render algorithms, native atomic writes, fixtures, schemas, dimensions,
ceilings, workloads, budgets, timeouts, or production UI. Its final implementation candidate was
`35a2db5cd105cd32133888f8a84c4ab59691dd1d`; observer-enabled packaged executable SHA-256 was
`94b5a8b5f3fcd43a361589f35e3449c72cf3aad13610737140c3dd749737cf4e`; observer SHA-256 was
`0c0d3979f3c6c50ffa375fe2459b53b7dd49fad58bd5e3b4b246aaf221db38bd`; sampler SHA-256 was
`d8b07a40f50d6254faa012bc25cbb5cc8daaa4add35dec1ff670ff759fd775fd`; and retention SHA-256 was
`87c2e27e24d559f50780383840290dfe7afdfb5cb1ab15cc33928032ceecde83`.

The observer synchronously gates the three exact fixtures, drives unchanged production
reroll/save/unload/reopen actions, proves generator-free canonical/package equality, seeds a stale
private regular destination, and qualifies completion only after an externally observed
inode-changing atomic replacement agrees with the native hash/size receipt, exact format/dimensions,
unchanged ceiling, temporary absence, unchanged accepted state, foreground continuity, stable
membership, valid ≤20-ms sampling, and immediate issue #91 retention. Focused parser, dispatch,
orchestrator, native destination, predecessor-authority, and retention checks passed.

Target-host qualification stopped before measured export dispatch. One initial preparation attempt
became non-progressing before native save, and five bounded readiness successors failed before
fixture setup because the packaged candidate could not acquire or retain the approved visible/
frontmost state; the final successor could not raise its one Accessibility window. No attempt
started the sampler, created a stale destination, dispatched SVG or PNG, produced a measurement,
consumed a required trial, or created a raw CSV. The approved owner-only private archive remained
ready and unmodified.

| Fixture                                | SVG                                   | PNG                |
| -------------------------------------- | ------------------------------------- | ------------------ |
| `milestone-2-atlas-proof`              | **NOT RUN** — readiness blocker       | **NOT RUN** — stop |
| `milestone-2-atlas-fragmented-islands` | **NOT RUN** — global fail-closed stop | **NOT RUN** — stop |
| `milestone-2-atlas-control-max`        | **NOT RUN** — global fail-closed stop | **NOT RUN** — stop |

This is an external target-session UI-arbitration blocker, not a product export failure or a
budget result. The complete sanitized attempts, zero-dispatch proof, tool identities, privacy
status, and smallest blocker are in the
[issue #97 packaged export evidence](investigations/issue-97/README.md). Issue #97 does not qualify
the export authority, does not run issue #95's matrix, and leaves all cancellation children
untouched.

### Issue #100 export target-session readiness qualification (2026-08-23)

Issue #100 added only an external test controller and independent readiness observer. Ordinary
builds install no new behavior. The controller proves the approved host and active logged-in
console session, exact app/bundle/executable identity, and fresh process state before it launches
the exact issue #97 observer-enabled package. It then requires one application and one
Accessibility window, activates/raises/fronts it, and accepts readiness only after the separate
observer retains the same application/window identity and independently confirms a visible window
plus Accessibility and `NSWorkspace` frontmost state.

The implementation commit was `6fabe0bad82a293b60746b98326e4d8f5e374a16`. It reproduced
issue #97's unchanged packaged executable SHA-256
`94b5a8b5f3fcd43a361589f35e3449c72cf3aad13610737140c3dd749737cf4e` and observer
SHA-256 `0c0d3979f3c6c50ffa375fe2459b53b7dd49fad58bd5e3b4b246aaf221db38bd`. The final
readiness controller SHA-256 was
`68c23690dcdb7f4dd329e0b2152b699ba1d6ef4248d211088aa26bb98c9475c3`; its independent
observer SHA-256 was
`9f9c3254ee523f0151ce05f3b5d2573139a26e6bc432ce2c365e1b83d57419ff`.

One fresh-process, non-measurement qualification on the approved MacBook Pro `Mac17,2`, Apple M5,
24-GB, macOS 26.5.1 (`25F80`) target was **VALID**. A narrow unsandboxed GUI/session invocation was
required because the Codex execution sandbox denied the otherwise authorized process/session
inspection and activation boundary; no manual interaction was required. Sandbox denial was not
treated as target evidence.

The qualification configured no fixture, started no sampler, created no package/export
destination, dispatched no SVG/PNG, produced no measurement or raw artifact, consumed no issue #97
trial, and ran no issue #95 matrix operation. It makes no completion-authority or release-budget
conclusion. Issue #97 may now be revalidated and resumed in a new task using its unchanged final
candidate and all six unconsumed required trials. Its six previous invalid attempts remain invalid.
The complete controller contract, checks, preliminary fail-closed integration attempt, sanitized
receipt, privacy boundary, and zero-operation proof are in the
[issue #100 target-session readiness evidence](investigations/issue-100/README.md).

### Issue #97 resumed packaged SVG/PNG qualification stop (2026-08-23)

Issue #97 resumed from `312836caf7fec00af5f32c261ddced3f9b4a11cd` with the unchanged packaged
executable SHA-256
`94b5a8b5f3fcd43a361589f35e3449c72cf3aad13610737140c3dd749737cf4e` and issue #100 controller
SHA-256 `68c23690dcdb7f4dd329e0b2152b699ba1d6ef4248d211088aa26bb98c9475c3`.
Four proof/SVG observer attempts failed before dispatch while the observer was corrected to match
the pinned WebKit save field, emit a real controlled-input event, and use exact visible reopened
readiness plus the unchanged packaged exact-authority dispatch gate. They created no sampler CSV
and consumed no trial. The preserved six earlier #97 attempts remain unchanged and invalid.

The next fresh proof/SVG process passed issue #100 readiness and reached measured export dispatch
under observer SHA-256
`406de0abd9120cf7535a23b86da09b4c8962e98bda798e59159ba6f6945b8642`. It produced one
inode-changing atomic replacement and a complete final receipt: SHA-256
`c72f6261534171e7c7048f1cccc304b6a148296ba22090c11e7a1c132e8318db`, 852,650 bytes,
`atlas-svg-v1` v1, `400x200mm`, native receipt verified, 32-MiB ceiling passed, unchanged accepted
state, exact canonical/package hashes, PASS reopen comparison, and zero reopen generator calls. The
native temporary was absent. Its raw RSS timeline was immediately retained in the approved
owner-only archive; no private path or raw content is public.

The trial nevertheless failed closed because the observer's complete-format predicate required
the `<svg>` element at byte zero while the unchanged production SVG begins with its exact XML
declaration. This was the first consumed required trial, so the sequence stopped immediately. The
remaining PNG plus both formats for fragmented-islands and control-max were not run. The corrected
observer predicate is compiled and tested under SHA-256
`1b84fb183fc2c34b2b652d2dc168050babb91d35f3fd983b657a4e8b05190d2f`, but no rerun was made.
There are zero valid qualifications, zero measurement conclusions, and no release-budget result;
issue #95's matrix remains unrun. Further qualification requires explicit new authority to rerun
the consumed proof/SVG trial. Full sanitized evidence is in the
[issue #97 packaged export evidence](investigations/issue-97/README.md).

### Issue #101 authorized export replacement qualification (2026-08-23)

Issue #101 supplied exactly one replacement authority for the consumed observer-invalid proof/SVG
row and authorized the other five rows only after that replacement validated. The task started at
`73f4c579b35037a91874442f1e39dfdfed95baa7`, rebuilt the unchanged observer-enabled executable at
SHA-256 `94b5a8b5f3fcd43a361589f35e3449c72cf3aad13610737140c3dd749737cf4e`, and reproduced corrected
observer SHA-256 `1b84fb183fc2c34b2b652d2dc168050babb91d35f3fd983b657a4e8b05190d2f`, sampler
`d8b07a40f50d6254faa012bc25cbb5cc8daaa4add35dec1ff670ff759fd775fd`, retention utility
`87c2e27e24d559f50780383840290dfe7afdfb5cb1ab15cc33928032ceecde83`, and the two issue #100 tool
identities. The approved issue #100 controller independently re-established the exact pinned host,
fresh app/window identity, visibility, raise/frontmost state, and zero-operation readiness before
the replacement.

The replacement proof/SVG row was **VALID** on its only run. The five conditionally authorized
rows then ran once each in fresh processes and were also **VALID**:

| Fixture                                | SVG result / SHA-256 / bytes                                                                         | PNG result / SHA-256 / bytes                                                               | Maximum sample interval     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------- |
| `milestone-2-atlas-proof`              | **VALID replacement** / `c72f6261534171e7c7048f1cccc304b6a148296ba22090c11e7a1c132e8318db` / 852,650 | **VALID** / `981befbd11122dd20aaa944105494438a887213810480a4c81c57b9244932e72` / 1,201,973 | SVG 6.409 ms; PNG 6.649 ms  |
| `milestone-2-atlas-fragmented-islands` | **VALID** / `022c45e9b7b3e6be7122435377a5fd0ccfac9ef550bf5f48583f5cc45cef2446` / 921,077             | **VALID** / `078b0407d360f3d54bf43ef3f334c0ee0a8e332f0351cd200acdf4c6da7e9e21` / 1,221,450 | SVG 6.962 ms; PNG 11.146 ms |
| `milestone-2-atlas-control-max`        | **VALID** / `f341b22505fd5751ec0980565857a046e2182a54e6ee9d955b73fe6b5fa80d0b` / 767,851             | **VALID** / `9012be2ed269ac9373a12a8fb40bc23c7161d4a93f8d2bfec6b32a675eaabf4f` / 1,129,326 | SVG 6.366 ms; PNG 6.730 ms  |

All six rows proved exact fixture authority; exact accepted/reopened state; inode- and hash-changing
atomic replacement; matching native receipt, SHA-256, byte length, profile, dimensions, and
ceiling; absent native temporary; unchanged accepted object and canonical/package evidence; PASS
reopen comparison; zero reopen generator calls; uninterrupted foreground; stable one-each
application/GPU/Networking/WebContent membership; exact sampler arithmetic and endpoint coverage;
and owner-only private retention before inspection. SVG validation admits the exact XML declaration
followed by the SVG root. Each PNG additionally passed independent complete chunk, CRC, inflate,
filter, Adler-32, and RGB-dimension validation.

All six raw CSVs are privately retained under opaque artifact identifiers, their temporary sources
are removed, and no private path or raw content is public. The earlier proof/SVG attempt remains
separately **INVALID, CONSUMED** with its original retention receipt and invalidation unchanged;
identical production bytes do not reinterpret that historical observation. There were no retries.
The complete receipt is in the
[issue #97 packaged export evidence](investigations/issue-97/README.md).

These observations qualify the export-completion authority only. They are not a warm-up plus five
fresh runs, do not run issue #95's matrix or cancellation children, and make no export timing/RSS
budget pass or fail and no release-budget conclusion.

### Issue #98 packaged generation-cancellation qualification stop (2026-08-23)

Issue #98 implemented only observer-enabled package wiring, negative-path tests, and an independent
target-host observer. The hooks invoke the same production preview, full-generation, and
cancellation actions; fixtures and all production generator, workflow, safe-point, progress,
render, export, persistence, budget, workload, and timeout owners are unchanged. The implementation
commit was `19686859b9c6f88a771134afbf8fc31533a4ad2b`; the packaged executable SHA-256 was
`5cf14de9836e9da96655572b35bb0e194d8ebc30360b6d6516f88825dcf7a15d`.

All predecessor and new negative-path suites, deterministic, E2E, visual, root, packaged-build,
privacy, and authorized-surface gates passed. One fresh issue #100 readiness qualification was
valid and consumed no trial. The first measured preview/early cancellation row then passed its app
receipt and sampler prerequisites but failed closed on the independent observer's combined
one-second post-acknowledgement presentation/state/foreground predicate. Its status is
**INVALID, CONSUMED**. The raw PID-bearing sampler CSV was retained owner-only before the receipt
was inspected, and its temporary source was removed.

Execution stopped immediately. Preview/middle, preview/late, and full-generation early/middle/late
were not run. There are zero valid cancellation qualifications, no timing/RSS budget conclusion,
no deterministic-aftermath authority, no retry, and no issue #95 five-run release-matrix claim.
The full sanitized receipt and tool identities are in the
[issue #98 cancellation evidence](investigations/issue-98/README.md).

### Issue #102 generation-cancellation replacement stop (2026-08-23)

Issue #102 changed only the issue #98 observer/test surface. The corrected version establishes its
quiet-window baseline from the first complete frame strictly after terminal acknowledgement and
compares only later complete frames. Screen absence/change, Accessibility state drift, foreground
loss, membership drift, sampling failure, and retention failure now have independent fail-closed
authorities. The observer-enabled package remained byte-identical to issue #98; no production,
fixture, workload, budget, timeout, schema, render, export, persistence, or native-write surface
changed.

Every focused predecessor/new negative path, deterministic, E2E, visual, root, unsigned-package,
privacy, fixture-surface, and diff gate passed before target use. Issue #100 readiness qualified
one fresh exact process with zero trial activity. Exactly one authorized replacement preview/early
row then dispatched. Its existing app authority reported early work `28/1000`, two monotonic
progress samples, a **2-ms** terminal acknowledgement against the 100-ms prerequisite, stopped
costly scheduling, preserved previous state, and no accepted commit at acknowledgement. Its
retained sampler receipt had 69 rows across 418.223 ms, a 6.371-ms maximum interval, exact four-
role arithmetic, and endpoint coverage.

The corrected screen authority established the first complete post-acknowledgement baseline and
observed a later complete frame, but that frame changed. The replacement is therefore **INVALID,
CONSUMED** under independent authority `screen-capture` with reason
`post-acknowledgement quiet-window pixels changed`. Its PID-bearing CSV was retained owner-only
before receipt inspection and its temporary source removed. Execution stopped immediately:
preview middle/late and full early/middle/late were not run, no retry occurred, and there is no
cancellation-path qualification, issue #95 matrix claim, or release-budget conclusion.

The original issue #98 trial remains separately unchanged, invalid, consumed, and privately
retained. Full sanitized correction, tool identities, replacement receipt, retention metadata,
and stop status are appended to the
[issue #98 cancellation evidence](investigations/issue-98/README.md#issue-102-replacement-correction-and-stop).

### Issue #103 operation-specific presentation correction (2026-08-23)

Issue #103 changes only the issue #98 observer, focused tests, and owning evidence. Absolute
post-acknowledgement canvas pixel stability is no longer a qualification predicate. The corrected
observer requires a complete previous-state frame and multiple complete post-acknowledgement
frames, continuously applies the unchanged issue #90 completed-preview signature for preview
cancellation or issue #94 accepted-atlas signature for full cancellation, and retains any detected
signature as a sticky invalidation even if the UI later returns. Pixel change is reported only as
sanitized diagnostic metadata.

All independent app-receipt, final Accessibility previous-state/no-commit, foreground, membership,
≤20-ms sampling/endpoint, deterministic-aftermath, and owner-only retention predicates remain fail
closed. Focused tests cover pixel-only changes, both late-completion classes, frame absence,
Accessibility/foreground/membership/sampling failure, and the reused retention failure paths. The
observer-enabled package is byte-identical to #98/#102 at SHA-256
`5cf14de9836e9da96655572b35bb0e194d8ebc30360b6d6516f88825dcf7a15d`; the new observer is
`ffe1589c3841ac577d726800c68e2d5cc3733432cfd4f55f7b2947453cba0018`; all reused tool identities
reproduce unchanged. Both historical preview/early rows remain separately **INVALID, CONSUMED**
and privately retained. The authorized target outcome is appended to the
[issue #98 cancellation evidence](investigations/issue-98/README.md#issue-103-completed-presentation-correction)
without making an issue #95 matrix or release-budget conclusion.

The implementation commit is `e783ac5f78c2747698e106d6638644e3046450f4`. Pre-target focused,
deterministic, E2E, visual, root, unsigned-package, privacy, fixture-surface, and diff gates passed.
Issue #100 readiness qualified one fresh process with zero trial activity. A path-shape rejection
before target capture configured no fixture, started no sampler, created no raw CSV, dispatched no
operation, and consumed no row.

The one authorized preview/early replacement then dispatched once. It passed the 2-ms
acknowledgement prerequisite, stopped scheduling, previous-state/no-commit, final Accessibility,
foreground, stable membership, and sampling authorities. The retained sampler had 63 rows across
379.503 ms, a 6.396-ms maximum interval, exact four-role arithmetic, and both endpoints covered.
No cancelled-preview completion signature appeared after acknowledgement. The app later recorded
a canonically deterministic next completion, but the observer did not qualify issue #94's required
accepted-atlas aftermath frame. The row is therefore **INVALID, CONSUMED** under `screen-capture`
authority with reason `the deterministic accepted aftermath did not qualify`.

The first retention call fail-closed on a symlinked archive-root argument; the same intact raw CSV
was then retained through the canonical owner-only root without a row retry, and the temporary
source was removed. Execution stopped immediately. Preview middle/late and all full rows were not
run. Both historical invalidations remain unchanged and privately retained. There is no valid
cancellation qualification, issue #95 matrix claim, or release-budget conclusion.

### Issue #104 deterministic-aftermath accepted-canvas correction

Issue #104 changes only the issue #98 observer, focused tests, and owning evidence. Observer
version `packaged-generation-cancellation-host-observer-v4` preserves issue #103's cancellation
acknowledgement and post-acknowledgement completed-presentation predicates. Deterministic aftermath
now first requires the app's canonical `aftermath-complete` receipt and issue #94's accepted
Accessibility state, then revalidates candidate and membership identity, re-resolves the current
accepted-canvas AX element and current window-relative crop, and starts a fresh post-completion
capture stream on that crop.

The capture is explicitly non-timing evidence and makes no first-paint claim. It requires a
complete foreground frame with the unchanged issue #94 accepted land/water/ink populations and
disposable-preview palette rejection. Focused tests cover stale/current crop resolution, AX/crop
ambiguity, accepted and preview palettes, frame absence, foreground loss, and candidate identity
drift. All three historical preview/early rows and their private artifacts remain byte-identical,
separately **INVALID, CONSUMED**, and non-authoritative. Target results are appended only after the
implementation and all pre-target gates are committed.

The implementation commit is `5945a0f831bfcccc0761adbd11b018d787acec91`. The unchanged
observer-enabled packaged executable and all reused tool identities reproduced, while the corrected
external observer acquired its new recorded identity. Focused and predecessor Swift suites, the
14-test packaged dispatch suite, cross-platform, E2E, visual, root, unsigned-package, privacy,
authorized-surface, fixture-diff, and diff gates passed.

Three fresh issue #100 readiness attempts then failed closed at the same pre-operation boundary:
the exact candidate window could not be raised. Every attempt configured no fixture, started no
sampler, created no raw artifact or measurement, dispatched no operation, and consumed no issue
#104 row. These session-setup failures are not target cancellation evidence. The replacement
preview/early row remains **UNCONSUMED**; all five conditional rows remain unauthorized and unrun.
There is no new acknowledgement, sampling, visual, cancellation-path, first-paint, issue #95
matrix, or release-budget conclusion. Complete sanitized identities, gates, zero-operation
receipts, historical-retention proof, and row statuses are in the
[issue #98 evidence](investigations/issue-98/aftermath-canvas-rebind-qualification-2026-08-24/raw-results.json).

### Issue #105 reusable target-session readiness stabilization stop

Issue #105 changed only the external issue #100 controller, controller-only stabilization support,
focused tests, and owning evidence. Implementation
`bdad48f7b2fcd7c01b4f2aa4f2161bfdb4c7ce13` separates activation-request acceptance from a
bounded retained-candidate/frontmost stabilization policy, explicit `AXRaise` and `AXFrontmost`
support/results, terminal retained readback, and the unchanged independent Accessibility and
`NSWorkspace` verification. Only pre-dispatch `AXRaise` `cannotComplete` is retryable. All other
timeout, session, identity, ambiguity, visibility, action, and foreground failures remain terminal.

Focused issue #105 and predecessor #90/#91/#94/#96/#97/#98/#100 Swift suites, the 14-test packaged
dispatch suite, the observer-enabled unsigned package, the root gate, exact identity reproduction,
privacy, authorized-surface, fixture/production-surface, protected-evidence, and diff gates passed.
The packaged executable remained
`5cf14de9836e9da96655572b35bb0e194d8ebc30360b6d6516f88825dcf7a15d`; all issue #104
observer/sampler/retention/readiness identities reproduced unchanged. The corrected controller was
`0079b8fae359d691172fe4c577b7d72b752c8239a84063ca6c32320193538d95`.

Exactly one fresh non-measurement preflight ran on the designated host. It accepted one activation
request, then failed closed after one observation and 9 ms because the retained Accessibility
window was not yet visible. It made zero raise attempts, zero frontmost writes, and zero independent
observer runs, then terminated the candidate. No retry occurred. No fixture was configured, no
sampler or raw artifact/destination was created, no operation was dispatched or measured, and no
issue #104 row was consumed. The replacement remains **UNCONSUMED** and every conditional row
remains unauthorized/unrun. This is a setup stop with no cancellation-path, issue #95 matrix, or
release-budget conclusion. Complete sanitized evidence is in the
[issue #105 readiness stop](investigations/issue-105/README.md).

### Issue #106 bounded exact-window visibility settling stop

Issue #106 changed only the external issue #100/#105 readiness stabilizer, focused tests, and
owning evidence. It preserves the 20,000-ms timeout, 50-ms polling, exact identity on every
observation, no action before visibility, immediate drift/ambiguity/action failure, and unchanged
independent Accessibility/`NSWorkspace` verification. The sanitized version-3 receipt adds the
initial/terminal application-hidden, window-minimized, frame-visible, and combined-visible values
plus pending observation count/duration.

The implementation commit is `13101539eb1e0487badfb7716db06e84b91b067e`. Focused and
predecessor Swift suites, 14 packaged-dispatch tests, the observer-enabled unsigned package, root
gate, exact identity reproduction, privacy, authorized-surface, fixture/production-surface,
protected-evidence, and diff gates passed. The packaged executable and issue #104
observer/sampler/retention/readiness identities remained unchanged; the corrected controller was
`b3108470757a17c6573f29b1df91dd52baa2a9c9635633476a1edb1d28f93226`.

Exactly one fresh replacement non-measurement preflight ran. Its one activation request was
accepted; the exact retained application/window identity survived all 295 observations. Initially
and terminally the application was not hidden, but the window was minimized, frame-invisible, and
not visibly ready. After 19,985 ms pending and 20,000 ms total stabilization, the controller timed
out fail-closed with zero raise attempts, zero retryable raise failures, zero frontmost writes, and
zero independent observer runs, then terminated the candidate. No retry occurred.

No fixture was configured, sampler or raw artifact/destination created, operation dispatched or
measured, or issue #95/#104 authority consumed. Issue #104's replacement remains **UNCONSUMED**
and every conditional row remains unauthorized/unrun. There is no cancellation-path, first-paint,
issue #95 matrix, or release-budget conclusion. The #98/#102/#103 rows and #104/#105 stop records
remain byte-identical. Complete sanitized evidence is in the
[issue #106 readiness stop](investigations/issue-106/README.md).

### Issue #107 exact minimized-window restoration stop

Issue #107 changed only the external issue #100/#105/#106 readiness controller, stabilizer,
platform adapter, focused tests, and owning evidence. It preserves the 20,000-ms timeout, 50-ms
polling, exact identity on every observation, immediate hidden/session/drift/ambiguity failure, and
the unchanged raise/frontmost and independent Accessibility/`NSWorkspace` authorities. The
version-4 receipt separately records minimize support, settable state, write result, non-minimized
readback, frame-visible readback, action order, and retryable `cannotComplete` counts.

The implementation commit is `6195f9389a7aa18636b56220c3bf280cb65b0fc7`. Focused and
predecessor Swift suites, 14 packaged-dispatch tests, the observer-enabled unsigned package, root
gate, exact identity reproduction, privacy, authorized-surface, fixture/production-surface,
protected-evidence, and diff gates passed. The packaged executable and issue #104
observer/sampler/retention/readiness identities remained unchanged; the corrected controller was
`c8e6286107967224b8d2c4dbffc8bec4aee7252468a58da7cd0373a63b6260b6`.

Exactly one fresh replacement non-measurement preflight ran. The application was not hidden, and
the exact application/window/executable identity was retained on its first observation. The window
was minimized and frame-invisible, but the `AXMinimized` support/settable query returned
`attributeUnsupported`. The controller failed closed after 13 ms before any set-attribute write,
non-minimized/frame-visible readback, raise, frontmost write, or independent observer run, then
terminated the candidate. No retry occurred.

No fixture was configured, sampler or raw artifact/destination created, operation dispatched or
measured, or issue #95/#104 authority consumed. Issue #104's replacement remains **UNCONSUMED**
and every conditional row remains unauthorized/unrun. The #98/#102/#103 rows and #104/#105/#106
stop records remain byte-identical. Complete sanitized evidence is in the
[issue #107 readiness stop](investigations/issue-107/README.md).

### Issue #108 frontmost capability-ordering stop

Issue #108 changed only the external issue #100/#105/#106/#107 controller, controller-only
stabilizer/platform adapter, focused tests, and owning evidence. The version-5 receipt records
minimized, positive-frame, and application-frontmost reads as supported values or explicit
unavailable reasons. Exact-application `AXFrontmost` support/write/readback now precedes Workspace,
window, and raise requirements. No minimized write, unhide, manual interaction, or UI scripting is
installed. The unchanged 20,000-ms/50-ms policy, identity requirements, final retained state, and
independent observer remain fail closed.

The implementation commit is `e144fff323c4f1e682d1f5db54ecb374e9f7d133`. Focused and
predecessor Swift suites, 14 packaged-dispatch tests, the observer-enabled unsigned package, root
gate, privacy, authorized-surface, fixture/production-surface, protected-evidence, Swift-format,
and diff gates passed. The packaged executable, issue #104 cancellation observer, sampler, and
retention utility retained their exact prior hashes. The pre-target canonical readiness-observer
identity check was incomplete; it had compiled the noncanonical artifact described below. The
corrected controller was
`ade48973c2631381b221bfe8e92fbbd5ee31f1c5affda26a79574f7058cb0e04`. Replaying issue #98's
authoritative observer flags, input order, and canonical output basename reproduced the unchanged
protected readiness observer exactly at
`9662c1664d44e93f58dc690a0fb78f08eb1f4751d84fc5790256866e768811ce`.

The preflight had been supplied a differently ordered/output-named observer artifact at
`f2c9b54561c68d8dea89ced7253316b7e1604db1b2eac42683e7d1609be4f023`. That artifact was
noncanonical, and the controller timed out before its independent-observer stage, so it was never
executed. The issue #108 receipt preserves that argument provenance separately from the canonical
protected identity.

Exactly one fresh replacement non-measurement preflight ran. Its one activation request was
accepted; exact application/window/executable/session identity survived all 292 observations.
Application `AXFrontmost` was supported and settable, and one `AXFrontmost=true` write returned
success before Workspace, window, or raise requirements. Accessibility readback nevertheless
remained supported `false`, Workspace remained not frontmost, and minimized plus frame reads
remained explicitly unavailable/`attribute-unsupported`. At 20,000 ms the controller timed out
under `foreground` authority with zero minimized writes, raises, independent observer runs, or
product operations, then terminated the candidate. No retry occurred.

No fixture was configured, sampler or raw artifact/destination created, operation dispatched or
measured, or issue #95/#104 authority consumed. Issue #104's replacement remains **UNCONSUMED**
and every conditional row remains unauthorized/unrun. The #98/#102/#103 rows and issue #104
through #107 stop records retain their prior SHA-256 values. Complete sanitized evidence is in the
[issue #108 readiness stop](investigations/issue-108/README.md).

### Issue #109 operator-assisted focus-handoff stop

Issue #109 changes only the external issue #100/#105-#108 controller, controller-only
stabilizer/platform support, focused tests, and owning evidence. The version-6 controller first
proves exact fresh application/window/executable/session identity and a zero-operation boundary,
then emits a sanitized bounded `awaiting-operator-focus` prompt. Exactly one operator focus action
must be declared. The controller produces no synthesized click, key, Accessibility focus action,
AppleScript, GUI script, or Dock action and performs no `AXFrontmost` write.

After the operator action, readiness still requires independently detected exact-candidate
Accessibility and `NSWorkspace` frontmost, a supported positive window frame, supported `AXRaise`
when required, retained exact identity, and the unchanged independent readiness observer. Every
wrong-app, duplicate-action, timeout, ambiguity, drift, post-focus loss, hidden/invisible,
raise/observer, and nonzero-operation path fails closed. The existing 20,000-ms timeout and 50-ms
poll interval remain unchanged.

All focused/predecessor, 14-dispatch, package/identity/root/privacy/surface/fixture/
protected-evidence/diff gates passed and the implementation was cleanly committed before the
coordinated assisted preflight began. Exactly one preflight reached `awaiting-operator-focus`, but
timed out fail-closed after 20,000 ms / 286 observations without independently detecting the exact
candidate as Accessibility or Workspace frontmost. The controller stopped before raise or the
independent observer, terminated the candidate, and a separate read-only check found zero remaining
candidate processes.

The result is **INVALID — PRE-DISPATCH STOP**. No retry, target operation, sampler, artifact/
destination, measurement, issue #95 action, or cancellation conclusion occurred. Issue #104
remains **UNCONSUMED**. The bounded contract and complete sanitized receipt are in the
[issue #109 focus-handoff evidence](investigations/issue-109/README.md).

### Issue #110 durable operator-ready latch boundary

Issue #110 changes only the external issue #100/#105-#109 readiness controller, controller-only
latch/stabilizer/platform support, focused tests, and owning evidence. Controller version 7 accepts
one explicit validated marker path beneath `/private/tmp` and one unique issue #110 token. After it
proves exact fresh application/window/executable/session identity and zero product operations, it
flushes a complete owner-only marker and atomically publishes `awaiting-operator-ready` without
replacing an existing path. The 120,000-ms handoff begins only after publication.

The coordinator polls the exact marker rather than task commentary before requesting one real
owner click. Issue #109's unchanged independent Accessibility/Workspace focus detection,
positive-frame authority, raise, identity retention, and canonical observer remain required. No
input is synthesized. The marker is cleaned on every terminal path; collision, invalid path/token,
publication failure, cleanup failure, timeout, drift, replacement, or observer disagreement fails
closed. Public receipts contain only sanitized lifecycle/order fields and no marker path, token,
PID, username, or raw-artifact location.

All implementation and pre-target gates were committed before target use. From implementation
commit `469b3a9a908a0d44d0a96aa72ff19d3c084e04f4`, exactly one assisted zero-operation preflight
validated the exact candidate/session and zero-operation prerequisites, atomically published its
durable marker, and allowed the full 120,000-ms handoff. It timed out fail-closed after 1,711
observations without independently detecting operator focus. Marker cleanup succeeded, and a
separate read-only check found zero candidate processes.

The result is **INVALID — PRE-DISPATCH STOP**. There was no retry, raise, independent-observer run,
fixture, sampler, artifact/destination, dispatch, measurement, issue #95 action, or issue #104
activity. Issue #109's invalid consumed stop remains unchanged, and issue #104 remains blocked and
**UNCONSUMED**. The contract and sanitized receipt are in the
[issue #110 latch evidence](investigations/issue-110/README.md).

### Issue #111 Codex Computer Use focus-handoff stop

Issue #111 authorized exactly one Codex Computer Use focus-only click after direct coordinator
validation of issue #110's durable marker. A read-only Finder inspection first proved Computer Use
was callable in the available desktop session without a lock or authentication boundary. All
focused/predecessor, 14-dispatch, package, exact preserved-identity, root, cross-platform,
privacy, surface, fixture, protected-evidence, and diff gates passed. A fresh current-toolchain
package rebuild was noncanonical and excluded from target use; the preserved exact issue #110
candidate and tools directly matched every recorded identity.

The unchanged controller launched its exact candidate once, validated the candidate/session and
zero-operation boundary, atomically published the marker, and entered the 120,000-ms handoff. The
post-marker read-only Computer Use inspection did not return inside that bound, so the focus click
was never performed. The controller timed out after 1,702 observations without Accessibility or
Workspace frontmost, cleaned its marker, and terminated the candidate before raise or independent
observer execution.

The delayed inspection returned only after terminal cleanup and transparently relaunched one
stray zero-operation candidate. One termination signal restored zero candidate processes. The
extra tool-caused launch violates the exact-one-candidate contract and supplies no target or
product evidence. The result is **INVALID — PRE-DISPATCH STOP**. There was no retry, product input,
fixture, sampler, artifact/destination, dispatch, measurement, issue #95 action, or issue #104
activity. Issue #109/#110 remain immutable, and issue #104 remains **UNCONSUMED**. The complete
sanitized record is in the
[issue #111 Computer Use stop](investigations/issue-111/README.md).

### Issue #112 Computer Use latency diagnosis

Issue #112 bounded the remaining unknown to non-product Computer Use responsiveness.
The read-only application inventory and Finder state returned in the under-1-second
bucket, while the read-only Dock state call reached its 5-second server-timeout
boundary. The matrix stopped at that first timeout without a retry or a successful
call repeat. It establishes an inconsistent bounded service response, not any
candidate, product, latch, performance, or release behavior.

An explicit user-authorized, permission-only TTRPG inspection was kept outside this
diagnosis's M2 evidence boundary. Its zero-operation transparent launch was
terminated and a follow-up check found zero target processes. No product input,
focus, marker, fixture, sampler, artifact/destination, dispatch, measurement,
issue #95 action, or #104 activity occurred. The sanitized record excludes pixels,
accessibility content, paths, identities, and raw diagnostics.

Computer Use is not viable for the M2 post-marker focus action. The sole successor
is a separately authorized one-real-owner-click issue using the unchanged #110
durable latch; no native fallback or second mechanism is authorized. Issue #104
remains blocked and **UNCONSUMED**. The successor contract is in the
[issue #112 latency diagnosis](investigations/issue-112/README.md).

### Issue #113 final app-specific focus qualification boundary

Live issue #113 authorizes one final app-specific Computer Use exception to issue
#112's successor decision. Before repository access, the exact TTRPG permission-path
read returned prompt-free inside its bound, its transparent zero-operation process
was terminated, and a separate check found zero target processes. No input, focus,
product operation, or downstream activity occurred.

The amended live issue authorized one mechanical Prettier repair to issue #112's
Markdown table. Normalized table-cell comparison proved semantic content unchanged,
and all raw artifacts, decisions, privacy boundaries, and protected observer sources
remain unchanged. The focused issue #110 and six predecessor Swift suites, 14
dispatch tests, 338-module package build, root check, cross-platform fixtures, exact
preserved identities, privacy, surface, protected-evidence, Swift-format, and diff
gates then passed. The current-toolchain package was noncanonical and excluded from
target use.

The unchanged controller then launched the exact candidate once, validated its
candidate/session and zero-operation prerequisites, atomically published the marker,
and entered the 120,000-ms handoff. Direct coordinator validation proved the exact
owner-only marker. The single post-marker Computer Use read returned an
authentication boundary in the `under-1s` bucket because the Mac was locked and
automatic unlock was unavailable. No actionable app state returned, so no click or
other Computer Use action occurred and there was no retry.

The controller independently timed out after 1,705 observations without detecting
Accessibility or Workspace frontmost. It cleaned its marker and terminated the
candidate before frame, raise, retained-state, or observer validation. Terminal
checks found the marker and publication temporary absent and zero TTRPG processes.
The result is **INVALID — PRE-DISPATCH STOP**. Computer Use is retired for this M2
handoff; issue #104 remains blocked and **UNCONSUMED**, and issue #112's
one-real-owner-click route is the sole successor. The contract and sanitized result
are in the
[issue #113 qualification record](investigations/issue-113/README.md).

### Issue #114 real-owner focus qualification stop

Issue #114 authorized exactly one real-owner focus click through issue #110's
unchanged durable latch after fresh owner confirmation of presence at an
unlocked Mac. Issue #113's exact-base full-gate evidence was reused. The bounded
clean-head, zero-process/collision, exact-identity, seven-Swift-suite,
14-dispatch, privacy, surface, protected-evidence, and diff gates passed from
clean docs-only coordination commit `0fc47b8` before target use.

The unchanged controller launched the exact preserved candidate once, validated
the candidate/session and strict zero-operation boundary, atomically published
the owner-only marker, and entered its 120,000-ms handoff. Direct coordinator
validation passed and the owner instruction was emitted immediately. The
controller made 1,802 observations without detecting the exact candidate as
Accessibility or Workspace frontmost. Whether a physical owner click occurred
is not established; the required focus transition was not detected.

The controller stopped before frame qualification, raise, retained-state, or
independent-observer execution. Marker cleanup succeeded, the candidate was
terminated, and separate checks found the marker and publication temporary
absent and zero target processes. There was no retry, fallback, Codex GUI input,
Computer Use, product action, fixture, sampler, artifact/destination, dispatch,
measurement, issue #95 operation, or issue #104 activity. The result is
**INVALID — PRE-DISPATCH STOP**. Issue #104 remains blocked and **UNCONSUMED**;
another attempt or focus mechanism requires a new owner decision. The complete
sanitized receipt is in the
[issue #114 owner-click evidence](investigations/issue-114/README.md).

### Issue #115 owner focus handoff stop

Issue #115 supplied fresh authority for exactly one successor real-owner focus
action while preserving issue #114 as immutable. Its exact integrated parent,
zero-process and marker-collision state, six canonical identities, public
privacy, docs-only authorized surface, unchanged production/fixture/protected
evidence, and diff checks passed from clean coordination commit `39b5f45`. No
drift was detected, so issue #114's immediately preceding passing Swift,
dispatch, package-build, and root-check gates were reused without rerun.

The unchanged controller was invoked once and launched the exact packaged
candidate. It established one fresh exact application and Accessibility window,
but failed closed before marker publication because a distinct initial
foreground application was not available for the operator handoff. The
owner-only marker was therefore not directly validated, no `CLICK NOW:`
instruction was emitted, and no owner action was requested.

The controller terminated its candidate and cleaned its unowned marker state.
Separate checks found the marker and publication temporary absent and zero
target processes. There was no retry, fallback, Codex GUI input, Computer Use,
focus observation, raise, frontmost write, independent-observer run, product
action, fixture, sampler, artifact/destination, dispatch, measurement, issue #95
operation, or issue #104 activity. The result is **INVALID — PRE-HANDOFF
PRE-DISPATCH STOP**. Issue #114 remains immutable. Issue #104 remains blocked
and **UNCONSUMED**; another attempt requires a new explicit owner decision. The
complete sanitized receipt is in the
[issue #115 owner-focus evidence](investigations/issue-115/README.md).

### Issue #116 prelaunch foreground capture correction

Issue #116 verified the source-backed cause of issue #115's pre-handoff stop. The integrated
controller used an activating launch and captured the supposed initial Workspace foreground PID
only after candidate launch and Accessibility-window establishment. The new candidate could
therefore become the rejected initial foreground value.

The implementation-only correction captures an explicit application or desktop/no-application
foreground state before a nonactivating candidate launch. It requires the retained exact candidate
to remain Workspace non-frontmost and Accessibility supported-false before marker publication.
Candidate/controller focus, undeclared third-app focus, unavailable authority, anchor or identity/
window drift, and ambiguous Accessibility readback fail closed. Desktop has a named state and no
sentinel PID. Only one later transition to the exact candidate can succeed.

Issue #110's marker lifecycle, one owner action, 120-second bound, frame, raise, retained identity,
independent observer, zero-operation, cleanup, and privacy contracts remain unchanged. Focused and
six predecessor Swift suites plus static gates verify this boundary without a live candidate,
marker, owner action, product activity, or issue #104 activity. The record is in the
[issue #116 correction evidence](investigations/issue-116/README.md). Issue #115 remains immutable
and **INVALID — PRE-HANDOFF PRE-DISPATCH STOP**. Issue #104 remains blocked and **UNCONSUMED**.

### Issue #117 corrected owner focus qualification stop

Issue #117 armed the corrected qualification in Phase A from exact integrated commit `110a890`.
The fresh corrected controller and five preserved supporting authorities reproduced their recorded
identities; issue #116's immediately preceding focused and predecessor gates were reused without
drift. The branch stopped clean at coordination commit `1ab5557` with zero target processes and no
marker collision before fresh owner presence was requested.

After fresh confirmation that the owner was present at the unlocked Mac and ready to click, the
clean HEAD, identities, zero-process state, and absent marker state were reconfirmed. One corrected
controller invocation launched exactly one nonactivating exact candidate with one declared owner
focus action. Before marker publication, the controller failed closed under `foreground` authority
because the exact candidate was not proven non-frontmost before the operator handoff began.

The owner-only marker was never directly validated, no `CLICK NOW:` instruction was emitted, and
no owner action was requested. The controller cleaned its unowned marker state and terminated the
candidate; separate checks found the marker and publication temporary absent and zero target
processes. No retry, fallback, Codex GUI input, Computer Use, focus observation, raise, frontmost
write, independent observer, product action, fixture, sampler, artifact/destination, dispatch,
measurement, issue #95 operation, or issue #104 activity occurred. The result is **INVALID —
PRE-HANDOFF PRE-DISPATCH STOP**. Issue #104 remains blocked and **UNCONSUMED**; any successor
requires a new issue and owner decision. The complete sanitized receipt is in the
[issue #117 qualification evidence](investigations/issue-117/README.md).

### Issue #118 process-bound observer command decision

Issue #118 replaces further focus-path design with the observer-only Unix-domain stream contract in
[ADR-0020](adr/0020-process-bound-observer-command-channel.md). The decision requires compile-time
ordinary-build absence, mutual exact-process and per-session authentication, bounded binary frames,
an explicit operation allowlist, one in-flight command, exact acknowledgements, replay rejection,
terminal cleanup, and reuse of the existing TypeScript operation authorities. The isolated
standard-library prototype passed without app launch, and the ordered implementation drafts keep
native transport, frontend binding, Swift client, and target qualification separate. No dependency
review is required. No package, target process, fixture, dispatch, artifact, measurement, issue #95
operation, or issue #104 activity occurred; #104 remains **UNCONSUMED**.

### Issue #122 zero-command process-bound qualification stop

Issues #119–#121 completed ADR-0020's native transport, compile-time frontend bridge, and exact-
session Swift client. Issue #122's committed Phase A boundary added only the launch wrapper and
passed the focused predecessor, ordinary-absence, paired-gate candidate, packaged-dispatch, root,
deterministic, privacy, product/fixture, protected-evidence, and diff gates. The ordinary package
contained no observer surface; exactly one observer package used both required compile-time gates.

The sole Phase B invocation launched one fresh exact candidate without activation, then the
controller terminated by signal before it emitted a sanitized mutual-authentication/frontend-READY
receipt. The empty-command `qualify()` path emitted zero COMMAND frames and invoked zero product
operations, but the missing receipt makes the result **INVALID**. Independent cleanup terminated
the exact candidate, confirmed endpoint removal, removed the empty owner-only runtime directory,
and proved zero candidate processes and zero runtime nodes. No retry, fallback, input, fixture,
sampler, artifact/destination, dispatch, measurement, issue #95 action, or #104 activity occurred,
and no code was corrected after the attempt began. Issue #104 remains blocked and **UNCONSUMED**.
The sanitized result is in the
[issue #122 qualification evidence](investigations/issue-122/README.md).

### Issue #123 SIGPIPE-safe observer client correction

Issue #123 adds a single no-launch correction at the issue #121 Swift socket boundary. Construction
now fails closed unless macOS `SO_NOSIGPIPE` can be set and read back on every live-connected or
test-adopted descriptor. The focused child-process regression uses default `SIGPIPE` disposition,
forces a closed-peer write, and requires normal exit with the existing
`observer-client.disconnect` authority. Fragmented and zero-command Rust/Swift interoperability,
the #119 native transport and absence boundary, the #120 frontend/dispatch boundary, and existing
authentication, identity, deadline, lifecycle, and cleanup behavior remain unchanged.

No packaged app or candidate was built or launched, no private endpoint or live qualification was
created, and no fixture, product operation, artifact, sampler, measurement, issue #95 action, or
#104 activity occurred. Issue #122's evidence remains byte-identical, **INVALID/CONSUMED**, and is
not retried or reinterpreted. Issue #104 remains blocked and **UNCONSUMED** until a separately
authorized fresh zero-command qualification passes.

### Issue #124 SIGPIPE-safe zero-command qualification stop

Issue #124 completed and committed its full no-launch arming boundary from exact integrated commit
`be26deb`: focused and predecessor tests, root and deterministic gates, ordinary observer-surface
absence, exactly one paired-gate observer package, exact controller and candidate identities, zero
process/runtime state, privacy, and protected evidence all passed before target use.

The sole Phase B controller invocation launched one fresh nonactivating exact observer
candidate/session, then returned `observer-client.cleanup` with `commandCount: 0` and without
qualified terminal cleanup. The result is **INVALID/CONSUMED**. Cleanup uncertainty prevents any
mutual-authentication or frontend-READY claim. The immutable empty-command qualification path sends
no COMMAND frame and invokes no product operation. Independent final scans found zero candidate
processes, zero observer runtime directories, and zero socket nodes. No retry, fallback, activation,
input, fixture, sampler, artifact/destination, dispatch, measurement, code correction, issue #95
action, or #104 activity occurred. Issue #104 remains blocked and **UNCONSUMED**; a future attempt
requires a separately authored successor. The sanitized result is in the
[issue #124 qualification evidence](investigations/issue-124/README.md).

### Issue #125 idempotent exact-candidate cleanup correction

Issue #125 corrects only issue #122's terminal cleanup state machine and injected no-launch tests.
An already-terminated retained handle now requires its unchanged PID relationship plus a fresh zero
exact-bundle scan. A live exact candidate retains full identity validation before one termination
request; a false-return race is accepted only after bounded proof that the retained handle is
terminated and the exact-bundle scan is empty. Replacement, multiple, wrong-PID or identity,
nontermination, and deadline states remain terminal, with candidate cleanup evaluated before
endpoint cleanup.

All 14 focused cases, the #121/#123 39-test suite and both interoperability cases, #119's 26+2
tests, #120's 71 tests, six protected Swift executables, the root gate, six deterministic PNGs,
eight fixture sets, and 28 APFS recovery cases pass. Privacy and protected-surface checks pass. No
packaged candidate, live endpoint, COMMAND frame, product operation, issue #95 action, or issue
#104 activity occurred. Issue #124 and every historical evidence artifact remain byte-identical,
**INVALID/CONSUMED**, and uninterpreted; issue #104 remains blocked and **UNCONSUMED** pending a
separately authorized fresh qualification after integration.

### Issue #126 idempotent-cleanup zero-command qualification stop

Issue #126 committed a clean no-launch arming boundary from exact integrated commit `fb5e259`
after all focused, predecessor, root, deterministic, recovery, package, privacy, and protected
gates passed. One ordinary package proved complete observer absence; exactly one paired-gate
observer package and the exact issue #125 controller reproduced their sanitized identities.

The sole Phase B controller invocation launched one fresh nonactivating exact observer
candidate/session and returned `observer-client.cleanup` with `commandCount: 0`. Because terminal
cleanup was not qualified, the result is **INVALID/CONSUMED** and neither mutual authentication nor
frontend READY is claimed. The unchanged empty-command path sends no COMMAND frame and invokes no
product authority. Independent terminal checks proved zero candidate processes, zero runtime
directories, and zero socket nodes. No retry, fallback, activation, input, Accessibility action,
fixture, artifact, dispatch, measurement, code correction, issue #95 action, or #104 activity
occurred. Issue #104 remains blocked and **UNCONSUMED** pending separately authored authority. The
sanitized result is in the
[issue #126 qualification evidence](investigations/issue-126/README.md).

## Remote CI and milestone state

Issue #71 recorded fresh CI evidence for the exact remote release commit
[`713dc1039f59cd18864be6581b0d603adb2072c1`](https://github.com/ChadHealey/ttrpg-map-generator/commit/713dc1039f59cd18864be6581b0d603adb2072c1).
The [CI run 32579353749](https://github.com/ChadHealey/ttrpg-map-generator/actions/runs/32579353749)
completed successfully on 2026-08-22:

| Job                                                                                                           | Result   | Required evidence recorded                                                                                                 |
| ------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| [quality (Linux)](https://github.com/ChadHealey/ttrpg-map-generator/actions/runs/32579353749/job/97046289370) | **PASS** | `pnpm check`, deterministic fixtures, desktop workflow, visual, PNG export, build, native recovery; filesystem `ext2/ext3` |
| [quality (macOS)](https://github.com/ChadHealey/ttrpg-map-generator/actions/runs/32579353749/job/97046289487) | **PASS** | `pnpm check`, deterministic fixtures, desktop workflow, visual, PNG export, build, native recovery; filesystem `APFS`      |
| [quality-gate](https://github.com/ChadHealey/ttrpg-map-generator/actions/runs/32579353749/job/97052583791)    | **PASS** | Required both platform jobs to succeed                                                                                     |

The workflow publishes no upload artifacts. Its durable remote evidence is the linked run and job
logs; the existing fixture review records and local packaged artifact hashes remain the authoritative
artifact evidence for their respective lanes.

The 2026-08-29 closure audit reconciled the live milestone issue set. Superseded observer/focus
records were closed, retained release-protocol work was moved to Milestone 9 with ADR-0021 pointers,
and the Milestone 2 product/evidence owners were closed only after their acceptance criteria passed.
The definition-of-done rule that every included issue be closed or explicitly moved out is therefore
satisfied.

Milestone 9 retains these final-owner actions:

1. Use the no-launch repaired observer controller recorded under
   `investigations/milestone-9-observer-controller/`; grant a new packaged qualification only under
   separately reviewed Milestone 9 authority.
2. Treat issue #101's six packaged SVG/PNG completion qualifications as path authority only and
   preserve issue #104 as unconsumed until new authority is explicitly granted.
3. Run the complete successor reference protocol without changing fixtures, workloads, production
   behavior, hardware, or limits; record every run and every invalidation.

Unsigned local packaging remains sufficient for this proof. Signing, notarization, and distribution
automation remain later release concerns.
