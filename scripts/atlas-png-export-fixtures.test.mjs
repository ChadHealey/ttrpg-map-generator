import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ATLAS_PNG_MAXIMUM_BYTES } from '../packages/render/src/atlas-png-export.ts';
import {
  ATLAS_PNG_FIXTURE_IDS,
  exportProductionPng,
  readCanonicalScene,
} from './atlas-png-fixture-support.mjs';
import { inspectAtlasPngPixels } from './atlas-png-test-support.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..');
const GALLERY_DIMENSIONS = Object.freeze({ widthPx: 1_600, heightPx: 800 });

describe('registered atlas-png-v1 gallery evidence', () => {
  it.each(ATLAS_PNG_FIXTURE_IDS)(
    'byte-matches %s from its complete canonical scene',
    async (fixtureId) => {
      const scene = readCanonicalScene(fixtureId);
      const expected = readFileSync(
        resolve(REPOSITORY_ROOT, `fixtures/visual-gallery/${fixtureId}/baseline.png`),
      );
      const result = await exportProductionPng(scene, GALLERY_DIMENSIONS);

      expect(result.ok, result.ok ? undefined : JSON.stringify(result.diagnostics)).toBe(true);
      if (!result.ok) return;
      expect(Buffer.compare(Buffer.from(result.value.bytes), expected)).toBe(0);
      expect(result.value.byteLength).toBeLessThanOrEqual(ATLAS_PNG_MAXIMUM_BYTES);
      expect(result.value.resources).toMatchObject({
        maximumLiveBands: 1,
        bandCoreHeightPx: 64,
        bandHaloPx: 8,
        hasFullSizeRasterSurface: false,
      });
      await inspectAtlasPngPixels(result.value.bytes, GALLERY_DIMENSIONS, [0, 63, 64, 799]);
    },
    120_000,
  );
});
