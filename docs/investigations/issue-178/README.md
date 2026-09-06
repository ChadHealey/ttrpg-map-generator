# Issue 178 — a farther separating cut for peninsula width

**Disposition: reviewed private certificate and useful local taper; no world selection.**

This investigation implements a tighter upper-width witness for the existing collar. The adopted
width is an infimum of separating crosscut lengths, while the prior sufficient certificate uses
only the declared root as an upper witness. A valid far crosscut may provide a shorter witness
without changing any adopted target. The lower bound, topology, whole first disk, role area and
extent measured from the original root remain independent obligations.

The [design](design.md) and [independent design review](independent-design-review.md) supplied the
checkpoint before the [private implementation](implementation-notes.md). The
[independent implementation review](independent-implementation-review.md) clears the code and
local evidence, with scope and commands in [verification](verification.md). Production, accepted v1/v2, earlier certificates and
rejected visual evidence stay unchanged. A valid local tapered feature is not a complete owner,
accepted world or human visual decision.

The predecessor [issue 177](../issue-177/README.md) passes its numeric gates but remains visually
rejected. The purpose here is to remove a proved unnecessary sufficient restriction, not to
weaken the targets or reinterpret a failure as success. All commits remain local; no push.

## Local primary evidence

The [three fixed attempts](primary-evidence/report.json) preserve the initial lobe-ratio/width
failures, the smaller-lobe disk failure, and the final corrected disk declaration. The final bare
primary passes every role, bay, interior, area and guard check at three retained body sizes under
the explicit new mode. The old root-only mode still rejects its peninsula upper width and ratio.
The complete paid-owner construction, detached islands and world placement are not tested here.

The original owner quotas are `.13106846473029043`, `.10494186046511626` and
`.06666666666666667`. The first two reserve the ordinary detached fraction `.0095`; the third
uses the connected-majority control's actual `.016`, yielding body quotas
`.12982331431535268`, `.10394491279069766` and `.0656`. Independent review caught an early writer
using `.0095` for that third illustrative size. It was corrected before authoritative evidence
capture; the saved source, all nine receipts and three images use the explicit correct fractions.

The final largest primary has surviving interior share `.709632`, lobe shares `.135805` and
`.081501` (ratio about 1.666), and peninsula share `.073062`. Its far-cut width upper is about
`.144295` rad, extent upper `.408836` rad and conservative extent/width ratio `2.21024`.
The three bare guard radii are about `1.026203`, `.916044` and `.729712` rad.

The main task inspected all three local images. The [final image](primary-evidence/final.png)
replaces the detached-looking peninsula head with a broad-root taper. Its pointed peak, deep
adjacent recess and familiar bay still need actual coast design and world-scale review. This is
useful numeric proof for a new constructor, not a visual selection. The changed disk witness
between the last two attempts does not change their visible outline.

The [read-only reproduction](primary-check.mjs) verifies current source closure, exact receipt
and PNG equality, and local repeat of the new certificate. Its write mode refuses an existing
evidence directory. Runtime sources are checked again after evaluation.

```sh
node docs/investigations/issue-178/primary-check.mjs --verify
```
