# Issue 116 prelaunch foreground capture correction

This record owns the implementation-only issue #116 correction from exact integrated commit
`39fd7aa`. It changes only the external target-session readiness controller, its controller-only
foreground model and deterministic tests, and owning evidence. It authorizes no candidate launch,
marker publication, owner action, Computer Use, GUI automation, product action, fixture, sampler,
artifact, dispatch, measurement, issue #95 operation, or issue #104 activity.

## Source-backed diagnosis

The integrated controller created an `NSWorkspace.OpenConfiguration` with `activates = true`,
launched the candidate, waited for its Accessibility window, and only then read
`NSWorkspace.frontmostApplication`. It rejected a foreground PID equal to the candidate or
controller. A launch that requested candidate activation could therefore make the new candidate
the value incorrectly treated as the initial foreground anchor. Issue #115 observed the resulting
fail-closed stop before marker publication; its receipt and every earlier raw artifact remain
byte-unchanged.

## Corrected controller contract

The controller now captures one explicit Workspace foreground state before candidate launch. The
state is one of a retained application identity, desktop/no-application, or unavailable authority;
desktop is not represented by a magic PID. Controller ownership and unavailable initial authority
fail before launch. The exact candidate is then launched through the same coordinator with
activation explicitly disabled.

After the fresh exact process and Accessibility window are retained, the initial snapshot must
still classify as the same application anchor or the same explicit desktop state. The snapshot
must also read the retained candidate as Workspace non-frontmost and Accessibility supported-false.
Candidate frontmost, controller ambiguity, an undeclared third application, anchor drift,
unavailable Workspace or Accessibility authority, and process/window/executable drift all fail
closed before latch publication or during handoff. The only successful foreground path remains one
later transition from the retained initial state to the exact candidate.

The issue #110 marker lifecycle, one declared owner action, 120,000-ms / 50-ms handoff, retained
identity, supported positive frame, `AXRaise`, canonical independent observer, zero-operation
proof, cleanup, receipt schema, and public-privacy boundaries are unchanged. The explicit desktop
and unavailable states map to issue #110's existing sanitized diagnostic vocabulary.

## Deterministic verification

The focused controller suite exercises capture-before-launch ordering, nonactivating launch policy,
retained application and desktop anchors, controller-frontmost and missing-authority prelaunch
stops, candidate-already-frontmost, unavailable Accessibility readback, undeclared third-app focus,
the single exact-candidate transition from application and desktop anchors, identity/window drift,
and cleanup on success, timeout, invalidation, signal, and launch-failure terminal paths.

The focused core executable and full AppKit/ApplicationServices controller compile passed with
warnings as errors. The six issue #90/#91/#94/#96/#97/#98 predecessor Swift suites passed. Swift
format, Markdown format, public-privacy, authorized-surface, fixture/production-surface,
protected-evidence, and diff gates also passed. The protected checks proved every prior raw result,
issue #114, issue #115's receipt directory, canonical observer source, predecessor Swift source,
production source, and fixture byte unchanged from `39fd7aa`. No drift required an unrelated
expensive check.

## Qualification state

**IMPLEMENTED — NOT TARGET-RUN.** Issue #116 corrects the deterministic controller boundary only.
It supplies no owner-handoff, target-host, cancellation, first-paint, product, measurement, or
release evidence. Issue #115 remains immutable and invalid/consumed. Issue #104 remains blocked and
**UNCONSUMED**. Any later candidate qualification requires separate fresh authority.
