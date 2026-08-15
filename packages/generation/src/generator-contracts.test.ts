import {
  type AspectId,
  type AspectName,
  compareStableReferences,
  createBehaviorVersion,
  createParameterSchemaVersion,
  createProofInputPoint,
  createVariantRevision,
  deriveStableId,
  type EntityId,
  type GenerationDiagnostic,
  type GenerationDiagnosticCode,
  type GeneratorId,
  type MapId,
  parseAspectName,
  parseGenerationDiagnosticCode,
  parseGeneratorId,
  parseSemanticKey,
  parseStableId,
  type PlanetPoint,
  proofInputToPlanetTransform,
  type SemanticKey,
  type VariantRevision,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import {
  type DeterministicRandomStream,
  type GenerationContext,
  type GenerationPlan,
  type GenerationProposal,
  type GenerationReadContext,
  type GenerationTarget,
  type GenerationValidationContext,
  type Generator,
  type GeneratorManifest,
  orderAspectReferences,
  validateGenerationProposal,
} from './generator-contracts.js';

interface ProofOutlineOutput {
  readonly points: readonly PlanetPoint[];
}

interface MarkerParameters {
  readonly markerCount: number;
  readonly edgeClearancePermille: number;
}

interface ProofMarker {
  readonly entityId: EntityId;
  readonly position: PlanetPoint;
}

interface MarkerOutput {
  readonly markers: readonly ProofMarker[];
}

interface MarkerPlan extends GenerationPlan {
  readonly outline: readonly PlanetPoint[];
}

interface ProofSeedMetadata {
  readonly worldSeed: string;
  readonly seedDerivationVersion: 1;
  readonly variantRevision: VariantRevision;
}

const WORLD_MAP_ID = expectParsed(parseStableId('map', 'a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7'));
const PROOF_ENTITY_ID = expectParsed(
  parseStableId('entity', 'c6f4a17b-dfaf-4dce-9904-9a900d300da4'),
);
const OUTLINE_ASPECT_ID = expectParsed(
  parseStableId('aspect', '54b92092-3d5f-4bca-a12c-353185de1557'),
);
const MARKER_ASPECT_ID = expectParsed(
  parseStableId('aspect', '42928679-db9b-4de2-a8d4-0baecd709cc9'),
);
const OUTLINE_ASPECT_NAME = expectParsed(parseAspectName('proof.outline'));
const MARKER_ASPECT_NAME = expectParsed(parseAspectName('proof.markers'));
const MARKER_GENERATOR_ID = expectParsed(parseGeneratorId('proof.markers'));
const OUTSIDE_OUTLINE_CODE = expectParsed(
  parseGenerationDiagnosticCode('proof.markers.outside-outline'),
);
const INVALID_COUNT_CODE = expectParsed(
  parseGenerationDiagnosticCode('proof.markers.invalid-count'),
);
const GENERATOR_VERSION = expectParsed(createBehaviorVersion(1));
const PARAMETER_SCHEMA_VERSION = expectParsed(createParameterSchemaVersion(1));
const BASELINE_REVISION = expectParsed(createVariantRevision(0));
const REROLLED_REVISION = expectParsed(createVariantRevision(1));
const PARAMETERS: MarkerParameters = Object.freeze({
  markerCount: 9,
  edgeClearancePermille: 40,
});

const OUTLINE_OUTPUT: ProofOutlineOutput = Object.freeze({
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

const OUTLINE_INPUT = Object.freeze({
  reference: Object.freeze({ aspectId: OUTLINE_ASPECT_ID }),
  aspectName: OUTLINE_ASPECT_NAME,
  variantRevision: BASELINE_REVISION,
  acceptedOutput: OUTLINE_OUTPUT,
});

const markerGenerator: Generator<
  MarkerParameters,
  MarkerOutput,
  ProofOutlineOutput,
  ProofSeedMetadata,
  MarkerPlan
> = {
  manifest: createManifest(),
  plan(context, target): MarkerPlan {
    const outline = context.inputs.find((input) => input.reference.aspectId === OUTLINE_ASPECT_ID);
    if (outline === undefined) {
      throw new Error('Fake contract setup requires the accepted proof outline input.');
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
  ): GenerationProposal<MarkerParameters, MarkerOutput, ProofSeedMetadata> {
    const semanticKeys = Array.from({ length: parameters.markerCount }, (_, index) =>
      markerKey(parameters.markerCount - index - 1),
    );
    const markers = semanticKeys
      .map((semanticKey) => ({
        entityId: deriveStableId('entity', PROOF_ENTITY_ID, semanticKey),
        position: proofPoint(
          2_000 + (context.random.nextUint32() % 6_001),
          2_000 + (context.random.nextUint32() % 6_001),
        ),
      }))
      .sort((left, right) => compareStableReferences(left.entityId, right.entityId));

    return Object.freeze({
      status: 'proposed',
      target: plan.target,
      generatorId: MARKER_GENERATOR_ID,
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
  validate(proposal): readonly GenerationDiagnostic[] {
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
      if (!isStrictlyInsideProofOutline(marker.position)) {
        diagnostics.push(
          diagnostic(
            OUTSIDE_OUTLINE_CODE,
            `Marker ${String(marker.entityId)} is not strictly inside the accepted proof outline.`,
            'Regenerate the marker inside the accepted outline and declared edge clearance.',
          ),
        );
      }
    }
    return diagnostics.reverse();
  },
};

describe('generator contract', () => {
  it('declares the fixed proof manifest with opaque dependencies and narrow responsibility', () => {
    expect(markerGenerator.manifest).toStrictEqual({
      generatorId: MARKER_GENERATOR_ID,
      generatorVersion: GENERATOR_VERSION,
      parameterCompatibility: {
        currentVersion: PARAMETER_SCHEMA_VERSION,
        acceptedVersions: [PARAMETER_SCHEMA_VERSION],
      },
      inputAspects: [OUTLINE_ASPECT_NAME],
      outputAspects: [MARKER_ASPECT_NAME],
      seedScope: 'map/entity',
      validation: {
        owner: 'generator',
        diagnosticCodes: [INVALID_COUNT_CODE, OUTSIDE_OUTLINE_CODE],
      },
    });

    const plan = markerGenerator.plan(readContext(), target(BASELINE_REVISION));
    expect(plan.dependencyAspects).toStrictEqual([{ aspectId: OUTLINE_ASPECT_ID }]);
    expect(plan.dependencyAspects).not.toContain(OUTLINE_ASPECT_NAME);
  });

  it('repeats proposals exactly and changes only marker output across the fixed reroll', () => {
    const baseline = propose(BASELINE_REVISION);
    const repeatedBaseline = propose(BASELINE_REVISION);
    const rerolled = propose(REROLLED_REVISION);
    const repeatedReroll = propose(REROLLED_REVISION);

    expect(baseline).toStrictEqual(repeatedBaseline);
    expect(rerolled).toStrictEqual(repeatedReroll);
    expect(baseline.output).not.toStrictEqual(rerolled.output);
    expect(markerIds(baseline)).toStrictEqual(markerIds(rerolled));
    expect(markerIds(baseline)).toStrictEqual([...markerIds(baseline)].sort());
    expect(markerIds(baseline)).toStrictEqual(
      Array.from({ length: 9 }, (_, index) => markerId(index)).sort(),
    );
    expect(OUTLINE_INPUT).toStrictEqual({
      reference: { aspectId: OUTLINE_ASPECT_ID },
      aspectName: OUTLINE_ASPECT_NAME,
      variantRevision: BASELINE_REVISION,
      acceptedOutput: OUTLINE_OUTPUT,
    });
  });

  it('returns a complete proposed record without exposing a document commit capability', () => {
    const proposal = propose(REROLLED_REVISION);
    const validation = validateGenerationProposal(markerGenerator, proposal, validationContext());

    expect(validation.status).toBe('proposed');
    if (validation.status !== 'proposed') {
      throw new Error('Expected the valid fake proposal to remain proposed.');
    }

    expect(validation.proposal).toMatchObject({
      status: 'proposed',
      target: {
        mapId: WORLD_MAP_ID,
        entityId: PROOF_ENTITY_ID,
        aspect: { aspectId: MARKER_ASPECT_ID },
        aspectName: MARKER_ASPECT_NAME,
        variantRevision: REROLLED_REVISION,
      },
      generatorId: MARKER_GENERATOR_ID,
      generatorVersion: GENERATOR_VERSION,
      parameterSchemaVersion: PARAMETER_SCHEMA_VERSION,
      parameters: PARAMETERS,
      seedScope: 'map/entity',
      seedMetadata: {
        worldSeed: '81985529216486895',
        seedDerivationVersion: 1,
        variantRevision: REROLLED_REVISION,
      },
      dependencyAspects: [{ aspectId: OUTLINE_ASPECT_ID }],
      diagnostics: [],
    });
  });

  it('represents expected invalid output with actionable stable diagnostics in stable order', () => {
    const valid = propose(REROLLED_REVISION);
    const invalid: GenerationProposal<MarkerParameters, MarkerOutput, ProofSeedMetadata> = {
      ...valid,
      output: {
        markers: [
          {
            entityId: markerId(0),
            position: proofPoint(0, 0),
          },
        ],
      },
    };

    const first = validateGenerationProposal(markerGenerator, invalid, validationContext());
    const second = validateGenerationProposal(markerGenerator, invalid, validationContext());

    expect(first).toStrictEqual(second);
    expect(first.status).toBe('invalid');
    expect(first.diagnostics.map(({ code }) => code)).toStrictEqual([
      INVALID_COUNT_CODE,
      OUTSIDE_OUTLINE_CODE,
    ]);
    expect(first.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          target: { aspectId: MARKER_ASPECT_ID },
          suggestedAction: 'Generate exactly the requested number of stable marker identities.',
        }),
      ]),
    );
  });

  it('orders dependencies by opaque ID instead of input insertion order or aspect name', () => {
    const otherAspectId = expectParsed(
      parseStableId('aspect', '11111111-1111-4111-8111-111111111111'),
    );
    const forward = orderAspectReferences([
      { aspectId: OUTLINE_ASPECT_ID },
      { aspectId: otherAspectId },
    ]);
    const reverse = orderAspectReferences([...forward].reverse());

    expect(reverse).toStrictEqual(forward);
    expect(reverse.map(({ aspectId }) => aspectId)).toStrictEqual([
      otherAspectId,
      OUTLINE_ASPECT_ID,
    ]);
  });
});

function createManifest(): GeneratorManifest {
  return Object.freeze({
    generatorId: MARKER_GENERATOR_ID,
    generatorVersion: GENERATOR_VERSION,
    parameterCompatibility: Object.freeze({
      currentVersion: PARAMETER_SCHEMA_VERSION,
      acceptedVersions: Object.freeze([PARAMETER_SCHEMA_VERSION]),
    }),
    inputAspects: Object.freeze([OUTLINE_ASPECT_NAME]),
    outputAspects: Object.freeze([MARKER_ASPECT_NAME]),
    seedScope: 'map/entity',
    validation: Object.freeze({
      owner: 'generator',
      diagnosticCodes: Object.freeze([INVALID_COUNT_CODE, OUTSIDE_OUTLINE_CODE]),
    }),
  });
}

function propose(
  revision: VariantRevision,
): GenerationProposal<MarkerParameters, MarkerOutput, ProofSeedMetadata> {
  const targetValue = target(revision);
  const context = generationContext(revision);
  const plan = markerGenerator.plan(context, targetValue);
  return markerGenerator.generate(context, plan, PARAMETERS);
}

function target(variantRevision: VariantRevision): GenerationTarget {
  return Object.freeze({
    mapId: WORLD_MAP_ID,
    entityId: PROOF_ENTITY_ID,
    aspect: Object.freeze({ aspectId: MARKER_ASPECT_ID }),
    aspectName: MARKER_ASPECT_NAME,
    variantRevision,
  });
}

function readContext(): GenerationReadContext<ProofOutlineOutput> {
  return Object.freeze({ inputs: Object.freeze([OUTLINE_INPUT]) });
}

function generationContext(
  revision: VariantRevision,
): GenerationContext<ProofOutlineOutput, ProofSeedMetadata> {
  return Object.freeze({
    ...readContext(),
    seedMetadata: Object.freeze({
      worldSeed: '81985529216486895',
      seedDerivationVersion: 1,
      variantRevision: revision,
    }),
    random: streamForRevision(revision),
  });
}

function validationContext(): GenerationValidationContext<ProofOutlineOutput> {
  return Object.freeze({ ...readContext(), target: target(REROLLED_REVISION) });
}

function streamForRevision(revision: VariantRevision): DeterministicRandomStream {
  let index = 0;
  const offset = revision === BASELINE_REVISION ? 17 : 4_099;
  return Object.freeze({
    nextUint32(): number {
      const value = (offset + index * 2_654_435_761) >>> 0;
      index += 1;
      return value;
    },
  });
}

function markerKey(index: number): SemanticKey {
  return expectParsed(parseSemanticKey(`marker-${String(index).padStart(3, '0')}`));
}

function markerId(index: number): EntityId {
  return deriveStableId('entity', PROOF_ENTITY_ID, markerKey(index));
}

function markerIds(
  proposal: GenerationProposal<MarkerParameters, MarkerOutput, ProofSeedMetadata>,
): readonly EntityId[] {
  return proposal.output.markers.map(({ entityId }) => entityId);
}

function proofPoint(x: number, y: number): PlanetPoint {
  const input = expectParsed(createProofInputPoint(x, y));
  return expectParsed(proofInputToPlanetTransform.forward(input));
}

function isStrictlyInsideProofOutline(point: PlanetPoint): boolean {
  const minimumTick = (1_000 - 5_000) * 65_536;
  const maximumTick = (9_000 - 5_000) * 65_536;
  return (
    point.longitudeTicks > minimumTick &&
    point.longitudeTicks < maximumTick &&
    point.latitudeTicks > minimumTick &&
    point.latitudeTicks < maximumTick
  );
}

function diagnostic(
  code: GenerationDiagnosticCode,
  message: string,
  suggestedAction: string,
): GenerationDiagnostic {
  return {
    code,
    severity: 'error',
    target: { aspectId: MARKER_ASPECT_ID },
    message,
    suggestedAction,
  };
}

function expectParsed<Value>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly diagnostic: unknown },
): Value {
  if (!result.ok) {
    throw new Error(`Expected fixed contract value to parse: ${JSON.stringify(result.diagnostic)}`);
  }
  return result.value;
}

void [
  OUTLINE_ASPECT_ID satisfies AspectId,
  OUTLINE_ASPECT_NAME satisfies AspectName,
  MARKER_GENERATOR_ID satisfies GeneratorId,
  WORLD_MAP_ID satisfies MapId,
];
