# Issue 183 local findings

Three material combined bay states have been captured. Each passes45 body-size
and anatomy-corner certificates and all134 complete paid construction/placement
inputs. The third changes B's actual bay location and is cleared by the main task
and independent reviewer for the first bounded world comparison, with an angular
V-shaped recess still a concern. No world matrix has been run at this source freeze.

The baseline source is preserved under [recipes/baseline](recipes/baseline/layout-a.mjs),
with [baseline receipts](local-diagnostics/baseline/report.json) and
[A/B/C planar panel](local-diagnostics/baseline/panel.png). The baseline is
historical context, not a new repair state. Panels always show A/B/C from left
to right at the largest ordinary paid body quota, with no detached islands.

## Combined recipe 1

[Source closure](local-diagnostics/recipe-1/sources.json) ·
[45 receipts](local-diagnostics/recipe-1/report.json) ·
[panel](local-diagnostics/recipe-1/panel.png) ·
[134-row readiness](readiness-recipe-1/summary.json)

A mouth endpoints move to `[.63,-.23]`/`[.71,-.015]`; inner anchors become
`[.49,-.16]`, `[.37,.045]`, `[.56,.04]`, witness `[.455,-.045]`.
B keeps its mouth endpoints but replaces inner anchors with `[.39,-.23]`,
`[.285,-.115]`, `[.47,-.105]`, witness `[.34,-.14]` before its unchanged fixed
chart translation. C keeps its mouth endpoints with inner anchors
`[.46,-.275]`, `[.335,-.165]`, `[.48,-.17]` and the original witness.

All45 local receipts pass; all six retained and128 additional inputs certify
and place. The main task and independent reviewer reject the planar state:
the three mouths now share a conspicuous small hooked or chiselled cut. The
numeric pass cannot repair that visual repetition. No world run was spent.

The historical recipe1 wrapper retained182's inherited `frozenCandidateCount`
metadata name for indices0–11, even though183 changes those bay candidates.
It is a descriptor error, not unchanged geometry. Its original source/evidence
are retained; recipe2 uses `revisedBaseCandidateCount:12` and
`frozenFallbackCandidateCount:4` accurately.

## Combined recipe 2

[Source closure](local-diagnostics/recipe-2/sources.json) ·
[45 receipts](local-diagnostics/recipe-2/report.json) ·
[panel](local-diagnostics/recipe-2/panel.png) ·
[134-row readiness](readiness-recipe-2/summary.json)

Recipe1's largest opening upper bounds were A .2569, B .2877 and C .2598 radians;
balanced depth lower bounds were .1510, .1584 and .1666. The second state spends
A/C's available opening margin while leaving B unchanged. A endpoints become
`[.57,-.23]`/`[.74,-.035]`, inner anchors `[.46,-.095]`, `[.37,-.015]`,
`[.56,.005]`, witness `[.42,-.04]`. C endpoints become `[.49,-.34]`/`[.67,-.18]`,
inner anchors `[.415,-.265]`, `[.3,-.18]`, `[.46,-.17]`, witness `[.325,-.185]`.
The lower shoulders move inward along the continuing body coast, shortening
the protruding lower lip; no non-bay role geometry changes.

All45 local receipts and all134 paid construction/placement rows pass. The
planar image shows wider, sharply sloping A/C recesses and the unchanged B hook.
The constructor agent and independent reviewer still see related compact notch
shapes. The main task also rejected this repeated angular/hook pattern and authorized
the third and final combined state. No matrix was spent on recipe2.

## Combined recipe 3: final local state

[Source closure](local-diagnostics/recipe-3/sources.json) ·
[45 receipts](local-diagnostics/recipe-3/report.json) ·
[panel](local-diagnostics/recipe-3/panel.png) ·
[134-row readiness](readiness-recipe-3/summary.json)

A and C are restored exactly to frozen179r2. B's former eastern bay is filled by
changing its old inner anchors to `[.53,-.26]`, `[.57,-.22]`, `[.61,-.17]` before
periodic sampling. Its old mouth shoulders remain fixed. The new bay is authored
strictly in the exposed B gap between L2 end30 and L1 start36: coast31
`[.01,.46]`,32 `[-.025,.27]`,33 `[-.12,.14]`,34 `[-.21,.34]`,35 `[-.2,.445]`.
The mouth is31→35, with fixed witness `[-.11,.2]`; the fixed B interior witness
moves to `[0,-.16]` because the bay now occupies northern interior space. These
points are declared before the unchanged chart translation and quota fit.
No feature interval, attachment vertex, root, far cut or collar disk changes.
This explicit five-vertex B coast replacement preserves the sampled adjoining
role vertices exactly; it is not post-fit role reassignment.

All45 body-size/corner cases and all134 paid owner sets pass. The existing six
island anchors remain declared, including the two now adjoining the protected
bay. Actual whole-polygon conflict checks and bounded site ordering select safe
sites; no island was silently inserted into the new bay or deleted. Independent
review checked77 accepted B primaries and314 detached-site receipts: all select
remaining anchor indices2–5. The frozen182 fallback is unchanged in every case.

The main task and independent reviewer see a materially different northern
recess and continuous eastern flank. Its sharp V is still an R3 concern; only
the fixed nine-row world test can determine whether the earlier repeated mouth
pattern remains decisive. The third state is cleared for that bounded test,
not for visual, human, semantic or production acceptance. All three material
local states are now spent; no fourth bay recipe is permitted under this issue.

## Reproduction and limits

```sh
node docs/investigations/issue-183/local-evidence.mjs --verify baseline
node docs/investigations/issue-183/local-evidence.mjs --verify recipe-1
node docs/investigations/issue-183/local-evidence.mjs --verify recipe-2
node docs/investigations/issue-183/local-evidence.mjs --verify recipe-3
node docs/investigations/issue-183/readiness.mjs --verify recipe-1
node docs/investigations/issue-183/readiness.mjs --verify recipe-2
node docs/investigations/issue-183/readiness.mjs --verify recipe-3
corepack pnpm exec vitest run docs/investigations/issue-183/templates.test.mjs docs/investigations/issue-183/gate.test.mjs
```

Each verifier compares captured source to its explicitly pinned historical
recipe modules before executing it. The current runtime may advance without
invalidating earlier immutable recipe sources. Artifacts have exact inventories
and byte hashes; replays do not rewrite them. Local panels are generated by the
captured polygon code, not image-generation tools. Readiness retains a single
compressed full result per input plus exact repeat hashes; no selected output
or omitted failed attempt replaces the original ledger.

Focused tests compare every raw attachment/root/far/disk and interior witness
against179 (with the explicit B interior-witness relocation checked separately),
all four fallback candidates against182, all134 complete owner sets,
three accepted ordinary layouts, fixed nine inputs, and closed gates on missing,
substituted or failed rows. These checks do not establish whole-world visual
quality, semantic water/polar/fragmentation support, extraction, production
behavior, human acceptance or cross-platform equality. Unchanged broad-check
history is documented in [issue-179 verification](../issue-179/verification.md).
