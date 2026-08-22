# Issue 88 packaged preview measurement decision

## Decision

**CONTRACT REVISION REQUIRED — the current non-production boundary can prove neither a visible
post-composite preview nor authoritative application-process-tree RSS membership on the reference
host.** A cropped ScreenCaptureKit stream can distinguish the preview after it is visible, but
pressing the existing offscreen preview control scrolls that control into view and moves the canvas
outside the packaged window. The installed public SDK also exposes neither WebKit ownership nor
application resource-coalition membership. BSD ancestry ends at `launchd`; `launchctl procinfo`
requires root; and the `launchctl(1)` manual explicitly forbids relying on either the structure or
information emitted by `launchctl print`.

The owner of
`docs/milestone-2-atlas-proof.md#performance-progress-cancellation-and-resource-budgets` must
approve exact preview-dispatch/visibility and helper-membership authorities before measurement
implementation or issue #84 can resume. The required follow-up is drafted in
[contract-change-follow-up.md](contract-change-follow-up.md). No implementation-ready measurement
child is valid until that contract decision is accepted.

This decision makes no release determination. The issue-84 attempt remains invalid, issue #84
stays blocked, and the issue-87 instrumented executable remains diagnostic only. No production
behavior, schema, fixture, workload, hardware condition, numeric budget, or RSS policy changed.

## Paint and label boundaries

The current contract measures dispatch through the first fully painted, labelled 512-by-256
effective preview. These events are distinct:

| Event                                 | What it establishes                                                     | Authority now                          |
| ------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------- |
| DOM and Accessibility publication     | WebKit exposed a new label/state to assistive technology                | Insufficient                           |
| `drawImage` return                    | Canvas commands completed on the WebContent thread                      | Insufficient                           |
| issue-87 double animation-frame probe | A temporary build crossed a browser paint opportunity after Canvas work | Diagnostic only                        |
| qualifying `SCStream` frame           | WindowServer displayed changed pixels in a visible canvas crop          | Signal available, dispatch unavailable |
| one final Accessibility receipt       | The displayed preview is labelled and actionable                        | Required endpoint                      |

The installed macOS 26.5.1 SDK defines `SCStreamFrameInfoDisplayTime` as the Mach absolute time
when WindowServer displayed a frame and `SCFrameStatusComplete` as a newly generated frame. A
qualifying frame can therefore prove post-composite display, but the current UI exposes no
non-production dispatch that leaves the canvas visible for that frame.

The wall-clock endpoint must nevertheless be completion of the one final Accessibility receipt,
not the earlier display timestamp. A frame can precede label publication. Recording the receipt
completion conservatively measures through both conditions and prevents a false pass. The observer
would retain display time and callback arrival as ordering and perturbation diagnostics.

### Required frame predicate and failed target validation

Before dispatch, an observer can scroll the canvas into the visible window, obtain its Accessibility
bounds, start a desktop-independent window stream, and wait for one complete baseline frame. From
dispatch until the qualifying frame it must make no Accessibility calls. A frame would qualify only
when all of the following hold:

1. status is `SCFrameStatusComplete` and display time is later than dispatch;
2. the 512-by-256 crop differs from its pre-dispatch baseline;
3. the crop contains bounded populations of both production preview
   palette colors, allowing only a documented color-conversion tolerance; and
4. the target app remained frontmost.

`SCStreamFrameInfoDirtyRects` is diagnostic only. The unlocked target-host stream emitted empty
dirty-rectangle arrays for the complete baseline and for changed-background frames in an invalid
pilot, so requiring an intersection would reject the actual capture path even when pixels change.

Immediately afterward, the observer would take exactly one structured Accessibility receipt for
the preview label, disposable caption, enabled `Accept full atlas`, and final frontmost state. The
receipt-completion time would end wall-clock and RSS sampling. A mismatch invalidates the
observation.

The unlocked target-host run established the missing feasibility result. One uninterrupted
Accessibility command activated the candidate, retained the preview button, scrolled the canvas
visible, and recorded the 744-by-374 canvas at global `(708, 430)` immediately before AXPress. It
made no Accessibility reads after AXPress until the one final structured receipt, which reacquired
the replaced preview nodes and recorded the canvas at global `(708, 1393)`. The 1280-by-800 window
remained at `(640, 183)`, and the final receipt reported the preview label, disposable caption,
enabled acceptance control, and `frontmost=true`. This brackets the scroll movement at dispatch
rather than at an intervening focus or activation change.

The stream cropped the pre-dispatch window-local `(68, 247, 744, 374)` source to 512 by 256 pixels
and produced no qualifying palette frame after the canvas moved below the window. A separate
explicitly scrolled post-preview capture recovered both color populations, proving the capture
signal works once the canvas is visible.

Therefore ScreenCaptureKit is not an implementation-ready method under the existing UI. Making it
one requires either an owner-approved test-only dispatch that does not scroll the control into view,
a product/UI change that keeps the canvas visible, or a revision of the current visible-first-paint
boundary. Scrolling after dispatch would add a new observer action to the measured operation and
cannot be adopted silently.

The observer must not infer effective profile dimensions from capture output. The clean candidate
hash, `world-atlas-preview-v1` contract, and unchanged fixtures establish the 512-by-256 workload.
A 512-by-256 capture crop only bounds observer work.

## Application membership is unavailable

### Public mechanisms inspected

On the reference host, the clean app plus its WebKit GPU, Networking, and WebContent helpers all
reported parent PID 1. `PROC_PIDTASKALLINFO`, `proc_listchildpids`, and `ps` therefore expose XPC
parentage, not Tauri ownership. `proc_pidpath` can establish an executable role after a PID is known,
but it cannot associate that helper with this app. PID proximity is invalid because unrelated
WebKit helpers coexist on the host.

The SDK-exposed `libproc` header labels its own process-inspection interfaces private and subject to
change. Those interfaces and the resource headers expose PID enumeration, BSD parentage, paths,
RSS, and resource-usage records, but no application resource-coalition or responsible-application
identifier. ScreenCaptureKit identifies the owning application of a window, not the WebKit helper
processes backing it.

### Why launchctl evidence cannot be release authority

The invalid feasibility inspection found useful diagnostic correlation:

- `launchctl print pid/<app-pid>` displayed UUID-suffixed GPU, Networking, and WebContent services;
- each likely helper display contained the same application resource-coalition name and bundle ID;
  and
- executable paths matched the three WebKit roles.

That cannot satisfy the contract. The `launchctl(1)` manual states that `print` output is not an API
and that callers must not rely on its structure **or information** for any reason. Pinning the OS
build and failing on parse drift does not make undocumented membership semantics authoritative.
`launchctl procinfo` is unavailable without root and is not an approved release-host dependency.

Consequently no supported, non-root resolver can currently prove that the sampler includes every
and only app-owned helper. Implementing a parser would silently redefine the RSS authority, which
issue #88 explicitly prohibits.

## Required owner decision

The Milestone 2 performance-contract owner must choose and document exact paint and membership
authorities before a measurement child can be authored. The smallest bounded choices are:

1. authorize a non-production dispatch boundary that leaves the canvas visible, change the UI so
   the production control and canvas can remain visible together, or explicitly revise the visible
   first-paint contract; and
2. explicitly approve launchd PID-domain/resource-coalition diagnostic receipts as the pinned
   macOS 26.5.1 membership authority, including their unsupported-status risk and fail-closed
   version/role rules, or provide a supported, authorized mechanism with any required privilege or
   entitlement and define
   how it identifies the app, GPU, Networking, WebContent, and later-created helpers.

The owning change must operationally define both “first fully painted” and “application process
tree” in the performance section. It must name the dispatch and resolver boundaries, version/host
scope, dynamic-helper handling, and whether post-dispatch scrolling is part of the operation. It
must preserve aggregate/per-process RSS, settled baselines, maximum sampled delta, and the 20 ms
cadence. It must not change hardware, workloads, or numeric budgets without a separate measured
decision.

## Provisional command lifecycle after both owner approvals

If the owner supplies acceptable dispatch and membership boundaries, one precompiled command can
own the measurement:

1. verify host, OS, candidate hash, capture permission, and one fresh app;
2. configure fixture controls and the owner-approved visible dispatch boundary;
3. resolve the owner-approved PID set and start the settled RSS baseline;
4. start a 512-by-256 canvas-cropped `SCStream` and obtain a complete baseline frame;
5. activate the candidate, confirm it is frontmost, record Mach dispatch time, and press preview;
6. make no Accessibility query while waiting for the first qualifying WindowServer frame;
7. take exactly one final structured Accessibility receipt and use its completion time as the
   wall-clock/RSS endpoint; and
8. revalidate membership, stop the stream and sampler, then emit one valid receipt or one
   fail-closed invalid reason.

The command-line observer must have no windows, watch for foreground changes, and invalidate if the
candidate deactivates before the final receipt.

## Perturbation and foreground risks

- ScreenCaptureKit and Screen Recording permission are measurement inputs. Permission must be
  granted before warm-up so no prompt occurs during a run.
- Capture must be restricted to the visible canvas crop at 512 by 256 BGRA pixels, with no cursor,
  audio, recording, image encoding, or timed disk write.
- Screen capture can add WindowServer/GPU work. Callback lag, observer CPU/RSS, dropped frames, and
  capture scale must be bounded before release use; material perturbation returns to contract
  design.
- The observer must remain a UI-less process and fail on candidate foreground loss.
- Pre-dispatch scrolling alone is insufficient. The unlocked stream observation proved that
  Accessibility dispatch scrolls the offscreen control into view and moves the canvas below the
  window.
- Observer and sampler compilation occur before any release observation. Xcode, Instruments,
  debugger, compiler, or TCC prompt during a run invalidates it.

## Feasibility evidence — invalid/non-release only

Exact receipts are retained in [feasibility-receipt.txt](feasibility-receipt.txt). The original
one-shot probe is [screenshot-feasibility.swift](screenshot-feasibility.swift); the repaired stream
probe is [screen-capture-feasibility.swift](screen-capture-feasibility.swift). All observations are
invalid/non-release evidence:

- Current commit `4125871b8e43418487634b2fd3ed23a90d3f016f` rebuilt the exact clean executable
  recorded by issues 84 and 87: SHA-256
  `333faea6f4403f94836de40b1cdf087c0202c7a42ddf6758bb11473eff5156d2`, 10,000,528 bytes.
- The one-shot screenshot probe found one active, on-screen, layer-zero 1280-by-800 candidate window.
  Accessibility reported the final preview while the visible capture contained no material preview
  palette because the canvas was below the viewport.
- After `AXScrollToVisible`, the screenshot contained 79,952 land-like and 194,205 water-like
  pixels. This proves compositor capture can distinguish visible Canvas content, but it does not
  validate streaming, display-time attachments, callback lag, or timed perturbation.
- The repaired `SCStream` probe compiles with warnings as errors and was run in an unlocked,
  foreground session. It establishes a 512-by-256 cropped baseline, records complete-frame display
  and callback times, hashes row-aware BGRA pixels, retains dirty rectangles, and applies the
  target-calibrated palette tolerance. The run failed closed with no qualifying frame because
  dispatch moved the canvas below the window; the final Accessibility receipt still succeeded.
- Launchd displays correlated the likely helpers, while BSD parentage remained PID 1. Those displays
  are retained only as diagnostic evidence and are not accepted membership authority.

The earlier CoreGraphics initialization failure is preserved; both probes initialize AppKit. No raw
screenshot, transient PID/window/service UUID/coalition number, or local absolute path is committed.

## Stop condition

Do not implement a measurement observer or rerun issue #84 until the performance-contract owner
accepts both follow-up decisions. After that approval, validate the chosen dispatch boundary and
membership resolver together in an unlocked, foreground reference session before authoring the
bounded implementation issue.
