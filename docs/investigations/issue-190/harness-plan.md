# Proposed budgeted harness wiring for issue 190

Read-only planning only. No repository edit, candidate import, sampler call or geometry
execution accompanied this document. This plan follows the exact draft budget: two states
maximum; per authorized state, 60 initial cases + 60 exact-repeat cases + 60 computational-replay
cases, for at most 360 full body-certificate calls. Calls to the public private-wrapper entry
count once; its internal delegation is part of that one body certification.

## Distinguish computation from read-only verification

Do not copy the old 187/188 command behavior unchanged. Its `reconstruct` evaluates twice each
time, so using it from record, verify, predecessor verification and tests would exceed 190's
budget. The new interface must separate:

- `--record state-1|state-2`: exactly one initial 60-case evaluation and one 60-case repeat.
- `--replay state-1|state-2`: the single authorized computational replay, exactly 60 cases.
- `--verify state-1|state-2`: read-only source/provenance/result-ledger checks; ZERO constructor,
  sampler, body-certificate or useful geometry calls.

The replay command necessarily writes a one-shot budget claim and its completion receipt. It
must not be described as a read-only command. The repeat and replay each reconstruct the same
two panel images without generating additional material geometry or selecting a subset.

## Exclusive phase ledger

Reserve each phase before its first useful call with an exclusive immutable claim naming the
state, phase, 60 input slots, exact input hash and complete source-manifest hash.
The main task's first-state prospective-manifest approval is external operator authority; its
exact approved manifest hash binds every phase. For state 2, that manifest also binds the
explicit second-state authorization record and predecessor hashes. No separate first-state
approval object or generic authorization framework is introduced. Use exclusive state-directory creation for the record and exclusive phase-claim creation
for repeat/replay. Existing claims reject before runtime loading. A failed or interrupted phase
is not silently eligible for another attempt. Reserving a phase spends its allowance even when
an exception prevents some of its possible body calls; unused slots cannot fund a different
candidate. Report reserved slots separately from observed constructor and certificate call counts.

The runtime evaluator increments its bounded constructor-call count immediately before each
fixed input and its body-certificate-call count immediately before the single 188 entry call.
A constructor error retains that case and does not call certification. A completed phase has
60 input outcomes, at most 60 constructor calls and at most 60 body calls. No retry is inside
the evaluator. Its complete case list and original quotas must match the frozen corpus exactly.

Every phase has an immutable result receipt with observed counts, all failure records and
result/image hashes. Save the full initial report/summary and native/half PNGs. The repeat and
replay can retain full compressed result archives, including their report/summary and image
bytes, plus exact equality receipts. This preserves a divergent repeat/replay for diagnosis
without changing or replacing the initial image files. The archive inventory must be declared
before capture; do not add an ad hoc extra phase to diagnose a mismatch. A mismatch or source
change stops the state with the consumed phase counts and preserved evidence.

## Source authority before computation

A static AST source collector captures the selected state's literal entry, shared schema,
corpus, evaluator, renderer, private fit helper, frozen 188/172/178 dependency closure, runner,
source-loader and verifier, package/lock/tool versions, literal design and independent reviews.
Write source text, complete manifest, input corpus and the initial claim before runtime import.
All captured files must be formatter-idempotent before root's prospective-manifest check.

Computational replay first performs the same trusted-current-source and exact-artifact checks
as `--verify`, then exclusively claims its one remaining phase, loads the matching in-memory
source closure and calls the evaluator ONCE. Never load retained source merely because its own
manifest hashes match. Never call the two-pass record function from replay.

The finite harness does not require an interval arithmetic engine or a general proof of all
retained coordinates. It verifies exact source authority and the evidence from the explicitly
counted computation. Its binary64 and platform limitations remain truthful.

## Second state without recomputing the predecessor

The first shared runner must already support the exact two-state path/schema boundary. State 2
requires immutable first-state source/input/initial/repeat/replay receipts and artifacts, a
copied first disposition, complete second literal specification, independent design/source
review and root authorization. Bind their exact bytes in the second manifest. Use the ZERO-call
predecessor verifier to check the completed first replay receipt and all hashes; never replay
state 1 again when recording or replaying state 2.

State 1 keeps its own selected-source closure unchanged. New state-2 declarations and its
literal file are separate paths; they do not require editing state-1 source or captured shared
runtime. No second state is authorized automatically by failure. Malformed/missing prerequisite
records reject before any useful state-2 import.

## Tests and independent review

All automated final tests and the broad combined suite use only:

- fixed input-schema validation and corpus ordering, without calling a useful constructor;
- source AST/text and frozen literal-index declarations;
- retained reports, quotas, source and artifact hashes, phase counts and equality receipts;
- malformed source/prerequisite/path/inventory records supplied to pure/read-only validators;
- stored PNG decoding to check dimensions and exact half-pixel correspondence.

They do NOT call the useful constructor, re-certify retained candidates, invoke sampling or
recreate a panel. Assertions comparing actual geometric behavior are backed by the one initial,
one repeat and one authorized computational replay, not hidden additional test evaluations.
Tampered-summary tests compare against the independently retained phase receipts/digests and
observed report counts. Fully coherent tampering of every retained result digest is not defeated
by hashes alone; the source-bound computational replay receipt and its explicitly reviewed
pinned digest are the reference, with this trust boundary stated honestly. A pure verifier
must not claim it has recomputed geometry when it has not.

One designated agent performs the computational replay and reports its exact receipt digest to
the root and independent reviewer. The independent reviewer may inspect source, receipts and
both actual PNGs, run the zero-call verifier and run pure tests; it must not spend a fourth
60-case phase. The source/proof review verifies this separation before any first execution.

## Proposed exact authority and inventory choices

Per-state fixed inventory is source-manifest.json, sources.json.gz, inputs.json,
initial-claim.json, reports.json.gz, summary.json, panel.png, panel-half.png,
initial-receipt.json, repeat-claim.json, repeat-result.json.gz, repeat-receipt.json,
replay-claim.json, replay-result.json.gz and replay-receipt.json. A not-yet-executed phase's
files are absent; validators distinguish incomplete status from completed success, without
loading geometry to fill gaps.

After the authorized computational replay, the main task pins its exact manifest and all phase
receipt/artifact digests in an uncaptured, separately reviewed verification-authority.json.
That current trusted authority is not accepted from the evidence directory itself. It is
created after the replay to avoid a circular source hash and must be frozen once reviewed.
Final `--verify` requires this authority and compares every receipt and result against it.
Before that authority exists, the computational replay performs its own trusted-source and
artifact checks, then compares actual recomputed results; it does not pretend the evidence's
self-hashes alone prove the outcomes. A distinct inspection status can report an incomplete
capture, but cannot report full verified success.

Abandoned/interrupted phase reservations count as spent. Final records distinguish observed
body calls from reserved maximum slots. These choices support the proposed 360-call maximum
without sacrificing immutable failure evidence or pretending every read-only audit performs
fresh computation.

## Concrete implementation paths

The separately reviewed post-replay authority for a state is `authority/state-1.json` or
`authority/state-2.json`, outside that state's evidence directory. These are the concrete
per-state names for the proposed verification-authority record. They avoid changing the first
state's authority when a second completes. Each pins the exact manifest and all 15 completed
phase artifacts. `authorityDraft` returns a proposal using zero useful calls; final `--verify`
requires the independently reviewed current authority file and never generates it itself.

The first runner already reads the complete second-state design/review/authorization path set.
Its predecessor check uses only the first state's pinned authority and zero-call verifier.
The fit helper lives in evaluate.mjs and sums surviving B/role areas before its single scale.
Pure tests import only schema, corpus, encoding, source capture and declaration validators;
they do not import the literal entry, evaluator, renderer or certificate. Source-level budget
tests inspect AST call sites instead of consuming another useful phase.
