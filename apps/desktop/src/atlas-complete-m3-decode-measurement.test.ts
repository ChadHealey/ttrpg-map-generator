import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';

import {
  isAtlasLabelAcceptedAspectName,
  MAP_KINDS,
  reconstructAcceptedAtlas,
  type WorldPhysicalContextRecords,
} from '@ttrpg-map/core';
import {
  canonicalAspectBytes,
  canonicalAspectOutputBytes,
  decodeMapworld,
} from '@ttrpg-map/persistence';
import { expect, it, vi } from 'vitest';

const generatorTripwire = vi.hoisted(() =>
  vi.fn((generatorName: string) => {
    throw new Error(`Generator-free decode accessed ${generatorName}.`);
  }),
);

vi.mock('@ttrpg-map/core', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createWorldFeatureNameProposals: () => generatorTripwire('createWorldFeatureNameProposals'),
    rerollWorldFeatureName: () => generatorTripwire('rerollWorldFeatureName'),
    resolveAtlasLabelPlacements: () => generatorTripwire('resolveAtlasLabelPlacements'),
  };
});

vi.mock(
  '@ttrpg-map/generation',
  () =>
    new Proxy(
      {},
      {
        get: (_target, property) => generatorTripwire(`@ttrpg-map/generation.${String(property)}`),
      },
    ),
);

const PHYSICAL_ASPECT_NAMES: ReadonlySet<string> = new Set([
  'worldClimate.moisture',
  'worldClimate.prevailingWinds',
  'worldClimate.temperature',
  'worldClimate.zones',
  'worldEcology.biomeBelts',
  'worldHydrology.majorLakes',
  'worldHydrology.majorRivers',
  'worldHydrology.watersheds',
  'worldTerrain.mountainSystems',
]);

it.skipIf(process.env.ISSUE_151_CANDIDATE_DIRECTORY === undefined)(
  'measures generator-free complete M3 decode',
  () => {
    const candidateDirectory = process.env.ISSUE_151_CANDIDATE_DIRECTORY;
    const resultPath = process.env.ISSUE_151_RESULT_PATH;
    if (candidateDirectory === undefined || resultPath === undefined) {
      throw new Error('Issue 151 measurement paths are required.');
    }
    const pkg = {
      files: listFiles(candidateDirectory).map((path) => ({
        path,
        bytes: new Uint8Array(readFileSync(`${candidateDirectory}/${path}`)),
      })),
    };
    generatorTripwire.mockClear();
    const started = performance.now();
    const decoded = decodeMapworld(pkg);
    const elapsedMs = performance.now() - started;
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) throw new Error(JSON.stringify(decoded.diagnostics));
    const accepted = reconstructAcceptedAtlas(decoded.value);
    expect(accepted.status).toBe('accepted');
    if (
      accepted.status !== 'accepted' ||
      accepted.value.physical === undefined ||
      accepted.value.labels === undefined
    ) {
      throw new Error('Expected generator-free complete M3 reconstruction.');
    }
    const region = decoded.value.maps.find(({ mapKind }) => mapKind === MAP_KINDS.regional);
    if (region?.mapKind !== MAP_KINDS.regional || region.parent.inheritedContext === undefined) {
      throw new Error('Expected inline inherited context.');
    }
    const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
    const externalAspects = decoded.value.maps
      .flatMap(({ aspects }) => aspects)
      .filter(
        ({ aspectName }) =>
          PHYSICAL_ASPECT_NAMES.has(aspectName) || isAtlasLabelAcceptedAspectName(aspectName),
      );
    const framedEvidence = externalAspects
      .map((item) => {
        const complete = required(canonicalAspectBytes(item));
        const output = required(canonicalAspectOutputBytes(item));
        return {
          aspectId: item.aspectId,
          aspectName: item.aspectName,
          completeBytes: complete.byteLength,
          completeSha256: sha256(complete),
          outputBytes: output.byteLength,
          outputSha256: sha256(output),
        };
      })
      .sort((left, right) => compareCodePointText(left.aspectId, right.aspectId));
    const labels = framedEvidence.filter(({ aspectName }) =>
      isAtlasLabelAcceptedAspectName(aspectName),
    );
    writeFileSync(
      resultPath,
      `${JSON.stringify(
        {
          elapsedMs,
          peakRssBytes: process.resourceUsage().maxRSS * 1024,
          generatorInvocations: generatorTripwire.mock.calls.length,
          decodedAspectCount: externalAspects.length,
          physicalAspectCount: externalAspects.length - labels.length,
          nameCount: accepted.value.labels.names.length,
          placementCount: accepted.value.labels.placements.length,
          manualOverrideCount: accepted.value.labels.names.filter(
            ({ origin }) => origin === 'manual-override',
          ).length,
          physicalFingerprints: physicalFingerprints(accepted.value.physical),
          labelAcceptedStateSha256: sha256(
            new TextEncoder().encode(
              labels
                .map(({ aspectId, completeSha256 }) => `${aspectId}\0${completeSha256}`)
                .join('\n'),
            ),
          ),
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

function compareCodePointText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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
