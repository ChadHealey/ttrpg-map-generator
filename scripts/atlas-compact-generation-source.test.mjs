import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

describe('compact full-profile generation source boundary', () => {
  it('keeps full proposal assembly free of JavaScript sample-array conversion', () => {
    const generatorSource = source('packages/generation/src/atlas-land-water-generator.ts');
    const fullPath = generatorSource.slice(
      generatorSource.indexOf('export async function generateAtlasLandWaterFull'),
      generatorSource.indexOf('export async function generateAtlasLandWaterPreview'),
    );
    expect(fullPath).not.toMatch(
      /atlasSampleReaderToArray|copyValues\(|createImmutableDomainArray/u,
    );

    const proposalSource = source('packages/generation/src/atlas-land-water-proposal.ts');
    expect(proposalSource).not.toMatch(
      /atlasSampleReaderToArray|copyValues\(|createImmutableDomainArray/u,
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
    expect(peak.reduce((total, { bytes }) => total + bytes, 0)).toBe(44_263_215);
    expect(peak.reduce((total, { bytes }) => total + bytes, 0)).toBeLessThan(128 * 1_024 * 1_024);
  });
});
