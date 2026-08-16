import { type EntityId, type MapId, parseStableId } from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import {
  type AtlasIslandGroupCandidate,
  classifyAtlasIslandGroups,
} from './atlas-semantic-island-groups.js';

const WORLD_MAP_ID = stable('map', '00000000-0000-4000-8000-000000000001');

describe('atlas island group relationships', () => {
  it('preserves kind, membership, chain order, and IDs across input insertion order', () => {
    const candidates: readonly AtlasIslandGroupCandidate[] = [
      candidate(1, 1, 0, 0),
      candidate(2, 0.99, 0.08, 0),
      candidate(3, 0, 1, 0),
      candidate(4, -0.8, 0.6, 0),
      candidate(5, -1, 0, 0),
    ];
    const forward = classifyAtlasIslandGroups(WORLD_MAP_ID, candidates, 100);
    const reversed = classifyAtlasIslandGroups(WORLD_MAP_ID, [...candidates].reverse(), 100);
    expect(reversed).toStrictEqual(forward);
    expect(forward.map(({ kind }) => kind).sort()).toStrictEqual(['archipelago', 'islandChain']);
    const members = forward.flatMap(({ memberLandmassIds }) => memberLandmassIds);
    expect(new Set(members).size).toBe(members.length);
  });
});

function candidate(value: number, x: number, y: number, z: number): AtlasIslandGroupCandidate {
  const length = Math.hypot(x, y, z);
  return Object.freeze({
    entityId: stable('entity', `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`),
    centroid: Object.freeze({ x: x / length, y: y / length, z: z / length }),
  });
}

function stable(kind: 'entity', value: string): EntityId;
function stable(kind: 'map', value: string): MapId;
function stable(kind: 'entity' | 'map', value: string): EntityId | MapId {
  const parsed = parseStableId(kind, value);
  if (!parsed.ok) throw new Error(parsed.diagnostic.message);
  return parsed.value;
}
