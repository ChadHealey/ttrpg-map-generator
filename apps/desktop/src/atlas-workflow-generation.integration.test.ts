import {
  type AtlasControls,
  CONSTRAINT_KINDS,
  type ConstraintId,
  DEFAULT_ATLAS_CONTROLS,
  type LockId,
  parseStableId,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import { MILESTONE_TWO_ATLAS_PROOF_SEED } from './atlas-workflow.js';
import {
  type AcceptedAtlasState,
  type AtlasWorkflowRuntime,
  productionAtlasWorkflowGeneration,
} from './atlas-workflow-generation.js';

describe('complete Milestone 2 atlas proposal transaction', () => {
  it('accepts control replacement and proves geography/appearance reroll isolation', async () => {
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
  }, 180_000);
});

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
