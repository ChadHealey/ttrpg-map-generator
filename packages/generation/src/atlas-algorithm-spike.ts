/** Deterministic issue #56 harness; it proposes no accepted geography and performs no commit. */

import { summarizeSphericalPartition } from './atlas-algorithm-spike-components.js';
import { atlasAlgorithmSpikeContourAdapter } from './atlas-algorithm-spike-contours.js';
import {
  type AtlasAlgorithmSpikeCase,
  createAtlasAlgorithmSpikeField,
  sampleAtlasAlgorithmSpikeField,
  selectAtlasAlgorithmSpikeContourLevel,
} from './atlas-algorithm-spike-field.js';
import { doesProposedRingCrossSeam } from './atlas-algorithm-spike-topology.js';
import {
  type AtlasSamplingProfile,
  isAtlasLand,
  WORLD_ATLAS_PREVIEW_PROFILE,
} from './atlas-sampling-profiles.js';

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const UINT64_MASK = (1n << 64n) - 1n;

export interface AtlasAlgorithmSpikeReport {
  readonly fixtureId: AtlasAlgorithmSpikeCase['fixtureId'];
  readonly profileId: AtlasSamplingProfile['profileId'];
  readonly sampleCount: number;
  readonly contourLevelDoubledTicks: number;
  readonly fieldFingerprint: string;
  readonly landComponentCount: number;
  readonly waterComponentCount: number;
  readonly largestLandAnchorCount: number;
  readonly largestWaterAnchorCount: number;
  readonly ringCount: number;
  readonly segmentCount: number;
  readonly seamCrossingRingCount: number;
  readonly southPoleIsLand: boolean;
  readonly northPoleIsLand: boolean;
  readonly componentWorkingBytes: number;
}

/** Run sampling, shared-threshold classification, components, contours, and validation. */
export function runAtlasAlgorithmSpikeCase(
  spike: AtlasAlgorithmSpikeCase,
  profile: AtlasSamplingProfile,
): AtlasAlgorithmSpikeReport {
  const adapter = createAtlasAlgorithmSpikeField(spike);
  const preview = sampleAtlasAlgorithmSpikeField(WORLD_ATLAS_PREVIEW_PROFILE, adapter);
  const contourLevel = selectAtlasAlgorithmSpikeContourLevel(
    preview,
    spike.controls.targetWaterCoveragePercent,
  );
  const field =
    profile.profileId === WORLD_ATLAS_PREVIEW_PROFILE.profileId
      ? preview
      : sampleAtlasAlgorithmSpikeField(profile, adapter);
  const partition = summarizeSphericalPartition(field, contourLevel);
  const contours = atlasAlgorithmSpikeContourAdapter.extract(field, contourLevel);
  if (contours.diagnostics.length > 0) {
    throw new Error(
      `Atlas algorithm spike ${spike.fixtureId} failed: ${contours.diagnostics
        .map(({ code }) => code)
        .join(', ')}.`,
    );
  }

  return Object.freeze({
    fixtureId: spike.fixtureId,
    profileId: profile.profileId,
    sampleCount: field.sampleCount,
    contourLevelDoubledTicks: contourLevel,
    fieldFingerprint: fingerprintField(field),
    landComponentCount: partition.land.componentCount,
    waterComponentCount: partition.water.componentCount,
    largestLandAnchorCount: partition.land.largestComponentAnchorCount,
    largestWaterAnchorCount: partition.water.largestComponentAnchorCount,
    ringCount: contours.rings.length,
    segmentCount: contours.segmentCount,
    seamCrossingRingCount: contours.rings.filter(doesProposedRingCrossSeam).length,
    southPoleIsLand: isAtlasLand(field.valueAt(0, 0), contourLevel),
    northPoleIsLand: isAtlasLand(field.valueAt(0, profile.latitudeBandCount), contourLevel),
    componentWorkingBytes: partition.componentWorkingBytes,
  });
}

function fingerprintField(field: Parameters<typeof summarizeSphericalPartition>[0]): string {
  let fingerprint = FNV_OFFSET;
  for (
    let latitudeIndex = 0;
    latitudeIndex <= field.profile.latitudeBandCount;
    latitudeIndex += 1
  ) {
    const longitudeCount =
      latitudeIndex === 0 || latitudeIndex === field.profile.latitudeBandCount
        ? 1
        : field.profile.longitudeCellCount;
    for (let longitudeIndex = 0; longitudeIndex < longitudeCount; longitudeIndex += 1) {
      const value = field.valueAt(longitudeIndex, latitudeIndex);
      for (let shift = 0; shift < 32; shift += 8) {
        fingerprint ^= BigInt((value >>> shift) & 0xff);
        fingerprint = (fingerprint * FNV_PRIME) & UINT64_MASK;
      }
    }
  }
  return fingerprint.toString(16).padStart(16, '0');
}
