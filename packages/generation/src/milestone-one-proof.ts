/** Fixed synthetic composition and marker-only reroll used by the Milestone 1 product proof. */

import {
  type AcceptedAspectRecord,
  type AspectId,
  type AspectName,
  commitAspectProposal,
  CONSTRAINT_KINDS,
  createBehaviorVersion,
  createDeterministicRandomStream,
  createParameterSchemaVersion,
  createProofInputPoint,
  createVariantRevision,
  createWorldRadius,
  type EntityId,
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
  createCommitAspectProposalCommand,
  type GenerationContext,
  type GenerationInput,
  type GenerationProposal,
  type GenerationProposalValidation,
  type GenerationTarget,
  type GenerationValidationContext,
  validateGenerationProposal,
} from './generator-contracts.js';
import {
  PROOF_MARKER_ASPECT_ID,
  PROOF_MARKER_ASPECT_NAME,
  PROOF_MARKER_PARAMETERS,
  PROOF_OUTLINE_ASPECT_ID,
  PROOF_OUTLINE_ASPECT_NAME,
  proofMarkerGenerator,
  type ProofMarkerOutput,
  type ProofMarkerParameters,
  type ProofOutlineOutput,
} from './proof-marker-generator.js';

export const MILESTONE_ONE_PROOF_SEED = '81985529216486895' as const;
export type MilestoneOneProofSeed = typeof MILESTONE_ONE_PROOF_SEED;

export const MILESTONE_ONE_WORLD_DOCUMENT_ID = parsed(
  parseStableId('world-document', '29646d87-2997-44f8-8b6d-7153f93e6e99'),
);
export const MILESTONE_ONE_WORLD_MAP_ID = parsed(
  parseStableId('map', 'a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7'),
);
export const MILESTONE_ONE_PROOF_ENTITY_ID = parsed(
  parseStableId('entity', 'c6f4a17b-dfaf-4dce-9904-9a900d300da4'),
);
export const MILESTONE_ONE_CONSTRAINT_ID = parsed(
  parseStableId('constraint', 'ac35a7ae-3f2c-4433-9351-e23d52c65870'),
);
export const MILESTONE_ONE_OUTLINE_LOCK_ID = parsed(
  parseStableId('lock', '1562f399-119d-4702-aafd-66349098c85f'),
);
export const MILESTONE_ONE_REVISION_ZERO = parsed(createVariantRevision(0));
export const MILESTONE_ONE_REVISION_ONE = parsed(createVariantRevision(1));

const ROOT_SURFACE_ID = parsed(
  parseStableId('root-surface', '41c0988c-d65f-4dab-a064-fc8a8755eaec'),
);
const OUTLINE_GENERATOR_ID = parsed(parseGeneratorId('proof.outline'));
const GENERATOR_VERSION = parsed(createBehaviorVersion(1));
const PARAMETER_SCHEMA_VERSION = parsed(createParameterSchemaVersion(1));
const RADIUS = parsed(createWorldRadius(1_000));

export const MILESTONE_ONE_OUTLINE_OUTPUT: ProofOutlineOutput = Object.freeze({
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

export interface MilestoneOneProofAspects {
  readonly outline: AcceptedAspectRecord<unknown, ProofOutlineOutput, MapEntitySeedInput>;
  readonly markers: AcceptedAspectRecord<
    ProofMarkerParameters,
    ProofMarkerOutput,
    MapEntitySeedInput
  >;
}

/** The proof intentionally accepts only the one registered fixture seed. */
export function isMilestoneOneProofSeed(value: string): value is MilestoneOneProofSeed {
  return value === MILESTONE_ONE_PROOF_SEED;
}

/** Create the exact registered baseline without persistence, rendering, or ambient inputs. */
export function createMilestoneOneProofDocument(seed: MilestoneOneProofSeed): WorldDocument {
  const outline = outlineAspect(seed);
  const markerValidation = proposeMarkersFromOutline(outline, MILESTONE_ONE_REVISION_ZERO);
  if (markerValidation.status !== 'proposed') {
    throw new Error('The fixed baseline marker proposal must be valid.');
  }
  const markers = acceptedProposal(markerValidation.proposal, markerValidation.diagnostics);
  const map: WorldMap = Object.freeze({
    mapId: MILESTONE_ONE_WORLD_MAP_ID,
    mapKind: MAP_KINDS.world,
    scaleClass: MAP_SCALE_CLASSES.world,
    displayName: 'Kernel proof',
    coordinateSystem: Object.freeze({
      kind: MAP_COORDINATE_SYSTEM_KINDS.planetSphere,
      rootSurfaceId: ROOT_SURFACE_ID,
      radius: RADIUS,
    }),
    extent: Object.freeze({ kind: WORLD_MAP_EXTENT_KIND }),
    entities: Object.freeze([
      { entityId: MILESTONE_ONE_PROOF_ENTITY_ID, displayName: 'Proof entity' },
    ]),
    aspects: Object.freeze([outline, markers]),
    constraints: Object.freeze([
      Object.freeze({
        constraintId: MILESTONE_ONE_CONSTRAINT_ID,
        constraintKind: CONSTRAINT_KINDS.proofKeepWithinExtent,
        target: Object.freeze({ aspectId: PROOF_OUTLINE_ASPECT_ID }),
        parameters: Object.freeze({}),
      }),
    ]),
    locks: Object.freeze([
      Object.freeze({
        lockId: MILESTONE_ONE_OUTLINE_LOCK_ID,
        target: Object.freeze({ aspectId: PROOF_OUTLINE_ASPECT_ID }),
      }),
    ]),
    decoration: Object.freeze({ aspectReferences: Object.freeze([]) }),
    layout: Object.freeze({ aspectReferences: Object.freeze([]) }),
  });
  return Object.freeze({
    worldDocumentId: MILESTONE_ONE_WORLD_DOCUMENT_ID,
    displayName: 'Milestone 1 kernel proof',
    worldSeed: outline.seedMetadata.worldSeed,
    rootMapId: MILESTONE_ONE_WORLD_MAP_ID,
    maps: Object.freeze([map]),
  });
}

/** Build the deterministic marker proposal for the requested fixed proof revision. */
export function proposeMilestoneOneMarkers(
  document: WorldDocument,
  revision: VariantRevision,
): GenerationProposalValidation<ProofMarkerParameters, ProofMarkerOutput, MapEntitySeedInput> {
  return proposeMarkersFromOutline(milestoneOneProofAspects(document).outline, revision);
}

/** Execute the normative marker revision 0 -> 1 through the explicit document transaction. */
export function rerollMilestoneOneMarkers(document: WorldDocument) {
  const proposal = proposeMilestoneOneMarkers(document, MILESTONE_ONE_REVISION_ONE);
  const command = createCommitAspectProposalCommand(
    proposal,
    MILESTONE_ONE_REVISION_ZERO,
    Object.freeze([]),
  );
  return commitAspectProposal(document, command);
}

/** Resolve and type the exact two accepted proof records from their stable aspect IDs. */
export function milestoneOneProofAspects(document: WorldDocument): MilestoneOneProofAspects {
  const map = milestoneOneRootMap(document);
  const outline = map.aspects.find(({ aspectId }) => aspectId === PROOF_OUTLINE_ASPECT_ID);
  const markers = map.aspects.find(({ aspectId }) => aspectId === PROOF_MARKER_ASPECT_ID);
  if (outline === undefined || markers === undefined) {
    throw new Error('The world document does not contain the complete Milestone 1 proof.');
  }
  return Object.freeze({
    outline: outline as AcceptedAspectRecord<unknown, ProofOutlineOutput, MapEntitySeedInput>,
    markers: markers as AcceptedAspectRecord<
      ProofMarkerParameters,
      ProofMarkerOutput,
      MapEntitySeedInput
    >,
  });
}

export function milestoneOneRootMap(document: WorldDocument): WorldMap {
  const map = document.maps.find(({ mapId }) => mapId === document.rootMapId);
  if (map?.mapKind !== MAP_KINDS.world || map.mapId !== MILESTONE_ONE_WORLD_MAP_ID) {
    throw new Error('The world document does not contain the fixed Milestone 1 root WorldMap.');
  }
  return map;
}

export function milestoneOneMarkerIds(document: WorldDocument): readonly EntityId[] {
  return Object.freeze(
    milestoneOneProofAspects(document).markers.acceptedOutput.markers.map(
      ({ markerId }) => markerId,
    ),
  );
}

function outlineAspect(seed: MilestoneOneProofSeed): AcceptedAspectRecord<
  {
    readonly pointCount: number;
    readonly insetPermille: number;
    readonly radialJitterPermille: number;
  },
  ProofOutlineOutput,
  MapEntitySeedInput
> {
  const seedMetadata = seedInput(
    seed,
    PROOF_OUTLINE_ASPECT_NAME,
    OUTLINE_GENERATOR_ID,
    MILESTONE_ONE_REVISION_ZERO,
  );
  return Object.freeze({
    mapId: MILESTONE_ONE_WORLD_MAP_ID,
    entityId: MILESTONE_ONE_PROOF_ENTITY_ID,
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
    variantRevision: MILESTONE_ONE_REVISION_ZERO,
    dependencyAspects: Object.freeze([]),
    generationStatus: 'accepted',
    diagnostics: Object.freeze([]),
    acceptedOutput: MILESTONE_ONE_OUTLINE_OUTPUT,
  });
}

function proposeMarkersFromOutline(
  outline: AcceptedAspectRecord<unknown, ProofOutlineOutput, MapEntitySeedInput>,
  revision: VariantRevision,
): GenerationProposalValidation<ProofMarkerParameters, ProofMarkerOutput, MapEntitySeedInput> {
  const input: GenerationInput<ProofOutlineOutput> = Object.freeze({
    reference: Object.freeze({ aspectId: PROOF_OUTLINE_ASPECT_ID }),
    aspectName: PROOF_OUTLINE_ASPECT_NAME,
    variantRevision: outline.variantRevision,
    acceptedOutput: outline.acceptedOutput,
  });
  const target: GenerationTarget = Object.freeze({
    mapId: MILESTONE_ONE_WORLD_MAP_ID,
    entityId: MILESTONE_ONE_PROOF_ENTITY_ID,
    aspect: Object.freeze({ aspectId: PROOF_MARKER_ASPECT_ID }),
    aspectName: PROOF_MARKER_ASPECT_NAME,
    variantRevision: revision,
  });
  const seedMetadata = seedInput(
    MILESTONE_ONE_PROOF_SEED,
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
  proposal: GenerationProposal<ProofMarkerParameters, ProofMarkerOutput, MapEntitySeedInput>,
  diagnostics: readonly (typeof proposal.diagnostics)[number][],
): AcceptedAspectRecord<ProofMarkerParameters, ProofMarkerOutput, MapEntitySeedInput> {
  return Object.freeze({
    mapId: proposal.target.mapId,
    entityId: proposal.target.entityId,
    aspectId: proposal.target.aspect.aspectId,
    aspectName: proposal.target.aspectName,
    generatorId: proposal.generatorId,
    generatorVersion: proposal.generatorVersion,
    parameterSchemaVersion: proposal.parameterSchemaVersion,
    parameters: proposal.parameters,
    seedScope: proposal.seedMetadata.seedScope,
    seedMetadata: proposal.seedMetadata,
    variantRevision: proposal.target.variantRevision,
    dependencyAspects: proposal.dependencyAspects,
    generationStatus: 'accepted',
    diagnostics: orderGenerationDiagnostics(diagnostics),
    acceptedOutput: proposal.output,
  });
}

function seedInput(
  worldSeed: MilestoneOneProofSeed,
  aspectName: AspectName,
  generatorId: GeneratorId,
  revision: VariantRevision,
): MapEntitySeedInput {
  const seedMetadata = parsed(
    parseSeedInput({
      seedDerivationVersion: 1,
      deterministicStreamVersion: 1,
      seedScope: 'map/entity',
      worldSeed,
      generatorId,
      generatorVersion: GENERATOR_VERSION,
      aspectName,
      variantRevision: revision,
      mapId: MILESTONE_ONE_WORLD_MAP_ID,
      entityId: MILESTONE_ONE_PROOF_ENTITY_ID,
    }),
  );
  if (seedMetadata.seedScope !== 'map/entity') throw new Error('Expected map/entity proof seed.');
  return seedMetadata;
}

function proofPoint(x: number, y: number): PlanetPoint {
  return parsed(proofInputToPlanetTransform.forward(parsed(createProofInputPoint(x, y))));
}

function parsed<Value>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly diagnostic: unknown },
): Value {
  if (!result.ok) {
    throw new Error(`Invalid fixed proof value: ${JSON.stringify(result.diagnostic)}`);
  }
  return result.value;
}

void [
  MILESTONE_ONE_WORLD_MAP_ID,
  MILESTONE_ONE_PROOF_ENTITY_ID,
  PROOF_MARKER_ASPECT_ID satisfies AspectId,
];
