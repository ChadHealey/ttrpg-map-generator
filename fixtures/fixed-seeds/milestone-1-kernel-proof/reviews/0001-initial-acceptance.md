# Milestone 1 kernel proof — initial persistence acceptance

## Intended behavior

Accept the first canonical aspect/output evidence and the version-1 saved package after the fixed
marker-only reroll. The evidence proves deterministic generation, selective isolation, authoritative
checksums, and generator-free restoration of accepted state.

## Changed evidence

- `fixed-seeds/milestone-1-kernel-proof/expected/baseline/proof-markers.aspect.canonical`
- `fixed-seeds/milestone-1-kernel-proof/expected/baseline/proof-markers.output.canonical`
- `fixed-seeds/milestone-1-kernel-proof/expected/baseline/proof-outline.aspect.canonical`
- `fixed-seeds/milestone-1-kernel-proof/expected/baseline/proof-outline.output.canonical`
- `fixed-seeds/milestone-1-kernel-proof/expected/rerolled/proof-markers.aspect.canonical`
- `fixed-seeds/milestone-1-kernel-proof/expected/rerolled/proof-markers.output.canonical`
- `fixed-seeds/milestone-1-kernel-proof/expected/rerolled/proof-outline.aspect.canonical`
- `fixed-seeds/milestone-1-kernel-proof/expected/rerolled/proof-outline.output.canonical`
- `saved-projects/v1/milestone-1-kernel-proof/rerolled.mapworld/manifest.json`
- `saved-projects/v1/milestone-1-kernel-proof/rerolled.mapworld/maps/a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7.json`
- `saved-projects/v1/milestone-1-kernel-proof/rerolled.mapworld/world.json`

## Version and compatibility consequence

This accepts `.mapworld` package/schema, world-index, map-record, and accepted-aspect version 1.
Generator, parameter-schema, seed-derivation, deterministic-stream, and proof-transform versions
remain 1. The selected marker variant revision changes from 0 to 1; the outline revision and every
unrelated accepted record remain unchanged.

## Evidence reviewed

Semantic aspect and accepted-output bytes were reviewed separately. The outline bytes, identities,
constraint, lock, ownership, parameters, seed scope, versions, and dependency remained unchanged;
marker IDs and order remained unchanged while marker output bytes changed. Authoritative
`manifest.json`, `world.json`, the containing map, and all SHA-256 entries were reviewed. SVG and
visual evidence are not applicable to persistence issue #8.
