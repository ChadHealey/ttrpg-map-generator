import {
  type AspectReplacementProposal,
  ATLAS_DOCUMENT_COMMAND_KIND,
  ATLAS_DOCUMENT_OPERATION_MODES,
  ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES,
  type AtlasControls,
  type AtlasStyleProvenance,
  type AtlasWaterDecoration,
  commitAtlasProposal,
  CONSTRAINT_KINDS,
  type ConstraintId,
  DEFAULT_ATLAS_CONTROLS,
  type LockId,
  parseStableId,
} from '@ttrpg-map/core';
import { beforeAll, describe, expect, it } from 'vitest';

import { MILESTONE_TWO_ATLAS_PROOF_SEED } from './atlas-workflow.js';
import {
  type AcceptedAtlasState,
  type AtlasWorkflowRuntime,
  productionAtlasWorkflowGeneration,
} from './atlas-workflow-generation.js';
import { retainedAspectProposal } from './atlas-workflow-generation-support.js';

interface GeneratedAtlasStates {
  readonly baseline: AcceptedAtlasState;
  readonly controlled: AcceptedAtlasState;
  readonly geography: AcceptedAtlasState;
  readonly appearance: AcceptedAtlasState;
  readonly changedControls: AtlasControls;
  readonly appearanceProgress: readonly string[];
}

let generatedStates: GeneratedAtlasStates | undefined;

describe('complete Milestone 2 atlas proposal transaction', () => {
  beforeAll(async () => {
    const baseline = await commit('initial-atlas');
    const changedControls = Object.freeze({
      ...DEFAULT_ATLAS_CONTROLS,
      targetWaterCoveragePercent: 66,
    });
    const controlled = await commit('control-driven-replacement', baseline, changedControls);
    const geography = await commit('geography-reroll', controlled, changedControls);
    const appearanceProgress: string[] = [];
    const appearance = await commit('appearance-reroll', geography, changedControls, {
      isCancellationRequested: () => false,
      reportProgress: ({ stage }) => appearanceProgress.push(stage),
      yieldControl: () => Promise.resolve(),
    });
    generatedStates = Object.freeze({
      baseline,
      controlled,
      geography,
      appearance,
      changedControls,
      appearanceProgress: Object.freeze(appearanceProgress),
    });
  }, 180_000);

  it('accepts control replacement and proves geography/appearance reroll isolation', async () => {
    const { appearance, appearanceProgress, baseline, changedControls, controlled, geography } =
      requiredGeneratedStates();

    expect(revision(baseline, 'worldTerrain.macroElevation')).toBe(0);
    expect(revision(controlled, 'worldTerrain.macroElevation')).toBe(0);
    expect(revision(geography, 'worldTerrain.macroElevation')).toBe(1);
    expect(revision(appearance, 'worldTerrain.macroElevation')).toBe(1);
    for (const name of [
      'atlas.coastlineAppearance',
      'atlas.paperTreatment',
      'atlas.waterDecoration',
    ]) {
      expect(revision(baseline, name)).toBe(0);
      expect(revision(controlled, name)).toBe(0);
      expect(revision(geography, name)).toBe(0);
      expect(revision(appearance, name)).toBe(1);
    }
    expect(appearance.geography).toEqual(geography.geography);
    expect(geography.appearance.paperTreatment).toEqual(controlled.appearance.paperTreatment);
    expect(controlled.geography.controls.targetWaterCoveragePercent).toBe(66);
    expect(controlled.document.maps[0]?.coordinateSystem.radius).not.toBeUndefined();
    expect(appearanceProgress).toStrictEqual(['validating-proposal', 'completed']);

    const locked = protectPaperTreatment(appearance, 'lock');
    const lockedResult = await attempt('appearance-reroll', locked, changedControls);
    expect(lockedResult).toMatchObject({
      ok: false,
      diagnosticCodes: ['atlas-transaction.lock.conflict'],
    });
    expect(locked.document.maps[0]?.locks).toHaveLength(1);

    const constrained = protectPaperTreatment(appearance, 'constraint');
    const constrainedResult = await attempt('appearance-reroll', constrained, changedControls);
    expect(constrainedResult).toMatchObject({
      ok: false,
      diagnosticCodes: ['atlas-transaction.constraint.conflict'],
    });
    expect(constrained.document.maps[0]?.constraints).toHaveLength(1);
  }, 30_000);

  it('accepts a valid unchanged complete proposal through the exported core boundary', () => {
    const { appearance } = requiredGeneratedStates();
    expect(recommitAppearance(appearance, (proposal) => proposal).ok).toBe(true);
  }, 15_000);

  it.each([
    ['an unknown water-decoration kind', addUnknownDecorationKind],
    ['an invalid style semantic key', invalidStyleId],
    ['an unsupported style behavior version', unsupportedStyleVersion],
    ['a seam-jumping decoration segment', addSeamJump],
  ] as const)(
    'rejects %s at commitAtlasProposal',
    (_label, mutate) => {
      const { appearance } = requiredGeneratedStates();
      const result = recommitAppearance(appearance, mutate);

      expect(result.ok).toBe(false);
      expect(result.document).toBe(appearance.document);
      if (result.ok) throw new Error('Invalid runtime appearance unexpectedly committed.');
      expect(result.diagnostics.map(({ code }) => code)).toContain(
        ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.invalidProposal,
      );
    },
    15_000,
  );
});

function requiredGeneratedStates(): GeneratedAtlasStates {
  if (generatedStates === undefined) throw new Error('Atlas integration setup did not complete.');
  return generatedStates;
}

function recommitAppearance(
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

function addUnknownDecorationKind(proposal: AspectReplacementProposal): AspectReplacementProposal {
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

function invalidStyleId(proposal: AspectReplacementProposal): AspectReplacementProposal {
  return withInvalidStyle(
    proposal,
    Object.freeze({
      styleId: ' Invalid Style ',
      styleBehaviorVersion: 1,
    }),
  );
}

function unsupportedStyleVersion(proposal: AspectReplacementProposal): AspectReplacementProposal {
  return withInvalidStyle(
    proposal,
    Object.freeze({
      styleId: 'future-atlas-style',
      styleBehaviorVersion: 2,
    }),
  );
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

function addSeamJump(proposal: AspectReplacementProposal): AspectReplacementProposal {
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

function withOutput(
  proposal: AspectReplacementProposal,
  output: unknown,
): AspectReplacementProposal {
  return Object.freeze({ ...proposal, output });
}

async function commit(
  operation:
    'initial-atlas' | 'control-driven-replacement' | 'geography-reroll' | 'appearance-reroll',
  accepted?: AcceptedAtlasState,
  controls: AtlasControls = DEFAULT_ATLAS_CONTROLS,
  runtime?: AtlasWorkflowRuntime,
): Promise<AcceptedAtlasState> {
  const result = await attempt(operation, accepted, controls, runtime);
  if (!result.ok) throw new Error(`${result.diagnosticCodes.join(',')}: ${result.message}`);
  return result.accepted;
}

async function attempt(
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

function revision(accepted: AcceptedAtlasState, name: string): number | undefined {
  return accepted.document.maps[0]?.aspects.find(({ aspectName }) => aspectName === name)
    ?.variantRevision;
}

function protectPaperTreatment(
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
