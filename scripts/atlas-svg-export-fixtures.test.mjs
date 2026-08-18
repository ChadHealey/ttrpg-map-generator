import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ATLAS_SVG_MAXIMUM_BYTES,
  exportAtlasSceneToSvg,
} from '../packages/render/src/atlas-svg-export.ts';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..');
const STYLE = {
  styleId: 'atlas-style.restrained-ink',
  styleBehaviorVersion: 1,
  tokenVersion: 1,
};
const FIXTURE_IDS = [
  'milestone-2-atlas-connected-majority',
  'milestone-2-atlas-control-max',
  'milestone-2-atlas-control-min',
  'milestone-2-atlas-fragmented-islands',
  'milestone-2-atlas-proof',
  'milestone-2-atlas-seam-crossing',
];

describe('registered atlas-svg-v1 evidence', () => {
  it.each(FIXTURE_IDS)('byte-matches %s from its complete canonical scene', (fixtureId) => {
    const scene = JSON.parse(
      readFileSync(
        resolve(
          REPOSITORY_ROOT,
          `fixtures/fixed-seeds/${fixtureId}/expected/baseline/atlas-render-scene.scene.canonical`,
        ),
        'utf8',
      ),
    );
    const expected = readFileSync(
      resolve(REPOSITORY_ROOT, `fixtures/canonical-svg/${fixtureId}/baseline.svg`),
    );

    const result = exportAtlasSceneToSvg({ scene, style: STYLE });

    expect(result.ok, result.ok ? undefined : JSON.stringify(result.diagnostics)).toBe(true);
    if (!result.ok) return;
    expect(Buffer.from(result.value.bytes)).toEqual(expected);
    expect(result.value.byteLength).toBeLessThanOrEqual(ATLAS_SVG_MAXIMUM_BYTES);
    expect([...result.value.svg.matchAll(/ data-render-node-id=/gu)]).toHaveLength(
      scene.nodes.length,
    );
    expect(result.value.svg).not.toMatch(/<text\b|font-family=/u);
  });
});
