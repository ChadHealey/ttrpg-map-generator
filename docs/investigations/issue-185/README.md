# Issue 185 — proposed v3 transient seed registry

The released closed `MapEntitySeedInput`, derivation v1 and stream v1 can express the required
transient-owner and detached-member concerns without fabricated accepted identities. The
[single proposed registry](registry.md) uses the actual map/world-surface entity and finite derived
aspect names under `worldTerrain.macroElevation.v3`.

This resolves the specification question in [issue 181 D2](../issue-181/child-plan.md#d2--specify-production-deterministic-owner-and-subfeature-scopes),
with [independent contract review](independent-review.md) complete and no remaining
actionable findings. It is private executable evidence, not production
adoption. Current production compatibility, geometry, classifiers and old seed fixtures remain
unchanged. No world image has been rendered.

The fixed evidence covers counts 1, 4 and 8, both evaluation orders, independently absent/present
isolated and archipelago members, and macro variant revisions 0 and 1: 48 matrix rows and 6,052
canonical vectors. The full finite namespace contains 3,026 distinct names. Source text, package
metadata, lockfile and runtime/transpiler/formatter versions are bound to the evidence.

- [Exact registry, draw inventory and remaining gates](registry.md)
- [Typed registry](registry.ts) and [fixed matrix](matrix.mjs)
- [Matrix and authority receipt](evidence-r1/matrix.json)
- [Canonical vectors](evidence-r1/vectors.json.gz)
- [Source manifest](evidence-r1/source-manifest.json) and [completion receipt](evidence-r1/receipt.json)
- [Verification](verification.md)

Read-only replay:

```sh
node docs/investigations/issue-185/run.mjs --verify
```

The replay validates trusted current source closure before compilation; it never executes
arbitrary captured source. The record command uses one new `evidence-r1` directory and rejects an
existing directory. A failed or changed historical capture must not be overwritten.

Stream isolation does not imply geometry or placement invariance when paid quotas, owner count
or optional categories change. The unchanged classification seed sentinel does not imply unchanged
classifier output after its macro input changes. Candidate namespaces and float resolution differ
from the private geometry experiments, so all production-v3 images and output proofs must be
regenerated after actual integration. Human selection, contour/control decisions, the accepted
ADR, production contracts and cross-platform evidence remain separate gates.
