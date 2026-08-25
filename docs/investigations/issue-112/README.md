# Issue 112 Computer Use latency diagnosis

This record owns the bounded, non-product diagnosis requested by issue #112. It
starts from `05739af` and changes no production, controller, observer, fixture,
workload, timeout, schema, release-protocol, or downstream-cancellation authority.

## Scope and privacy boundary

Before repository or GitHub access, Computer Use was initialized and a read-only
application inventory returned. No task-visible permission prompt appeared. The
inventory reported the TTRPG Map Generator as not running.

After a later explicit user override, one read-only, permission-only inspection of
the TTRPG Map Generator was allowed solely so the user could establish app-specific
Computer Use permission. It returned in the `1-to-under-5s` bucket without a
task-visible prompt. It transparently launched a zero-operation target process; the
process was terminated and a follow-up process check found zero target processes.
This narrow user-authorized exception is not #112 product, target-preflight, #95, or
#104 evidence. No mouse, keyboard, paste, drag, scroll, focus, controller marker,
fixture, sampler, artifact, dispatch, measurement, or product operation occurred.

This record publishes no pixels, accessibility text, usernames, local paths,
process/service identifiers, credentials, raw logs, marker values, or private
diagnostics. No compatible repository-local Codex/Computer Use diagnostic artifact
was available or used.

## Bounded non-product matrix

Each matrix call had an explicit task-side bound. The matrix stopped at its first
timeout; no timed-out call was retried and no successful call was repeated.

| Call                    | Completion class | Elapsed bucket    | Session / application disposition                                           |
| ----------------------- | ---------------- | ----------------- | --------------------------------------------------------------------------- |
| `list_apps`             | returned         | under 1 s         | desktop session available; no authentication or lock boundary observed      |
| `get_app_state(Finder)` | returned         | under 1 s         | read-only state returned; raw accessibility and screenshot content withheld |
| `get_app_state(Dock)`   | server timeout   | 5 s bound reached | non-product read did not return; matrix stopped                             |

The successful inventory and Finder read distinguish task capability and desktop
availability from the later Dock failure. The timeout shows that the service is not
reliably responsive at the required bounded point; it does not establish anything
about the product, latch, candidate, or a focus transition.

## Decision

**Chosen successor route: route 2 — Computer Use is not viable for the M2
focus-handoff action.** A further candidate-specific Computer Use attempt is not
justified. The sole successor mechanism is one separately authorized real-owner
click, supervised by the existing fail-closed issue #110 durable latch. Do not add a
native focus action or any second fallback mechanism to this successor.

Issue #104 remains blocked and **UNCONSUMED**. This diagnosis consumes no target
preflight and supplies no release, cancellation, performance, or product conclusion.

## Successor issue draft

**Title:** `M2: perform one owner click through the durable focus-handoff latch`

**Observable outcome.** From a clean, committed, exact-candidate boundary, the
unchanged issue #110 controller publishes its validated marker and accepts exactly
one real owner click on the packaged target window or Dock icon inside the declared
handoff. The controller must independently confirm the existing exact-candidate
focus predicates, then clean its marker and terminate the candidate. This is a
zero-operation readiness result only; it does not consume #104 or begin #95.

**Authority.** A new issue and explicit owner authorization are required before any
candidate launch. The owner, not Codex Computer Use, performs the one click after
the marker is directly validated. Codex performs no GUI input and no target
inspection.

**Action and timeout budget.** One candidate launch; one declared real-owner click;
zero synthetic inputs; zero retries; the existing 120,000-ms handoff and 50-ms
controller poll interval. Timeout, ambiguity, wrong-app focus, marker failure,
identity drift, replacement, unsupported frame/raise, or observer disagreement
invalidates the preflight and stops all follow-on work.

**Privacy boundary.** Retain only sanitized state transitions and booleans. Do not
publish screen pixels, accessibility text, marker paths/tokens, local paths,
usernames, process/service identifiers, credentials, or raw diagnostics.

**Verification.** Before launch, verify the clean committed boundary, exact approved
identities, zero target processes, existing controller/latch tests, and complete
zero-operation receipt. Afterwards verify marker cleanup, zero target processes,
zero product/fixture/sampler/artifact/dispatch/measurement/#95/#104 operations,
public-privacy, authorized-surface, fixture/production-surface, protected-evidence,
and `git diff --check` gates.

**Split trigger and current execution profile.** Split immediately if a second
focus mechanism, any Computer Use target read or mutation, a settings or credential
change, private diagnostics, controller/product change, or a second candidate
attempt is proposed. Current execution profile: `gpt-5.6-terra` / high; C3,
hardware and operator-availability risk; discovery-to-one-shot coordination only.
