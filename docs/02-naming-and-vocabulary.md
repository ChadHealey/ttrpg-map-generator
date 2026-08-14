# 02 — Naming and Vocabulary

Use the conventions of TypeScript, Svelte, and Rust where those ecosystems
already provide an answer. This document settles project-specific choices and the
language of the map domain.

## Identifier conventions

| Thing | Convention | Example |
|---|---|---|
| TypeScript files and folders | `kebab-case` | `seed-derivation.ts`, `inherited-context/` |
| Svelte component files | `PascalCase.svelte` | `MapViewport.svelte` |
| Unit test files | `<subject>.test.ts` | `seed-derivation.test.ts` |
| Integration test files | `<workflow>.integration.test.ts` | `save-reopen.integration.test.ts` |
| Types, classes, components | `PascalCase` | `WorldDocument`, `MapViewport` |
| Functions and variables | `camelCase` | `deriveAspectSeed`, `worldMapId` |
| Private class fields | language-private `#camelCase` when useful | `#activeTool` |
| Module constants | `UPPER_SNAKE_CASE` | `DEFAULT_TILE_SIZE_PX` |
| Schema values | `<name>Schema` | `worldDocumentSchema` |
| Branded IDs | `<Concept>Id` | `EntityId`, `MapId`, `AspectId` |
| Svelte stores | noun describing stored state | `viewportState`, `selectionState` |
| Rust modules/functions | `snake_case` | `atomic_save` |
| Rust types/traits | `PascalCase` | `AtomicSaveError` |
| CLI-like script names | `kebab-case` | `update-goldens.ts` |

Treat acronyms as words in identifiers: `SvgRenderer`, `PngExport`, `worldId`,
and `Rng`, not `SVGRenderer`, `PNGExport`, `worldID`, or `RNG`.

Do not prefix interfaces with `I`. Do not suffix a value with `Data`, `Info`,
`Object`, `Manager`, or `Helper` when a precise domain noun exists.

## Functions describe their effect

Commands use verbs:

```ts
generateTerrain()
saveWorldDocument()
rerollAspect()
reconcileInheritedContext()
```

Queries and predicates make their read-only nature clear:

```ts
getEntityById()
findContainingRegion()
isCoastlineValid()
hasConflictingLocks()
canRegenerateAspect()
```

A function that mutates state and returns an unrelated meaningful result is a
design smell. Return a named transaction/result when the output is part of the
operation; otherwise separate the query from the command.

Avoid vague verbs such as `handle`, `process`, `manage`, or `do` in domain code.
They are acceptable at framework boundaries only when the framework defines the
role, such as a UI event handler.

## Booleans are positive assertions

Boolean names start with `is`, `has`, `can`, or `should` and read naturally in a
condition:

```ts
isLocked
hasValidSink
canReconcile
shouldRenderLabels
```

Avoid negative state such as `isNotStale`, `disableValidation`, or
`hasNoWarnings`. Positive names prevent double negation at call sites.

## Events are past-tense facts

An event reports something that happened; it is not a command:

```ts
generationCompleted
documentSaved
selectionChanged
contextBecameStale
```

Commands are expressed through function calls or command objects. Name UI event
handlers `on<Event>` or `handle<Event>` consistently within the Svelte
application; domain packages do not expose framework handlers.

## Numbers carry units and spaces

Use a domain type when mixing values would be dangerous:

```ts
WorldKilometers
ScreenPixels
PrintPoints
PlanetPoint
RegionalPoint
ScreenPoint
```

Raw numbers at configuration, serialization, or framework boundaries carry a
unit suffix:

```ts
timeoutMs
rotationRad
distanceKm
strokeWidthPx
opacityRatio
gridWidthCells
```

Use one angular unit inside a given algorithm. Convert explicitly at its boundary.
Ratios and probabilities document their range. A tunable parameter documents its
unit, default, useful range, and whether out-of-range values are invalid or merely
unattractive.

## Stable identifiers and keys

- `id` alone is allowed only when the containing type makes the identity
  unambiguous. Otherwise use `mapId`, `entityId`, or `generatorId`.
- Display names are `name` or `displayName`; they are never keys.
- Persisted identifiers are opaque. Do not parse meaning out of them.
- Seed namespaces, aspect names, generator IDs, relationship kinds, map kinds,
  diagnostic codes, and persistence keys are typed constants or validated literal
  unions—not repeated string literals.
- Use `revision` for an intentionally incremented reroll counter and `version` for
  behavior or schema compatibility. They are not synonyms.

## Domain vocabulary

Use one term per concept in code, schemas, diagnostics, and technical docs. The
approved word may have a narrower meaning than ordinary English.

| Concept | Use | Avoid for this concept |
|---|---|---|
| The complete persisted project | **world document** | project file, workspace |
| The root scale-specific map | **world map** | atlas map, global map, planet map |
| A detailed child selected from the world | **regional map** | region document, zoom map |
| One scale-specific owned record | **map document**, or **map** when clear | canvas, scene, level |
| A meaningful world object with identity | **entity** | object, item, node |
| One independently generated concern | **aspect** | layer, field, property |
| Containment of maps and entities | **ownership tree** | scene tree, hierarchy graph |
| Regeneration relationships | **dependency DAG** | ownership graph, pipeline tree |
| Persisted parent input used by a child | **inherited context** | parent data, source blob |
| The stored value of that input | **context snapshot** | cache, copy |
| Origin trail for inherited data | **source lineage** | ancestry, history |
| A connection crossing a map boundary | **boundary portal** | connector, exit, seam point |
| User intent that guides generation | **constraint** | hint, edit instruction |
| User-authored replacement of derived data | **override** | patch, exception |
| Protection from regeneration | **lock** | freeze, pin |
| User-fixed location within an aspect | **pin** | lock, anchor |
| Parent-supplied fixed geographic reference | **anchor** | pin, control point |
| Recompute from the same accepted inputs | **regenerate** | rebuild, redraw |
| Change an aspect revision, then regenerate | **reroll** | randomize, reseed |
| Output that the user has kept | **accepted state** | current cache, generated result |
| Style-neutral geographic shape | **canonical geometry** | raw path, base shape |
| Renderer-neutral drawing description | **render scene** | scene graph, canvas model |
| Visual treatment of canonical geometry | **style** | theme, skin |
| Related procedural symbol definition | **asset family** | stamp set, brush pack |
| One reusable generated symbol | **motif** | stamp, glyph, sprite |
| One positioned motif instance | **placement** | stamp, mark |
| Derived visual arrangement | **decoration** | art layer, styling |
| Data safe to delete and rebuild | **cache** | accepted output, snapshot |
| Structured actionable generation finding | **diagnostic** | log, message, error string |
| Rule that valid output must satisfy | **invariant** | preference, heuristic |
| Child context differs from its source | **stale** | dirty, outdated |
| Can be applied without changing accepted child meaning | **reconcilable** | mergeable |
| Requires an explicit user decision | **conflicting** | invalid, broken |
| Planet's projection-independent coordinates | **planet-native coordinates** | world pixels, atlas coordinates |
| Local physical child-map coordinates | **regional coordinates** | local pixels, world coordinates |

`scene graph`, `stamp`, and `glyph` may appear when discussing third-party APIs,
general graphics concepts, or older planning language. The current plan's
occasional `motif/stamp` wording describes the same concept; new identifiers and
technical rules use `Motif` and `Placement`. These alternatives are not additional
domain types beside `RenderScene`, `Motif`, or `Placement`.

## Geographic names

Do not collapse semantic classifications for convenience:

- `continent`, `major island`, `island chain`, and `archipelago` remain distinct
  landmass classifications.
- `ocean basin`, `sea`, `gulf`, `bay`, `strait`, and `lake` remain distinct where
  the world model declares them.
- `coastline` is the boundary between classified land and water; it is not a
  synonym for landmass or water body.
- `river course`, `river appearance`, and `boundary portal` name different
  aspects.
- `world` describes the complete fictional geography; `map` describes one
  scale-specific representation owned by the world document.

Add vocabulary only when the domain actually needs a distinction. A table full of
speculative future terms is another form of premature architecture.

## File naming

- Prefer a file named for its primary exported concept:
  `seed-derivation.ts`, `WorldViewport.svelte`, `world-document-schema.ts`.
- Unit tests live beside the module they test unless they are shared integration,
  migration, visual, or end-to-end fixtures.
- Fixture directories state their purpose: `fixed-seeds/`, `saved-projects/`,
  `adversarial-geometry/`, `world-region-pairs/`.
- Generated outputs include enough stable provenance to reproduce them; never use
  names such as `final`, `good`, `latest`, or a timestamp as identity.
- Renaming a display label never renames a persisted entity ID or map record.

## Enforcement

ESLint checks identifier shape, not meaning. During the first milestones, review
the vocabulary table in code review and when naming schemas. Once recurring
synonym drift is observed, add a repository vocabulary checker driven by this
table; do not build one preemptively.

If an approved word collides with an external API, isolate the external term in its
adapter and use project vocabulary on the domain side.
