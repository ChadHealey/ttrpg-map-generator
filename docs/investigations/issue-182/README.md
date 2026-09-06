# Issue 182 — Bounded large-primary recovery

**The private 128-default corpus now passes construction and placement in all 128 cases.** One
authored large-primary recipe recovers the 38 previously exhausted cases at appended candidate 12. The 90 previous successes retain exact geometry, construction receipts and placement.
This is a private recovery probe, not the required production preview sweep or a whole-world
visual acceptance claim. Parent [#161](https://github.com/ChadHealey/ttrpg-map-generator/issues/161)
and the [issue-179 visual rejection](../issue-179/visual-review-r2.md) remain separate.

## Hypothesis and bounded repair

The authoritative [issue-180 audit](../issue-180/evidence-final/summary.json) exposed an ordinary
one-primary branch with owner quota `0.17451657458563533`. Its paid body fraction at the unchanged
default detached share `0.0095` is `0.1728586671270718`, or approximately `2.172206075022929`
steradians. All twelve frozen candidates failed, principally at absolute peninsula extent/width
and bay opening maxima. Scaling the smaller coasts unchanged is insufficient.

[layout-large.mjs](layout-large.mjs) authors one local repair of the horizontal B coast before
quota fitting. Its peninsula retains the raw root from `[-0.3,-0.4]` to `[0.3,-0.4]`, while the
distal tip moves from `[-0.045,-0.72]` to `[-0.04,-0.66]`. The far crosscut becomes
`[-0.062,-0.595]` to `[0.021,-0.595]`, and the fixed first-disk witness becomes `[0,-0.475]`.
The broad root pays sufficient area without a terminal head; the narrower valid far cut supplies
the already accepted private upper-width witness. Extent still measures from the original root.

The oblique bay shoulders move to `[0.505,-0.273]` and `[0.625,-0.137]`; its asymmetric interior
and witness remain. This reduces opening span while preserving the removed-area/depth floors.
The periodic sampled coast, fixed role intervals, regional anatomy variation and fixed chart
translation remain explicit. All these coordinates precede the existing translation and paid
uniform fit; no post-fit role selection or geometric search occurs.

Only **one of the allowed three material recipes** was authored. It passed the first local
certificate check, so no failed repair recipe exists to conceal. The pre-repair failures remain
in issue-180, and all original failed candidate receipts remain in every recovered result.
The source, five actual-quota center/corner receipts and image are retained in the immutable
[recipe-1 stage](local-diagnostics/recipe-1/manifest.json).

## Extension contract and finite work

[templates.mjs](templates.mjs) delegates candidate indices 0–11 directly to frozen
[issue-179 templates-r2](../issue-179/templates-r2.mjs). Every prior successful candidate keeps
priority. Indices 12–15 use the one large-primary recipe and four predeclared paid-island site
variants, for a total limit of 16. Invalid fallback indices and nonprimary fallback requests
reject; the extension does not reinterpret a subordinate as a primary.

The original `revision: issue-179-tapered-r2` remains with its original output. A separate
`extension` object declares revision `issue-182-large-primary-r1`, frozen count 12, fallback count
4 and total limit 16. The fallback uses explicit private streams
`issue-182-r1/fallback-anatomy/{ownerId}` and
`issue-182-r1/fallback-island-sites/{ownerId}/{kind}-{memberIndex}/variant-{variation}`.
Legacy calls retain their exact old streams. These private strings are not a production scope
proposal; [issue-181](../issue-181/production-contract.md) keeps that contract distinct.

Quota allocation, primary classification, all control recipes, polar transform, paid detached
shares, island shape library and the six-site/four-offset search are unchanged. Maximums remain
11 detached members, 24 site attempts per member, 256 unique owner vertices and the frozen
placement budget: 64 attempts, 128 directions per owner and 64 refinement sweeps. The frozen
[issue-178 certificate](../issue-178/certificates.mjs) and
[issue-170 placement](../issue-170/placement.mjs) are imported unchanged. No new chart limit,
target relaxation, water carving or favorable quota redistribution is introduced.

## Local measured outcome

The five local cases are center and the four declared anatomy corners, all at the actual large
paid body quota. They all pass the complete primary certificate with no detached members in
this body-only stage; the subsequent full owner receipts separately include their paid islands.

| Conservative measure               | Minimum–maximum across five cases                 |
| ---------------------------------- | ------------------------------------------------- |
| Peninsula body share               | 0.05914440–0.06170924                             |
| Peninsula width lower / upper      | 0.08878591–0.09141594 / 0.12934914–0.13149081 rad |
| Peninsula extent upper             | 0.40519009–0.41189891 rad                         |
| Peninsula extent/width ratio lower | 2.13594253–2.18471582                             |
| First-disk radius lower            | 0.08022823–0.08260476 rad                         |
| Bay opening upper                  | 0.28265522–0.28733521 rad                         |
| Bay removed-body share lower       | 0.03458614–0.03608599                             |

Both author and independent root inspection of [the center panel](local-diagnostics/recipe-1/panel.png)
found a broad integrated short taper without a pinched terminal head. The pointed lower tip and
conspicuous compact angled bite remain concerns. The [paid owner panel](local-diagnostics/paid-owner.png)
shows the first declared recovered owner with its detached members in its local chart. These
are local silhouette observations, not a world arrangement, human review or resolution of R3.

## Fixed recovery result

The manifest was written after runtime freeze and before executing the exact first 128
additional-default inputs from [issue-180's corpus](../issue-180/corpus.mjs). The runner imports
the final independent checker [audit-final.mjs](../issue-180/audit-final.mjs), which re-certifies
each checked owner's exact declared quota. The initial audit's floating-point reassociation
defect remains preserved in its earlier evidence; it is not copied into this recovery claim.

Each probe runs twice independently, including construction, certification checks and placement;
the complete results must match before writing a compressed receipt. Read-only verification
repeats all 256 calls and compares full artifacts and source hashes.

- 128/128 construction-and-placement passes; no terminal construction/placement failures.
- All 38 prior failures recover at candidate 12; candidates 13–15 are never selected in this
  corpus. Their deterministic/payment behavior is covered by focused tests.
- All 90 prior successes match exactly apart from extension metadata, including placement.
- Every old candidate receipt and every previously accepted owner remains exact even in the
  38 repaired cases. The six retained issue-179 construction results also match exactly apart
  from extension metadata.
- Largest selected owner guard: `1.2465383684777747` rad. Minimum final pair gap:
  `0.05041278447034725` rad, exceeding the unchanged nominal 0.05 plus numeric slack.

See [manifest](evidence/manifest.json), [summary](evidence/summary.json),
[completion](evidence/completion.json), [baseline comparison](compare-baseline.mjs) and
[verification](verification.md). Individual full receipts are named `default-NNN.json.gz` in
the evidence directory; failures from exhausted placement attempts remain visible even where
the final bounded placement succeeds.

## Limits and disposition

No field samples, world images, production entry, accepted records, old evidence or dependencies
change. No ocean/polar/control-domain obstruction is resolved by these 128 ordinary inputs.
In particular, the known count-one/45%-water cap obstruction remains a tested explicit failure
at the full sixteen-candidate budget. The private binary64 certificate remains diagnostic,
not formal interval or macOS/Linux production proof. Issue-179's full-family visual failure is
not erased by this repair. Any subsequent world comparison or geometry change requires its own
bounded issue; this recovery hypothesis is complete without spending a new world matrix.

The [independent review](independent-review.md) is complete. The next bounded visual work is
[issue 183](https://github.com/ChadHealey/ttrpg-map-generator/issues/183), which retains the original
six rows and adds three named recovered defaults. This issue's local and recovery evidence stays
unchanged. No push.
