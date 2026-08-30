# ADR-0024 — Milestone 3 World-Feature Naming Policy

- **Status:** Accepted
- **Date:** 2026-08-29
- **Decision owners:** Project maintainers
- **Supersedes:** None
- **Superseded by:** None
- **Resolves:** [Issue #128](https://github.com/ChadHealey/ttrpg-map-generator/issues/128)

## Context

Milestone 3 requires stable world feature names and a regional child that preserves major named
anchors. The whole-world pipeline places names before labels and atlas layout, so name content must
be accepted semantic data, not renderer output. The M2 records already provide stable landmass,
island-group, and water-body IDs. ADR-0022 adds stable mountain-system, watershed, major-river,
and major-lake records; ADR-0023 requires a clipped regional context to carry named source anchors
without depending on generator internals.

`docs/02-naming-and-vocabulary.md`, ADR-0004, and ADR-0006 require display names to remain
separate from identity, use only validated deterministic inputs, and preserve accepted work across
rerolls, save/reopen, and platform boundaries. This decision fixes the name-content boundary only.
Label candidates, placement, rendering, exports, and regional-local display treatment remain the
separate #129, #141, and #142 boundaries.

## Decision drivers

- Give every globally meaningful M3 feature a reproducible, inspectable display name without
  turning text into an identity or reference key.
- Allow one selected feature's generated name to reroll without changing its geometry, other
  features, or labels.
- Preserve an accepted manual name across generator updates and regional child creation.
- Keep lexical content deterministic, public-repository-safe, and independent of locale and host
  data.
- Carry only required named-anchor evidence into regional inherited context.

## Options considered

### Option A — Derive names from entity IDs or coordinates

This guarantees uniqueness but makes names opaque, exposes implementation detail, and changes a
display concern when identity derivation changes. It also cannot provide useful controlled
vocabulary. Rejected.

### Option B — Generate names as one world-scoped sequential stream

This can make names appear coordinated but means insertion order, removal, or a reroll changes
unrelated names. It violates aspect isolation. Rejected.

### Option C — Versioned entity-owned name content with a small reviewed lexicon

Each eligible feature owns a separately seeded name-content aspect. A project-owned, versioned
lexicon supplies fixed ASCII morphemes and grammar templates; deterministic disambiguation resolves
only normalized collisions inside a declared uniqueness domain. Manual overrides are accepted
semantic values. This is selected.

## Decision

### Named coverage

M3 name content is required for these accepted, globally meaningful feature records:

| Source record                                        | Required name kind | Uniqueness domain         |
| ---------------------------------------------------- | ------------------ | ------------------------- |
| M2 `Landmass` (`continent`, `majorIsland`, `island`) | `landmass`         | all landmass names        |
| M2 `IslandGroup` (`archipelago`, `islandChain`)      | `island-group`     | all island-group names    |
| M2 `WaterBody` (`oceanBasin`, `sea`)                 | `water-body`       | all water-body names      |
| ADR-0022 mountain system                             | `mountain-system`  | all mountain-system names |
| ADR-0022 watershed                                   | `watershed`        | all watershed names       |
| ADR-0022 major river                                 | `river`            | all major-river names     |
| ADR-0022 major lake                                  | `lake`             | all major-lake names      |

Names are not generated for scalar/vector fields, climate-zone or biome class keys, coastline
rings, source components, portals, renderer-only label candidates, or non-meaningful cached
summaries. A future feature class needs its own explicit policy extension before joining this set.

### Name-content record and ownership

Each covered entity owns exactly one `worldFeature.nameContent` aspect. The accepted record contains
the opaque source `entityId`, `nameKind`, a `nameContentBehaviorVersion`, a `lexiconVersion`, the
existing `VariantRevision`, an `origin` discriminant (`generated` or `manual-override`), and the
accepted canonical `displayName`. It carries normal generator/seed metadata when generated.

`entityId` remains the only relationship reference. `displayName`, its normalized form, template
choice, and a disambiguator are never identity inputs, semantic keys, generated IDs, filenames, or
child-map reference keys. An explicit rename changes `origin` to `manual-override` while retaining
the same source entity and aspect identity. Save/reopen restores that accepted record; it never
re-runs the name generator.

Name content is semantic data. It is independent of `label.content` and `label.placement`: those
later presentation aspects may choose a scale-specific abbreviation, alternate regional wording,
or no visible label, but must retain the source `entityId` and cannot mutate accepted world name
content.

### Generated source, grammar, and normalization

The first implementation bundles a reviewed project-owned lexicon as versioned source data. It is
restricted to lowercase ASCII tokens and fixed templates. It may not fetch host, network, locale,
or user-machine data. The future generator selects a template and tokens through ADR-0006's
map/entity scope using the world map ID, source entity ID, generator ID, behavior version, aspect
name, and that aspect's revision. `nameContentBehaviorVersion` and `lexiconVersion` are separate
compatibility values; changing either does not rewrite an accepted record.

Canonical generated output is ASCII title case joined by single U+0020 spaces. The canonical
comparison key lowercases only ASCII A–Z, collapses no whitespace, and otherwise uses the exact
accepted ASCII bytes. Inputs that do not meet this grammar are rejected rather than Unicode- or
locale-normalized. The first implementation constrains manual overrides to that same ASCII grammar
and persists the resulting comparison key alongside the accepted user text; it never silently
transforms a user-entered name. Unrestricted Unicode overrides require a separate versioned
persistence decision.

### Deterministic uniqueness and reroll isolation

The uniqueness domain is the `nameKind` row above, not a traversal order, map display region, or
label visibility. Candidate names are generated independently from each entity's aspect seed. A
deterministic resolver sorts the initial generation batch by canonical source `entityId` ASCII order.
The first record holding a comparison key keeps it. Each subsequent generated record consumes its
own stream to try at most **16** base candidates. If all 16 collide, it appends the lowest available
ASCII Roman-numeral ordinal suffix (` II`, ` III`, and onward) whose comparison key is unclaimed in
the name-kind domain. Manual overrides always retain their exact accepted text. A manual override
whose comparison key is already held by another accepted record is rejected with the stable
`world-feature-name.duplicate` diagnostic; it does not replace, suffix, or otherwise mutate either
accepted name.

Rerolling a generated name increments only that entity's `worldFeature.nameContent` revision and
resolves the selected entity against the fixed set of other accepted names in its name-kind domain.
It never re-resolves those names or changes their content, feature identity, geometry, aspect
seed/revision, or label placement. A manual override is not eligible for a generated-name reroll
until the user explicitly clears it.

### Regional inherited context

ADR-0023 inherited context carries named anchors as source references, not copied text identity:
each entry has the source `entityId`, `nameKind`, accepted world `displayName`,
`nameContentBehaviorVersion`, `lexiconVersion`, origin, and source-aspect revision. The clip includes
every named feature that intersects its padded collar plus any required boundary continuation.
The context checksum covers this canonical stable-ID-ordered list. A later regional-local display
choice may differ, but it retains the same source ID and records its own versioned aspect;
regenerating a region never changes the accepted world name.

### Fixed examples and implementation order

The later generator must include non-private fixed vectors covering:

1. the same world seed/map/entity/version/revision yields the same name bytes on macOS and Linux;
2. different entity IDs use independent map/entity streams;
3. duplicate generated candidates resolve in stable ID order without depending on insertion order;
4. a manual override remains byte-for-byte accepted while a colliding generated record changes;
5. a name reroll leaves geometry, another entity's name metadata, and labels unchanged; and
6. a clipped child context retains the source named-anchor ID, accepted text, versions, and
   checksum provenance.

The ordered children are #140 for name-content records/generation and focused generator tests, #133
for the `.mapworld` compatibility decision and its persistence implementation children, #141 for
candidate resolution and collision behavior, and #142 for label rendering/export. Each child must
consume this ADR rather than expand its contract.

## Consequences

### Positive

- Name content is deterministic and independently rerollable without becoming a hidden identity
  system.
- Region context can preserve named anchors exactly while allowing a later scale-specific display.
- The initial lexicon has an auditable provenance and no ambient or locale behavior.

### Negative

- Finite lexicon diversity can lead to explicit suffixes; aesthetic expansion needs reviewed source
  data and a lexicon-version change.
- A duplicate manual override is rejected and requires the user to choose a distinct accepted name.

### Neutral or follow-up

- #140 implements the generator, diagnostics, and fixed vectors within this policy. #133 assigns
  the persistence schema and implementation owner for accepted name-content/manual-override
  records and named-anchor context before either is persisted.
- Label layout/rendering, font choice, and visual density remain out of scope.

## Compatibility and migration

No M3 name-content schema exists yet, so this ADR introduces no migration or fixture update. The
policy requires separate schema, generator behavior, lexicon, and variant-revision values when
implemented. Existing M2 entities, IDs, geometry, seeds, canonical semantic/SVG/PNG fixtures, and
macOS/Linux output remain unchanged. Accepted manual values must become authoritative persisted
state, never regenerated output. #133 decides the package/schema transition and implementation
owner for those records. Parent-to-child context adds a versioned named-anchor list only when that
decision and the ADR-0023 clipping schema are implemented.

## Validation

Review the six fixed-vector cases above against ADR-0004, ADR-0006, ADR-0022, ADR-0023, and
`docs/02-naming-and-vocabulary.md`. #140 adds focused deterministic, collision,
manual-override, and reroll-isolation tests. The persistence child selected by #133 adds
save/reopen and clipped-context tests before a visual label gallery is added by the label children.

## Revisit conditions

- A required aesthetic needs a third-party corpus, non-ASCII normalization, or language-specific
  grammar; stop for a data-license and compatibility decision before adoption.
- The fixed collision limit or suffix policy proves insufficient on a measured representative M3
  feature matrix.
- A regional display requirement cannot retain the same source entity ID without changing the
  persisted inherited-context contract.
