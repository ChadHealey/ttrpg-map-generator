/** Reuse exact semantic validation only for the same internally immutable record graph. */

import {
  type AtlasSemanticGeographyRecords,
  type AtlasSurfacePartitionAnalysis,
  type AtlasWaterSegmentationResult,
  isImmutableDomainSnapshot,
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
  if (validation.ok && isImmutableDomainSnapshot(records)) {
    validatedSemanticRecords.add(records);
  }
  return validation;
}
