/** Issue-170 investigation placement. Budgets and candidate order are frozen in design.md. */
import { createHash } from 'node:crypto';

export const PLACEMENT_REVISION = 'issue-170-placement-r1';
export const GAP_RAD = 0.05;
export const GAP_SLACK_RAD = 1e-12;
export const EXTENSION_RAD = 0.02;
export const MAX_ATTEMPTS = 64;
export const DIRECTIONS_PER_OWNER = 128;
export const REFINEMENT_SWEEPS = 64;
export const REFINEMENT_STEPS = Object.freeze([0.08, 0.04, 0.015, 0.005]);
export const MAX_CENTER_EVALUATIONS =
  MAX_ATTEMPTS * 8 * DIRECTIONS_PER_OWNER + REFINEMENT_SWEEPS * 8;
export const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
export const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
const compareId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (p) => p.map((v) => v / Math.hypot(...p));

function stream(seed, ownerId, attempt, scope) {
  let counter = 0;
  return () =>
    createHash('sha256')
      .update(JSON.stringify([PLACEMENT_REVISION, seed, ownerId, attempt, scope, counter++]))
      .digest()
      .readUInt32BE(0) /
    2 ** 32;
}
function randomDirection(random) {
  const z = 2 * random() - 1,
    azimuth = 2 * Math.PI * random(),
    radius = Math.sqrt(1 - z * z);
  return [radius * Math.cos(azimuth), radius * Math.sin(azimuth), z];
}
const equator = (count) =>
  Array.from({ length: count }, (_, i) => [
    Math.cos((i * 2 * Math.PI) / count),
    Math.sin((i * 2 * Math.PI) / count),
    0,
  ]);

/** The sequence is a bounded candidate pool, not a mixed-radius feasibility claim. */
export function sphericalCode(count) {
  const poles = [
    [0, 0, 1],
    [0, 0, -1],
  ];
  switch (count) {
    case 1:
      return [poles[0]];
    case 2:
      return poles;
    case 3:
      return equator(3);
    case 4:
      return [
        [1, 1, 1],
        [1, -1, -1],
        [-1, 1, -1],
        [-1, -1, 1],
      ].map(normalize);
    case 5:
      return [...equator(3), ...poles];
    case 6:
      return [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], ...poles];
    case 7:
      return [...poles, ...equator(5)];
    case 8:
      return Array.from({ length: 8 }, (_, i) =>
        normalize([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1]),
      );
    default:
      throw new RangeError('Spherical code count outside 1..8');
  }
}
function rotatedCode(count, seed, attempt) {
  const random = stream(seed, 'layout', attempt, 'spherical-code-rotation');
  const u = random(),
    a = 2 * Math.PI * random(),
    b = 2 * Math.PI * random();
  const vector = [
    Math.sqrt(1 - u) * Math.sin(a),
    Math.sqrt(1 - u) * Math.cos(a),
    Math.sqrt(u) * Math.sin(b),
  ];
  const scalar = Math.sqrt(u) * Math.cos(b);
  return sphericalCode(count).map((p) => {
    const first = cross(vector, p),
      second = cross(vector, first);
    return normalize(p.map((v, i) => v + 2 * scalar * first[i] + 2 * second[i]));
  });
}
function frame(center, orientation) {
  const east0 = normalize(cross(Math.abs(center[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], center));
  const north0 = cross(center, east0);
  const east = east0.map((v, i) => v * Math.cos(orientation) + north0[i] * Math.sin(orientation));
  return { center: [...center], east, north: cross(center, east) };
}
const required = (a, b) => a.radius + b.radius + GAP_RAD;
const separated = (a, b) => angle(a.center, b.center) >= required(a, b) + GAP_SLACK_RAD;

function refine(placed, seed, attempt) {
  const random = placed.map((owner) => stream(seed, owner.id, attempt, 'feasible-displacements'));
  let accepted = 0;
  for (let sweep = 0; sweep < REFINEMENT_SWEEPS; sweep++) {
    const step = REFINEMENT_STEPS[sweep % REFINEMENT_STEPS.length];
    for (let i = 0; i < placed.length; i++) {
      const owner = placed[i],
        basis = frame(owner.center, 2 * Math.PI * random[i]());
      const center = normalize(
        owner.center.map((v, axis) => v * Math.cos(step) + basis.east[axis] * Math.sin(step)),
      );
      const proposal = { ...owner, center };
      if (placed.every((other, j) => i === j || separated(proposal, other))) {
        placed[i] = proposal;
        accepted++;
      }
    }
  }
  return { proposals: REFINEMENT_SWEEPS * placed.length, accepted };
}

/** Input owners/radii/quotas remain untouched; every published placement passes all pairs. */
export function placeOwners(owners, seed) {
  const failures = [];
  let candidateCount = 0;
  const failure = (code, details = {}) => ({
    ok: false,
    owners: [],
    failures: [{ code, ...details }],
    attempts: 0,
    candidateCount: 0,
    initialCandidateCount: 0,
    refinementProposals: 0,
    refinementAccepted: 0,
    minimumGap: null,
    pairs: [],
  });
  if (
    !Array.isArray(owners) ||
    owners.length < 1 ||
    owners.length > 8 ||
    typeof seed !== 'string' ||
    seed.length === 0 ||
    owners.some(
      (owner) =>
        !owner ||
        typeof owner !== 'object' ||
        typeof owner.id !== 'string' ||
        owner.id.length === 0 ||
        !Number.isFinite(owner.radius) ||
        owner.radius <= 0 ||
        owner.radius + EXTENSION_RAD >= Math.PI,
    ) ||
    new Set(owners.map((o) => o.id)).size !== owners.length
  )
    return failure('placement.invalid-input');
  const ordered = [...owners].sort((a, b) => b.radius - a.radius || compareId(a, b));
  for (let i = 0; i < ordered.length; i++)
    for (let j = i + 1; j < ordered.length; j++) {
      if (required(ordered[i], ordered[j]) > Math.PI)
        return failure('placement.pair-capacity', {
          ownerIds: [ordered[i].id, ordered[j].id],
          requiredDistance: required(ordered[i], ordered[j]),
          maximumDistance: Math.PI,
          proof: 'pair-caps-cannot-fit',
        });
    }
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const guided = attempt === 1 || (owners.length === 6 && attempt === 0);
    const code = guided ? rotatedCode(owners.length, seed, attempt) : [];
    const placed = [];
    for (let rank = 0; rank < ordered.length; rank++) {
      const owner = ordered[rank],
        random = stream(seed, owner.id, attempt, 'center-directions');
      let selected;
      for (let candidate = 0; candidate < DIRECTIONS_PER_OWNER; candidate++) {
        const center = guided && candidate === 0 ? code[rank] : randomDirection(random);
        const proposal = { ...owner, center };
        candidateCount++;
        if (placed.every((other) => separated(proposal, other))) {
          selected = proposal;
          break;
        }
      }
      if (!selected) {
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
    if (placed.length !== owners.length) continue;
    const refinement = refine(placed, seed, attempt),
      pairs = [];
    for (let i = 0; i < placed.length; i++)
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i],
          b = placed[j],
          distance = angle(a.center, b.center);
        if (!separated(a, b))
          return {
            ...failure('placement.final-gap', { ownerIds: [a.id, b.id] }),
            attempts: attempt + 1,
            candidateCount: candidateCount + refinement.proposals,
            initialCandidateCount: candidateCount,
            refinementProposals: refinement.proposals,
            refinementAccepted: refinement.accepted,
          };
        pairs.push({
          ownerIds: [a.id, b.id],
          distance,
          requiredDistance: required(a, b),
          gap: distance - a.radius - b.radius,
        });
      }
    return {
      ok: true,
      owners: placed
        .map((owner) => ({
          ...structuredClone(owner),
          ...frame(owner.center, 2 * Math.PI * stream(seed, owner.id, attempt, 'orientation')()),
        }))
        .sort(compareId),
      failures,
      attempts: attempt + 1,
      candidateCount: candidateCount + refinement.proposals,
      initialCandidateCount: candidateCount,
      refinementProposals: refinement.proposals,
      refinementAccepted: refinement.accepted,
      minimumGap: pairs.length ? Math.min(...pairs.map((p) => p.gap)) : null,
      pairs,
      guidedInitialAttempt: guided,
    };
  }
  failures.push({ code: 'placement.search-exhausted', proof: 'search-only-not-infeasibility' });
  return {
    ok: false,
    owners: [],
    failures,
    attempts: MAX_ATTEMPTS,
    candidateCount,
    initialCandidateCount: candidateCount,
    refinementProposals: 0,
    refinementAccepted: 0,
    minimumGap: null,
    pairs: [],
  };
}
