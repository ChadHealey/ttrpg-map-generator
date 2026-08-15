# Fixture review: seed derivation version 1

## Intended behavior

Accept the ADR-0006 seed-input preimages, SHA-256 derived seeds, xoshiro256** samples, selected
aspect revision isolation, and cross-child root/shared identity agreement as version 1
compatibility evidence.

## Changed evidence

- `fixed-seeds/seed-derivation-v1/expected/map-entity-r0/seed.kernel.canonical`
- `fixed-seeds/seed-derivation-v1/expected/map-entity-r1/seed.kernel.canonical`
- `fixed-seeds/seed-derivation-v1/expected/root-child-a/seed.kernel.canonical`
- `fixed-seeds/seed-derivation-v1/expected/root-child-b/seed.kernel.canonical`
- `fixed-seeds/seed-derivation-v1/expected/shared-child-a/seed.kernel.canonical`
- `fixed-seeds/seed-derivation-v1/expected/shared-child-b/seed.kernel.canonical`

## Version and compatibility consequence

Initial seed-derivation version 1 and deterministic-stream version 1 evidence; no released
seed-bearing document or prior canonical fixture is migrated.

## Evidence reviewed

Canonical kernel bytes and samples were reviewed against ADR-0006. Root-coordinate and
shared-boundary evidence were confirmed identical across distinct child contexts; map/entity
revision 0 and 1 were confirmed different. Semantic aspect, authoritative-file, SVG, and visual
evidence are not yet applicable.
