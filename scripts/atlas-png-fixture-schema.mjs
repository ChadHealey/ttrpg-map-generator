const PRODUCTION_ATLAS_PNG_METADATA = Object.freeze({
  pngProfileId: 'atlas-png-v1',
  pngProfileVersion: 1,
  widthPx: 1_600,
  heightPx: 800,
  bitDepth: 8,
  colorType: 2,
  srgbRenderingIntent: 0,
  bandCoreHeightPx: 64,
  bandHaloPx: 8,
  idatChunkBytes: 1_048_576,
});

/** Validate and retain the versioned production PNG profile recorded by M2 visual evidence. */
export function validateAtlasPngArtifactMetadata(artifact, artifactPath) {
  for (const [field, expected] of Object.entries(PRODUCTION_ATLAS_PNG_METADATA)) {
    if (artifact[field] !== expected) {
      throw new Error(
        `Artifact ${artifactPath} must declare atlas-png-v1 ${field} as ${String(expected)}.`,
      );
    }
  }
  return Object.fromEntries(
    Object.keys(PRODUCTION_ATLAS_PNG_METADATA).map((field) => [field, artifact[field]]),
  );
}
