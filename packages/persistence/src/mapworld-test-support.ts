import {
  type AcceptedAspectRecord,
  type AspectName,
  CONSTRAINT_KINDS,
  createBehaviorVersion,
  createDeterministicRandomStream,
  createParameterSchemaVersion,
  createProofInputPoint,
  createVariantRevision,
  createWorldRadius,
  deriveStableId,
  type GeneratorId,
  MAP_COORDINATE_SYSTEM_KINDS,
  MAP_KINDS,
  MAP_SCALE_CLASSES,
  type MapEntitySeedInput,
  parseAspectName,
  parseGenerationDiagnosticCode,
  parseGeneratorId,
  parseSeedInput,
  parseSemanticKey,
  parseStableId,
  type PlanetPoint,
  proofInputToPlanetTransform,
  type VariantRevision,
  WORLD_MAP_EXTENT_KIND,
  type WorldDocument,
} from '@ttrpg-map/core';

export const TEST_OUTLINE_ASPECT_ID = parsed(
  parseStableId('aspect', '54b92092-3d5f-4bca-a12c-353185de1557'),
);
export const TEST_MARKER_ASPECT_ID = parsed(
  parseStableId('aspect', '42928679-db9b-4de2-a8d4-0baecd709cc9'),
);

const WORLD_DOCUMENT_ID = parsed(
  parseStableId('world-document', '29646d87-2997-44f8-8b6d-7153f93e6e99'),
);
const WORLD_MAP_ID = parsed(parseStableId('map', 'a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7'));
const PROOF_ENTITY_ID = parsed(parseStableId('entity', 'c6f4a17b-dfaf-4dce-9904-9a900d300da4'));
const CONSTRAINT_ID = parsed(parseStableId('constraint', 'ac35a7ae-3f2c-4433-9351-e23d52c65870'));
const LOCK_ID = parsed(parseStableId('lock', '1562f399-119d-4702-aafd-66349098c85f'));
const ROOT_SURFACE_ID = parsed(
  parseStableId('root-surface', '41c0988c-d65f-4dab-a064-fc8a8755eaec'),
);
const OUTLINE_NAME = parsed(parseAspectName('proof.outline'));
const MARKER_NAME = parsed(parseAspectName('proof.markers'));
const OUTLINE_GENERATOR_ID = parsed(parseGeneratorId('proof.outline'));
const MARKER_GENERATOR_ID = parsed(parseGeneratorId('proof.markers'));
const GENERATOR_VERSION = parsed(createBehaviorVersion(1));
const PARAMETER_SCHEMA_VERSION = parsed(createParameterSchemaVersion(1));
const WORLD_RADIUS = parsed(createWorldRadius(1_000));

const OUTLINE_POINTS = Object.freeze([
  proofPoint(2_000, 1_000),
  proofPoint(8_000, 1_000),
  proofPoint(9_000, 2_000),
  proofPoint(9_000, 8_000),
  proofPoint(8_000, 9_000),
  proofPoint(2_000, 9_000),
  proofPoint(1_000, 8_000),
  proofPoint(1_000, 2_000),
  proofPoint(2_000, 1_000),
]);

export function createProofDocument(revisionValue = 0): WorldDocument {
  const revision = parsed(createVariantRevision(revisionValue));
  const outline = proofOutlineAspect();
  const markers = proofMarkerAspect(revision);
  return Object.freeze({
    worldDocumentId: WORLD_DOCUMENT_ID,
    displayName: 'Milestone 1 kernel proof',
    worldSeed: outline.seedMetadata.worldSeed,
    rootMapId: WORLD_MAP_ID,
    maps: Object.freeze([
      Object.freeze({
        mapId: WORLD_MAP_ID,
        mapKind: MAP_KINDS.world,
        scaleClass: MAP_SCALE_CLASSES.world,
        displayName: 'Kernel proof',
        coordinateSystem: Object.freeze({
          kind: MAP_COORDINATE_SYSTEM_KINDS.planetSphere,
          rootSurfaceId: ROOT_SURFACE_ID,
          radius: WORLD_RADIUS,
        }),
        extent: Object.freeze({ kind: WORLD_MAP_EXTENT_KIND }),
        entities: Object.freeze([{ entityId: PROOF_ENTITY_ID, displayName: 'Proof entity' }]),
        aspects: Object.freeze([outline, markers]),
        constraints: Object.freeze([
          Object.freeze({
            constraintId: CONSTRAINT_ID,
            constraintKind: CONSTRAINT_KINDS.proofKeepWithinExtent,
            target: Object.freeze({ aspectId: TEST_OUTLINE_ASPECT_ID }),
            parameters: Object.freeze({}),
          }),
        ]),
        locks: Object.freeze([
          Object.freeze({
            lockId: LOCK_ID,
            target: Object.freeze({ aspectId: TEST_OUTLINE_ASPECT_ID }),
          }),
        ]),
        decoration: Object.freeze({ aspectReferences: Object.freeze([]) }),
        layout: Object.freeze({ aspectReferences: Object.freeze([]) }),
      }),
    ]),
  });
}

export function reorderProofDocument(document: WorldDocument): WorldDocument {
  const root = document.maps[0];
  if (root?.mapKind !== 'world') throw new Error('Expected the proof root map.');
  return {
    ...document,
    maps: [
      {
        ...root,
        aspects: [...root.aspects].reverse(),
        entities: [...root.entities].reverse(),
        constraints: [...root.constraints].reverse(),
        locks: [...root.locks].reverse(),
      },
    ],
  };
}

export function proofAspect(document: WorldDocument, aspectId: string): AcceptedAspectRecord {
  const aspect = document.maps
    .flatMap(({ aspects }) => aspects)
    .find(({ aspectId: candidate }) => candidate === aspectId);
  if (aspect === undefined) throw new Error(`Missing test aspect ${aspectId}.`);
  return aspect;
}

export function withDiagnosticTarget(
  document: WorldDocument,
  targetAspectIdText: string,
): WorldDocument {
  const targetAspectId = parsed(parseStableId('aspect', targetAspectIdText));
  const code = parsed(parseGenerationDiagnosticCode('proof.outline.review-warning'));
  return {
    ...document,
    maps: document.maps.map((map) => ({
      ...map,
      aspects: map.aspects.map((aspect) =>
        aspect.aspectId === TEST_OUTLINE_ASPECT_ID
          ? {
              ...aspect,
              diagnostics: [
                {
                  code,
                  severity: 'warning',
                  target: { aspectId: targetAspectId },
                  message: 'Review the accepted outline.',
                  suggestedAction: 'Inspect the referenced accepted aspect.',
                },
              ],
            }
          : aspect,
      ),
    })),
  };
}

function proofOutlineAspect(): AcceptedAspectRecord {
  const revision = parsed(createVariantRevision(0));
  return {
    mapId: WORLD_MAP_ID,
    entityId: PROOF_ENTITY_ID,
    aspectId: TEST_OUTLINE_ASPECT_ID,
    aspectName: OUTLINE_NAME,
    generatorId: OUTLINE_GENERATOR_ID,
    generatorVersion: GENERATOR_VERSION,
    parameterSchemaVersion: PARAMETER_SCHEMA_VERSION,
    parameters: { pointCount: 8, insetPermille: 120, radialJitterPermille: 180 },
    seedScope: 'map/entity',
    seedMetadata: seedInput(OUTLINE_NAME, OUTLINE_GENERATOR_ID, revision),
    variantRevision: revision,
    dependencyAspects: [],
    generationStatus: 'accepted',
    diagnostics: [],
    acceptedOutput: { points: OUTLINE_POINTS },
  };
}

function proofMarkerAspect(revision: VariantRevision): AcceptedAspectRecord {
  const seedMetadata = seedInput(MARKER_NAME, MARKER_GENERATOR_ID, revision);
  const random = parsed(createDeterministicRandomStream(seedMetadata));
  const markers = Array.from({ length: 9 }, (_, index) => {
    const key = parsed(parseSemanticKey(`marker-${String(8 - index).padStart(3, '0')}`));
    return {
      markerId: deriveStableId('entity', PROOF_ENTITY_ID, key),
      position: proofPoint(2_000 + random.nextInt(6_001), 2_000 + random.nextInt(6_001)),
    };
  }).sort((left, right) => compareText(left.markerId, right.markerId));
  return {
    mapId: WORLD_MAP_ID,
    entityId: PROOF_ENTITY_ID,
    aspectId: TEST_MARKER_ASPECT_ID,
    aspectName: MARKER_NAME,
    generatorId: MARKER_GENERATOR_ID,
    generatorVersion: GENERATOR_VERSION,
    parameterSchemaVersion: PARAMETER_SCHEMA_VERSION,
    parameters: { markerCount: 9, edgeClearancePermille: 40 },
    seedScope: 'map/entity',
    seedMetadata,
    variantRevision: revision,
    dependencyAspects: [{ aspectId: TEST_OUTLINE_ASPECT_ID }],
    generationStatus: 'accepted',
    diagnostics: [],
    acceptedOutput: { markers },
  };
}

function seedInput(
  aspectName: AspectName,
  generatorId: GeneratorId,
  variantRevision: VariantRevision,
): MapEntitySeedInput {
  const seed = parsed(
    parseSeedInput({
      seedDerivationVersion: 1,
      deterministicStreamVersion: 1,
      seedScope: 'map/entity',
      worldSeed: '81985529216486895',
      generatorId,
      generatorVersion: GENERATOR_VERSION,
      aspectName,
      variantRevision,
      mapId: WORLD_MAP_ID,
      entityId: PROOF_ENTITY_ID,
    }),
  );
  if (seed.seedScope !== 'map/entity') throw new Error('Expected a map/entity seed.');
  return seed;
}

function proofPoint(x: number, y: number): PlanetPoint {
  return parsed(proofInputToPlanetTransform.forward(parsed(createProofInputPoint(x, y))));
}

function parsed<Value>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly diagnostic: unknown },
): Value {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostic));
  return result.value;
}

function compareText(left: string, right: string): -1 | 0 | 1 {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
