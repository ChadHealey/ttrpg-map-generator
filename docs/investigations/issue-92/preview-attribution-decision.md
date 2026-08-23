# Issue 92 current-candidate packaged-preview attribution

## Decision

Select **disposition A**: current evidence attributes a repeatable product-side preview failure to
the threshold-selection boundary, with the repeated water-component traversal as the smallest
credible repair surface. Update issue #89 from its stale conditional state to the execution-ready
body in [implementation-child-draft.md](implementation-child-draft.md). Do not change production
code, the observer, workloads, hardware, or budgets in this discovery.

All nine valid fresh-process diagnostics exceeded the unchanged 750 ms wall-clock limit. Threshold
selection was the dominant application stage in every run at 304–356 ms. Its nested
`summarizeWaterComponents` traversals accounted for 169–207 ms while preserving the same 17–18
candidate counts, selected contours, component counts, and largest-component percentages recorded
by issue #87. That local repeated traversal is large enough to own the bounded production repair;
the updated #89 must prove the actual post-repair gate rather than assume the full measured cost is
removable.

The post-canvas interval through the qualifying ScreenCaptureKit frame and final Accessibility
receipt was separately measured at 212.55–267.75 ms. It is a mixed boundary, not an observer-only
interval: its first 147.89–191.35 ms contains the final application-side profile serialization and
Svelte publication, browser paint, and observer frame detection. The application probe did not
measure its actual final serialization/publication, so that portion remains explicitly
unattributed. Only the 58.85–76.40 ms from the qualifying frame through the final Accessibility
receipt is observer-owned. None of this mixed or observer-owned time is assigned to threshold
selection or any preferred product component.

## Exact candidate and tools

- Clean commit: `c10d6c158319a50cc11e99fd1d89005b5906c4da`, with #91 integrated directly
  above the issue #84 evidence commit.
- Clean packaged executable SHA-256:
  `931235e8a989a3980533c7ba5387ba3622520762f3a05ae551856eb6eec116ee`. This is
  byte-identical to the executable observed by issue #84.
- Instrumented packaged executable SHA-256:
  `c78fac6d0be1c35a2480122a88e83b0b8813fb289252a5718edf5842074ad33e`.
- Clean issue #90 observer SHA-256:
  `16760afe787cf84647d17fffb3258561882ec77a9307a43eaca22270fe38648a`.
- Instrumented observer SHA-256:
  `250b56d412999892ebf308de491e528158929a4914c80b934156d6da89d7b195`.
- RSS sampler SHA-256:
  `6bea6159f116d77c8d9de7afd77a9c9bfac3961cc4e8f9316404fcb0b21e2555`.
- Private-retention utility SHA-256:
  `0ee3973afe665f35d50108ca4381afbfa894a75e1a9486b75f96e1229f17d91f`.
- Temporary instrumentation patch SHA-256:
  `c6c3143844c79301066c0749dbbd665ee52cb6924be499d468350bd692f770fc`.

The host was the approved `Mac17,2`, Apple M5, 24 GB configuration on macOS 26.5.1
(`25F80`), connected to AC power with Low Power Mode off. Node was 24.11.0, pnpm was
11.19.0, and rustc was 1.97.1. No debugger or development server was attached, and the packaged
candidate used local assets without a network dependency.

Both clean and instrumented packages used:

```text
VITE_PACKAGED_PREVIEW_OBSERVER_DISPATCH=1 corepack pnpm \
  --filter @ttrpg-map/desktop tauri build --bundles app --no-sign --ci
```

The exact sanitized command transcript is in [measurement-commands.md](measurement-commands.md),
with observation mapping, identities, run order, observations, and reconciliations in
[raw-results.json](raw-results.json). Private archive paths are deliberately absent.

## Instrumentation and reconciliation

The temporary patch wrapped the existing production request without changing controls, candidate
ordering, work scheduling, yields, progress, cancellation, preview values, or canvas geometry. It
recorded one sequential application timeline using `performance.timeOrigin + performance.now()`:

1. workflow input preparation;
2. generation setup and sampling;
3. threshold selection, with component traversal measured as a nested cumulative metric;
4. classification, validation, and preview-value materialization;
5. result wrapping, workflow state presentation, Svelte snapshot presentation, and canvas work;
6. profile receipt materialization.

The instrumented observer read that profile during its one final structured Accessibility receipt.
It independently measured observer dispatch-to-application latency, canvas-to-qualifying-frame,
qualifying-frame-to-Accessibility, and Accessibility receipt time. Every valid run contained the
same ordered stage set with no overlaps. Between application dispatch and recorded canvas
completion, 2–4 ms remained measured but unattributed. After recorded canvas completion, the
147.89–191.35 ms through the qualifying frame remains mixed and includes unmeasured application
probe publication plus browser paint and observer frame detection. For every valid receipt:

```text
observer dispatch-to-app + app dispatch-to-canvas + canvas-to-observer endpoint
= observer dispatch-to-final-Accessibility wall clock
```

The equality is exact in the retained numeric receipts; unexplained time is not assigned by
subtraction. The probe's preliminary serialization rounded to 0 ms in every profile, but its second
serialization and Svelte publication occurred after that timer and are not claimed as zero-cost.
The probes did not change process roles, request identity, selected results, or visible
qualification. Their unisolated post-canvas cost is retained as an instrumentation limitation, so
the decision relies on the independently valid clean issue #84 wall-clock failure and the repeated
dominant application-stage measurements rather than treating the instrumented wall clock as a
clean probe-overhead comparison.

## Results

One observer-valid proof-fixture warm-up completed in 883.60 ms and was not gated. It was followed
by three valid fresh processes for each required fixture in this order: proof, fragmented islands,
then control maximum.

| Fixture                                | Observer wall clock, three runs |    Median | App dispatch through canvas | Threshold selection | Component traversal | Mixed post-canvas through endpoint |
| -------------------------------------- | ------------------------------: | --------: | --------------------------: | ------------------: | ------------------: | ---------------------------------: |
| `milestone-2-atlas-proof`              |                829.59–886.91 ms | 881.66 ms |                  594–603 ms |          304–311 ms |          169–172 ms |                   212.55–260.88 ms |
| `milestone-2-atlas-fragmented-islands` |                871.85–936.59 ms | 931.59 ms |                  626–648 ms |          331–356 ms |          176–196 ms |                   224.39–267.75 ms |
| `milestone-2-atlas-control-max`        |                876.36–878.51 ms | 878.01 ms |                  622–636 ms |          332–340 ms |          203–207 ms |                   216.72–234.44 ms |

Sampling was 63–68 ms, classification was 159–161 ms, preview-value materialization was
52–55 ms, and canvas presentation was 3–4 ms across valid fresh processes. Workflow preparation,
wrapping, and state presentation were each 0–2 ms. Threshold selection remained the only
application stage above 207 ms and the only product boundary capable of accounting for the
79.59–186.59 ms repeated wall-clock overage without crossing into a second system boundary.

The selected threshold outputs were unchanged:

| Fixture            | Candidates |     Contour | Components | Largest component |
| ------------------ | ---------: | ----------: | ---------: | ----------------: |
| Proof              |         17 | `-13854891` |          3 |        50.276133% |
| Fragmented islands |         18 | `-13386485` |          7 |        54.385296% |
| Control maximum    |         18 | `-13340379` |          1 |              100% |

All proof and control-maximum diagnostic RSS deltas were below 256 MiB. Fragmented-islands run 2
was also below the limit, while runs 1 and 3 recorded 316.69 and 317.92 MiB. This three-run task is
not issue #84's release gate, so it makes no release claim and does not authorize a memory repair.
The updated #89 retains the 256 MiB requirement and stops for separate attribution if a post-repair
gate repeats an RSS-only failure outside the local traversal/allocation boundary.

## Invalid attempts and private retention

The first three control-maximum attempts were observer-invalid because no complete changed frame
satisfied the palette predicate. Post-endpoint inspection showed that the pre-dispatch native menu
automation had left enum controls at their defaults and intercepted the dispatch chord. Each
invalid observer receipt contains no timing or RSS conclusion. Each PID-bearing CSV was still
archived privately before its temporary copy was removed. The attempts were repeated only for that
recorded invalidation reason, using separately resolved and read-back-verified pre-dispatch menu
selection; the three retries then qualified the exact control-maximum fixture.

Every one of the 13 PID-bearing CSVs—one warm-up, nine valid diagnostics, and three invalid
attempts—has a successful issue #91 retention receipt. Public evidence retains only its opaque
artifact identifier, SHA-256, byte length, status, and receipt version. No PID, CSV content,
private archive path, service UUID, coalition identifier, executable path, or machine-specific
local path is present in the investigation.

## Verification and restoration

The probe-enabled tree passed type checking and observer compilation with warnings as errors. Its
focused threshold/classification, preview, progress/cancellation, packaged-dispatch, and workflow
selection finished with 54 passing tests. One initial source-shape assertion rejected Prettier's
temporary one-line call formatting; the probe call was reshaped without behavior change and that
focused test then passed. The issue #91 retention/security suite passed before any raw capture.

The temporary patch reversed cleanly. All nine touched production/observer files match their
recorded clean SHA-256 identities, and no temporary probe or runner remains in the production tree.
The restored broader verification results are recorded in [README.md](README.md).

## Scope preserved

No production behavior, generator version, public contract, worker/message boundary, scheduling or
cancellation contract, schema, persistence format, fixture, workload, resolution, observer
authority, hardware requirement, or numeric budget changed. This discovery does not execute #89,
rerun issue #84's five-run gate, or claim milestone release readiness.
