/** Unaccepted fixed contour policies; no released accepted-record types are fabricated. */
import { planetPointToAngles, roundTiesAwayFromZero } from '@ttrpg-map/core';
import {
  atlasPlanetContourExtractionAdapter,
  atlasPlanetTopologyValidationAdapter,
  type AtlasSamplingProfile,
  classifyAtlasLandWater,
  createAtlasContourLevel,
  getAtlasGridVertex,
  getAtlasSampleAnchorCount,
  getAtlasSampleStorageIndex,
  parseAtlasFieldValueTicks,
  quantizeAtlasFieldValue,
  type QuantizedSphericalField,
  simplifyAtlasCoastlineRing,
} from '@ttrpg-map/generation';

import {
  componentGraph,
  type Digest,
  ringCorrespondence,
  validateSimplifiedPredecessor,
} from './correspondence.js';
import { extractRegularZeroContours } from './zero-contours.js';
export type Policy = 'Z' | 'H';
export const POLICY_VERSIONS = {
  Z: { policy: 'Z1', geometry: 2, extraction: 2 },
  H: { policy: 'H1', geometry: 1, extraction: 1 },
} as const;
export function normalize(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('Finite continuous field required');
  return Math.min(1, Math.max(-1, value)) || 0;
}
export function quantize(value: number) {
  const result = quantizeAtlasFieldValue(normalize(value));
  if (!result.ok) throw new Error(result.diagnostic.message);
  return result.value;
}
export function halfContour() {
  const tick = parseAtlasFieldValueTicks(0);
  if (!tick.ok) throw new Error(tick.diagnostic.message);
  const contour = createAtlasContourLevel(tick.value);
  if (!contour.ok) throw new Error(contour.diagnostic.message);
  return contour.value;
}
export function fieldFromTicks(
  profile: AtlasSamplingProfile,
  ticks: Int32Array,
): QuantizedSphericalField {
  if (!(ticks instanceof Int32Array)) throw new RangeError('Int32 tick array required');
  const count = getAtlasSampleAnchorCount(profile);
  if (ticks.length !== count) throw new RangeError('Exact unique-anchor count required');
  for (const tick of ticks) {
    const result = parseAtlasFieldValueTicks(tick);
    if (!result.ok) throw new RangeError(result.diagnostic.message);
  }
  return {
    profile,
    sampleCount: count,
    valueAt: (x, y) => {
      const value = ticks[getAtlasSampleStorageIndex(profile, x, y)];
      const result = parseAtlasFieldValueTicks(value);
      if (!result.ok) throw new RangeError(result.diagnostic.message);
      return result.value;
    },
  };
}
export function zeroPreflight(field: QuantizedSphericalField) {
  let zeros = 0,
    ties = 0;
  let firstZero: number | null = null,
    firstTie: readonly number[] | null = null;
  const w = field.profile.longitudeCellCount,
    h = field.profile.latitudeBandCount;
  for (let y = 0; y <= h; y++) {
    for (let x = 0; x < (y === 0 || y === h ? 1 : w); x++) {
      if (field.valueAt(x, y) === 0) {
        zeros++;
        firstZero ??= getAtlasSampleStorageIndex(field.profile, x, y);
      }
    }
  }
  for (let y = 1; y < h - 1; y++)
    for (let x = 0; x < w; x++) {
      const a = field.valueAt(x, y),
        b = field.valueAt((x + 1) % w, y),
        c = field.valueAt((x + 1) % w, y + 1),
        d = field.valueAt(x, y + 1);
      if (
        a !== 0 &&
        b !== 0 &&
        c !== 0 &&
        d !== 0 &&
        a > 0 === c > 0 &&
        b > 0 === d > 0 &&
        a > 0 !== b > 0 &&
        BigInt(a) * BigInt(c) === BigInt(b) * BigInt(d)
      ) {
        ties++;
        firstTie ??= [x, y];
      }
    }
  return { zeros, firstZero, ties, firstTie };
}
export function extractPolicy(field: QuantizedSphericalField, policy: unknown, digest: Digest) {
  if (policy !== 'Z' && policy !== 'H') throw new RangeError('Only declared Z/H policies allowed');
  const preflight = policy === 'Z' ? zeroPreflight(field) : null;
  if (preflight && (preflight.zeros || preflight.ties))
    return {
      status: 'no-proposal' as const,
      policy,
      preflight,
      failures: [
        ...(preflight.zeros ? ['zero-anchor-degeneracy'] : []),
        ...(preflight.ties ? ['zero-saddle-degeneracy'] : []),
      ],
      extraction: null,
      simplified: null,
      correspondence: null,
    };
  const extraction =
    policy === 'Z'
      ? extractRegularZeroContours(field)
      : atlasPlanetContourExtractionAdapter.extract(field, halfContour());
  const failures: string[] = extraction.diagnostics.map((d) => d.code);
  const graph = componentGraph(field, policy, digest);
  const correspondence = ringCorrespondence(extraction.rings, graph, digest);
  failures.push(...correspondence.failures);
  const simplified = extraction.rings.map((r) => simplifyAtlasCoastlineRing(r, field.profile));
  simplified.forEach((s, i) => {
    const raw = extraction.rings[i];
    if (!raw || !validateSimplifiedPredecessor(raw, s.ring))
      failures.push('ambiguous-simplified-predecessor');
  });
  failures.push(
    ...atlasPlanetTopologyValidationAdapter
      .validate(simplified.map((s) => s.ring))
      .map((d) => d.code),
  );
  return {
    status: failures.length ? ('no-proposal' as const) : ('extracted' as const),
    policy,
    preflight,
    failures,
    extraction,
    simplified,
    correspondence,
  };
}
/** Execute the actual public classifier with H=1: its anchor bits equal Z's tick>0 rule. */
export async function classify(field: QuantizedSphericalField, target: number) {
  if (!Number.isFinite(target) || target < 0 || target > 100)
    throw new RangeError('Finite coverage target required');
  const result = await classifyAtlasLandWater(field, halfContour(), target, {
    cooperate: () => Promise.resolve(false),
  });
  if (result.status !== 'completed') throw new Error('Uncancelled classification failed');
  return result.output;
}
/** Attributed exact equations, checked against the public classifier; not threshold selection. */
export function coverageReference(field: QuantizedSphericalField, target: number) {
  let total = 0,
    water = 0;
  for (let y = 1; y < field.profile.latitudeBandCount; y++) {
    const angle = planetPointToAngles(getAtlasGridVertex(field.profile, 0, y)).latitudeRad;
    const weight = roundTiesAwayFromZero(Math.cos(angle) * 2 ** 20);
    for (let x = 0; x < field.profile.longitudeCellCount; x++) {
      total += weight;
      if (field.valueAt(x, y) <= 0) water += weight;
    }
  }
  const stable = (x: number) => roundTiesAwayFromZero(x * 1e6) / 1e6 || 0;
  const percent = total === 0 ? 0 : stable((water / total) * 100);
  return {
    totalWeight: total,
    waterWeight: water,
    realizedWaterCoveragePercent: percent,
    absoluteWaterCoverageErrorBasisPoints: stable(Math.abs(percent - target) * 100),
  };
}

export { validateSimplifiedPredecessor } from './correspondence.js';
export { interpolateContourTick } from './zero-geometry.js';
