# ADR-0019 — Coarse preview release budget

- **Status:** Accepted
- **Date:** 2026-08-23
- **Decision owners:** Project maintainers
- **Supersedes:** The `750 ms` coarse-preview wall-clock limit in the Milestone 2 proof contract
- **Superseded by:** None

## Context

The Milestone 2 proof contract set a `750 ms` coarse-preview limit before the atlas implementation
existed. Commit `8d9b0b7042287b131e6372a8b852bd7a9eefe073` introduced that number with the
initial proof contract; it did not cite a prototype measurement, user study, or earlier release
baseline. [ADR-0017](0017-milestone-2-reference-hardware.md) later designated the available Apple
M5/24-GB Mac as the reference machine, retained the original limits, and required a separate
measured decision if a workload showed that a numeric budget was inappropriate.

The first valid packaged observation completed in `861.25 ms`, which correctly failed the original
limit and stopped the release protocol. Follow-up attribution isolated `176–196 ms` of repeated
water-component traversal in the slowest diagnostic. Issue
[#89](https://github.com/ChadHealey/ttrpg-map-generator/issues/89) replaced that repeated traversal
with one deterministic component sweep. The repair did not change the preview dimensions, fixture
inputs, production request path, observer endpoint, scheduling, accepted state, or output bytes.

After the repair, one warm-up and five clean fresh processes for each required fixture were measured
through the approved labelled-first-paint observer. All fifteen fresh runs were valid and below
`900 ms` and `256 MiB` additional process-tree RSS. Their wall-clock range was `744.92–809.40 ms`;
only three of the fifteen were below `750 ms`. Medians were `756.46 ms` for the proof fixture,
`789.86 ms` for fragmented islands, and `794.54 ms` for control max. The owner also found the current
preview latency acceptable in normal app use.

The contract needs to preserve a meaningful, sub-second regression boundary without forcing
additional workers, scheduling changes, observer changes, or a lower-resolution workload solely to
meet an unsupported pre-implementation estimate.

## Decision drivers

- Keep the visible deterministic `512 × 256` coarse-preview workload and labelled-first-paint
  endpoint unchanged.
- Set a hard limit supported by the complete corrected fixture matrix, with useful headroom above
  ordinary run-to-run variation.
- Retain pressure toward the original latency intent without representing an unsupported number as
  a release blocker.
- Avoid expanding the production architecture or measurement authority when the measured user
  experience is acceptable.
- Preserve the `256 MiB` memory limit, progress and cancellation limits, five-fresh-process rule,
  and fail-closed observer requirements.

## Options considered

### Option A — Keep `750 ms` as the hard limit

This would reject twelve of fifteen valid post-repair runs despite the bounded algorithmic repair
and acceptable observed interaction. Meeting it would likely require a broader worker, scheduling,
observer, or workload change without evidence of a user-visible problem.

### Option B — Set `850 ms` as the hard limit

This would pass the measured matrix but leave only `40.60 ms`, or about `5.0%`, above the worst run.
That margin is too small for a five-process machine-level release gate and would make harmless host
variation likely to reopen the same work.

### Option C — Set `900 ms` as the hard limit and retain `750 ms` as a stretch target

This keeps the operation below one second, leaves `90.60 ms`, or about `11.2%`, above the measured
worst run, and continues to report whether individual runs meet the original target. It changes no
other acceptance meaning.

### Option D — Change the workload or measurement boundary

Reducing resolution, weakening first-paint evidence, or excluding helper processes could manufacture
a pass while measuring a different product operation. This would discard the comparability built
into the proof contract.

## Decision

Adopt Option C. The Milestone 2 coarse-preview wall-clock release limit on the designated reference
Mac is `900 ms`. After one untimed warm-up, every one of five clean fresh-process runs for each of
the three required fixtures must complete within `900 ms`; median and worst values remain required.

Retain `750 ms` as a reported, non-blocking stretch target. Evidence records how many fresh runs meet
it, but a run between `750 ms` and `900 ms` is not a release failure.

The fixed fixture inputs, production dispatch path, complete labelled `512 × 256` first-paint
endpoint, observer authorities, process-tree membership, `20 ms` maximum RSS sampling interval,
`256 MiB` peak additional RSS limit, progress rules, cancellation acknowledgement limit, output
requirements, and all non-preview budgets remain unchanged.

## Consequences

### Positive

- The hard budget reflects a complete measured matrix rather than a pre-implementation estimate.
- The gate still catches a roughly `10%` regression from the measured worst run and preserves a
  sub-second product promise.
- Reporting the `750 ms` stretch target keeps further bounded improvements visible.
- No worker, scheduler, observer, fixture, resolution, persistence, or accepted-state change is
  authorized by this decision.

### Negative

- The release contract permits up to `150 ms` more latency than its original coarse-preview limit.
- The current implementation has only about `80 ms` of measured worst-case headroom, so meaningful
  regressions can still fail the gate.

### Neutral or follow-up

- Historical observations remain evaluated against the contract in force when they were recorded;
  they are not retroactively converted into passing issue #84 evidence.
- The broader Milestone 2 reference protocol remains incomplete until the full-generation, export,
  and cancellation lanes are run under their unchanged limits.

## Compatibility and migration

- **Accepted world documents:** Unchanged; preview remains a disposable proposal.
- **Persisted schemas and migrations:** None.
- **Generator, seed, parameter, context, or style versions:** Unchanged.
- **Canonical semantic/SVG/visual fixtures:** Unchanged; no fixture bytes are regenerated.
- **macOS and Linux determinism:** Unchanged; this is a local reference-hardware wall-clock limit.
- **Parent and child maps:** Unchanged.

## Validation

The accepted issue #89 matrix used packaged executable SHA-256
`0327af7dcc5ab794e0d3f191a89bb62dcde60f5c985c7a56cb5acc944c4fa548`, observer SHA-256
`a0f1959fcc8b200c900094a845b77fb63c86582904acf97211323779ac2a079a`, and sampler SHA-256
`2e74843ef4e566c0aa27e95efdb000cdd4d17a2caa6c9b834ab1c256382781f6` on MacBook Pro `Mac17,2`,
Apple M5, 24 GB, macOS 26.5.1 (`25F80`). The
[release-evidence report](../milestone-2-release-evidence.md#issue-89-post-repair-coarse-preview-proof-2026-08-23)
records the warm-up, all fifteen corrected fresh runs, fixture medians and worst cases, memory
measurements, observer identity, and private raw-artifact retention status.

Future validation uses the unchanged protocol with `900 ms` as the hard limit and reports the
number of runs at or below the `750 ms` stretch target.

## Revisit conditions

Reopen this decision if representative user feedback identifies preview latency as disruptive, the
same fixed workload exceeds `900 ms`, measurements on a supported slower reference target require a
portable budget, or a bounded algorithmic improvement produces enough stable headroom to lower the
hard limit. Do not reopen it merely to introduce workers, scheduling, observer changes, or a
different workload without separate measured evidence.
