/** Fixed-zero continuous field for certified, post-scaled experimental land polygons. */
import { forwardLambert, signedDistance } from './geometry.mjs';
import { angle, dot, EXTENSION_RAD } from './placement.mjs';

export const FIELD_REVISION = 'issue-169-fixed-zero-v1';
export const TICKS = 1_000_000;

/** Geometry and separation certificates are prerequisites, never repaired by this evaluator. */
export function createPlacedField(owners, input) {
  if (owners.length === 0) throw new RangeError('A placed field requires at least one owner.');
  const prepared = owners.map((owner) => {
    if (!(owner.radius > 0 && owner.radius + EXTENSION_RAD < Math.PI))
      throw new RangeError('The negative extension must stay away from the chart antipode.');
    return {
      owner,
      polygons: [
        owner.candidate.bodyBoundary,
        ...owner.candidate.islands.map(({ polygon }) => polygon),
      ],
    };
  });

  function evaluateWithOwner(point) {
    let value = -Infinity,
      selectedOwner = -1,
      guarded = false;
    prepared.forEach(({ owner, polygons }, index) => {
      const distance = angle(owner.center, point),
        guard = owner.radius - distance;
      let candidate = guard;
      if (distance < owner.radius + EXTENSION_RAD) {
        const local = [dot(owner.east, point), dot(owner.north, point), dot(owner.center, point)],
          h = signedDistance(forwardLambert(local), polygons);
        candidate = Math.min(Math.max(h, -EXTENSION_RAD), guard);
      }
      if (!Number.isFinite(candidate))
        throw new RangeError('The field produced a non-finite scalar.');
      // Stable owner order supplies the tie rule; never omit negative candidates.
      if (candidate > value) {
        value = candidate;
        selectedOwner = index;
        guarded = guard > 0;
      }
    });
    return { value, owner: selectedOwner, guarded };
  }

  return {
    revision: FIELD_REVISION,
    owners,
    input,
    evaluate: (point) => evaluateWithOwner(point).value,
    raw: (point) => {
      const result = evaluateWithOwner(point);
      return { ...result, value: Math.round(result.value * TICKS) };
    },
  };
}
