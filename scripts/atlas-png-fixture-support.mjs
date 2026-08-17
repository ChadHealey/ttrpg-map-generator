/** Shared production-export access for PNG fixture verification. */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { exportAtlasSceneToPngAsync } from '../packages/render/src/atlas-png-export.ts';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..');
const STYLE = Object.freeze({
  styleId: 'atlas-style.restrained-ink',
  styleBehaviorVersion: 1,
  tokenVersion: 1,
});

export const ATLAS_PNG_FIXTURE_IDS = Object.freeze([
  'milestone-2-atlas-connected-majority',
  'milestone-2-atlas-control-max',
  'milestone-2-atlas-control-min',
  'milestone-2-atlas-fragmented-islands',
  'milestone-2-atlas-proof',
  'milestone-2-atlas-seam-crossing',
]);

export function readCanonicalScene(fixtureId) {
  return JSON.parse(
    readFileSync(
      resolve(
        REPOSITORY_ROOT,
        `fixtures/fixed-seeds/${fixtureId}/expected/baseline/atlas-render-scene.scene.canonical`,
      ),
      'utf8',
    ),
  );
}

export async function exportProductionPng(scene, dimensions) {
  return exportAtlasSceneToPngAsync(
    { scene, style: STYLE, dimensions },
    {
      isCancellationRequested: () => false,
      reportProgress: () => undefined,
      yieldControl: () => Promise.resolve(),
    },
  );
}
