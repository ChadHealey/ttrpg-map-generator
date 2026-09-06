# Issue 188 — whole-body bay adjacency

This private implementation permits a protected bay's connected coast to traverse already
certified interior, lobe and peninsula exteriors. The [reviewed contract](design.md) preserves
every adopted issue 167 target. It removes a B-only representational restriction; it does not
claim an attractive primary, family selection or human acceptance.

The new explicit `bayCoastMode: 'whole-body'` is restricted to wedge-geodesic mouths. Existing
modes delegate to frozen issue 178 unchanged. All positive-role checks retain the original
primary flag, and no failed new-mode result falls back to a historical mode.

The two literal component fixtures are intentionally subordinate (`primary: false`). Both pass their complete applicable subordinate certificates in the
[single immutable capture](evidence/components/summary.json), following independent source review
and main-task source-freeze clearance. No world, template family, island search or production work
is in scope. See the [harness plan](harness-plan.md).

The author and main task inspected both actual panel sizes. These are angular component diagrams,
not an acceptable primary family. See the [disposition](disposition.md),
[verification](verification.md), [independent result review](independent-result-review.md),
[native panel](evidence/components/panel.png) and
[half panel](evidence/components/panel-half.png). No captured geometry was adjusted.

Read-only trusted replay:

```sh
node docs/investigations/issue-188/run.mjs --verify components
```
