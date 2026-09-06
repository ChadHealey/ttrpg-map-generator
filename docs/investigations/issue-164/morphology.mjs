/** Investigation-only unit-sphere fields. No production imports, adapters, or accepted data. */
import { createHash } from 'node:crypto';

export const REVISION = 'issue-164-r2';
export const GAP_RAD = 0.05;
export const TICKS = 1_000_000;
export const CELL_LIPSCHITZ = 1.86;
export const FAMILIES = ['envelope', 'cellular'];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const normalize = (p) => p.map((v) => v / Math.hypot(...p));
const clamp = (v) => Math.max(-1, Math.min(1, v));
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Counter-hash stream is private to this spike; it does not redefine project seed derivation. */
export function stream(seed, scope) {
  let counter = 0;
  return () =>
    createHash('sha256')
      .update(`issue-164-stream-v1/${seed}/${scope}/${counter++}`)
      .digest()
      .readUInt32BE(0) /
    2 ** 32;
}
export function spherePoint(longitudeRad, latitudeRad) {
  if (Math.abs(latitudeRad) === Math.PI / 2) return [0, 0, Math.sign(latitudeRad)];
  const longitude =
    ((((longitudeRad + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return [
    Math.cos(latitudeRad) * Math.cos(longitude),
    Math.cos(latitudeRad) * Math.sin(longitude),
    Math.sin(latitudeRad),
  ];
}
function randomPoint(random) {
  const z = 2 * random() - 1;
  const a = 2 * Math.PI * random();
  return [Math.sqrt(1 - z * z) * Math.cos(a), Math.sqrt(1 - z * z) * Math.sin(a), z];
}
function basis(center) {
  const east = normalize(cross(Math.abs(center[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], center));
  return { center, east, north: cross(center, east) };
}
function offset(frame, u, v) {
  const radius = Math.hypot(u, v);
  const scale = radius === 0 ? 1 : Math.sin(radius) / radius;
  return normalize(
    frame.center.map(
      (c, i) => c * Math.cos(radius) + scale * (u * frame.east[i] + v * frame.north[i]),
    ),
  );
}
function ellipse(center, major, minor, angle) {
  const frame = basis(center);
  return { ...frame, major, minor, cosine: Math.cos(angle), sine: Math.sin(angle) };
}
function ellipseValue(shape, point) {
  const d = Math.acos(clamp(dot(shape.center, point)));
  if (d > Math.max(shape.major, shape.minor) + 1.5) return -2;
  const s = d < 1e-9 ? 1 : d / Math.max(1e-9, Math.sin(d));
  const u = dot(shape.east, point) * s,
    v = dot(shape.north, point) * s;
  return (
    (1 -
      Math.hypot(
        (u * shape.cosine + v * shape.sine) / shape.major,
        (-u * shape.sine + v * shape.cosine) / shape.minor,
      )) *
    Math.min(shape.major, shape.minor)
  );
}
function islandValue(shapes, point) {
  const value = maximumShape(shapes, point);
  return value > 0 ? 0.2 + value : -4;
}
function maximumShape(shapes, point) {
  let value = -4;
  for (const shape of shapes) value = Math.max(value, ellipseValue(shape, point));
  return value;
}
function waves(random, fragmentationPercent) {
  return [3, 6, 11].map((frequency, i) => ({
    vector: randomPoint(random).map((v) => v * frequency),
    amplitude: [0.065, 0.035, 0.01][i] * (0.65 + fragmentationPercent / 100),
    phase: random() * Math.PI * 2,
  }));
}
function warp(owner, point) {
  let value = 0;
  for (const wave of owner.waves)
    value += wave.amplitude * Math.sin(dot(wave.vector, point) + wave.phase);
  return value;
}

/** Fixed 24 proposals per owner, no retries and no image/seed selection. */
function placeOwners(seed, count) {
  const random = stream(seed, 'placement');
  const centers = [randomPoint(random)];
  while (centers.length < count) {
    let best,
      score = -Infinity;
    for (let candidate = 0; candidate < 24; candidate++) {
      const point = randomPoint(random);
      const clearance = Math.min(...centers.map((center) => Math.acos(clamp(dot(center, point)))));
      // Bounded irregularity avoids a rigid equal-spacing objective.
      const candidateScore = clearance + 0.35 * random();
      if (candidateScore > score) {
        best = point;
        score = candidateScore;
      }
    }
    centers.push(best);
  }
  return centers;
}

export function createField(family, input) {
  if (!FAMILIES.includes(family)) throw new RangeError('Unknown investigation family');
  const controls = input.controls;
  const count = controls.continentCountIntent;
  if (!Number.isInteger(count) || count < 1 || count > 8)
    throw new RangeError('Owner count outside spike bounds');
  const centers = placeOwners(input.seed, count);
  const primaryCount = Math.min(count, 1 + Math.floor(stream(input.seed, 'primary-count')() * 3));
  const owners = centers.map((center, index) => {
    const random = stream(input.seed, `owner-${index}`),
      frame = basis(center);
    const nearest = Math.min(
      Math.PI,
      ...centers.filter((_, i) => i !== index).map((p) => Math.acos(clamp(dot(p, center)))),
    );
    const radius = count === 1 ? 2 : (nearest - GAP_RAD) / 2;
    const orientation = random() * Math.PI * 2;
    const size =
      controls.continentDistribution === 'balanced'
        ? 0.9
        : controls.continentDistribution === 'oneDominant'
          ? index === 0
            ? 1
            : 0.55
          : index < primaryCount
            ? 0.95
            : 0.55;
    const circumferenceScale = Math.max(
      0.86,
      Math.min(1.12, Math.sqrt(40000 / controls.worldCircumferenceKm)),
    );
    const r = radius * size * circumferenceScale;
    const lobes = [ellipse(center, r * 0.7, r * 0.46, orientation)];
    const sites = [{ center, bias: 0 }];
    for (let lobe = 0; lobe < 3; lobe++) {
      const angle = orientation + (lobe === 0 ? 0 : lobe === 1 ? 2.2 : 4.1) + random() * 0.65;
      const d = r * (0.35 + 0.2 * random());
      const at = offset(frame, Math.cos(angle) * d, Math.sin(angle) * d);
      lobes.push(
        ellipse(
          at,
          r * (0.33 + 0.13 * random()),
          r * (0.18 + 0.13 * random()),
          angle + random() * 0.6,
        ),
      );
      sites.push({ center: at, bias: -0.04 - random() * 0.08 });
    }
    const cuts = [];
    for (let cut = 0; cut < 2; cut++) {
      const angle = orientation + 1 + cut * 2.8 + random() * 0.6;
      const d = r * (0.56 + 0.15 * random());
      cuts.push(
        ellipse(
          offset(frame, Math.cos(angle) * d, Math.sin(angle) * d),
          r * 0.45,
          r * (0.07 + controls.fragmentationPercent / 650),
          angle + 1,
        ),
      );
    }
    const islands = [];
    const islandRandom = stream(input.seed, `islands-${index}`);
    const countIslands = Math.ceil(controls.islandAbundancePercent / 25);
    const countMembers = Math.ceil(controls.archipelagoAbundancePercent / 15);
    for (let island = 0; island < countIslands + countMembers; island++) {
      const grouped = island >= countIslands;
      const angle =
        orientation + (grouped ? 0.55 + islandRandom() * 0.6 : islandRandom() * Math.PI * 2);
      const d = r * (0.8 + islandRandom() * 0.3);
      const length = r * (0.025 + islandRandom() * 0.075);
      islands.push(
        ellipse(
          offset(frame, Math.cos(angle) * d, Math.sin(angle) * d),
          length,
          length * (0.3 + islandRandom() * 0.45),
          angle + islandRandom(),
        ),
      );
    }
    return {
      ...frame,
      radius,
      lobes,
      cuts,
      islands,
      sites,
      waves: waves(random, controls.fragmentationPercent),
      size,
    };
  });
  const oceanRandom = stream(input.seed, 'ocean-sites');
  const oceanSites = Array.from({ length: 8 }, () => randomPoint(oceanRandom));
  const polarAmplitude =
    controls.polarCharacter === 'landBiased'
      ? 0.1
      : controls.polarCharacter === 'oceanBiased'
        ? -0.1
        : 0;
  const polar = (point) => polarAmplitude * point[2] ** 2;
  function ownerScore(owner, point) {
    let score = -Infinity;
    for (const site of owner.sites) score = Math.max(score, dot(site.center, point) + site.bias);
    return score + warp(owner, point) - (1 - owner.size) * 0.18;
  }
  function raw(point) {
    if (family === 'envelope') {
      for (let i = 0; i < owners.length; i++) {
        const owner = owners[i];
        if (dot(owner.center, point) <= Math.cos(owner.radius)) continue;
        const broad = Math.min(maximumShape(owner.lobes, point), -maximumShape(owner.cuts, point));
        const value = Math.max(broad, islandValue(owner.islands, point)) + polar(point);
        return { owner: i, value: Math.round(value * TICKS), guarded: true };
      }
      return { owner: -1, value: -4 * TICKS, guarded: false };
    }
    const scores = owners.map((owner) => ownerScore(owner, point));
    let winner = 0;
    for (let i = 1; i < scores.length; i++) if (scores[i] > scores[winner]) winner = i;
    const second = Math.max(-Infinity, ...scores.filter((_, i) => i !== winner));
    // Every owner score is <=1.84975-Lipschitz. This margin proves a >=0.05-rad gap.
    const guarded = scores[winner] - second > CELL_LIPSCHITZ * GAP_RAD + 2 / TICKS;
    let water = -Infinity;
    for (const center of oceanSites) water = Math.max(water, dot(center, point));
    const broad = scores[winner] - water;
    const islands = islandValue(owners[winner].islands, point);
    const value = Math.max(broad, islands) + polar(point);
    return { owner: winner, value: Math.round(value * TICKS), guarded };
  }
  return { family, owners, primaryCount, raw, ownerScore, input };
}

/** Investigation grid: nested longitude/latitude anchors and unique pole coordinates. */
export function sampleGrid(field, width, height) {
  const values = new Int32Array(width * (height + 1));
  const owners = new Int8Array(values.length);
  const weights = new Float64Array(height + 1);
  for (let y = 0; y <= height; y++) {
    const latitude = Math.PI / 2 - (y * Math.PI) / height;
    weights[y] = Math.cos(latitude);
    const limit = y === 0 || y === height ? 1 : width;
    for (let x = 0; x < limit; x++) {
      const sample = field.raw(spherePoint((x * 2 * Math.PI) / width - Math.PI, latitude));
      values[y * width + x] = sample.value;
      owners[y * width + x] = sample.guarded ? sample.owner : -1;
    }
    if (limit === 1) {
      values.fill(values[y * width], y * width, (y + 1) * width);
      owners.fill(owners[y * width], y * width, (y + 1) * width);
    }
  }
  return { values, owners, weights, width, height };
}
export function landFraction(grid, threshold) {
  let land = 0,
    total = 0;
  for (let y = 1; y < grid.height; y++) {
    total += grid.weights[y] * grid.width;
    for (let x = 0; x < grid.width; x++) {
      const i = y * grid.width + x;
      if (grid.owners[i] >= 0 && grid.values[i] > threshold) land += grid.weights[y];
    }
  }
  return land / total;
}
export function calibrate(grid, waterPercent) {
  const target = 1 - waterPercent / 100;
  if (landFraction(grid, -4 * TICKS) < target)
    return { status: 'capacity-failed', threshold: -4 * TICKS };
  let low = -4 * TICKS,
    high = 4 * TICKS;
  for (let step = 0; step < 24; step++) {
    const mid = Math.floor((low + high) / 2);
    if (landFraction(grid, mid) > target) low = mid;
    else high = mid;
  }
  const threshold =
    Math.abs(landFraction(grid, low) - target) < Math.abs(landFraction(grid, high) - target)
      ? low
      : high;
  return { status: 'calibrated', threshold };
}
