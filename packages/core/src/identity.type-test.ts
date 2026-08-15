import {
  type AspectId,
  compareStableReferences,
  deriveStableId,
  type EntityId,
  type GeneratorId,
  type MapId,
  parseGeneratorId,
  parseSemanticKey,
  parseStableId,
  type RootSurfaceId,
  type StableIdSource,
  stableReferencesEqual,
} from './identity.js';

const mapId = parseStableId('map', 'a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7');
const entityId = parseStableId('entity', 'c6f4a17b-dfaf-4dce-9904-9a900d300da4');
const generatorId = parseGeneratorId('proof.outline');
const semanticKey = parseSemanticKey('marker-000');
const rootSurfaceId = parseStableId('root-surface', '41c0988c-d65f-4dab-a064-fc8a8755eaec');

// @ts-expect-error Raw strings cannot bypass map-ID parsing.
const unparsedMapId: MapId = 'a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7';

const mapOnlyCallback = (_kind: 'map'): unknown => 'a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7';
const invalidSource: StableIdSource = {
  // @ts-expect-error An ID source must accept every stable ID kind, not only maps.
  nextUuid: mapOnlyCallback,
};

if (mapId.ok && entityId.ok && generatorId.ok && semanticKey.ok) {
  const exactMapId: MapId = mapId.value;
  const exactEntityId: EntityId = entityId.value;
  const exactGeneratorId: GeneratorId = generatorId.value;
  const derivedAspectId: AspectId = deriveStableId('aspect', entityId.value, semanticKey.value);

  // @ts-expect-error Entity identity is not map identity.
  const invalidMapId: MapId = entityId.value;
  // @ts-expect-error Symbolic generator identity is not UUID-backed entity identity.
  const invalidEntityId: EntityId = generatorId.value;
  // @ts-expect-error Equality requires the same branded identity kind.
  stableReferencesEqual(mapId.value, entityId.value);
  // @ts-expect-error Ordering requires the same branded identity kind.
  compareStableReferences(mapId.value, entityId.value);
  // @ts-expect-error Derivation requires a validated semantic key.
  deriveStableId('entity', entityId.value, 'marker-000');

  void [
    exactMapId,
    exactEntityId,
    exactGeneratorId,
    derivedAspectId,
    invalidMapId,
    invalidEntityId,
    invalidSource,
    unparsedMapId,
  ];
}

if (rootSurfaceId.ok && mapId.ok) {
  const exactRootSurfaceId: RootSurfaceId = rootSurfaceId.value;
  // @ts-expect-error A child map cannot stand in for the persisted root-surface namespace.
  const invalidRootSurfaceId: RootSurfaceId = mapId.value;
  void [exactRootSurfaceId, invalidRootSurfaceId];
}
