# ADR-0017 — Milestone 2 Reference Hardware

- **Status:** Accepted
- **Date:** 2026-08-17
- **Decision owners:** Project maintainers
- **Supersedes:** The base Apple M1/8-GB reference-hardware requirement in the Milestone 2 proof contract
- **Superseded by:** None
- **Amended by:** [ADR-0021](0021-defer-packaged-performance-evidence-to-milestone-9.md)

## Context

The original Milestone 2 contract required a repeatable five-fresh-process protocol for wall-clock time, aggregate
process-tree memory, and cancellation acknowledgement. The original contract designated a base
Apple M1 Mac with 8 GB unified memory, but the project has no access to that hardware. The available
development machine is a MacBook Pro `Mac17,2` with an Apple M5 processor, 10 cores, 24 GB unified
memory, and macOS 26.5.1.

The existing packaged workflow was measured on this machine, but it was previously treated as
report-only. Its observed full-generation time is 31.045 seconds, which exceeds the unchanged
10-second contract budget; adopting the machine therefore does not imply that the release gate
already passes.

## Decision drivers

- Make the required release evidence executable on hardware the project can actually access.
- Keep the five-run timing, memory, cancellation, and workload protocol auditable.
- Avoid silently relaxing performance limits to fit one machine.
- Preserve deterministic output and cross-platform CI requirements.

## Options considered

### Option A — Keep the unavailable Apple M1/8-GB requirement

This preserves the original comparison point but leaves the release gate impossible to execute by
the project team.

### Option B — Designate the available Apple M5/24-GB Mac as reference hardware

This makes the protocol actionable while retaining the existing limits and requiring fresh formal
measurements before a pass can be recorded.

### Option C — Remove hardware-specific release measurements

This would make completion easier but would discard the resource and latency evidence required by
the Milestone 2 contract.

## Decision

Designate the Apple M5/24-GB MacBook Pro `Mac17,2` as the reference environment for the retained
whole-world atlas performance and cancellation workloads. The
existing workload limits remain unchanged. The formal reference result must consist of one untimed
warm-up followed by five fresh processes, with application process-tree RSS sampled at intervals no
greater than 20 ms and median/worst results reported. The exact packaged release configuration,
power, Low Power Mode, debugger, developer-tool, and network conditions remain part of the protocol.

## Consequences

### Positive

- The project can execute the required release protocol on available hardware.
- Reference observations and future regressions have one named, reproducible environment.
- Deterministic CI and cross-platform evidence remain separate from local hardware measurements.

### Negative

- The Apple M5/24-GB machine is not performance-equivalent to the former M1/8-GB target, so historical
  comparisons must not mix the two environments.
- The current full-generation observation exceeds the contract limit, leaving the Milestone 9
  release-hardening gate open.

### Neutral or follow-up

- Rerun the complete protocol in Milestone 9 and record every run, median, worst case, aggregate RSS,
  and cancellation acknowledgement result in the release-hardening evidence.
- Revisit the numeric budgets only through a separate measured decision; this ADR does not change them.

## Compatibility and migration

- **Accepted world documents:** None; hardware selection does not change persisted documents.
- **Persisted schemas and migrations:** None.
- **Generator, seed, parameter, context, or style versions:** None.
- **Canonical semantic/SVG/visual fixtures:** None; fixture bytes remain unchanged.
- **macOS and Linux determinism:** Unchanged; Linux CI remains required.
- **Parent and child maps:** None; the decision is limited to release measurement.

## Validation

Run the retained whole-world reference protocol during Milestone 9 on the designated Apple
M5/24-GB host for the three
gated atlas fixtures, including five fresh processes, RSS sampling, five cancellation trials at each
required safe-point class, and the existing timing, memory, and output ceilings. Record failures
instead of substituting narrower local commands.

## Revisit conditions

Reopen this decision if the designated Mac becomes unavailable, a measured workload demonstrates
that the limits are inappropriate, or a future supported release target establishes a more useful
reference environment.
