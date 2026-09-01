import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';

import {
  MAP_KINDS,
  reconstructAcceptedAtlas,
  type WorldPhysicalContextRecords,
} from '@ttrpg-map/core';
import {
  canonicalAspectBytes,
  canonicalAspectOutputBytes,
  decodeMapworld,
} from '@ttrpg-map/persistence';
import { expect, it } from 'vitest';

it.skipIf(process.env.ISSUE_138_CANDIDATE_DIRECTORY === undefined)(
  'measures generator-free physical/context decode',
  () => {
    const candidateDirectory = process.env.ISSUE_138_CANDIDATE_DIRECTORY;
    const resultPath = process.env.ISSUE_138_RESULT_PATH;
    if (candidateDirectory === undefined || resultPath === undefined) {
      throw new Error('Issue 138 measurement paths are required.');
    }
    const pkg = {
      files: listFiles(candidateDirectory).map((path) => ({
        path,
        bytes: new Uint8Array(readFileSync(`${candidateDirectory}/${path}`)),
      })),
    };
    const started = performance.now();
    const decoded = decodeMapworld(pkg);
    const elapsedMs = performance.now() - started;
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) throw new Error(JSON.stringify(decoded.diagnostics));
    const accepted = reconstructAcceptedAtlas(decoded.value);
    expect(accepted.status).toBe('accepted');
    if (accepted.status !== 'accepted' || accepted.value.physical === undefined) {
      throw new Error('Expected generator-free physical reconstruction.');
    }
    const region = decoded.value.maps.find(({ mapKind }) => mapKind === MAP_KINDS.regional);
    if (region?.mapKind !== MAP_KINDS.regional || region.parent.inheritedContext === undefined) {
      throw new Error('Expected inline inherited context.');
    }
    expect(region.parent.inheritedContext.footprint.origin.latitudeTicks).toBe(-(2 ** 30));
    const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
    const physicalAspects = decoded.value.maps
      .flatMap(({ aspects }) => aspects)
      .filter(({ aspectName }) =>
        [
          'worldClimate.moisture',
          'worldClimate.prevailingWinds',
          'worldClimate.temperature',
          'worldClimate.zones',
          'worldEcology.biomeBelts',
          'worldHydrology.majorLakes',
          'worldHydrology.majorRivers',
          'worldHydrology.watersheds',
          'worldTerrain.mountainSystems',
        ].includes(aspectName),
      );
    expect(physicalAspects).toHaveLength(9);
    const framedEvidence = physicalAspects
      .map((item) => {
        const complete = required(canonicalAspectBytes(item));
        const output = required(canonicalAspectOutputBytes(item));
        return {
          aspectId: item.aspectId,
          completeBytes: complete.byteLength,
          completeSha256: sha256(complete),
          outputBytes: output.byteLength,
          outputSha256: sha256(output),
        };
      })
      .sort((left, right) => left.aspectId.localeCompare(right.aspectId));
    writeFileSync(
      resultPath,
      `${JSON.stringify(
        {
          elapsedMs,
          peakRssBytes: process.resourceUsage().maxRSS * 1024,
          generatorInvocations: 0,
          decodedAspectCount: physicalAspects.length,
          logicalFingerprints: physicalFingerprints(accepted.value.physical),
          inheritedContextChecksum: region.parent.inheritedContext.semanticChecksum.value,
          framedEvidence,
        },
        null,
        2,
      )}\n`,
    );
  },
  300_000,
);

function listFiles(root: string, prefix = ''): string[] {
  const directory = prefix.length === 0 ? root : `${root}/${prefix}`;
  return readdirSync(directory)
    .flatMap((name) => {
      const path = prefix.length === 0 ? name : `${prefix}/${name}`;
      return statSync(`${root}/${path}`).isDirectory() ? listFiles(root, path) : [path];
    })
    .sort();
}

function physicalFingerprints(records: WorldPhysicalContextRecords) {
  return {
    biomeBelts: records.biomeBelts.provenance.fingerprint,
    climateZones: records.climateZones.provenance.fingerprint,
    moisture: records.moisture.provenance.fingerprint,
    prevailingWindsSpeed: records.prevailingWinds.speed.provenance.fingerprint,
    prevailingWindsX: records.prevailingWinds.xComponents.provenance.fingerprint,
    prevailingWindsY: records.prevailingWinds.yComponents.provenance.fingerprint,
    prevailingWindsZ: records.prevailingWinds.zComponents.provenance.fingerprint,
    temperature: records.temperature.provenance.fingerprint,
    watersheds: records.watersheds.provenance.fingerprint,
  };
}

function required<Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false },
): Value {
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.value;
}
