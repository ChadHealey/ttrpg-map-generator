/** Reusable generation and invariant-mutation helpers for the accepted-atlas integration suite. */

import {
  type AspectReplacementProposal,
  ATLAS_DOCUMENT_COMMAND_KIND,
  ATLAS_DOCUMENT_OPERATION_MODES,
  type AtlasControls,
  type AtlasStyleProvenance,
  type AtlasWaterDecoration,
  commitAtlasProposal,
  CONSTRAINT_KINDS,
  type ConstraintId,
  DEFAULT_ATLAS_CONTROLS,
  type LockId,
  parseStableId,
  type WorldDocument,
} from '@ttrpg-map/core';

import { mutateAspect } from './atlas-persistence-integration-support.js';
import { MILESTONE_TWO_ATLAS_PROOF_SEED } from './atlas-workflow.js';
import {
  type AcceptedAtlasState,
  type AtlasWorkflowRuntime,
  productionAtlasWorkflowGeneration,
} from './atlas-workflow-generation.js';
import { retainedAspectProposal } from './atlas-workflow-generation-support.js';

export function recommitAppearance(
  accepted: AcceptedAtlasState,
  mutate: (proposal: AspectReplacementProposal) => AspectReplacementProposal,
) {
  const root = accepted.document.maps[0];
  if (root?.mapKind !== 'world') throw new Error('Accepted atlas root map is missing.');
  const proposedAspects = Object.freeze(root.aspects.map(retainedAspectProposal).map(mutate));
  return commitAtlasProposal(accepted.document, {
    kind: ATLAS_DOCUMENT_COMMAND_KIND,
    operationMode: ATLAS_DOCUMENT_OPERATION_MODES.controls,
    targetMapId: root.mapId,
    expectedWorldSeed: accepted.document.worldSeed,
    expectedAspectRevisions: Object.freeze(
      root.aspects.map(({ aspectId, variantRevision }) =>
        Object.freeze({ aspectId, variantRevision }),
      ),
    ),
    controls: accepted.geography.controls,
    proposedCoordinateSystem: root.coordinateSystem,
    proposedEntities: root.entities,
    proposedAspects,
    explicitlyIncrementedAspectIds: Object.freeze([]),
  });
}

export function addUnknownDecorationKind(
  proposal: AspectReplacementProposal,
): AspectReplacementProposal {
  if (proposal.target.aspectName !== 'atlas.waterDecoration') return proposal;
  const output = proposal.output as AtlasWaterDecoration;
  const echo = output.paths.find(({ kind }) => kind === 'coastal-echo');
  if (echo === undefined) throw new Error('Expected a coastal echo test source.');
  const unknownPath = Object.freeze({
    ...echo,
    decorationId: `${echo.decorationId}/unknown`,
    kind: 'shoal-hatching',
  });
  return withOutput(proposal, {
    ...output,
    paths: Object.freeze([...output.paths, unknownPath]),
  });
}

export function invalidStyleId(proposal: AspectReplacementProposal): AspectReplacementProposal {
  return withInvalidStyle(
    proposal,
    Object.freeze({
      styleId: ' Invalid Style ',
      styleBehaviorVersion: 1,
    }),
  );
}

export function unsupportedStyleVersion(
  proposal: AspectReplacementProposal,
): AspectReplacementProposal {
  return withInvalidStyle(
    proposal,
    Object.freeze({
      styleId: 'future-atlas-style',
      styleBehaviorVersion: 2,
    }),
  );
}

export function addSeamJump(proposal: AspectReplacementProposal): AspectReplacementProposal {
  if (proposal.target.aspectName !== 'atlas.waterDecoration') return proposal;
  const output = proposal.output as AtlasWaterDecoration;
  const source = output.paths[0];
  const first = source?.points[0];
  const second = source?.points[1];
  if (source === undefined || first === undefined || second === undefined) {
    throw new Error('Expected a water-decoration path test source.');
  }
  const mutatedPath = Object.freeze({
    ...source,
    points: Object.freeze([
      Object.freeze({ ...first, longitudeTicks: -(2 ** 31) }),
      Object.freeze({ ...second, longitudeTicks: 2 ** 31 - 1 }),
      ...source.points.slice(2),
    ]),
  });
  return withOutput(proposal, {
    ...output,
    paths: Object.freeze([mutatedPath, ...output.paths.slice(1)]),
  });
}

export async function commitGeneratedAtlas(
  operation:
    'initial-atlas' | 'control-driven-replacement' | 'geography-reroll' | 'appearance-reroll',
  accepted?: AcceptedAtlasState,
  controls: AtlasControls = DEFAULT_ATLAS_CONTROLS,
  runtime?: AtlasWorkflowRuntime,
): Promise<AcceptedAtlasState> {
  const result = await attemptAtlasGeneration(operation, accepted, controls, runtime);
  if (!result.ok) throw new Error(`${result.diagnosticCodes.join(',')}: ${result.message}`);
  return result.accepted;
}

export async function attemptAtlasGeneration(
  operation:
    'initial-atlas' | 'control-driven-replacement' | 'geography-reroll' | 'appearance-reroll',
  accepted?: AcceptedAtlasState,
  controls: AtlasControls = DEFAULT_ATLAS_CONTROLS,
  runtime: AtlasWorkflowRuntime = {
    isCancellationRequested: () => false,
    reportProgress: () => undefined,
    yieldControl: () => Promise.resolve(),
  },
) {
  return productionAtlasWorkflowGeneration.commit(
    {
      operationId: `test:${operation}`,
      operation,
      worldSeed: MILESTONE_TWO_ATLAS_PROOF_SEED,
      controls,
      accepted,
    },
    runtime,
  );
}

export function acceptedAspectRevision(
  accepted: AcceptedAtlasState,
  name: string,
): number | undefined {
  return accepted.document.maps[0]?.aspects.find(({ aspectName }) => aspectName === name)
    ?.variantRevision;
}

export function withAcceptedDiagnostic(
  document: WorldDocument,
  targetAspectId: WorldDocument['maps'][number]['aspects'][number]['aspectId'],
  severity: 'error' | 'warning',
  code: WorldDocument['maps'][number]['aspects'][number]['diagnostics'][number]['code'],
): WorldDocument {
  return mutateAspect(document, 'atlas.paperTreatment', (aspect) => ({
    ...aspect,
    diagnostics: Object.freeze([
      Object.freeze({
        code,
        severity,
        target: Object.freeze({ aspectId: targetAspectId }),
        message: 'Focused accepted atlas diagnostic invariant mutation.',
        suggestedAction: 'Restore the accepted diagnostic envelope.',
      }),
    ]),
  }));
}

export function protectPaperTreatment(
  accepted: AcceptedAtlasState,
  kind: 'constraint' | 'lock',
): AcceptedAtlasState {
  const root = accepted.document.maps[0];
  const paper = root?.aspects.find(({ aspectName }) => aspectName === 'atlas.paperTreatment');
  if (root?.mapKind !== 'world' || paper === undefined) throw new Error('Missing paper treatment.');
  const protectedRoot = Object.freeze({
    ...root,
    constraints:
      kind === 'constraint'
        ? Object.freeze([
            Object.freeze({
              constraintId: constraintId(),
              constraintKind: CONSTRAINT_KINDS.proofKeepWithinExtent,
              target: Object.freeze({ aspectId: paper.aspectId }),
              parameters: Object.freeze({}),
            }),
          ])
        : root.constraints,
    locks:
      kind === 'lock'
        ? Object.freeze([
            Object.freeze({
              lockId: lockId(),
              target: Object.freeze({ aspectId: paper.aspectId }),
            }),
          ])
        : root.locks,
  });
  return Object.freeze({
    ...accepted,
    document: Object.freeze({ ...accepted.document, maps: Object.freeze([protectedRoot]) }),
  });
}

function withInvalidStyle(
  proposal: AspectReplacementProposal,
  style: Readonly<{ readonly styleId: string; readonly styleBehaviorVersion: number }>,
): AspectReplacementProposal {
  if (!proposal.target.aspectName.startsWith('atlas.')) return proposal;
  return withOutput(proposal, {
    ...(proposal.output as object),
    style: style as unknown as AtlasStyleProvenance,
  });
}

function withOutput(
  proposal: AspectReplacementProposal,
  output: unknown,
): AspectReplacementProposal {
  return Object.freeze({ ...proposal, output });
}

function lockId(): LockId {
  const parsed = parseStableId('lock', '1562f399-119d-4702-aafd-66349098c85f');
  if (!parsed.ok) throw new Error(parsed.diagnostic.message);
  return parsed.value;
}

function constraintId(): ConstraintId {
  const parsed = parseStableId('constraint', 'ac35a7ae-3f2c-4433-9351-e23d52c65870');
  if (!parsed.ok) throw new Error(parsed.diagnostic.message);
  return parsed.value;
}
