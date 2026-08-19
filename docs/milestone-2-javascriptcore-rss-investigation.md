# Milestone 2 JavaScriptCore RSS investigation

- **Issue:** [#76 — Attribute Apple M5/WebKit RSS and bound the next mitigation](https://github.com/ChadHealey/ttrpg-map-generator/issues/76)
- **Status:** Investigation complete; no production behavior, schema, worker, persistence, or render contract changed
- **Exact clean candidate:** `60285e2385a9ee50ff9c2a1997d25f68e20a1c73`
- **Measured:** 2026-08-18
- **Host:** MacBook Pro `Mac17,2`, Apple M5, 24 GB unified memory, macOS 26.5.1 (`25F80`), AC power, Low Power Mode off
- **Toolchain:** Node 24.11.0, pnpm 11.19.0, rustc 1.97.1
- **Durable evidence:** [raw results](investigations/issue-76/raw-results.json) and [sampler source](investigations/issue-76/rss-timeline.c)

This investigation uses two deliberately separate observations. A clean bundle built from the
exact committed candidate owns the release timing and peak result. A temporary marker build owns
phase attribution and unload observations. The marker build retained the production cooperative
`setTimeout` scheduling; an external Accessibility harness pressed the real packaged controls.
All diagnostic source was then removed and the clean application rebuilt.

## Conclusion

The proof fixture still fails the fixed full-generation memory budget. The exact clean candidate
completed full acceptance in **8.248 seconds** but reached **1,694.8 MiB additional aggregate RSS**
against the 768 MiB limit. WebContent alone reached a **1,854.1 MiB per-process peak**.

Production-scheduling phase attribution reached its high-water mark after semantic classification
and during coastline/transaction/scene work:

- field/partition complete: **950.7 MiB above** the pre-operation baseline;
- semantic classification complete: **1,498.9 MiB above** baseline;
- coastline complete: **1,756.5 MiB above** baseline;
- accepted scene presented: **1,763.9 MiB above** baseline.

RSS did not materially fall after references to the accepted document, geography, appearance,
scene, and preview were cleared. It was 1,977.3 MiB after ten seconds of accepted quiescence,
1,977.4 MiB at unload, and 1,977.0 MiB after fifteen more seconds. `vmmap` explains part of this
high-water behavior but does not establish a leak:

- Between presentation and accepted quiescence, WebKit malloc fragmentation fell from 290.4 MiB
  to 0.7 MiB and physical footprint fell from about 1.2 GiB to 862.1 MiB, while allocator payload
  remained high at 829.2 MiB.
- Immediately after accepted references were cleared, physical footprint was 873.5 MiB and
  allocator payload was 830.7 MiB. No collection attributable to unload had occurred yet.

The evidence therefore distinguishes three costs: transient generation/fragmentation, a large
accepted-or-uncollected JavaScript graph, and WebKit/JSC resident high-water pages. It cannot claim
how much of the post-unload graph would eventually be collected beyond the observed fifteen-second
window.

## Exact clean packaged reproduction

The exact candidate was identified before this repaired run. The final source commit and executable
identity were:

```text
commit: 60285e2385a9ee50ff9c2a1997d25f68e20a1c73
executable SHA-256: 98c2ab50f670b7ab8213a5cfcfb67c086c23df98b0ad6c90241bf1d45c0dd282
```

Build and sampler commands:

```text
corepack pnpm --filter @ttrpg-map/desktop tauri build --bundles app
clang -O2 -Wall -Wextra -o /private/tmp/issue76_rss_timeline_qos \
  docs/investigations/issue-76/rss-timeline.c
```

The sampler requested 5 ms observations and used `proc_pidinfo` for the app, GPU, networking, and
WebContent processes. The external harness recorded operation start/completion from named packaged
UI controls.

| Operation       |    Elapsed | Baseline RSS |    Peak RSS |  Additional RSS | Samples | Maximum interval |
| --------------- | ---------: | -----------: | ----------: | --------------: | ------: | ---------------: |
| Preview         |   628.4 ms |    212.3 MiB |   322.1 MiB |       109.8 MiB |     813 |         6.371 ms |
| Full acceptance | 8,248.5 ms |    322.0 MiB | 2,016.8 MiB | **1,694.8 MiB** |   3,247 |         6.359 ms |

Per-process peaks during full acceptance were:

| Process           |        Peak RSS |
| ----------------- | --------------: |
| App               |       103.9 MiB |
| WebKit GPU        |        43.6 MiB |
| WebKit networking |        15.4 MiB |
| WebKit WebContent | **1,854.1 MiB** |

The complete numeric summary, epoch timestamps, process IDs, artifact hashes, and compile command
are retained in [raw results](investigations/issue-76/raw-results.json). The raw RSS traces, cadence
records, marker log, and `vmmap` summaries are checked in beside that summary as non-canonical
investigation evidence.

## Production-scheduling phase attribution

Temporary diagnostics added synchronous epoch/count markers only. They did not replace, bypass,
or reorder the workflow's production cooperative yields. The same external packaged UI harness
ran preview and full acceptance. The qualifying attribution trace requested 5 ms samples, produced
8,110 samples, and observed a **12.665 ms maximum interval**.

Instrumentation overhead was measured against the exact clean run:

| Measure             |       Clean | Marker build |        Difference |
| ------------------- | ----------: | -----------: | ----------------: |
| Full elapsed        |  8,248.5 ms |   8,314.0 ms |  +65.5 ms (+0.8%) |
| Additional peak RSS | 1,694.8 MiB |  1,766.5 MiB | +71.7 MiB (+4.2%) |

Use the clean run for the release budget. Use the marker run to locate transitions and measure
post-operation state; the recorded overhead bounds its perturbation.

RSS below is the complete four-process aggregate. Delta uses a settled pre-operation sample of
211.7 MiB taken after the baseline marker and before preview.

| Checkpoint                       | Aggregate RSS |        Delta | Structural observation                                   |
| -------------------------------- | ------------: | -----------: | -------------------------------------------------------- |
| Preview presented                |     320.3 MiB |   +108.6 MiB | Disposable preview retained                              |
| Full dispatch                    |     320.8 MiB |   +109.1 MiB | Preview still resident                                   |
| Field/partition complete         |   1,162.4 MiB |   +950.7 MiB | 2,095,106 elevation values and 2,095,106 classifications |
| Semantic classification complete |   1,710.6 MiB | +1,498.9 MiB | 3 landmasses, 3 water bodies, 3,283 membership ranges    |
| Coastline complete               |   1,968.2 MiB | +1,756.5 MiB | 5 rings, 6,381 points                                    |
| Transaction validated            |   1,969.8 MiB | +1,758.1 MiB | 12 accepted aspects, 9 entities                          |
| Scene composed                   |   1,975.5 MiB | +1,763.9 MiB | 792 nodes, 14,056 points                                 |
| Accepted scene presented         |   1,975.5 MiB | +1,763.9 MiB | Accepted model and scene live                            |
| Accepted +10 s                   |   1,977.3 MiB | +1,765.7 MiB | Quiescent accepted state                                 |
| Accepted references cleared      |   1,977.4 MiB | +1,765.7 MiB | Unload did not trigger immediate collection              |
| Unloaded +15 s                   |   1,977.0 MiB | +1,765.3 MiB | No material raw-RSS reduction                            |

The two field/partition arrays contain 4,190,212 JavaScript elements. Even an optimistic
8-byte-per-element reference floor is about 32 MiB before backing stores, boxed values, strings,
semantic ranges, generator work arrays, and accepted representations. The observed transition is
far larger, so compaction must target the complete live representation and intermediates rather
than only the top-level arrays.

## Accepted versus allocator residency

The separate `vmmap -summary` trial inserted a five-second diagnostic observation gap between the
accepted-quiescent marker and clearing references. This gap occurs after full acceptance and does
not affect the operation trace.

| WebContent snapshot                            | Physical footprint | WebKit malloc allocated | Fragmentation |
| ---------------------------------------------- | -----------------: | ----------------------: | ------------: |
| Accepted scene presented                       |      about 1.2 GiB |               863.9 MiB |     290.4 MiB |
| Accepted quiescent, references still live      |          862.1 MiB |               829.2 MiB |       0.7 MiB |
| Immediately after clearing accepted references |          873.5 MiB |               830.7 MiB |         0 MiB |

Presentation-to-quiescence removes transient fragmentation without materially shrinking allocator
payload. Clearing the instrumented top-level references does not immediately reduce payload or
RSS. This observation cannot distinguish unreachable objects awaiting collection from an
unobserved retained reference. A worker-termination trial is the appropriate way to test whether a
hard runtime boundary returns these pages promptly.

## Canonical-output verification with diagnostics active

The marker module was explicitly enabled while running:

```text
ISSUE76_MEMORY_DIAGNOSTICS=1 corepack pnpm test:cross-platform
```

All 6/6 production PNG fixture tests passed and all eight registered deterministic fixture sets
verified. This compares the registered canonical semantic, scene, SVG, and PNG evidence while the
generation markers are active, rather than only after instrumentation is removed.

## Candidate mitigation boundaries

These are hypotheses for a follow-up implementation issue, not changes authorized by #76.

### Worker boundary — viable, but unlikely to be sufficient alone

A dedicated worker can contain transient generation/semantic/coastline allocations and gives the
runtime a hard reclamation boundary at termination. It also avoids relying on JSC's WebContent
collection timing.

**Falsifier:** reject a worker-only design if worker termination plus transfer still leaves the
accepted process-tree delta above 640 MiB, preserving less than 128 MiB headroom below the fixed
768 MiB limit, or if reconstructing the transferred graph recreates the peak in WebContent.

### Compact in-memory representation — viable and likely required

Use project-owned packed numeric buffers, indexes, or range encodings at the generator/accepted
boundary. The accepted-quiescent allocator payload of roughly 829 MiB in WebContent alone leaves
no credible process-tree headroom.

**Falsifier:** reject a proposed representation if an isolated accepted-state trial cannot save at
least 256 MiB physical footprint without changing canonical hashes, stable IDs, coordinate
semantics, inspection behavior, cancellation, or render output.

### Persisted encoding — not a direct operation-peak fix

A compact persisted encoding helps only if reopen maps or decodes lazily into a compact live model.
Persistence is not on the measured full-generation path.

**Falsifier:** reject persisted-format work for this budget if it eagerly reconstructs the same
JavaScript graph or reduces only disk bytes. Any format change requires a separate compatibility
issue, migration/version decision, and ADR.

### Recommended bounded sequence

Prototype a **worker plus compact transfer/accepted representation**, keeping canonical document,
scene, SVG, and PNG bytes as acceptance oracles. Measure worker termination and accepted quiescence
separately. Do not combine the prototype with a persisted-format migration.

## Final verification

After evidence capture, all diagnostic source was removed and production code restored. The final
documentation/evidence tree passed:

```text
corepack pnpm format:check
corepack pnpm test:cross-platform
```

The final diff retains only documentation, the durable raw summary, and the standalone macOS
sampler source. No production schema, worker, scheduling, persistence, fixture, or contract change
is included.
