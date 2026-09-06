# Issue 170 — rejected local construction

**Decision: reject this candidate before a full world comparison.** The frozen constructor passes
local polygon certificates on all six retained inputs, but it fails the intended macro variation
and packing readiness gates. Assistant inspection also rejects the persistent jigsaw/tab shapes.
No production generator, human visual approval, sampled world result, or acceptable v3 is claimed.

## Evidence and provenance

The [manifest](local-diagnostics/manifest.json) records fixed inputs, source/dependency hashes,
exact local repeats, panel identities and image/report hashes. The
[read-only verifier](local-diagnostics/verify.mjs) reconstructs local polygons and planar images
from both retained source snapshots and compares their bytes, receipts, dependency hashes and
manifest without writing retained artifacts. Run it with
`node docs/investigations/issue-170/local-diagnostics/verify.mjs`. The
[historical writer](local-diagnostics/generate.mjs) is retained unchanged for provenance only;
it overwrites evidence and is not the verification command.
The same six unchanged issue-165 inputs are retained in [inputs.json](local-diagnostics/inputs.json).

The [before-repair source](local-diagnostics/before-repair-source.mjs.txt) and
[before-repair report](local-diagnostics/before-repair.json) retain the initial passing local
construction. Its [planar image](local-diagnostics/before-repair.png) shows the three observed
layouts in fixed local chart coordinates, each identified in the manifest. These are polygons,
not a placed world. Different panel quotas are explicit; panels are not a controlled area comparison.

The [after-repair source](local-diagnostics/after-repair-source.mjs.txt) matches the frozen
[constructor](templates.mjs). Its [report](local-diagnostics/after-repair.json) and
[planar image](local-diagnostics/after-repair.png) retain the rejected targeted repair.
The [draft diagnostic](local-diagnostics/repair-draft.json) preserves an earlier source text/hash
with the same final geometric recipe before formatting. Two exploratory local images are also
retained and hashed; the intermediate exploratory image has no exact corresponding source
snapshot and is not treated as reproducible acceptance evidence. The explicit paired source/report
stages above own the reproducible local evidence.

## Initial construction and targeted repair

The initial sampled cubic coast recipe used three layouts, shared exact roots, straight collars,
a radial curved bay and the body partition `.645/.183/.119/.053`. It passed local certificates,
retained three accepted default layouts and included real socket-angle and lobe-area variation.
Nevertheless, local assistant inspection found flat lobe caps, deep shoulder recesses, club-shaped
peninsula heads and a repeated jigsaw/tab outline. Passing certificates did not establish a
credible continent silhouette.

The single targeted local repair kept the same support policy, quotas and unchanged issue-169
certificate predicates. It narrowed lobe roots, changed crown curvature and peninsula tip controls,
moved the bay inward, softened the surrounding B approaches and broadened the lower B coast.
The final candidate body partition is `.727/.135/.085/.053`: lobe sum `.22`, ratio `27/17`,
and all role shares remain above the adopted minimums. The exact finite layouts and four peninsula
options are in the frozen constructor; each owner tries at most 12 candidates. Layout 1 assigns
the larger lobe to the left root, and layout 2 turns its peninsula socket by `.55` rad. Subordinate
bodies use sampled asymmetric curves. Independent island/archipelago owner-area reservations are
`.02 × abundance/100` and `.01 × abundance/100`; counts, zero-category removal and total quotas
remain intact. All surviving components are accounted before normalization.

This repair illustrates an unresolved geometric tradeoff. Narrower roots and altered B geometry
changed the raw area and required normalization scale. The resulting guard caps grew, and fallback
removed one of the intended structural layouts. The local image still shows recognizable tabs;
it does not warrant spending a full world comparison on this recipe.

## Explicit acceptance failures

| Obligation                                                                                        | Retained result                                                                       | Disposition                 |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------- |
| Six retained inputs pass local complete-role certificates                                         | All six constructors return all owners with passing certificates and unchanged quotas | Local gate passes only      |
| At least three accepted structural layouts among ordinary rows                                    | Only layouts `1` and `2` survive; layout `0` is absent                                | **FAIL**                    |
| Six balanced owners can fit separated guard caps                                                  | Every guard radius is `0.8617531779512562` rad                                        | **FAIL**                    |
| Credible continent anatomy in local inspection                                                    | Persistent jigsaw/tab forms and repeated silhouette relationships                     | **Assistant rejection**     |
| World placement, sampled coverage, seam/pole aliases, nested anchors and native/half world images | No full world comparison was performed                                                | Not established             |
| Human visual acceptance and production selection                                                  | Neither obtained nor inferred                                                         | Pending; candidate rejected |

For six equal caps, a pair of centers must have separation at most `π/2`, so the unchanged
`.05`-rad guard gap requires `r ≤ (π/2 − .05)/2 = .7603981633974483`. The retained balanced
radius exceeds this ceiling. This necessary bound rejects this particular equal-cap configuration;
it does not prove the general adopted feature targets or the polygon construction policy impossible.
The normal-01 primary guards are both `1.1614826212604645` rad, while its subordinate guards are
about `.58524` and `.58848` rad. These are certificate measurements, not claims of placed worlds.

A separate bounded read-only x-recentering calculation reduced the balanced radius only to about
`.83925` rad. It remained above the same ceiling; recentering was not added to the frozen constructor.
Detached islands and the peninsula are major contributors to its envelope radius. A successor would
need a deliberate change to the relationship between the broad interior, exterior roles and nearby
island sites, with a new bounded design and local proof. This experiment does not authorize another
repair loop or weaken any target.

## Verification boundary

Focused Vitest verifies deterministic construction, unchanged quotas and categories, geometric
certificates, bounded candidate/component counts, actual surviving angle/area variation, and the
**observed readiness failures**. The two failed acceptance obligations are asserted as explicit
rejection evidence, retaining the required three-layout and cap thresholds. A passing diagnostic
test suite therefore does not mark this candidate ready. Formatting and ESLint are checked separately;
the main verification record owns broader repository checks and independent review.
