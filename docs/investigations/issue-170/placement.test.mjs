import { describe, expect, it } from 'vitest';

import {
  angle,
  dot,
  GAP_RAD,
  GAP_SLACK_RAD,
  MAX_ATTEMPTS,
  MAX_CENTER_EVALUATIONS,
  placeOwners,
  REFINEMENT_SWEEPS,
  sphericalCode,
} from './placement.mjs';

const ownersOf = (radii) =>
  radii.map((radius, i) => ({
    id: `owner-${i}`,
    radius,
    quota: 0.4 / radii.length,
    candidate: { marker: `retained-${i}`, coordinates: [[0.1, 0.2]] },
  }));
function expectValid(result, source) {
  expect(result.ok, JSON.stringify(result.failures)).toBe(true);
  expect(result.owners).toHaveLength(source.length);
  expect(result.candidateCount).toBeLessThanOrEqual(MAX_CENTER_EVALUATIONS);
  expect(result.refinementProposals).toBe(REFINEMENT_SWEEPS * source.length);
  expect(result.initialCandidateCount + result.refinementProposals).toBe(result.candidateCount);
  for (const owner of result.owners) {
    const original = source.find((p) => p.id === owner.id);
    expect(owner.radius).toBe(original.radius);
    expect(owner.quota).toBe(original.quota);
    expect(owner.candidate).toEqual(original.candidate);
    for (const axis of [owner.center, owner.east, owner.north])
      expect(Math.hypot(...axis)).toBeCloseTo(1, 13);
    expect(Math.abs(dot(owner.center, owner.east))).toBeLessThan(1e-13);
    expect(Math.abs(dot(owner.center, owner.north))).toBeLessThan(1e-13);
    expect(Math.abs(dot(owner.east, owner.north))).toBeLessThan(1e-13);
  }
  for (let i = 0; i < result.owners.length; i++)
    for (let j = i + 1; j < result.owners.length; j++) {
      const a = result.owners[i],
        b = result.owners[j];
      expect(angle(a.center, b.center)).toBeGreaterThanOrEqual(
        a.radius + b.radius + GAP_RAD + GAP_SLACK_RAD,
      );
    }
}
const shapeSignature = (result) =>
  result.pairs
    .map((p) => p.distance.toFixed(9))
    .sort()
    .join(',');

describe('issue-170 bounded spherical placement', () => {
  it('defines finite code candidates with the declared bipyramid slot order', () => {
    for (let count = 1; count <= 8; count++) {
      const code = sphericalCode(count);
      expect(code).toHaveLength(count);
      for (const p of code) expect(Math.hypot(...p)).toBeCloseTo(1, 14);
    }
    expect(
      sphericalCode(5)
        .slice(0, 3)
        .every((p) => p[2] === 0),
    ).toBe(true);
    expect(sphericalCode(7).slice(0, 2)).toEqual([
      [0, 0, 1],
      [0, 0, -1],
    ]);
    expect(() => sphericalCode(9)).toThrow();
  });
  it('places the retained six equal radii using guided candidates without a lucky retry', () => {
    const owners = ownersOf(Array(6).fill(0.753263404553327));
    for (const seed of ['1', '8675309', 'connected-majority']) {
      const result = placeOwners(owners, seed);
      expectValid(result, owners);
      expect(result.attempts).toBe(1);
      expect(result.initialCandidateCount).toBe(6);
      expect(result.guidedInitialAttempt).toBe(true);
      expect(result.refinementAccepted).toBeGreaterThan(0);
      expect(result.minimumGap).toBeGreaterThanOrEqual(GAP_RAD);
    }
  });
  it('keeps bounded asymmetric spacing in addition to seed-dependent world rotation', () => {
    for (const radii of [Array(6).fill(0.753263404553327), [0.92714, 0.92714, 0.5548, 0.5548]]) {
      const owners = ownersOf(radii);
      const results = ['1', '2', '3', '4'].map((seed) => placeOwners(owners, seed));
      results.forEach((result) => expectValid(result, owners));
      expect(new Set(results.map(shapeSignature)).size).toBeGreaterThan(1);
    }
  });
  it('repeats deterministically, ignores input array order and preserves nested input geometry', () => {
    const owners = ownersOf([0.829532, 0.829532, 0.829532, 0.500719]);
    const before = structuredClone(owners),
      result = placeOwners(owners, '17');
    expectValid(result, owners);
    expect(placeOwners(owners, '17')).toEqual(result);
    expect(placeOwners([...owners].reverse(), '17')).toEqual(result);
    expect(owners).toEqual(before);
    result.owners[0].candidate.coordinates[0][0] = 99;
    expect(owners).toEqual(before);
  });
  it('retains a nearly tight octahedral solution when large refinement moves cannot fit', () => {
    const radius = (Math.PI / 2 - GAP_RAD) / 2 - 1e-7;
    const owners = ownersOf(Array(6).fill(radius)),
      result = placeOwners(owners, 'near-limit');
    expectValid(result, owners);
    expect(result.initialCandidateCount).toBe(6);
    expect(result.refinementAccepted).toBeLessThan(result.refinementProposals);
  });
  it('reports a pair-capacity proof before search without modifying owners', () => {
    const owners = ownersOf([1.7, 1.6]),
      before = structuredClone(owners);
    const result = placeOwners(owners, 'impossible');
    expect(result.ok).toBe(false);
    expect(result.failures[0]).toMatchObject({
      code: 'placement.pair-capacity',
      proof: 'pair-caps-cannot-fit',
    });
    expect(result.candidateCount).toBe(0);
    expect(result.owners).toEqual([]);
    expect(owners).toEqual(before);
  });
  it('bounds search exhaustion without calling the heuristic a global impossibility proof', () => {
    const owners = ownersOf(Array(5).fill(1)),
      before = structuredClone(owners);
    const result = placeOwners(owners, 'bounded-exhaustion');
    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(MAX_ATTEMPTS);
    expect(result.candidateCount).toBeLessThanOrEqual(MAX_CENTER_EVALUATIONS);
    expect(result.refinementProposals).toBe(0);
    expect(result.failures.at(-1)).toEqual({
      code: 'placement.search-exhausted',
      proof: 'search-only-not-infeasibility',
    });
    expect(result.owners).toEqual([]);
    expect(owners).toEqual(before);
  });
  it('keeps the one-owner pair check vacuous and rejects malformed inputs before work', () => {
    const owners = ownersOf([1.2]),
      result = placeOwners(owners, 'single');
    expectValid(result, owners);
    expect(result.minimumGap).toBe(null);
    for (const invalid of [
      [],
      [null],
      ownersOf(Array(9).fill(0.2)),
      ownersOf([NaN]),
      [
        { id: 'x', radius: 0.2 },
        { id: 'x', radius: 0.3 },
      ],
    ]) {
      expect(placeOwners(invalid, 'invalid').failures[0].code).toBe('placement.invalid-input');
    }
    for (const seed of [null, undefined, '', 1, 1n, ['1'], {}, true]) {
      const rejected = placeOwners(owners, seed);
      expect(rejected.failures[0].code).toBe('placement.invalid-input');
      expect(rejected.candidateCount).toBe(0);
    }
    expectValid(placeOwners(owners, 'opaque seed beyond numeric ranges'), owners);
  });
});
