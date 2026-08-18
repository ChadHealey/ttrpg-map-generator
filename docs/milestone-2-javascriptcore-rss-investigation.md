# Milestone 2 JavaScriptCore RSS investigation

- **Issue:** [#76 — Attribute Apple M5/WebKit RSS and bound the next mitigation](https://github.com/ChadHealey/ttrpg-map-generator/issues/76)
- **Status:** Investigation complete; no production behavior, schema, worker, persistence, or render contract changed
- **Candidate:** `b75a584640842cfe33fb1235b69ddbc5716ca4ba`
- **Measured:** 2026-08-18
- **Host:** MacBook Pro `Mac17,2`, Apple M5, 24 GB unified memory, macOS 26.5.1 (`25F80`), AC power, Low Power Mode off
- **Toolchain:** Node 24.11.0, pnpm 11.19.0, rustc 1.97.1

This investigation separates the clean packaged release-candidate observation from a temporary
diagnostic bundle used to place phase markers and unload accepted state. All diagnostic source was
removed, the clean application was rebuilt, and only this report plus its release-evidence link
remain in the repository.

## Conclusion

The failed full-generation RSS budget is not explained by one permanently live object graph.
Both of these effects are material:

1. Generation creates a large transient JavaScriptCore high-water mark. The qualifying diagnostic
   trace peaked at **1,417.5 MiB aggregate RSS**, with **1,297.4 MiB** in WebContent. The peak occurs
   after the two 2,095,106-element field/partition arrays exist and during semantic/coastline work.
2. Accepted state is also substantial. Ten seconds after presentation, aggregate RSS was
   **926.5 MiB**, or **713.4 MiB above** the settled pre-operation baseline. Fourteen seconds after
   explicitly dropping the accepted document, geography, appearance, scene, preview, and UI
   references, aggregate RSS was still **693.2 MiB**, or **480.2 MiB above** baseline.

The unload experiment and `vmmap` snapshots show why RSS alone overstates live retained data.
WebContent's reported physical footprint fell from **1.1 GiB accepted** to **340.9 MiB immediately
after unload**, and the WebKit malloc zone's allocated bytes fell from **679.4 MiB** to
**300.9 MiB**. At the same time, raw resident pages stayed high: unloaded WebKit Malloc still had
**683.5 MiB resident**, mostly clean/reusable pages. Therefore roughly **378.5 MiB** of allocator
payload was logically released in this observation, while WebKit/JSC retained a large resident
high-water pool. This is evidence of both live-model cost and allocator retention, not proof of a
leak.

## Clean packaged baseline

The clean source content later committed as `b75a584...` was measured by the issue-70 packaged
harness, then rebuilt from that exact commit for this investigation with:

```text
corepack pnpm --filter @ttrpg-map/desktop tauri build --bundles app
```

The final clean rebuild transformed 328 modules and produced a 9.6 MiB unsigned application. Its
arm64 executable SHA-256 is
`98c2ab50f670b7ab8213a5cfcfb67c086c23df98b0ad6c90241bf1d45c0dd282`.

The clean packaged proof fixture (`milestone-2-atlas-proof`, run 1) recorded:

| Operation       |    Elapsed | Baseline RSS |    Peak RSS |  Additional RSS | Maximum sample interval |
| --------------- | ---------: | -----------: | ----------: | --------------: | ----------------------: |
| Preview         |   646.3 ms |    212.4 MiB |   324.5 MiB |       112.1 MiB |               15.086 ms |
| Full acceptance | 4,823.4 ms |    324.5 MiB | 1,666.1 MiB | **1,341.6 MiB** |               16.092 ms |

The four sampled PIDs were the app, GPU, networking, and WebContent processes. WebContent accounted
for 1,505.0 MiB at the full-operation peak. The raw record is
`/private/tmp/issue70-generation-results.json`, SHA-256
`e9af27d054628508802615185c0f2d7a971f5abf4b9c8fe9004e83c63103cd95`.

## Diagnostic method and limitations

Temporary diagnostics added synchronous epoch markers after full dispatch, field/partition
generation, semantic classification, coastline derivation, appearance generation, transaction
validation, scene composition, accepted presentation, accepted quiescence, accepted-state unload,
and unload quiescence. Markers also recorded structural counts. A `proc_pidinfo` sampler observed
the app plus the three new WebKit helper processes.

The qualifying command requested 5 ms samples for 70 seconds:

```text
/private/tmp/issue76_rss_timeline_qos 70 5 \
  /private/tmp/issue76-diagnostic-rss-qualifying.csv \
  91337 91339 91340 91341
```

It produced 11,477 samples with a **12.577 ms maximum interval**, satisfying the issue's 20 ms
maximum. The CSV SHA-256 is
`fc6945edfa8f09f1e2222640f104d452aa1e50f694bb47b7e93695fba1716799`;
the marker log SHA-256 is
`a318b7242abb8c21598d926a19ebd1a1c27f8bd9cf72e29f0e77494160cd9284`.

macOS exposed the launched WebKit window on a different Space, which throttled the production
zero-delay cooperative timers. For the diagnostic bundle only, cooperative yields used resolved
microtasks. This preserved the same deterministic generators, accepted transaction, scene
composition, object counts, and unload behavior, but it changed scheduling and made the diagnostic
full operation much slower. Consequently, use the clean packaged run above for release timing and
peak-budget status; use the diagnostic run only for phase attribution and retained-versus-released
memory. A separate pair of `vmmap -summary` snapshots introduced sampler contention and is not the
qualifying cadence trace. Their hashes are
`c19fe91d47ddf076cc88c29d58920055365ae67ee080404bb975f475152c0d54` (accepted) and
`a5434ca79a257a0c6b97ce6230d162a6a1ecec570358d4cecb58acc5a1297066` (unloaded).

## Phase attribution

RSS below is the complete four-process aggregate. Delta uses the settled pre-operation baseline
of 213.1 MiB. The last qualifying sample is fourteen seconds after unload; the marker log confirms
the requested fifteen-second quiescence completed one second after sampling ended.

| Checkpoint                       | Aggregate RSS | Delta from baseline | WebContent RSS | Structural observation                                    |
| -------------------------------- | ------------: | ------------------: | -------------: | --------------------------------------------------------- |
| Settled pre-operation            |     213.1 MiB |                   — |       56.0 MiB | No preview or accepted atlas                              |
| Preview presented                |     539.2 MiB |          +326.1 MiB |      382.1 MiB | Disposable preview retained                               |
| Full dispatch                    |     541.0 MiB |          +327.9 MiB |      382.2 MiB | Preview still resident                                    |
| Field/partition complete         |     880.7 MiB |          +667.7 MiB |      757.9 MiB | 2,095,106 elevation values and 2,095,106 classifications  |
| Semantic classification complete |   1,325.6 MiB |        +1,112.5 MiB |    1,205.5 MiB | 3 landmasses, 3 water bodies, 3,283 membership ranges     |
| Coastline complete               |   1,022.2 MiB |          +809.1 MiB |      902.1 MiB | 5 rings, 6,381 points                                     |
| Transaction validated            |   1,026.6 MiB |          +813.5 MiB |      906.5 MiB | 12 accepted aspects, 9 entities                           |
| Scene composed                   |   1,009.0 MiB |          +795.9 MiB |      888.9 MiB | 792 nodes, 14,056 points                                  |
| Accepted scene presented         |   1,017.6 MiB |          +804.5 MiB |      893.6 MiB | Accepted model and scene live                             |
| Accepted +10 s                   |     926.5 MiB |          +713.4 MiB |      800.6 MiB | Quiescent accepted state                                  |
| Accepted state dropped           |     928.1 MiB |          +715.0 MiB |      802.2 MiB | References cleared; collection not immediate              |
| Unloaded +14 s                   |     693.2 MiB |          +480.2 MiB |      570.7 MiB | Logical release observed; allocator pages remain resident |

Interval peaks further localize the high-water mark:

| Interval                                    | Peak aggregate RSS |
| ------------------------------------------- | -----------------: |
| Full dispatch → field/partition complete    |          966.8 MiB |
| Field/partition → semantic complete         |        1,377.8 MiB |
| Semantic complete → coastline complete      |    **1,417.5 MiB** |
| Coastline → accepted presentation           |        1,039.6 MiB |
| Accepted presentation → accepted quiescence |        1,021.6 MiB |

The two field/partition arrays alone contain 4,190,212 JavaScript elements. Even an optimistic
8-byte-per-element reference floor is about 32 MiB before array backing stores, boxed values,
strings, semantic range objects, generator work arrays, and duplicate accepted representations.
The much larger observed changes confirm that structural compaction must target the complete live
representation and intermediates, not just the top-level arrays.

## Candidate mitigation boundaries

These are bounded hypotheses for a follow-up implementation issue, not changes authorized by #76.

### 1. Worker boundary — viable for transient high-water isolation

Run full generation, semantic derivation, coastline, and transaction validation in a dedicated
worker, transfer a compact validated result, then terminate the worker after acceptance. This is
the strongest first lever because the operation peak is about 491 MiB above accepted quiescence,
and worker termination gives the runtime a hard reclamation boundary.

**Falsifier:** reject this as sufficient if a prototype that terminates the worker still leaves
additional process-tree RSS above 768 MiB, or if the transferred accepted graph recreates most of
the worker peak in WebContent. Worker protocol and deterministic error/cancellation semantics must
remain explicit; no ambient randomness or silent repair is allowed.

### 2. Compact in-memory representation — viable and likely needed with the worker

Replace per-sample boxed/string-heavy live structures with project-owned packed numeric buffers,
indexes, or run-length/range encodings at the generator/accepted-state boundary. The accepted
quiescent delta of 713.4 MiB leaves only about 54.6 MiB of headroom, so the current accepted model
is too close to the 768 MiB limit even if worker termination eliminates transient allocations.

**Falsifier:** reject a proposed representation if an isolated accepted-state measurement cannot
save at least 128 MiB process-tree RSS without changing canonical hashes, stable IDs, coordinate
semantics, inspection behavior, or render output. Hide any third-party buffer type behind a
project-owned adapter.

### 3. Persisted encoding — not a direct peak fix by itself

A compact persisted encoding is useful only if reopen can map or decode lazily into a compact live
model. Persistence is not on the measured full-generation path, so changing bytes on disk alone
cannot reduce the operation peak.

**Falsifier:** reject persisted-format work for this budget if the same accepted JavaScript object
graph is eagerly reconstructed, or if the size reduction exists only on disk. Any format change
would require a separate compatibility issue, versioning decision, migrations, and ADR.

### Recommended bounded sequence

Prototype a **worker plus compact transfer object** first, retaining the current canonical
document/scene/output bytes as acceptance oracles. Measure worker-exit RSS and accepted quiescence
separately. Add compact accepted storage only if the worker prototype does not preserve at least
128 MiB of headroom below the fixed 768 MiB process-tree budget. Do not combine this with a
persistence-format migration.

## Verification and publication gate

The temporary diagnostic tree passed the desktop Svelte/TypeScript check and packaged build. The
PNG export test portion of `corepack pnpm test:cross-platform` passed 6/6; the fixture convention
stage correctly rejected the temporary diagnostic import because diagnostic files were not part
of the fixture runtime copy. After removing every diagnostic source file and restoring production
code byte-for-byte, the clean bundle rebuilt successfully. The required final commands were:

```text
corepack pnpm format:check
corepack pnpm test:cross-platform
```

The final documentation-only tree passed `corepack pnpm format:check`. It also passed
`corepack pnpm test:cross-platform`: 6/6 production PNG fixture tests and all eight registered
deterministic fixture sets, covering the canonical semantic, scene, SVG, and PNG evidence. The
temporary diagnostics therefore did not change accepted canonical outputs.

Issue #76 is C3. Before publishing or closing it, obtain a dedicated read-only review with:

```text
/review Review the branch diff against GitHub issue 76 and its acceptance criteria, reporting only actionable correctness, regression, security, or test findings.
```
