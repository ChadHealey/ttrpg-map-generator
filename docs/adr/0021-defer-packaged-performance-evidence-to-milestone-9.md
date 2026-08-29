# ADR-0021 — Defer packaged performance evidence to Milestone 9

- **Status:** Accepted
- **Date:** 2026-08-29
- **Decision owners:** Project maintainers
- **Supersedes:** Milestone 2 ownership of the remaining packaged reference-machine and
  cancellation-acknowledgement matrices
- **Superseded by:** None

## Context

Milestone 2's visible product proof is complete. The packaged application creates, saves, unloads,
reopens, selectively rerolls, and deterministically exports the accepted whole-world atlas. Local
and remote gates, deterministic SVG/PNG evidence, the reviewed visual gallery, functional
cancellation tests, and the corrected three-fixture coarse-preview budget all pass.

The remaining release-evidence rows measure packaged acknowledgement latency and reference-machine
full-generation/SVG/PNG timing and memory. They do not test an unimplemented atlas capability. The
preview cancellation replacement row became gated behind a zero-command observer qualification;
three consumed qualifications (#122, #124, and #126) failed in controller cleanup before a valid
receipt. The latest failure left no process, socket, or runtime directory behind. Its diagnosed
cause is a retained `NSRunningApplication` termination flag that depends on main-run-loop delivery
while the controller busy-polls that same actor.

Milestone 9 already owns large-export memory validation and packaged macOS release testing. Keeping
Milestones 3–8 behind this single-machine instrumentation defect would not reduce product risk: CI
already proves cooperative cancellation, no post-cancellation commit/replacement, deterministic
aftermath, and bounded PNG allocation.

## Decision drivers

- Close milestones on their visible product proof while retaining release-quality obligations.
- Preserve every failed, consumed, and unrun evidence record without reinterpreting it.
- Keep the published numeric limits and workloads stable.
- Repair the measurement controller before granting another live packaged-app authority.
- Avoid coupling Milestones 3–8 geography work to one-machine release instrumentation.

## Options considered

### Option A — Keep the complete packaged matrix in Milestone 2

Repair the controller, consume another zero-command qualification, run issue #104's replacement,
implement and qualify the remaining cancellation observer, and finally run all reference matrices.
This preserves the original ownership but keeps later product work behind several sequential,
single-consumption live sessions.

### Option B — Move the remaining matrix to Milestone 9

Close Milestone 2 on the passed visible workflow, deterministic and visual evidence, functional
cancellation semantics, cross-platform gates, and coarse-preview budget. Preserve the remaining
rows as deferred release-hardening requirements with their unchanged limits and evidence history.

## Decision

Adopt Option B.

Milestone 2 retains the passing coarse-preview matrix and all functional progress/cancellation
requirements. Milestone 9 owns:

- full-generation five-fresh-process timing and aggregate process-tree RSS;
- SVG and PNG export five-fresh-process timing, RSS, and destination ceilings;
- packaged preview cancellation acknowledgement within `100 ms`;
- packaged full-generation/SVG/PNG acknowledgement within `500 ms`; and
- five early, middle, and late trials per applicable safe-point class.

The workloads, Apple M5/24-GB reference environment, numeric limits, observer identity/security
requirements, private artifact-retention rules, and historical stop records remain unchanged. The
three invalid zero-command records remain `INVALID/CONSUMED`; issue #104 remains unconsumed and is
not evidence for either milestone.

Before any new live authority, Milestone 9 must split candidate/endpoint cleanup diagnostics,
preserve an earlier operation error instead of masking it with cleanup, ground candidate-death
proof in kernel process truth, and pass the frozen-handle and fail-closed identity regressions plus
a non-product stub-app harness.

## Consequences

### Positive

- Milestone 2 closes on implemented, visible atlas behavior and already-valid evidence.
- Release-quality performance and acknowledgement limits remain explicit and blocking for the MVP.
- Failed qualifications remain auditable rather than being deleted, waived, or relabeled as passes.
- Milestones 3–8 can proceed without weakening cancellation or deterministic-output semantics.

### Negative

- Packaged cancellation acknowledgement and the remaining reference-machine budgets are unproven
  until Milestone 9.
- Later hardening must restore trust in a specialized observer/controller before running the matrix.

### Neutral or follow-up

- ADR-0017 still owns the reference hardware and measurement protocol.
- ADR-0019 still owns the passed `900 ms` coarse-preview limit and `750 ms` stretch target.
- ADR-0020 still owns the process-bound command channel; the controller repair changes its
  qualification tooling, not its production protocol.
- No production behavior, persisted schema, generator version, seed, fixture byte, or numeric budget
  changes under this decision.

## Compatibility and migration

- **Accepted world documents:** Unchanged.
- **Persisted schemas and migrations:** Unchanged.
- **Generator, seed, parameter, context, style, and export versions:** Unchanged.
- **Canonical semantic/SVG/PNG/visual fixtures:** Unchanged.
- **Cancellation semantics:** Functional semantics remain required in Milestone 2; packaged latency
  measurement moves to Milestone 9.
- **macOS and Linux determinism:** Unchanged.
- **Parent and child maps:** Unchanged; the decision affects release evidence ownership only.

## Validation

Milestone 2 closes only after its release-evidence report shows passing product, deterministic,
visual, cross-platform, packaged-workflow, and coarse-preview rows and every included issue is
closed or moved out. Deferred rows must point to this ADR and their Milestone 9 owner.

Milestone 9 cannot close until the repaired controller is qualified and the retained reference and
cancellation matrices pass exactly as specified in the amended project plan and atlas-proof
contract.

## Revisit conditions

Revisit this decision if the retained workloads or limits cease to represent the supported MVP, the
designated hardware becomes unavailable, or release packaging changes the process tree or observer
threat model. Any change requires a new measured ADR; an unrun or failed row does not silently alter
the contract.
