# ADR-0010 — Atlas semantic classification and stable component identity

- **Status:** Accepted
- **Date:** 2026-08-16
- **Decision owners:** Project maintainers
- **Supersedes:** None
- **Superseded by:** None

## Context

Milestone 2 has an accepted full-profile macro-elevation field and land/water partition from issue
#58. Issue #59 must convert that partition into stable landmass, island-group, and water-body
entities without editing the upstream samples, treating the atlas chart as planar geography, or
making traversal order part of identity.

The fixed matrix also demonstrates why raw cell connectivity and semantic marine connectivity
cannot be synonyms. Some single-global rows contain disconnected enclosed water, while the
multiple-basin row has open water joined through a narrow full-resolution passage. The semantic
policy therefore needs an explicit atlas-scale enclosure/clearance rule while retaining exact
ownership of every accepted sample.

## Decision drivers

- Follow ADR-0009 horizontal wrap and single-pole-vertex adjacency exactly.
- Preserve every accepted #58 land/water sample and prove exactly-once semantic ownership.
- Keep containment and marine connectivity separate from aspect dependency edges.
- Derive stable identities from stable parents and canonical semantic fingerprints.
- Make classification thresholds inspectable, versioned, deterministic, and renderer-independent.
- Support the six fixed proof rows without inventing lakes, coastline geometry, or names.
- Return stable actionable diagnostics rather than repairing or partially accepting ambiguity.

## Options considered

### Option A — Versioned spherical component and marine-clearance policy

Discover raw components on the accepted spherical sample graph, retain canonical range ownership,
classify land by spherical area, and segment the primary marine component through a fixed
distance-from-land clearance graph. Derive entity identity from hashes of canonical memberships.

### Option B — Classify only raw connected components

This is simpler, but cannot realize the fixed multiple-basin row when its full partition contains
one narrow connected marine component. It also cannot distinguish a marginal sea from its ocean.

### Option C — Infer types later from rendered size or projected shapes

This avoids an accepted semantic policy but makes display projection and renderer behavior
authoritative. It cannot support stable inspection, persistence, selective rerolls, or exact
connectivity/containment validation.

## Decision

Adopt Option A as semantic-classification policy version 1, parameter-schema version 1, component
fingerprint version 1, and identity-derivation version 1.

### Component topology and ownership

Raw discovery uses the ADR-0009 full profile: four neighbors on interior rows, horizontal wrap,
and one pole vertex connected to every anchor in its adjacent row. Canonical discovery starts at
the first unowned sample in south-pole/row/north-pole traversal and visits north, west, east, then
south; pole neighbors visit longitude indices in ascending order. Discovery order is diagnostic
behavior only and never enters a stable ID.

Each semantic landmass or water body records sorted, non-adjacent half-open sample ranges in
canonical traversal, an exact sample count, and its integer spherical area weight. The complete
landmass/water-body set must cover every full-profile sample exactly once, match the accepted
land/water value, and give each entity one connected region under the declared topology.

### Landmass thresholds

Version 1 uses the same `2^20` integer cosine row-weight scale as #58 realization measurement.

- A component owning at least 20% of total retained land weight is a `continent`.
- A remaining component owning at least 2% is a `majorIsland`.
- Every remaining accepted land component is an `island`; the minimum is one accepted sample.

The continent-count control remains an upstream atlas-shaping intent. The classifier does not
relabel disconnected land to force that count and never suppresses an accepted #58 component.

### Island-group policy

Individual kind and group relationship remain separate. Candidate membership is limited to
`floor(nonContinentalCount * archipelagoAbundancePercent / 100)`, ranked by nearest spherical
centroid distance and stable entity ID. Fewer than two budgeted members produce no group.

A compact pair separated by at most 750 milliradians seeds an `archipelago`. With a budget of at
least four, remaining members may form a separate `islandChain`; otherwise the selected set is an
archipelago when its maximum separation is within that compact threshold and an island chain when
it is not. Chain order uses deterministic nearest-neighbor order with stable-ID ties, and every
consecutive chain separation must be at most 1800 milliradians. A member appears in at most one
group and group kind is mutually exclusive.

### Water-body and marine-connectivity policy

Distance from accepted land is measured in spherical graph edges. Water farther than 16 edges
from land forms an open-marine clearance core. The primary raw water component is the component
with greatest spherical area, with canonical membership as the tie-breaker. Its clearance cores
seed connected semantic regions; all original water samples are assigned through deterministic
multi-source graph traversal, so narrow passages remain owned even when they do not join basin
roots at the declared atlas scale.

- `singleGlobal` and `connectedMajority` classify the largest open region as `oceanBasin`, classify
  other open regions as marginal `sea`, and record reciprocal `open-marine-neck` edges across
  their region boundaries.
- `multipleBasins` requires at least two clearance cores, classifies their regions as independent
  `oceanBasin` roots, and does not add connectivity across a passage below the clearance rule.
- Raw water components other than the primary component are enclosed `sea` entities. Every
  accepted water component is retained with a one-sample minimum because lake suppression or
  merging would have to occur before #59 accepts the #58 partition.
- Connected-majority requires the largest basin-rooted open-marine graph component to own at
  least 90% of non-enclosed marine area.

An island's containing water body is its adjacent body with greatest shared boundary-edge count,
with stable entity ID as the tie-breaker. Enclosed seas list all adjacent enclosing landmasses.
Adjacency, containment, and marine connectivity are reciprocal semantic relationships, not aspect
dependency edges.

### Stable identity and order

Component fingerprint bytes are ASCII:

```text
ttrpg-map/atlas-semantic-component/v1/<land-or-water>/<start:end,...>
```

SHA-256 produces 64 lowercase hexadecimal characters. Component IDs derive from the stable
world-surface entity and `<kind>-component-<fingerprint>`; landmass/water-body entity IDs derive
from the stable world-map ID and `<kind>-entity-<fingerprint>`. Island-group identity hashes the
group kind plus member IDs in stable-ID order, independent of chain array order, then derives from
the world-map ID. Collections use ascending stable-ID order; chain member arrays retain declared
semantic order.

Dependency recomputation retains the variant revision of any aspect whose derived stable identity
survives, gives new aspects revision zero, increments no semantic revision, and proposes only
`landmass.classification`, `islandGroup.classification`, and `waterBody.classification` aspects.
Unrelated accepted aspects are outside the patch.

## Consequences

### Positive

- Seam, poles, containment, and connectivity are executable spherical contracts.
- Exact range ownership proves coverage without storing one UUID per two-million-sample anchor.
- Renderers can consume accepted kinds and never infer semantics from visual area.
- IDs and canonical order are independent of component traversal, object insertion, and array
  construction order.
- The fixed matrix expresses enclosed water, marginal seas, connected-majority, and multiple
  basins without modifying accepted #58 samples.

### Negative

- The 16-cell clearance is atlas-profile-specific and requires a compatibility change if the
  accepted profile changes.
- Spherical centroid grouping is intentionally a bounded M2 relationship heuristic rather than a
  geological island-arc model.
- Membership validation performs linear full-profile work and is not a cheap UI query.

## Compatibility and migration

No released Milestone 2 semantic records exist, so no migration is required. Changing any area,
clearance, grouping, tie-break, membership, fingerprint, identity, or canonical-order rule changes
the smallest affected semantic policy/generator version and requires reviewed fixed evidence.
Existing accepted output remains materialized and is never regenerated on load.

This decision does not change ADR-0005 coordinates, ADR-0006 seeds, ADR-0009 sampling, #58 field or
partition versions, coastline geometry, style, inherited context, or persistence schema versions.

## Validation

Tests cover fixed seeds, repeated output, insertion order, seam and pole components, small islands,
both disjoint island-group kinds, marginal and enclosed seas, all three ocean modes, exact
ownership, disconnected/overlapping/missing membership, identity collisions, proposal isolation,
and canonical encode/decode through the existing persistence serializer without regeneration.

## Revisit conditions

- A later accepted atlas profile cannot express the clearance in an equivalent physical policy.
- Visual/semantic review shows the fixed clearance systematically misclassifies broad marginal
  seas or narrow ocean connections.
- A required stable feature match must survive membership changes across geography rerolls rather
  than treating changed canonical membership as a new feature.
- Milestone 3 lake semantics require upstream suppression choices to become explicit entities.
