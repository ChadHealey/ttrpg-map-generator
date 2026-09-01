const PRODUCTION_ATLAS_PNG_METADATA = Object.freeze({
  widthPx: 1_600,
  heightPx: 800,
  bitDepth: 8,
  colorType: 2,
  srgbRenderingIntent: 0,
  bandCoreHeightPx: 64,
  bandHaloPx: 8,
  idatChunkBytes: 1_048_576,
});

/** Validate versioned production PNG evidence; M2 rows remain v1 unless explicitly upgraded. */
export function validateAtlasPngArtifactMetadata(artifact, artifactPath) {
  const profile = `${String(artifact.pngProfileId)}@${String(artifact.pngProfileVersion)}`;
  if (profile !== 'atlas-png-v1@1' && profile !== 'atlas-png-v2@2') {
    throw new Error(
      `Artifact ${artifactPath} must declare either atlas-png-v1@1 or atlas-png-v2@2.`,
    );
  }
  for (const [field, expected] of Object.entries(PRODUCTION_ATLAS_PNG_METADATA)) {
    if (artifact[field] !== expected) {
      throw new Error(
        `Artifact ${artifactPath} must declare supported production PNG ${field} as ${String(expected)}.`,
      );
    }
  }
  return Object.fromEntries(
    ['pngProfileId', 'pngProfileVersion', ...Object.keys(PRODUCTION_ATLAS_PNG_METADATA)].map(
      (field) => [field, artifact[field]],
    ),
  );
}
