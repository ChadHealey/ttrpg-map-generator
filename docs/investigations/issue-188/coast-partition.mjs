/** Fixed full-body bay interval may overlap role coast, never a role's internal root. */
import { partitionCoast as legacyPartition } from '../issue-172/coast-partition.mjs';

export { sampleCoast } from '../issue-172/coast-partition.mjs';
export function partitionCoast(id, specification) {
  const { coast, bay } = specification;
  // Frozen partition still validates all roles, their nonoverlap, and every other input.
  const result = legacyPartition(id, { ...specification, bay: null });
  if (!bay) return result;
  const index = (i) => Number.isInteger(i) && i >= 0 && i < coast.length;
  if (
    !index(bay.start) ||
    !index(bay.end) ||
    bay.start === bay.end ||
    !Array.isArray(bay.witness) ||
    bay.witness.length !== 2 ||
    !bay.witness.every(Number.isFinite)
  )
    throw new RangeError('Invalid fixed whole-body bay interval');
  const indices = Array.from(
    { length: ((bay.end - bay.start + coast.length) % coast.length) + 1 },
    (_, i) => (bay.start + i) % coast.length,
  );
  if (indices.length < 3) throw new RangeError('Bay needs a nontrivial exterior arc');
  const polygon = indices.map((i) => coast[i]).toReversed();
  return {
    ...result,
    bay: {
      polygon,
      mouth: [coast[bay.start], coast[bay.end]],
      witness: [...bay.witness],
      mouthKind: 'wedge-geodesic',
    },
  };
}
