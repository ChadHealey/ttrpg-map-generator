# State 2 — harness repair, identical field parameters

State 1 is spent and immutable. Its source snapshot, manifest, input list and initial claim are
retained in `state-1/`; exact hashes are recorded in `aborted-state-1.json`. No row completed and
no images were retained. The recorded exception was preview `tickHash` calling the full-only
`compactValues()` method. The first calibration and preview sampling passes had executed; the
261124 inferred evaluations follow from the call path, not a saved observed counter. The entire
75836012-evaluation initial reservation remains spent. No repeat phase was claimed for state 1.

The preflight seam test had also failed because a parser was given noncanonical +pi ticks.
A shell sequence incorrectly continued to recording after that test failure. This is an execution
mistake, not a negative finding about the field. State 1 cannot satisfy the complete-row or repeat
acceptance criteria and will not be described as doing so. There is no visual diagnosis for an
unrendered state. No numerical tuning or seed change follows from these harness defects.

The complete [state-2.json](state-2.json) parameter table is byte-for-byte equivalent in numeric
content to state 1; only its state name differs. Every term, interval, seed scope, draw limit,
quota, corpus input, calibration step, sampling profile and phase budget follows
[the original design](design.md). State 2 is the final state. No third state or retry is permitted.

The repair uses `valueAt` for profile-neutral tick hashing, canonical angle construction for the
seam alias check, and distinct `full` workload / `fullProfile` metric keys. The latter separation
was already in the original recorded source. Tests cover both fixed defects before recording.
All focused checks must succeed before the second `--record` command is invoked separately.
The read-only verifier checks the immutable aborted-state hashes as well as state 2's complete
source closure, initial/repeat reports, image hashes, phase claims, artifact inventory and counts.
The pinned `authority.json` refers only to state 2; it is an assistant-generated integrity pin,
not independent reviewer approval.

Assistant pre-execution design/source review of state 2: the parameter table has no numeric
changes; quota and guard ownership are unchanged. Hashing reads stored ticks and introduces no
field calls. Canonical seam construction uses the public wrapping constructor. The two phase
reservations remain exclusive, exact repeats retain every row, and verification loads no
field/evaluator module. The implementation tests and final dedicated review remain distinct.
No maintainer visual acceptance is inferred. The unavoidable deviation is incomplete state 1
receipts/images, retained truthfully instead of replaced.
