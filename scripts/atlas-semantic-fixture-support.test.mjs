import { describe, expect, it } from 'vitest';

import { expectedVersions } from './atlas-semantic-fixture-support.mjs';

describe('atlas semantic fixture version expectations', () => {
  it('derives the macro provenance tuple instead of trusting fixture-declared values', () => {
    const versions = expectedVersions(
      {
        selectAtlasMacroElevationVersion(fieldBehaviorVersion) {
          if (fieldBehaviorVersion !== 1 && fieldBehaviorVersion !== 2) {
            throw new Error('Unsupported test field behavior version.');
          }
          return { fieldBehaviorVersion, generatorVersion: fieldBehaviorVersion };
        },
      },
      {
        ATLAS_LAND_WATER_GENERATOR_MANIFEST: { versions: { fieldBehaviorVersion: 2 } },
        ATLAS_LAND_WATER_GENERATOR_MANIFEST_VERSION: 2,
        ATLAS_SEPARATED_FIELD_BEHAVIOR_VERSION: 2,
      },
      {},
      {},
      undefined,
      false,
      false,
      false,
      false,
      {
        atlasFieldBehaviorVersion: 2,
        atlasGeneratorManifestVersion: 999,
        macroElevationGeneratorVersion: 999,
      },
    );
    expect(versions).toMatchObject({
      atlasFieldBehaviorVersion: 2,
      atlasGeneratorManifestVersion: 2,
      macroElevationGeneratorVersion: 2,
    });
  });
});
