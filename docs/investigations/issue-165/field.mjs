/** Investigation only. The fixed construction and continuous quota field are specified in experiment.md. */
import {
  CELL_LIPSCHITZ,
  createField as baselineField,
  dot,
  GAP_RAD,
  normalize,
  spherePoint,
  stream,
  TICKS,
} from '../issue-164/morphology.mjs';

export { CELL_LIPSCHITZ, GAP_RAD, TICKS };
export const REVISION = 'issue-165-r1';
export const TOLERANCE_PERCENT = 0.25;
export const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function tangentFrame(p) {
  const east = normalize(cross(Math.abs(p[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], p));
  return [east, cross(p, east)];
}
export function along(p, tangent, distance) {
  return normalize(p.map((v, i) => v * Math.cos(distance) + tangent[i] * Math.sin(distance)));
}
export function arc(a, b, t) {
  const d = angle(a, b);
  if (d < 1e-12) return a;
  return normalize(
    a.map((v, i) => (v * Math.sin((1 - t) * d) + b[i] * Math.sin(t * d)) / Math.sin(d)),
  );
}
export function signedEllipse(shape, point) {
  const u = dot(shape.east, point),
    v = dot(shape.north, point);
  return Math.min(
    (1 -
      Math.hypot(
        (u * shape.cosine + v * shape.sine) / Math.sin(shape.major),
        (-u * shape.sine + v * shape.cosine) / Math.sin(shape.minor),
      )) *
      Math.sin(Math.min(shape.major, shape.minor)),
    dot(shape.center, point) - Math.cos(Math.max(shape.major, shape.minor)),
  );
}
const maximum = (shapes, p) =>
  shapes.reduce((v, shape) => Math.max(v, signedEllipse(shape, p)), -4);
export function budgetShares(owners) {
  const weights = owners.map((owner) => owner.size ** 2);
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((v) => v / total);
}
export function guardAt(field, index, p) {
  if (field.family === 'envelope')
    return field.owners[index].radius - angle(field.owners[index].center, p);
  if (field.owners.length === 1) return 4;
  const score = field.ownerScore(field.owners[index], p);
  let other = -Infinity;
  for (let i = 0; i < field.owners.length; i++)
    if (i !== index) other = Math.max(other, field.ownerScore(field.owners[i], p));
  return (score - other - CELL_LIPSCHITZ * GAP_RAD - 2 / TICKS) / (2 * CELL_LIPSCHITZ);
}

/** Rotates the entire construction, including oceans/waves; only focused tests use this hook. */
function rotateToPole(owners, oceans, sign) {
  const [east, north] = tangentFrame(owners[0].center),
    center = owners[0].center;
  const rotate = (v) => [dot(v, east), sign * dot(v, north), sign * dot(v, center)];
  for (const owner of owners) {
    for (const key of ['center', 'east', 'north']) owner[key] = rotate(owner[key]);
    for (const shape of [...owner.lobes, ...owner.cuts, ...owner.islands])
      for (const key of ['center', 'east', 'north']) shape[key] = rotate(shape[key]);
    for (const site of owner.sites) site.center = rotate(site.center);
    for (const wave of owner.waves) wave.vector = rotate(wave.vector);
  }
  return oceans.map(rotate);
}
export function createField(family, input, options = {}) {
  const baseline = baselineField(family, input),
    owners = structuredClone(baseline.owners);
  const random = stream(input.seed, 'ocean-sites');
  let oceans = Array.from({ length: 8 }, () => {
    const z = 2 * random() - 1,
      a = 2 * Math.PI * random();
    return [Math.sqrt(1 - z * z) * Math.cos(a), Math.sqrt(1 - z * z) * Math.sin(a), z];
  });
  if (options.pole) oceans = rotateToPole(owners, oceans, options.pole);
  const polarAmplitude =
    input.controls.polarCharacter === 'landBiased'
      ? 0.1
      : input.controls.polarCharacter === 'oceanBiased'
        ? -0.1
        : 0;
  function ownerScore(owner, p) {
    return (
      Math.max(...owner.sites.map((site) => dot(site.center, p) + site.bias)) +
      owner.waves.reduce(
        (v, wave) => v + wave.amplitude * Math.sin(dot(wave.vector, p) + wave.phase),
        0,
      ) -
      (1 - owner.size) * 0.18
    );
  }
  const field = {
    family,
    input,
    owners,
    ownerScore,
    primaryCount: baseline.primaryCount,
    thresholds: owners.map(() => 0),
  };
  field.parts = (p) => {
    const scores = family === 'cellular' ? owners.map((owner) => ownerScore(owner, p)) : [];
    const water = family === 'cellular' ? Math.max(...oceans.map((c) => dot(c, p))) : 0;
    const polar = polarAmplitude * p[2] ** 2;
    return owners.map((owner, i) => {
      const guard =
        family === 'envelope'
          ? owner.radius - angle(owner.center, p)
          : owners.length === 1
            ? 4
            : (scores[i] -
                Math.max(...scores.filter((_, j) => i !== j)) -
                CELL_LIPSCHITZ * GAP_RAD -
                2 / TICKS) /
              (2 * CELL_LIPSCHITZ);
      const broad =
        (family === 'envelope'
          ? Math.min(maximum(owner.lobes, p), -maximum(owner.cuts, p))
          : scores[i] - water) + polar;
      const islands = owner.islands.map((shape) => signedEllipse(shape, p) + polar);
      return { guard, broad, islands };
    });
  };
  field.evaluate = (p) => {
    let value = -Infinity,
      owner = -1,
      term = -1,
      guarded = false;
    const parts = field.parts(p);
    for (let i = 0; i < owners.length; i++) {
      const part = parts[i];
      let shape = part.broad - field.thresholds[i] / TICKS,
        feature = -1;
      part.islands.forEach((island, j) => {
        if (island > shape) {
          shape = island;
          feature = j;
        }
      });
      const candidate = Math.min(shape, part.guard);
      if (candidate > value) {
        value = candidate;
        owner = i;
        term = feature;
        guarded = part.guard > 0;
      }
    }
    return { value, owner, term, guarded };
  };
  field.raw = (p) => {
    const result = field.evaluate(p);
    return { ...result, value: Math.round(result.value * TICKS) };
  };
  return field;
}

/** Fixed 24 bisections per quota, no reallocation/retry; diagnostics remain renderable on failure. */
export function calibrate(field, width = 400, height = 200) {
  const shares = budgetShares(field.owners),
    target = 1 - field.input.controls.targetWaterCoveragePercent / 100;
  const samples = field.owners.map(() => []);
  let total = 0;
  for (let y = 1; y < height; y++) {
    const latitude = Math.PI / 2 - (y * Math.PI) / height,
      weight = Math.cos(latitude);
    total += width * weight;
    for (let x = 0; x < width; x++) {
      const parts = field.parts(spherePoint((x * 2 * Math.PI) / width - Math.PI, latitude));
      parts.forEach((part, i) => {
        if (part.guard > 0)
          samples[i].push({
            weight,
            broad: part.broad,
            island: Math.max(-4, ...part.islands),
            guard: part.guard,
          });
      });
    }
  }
  const reports = samples.map((rows, i) => {
    const quota = target * shares[i];
    const area = (threshold) =>
      rows.reduce(
        (sum, row) =>
          sum +
          (Math.round(
            Math.min(row.guard, Math.max(row.broad - threshold / TICKS, row.island)) * TICKS,
          ) > 0
            ? row.weight
            : 0),
        0,
      ) / total;
    let low = -4 * TICKS,
      high = 4 * TICKS;
    const capacity = area(low),
      floor = area(high);
    for (let step = 0; step < 24; step++) {
      const mid = Math.floor((low + high) / 2);
      if (area(mid) > quota) low = mid;
      else high = mid;
    }
    const threshold = Math.abs(area(low) - quota) < Math.abs(area(high) - quota) ? low : high;
    const realized = area(threshold);
    return {
      quota,
      capacity,
      floor,
      threshold,
      realized,
      errorPercent: 100 * (realized - quota),
      steps: 24,
      status:
        capacity < quota
          ? 'capacity-failed'
          : floor > quota
            ? 'island-floor-failed'
            : Math.abs(100 * (realized - quota)) > TOLERANCE_PERCENT / samples.length
              ? 'quota-tolerance-failed'
              : 'calibrated',
    };
  });
  field.thresholds = reports.map((row) => row.threshold);
  return {
    status: reports.every((row) => row.status === 'calibrated') ? 'calibrated' : 'infeasible',
    owners: reports,
  };
}
