/** Synthetic Milestone 1 marker generator used only to prove deterministic selective rerolls. */

import {
  type AspectId,
  type AspectName,
  compareStableReferences,
  createBehaviorVersion,
  createParameterSchemaVersion,
  createProofInputPoint,
  deriveStableId,
  type EntityId,
  type GenerationDiagnostic,
  type GenerationDiagnosticCode,
  type GeneratorId,
  type MapEntitySeedInput,
  parseAspectName,
  parseGenerationDiagnosticCode,
  parseGeneratorId,
  parseSemanticKey,
  parseStableId,
  type PlanetPoint,
  proofInputToPlanetTransform,
  type SemanticKey,
} from '@ttrpg-map/core';

import {
  type GenerationPlan,
  type GenerationProposal,
  type Generator,
  orderAspectReferences,
} from './generator-contracts.js';

export interface ProofOutlineOutput {
  readonly points: readonly PlanetPoint[];
}

export interface ProofMarkerParameters {
  readonly markerCount: number;
  readonly edgeClearancePermille: number;
}

export interface ProofMarker {
  readonly markerId: EntityId;
  readonly position: PlanetPoint;
}

export interface ProofMarkerOutput {
  readonly markers: readonly ProofMarker[];
}

export interface ProofMarkerPlan extends GenerationPlan {
  readonly outline: readonly PlanetPoint[];
}

export const PROOF_OUTLINE_ASPECT_ID = fixedValue(
  parseStableId('aspect', '54b92092-3d5f-4bca-a12c-353185de1557'),
);
export const PROOF_MARKER_ASPECT_ID = fixedValue(
  parseStableId('aspect', '42928679-db9b-4de2-a8d4-0baecd709cc9'),
);
export const PROOF_OUTLINE_ASPECT_NAME = fixedValue(parseAspectName('proof.outline'));
export const PROOF_MARKER_ASPECT_NAME = fixedValue(parseAspectName('proof.markers'));
export const PROOF_MARKER_GENERATOR_ID = fixedValue(parseGeneratorId('proof.markers'));
export const PROOF_MARKER_PARAMETERS: ProofMarkerParameters = Object.freeze({
  markerCount: 9,
  edgeClearancePermille: 40,
});

const GENERATOR_VERSION = fixedValue(createBehaviorVersion(1));
const PARAMETER_SCHEMA_VERSION = fixedValue(createParameterSchemaVersion(1));
const INVALID_COUNT_CODE = fixedValue(parseGenerationDiagnosticCode('proof.markers.invalid-count'));
const OUTSIDE_OUTLINE_CODE = fixedValue(
  parseGenerationDiagnosticCode('proof.markers.outside-outline'),
);
const CENTRAL_INSET = 2_000;
const CENTRAL_SPAN = 6_001;

/** Fixed synthetic generator; it has no document, renderer, persistence, or ambient RNG access. */
const proofMarkerGeneratorDefinition: Generator<
  ProofMarkerParameters,
  ProofMarkerOutput,
  ProofOutlineOutput,
  MapEntitySeedInput,
  ProofMarkerPlan
> = {
  manifest: Object.freeze({
    generatorId: PROOF_MARKER_GENERATOR_ID,
    generatorVersion: GENERATOR_VERSION,
    parameterCompatibility: Object.freeze({
      currentVersion: PARAMETER_SCHEMA_VERSION,
      acceptedVersions: Object.freeze([PARAMETER_SCHEMA_VERSION]),
    }),
    inputAspects: Object.freeze([PROOF_OUTLINE_ASPECT_NAME]),
    outputAspects: Object.freeze([PROOF_MARKER_ASPECT_NAME]),
    seedScope: 'map/entity',
    validation: Object.freeze({
      owner: 'generator',
      diagnosticCodes: Object.freeze([INVALID_COUNT_CODE, OUTSIDE_OUTLINE_CODE]),
    }),
  }),
  plan(context, target): ProofMarkerPlan {
    const outline = context.inputs.find(
      (input) => input.reference.aspectId === PROOF_OUTLINE_ASPECT_ID,
    );
    if (outline === undefined) {
      throw new Error('The proof marker generator requires the accepted proof outline input.');
    }
    return Object.freeze({
      target,
      dependencyAspects: orderAspectReferences([outline.reference]),
      seedScope: 'map/entity',
      outline: outline.acceptedOutput.points,
    });
  },
  generate(
    context,
    plan,
    parameters,
  ): GenerationProposal<ProofMarkerParameters, ProofMarkerOutput, MapEntitySeedInput> {
    const markers = Array.from({ length: parameters.markerCount }, (_, index) =>
      markerKey(parameters.markerCount - index - 1),
    )
      .map((semanticKey) => ({
        markerId: deriveStableId('entity', plan.target.entityId, semanticKey),
        position: proofPoint(
          CENTRAL_INSET + context.random.nextInt(CENTRAL_SPAN),
          CENTRAL_INSET + context.random.nextInt(CENTRAL_SPAN),
        ),
      }))
      .sort((left, right) => compareStableReferences(left.markerId, right.markerId));
    return Object.freeze({
      status: 'proposed',
      target: plan.target,
      generatorId: PROOF_MARKER_GENERATOR_ID,
      generatorVersion: GENERATOR_VERSION,
      parameterSchemaVersion: PARAMETER_SCHEMA_VERSION,
      parameters,
      seedScope: plan.seedScope,
      seedMetadata: context.seedMetadata,
      dependencyAspects: plan.dependencyAspects,
      output: Object.freeze({ markers: Object.freeze(markers) }),
      diagnostics: Object.freeze([]),
    });
  },
  validate(proposal, context): readonly GenerationDiagnostic[] {
    const outline = context.inputs.find(
      (input) => input.reference.aspectId === PROOF_OUTLINE_ASPECT_ID,
    )?.acceptedOutput.points;
    const diagnostics: GenerationDiagnostic[] = [];
    if (proposal.output.markers.length !== proposal.parameters.markerCount) {
      diagnostics.push(
        diagnostic(
          INVALID_COUNT_CODE,
          'Generated marker count does not match the requested markerCount.',
          'Generate exactly the requested number of stable marker identities.',
        ),
      );
    }
    for (const marker of proposal.output.markers) {
      if (outline === undefined || !isStrictlyInsidePolygon(marker.position, outline)) {
        diagnostics.push(
          diagnostic(
            OUTSIDE_OUTLINE_CODE,
            `Marker ${String(marker.markerId)} is not strictly inside the accepted proof outline.`,
            'Regenerate the marker inside the accepted outline and declared edge clearance.',
          ),
        );
      }
    }
    return diagnostics;
  },
};

export const proofMarkerGenerator = Object.freeze(proofMarkerGeneratorDefinition);

function markerKey(index: number): SemanticKey {
  return fixedValue(parseSemanticKey(`marker-${String(index).padStart(3, '0')}`));
}

function proofPoint(x: number, y: number): PlanetPoint {
  const input = fixedValue(createProofInputPoint(x, y));
  return fixedValue(proofInputToPlanetTransform.forward(input));
}

function isStrictlyInsidePolygon(point: PlanetPoint, polygon: readonly PlanetPoint[]): boolean {
  let isInside = false;
  for (let index = 0, priorIndex = polygon.length - 1; index < polygon.length; index += 1) {
    const current = polygon[index];
    const prior = polygon[priorIndex];
    if (current === undefined || prior === undefined) return false;
    if (isPointOnSegment(point, prior, current)) return false;
    const crosses =
      current.latitudeTicks > point.latitudeTicks !== prior.latitudeTicks > point.latitudeTicks;
    if (crosses) {
      const crossingLongitude =
        ((prior.longitudeTicks - current.longitudeTicks) *
          (point.latitudeTicks - current.latitudeTicks)) /
          (prior.latitudeTicks - current.latitudeTicks) +
        current.longitudeTicks;
      if (point.longitudeTicks < crossingLongitude) isInside = !isInside;
    }
    priorIndex = index;
  }
  return isInside;
}

function isPointOnSegment(point: PlanetPoint, start: PlanetPoint, end: PlanetPoint): boolean {
  const cross =
    (point.latitudeTicks - start.latitudeTicks) * (end.longitudeTicks - start.longitudeTicks) -
    (point.longitudeTicks - start.longitudeTicks) * (end.latitudeTicks - start.latitudeTicks);
  return (
    cross === 0 &&
    point.longitudeTicks >= Math.min(start.longitudeTicks, end.longitudeTicks) &&
    point.longitudeTicks <= Math.max(start.longitudeTicks, end.longitudeTicks) &&
    point.latitudeTicks >= Math.min(start.latitudeTicks, end.latitudeTicks) &&
    point.latitudeTicks <= Math.max(start.latitudeTicks, end.latitudeTicks)
  );
}

function diagnostic(
  code: GenerationDiagnosticCode,
  message: string,
  suggestedAction: string,
): GenerationDiagnostic {
  return Object.freeze({
    code,
    severity: 'error',
    target: Object.freeze({ aspectId: PROOF_MARKER_ASPECT_ID }),
    message,
    suggestedAction,
  });
}

function fixedValue<Value>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly diagnostic: unknown },
): Value {
  if (!result.ok)
    throw new Error(`Invalid fixed proof contract: ${JSON.stringify(result.diagnostic)}`);
  return result.value;
}

void [
  PROOF_OUTLINE_ASPECT_ID satisfies AspectId,
  PROOF_OUTLINE_ASPECT_NAME satisfies AspectName,
  PROOF_MARKER_GENERATOR_ID satisfies GeneratorId,
];
