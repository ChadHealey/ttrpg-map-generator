import { describe, expect, it } from 'vitest';

import { spherePoint } from '../issue-164/morphology.mjs';
import { createPlacedField } from './field.mjs';
import { inverseLambert } from './geometry.mjs';
import {
  angle,
  DIRECTIONS_PER_OWNER,
  dot,
  EXTENSION_RAD,
  GAP_RAD,
  MAX_ATTEMPTS,
  placeOwners,
} from './placement.mjs';

// These small polygons test evaluation only; they do not claim continental certification.
const square = (x, y, width) => [
  [x - width / 2, y - width / 2],
  [x + width / 2, y - width / 2],
  [x + width / 2, y + width / 2],
  [x - width / 2, y + width / 2],
];
const candidate = {
  bodyBoundary: square(0, 0, 0.4),
  islands: [{ id: 'margin-island', kind: 'island', polygon: square(0.45, 0, 0.05) }],
};
const owner = {
  id: 'owner-a',
  radius: 0.6,
  candidate,
  center: [0, 0, 1],
  east: [1, 0, 0],
  north: [0, 1, 0],
};
const input = { seed: '169', controls: {} };

describe('bounded revision-private spherical placement', () => {
  it('repeats frames, preserves all owner IDs, and checks every cap pair', () => {
    const owners = ['b', 'a', 'c', 'd'].map((id, index) => ({
      id,
      radius: 0.24 + index * 0.02,
      candidate,
    }));
    const first = placeOwners(owners, '169');
    expect(first.ok).toBe(true);
    expect(first).toEqual(placeOwners(owners, '169'));
    expect(first).toEqual(placeOwners([...owners].reverse(), '169'));
    expect(first.owners.map(({ id }) => id)).toEqual(['a', 'b', 'c', 'd']);
    expect(first.candidateCount).toBeLessThanOrEqual(
      MAX_ATTEMPTS * owners.length * DIRECTIONS_PER_OWNER,
    );
    for (const [i, placed] of first.owners.entries()) {
      expect(dot(placed.center, placed.east)).toBeCloseTo(0, 14);
      expect(dot(placed.center, placed.north)).toBeCloseTo(0, 14);
      expect(dot(placed.east, placed.north)).toBeCloseTo(0, 14);
      for (const other of first.owners.slice(i + 1))
        expect(angle(placed.center, other.center)).toBeGreaterThanOrEqual(
          placed.radius + other.radius + GAP_RAD,
        );
    }
    expect(first.owners).not.toEqual(placeOwners(owners, '170').owners);
  });

  it('rejects an impossible cap pair without retries or radius changes', () => {
    const result = placeOwners(
      [
        { ...owner, id: 'a', radius: 1.6 },
        { ...owner, id: 'b', radius: 1.6 },
      ],
      '169',
    );
    expect(result).toMatchObject({ ok: false, owners: [], attempts: 0, candidateCount: 0 });
    expect(result.failures[0]).toMatchObject({
      code: 'placement.pair-capacity',
      proof: 'pair-caps-cannot-fit',
    });
  });

  it('reports bounded search exhaustion separately from a proof of impossibility', () => {
    // Three caps require pair distances above 2π/3, but the inexpensive pair check alone passes.
    const owners = ['a', 'b', 'c'].map((id) => ({ ...owner, id, radius: 1.05 }));
    const result = placeOwners(owners, '169');
    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(MAX_ATTEMPTS);
    expect(result.candidateCount).toBeLessThanOrEqual(MAX_ATTEMPTS * 3 * DIRECTIONS_PER_OWNER);
    expect(result.failures.at(-1)).toEqual({
      code: 'placement.search-exhausted',
      proof: 'search-only-not-infeasibility',
    });
    expect(result).toEqual(placeOwners(owners, '169'));
  });
});

describe('fixed-zero continuous experimental field', () => {
  it('takes the continuous maximum in water while retaining positive land from every owner', () => {
    const opposite = {
        ...owner,
        id: 'owner-b',
        center: [0, 0, -1],
        north: [0, -1, 0],
      },
      field = createPlacedField([owner, opposite], input),
      first = createPlacedField([owner], input),
      second = createPlacedField([opposite], input);
    expect(field.raw(owner.center)).toMatchObject({ owner: 0, guarded: true });
    expect(field.raw(opposite.center)).toMatchObject({ owner: 1, guarded: true });
    for (let step = -8; step <= 8; step++) {
      const point = spherePoint(0, step / 1000);
      expect(field.evaluate(point)).toBe(Math.max(first.evaluate(point), second.evaluate(point)));
      expect(field.evaluate(point)).toBeLessThan(0);
    }
    expect(field.raw([1, 0, 0]).owner).toBe(0);
    const left = field.evaluate(spherePoint(0, -1e-7)),
      center = field.evaluate([1, 0, 0]),
      right = field.evaluate(spherePoint(0, 1e-7));
    expect(Math.abs(left - center)).toBeLessThan(2e-7);
    expect(Math.abs(right - center)).toBeLessThan(2e-7);
  });

  it('keeps body/islands positive, channels negative, and every positive term within its guard', () => {
    const field = createPlacedField([owner], input);
    expect(field.evaluate(inverseLambert([0, 0]))).toBeGreaterThan(0);
    expect(field.evaluate(inverseLambert([0.45, 0]))).toBeGreaterThan(0);
    expect(field.evaluate(inverseLambert([0.33, 0]))).toBeLessThan(0);
    for (let y = -50; y <= 50; y++)
      for (let x = -50; x <= 50; x++) {
        const point = inverseLambert([x / 100, y / 100]);
        if (field.raw(point).value > 0) {
          expect(field.raw(point).guarded).toBe(true);
          expect(owner.radius - angle(owner.center, point)).toBeGreaterThan(0.05);
        }
      }
  });

  it('converges to zero from both sides of body and island boundaries', () => {
    const field = createPlacedField([owner], input);
    for (const boundary of [0.2, 0.475]) {
      let last = Infinity;
      for (const epsilon of [1e-3, 1e-5, 1e-7]) {
        const inside = field.evaluate(inverseLambert([boundary - epsilon, 0])),
          outside = field.evaluate(inverseLambert([boundary + epsilon, 0]));
        expect(inside).toBeGreaterThan(0);
        expect(outside).toBeLessThan(0);
        expect(inside - outside).toBeLessThan(last);
        last = inside - outside;
      }
      expect(Math.abs(field.evaluate(inverseLambert([boundary, 0])))).toBeLessThan(1e-14);
    }
    // Certificate near-contact tolerances must never create an exterior positive strip.
    expect(field.evaluate(inverseLambert([0.2 + 5e-11, 0]))).toBeLessThan(0);
  });

  it('joins the negative extension continuously and evaluates the antipode without a chart', () => {
    const field = createPlacedField([owner], input),
      radial = (a) => [Math.sin(a), 0, Math.cos(a)],
      join = owner.radius + EXTENSION_RAD;
    for (const epsilon of [1e-3, 1e-5, 1e-7]) {
      expect(Math.abs(field.evaluate(radial(join - epsilon)) + EXTENSION_RAD)).toBeLessThanOrEqual(
        epsilon * 1.001,
      );
      expect(Math.abs(field.evaluate(radial(join + epsilon)) + EXTENSION_RAD)).toBeLessThanOrEqual(
        epsilon * 1.001,
      );
    }
    expect(field.evaluate([0, 0, -1])).toBeCloseTo(owner.radius - Math.PI, 14);
    expect(field.raw([0, 0, -1]).guarded).toBe(false);
  });

  it('retains seam identity, unique pole aliases, shared anchors, and exact repeated ticks', () => {
    const field = createPlacedField([owner], input);
    for (const latitude of [-Math.PI / 2, -0.3, 0, 0.4, Math.PI / 2])
      expect(field.raw(spherePoint(-Math.PI, latitude))).toEqual(
        field.raw(spherePoint(Math.PI, latitude)),
      );
    for (const latitude of [-Math.PI / 2, Math.PI / 2])
      for (let x = 0; x <= 32; x++)
        expect(field.raw(spherePoint((x * Math.PI) / 16, latitude))).toEqual(
          field.raw(spherePoint(0, latitude)),
        );
    for (let y = 0; y <= 16; y++)
      for (let x = 0; x < 32; x++) {
        const point = spherePoint(
            (x * 2 * Math.PI) / 32 - Math.PI,
            Math.PI / 2 - (y * Math.PI) / 16,
          ),
          refined = spherePoint(
            (x * 4 * 2 * Math.PI) / 128 - Math.PI,
            Math.PI / 2 - (y * 4 * Math.PI) / 64,
          );
        expect(field.raw(point)).toEqual(field.raw(refined));
        expect(field.raw(point)).toEqual(createPlacedField([owner], input).raw(point));
      }
  });
});
