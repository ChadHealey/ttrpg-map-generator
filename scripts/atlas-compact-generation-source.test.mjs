import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function sourceBetween(path, startMarker, endMarker) {
  const fileSource = source(path);
  const start = fileSource.indexOf(startMarker);
  const end = fileSource.indexOf(endMarker, start + startMarker.length);
  expect(start, `${path}: missing start marker ${startMarker}`).toBeGreaterThanOrEqual(0);
  expect(end, `${path}: missing or reordered end marker ${endMarker}`).toBeGreaterThan(start);
  return fileSource.slice(start, end);
}

describe('compact full-profile generation source boundary', () => {
  it('keeps full proposal assembly free of JavaScript sample-array conversion', () => {
    const fullPath = sourceBetween(
      'packages/generation/src/atlas-land-water-generator.ts',
      'export async function generateAtlasLandWaterFull',
      'export async function generateAtlasLandWaterPreview',
    );
    const classificationPath = sourceBetween(
      'packages/generation/src/atlas-land-water-classification.ts',
      'export async function classifyAtlasLandWater',
      'function immutablePreviewSamples',
    );
    const proposalSource = source('packages/generation/src/atlas-land-water-proposal.ts');
    const compactFieldPath = sourceBetween(
      'packages/generation/src/atlas-macro-elevation-field.ts',
      '  public compactValues(): MacroElevationSampleReader {',
      '\n  }\n}',
    );
    const fullProfileBoundary = [
      fullPath,
      classificationPath,
      proposalSource,
      compactFieldPath,
    ].join('\n');
    expect(fullProfileBoundary).not.toMatch(
      /atlasSampleReaderToArray|copyValues\(|createImmutableDomainArray/u,
    );
    expect(compactFieldPath).toContain(
      'return createCompactMacroElevationSampleReader(this.#values)',
    );

    const classificationSource = source(
      'packages/generation/src/atlas-land-water-classification.ts',
    );
    expect(classificationSource).toContain('new Uint8Array(Math.ceil(field.sampleCount / 8))');
    expect(classificationSource).toContain('createCompactLandWaterSampleReaderFromBits');
  });

  it('keeps the checked simultaneously-live packed-buffer peak below 128 MiB', () => {
    const sampleCount = 2_095_106;
    const peak = [
      { owner: 'prior accepted compact macro elevation', bytes: sampleCount * 4 },
      { owner: 'prior accepted compact classification', bytes: Math.ceil(sampleCount / 8) },
      { owner: 'accepted compact macro elevation', bytes: sampleCount * 4 },
      { owner: 'accepted compact classification', bytes: Math.ceil(sampleCount / 8) },
      { owner: 'surface partition labels', bytes: sampleCount * 4 },
      { owner: 'marine clearance', bytes: sampleCount },
      { owner: 'marine core labels', bytes: sampleCount * 4 },
      { owner: 'marine region labels', bytes: sampleCount * 4 },
      { owner: 'marine assignment queue', bytes: sampleCount * 4 },
      { owner: 'spherical row weights', bytes: 1_025 * 4 },
    ];
    expect(peak.map(({ owner }) => owner)).toHaveLength(
      new Set(peak.map(({ owner }) => owner)).size,
    );
    expect(peak.reduce((total, { bytes }) => total + bytes, 0)).toBe(52_905_528);
    expect(peak.reduce((total, { bytes }) => total + bytes, 0)).toBeLessThan(128 * 1_024 * 1_024);
  });
});
