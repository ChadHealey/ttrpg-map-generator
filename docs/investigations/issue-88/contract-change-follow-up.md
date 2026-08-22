# Draft issue: define packaged-preview dispatch and RSS authorities

## Outcome

Approve and document both a visible packaged-preview dispatch boundary and an authoritative macOS
mechanism that identifies every process included in Milestone 2 packaged-app RSS. If either is
unavailable, explicitly revise its owning contract so a bounded observer can implement it without
post-dispatch scrolling, PID proximity, undocumented inference, or unapproved privilege.

## Background and evidence

Issue #88 established that the clean Tauri app and its WebKit GPU, Networking, and WebContent
helpers are all parented by `launchd` on the Apple M5 reference host. SDK-exposed BSD/libproc
interfaces expose their parent PID, paths, and RSS but no owning application or resource-coalition
identifier; `libproc.h` itself labels its interfaces private and subject to change.

The unlocked ScreenCaptureKit observation also established that the visible canvas and existing
preview control cannot remain on screen together in the packaged 1280-by-800 window. One
uninterrupted Accessibility command recorded the canvas at global y-coordinate 430 immediately
before AXPress and at y-coordinate 1393 in the sole final receipt. The cropped stream then produced
no preview-palette frame although that receipt reported a completed preview. Empty dirty-rectangle
attachments also make dirty-region intersection unavailable as an authority.

`launchctl print` displays a plausible app PID-domain service mapping and common application
resource coalition, but its own manual states that neither the output structure nor information is
an API and neither may be relied upon for any reason. `launchctl procinfo` requires root. The
evidence and API inspection are retained in
`docs/investigations/issue-88/preview-measurement-decision.md` and
`docs/investigations/issue-88/feasibility-receipt.txt`.

Without owner-approved dispatch and membership authorities, issue #84 cannot prove its unchanged
visible-first-paint or application-process-tree RSS limits.

## In scope

- Decide whether a test-only, non-production dispatch may invoke the existing preview action while
  the canvas remains visible, whether the product UI must keep the control and canvas visible
  together, or whether “first fully painted” must be revised to include a defined reveal action.
- Define the post-composite predicate without relying on dirty rectangles: complete display time,
  changed 512-by-256 baseline crop, calibrated palette populations, foreground continuity, and one
  final Accessibility receipt.
- Decide whether the pinned macOS 26.5.1 release protocol may treat launchd PID-domain service and
  application resource-coalition displays as authoritative diagnostic receipts despite their
  unsupported interface contract.
- Otherwise select a supported, authorized resolver and document any required privilege,
  entitlement, signing, or host preparation.
- Define exact app/helper membership, role validation, dynamic-helper handling, before/after
  revalidation, fail-closed behavior, and public/raw receipt policy.
- Update the owning performance contract and synchronized release-evidence summary.
- Produce one implementation-ready observer issue only after both authorities are accepted.

## Out of scope

- Implementing the preview observer or RSS sampler integration.
- Running, passing, failing, stopping, or resuming issue #84.
- Production generation, rendering, UI, worker, schema, fixture, workload, or scheduling changes.
- Changing the Apple M5 reference host, numeric budgets, cadence, baseline, or maximum-delta policy.
- Silently adding post-dispatch scrolling to the measured operation or treating offscreen Canvas
  rendering as a visible composite.
- Treating PID proximity, launch order, executable role alone, or an unsupported inference as
  implicit authority.

## Acceptance criteria

- [ ] The owning contract names one exact dispatch path that leaves the canvas visible from dispatch
      through the final receipt, or explicitly revises “first fully painted” and defines any reveal
      action included in wall-clock/RSS measurement.
- [ ] The decision records whether the dispatch path is production UI, a bounded test-only hook, or
      an approved UI change, including why it does not alter the measured workload.
- [ ] The post-composite predicate requires a complete display timestamp, a changed 512-by-256 crop,
      calibrated land/water populations, foreground continuity, and one final Accessibility
      receipt; empty dirty-rectangle attachments cannot invalidate an otherwise qualifying frame.
- [ ] The owning contract names one exact, reviewable source of app/helper membership and explains
      why it is authoritative under the reference-host constraints.
- [ ] The decision explicitly accepts or rejects `launchctl print`; acceptance records the manual's
      unsupported-output warning, host/OS pin, parse/information risks, and fail-closed conditions.
- [ ] The member set covers the Tauri app, WebKit GPU, Networking, WebContent, and any helper created
      or replaced between settled baseline and the final operation receipt.
- [ ] Role and ownership checks are separate: executable path may prove role only after the selected
      authority proves app membership.
- [ ] The contract defines behavior for missing, duplicate, replaced, late-created, exited, or
      unresolvable helpers; no invalid observation can emit a time/RSS result.
- [ ] Required privilege, entitlement, signing, TCC, or root preparation is explicit and compatible
      with the designated release-host conditions, or the option is rejected.
- [ ] Aggregate/per-process RSS, settled baseline, maximum sampled delta, and the no-greater-than
      20 ms interval remain unchanged unless separately re-approved with measured evidence.
- [ ] `docs/milestone-2-atlas-proof.md` and `docs/milestone-2-release-evidence.md` agree on the
      authority, resolver version/host scope, receipts, and invalidation rules.
- [ ] One bounded child issue is ready to implement and validate the approved resolver plus the
      post-composite observer before issue #84 is rerun.
- [ ] `corepack pnpm test:cross-platform` passes with no fixture or production behavior changes.

## Start here

1. `docs/investigations/issue-88/preview-measurement-decision.md` — unavailable dispatch/membership
   findings, post-composite predicate, and exact stop condition.
2. `docs/investigations/issue-88/feasibility-receipt.txt` — reference-host API/process evidence.
3. `docs/investigations/issue-84/preview-gate-2026-08-20/decision.md` — invalid PID-proximity attempt.
4. `docs/investigations/issue-76/rss-timeline.c` — existing fixed-PID sampler model.
5. `docs/milestone-2-atlas-proof.md#performance-progress-cancellation-and-resource-budgets` —
   owning membership and cadence contract.
6. `docs/milestone-2-release-evidence.md` — synchronized release-evidence status.
7. #84 — blocked release-protocol consumer.

## Implementation constraints

- Treat the `launchctl(1)` disclaimer as binding evidence, not merely a format-stability warning.
- Do not treat pre-dispatch visibility as sufficient when dispatch itself scrolls the canvas outside
  the window.
- Do not call a diagnostic correlation authoritative unless the contract owner explicitly accepts
  that risk and records its exact operational meaning.
- Do not introduce production instrumentation merely to make helper ownership observable.
- Preserve public-repository privacy: raw local process receipts may retain PIDs/UUIDs/coalitions,
  while committed summaries omit transient machine identifiers and local paths.
- Stop if the selected answer requires production changes or alters an additional
  performance-contract dimension; split that work into a separately reviewed decision.

## Verification

- Focused: reproduce the canvas/control geometry, stream crop behavior, public-header/API
  availability, BSD parentage, launchctl disclaimer, privilege requirements, and candidate resolver
  behavior on the unlocked reference host.
- Contract: review the exact membership set and invalidation rules against issue #84 and the
  Milestone 2 release protocol.
- Determinism: `corepack pnpm test:cross-platform` with no fixture updates.

## Dependencies

- Issue #88 decision and invalid evidence are accepted.
- The reference environment remains `Mac17,2`, Apple M5, 24 GB, macOS 26.5.1 (25F80).

## Risks and unknowns

- Accepting `launchctl print` creates an intentional dependency on output Apple says is not an API;
  OS pinning and fail-closed parsing cannot guarantee semantic stability.
- A supported resolver may require root, entitlement, signing, or a private interface incompatible
  with the current release-host contract.
- WebKit may replace or create helpers during an operation, requiring dynamic rather than fixed-PID
  sampling.
- A test-only dispatch may cease to represent the production UI path; a post-dispatch reveal action
  may make the 750 ms limit unattainable or redefine the user-visible operation.

## Readiness

- State: READY
- Rationale: both blocked contract boundaries, observed platform behavior, alternatives, owner, and
  stop conditions are explicit. No measurement implementation is authorized.
- Recommended labels: existing `bug`; recommended missing labels are `codex-ready`, `discovery`,
  `complexity:C3`, and `risk:hardware`.

## Codex execution profile

- Complexity: C3 — Moderate
- Complexity score: 2 breadth + 2 uncertainty + 0 state-risk + 2 verification + 1 dependencies =
  7/10
- Complexity rationale: two coupled contract decisions span packaged UI visibility and macOS
  process authority; production and release measurement are excluded.
- Critical risk flags: hardware/environment-specific verification.
- Execution class: Frontier
- Current recommendation: `gpt-5.6-sol` / high
- Recommendation date: 2026-08-21
- Context fit: PASS — two owner decisions, bounded platform evidence, synchronized documentation,
  and one later child-authoring outcome.
- Expected reading: Medium
- Change surface: performance contract, release-evidence summary, and one implementation-child plan.
- Verification surface: reference-host UI/compositor and authority/privilege evidence plus
  cross-platform fixtures.
- Split or escalation trigger: production instrumentation, a second contract dimension, or broad
  benchmark infrastructure.
