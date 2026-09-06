# Issue 170 — rejected curved-anatomy construction

**No v3 selection. Stop before the full world comparison.** This experiment demonstrates bounded
packing that can place the previous six-equal-cap witness, but its curved anatomy still resembles
tabs. The targeted repair loses one of the three intended layouts and constructs balanced caps
that cannot fit. The [local findings](local-findings.md) preserve both source/image stages and
explain the failure; human visual decisions remain pending.

The [design](design.md) and [experiment](experiment.md) retain all adopted targets and the same
separated spherical envelopes. [Placement](placement.mjs) adds finite guided candidates and
feasible refinement without changing radii, quotas or gaps. The [constructor](templates.mjs)
uses authoritative sampled curves and explicit paid islands, but does not supply a successful
continental candidate. [Verification](verification.md) distinguishes passing implementation tests
from failed candidate requirements.

The immutable [local gate](local-gate-r1/local-gate.json) reports:

- Complete role certification for all owners of all six retained inputs, with exact local repeats.
- `readyForComparison: false` from two preserved failures.
- Balanced minimum required pair distance `1.7735063559025124` radians, exceeding the necessary
  `π/2 = 1.5707963267948966` bound for five or more unit vectors in three dimensions.
- Only layouts `[1,2]` survive, against this experiment's required three actual layouts.
- [Source integrity](local-gate-r1/integrity.json) verified before concluding the local run.

No full-world image matrix was run for this known failed candidate. The before/after PNGs are
local planar diagnostics, with panel identities and different quotas stated in their manifest;
they are neither whole-atlas images nor visual acceptance. Read-only reproduction checks all
retained source/report/image pairs without overwriting them:

```sh
node docs/investigations/issue-170/local-diagnostics/verify.mjs
```

Continue in [issue 171](https://github.com/ChadHealey/ttrpg-map-generator/issues/171): certify
actual opposing coast chains and a declared first disk without prescribing rectangular shoulders.
This changes the investigation's construction restriction, not the adopted root-width requirement.
It must preserve single attachment, exact role accounting, protected water and all angular bounds.
The cap failures also motivate compact, explicitly paid margin sites rather than distant fixed
island centers. Production C1–C3, selection, human visual approval and cross-platform proof remain
separate gates. All continuation commits remain local; no Git push is authorized.
