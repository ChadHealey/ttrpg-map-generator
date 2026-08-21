# Issue 87 packaged preview latency decision

## Decision

Do not make a production performance change from the multi-second issue 83/84 observations. On the
exact issue 84 commit, a temporary instrumented packaged build showed that all three fixtures
reached a post-paint frame in 612–650 ms when the designated app remained frontmost. The same proof
fixture expanded to 42,219 ms through canvas draw when separate harness commands allowed the app to
lose foreground scheduling. That invalid pilot reproduced the apparent failure mode: the cooperative
yields, rather than one deterministic computation stage, were timer-throttled.

Resume issue 84 with one foreground-preserving harness lifetime and run its unchanged warm-up plus
five-fresh-process preview gate. Do not treat the single diagnostic observation per fixture here as
the release gate. A background-preview requirement would be a new product and scheduling contract;
it would require a separate design decision and cannot be inferred from the current “first visibly
painted” foreground contract.

If valid issue 84 runs still fail the 750-ms limit, the smallest credible production boundary is
only the exact local component traversal inside `selectAtlasLandWaterThreshold`. Preserve the
candidate set, selected contour, proxy results, progress/cancellation semantics, fixture bytes, and
public contracts. A worker is not the next boundary: it may change responsiveness, but it does not
remove this measured completion cost. The conditional implementation issue is drafted in
[implementation-child-draft.md](implementation-child-draft.md).

## Evidence

The clean package rebuilt commit `fdda1c91f7f68b8b5072f2b7b376381e762a29f5` to the exact issue 84
executable SHA-256
`333faea6f4403f94836de40b1cdf087c0202c7a42ddf6758bb11473eff5156d2`; it was reference-checked but
not stage-profiled. Every timing observation used the temporary instrumented executable SHA-256
`8384bc3ad9c5369363055a879b3cf5c0804af7408a7d8ef11a6b50a336be88ba`. Per-observation executable
and command mappings are retained in [raw-results.json](raw-results.json), the exact commands are in
[measurement-commands.md](measurement-commands.md), and the inspectable probe source is retained as
[instrumentation.patch](instrumentation.patch). The probes were removed from production sources
before this evidence diff.

| Fixture                                | Sampling | Threshold | Classification | Materialize | Canvas | First paint | Headroom |
| -------------------------------------- | -------: | --------: | -------------: | ----------: | -----: | ----------: | -------: |
| `milestone-2-atlas-proof`              |    62 ms |    304 ms |         173 ms |       50 ms |   3 ms |      612 ms |   138 ms |
| `milestone-2-atlas-fragmented-islands` |    68 ms |    339 ms |         169 ms |       50 ms |   3 ms |      650 ms |   100 ms |
| `milestone-2-atlas-control-max`        |    69 ms |    332 ms |         172 ms |       51 ms |   3 ms |      646 ms |   104 ms |

Threshold selection was dominant in every valid observation at 304–339 ms, or roughly half of
completion time. It evaluated 17 candidates for the proof fixture and 18 for each stressed fixture.
The selected outcomes were, respectively:

- contour `-13854891`, three water components, largest component `50.276133%`;
- contour `-13386485`, seven water components, largest component `54.385296%`;
- contour `-13340379`, one water component, largest component `100%`.

Classification was the second-largest stage at 169–173 ms. Sampling was 62–69 ms, combined preview
value materialization was 50–51 ms, and the existing 512-by-256 image/offscreen-canvas path was 3
ms. The packaged Accessibility receipt named the painted image `Disposable coarse atlas preview`,
showed the disposable-preview caption, and enabled `Accept full atlas`.

## Interpretation and boundary

An exact local traversal optimization is credible for additional foreground headroom because the
threshold component walk is the measured dominant stage and is contained within one generation
module. It is not credible as a repair for the retained background pilot: timer throttling expanded
both sampling and classification and added about one second per threshold-candidate cooperation
point. Removing those yields would weaken the existing cancellation/progress contract, while merely
making each traversal faster would leave the throttled scheduling gaps.

Therefore the immediate boundary is evidence-method correction in issue 84. The production child
remains `NOT READY` until a correctly foregrounded five-run gate demonstrates a product failure.

## Verification and limitations

The temporary instrumented tree passed 33 focused preview, threshold/classification, determinism,
progress/cancellation, and atlas workflow tests. The restored clean candidate is checked by the
unchanged cross-platform fixture gate recorded with this issue's final diff.

This discovery captured one valid fresh process per gated fixture after one untimed warm-up. It
does not replace issue 84's five-run timing/memory protocol, exports, or cancellation matrix. The
invalid foreground-loss and process-ambiguity pilots remain in the raw evidence rather than being
silently replaced.
