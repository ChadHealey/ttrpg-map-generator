import { describe, expect, it } from 'vitest';

import {
  FIXED_ATLAS_LAND_WATER_ASPECT_ID,
  FIXED_ATLAS_WORLD_MAP_ID,
  FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
  generateFixedAtlasFull,
} from './atlas-land-water-test-support.js';
import { classifyAtlasSemanticGeography } from './atlas-semantic-classifier.js';
import { validateProvenAtlasSemanticGeographyRecords } from './atlas-semantic-validation-proof.js';

describe('atlas semantic validation proof', () => {
  it('never reuses validation for a semantic graph with mutable nested records', async () => {
    const generated = await generateFixedAtlasFull();
    const classified = classifyAtlasSemanticGeography({
      worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
      worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
      landWaterClassificationAspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID,
      records: generated.patch.records,
    });
    expect(classified.ok).toBe(true);
    if (!classified.ok) return;

    const firstLandmass = classified.records.landmasses[0];
    expect(firstLandmass).toBeDefined();
    if (firstLandmass === undefined) return;
    const mutableLandmass = { ...firstLandmass };
    const records = Object.freeze({
      ...classified.records,
      landmasses: Object.freeze([mutableLandmass, ...classified.records.landmasses.slice(1)]),
    });
    expect(validateProvenAtlasSemanticGeographyRecords(records)).toStrictEqual({ ok: true });

    (
      mutableLandmass as unknown as { sourceClassificationAspectId: string }
    ).sourceClassificationAspectId = 'invalid-aspect-id';
    expect(validateProvenAtlasSemanticGeographyRecords(records).ok).toBe(false);
  }, 30_000);
});
