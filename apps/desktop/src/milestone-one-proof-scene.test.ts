import type { RenderPolygon } from '@ttrpg-map/core';
import {
  createMilestoneOneProofDocument,
  MILESTONE_ONE_PROOF_ENTITY_ID,
  MILESTONE_ONE_PROOF_SEED,
  milestoneOneProofAspects,
  rerollMilestoneOneMarkers,
} from '@ttrpg-map/generation';
import { describe, expect, it } from 'vitest';

import { createMilestoneOneProofScene } from './milestone-one-proof-scene.js';

describe('Milestone 1 proof scene', () => {
  it('maps accepted PlanetPoints to one outline and stable ordered marker primitives', () => {
    const baseline = createMilestoneOneProofDocument(MILESTONE_ONE_PROOF_SEED);
    const scene = sceneFor(baseline);
    const outline = scene.nodes[1];
    const markers = scene.nodes.slice(2);

    expect(outline).toMatchObject({
      id: 'milestone-one-proof-outline',
      kind: 'polygon',
      sourceId: MILESTONE_ONE_PROOF_ENTITY_ID,
    });
    expect((outline as RenderPolygon).points).toHaveLength(9);
    expect(markers).toHaveLength(9);
    expect(markers.every(({ kind }) => kind === 'polygon')).toBe(true);
    expect(markers.every(({ sourceId }) => sourceId === MILESTONE_ONE_PROOF_ENTITY_ID)).toBe(true);
    expect(markers.map(({ id }) => id)).toStrictEqual([...markers.map(({ id }) => id)].sort());
  });

  it('changes only marker geometry on reroll and reproduces the same revision-one scene', () => {
    const baseline = createMilestoneOneProofDocument(MILESTONE_ONE_PROOF_SEED);
    const first = rerollMilestoneOneMarkers(baseline);
    const repeated = rerollMilestoneOneMarkers(baseline);
    expect(first.ok).toBe(true);
    expect(repeated.ok).toBe(true);
    if (!first.ok || !repeated.ok) throw new Error('Expected marker reroll to commit.');

    const baselineScene = sceneFor(baseline);
    const rerolledScene = sceneFor(first.document);
    const repeatedScene = sceneFor(repeated.document);
    expect(rerolledScene).toStrictEqual(repeatedScene);
    expect(rerolledScene.nodes[1]).toStrictEqual(baselineScene.nodes[1]);
    expect(rerolledScene.nodes.slice(2).map(({ id }) => id)).toStrictEqual(
      baselineScene.nodes.slice(2).map(({ id }) => id),
    );
    expect(rerolledScene.nodes.slice(2)).not.toStrictEqual(baselineScene.nodes.slice(2));
  });
});

function sceneFor(document: ReturnType<typeof createMilestoneOneProofDocument>) {
  const aspects = milestoneOneProofAspects(document);
  return createMilestoneOneProofScene({
    sourceEntityId: MILESTONE_ONE_PROOF_ENTITY_ID,
    outline: aspects.outline.acceptedOutput.points,
    markers: aspects.markers.acceptedOutput.markers,
  });
}
