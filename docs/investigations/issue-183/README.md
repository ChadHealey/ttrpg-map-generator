# Issue 183: bay relocation experiment — not recommended

The first nine-row world comparison passes all numeric gates but fails the main
task's visual review. Moving B's bay between its northern lobes changes the
mouth's location, but its long angular cut remains conspicuous. The three newly
rendered large-primary rows also expose the frozen fallback's blunt slot mouth.
The family is **not recommended**; human selection remains pending and production
selection remains false.

The main task inspected all18 native/half images in the
[immutable comparison](comparison-r1/results.json):

| Rows                                  | Main-task visual disposition                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| normal-01                             | Provisional pass, with A-mouth concern                                                    |
| normal-02, normal-03                  | Fail R3: B's long angular cut                                                             |
| normal-04                             | Fail R3: B's angular seam-connected cut                                                   |
| connected-majority                    | Fail R3: B cut and A's slab-like mouth                                                    |
| fragmented-islands                    | Interpretable, with local R3/R5 concerns                                                  |
| default-001, default-004, default-006 | Fail R3: blunt slot on the large primary; near-repeated subordinate outlines also concern |

The [independent review](independent-world-review.md) also rejects the family for
R3 in normal-02, normal-03, connected-majority and default-004. It treats
normal-04, default-001 and default-006 as provisional passes with concerns,
where the main task is more conservative; both complete judgments are retained.
These are
assistant observations against the unchanged
[visual contract](../issue-164/visual-contract.md), not human decisions. Numeric
eligibility does not override visible geometric repetition.

All three permitted material local states are retained in
[local findings](local-findings.md). Each passed45 body/corner certificates and
all134 complete construction/placement inputs; the first two were rejected
locally, and the third was cleared only for a world test. One of the two maximum
world comparisons was used. There is no fourth local state, so a second matrix
cannot justify inventing another geometry recipe under this issue.

The [experiment](experiment.md), [fixed corpus](corpus.mjs),
[final immutable constructor](recipes/recipe-3/templates.mjs),
[manifest](comparison-r1/manifest.json) and [verification record](verification.md)
preserve the actual scope and evidence. The earlier local findings describe the
pre-comparison freeze; this file records its later world outcome without editing
captured sources. Existing control limitations from
[issue-180](../issue-180/findings.md) remain unresolved.

A separate bounded issue should investigate authored curved bay transitions on
A, B and the large-primary fallback while preserving quotas, roles, certificates
and fixed failing inputs. No successor implementation is included here.
