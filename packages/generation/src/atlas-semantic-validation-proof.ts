/** Reuse exact semantic validation only for the same internally immutable record graph. */

import {
  type AtlasSemanticGeographyRecords,
  type AtlasSurfacePartitionAnalysis,
  type AtlasWaterSegmentationResult,
  validateAtlasSemanticGeographyRecords,
  validateAtlasSemanticGeographyRecordsWithAnalysis,
} from '@ttrpg-map/core';

const validatedSemanticRecords = new WeakSet<AtlasSemanticGeographyRecords>();

export function validateProvenAtlasSemanticGeographyRecords(
  records: AtlasSemanticGeographyRecords,
  analysis?: {
    readonly partition: AtlasSurfacePartitionAnalysis;
    readonly water: Extract<AtlasWaterSegmentationResult, { readonly ok: true }>;
  },
): ReturnType<typeof validateAtlasSemanticGeographyRecords> {
  if (validatedSemanticRecords.has(records)) return Object.freeze({ ok: true });
  const validation =
    analysis === undefined
      ? validateAtlasSemanticGeographyRecords(records)
      : validateAtlasSemanticGeographyRecordsWithAnalysis(records, analysis);
  if (validation.ok && hasImmutableGeneratedSource(records)) {
    validatedSemanticRecords.add(records);
  }
  return validation;
}

function hasImmutableGeneratedSource(records: AtlasSemanticGeographyRecords): boolean {
  return (
    Object.isFrozen(records) &&
    Object.isFrozen(records.controls) &&
    Object.isFrozen(records.macroElevation) &&
    Object.isFrozen(records.macroElevation.provenance) &&
    Object.isFrozen(records.macroElevation.values) &&
    Object.isFrozen(records.landWaterClassification) &&
    Object.isFrozen(records.landWaterClassification.samples) &&
    Object.isFrozen(records.landmasses) &&
    records.landmasses.every(
      (landmass) =>
        Object.isFrozen(landmass) &&
        hasImmutableMembership(landmass.membership) &&
        Object.isFrozen(landmass.adjacentWaterBodyIds),
    ) &&
    Object.isFrozen(records.islandGroups) &&
    records.islandGroups.every(
      (group) => Object.isFrozen(group) && Object.isFrozen(group.memberLandmassIds),
    ) &&
    Object.isFrozen(records.waterBodies) &&
    records.waterBodies.every(
      (waterBody) =>
        Object.isFrozen(waterBody) &&
        hasImmutableMembership(waterBody.membership) &&
        Object.isFrozen(waterBody.enclosedByLandmassIds) &&
        Object.isFrozen(waterBody.adjacentLandmassIds) &&
        Object.isFrozen(waterBody.connectivity) &&
        waterBody.connectivity.every(Object.isFrozen),
    )
  );
}

function hasImmutableMembership(
  membership: AtlasSemanticGeographyRecords['landmasses'][number]['membership'],
): boolean {
  return (
    Object.isFrozen(membership) &&
    Object.isFrozen(membership.sampleRanges) &&
    membership.sampleRanges.every(Object.isFrozen)
  );
}
