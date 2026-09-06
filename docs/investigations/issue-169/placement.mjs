/** Revision-private bounded envelope placement; not production seed derivation. */
import { createHash } from 'node:crypto';

export const PLACEMENT_REVISION = 'issue-169-placement-v1';
export const GAP_RAD = 0.05;
export const EXTENSION_RAD = 0.02;
export const MAX_ATTEMPTS = 64;
export const DIRECTIONS_PER_OWNER = 128;
export const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
export const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
const compareId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (point) => point.map((value) => value / Math.hypot(...point));

/** The whole key is JSON encoded, avoiding ambiguous owner/scope separators. */
function stream(seed, ownerId, attempt, scope) {
  let counter = 0;
  return () =>
    createHash('sha256')
      .update(
        JSON.stringify([PLACEMENT_REVISION, String(seed), ownerId, attempt, scope, counter++]),
      )
      .digest()
      .readUInt32BE(0) /
    2 ** 32;
}

function direction(random) {
  const z = 2 * random() - 1,
    azimuth = 2 * Math.PI * random(),
    radius = Math.sqrt(1 - z * z);
  return [radius * Math.cos(azimuth), radius * Math.sin(azimuth), z];
}

function frame(center, orientation) {
  const east0 = normalize(cross(Math.abs(center[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], center)),
    north0 = cross(center, east0),
    east = east0.map(
      (value, index) => value * Math.cos(orientation) + north0[index] * Math.sin(orientation),
    );
  return { center, east, north: cross(center, east) };
}

/** No radius change, quota transfer, owner removal, backtracking, or hidden retry. */
export function placeOwners(owners, seed) {
  const failure = (code, details = {}) => ({
    ok: false,
    owners: [],
    failures: [{ code, ...details }],
    attempts: 0,
    candidateCount: 0,
  });
  if (
    !Array.isArray(owners) ||
    owners.length < 1 ||
    owners.length > 8 ||
    owners.some(
      (owner) =>
        owner === null ||
        typeof owner !== 'object' ||
        typeof owner.id !== 'string' ||
        owner.id.length === 0 ||
        !Number.isFinite(owner.radius) ||
        owner.radius <= 0 ||
        owner.radius + EXTENSION_RAD >= Math.PI,
    ) ||
    new Set(owners.map(({ id }) => id)).size !== owners.length
  )
    return failure('placement.invalid-input');

  const ordered = [...owners].sort((a, b) => b.radius - a.radius || compareId(a, b));
  for (let i = 0; i < ordered.length; i++)
    for (let j = i + 1; j < ordered.length; j++) {
      const requiredDistance = ordered[i].radius + ordered[j].radius + GAP_RAD;
      if (requiredDistance > Math.PI)
        return failure('placement.pair-capacity', {
          ownerIds: [ordered[i].id, ordered[j].id],
          requiredDistance,
          maximumDistance: Math.PI,
          proof: 'pair-caps-cannot-fit',
        });
    }

  const failures = [];
  let candidateCount = 0;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const placed = [];
    for (const owner of ordered) {
      const random = stream(seed, owner.id, attempt, 'center-directions');
      let selected;
      for (let candidate = 0; candidate < DIRECTIONS_PER_OWNER; candidate++) {
        const center = direction(random);
        candidateCount++;
        if (
          placed.every(
            (other) => angle(center, other.center) >= owner.radius + other.radius + GAP_RAD,
          )
        ) {
          selected = {
            ...owner,
            ...frame(center, 2 * Math.PI * stream(seed, owner.id, attempt, 'orientation')()),
          };
          break;
        }
      }
      if (selected === undefined) {
        failures.push({
          code: 'placement.attempt-exhausted',
          attempt: attempt + 1,
          ownerId: owner.id,
          directionCount: DIRECTIONS_PER_OWNER,
        });
        break;
      }
      placed.push(selected);
    }
    if (placed.length === owners.length)
      return {
        ok: true,
        owners: placed.sort(compareId),
        failures,
        attempts: attempt + 1,
        candidateCount,
      };
  }
  failures.push({ code: 'placement.search-exhausted', proof: 'search-only-not-infeasibility' });
  return { ok: false, owners: [], failures, attempts: MAX_ATTEMPTS, candidateCount };
}
