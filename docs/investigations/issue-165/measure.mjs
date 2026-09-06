/** Explicit diagnostic measures shared by immutable r2 and quota continuations. See experiment.md. */
import { createHash } from 'node:crypto';

import { spherePoint } from '../issue-164/morphology.mjs';
import { along, angle, arc, guardAt, tangentFrame } from './field.mjs';

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function gridBytes(grid) {
  const bytes = Buffer.alloc(grid.values.length * 5);
  grid.values.forEach((value, i) => {
    bytes.writeInt32BE(value, i * 5);
    bytes.writeInt8(grid.owners[i], i * 5 + 4);
  });
  return bytes;
}
export const maskAt = (grid, threshold = 0) =>
  Uint8Array.from(grid.values, (v, i) => Number(grid.owners[i] >= 0 && v > threshold));
export const pointAt = (grid, i) =>
  spherePoint(
    ((i % grid.width) * 2 * Math.PI) / grid.width - Math.PI,
    Math.PI / 2 - (Math.floor(i / grid.width) * Math.PI) / grid.height,
  );
export function neighbors(grid, i) {
  const x = i % grid.width,
    y = Math.floor(i / grid.width);
  return [
    y * grid.width + ((x + 1) % grid.width),
    y * grid.width + ((x + grid.width - 1) % grid.width),
    ...(y > 0 ? [i - grid.width] : []),
    ...(y < grid.height ? [i + grid.width] : []),
  ];
}
export function components(grid, mask) {
  const labels = new Int32Array(mask.length).fill(-1),
    records = [];
  const rowWeight = (i) => {
    const y = Math.floor(i / grid.width);
    return y === 0 || y === grid.height ? 0 : grid.weights[y];
  };
  let total = 0;
  for (let y = 1; y < grid.height; y++) total += grid.width * grid.weights[y];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || labels[i] >= 0) continue;
    const queue = [i],
      index = records.length;
    labels[i] = index;
    let area = 0;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const at = queue[cursor];
      area += rowWeight(at);
      for (const next of neighbors(grid, at))
        if (mask[next] && labels[next] < 0) {
          labels[next] = index;
          queue.push(next);
        }
    }
    records.push({ index, firstAnchor: i, owner: grid.owners[i], area });
  }
  const land = records.reduce((sum, row) => sum + row.area, 0);
  return {
    labels,
    total,
    land,
    records: records
      .sort((a, b) => b.area - a.area || a.firstAnchor - b.firstAnchor)
      .map((row) => ({
        ...row,
        spherePercent: (100 * row.area) / total,
        landPercent: land ? (100 * row.area) / land : 0,
      })),
  };
}
export function guardContact(field, owner, p, tolerance = 0.02) {
  const clearance = guardAt(field, owner, p);
  if (clearance > tolerance) return 'excluded';
  if (field.family === 'envelope' || clearance <= 0) return 'confirmed';
  const [east, north] = tangentFrame(p);
  for (let i = 0; i < 32; i++) {
    const a = (2 * Math.PI * i) / 32,
      tangent = east.map((v, j) => v * Math.cos(a) + north[j] * Math.sin(a));
    if (guardAt(field, owner, along(p, tangent, tolerance)) <= 0) return 'confirmed';
  }
  return 'unresolved';
}
export function coastline(field, grid, mask, threshold = 0) {
  const records = [];
  const isLand = (p) => {
    const r = field.raw(p);
    return r.guarded && r.value > threshold;
  };
  const dLatitude = Math.PI / grid.height,
    dLongitude = (2 * Math.PI) / grid.width;
  for (let i = 0; i < mask.length; i++) {
    const x = i % grid.width,
      y = Math.floor(i / grid.width);
    const edges = [];
    if (y > 0 && y < grid.height) edges.push([y * grid.width + ((x + 1) % grid.width), dLatitude]);
    if (y < grid.height)
      edges.push([i + grid.width, Math.cos(Math.PI / 2 - (y + 0.5) * dLatitude) * dLongitude]);
    for (const [next, length] of edges) {
      if (mask[i] === mask[next]) continue;
      const land = mask[i] ? i : next,
        water = mask[i] ? next : i;
      const a = pointAt(grid, land),
        b = pointAt(grid, water);
      let low = 0,
        high = 1;
      for (let step = 0; step < 16; step++) {
        const mid = (low + high) / 2;
        if (isLand(arc(a, b, mid))) low = mid;
        else high = mid;
      }
      records.push({ land, owner: grid.owners[land], point: arc(a, b, (low + high) / 2), length });
    }
  }
  return records;
}
export function measure(field, grid, threshold = 0) {
  const mask = maskAt(grid, threshold),
    connected = components(grid, mask),
    coast = coastline(field, grid, mask, threshold);
  const ownerAreas = field.owners.map(() => 0);
  for (let y = 1; y < grid.height; y++)
    for (let x = 0; x < grid.width; x++) {
      const i = y * grid.width + x;
      if (mask[i]) ownerAreas[grid.owners[i]] += grid.weights[y];
    }
  let length = 0,
    confirmed = 0,
    unresolved = 0;
  for (const edge of coast) {
    length += edge.length;
    const contact = guardContact(field, edge.owner, edge.point);
    if (contact === 'confirmed') confirmed += edge.length;
    if (contact === 'unresolved') unresolved += edge.length;
  }
  const waterPercent = 100 * (1 - connected.land / connected.total);
  return {
    waterPercent,
    coverageErrorPercent: waterPercent - field.input.controls.targetWaterCoveragePercent,
    ownerShares: ownerAreas.map((area, owner) => ({
      owner,
      spherePercent: (100 * area) / connected.total,
      landPercent: connected.land ? (100 * area) / connected.land : 0,
    })),
    components: connected.records.map((record) => ({
      index: record.index,
      firstAnchor: record.firstAnchor,
      owner: record.owner,
      spherePercent: record.spherePercent,
      landPercent: record.landPercent,
    })),
    guardContact: {
      toleranceRad: 0.02,
      edges: coast.length,
      estimatedLengthRad: length,
      confirmedFraction: length ? confirmed / length : 0,
      unresolvedFraction: length ? unresolved / length : 0,
      upperFraction: length ? (confirmed + unresolved) / length : 0,
    },
  };
}
export function islandEffects(field, grid) {
  const mask = maskAt(grid),
    connected = components(grid, mask),
    coast = coastline(field, grid, mask);
  const primary = field.owners.map(
    (_, owner) => connected.records.find((record) => record.owner === owner)?.index ?? -1,
  );
  const records = field.owners.map((owner, i) =>
    owner.islands.map((shape, j) => {
      const coastPoints = coast.filter(
        (edge) => edge.owner === i && connected.labels[edge.land] === primary[i],
      );
      return {
        owner: i,
        island: j,
        kind:
          j < Math.ceil(field.input.controls.islandAbundancePercent / 25) ? 'isolated' : 'group',
        retainedWinningSamples: 0,
        principalSamples: 0,
        detachedSamples: 0,
        centerToRealizedPrincipalCoastRad: coastPoints.length
          ? Math.min(...coastPoints.map((edge) => angle(shape.center, edge.point)))
          : null,
      };
    }),
  );
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const sample = field.evaluate(pointAt(grid, i));
    if (sample.term < 0) continue;
    const record = records[sample.owner][sample.term];
    record.retainedWinningSamples++;
    if (connected.labels[i] === primary[sample.owner]) record.principalSamples++;
    else record.detachedSamples++;
  }
  const satellites = records.flat().map((row) => ({
    ...row,
    status: !row.retainedWinningSamples
      ? 'vanished'
      : row.principalSamples && row.detachedSamples
        ? 'mixed'
        : row.principalSamples
          ? 'merged'
          : 'detached',
  }));
  return {
    constructed: satellites.length,
    isolated: satellites.filter((s) => s.kind === 'isolated').length,
    grouped: satellites.filter((s) => s.kind === 'group').length,
    withinRelationshipDistance: satellites.filter(
      (s) =>
        s.centerToRealizedPrincipalCoastRad !== null && s.centerToRealizedPrincipalCoastRad <= 0.2,
    ).length,
    statuses: Object.fromEntries(
      ['vanished', 'merged', 'detached', 'mixed'].map((s) => [
        s,
        satellites.filter((r) => r.status === s).length,
      ]),
    ),
    satellites,
  };
}
