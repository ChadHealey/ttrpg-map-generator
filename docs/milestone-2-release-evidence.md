# Milestone 2 release evidence

- **Status:** Release-pending; this document does not mark Milestone 2 complete
- **Prepared:** 2026-08-22
- **Issue:** [#68 — Prove the Milestone 2 whole-world atlas workflow end to end](https://github.com/ChadHealey/ttrpg-map-generator/issues/68)
- **Normative contract:** [Milestone 2 whole-world atlas proof](milestone-2-atlas-proof.md)
- **Retrospective:** [Milestone 2 release-pending retrospective](retrospectives/milestone-2.md)
- **RSS attribution:** [Apple M5 / JavaScriptCore RSS investigation](milestone-2-javascriptcore-rss-investigation.md)

This report keeps functional, semantic, package, render, visual, resource, and release-hardware
evidence separate. A `PASS` may be recorded only beside reproduced evidence whose exact tested
tree is named. `FAIL` records valid evidence that misses a contract requirement. `NOT RUN` records
downstream work prohibited by a stop condition. `PENDING` means the final command or review has not
yet been recorded. `OUTSTANDING` means the required reference protocol has not yet passed.
`EXTERNAL` means completion requires a remote action that was deliberately prohibited while
preparing issue #68.

Milestone 2 cannot be called complete while any contract row is `FAIL`, `NOT RUN`, `PENDING`,
`OUTSTANDING`, or `EXTERNAL`. The current Apple M5/24-GB development machine is now the designated
reference environment; the recorded observations are not a passing five-process release-budget
result.

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

| Contract lane                | Required evidence                                                                                                                              | Status       | Evidence record                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------ |
| Registered desktop inputs    | Seed `81985529216486895` and all nine validated default controls are visible in the packaged app                                               | **PASS**     | Packaged workflow steps 1–2 below                                  |
| Preview boundary             | Cancel and restart one labelled coarse preview; preview remains disposable and cannot become accepted bytes                                    | **PASS**     | Packaged workflow step 3 plus focused orchestration tests          |
| Full acceptance              | Full profile is generated separately, validated, and committed atomically; stable semantic identities are inspectable                          | **PASS**     | Packaged workflow step 4 and canonical fixture lane                |
| Geography reroll             | Macro revision and declared dependents change while paper, user intent, seed, versions, locks, and unrelated revisions stay canonical          | **PASS**     | `baseline` → `geography-rerolled` canonical comparison             |
| Appearance reroll            | Three appearance aspects/revisions and render composite change while all semantic geography and canonical coastline bytes stay fixed           | **PASS**     | `geography-rerolled` → `appearance-rerolled` canonical comparison  |
| Native save and unload       | Immutable accepted snapshot is committed atomically and accepted document plus scene are truly unloaded                                        | **PASS**     | Packaged workflow steps 7–8 and native recovery gate               |
| Generator-free reopen        | Native package validates; accepted aspect/output bytes, package fingerprint, scene semantics, SVG, and PNG agree; generator call count is zero | **PASS**     | Packaged workflow step 9, tripwire test, and saved-project fixture |
| Milestone 1 compatibility    | Released Milestone 1 projects and migrations reopen without drift or generator invocation                                                      | **PASS**     | Cross-platform, native-recovery, and end-to-end gates              |
| Reopened SVG export          | `atlas-svg-v1`, 400 × 200 mm, deterministic bytes, native atomic receipt, accepted document unchanged                                          | **PASS**     | Packaged workflow step 10 and artifact record                      |
| Reopened PNG export          | `atlas-png-v1`, 8192 × 4096, deterministic repeat bytes, native atomic receipt, accepted document unchanged                                    | **PASS**     | Packaged workflow step 10, PNG gate, and artifact record           |
| Evidence separation          | Canonical aspects, accepted outputs, package checksums, geometry, scene/SVG structure, PNG pixels, and performance remain distinct lanes       | **PASS**     | Fixture manifest/review records and sections below                 |
| Geometry                     | Closed/wound/non-self-intersecting rings; exact partition; identity/order; containment/connectivity; seam/pole and post-quantization validity  | **PASS**     | Root check, cross-platform fixtures, and geometry review           |
| Visual gallery               | Six registered 1600 × 800 gallery rows plus full-size seam, pole, channel, island, echo, fine-ink, and raster-boundary crops inspected         | **PASS**     | Visual review table below                                          |
| Deterministic resource gates | PNG dimensions, file ceiling, bounded band/surface allocation, progress/cancellation semantics, and deterministic aftermath pass               | **PASS**     | `pnpm test:png-export`; this is not the release benchmark          |
| Packaged macOS app           | Unsigned `.app` builds and the complete visible workflow is exercised through that bundle                                                      | **PASS**     | Package and workflow records below                                 |
| Apple M5/24-GB budgets       | Prescribed warm-up/five-process timing, process-tree RSS, and cancellation acknowledgement protocol passes                                     | **FAIL**     | First valid measured preview exceeded 750 ms; protocol stopped     |
| macOS/Linux release matrix   | Exact final commit passes required CI on both platforms with filesystem evidence                                                               | **PASS**     | [Issue #71 matrix](#remote-ci-and-milestone-state)                 |
| Milestone issue state        | Every included issue is closed or explicitly moved out                                                                                         | **EXTERNAL** | Eight milestone issues remain open; remote mutation was prohibited |

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
| Reference performance      | Packaged base-M1 timing, process-tree RSS, and acknowledgement latency                                          | **OUTSTANDING**                                                                 |

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
progress/cancellation state semantics. The formal protocol remains required; record it without
replacing a failed result with a narrower command.

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

The required environment is an idle release build with packaged local assets, power connected, Low
Power Mode off, no debugger/developer tools, and no network dependency. After one untimed warm-up,
measure five fresh processes. Sample aggregate additional RSS for the complete application process
tree at intervals no greater than 20 ms and report every run plus median and worst.

| Operation                            | Fixed limit                                      | Required evidence status                                |
| ------------------------------------ | ------------------------------------------------ | ------------------------------------------------------- |
| Coarse preview                       | ≤750 ms and ≤256 MiB additional process-tree RSS | **FAIL** — fresh proof run 1 was 861.25 ms / 118.80 MiB |
| Full generation                      | ≤10 s and ≤768 MiB additional process-tree RSS   | **NOT RUN** — preview stop condition                    |
| SVG export                           | ≤3 s, ≤512 MiB, destination ≤32 MiB              | **NOT RUN** — preview stop condition                    |
| PNG export                           | ≤15 s, ≤1 GiB, destination ≤64 MiB               | **NOT RUN** — preview stop condition                    |
| Preview cancellation                 | Acknowledgement ≤100 ms                          | **NOT RUN** — preview stop condition                    |
| Full-generation/SVG/PNG cancellation | Acknowledgement ≤500 ms                          | **NOT RUN** — preview stop condition                    |

Run wall-clock and memory gates for `milestone-2-atlas-proof`,
`milestone-2-atlas-fragmented-islands`, and `milestone-2-atlas-control-max`; apply SVG/PNG file
ceilings to all six fixtures. Exercise early, middle, and late cancellation five times at each safe
point and verify no commit/replacement occurs after acknowledgement. The detailed protocol and its
unchanged acceptance meanings remain owned by the
[atlas-proof contract](milestone-2-atlas-proof.md#performance-progress-cancellation-and-resource-budgets).

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

The live audit on 2026-08-17 found eight open issues assigned to Milestone 2: `#9`, `#10`, `#11`,
`#12`, `#65`, `#66`, `#67`, and `#68`. The current milestone cannot satisfy the definition-of-done
rule that every included issue be closed or explicitly moved out.

The final release owner must perform these actions in order:

1. Return the valid issue #84 preview failure to #70/#75 release planning. A separately authorized
   response must preserve the unchanged workload and limits before the complete protocol is rerun.
2. Confirm this report names the exact tested implementation commit and the handoff names the
   documentation-only commit, with complete command results, packaged receipts, artifact hashes,
   and human visual review. Do not attribute costly gates to the documentation commit unless they
   are rerun there.
3. Review each of `#9`, `#10`, `#11`, `#12`, `#65`, `#66`, `#67`, and `#68`; close an issue only when
   its acceptance criteria are satisfied, or explicitly move unfinished work out of Milestone 2.
4. Only after every row in this report is closed may the milestone status and retrospective be
   changed from release-pending to complete.

Unsigned local packaging is sufficient for the issue #68 exercise. Signing, notarization, pushing,
merging, creating a pull request, and modifying GitHub state are outside this local proof task.
