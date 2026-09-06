import { describe, expect, it } from 'vitest';

import { FAMILIES, sampleGrid, spherePoint, stream } from '../issue-164/morphology.mjs';
import { smoke } from '../issue-164/render-comparison.mjs';
import {
  along,
  angle,
  arc,
  budgetShares,
  calibrate,
  CELL_LIPSCHITZ,
  createField,
  GAP_RAD,
  guardAt,
  signedEllipse,
  tangentFrame,
  TICKS,
} from './field.mjs';
import { components, guardContact, maskAt, measure } from './measure.mjs';
import { inputs } from './run.mjs';

const cases = await inputs();
describe('issue-165 fixed quota experiment', () => {
  it('measures a known cap, seam component, full/water masks, and guard contact', () => {
    const center = [-1, 0, 0],
      radius = 0.8;
    const field = {
      family: 'envelope',
      owners: [{ center, radius }],
      input: cases[0],
      raw: (p) => ({
        value: Math.round((radius - angle(center, p)) * TICKS),
        owner: 0,
        guarded: true,
      }),
    };
    const grid = sampleGrid(field, 80, 40),
      report = measure(field, grid);
    expect(report.components).toHaveLength(1);
    expect(report.ownerShares[0].spherePercent).toBeCloseTo(50 * (1 - Math.cos(radius)), 0);
    expect(report.guardContact.confirmedFraction).toBe(1);
    expect(guardContact(field, 0, center)).toBe('excluded');
    expect(components(grid, new Uint8Array(grid.values.length)).records).toEqual([]);
    expect(
      components(grid, new Uint8Array(grid.values.length).fill(1)).records[0].spherePercent,
    ).toBeCloseTo(100, 9);
    const north = components(
      grid,
      Uint8Array.from(grid.values, (_, i) => Number(i < grid.width * 2)),
    );
    expect(north.records).toHaveLength(1);
  });
  it('uses explicit normalized size-squared quotas and finite deterministic failures', () => {
    expect(budgetShares([{ size: 1 }, { size: 0.5 }])).toEqual([0.8, 0.2]);
    for (const parts of [
      () => [{ guard: -1, broad: 1, islands: [] }],
      () => [{ guard: 1, broad: -10, islands: [1] }],
    ]) {
      const make = () => ({ input: cases[0], owners: [{ size: 1 }], parts });
      const first = calibrate(make(), 20, 10),
        repeat = calibrate(make(), 20, 10);
      expect(first).toEqual(repeat);
      expect(first.status).toBe('infeasible');
      expect(first.owners[0].steps).toBe(24);
    }
    expect(
      calibrate(
        {
          input: cases[0],
          owners: [{ size: 1 }],
          parts: () => [{ guard: 1, broad: 0, islands: [] }],
        },
        20,
        10,
      ).owners[0].status,
    ).toBe('quota-tolerance-failed');
  });
  it.each(FAMILIES)(
    '%s proves the guard bound for all fixed constructions and positive terms',
    (family) => {
      for (const input of cases) {
        const field = createField(family, {
          ...input,
          controls: {
            ...input.controls,
            polarCharacter: 'landBiased',
            islandAbundancePercent: 100,
            archipelagoAbundancePercent: 100,
          },
        });
        if (family === 'envelope')
          for (const [i, a] of field.owners.entries())
            for (const b of field.owners.slice(i + 1))
              expect(angle(a.center, b.center) - a.radius - b.radius).toBeGreaterThanOrEqual(
                GAP_RAD - 1e-12,
              );
        else
          for (const owner of field.owners)
            expect(
              1 + owner.waves.reduce((v, w) => v + Math.hypot(...w.vector) * w.amplitude, 0),
            ).toBeLessThan(CELL_LIPSCHITZ);
        field.thresholds.fill(-4 * TICKS); // Maximum allowed broad expansion plus abundant satellites/polar bias.
        const random = stream(input.seed, 'issue-165-gap-probe');
        for (let j = 0; j < 400; j++) {
          const p = spherePoint(2 * Math.PI * random(), Math.asin(2 * random() - 1));
          const q = along(p, tangentFrame(p)[0], GAP_RAD * 0.999);
          const a = field.raw(p),
            b = field.raw(q);
          if (a.value > 0) expect(guardAt(field, a.owner, p)).toBeGreaterThan(0);
          if (a.value > 0 && b.value > 0) expect(a.owner).toBe(b.owner);
          for (const part of field.parts(p))
            if (part.guard <= 0)
              expect(
                Math.min(Math.max(part.broad + 4, ...part.islands), part.guard),
              ).toBeLessThanOrEqual(0);
        }
      }
    },
  );
  it.each(FAMILIES)(
    '%s preserves forced north/south land, unique poles, seam land and nested anchors',
    (family) => {
      for (const pole of [-1, 1]) {
        const field = createField(
          family,
          { ...cases[0], controls: { ...cases[0].controls, polarCharacter: 'landBiased' } },
          { pole },
        );
        field.thresholds.fill(-TICKS);
        expect(field.raw([0, 0, pole]).value).toBeGreaterThan(0);
        const preview = sampleGrid(field, 40, 20),
          full = sampleGrid(field, 80, 40);
        const result = smoke(field, preview, full, 0);
        expect(result.seamLandAnchors).toBeGreaterThan(0);
        expect(result.poleChecks).toBe(722);
        expect(sampleGrid(createField(family, cases[0]), 40, 20)).toEqual(
          sampleGrid(createField(family, cases[0]), 40, 20),
        );
        for (let y = 1; y < 20; y++) {
          const lat = Math.PI / 2 - (y * Math.PI) / 20;
          expect(
            Math.abs(
              field.evaluate(spherePoint(-Math.PI + 1e-9, lat)).value -
                field.evaluate(spherePoint(Math.PI - 1e-9, lat)).value,
            ),
          ).toBeLessThan(1e-6);
        }
      }
    },
  );
  it.each(FAMILIES)('%s has continuous analytic contour, margin and island limits', (family) => {
    const field = createField(family, cases[0]);
    calibrate(field, 80, 40);
    const grid = sampleGrid(field, 80, 40),
      mask = maskAt(grid);
    let crossings = 0;
    for (let y = 1; y < 40; y++)
      for (let x = 0; x < 79; x++) {
        const i = y * 80 + x;
        if (mask[i] === mask[i + 1]) continue;
        const a = spherePoint((x * 2 * Math.PI) / 80 - Math.PI, Math.PI / 2 - (y * Math.PI) / 40);
        const b = spherePoint(
          ((x + 1) * 2 * Math.PI) / 80 - Math.PI,
          Math.PI / 2 - (y * Math.PI) / 40,
        );
        let low = 0,
          high = 1;
        for (let step = 0; step < 30; step++) {
          const mid = (low + high) / 2;
          if (field.evaluate(arc(a, b, mid)).value > 0 === field.evaluate(a).value > 0) low = mid;
          else high = mid;
        }
        expect(Math.abs(field.evaluate(arc(a, b, low)).value)).toBeLessThan(1e-6);
        expect(Math.abs(field.evaluate(arc(a, b, high)).value)).toBeLessThan(1e-6);
        crossings++;
      }
    expect(crossings).toBeGreaterThan(10);
    for (const owner of field.owners)
      for (const shape of [...owner.lobes, ...owner.cuts, ...owner.islands]) {
        // Chord ellipse is continuous at its cap, antipode and center; no baseline sentinel/step.
        for (const distance of [0, shape.major, Math.PI]) {
          const p = along(shape.center, shape.east, distance),
            q = along(shape.center, shape.east, distance + 1e-9);
          expect(Math.abs(signedEllipse(shape, p) - signedEllipse(shape, q))).toBeLessThan(1e-5);
        }
      }
    for (const [i, owner] of field.owners.entries()) {
      const other = field.owners[(i + 1) % field.owners.length];
      let low = 0,
        high = 1;
      for (let n = 0; n < 40; n++) {
        const mid = (low + high) / 2;
        if (guardAt(field, i, arc(owner.center, other.center, mid)) > 0) low = mid;
        else high = mid;
      }
      const a = arc(owner.center, other.center, low),
        b = arc(owner.center, other.center, high);
      expect(Math.abs(field.evaluate(a).value - field.evaluate(b).value)).toBeLessThan(1e-6);
    }
  });
  it.each(FAMILIES)(
    '%s independently controls zero and abundant construction budgets',
    (family) => {
      for (const control of ['islandAbundancePercent', 'archipelagoAbundancePercent'])
        for (const value of [0, 100]) {
          const input = { ...cases[0], controls: { ...cases[0].controls, [control]: value } },
            field = createField(family, input);
          const expected =
            Math.ceil(input.controls.islandAbundancePercent / 25) +
            Math.ceil(input.controls.archipelagoAbundancePercent / 15);
          for (const owner of field.owners) expect(owner.islands).toHaveLength(expected);
          const base = createField(family, cases[0]);
          expect(field.owners.map((o) => [o.lobes, o.sites, o.waves])).toEqual(
            base.owners.map((o) => [o.lobes, o.sites, o.waves]),
          );
        }
    },
  );
});
