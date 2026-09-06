/** One continuous evaluation per canonical full-profile anchor; no preview or threshold search. */
import assert from 'node:assert/strict';

import { BUDGET } from './corpus.mjs';
import { digest, oceanPredicate, POLAR_TICK_CUTOFF, ratio } from './metrics.mjs';
import { hash } from './runtime.mjs';
export function canonicalBytes(values, kind) {
  assert(['f64', 'i32'].includes(kind));
  const bytes = Buffer.alloc(values.length * (kind === 'f64' ? 8 : 4));
  values.forEach((v, i) =>
    kind === 'f64' ? bytes.writeDoubleLE(v, i * 8) : bytes.writeInt32LE(v, i * 4),
  );
  return bytes;
}
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
export async function sampleField(row, runtime, budget) {
  const { generation: g, core, bridge } = runtime,
    profile = g.WORLD_ATLAS_FULL_PROFILE,
    count = g.getAtlasSampleAnchorCount(profile);
  assert.equal(profile.profileId, BUDGET.profile);
  assert.equal(count, BUDGET.anchorsPerField);
  const field = runtime.createPlacedField(row.placement.owners, row.input),
    ticks = new Int32Array(count),
    normalized = new Float64Array(count),
    bits = Buffer.alloc(Math.ceil(count / 8));
  const original = [],
    owners = row.placement.owners.map((o) => {
      const bodyIndex = original.length;
      original.push({ id: o.id + '/body', ownerId: o.id, kind: 'body', landAnchorCount: 0 });
      const islands = o.candidate.islands.map((island) => {
        const index = original.length;
        original.push({ id: island.id, ownerId: o.id, kind: island.kind, landAnchorCount: 0 });
        return {
          index,
          polygon: island.polygon,
          bounds: [
            Math.min(...island.polygon.map((p) => p[0])),
            Math.max(...island.polygon.map((p) => p[0])),
            Math.min(...island.polygon.map((p) => p[1])),
            Math.max(...island.polygon.map((p) => p[1])),
          ],
        };
      });
      return { ...o, bodyIndex, islandBounds: islands };
    }),
    membership = new Int32Array(count).fill(-1),
    weights = core.createAtlasRowWeights();
  const caps = { north: [0, 0], south: [0, 0], combined: [0, 0] },
    ownerWeights = owners.map(() => 0);
  let visited = 0,
    total = 0,
    landWeight = 0,
    landZ2 = 0,
    zeroCount = 0,
    negativeSaturation = 0,
    positiveSaturation = 0,
    ambiguousMembership = 0,
    stage = 'sampling';
  const summary = {
    key: row.fieldKey,
    profileId: profile.profileId,
    stages: [],
    scope:
      'Full-profile H diagnostic only; original role certificates are not transferred to sampled geometry',
  };
  let reader = null,
    partition = null;
  try {
    for (let y = 0; y <= profile.latitudeBandCount; y++) {
      const pole = y === 0 || y === profile.latitudeBandCount;
      for (let x = 0; x < (pole ? 1 : profile.longitudeCellCount); x++) {
        const index = g.getAtlasSampleStorageIndex(profile, x, y),
          point = g.getAtlasGridVertex(profile, x, y),
          a = core.planetPointToAngles(point),
          weight = weights[y];
        const vector = [
          Math.cos(a.latitudeRad) * Math.cos(a.longitudeRad),
          Math.cos(a.latitudeRad) * Math.sin(a.longitudeRad),
          Math.sin(a.latitudeRad),
        ];
        budget.charge('scalarEvaluations');
        const value = field.evaluate(vector);
        normalized[index] = bridge.normalize(value);
        ticks[index] = bridge.quantizeNormalized(normalized[index]);
        visited++;
        zeroCount += ticks[index] === 0 ? 1 : 0;
        negativeSaturation += value < -1 ? 1 : 0;
        positiveSaturation += value > 1 ? 1 : 0;
        const land = ticks[index] > 0;
        total += weight;
        if (land) {
          bits[index >> 3] |= 1 << (index & 7);
          landWeight += weight;
          landZ2 += weight * vector[2] ** 2;
        }
        if (Math.abs(point.latitudeTicks) >= POLAR_TICK_CUTOFF) {
          const c = caps[point.latitudeTicks > 0 ? 'north' : 'south'];
          c[1] += weight;
          caps.combined[1] += weight;
          if (land) {
            c[0] += weight;
            caps.combined[0] += weight;
          }
        }
        if (land) {
          const positive = owners.flatMap((o, i) =>
            Math.acos(Math.max(-1, Math.min(1, dot(o.center, vector)))) < o.radius ? [i] : [],
          );
          if (positive.length !== 1) {
            ambiguousMembership++;
            continue;
          }
          const oi = positive[0],
            owner = owners[oi];
          ownerWeights[oi] += weight;
          const local = runtime.forwardLambert([
            dot(owner.east, vector),
            dot(owner.north, vector),
            dot(owner.center, vector),
          ]);
          const islands = owner.islandBounds.filter(
            (i) =>
              local[0] >= i.bounds[0] &&
              local[0] <= i.bounds[1] &&
              local[1] >= i.bounds[2] &&
              local[1] <= i.bounds[3] &&
              runtime.pointLocation(local, i.polygon) >= 0,
          );
          if (islands.length > 1) {
            ambiguousMembership++;
            continue;
          }
          const ci = islands[0]?.index ?? owner.bodyIndex;
          membership[index] = ci;
          original[ci].landAnchorCount++;
        }
      }
    }
    summary.stages.push({ stage, status: 'completed' });
    summary.polar = Object.fromEntries(Object.entries(caps).map(([k, [n, d]]) => [k, ratio(n, d)]));
    summary.polar.globalLand = ratio(landWeight, total);
    summary.polar.landMeanZSquared = landWeight ? landZ2 / landWeight : null;
    summary.owners = owners.map((o, i) => ({
      id: o.id,
      quota: o.quota,
      weightedFraction: ownerWeights[i] / total,
      absolutePercentagePointError: Math.abs(ownerWeights[i] / total - o.quota) * 100,
      scope: 'full-profile diagnostic, not a preview gate',
    }));
    stage = 'classification';
    const classified = await bridge.classify(ticks, row.input.controls.targetWaterCoveragePercent);
    const dense = Array.from({ length: count }, (_, i) => classified.samples.at(i));
    reader = bridge.immutableReader(dense);
    for (let i = 0; i < count; i++)
      assert.equal(
        reader.at(i),
        bits[i >> 3] & (1 << (i & 7)) ? 'land' : 'water',
        'Public classifier changed declared H anchor bits',
      );
    summary.coverage = {
      realizedWaterCoveragePercent: classified.realizedWaterCoveragePercent,
      absoluteWaterCoverageErrorBasisPoints: classified.absoluteWaterCoverageErrorBasisPoints,
      totalCoveragePass: classified.absoluteWaterCoverageErrorBasisPoints <= 25,
    };
    summary.stages.push({ stage, status: 'completed' });
    stage = 'partition';
    budget.charge('partitions');
    partition = core.analyzeAtlasSurfacePartition(reader);
    assert.deepEqual(partition.rowWeights, weights);
    const provenance = new Map();
    for (let i = 0; i < count; i++)
      if (membership[i] >= 0) {
        const p = partition.componentIndexBySample[i];
        if (!provenance.has(p)) provenance.set(p, new Set());
        provenance.get(p).add(membership[i]);
      }
    const landComponents = partition.components.filter((c) => c.kind === 'land');
    summary.partition = {
      components: partition.components,
      componentIndexInt32LESha256: hash(canonicalBytes(partition.componentIndexBySample, 'i32')),
      rawWaterCount: partition.components.filter((c) => c.kind === 'water').length,
      landCount: landComponents.length,
      semanticLandKinds: landComponents.map((c) => ({
        analysisIndex: c.analysisIndex,
        kind: core.classifyAtlasLandmassKind(c.sphericalAreaWeight, landWeight),
        sphericalAreaWeight: c.sphericalAreaWeight,
      })),
      originalToSampled: [...provenance].map(([analysisIndex, indices]) => ({
        analysisIndex,
        originalIds: [...indices].sort((a, b) => a - b).map((i) => original[i].id),
      })),
    };
    summary.stages.push({ stage, status: 'completed' });
    summary.status = 'completed';
  } catch (error) {
    summary.status = `${stage}-exception`;
    summary.error = {
      name: error.name,
      message: String(error.message).replaceAll(
        /(?:\/Users\/|\/private\/tmp\/|\/tmp\/)[^\s)]+/g,
        '[local path]',
      ),
    };
    summary.stages.push({ stage, status: 'exception' });
  }
  summary.actualAnchors = visited;
  summary.expectedAnchors = count;
  summary.zeroCount = zeroCount;
  summary.saturation = { negative: negativeSaturation, positive: positiveSaturation };
  summary.originalComponents = original;
  summary.ambiguousMembership = ambiguousMembership;
  summary.normalizedFloat64LESha256 = hash(canonicalBytes(normalized.subarray(0, visited), 'f64'));
  summary.ticksInt32LESha256 = hash(canonicalBytes(ticks.subarray(0, visited), 'i32'));
  summary.landBitsSha256 = hash(bits);
  summary.originalComponentIndexInt32LESha256 = hash(canonicalBytes(membership, 'i32'));
  summary.hashScope =
    visited === count
      ? 'complete canonical profile'
      : 'completed canonical prefix; full bit buffer includes unvisited zero padding';
  return { ok: summary.status === 'completed', summary, bits, reader, partition };
}
export function semantic(sampled, mode, runtime) {
  assert(sampled.ok && sampled.reader && sampled.partition);
  const result = runtime.core.segmentAtlasWaterBodies(sampled.reader, sampled.partition, mode);
  return {
    mode,
    policyVersion: runtime.core.ATLAS_SEMANTIC_POLICY_VERSION,
    predicate: oceanPredicate(result, mode),
    regions: result.ok ? result.regions : [],
    regionIndexInt32LESha256: result.ok
      ? hash(canonicalBytes(result.regionIndexBySample, 'i32'))
      : null,
    unchangedSamplesSha256: sampled.summary.landBitsSha256,
    semanticEntityIdsCreated: false,
    resultSha256: digest(
      result.ok
        ? {
            ok: true,
            regions: result.regions,
            indexHash: hash(canonicalBytes(result.regionIndexBySample, 'i32')),
          }
        : result,
    ),
  };
}
