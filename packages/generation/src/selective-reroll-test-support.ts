/** Shared fixed kernel-proof construction and test-only byte evidence for transaction tests. */

import {
  type AcceptedAspectRecord,
  type AspectId,
  type AspectName,
  type AspectReplacementProposal,
  CONSTRAINT_KINDS,
  createBehaviorVersion,
  createDeterministicRandomStream,
  createParameterSchemaVersion,
  createProofInputPoint,
  createVariantRevision,
  createWorldRadius,
  type GenerationDiagnostic,
  type GeneratorId,
  MAP_COORDINATE_SYSTEM_KINDS,
  MAP_KINDS,
  MAP_SCALE_CLASSES,
  type MapEntitySeedInput,
  orderGenerationDiagnostics,
  parseGeneratorId,
  parseSeedInput,
  parseStableId,
  type PlanetPoint,
  proofInputToPlanetTransform,
  type VariantRevision,
  WORLD_MAP_EXTENT_KIND,
  type WorldDocument,
  type WorldMap,
} from '@ttrpg-map/core';

import {
  type GenerationContext,
  type GenerationInput,
  type GenerationProposal,
  type GenerationProposalValidation,
  type GenerationTarget,
  type GenerationValidationContext,
  PROOF_MARKER_ASPECT_ID,
  PROOF_MARKER_ASPECT_NAME,
  PROOF_MARKER_PARAMETERS,
  PROOF_OUTLINE_ASPECT_ID,
  PROOF_OUTLINE_ASPECT_NAME,
  proofMarkerGenerator,
  type ProofMarkerOutput,
  type ProofMarkerParameters,
  type ProofOutlineOutput,
  validateGenerationProposal,
} from './index.js';

const WORLD_DOCUMENT_ID = parsed(
  parseStableId('world-document', '29646d87-2997-44f8-8b6d-7153f93e6e99'),
);
export const WORLD_MAP_ID = parsed(parseStableId('map', 'a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7'));
export const PROOF_ENTITY_ID = parsed(
  parseStableId('entity', 'c6f4a17b-dfaf-4dce-9904-9a900d300da4'),
);
const CONSTRAINT_ID = parsed(parseStableId('constraint', 'ac35a7ae-3f2c-4433-9351-e23d52c65870'));
const OUTLINE_LOCK_ID = parsed(parseStableId('lock', '1562f399-119d-4702-aafd-66349098c85f'));
const MARKER_LOCK_ID = parsed(parseStableId('lock', '2562f399-119d-4702-aafd-66349098c85f'));
const ROOT_SURFACE_ID = parsed(
  parseStableId('root-surface', '41c0988c-d65f-4dab-a064-fc8a8755eaec'),
);
const OUTLINE_GENERATOR_ID = parsed(parseGeneratorId('proof.outline'));
const GENERATOR_VERSION = parsed(createBehaviorVersion(1));
const PARAMETER_SCHEMA_VERSION = parsed(createParameterSchemaVersion(1));
export const REVISION_ZERO = parsed(createVariantRevision(0));
export const REVISION_ONE = parsed(createVariantRevision(1));
const RADIUS = parsed(createWorldRadius(1_000));

export const OUTLINE_OUTPUT: ProofOutlineOutput = Object.freeze({
  points: Object.freeze([
    proofPoint(2_000, 1_000),
    proofPoint(8_000, 1_000),
    proofPoint(9_000, 2_000),
    proofPoint(9_000, 8_000),
    proofPoint(8_000, 9_000),
    proofPoint(2_000, 9_000),
    proofPoint(1_000, 8_000),
    proofPoint(1_000, 2_000),
    proofPoint(2_000, 1_000),
  ]),
});

export function proofDocument(): WorldDocument {
  const outline = outlineAspect();
  const markerValidation = proposeMarkersFromOutline(outline, REVISION_ZERO);
  if (markerValidation.status !== 'proposed') {
    throw new Error('The fixed baseline marker proposal must be valid.');
  }
  const markers = acceptedProposal(markerValidation.proposal, markerValidation.diagnostics);
  const map: WorldMap = Object.freeze({
    mapId: WORLD_MAP_ID,
    mapKind: MAP_KINDS.world,
    scaleClass: MAP_SCALE_CLASSES.world,
    displayName: 'Kernel proof',
    coordinateSystem: Object.freeze({
      kind: MAP_COORDINATE_SYSTEM_KINDS.planetSphere,
      rootSurfaceId: ROOT_SURFACE_ID,
      radius: RADIUS,
    }),
    extent: Object.freeze({ kind: WORLD_MAP_EXTENT_KIND }),
    entities: Object.freeze([{ entityId: PROOF_ENTITY_ID, displayName: 'Proof entity' }]),
    aspects: Object.freeze([outline, markers]),
    constraints: Object.freeze([
      Object.freeze({
        constraintId: CONSTRAINT_ID,
        constraintKind: CONSTRAINT_KINDS.proofKeepWithinExtent,
        target: Object.freeze({ aspectId: PROOF_OUTLINE_ASPECT_ID }),
        parameters: Object.freeze({}),
      }),
    ]),
    locks: Object.freeze([
      Object.freeze({
        lockId: OUTLINE_LOCK_ID,
        target: Object.freeze({ aspectId: PROOF_OUTLINE_ASPECT_ID }),
      }),
    ]),
    decoration: Object.freeze({ aspectReferences: Object.freeze([]) }),
    layout: Object.freeze({ aspectReferences: Object.freeze([]) }),
  });
  return Object.freeze({
    worldDocumentId: WORLD_DOCUMENT_ID,
    displayName: 'Milestone 1 kernel proof',
    worldSeed: outline.seedMetadata.worldSeed,
    rootMapId: WORLD_MAP_ID,
    maps: Object.freeze([map]),
  });
}

export function proposeMarkers(
  document: WorldDocument,
  revision: VariantRevision,
): GenerationProposalValidation<ProofMarkerParameters, ProofMarkerOutput, MapEntitySeedInput> {
  return proposeMarkersFromOutline(
    aspect(document, PROOF_OUTLINE_ASPECT_ID) as AcceptedAspectRecord<
      unknown,
      ProofOutlineOutput,
      MapEntitySeedInput
    >,
    revision,
  );
}

export function invalidMarkerValidation(
  document: WorldDocument,
  valid: GenerationProposal<ProofMarkerParameters, ProofMarkerOutput, MapEntitySeedInput>,
): GenerationProposalValidation<ProofMarkerParameters, ProofMarkerOutput, MapEntitySeedInput> {
  const first = valid.output.markers[0];
  if (first === undefined) throw new Error('Expected the fixed marker proposal to be non-empty.');
  const proposal = {
    ...valid,
    output: {
      markers: [{ ...first, position: proofPoint(0, 0) }, ...valid.output.markers.slice(1)],
    },
  };
  const outline = aspect(document, PROOF_OUTLINE_ASPECT_ID) as AcceptedAspectRecord<
    unknown,
    ProofOutlineOutput,
    MapEntitySeedInput
  >;
  const input: GenerationInput<ProofOutlineOutput> = {
    reference: { aspectId: PROOF_OUTLINE_ASPECT_ID },
    aspectName: PROOF_OUTLINE_ASPECT_NAME,
    variantRevision: outline.variantRevision,
    acceptedOutput: outline.acceptedOutput,
  };
  return validateGenerationProposal(proofMarkerGenerator, proposal, {
    inputs: [input],
    target: proposal.target,
  });
}

export function rerollProposal(
  current: AcceptedAspectRecord,
  output: unknown,
): AspectReplacementProposal {
  return Object.freeze({
    status: 'proposed',
    target: Object.freeze({
      mapId: current.mapId,
      entityId: current.entityId,
      aspect: Object.freeze({ aspectId: current.aspectId }),
      aspectName: current.aspectName,
      variantRevision: REVISION_ONE,
    }),
    generatorId: current.generatorId,
    generatorVersion: current.generatorVersion,
    parameterSchemaVersion: current.parameterSchemaVersion,
    parameters: current.parameters,
    seedScope: current.seedScope,
    seedMetadata: Object.freeze({ ...current.seedMetadata, variantRevision: REVISION_ONE }),
    dependencyAspects: current.dependencyAspects,
    output,
    diagnostics: Object.freeze([]),
  });
}

export function withMarkerLock(document: WorldDocument): WorldDocument {
  const map = rootMap(document);
  return Object.freeze({
    ...document,
    maps: Object.freeze([
      Object.freeze({
        ...map,
        locks: Object.freeze([
          ...map.locks,
          Object.freeze({
            lockId: MARKER_LOCK_ID,
            target: Object.freeze({ aspectId: PROOF_MARKER_ASPECT_ID }),
          }),
        ]),
      }),
    ]),
  });
}

export function withoutLocks(document: WorldDocument): WorldDocument {
  const map = rootMap(document);
  return Object.freeze({
    ...document,
    maps: Object.freeze([Object.freeze({ ...map, locks: Object.freeze([]) })]),
  });
}

export function rootMap(document: WorldDocument): WorldMap {
  const map = document.maps.find(({ mapId }) => mapId === document.rootMapId);
  if (map?.mapKind !== MAP_KINDS.world) throw new Error('Expected the proof root WorldMap.');
  return map;
}

export function aspect(document: WorldDocument, aspectId: AspectId): AcceptedAspectRecord {
  const accepted = rootMap(document).aspects.find((candidate) => candidate.aspectId === aspectId);
  if (accepted === undefined) throw new Error(`Missing proof aspect ${aspectId}.`);
  return accepted;
}

export function markerIds(record: AcceptedAspectRecord): readonly string[] {
  const output = record.acceptedOutput as ProofMarkerOutput;
  return output.markers.map(({ markerId }) => markerId);
}

/** Test-only byte evidence; #8 owns production canonical aspect serialization. */
export function testEvidenceBytes(value: unknown): Uint8Array {
  const canonical = JSON.stringify(canonicalTestValue(value));
  return Uint8Array.from(canonical, (character) => character.charCodeAt(0));
}

function outlineAspect(): AcceptedAspectRecord<
  {
    readonly pointCount: number;
    readonly insetPermille: number;
    readonly radialJitterPermille: number;
  },
  ProofOutlineOutput,
  MapEntitySeedInput
> {
  const seedMetadata = seedInput(PROOF_OUTLINE_ASPECT_NAME, OUTLINE_GENERATOR_ID, REVISION_ZERO);
  return Object.freeze({
    mapId: WORLD_MAP_ID,
    entityId: PROOF_ENTITY_ID,
    aspectId: PROOF_OUTLINE_ASPECT_ID,
    aspectName: PROOF_OUTLINE_ASPECT_NAME,
    generatorId: OUTLINE_GENERATOR_ID,
    generatorVersion: GENERATOR_VERSION,
    parameterSchemaVersion: PARAMETER_SCHEMA_VERSION,
    parameters: Object.freeze({
      pointCount: 8,
      insetPermille: 120,
      radialJitterPermille: 180,
    }),
    seedScope: 'map/entity',
    seedMetadata,
    variantRevision: REVISION_ZERO,
    dependencyAspects: Object.freeze([]),
    generationStatus: 'accepted',
    diagnostics: Object.freeze([]),
    acceptedOutput: OUTLINE_OUTPUT,
  });
}

function proposeMarkersFromOutline(
  outline: AcceptedAspectRecord<unknown, ProofOutlineOutput, MapEntitySeedInput>,
  revision: VariantRevision,
) {
  const input: GenerationInput<ProofOutlineOutput> = Object.freeze({
    reference: Object.freeze({ aspectId: PROOF_OUTLINE_ASPECT_ID }),
    aspectName: PROOF_OUTLINE_ASPECT_NAME,
    variantRevision: outline.variantRevision,
    acceptedOutput: outline.acceptedOutput,
  });
  const target: GenerationTarget = Object.freeze({
    mapId: WORLD_MAP_ID,
    entityId: PROOF_ENTITY_ID,
    aspect: Object.freeze({ aspectId: PROOF_MARKER_ASPECT_ID }),
    aspectName: PROOF_MARKER_ASPECT_NAME,
    variantRevision: revision,
  });
  const seedMetadata = seedInput(
    PROOF_MARKER_ASPECT_NAME,
    proofMarkerGenerator.manifest.generatorId,
    revision,
  );
  const readContext = Object.freeze({ inputs: Object.freeze([input]) });
  const context: GenerationContext<ProofOutlineOutput, MapEntitySeedInput> = Object.freeze({
    ...readContext,
    seedMetadata,
    random: parsed(createDeterministicRandomStream(seedMetadata)),
  });
  const plan = proofMarkerGenerator.plan(context, target);
  const proposal = proofMarkerGenerator.generate(context, plan, PROOF_MARKER_PARAMETERS);
  const validationContext: GenerationValidationContext<ProofOutlineOutput> = Object.freeze({
    ...readContext,
    target,
  });
  return validateGenerationProposal(proofMarkerGenerator, proposal, validationContext);
}

function acceptedProposal(
  proposal: GenerationProposal,
  diagnostics: readonly GenerationDiagnostic[],
): AcceptedAspectRecord {
  return Object.freeze({
    mapId: proposal.target.mapId,
    entityId: proposal.target.entityId,
    aspectId: proposal.target.aspect.aspectId,
    aspectName: proposal.target.aspectName,
    generatorId: proposal.generatorId,
    generatorVersion: proposal.generatorVersion,
    parameterSchemaVersion: proposal.parameterSchemaVersion,
    parameters: proposal.parameters,
    seedScope: proposal.seedScope,
    seedMetadata: proposal.seedMetadata,
    variantRevision: proposal.target.variantRevision,
    dependencyAspects: proposal.dependencyAspects,
    generationStatus: 'accepted',
    diagnostics: orderGenerationDiagnostics(diagnostics),
    acceptedOutput: proposal.output,
  });
}

function seedInput(
  aspectName: AspectName,
  generatorId: GeneratorId,
  revision: VariantRevision,
): MapEntitySeedInput {
  const seedMetadata = parsed(
    parseSeedInput({
      seedDerivationVersion: 1,
      deterministicStreamVersion: 1,
      seedScope: 'map/entity',
      worldSeed: '81985529216486895',
      generatorId,
      generatorVersion: GENERATOR_VERSION,
      aspectName,
      variantRevision: revision,
      mapId: WORLD_MAP_ID,
      entityId: PROOF_ENTITY_ID,
    }),
  );
  if (seedMetadata.seedScope !== 'map/entity') throw new Error('Expected map/entity proof seed.');
  return seedMetadata;
}

function proofPoint(x: number, y: number): PlanetPoint {
  return parsed(proofInputToPlanetTransform.forward(parsed(createProofInputPoint(x, y))));
}

function canonicalTestValue(value: unknown): unknown {
  if (typeof value === 'bigint') return Object.freeze({ bigint: value.toString(10) });
  if (Array.isArray(value)) return value.map(canonicalTestValue);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => [key, canonicalTestValue(item)]),
  );
}

function parsed<Value>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly diagnostic: unknown },
): Value {
  if (!result.ok)
    throw new Error(`Invalid fixed proof value: ${JSON.stringify(result.diagnostic)}`);
  return result.value;
}
