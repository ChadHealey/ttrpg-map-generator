import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import { describe, expect, it } from 'vitest';

import { ATLAS_PNG_MAXIMUM_BYTES } from '../packages/render/src/atlas-png-export.ts';
import {
  ATLAS_PNG_FIXTURE_IDS,
  exportProductionPng,
  readCanonicalScene,
} from './atlas-png-fixture-support.mjs';
import { inspectAtlasPngPixels } from './atlas-png-test-support.mjs';

const RELEASE_DIMENSIONS = Object.freeze({ widthPx: 8_192, heightPx: 4_096 });
const PROOF_OUTPUT_DIRECTORY = process.env['ATLAS_PNG_PROOF_OUTPUT_DIR'];

describe('atlas-png-v1 8192 by 4096 release workload', () => {
  it.each(ATLAS_PNG_FIXTURE_IDS)(
    'exports %s twice with exact bytes and bounded resources',
    async (fixtureId) => {
      const scene = readCanonicalScene(fixtureId);
      const started = performance.now();
      const first = await exportProductionPng(scene, RELEASE_DIMENSIONS);
      const second = await exportProductionPng(scene, RELEASE_DIMENSIONS);
      const elapsedMilliseconds = performance.now() - started;

      expect(first.ok, first.ok ? undefined : JSON.stringify(first.diagnostics)).toBe(true);
      expect(second.ok, second.ok ? undefined : JSON.stringify(second.diagnostics)).toBe(true);
      if (!first.ok || !second.ok) return;
      expect(Buffer.compare(Buffer.from(first.value.bytes), Buffer.from(second.value.bytes))).toBe(
        0,
      );
      expect(first.value.byteLength).toBeLessThanOrEqual(ATLAS_PNG_MAXIMUM_BYTES);
      expect(first.value.resources).toMatchObject({
        maximumLiveBands: 1,
        maximumLiveRasterBytes: 7_864_320,
        maximumRawRgbRowBytes: 24_576,
        maximumFilteredRowBytes: 24_577,
        maximumLiveRowBufferBytes: 73_729,
        maximumCompressedAssemblyBytes: 67_108_864,
        maximumConcurrentEncodedBytes: 134_217_728,
        hasFullSizeRasterSurface: false,
      });
      expect(first.value.resources.maximumObservedLiveRasterBytes).toBeLessThanOrEqual(7_864_320);

      const inspected = await inspectAtlasPngPixels(
        first.value.bytes,
        RELEASE_DIMENSIONS,
        boundaryRows(RELEASE_DIMENSIONS.heightPx),
      );
      expect(inspected.sampledRows.size).toBe(boundaryRows(RELEASE_DIMENSIONS.heightPx).length);
      const sha256 = createHash('sha256').update(first.value.bytes).digest('hex');
      console.info(
        `${fixtureId}: ${String(first.value.byteLength)} bytes, sha256 ${sha256}, two local exports ${elapsedMilliseconds.toFixed(0)} ms`,
      );
      if (PROOF_OUTPUT_DIRECTORY !== undefined) {
        mkdirSync(PROOF_OUTPUT_DIRECTORY, { recursive: true });
        writeFileSync(
          resolve(PROOF_OUTPUT_DIRECTORY, `${fixtureId}.8192x4096.png`),
          first.value.bytes,
        );
      }
    },
    300_000,
  );
});

function boundaryRows(heightPx) {
  const rows = new Set([0, 1, heightPx - 2, heightPx - 1]);
  for (let boundary = 64; boundary < heightPx; boundary += 64) {
    rows.add(boundary - 1);
    rows.add(boundary);
    rows.add(boundary + 1);
  }
  return [...rows].sort((left, right) => left - right);
}
