import Foundation

struct GenerationCancellationTrialReceipt: Codable {
  let operation: String
  let safePoint: String
  let targetCompletedWork: Int
  let observedStage: String
  let observedCompletedWork: Int
  let acknowledgementLimitMilliseconds: Double
  let acknowledgementMilliseconds: Double
  let progressSampleCount: Int
  let progressMonotonic: Bool
  let costlySchedulingStopped: Bool
  let previousStatePreserved: Bool
  let noAcceptedCommitAtAcknowledgement: Bool
  let noLatePresentationOrCommit: Bool
  let quietWindowMilliseconds: Int
  let nextCompletionCanonicallyDeterministic: Bool
  let canonicalAspectSetSha256: String
  let canonicalOutputSetSha256: String
  let canonicalCoastlineOutputSha256: String
}

struct GenerationCancellationVisualReceipt: Codable {
  let presentationBaselineEstablished: Bool
  let postAcknowledgementCompleteFrameCount: Int
  let pixelChangeFrameCount: Int
  let pixelsChangedDiagnostic: Bool
  let completedPresentationSignatureDetected: Bool
  let acceptedAftermathFrameQualified: Bool
  let acceptedAccessibilityQualified: Bool
  let foregroundUninterrupted: Bool
}

struct GenerationCancellationAftermathVisualReceipt: Codable {
  let evidenceKind: String
  let firstPaintClaim: Bool
  let currentAcceptedCanvasReresolved: Bool
  let freshPostCompletionCaptureStream: Bool
  let completeFrameCount: Int
  let cropWidthPoints: Int
  let cropHeightPoints: Int
  let captureWidthPixels: Int
  let captureHeightPixels: Int
  let acceptedLandPaletteCount: Int
  let acceptedWaterPaletteCount: Int
  let acceptedInkPaletteCount: Int
  let previewLandPaletteCount: Int
  let previewWaterPaletteCount: Int
  let acceptedPaletteQualified: Bool
  let previewPaletteRejected: Bool
  let preOperationCanvasPixelsChanged: Bool
}

struct GenerationCancellationObserverReceipt: Codable {
  let observerVersion: String
  let status: String
  let target: TargetReceipt
  let fixture: ExactFixturePreviewAuthorityReceipt?
  let trial: GenerationCancellationTrialReceipt?
  let roleCounts: [String: Int]?
  let visual: GenerationCancellationVisualReceipt?
  let aftermathVisual: GenerationCancellationAftermathVisualReceipt?
  let executableIdentity: ExecutableIdentityReceipt?
  let membershipRevalidated: Bool
  let measurement: MeasurementReceipt?
  let invalidAuthority: String?
  let invalidReason: String?

  static func invalid(_ invalidation: PreviewObserverInvalidation) -> Self {
    Self(
      observerVersion: generationCancellationObserverSchemaVersion,
      status: "invalid",
      target: .approved,
      fixture: nil,
      trial: nil,
      roleCounts: nil,
      visual: nil,
      aftermathVisual: nil,
      executableIdentity: nil,
      membershipRevalidated: false,
      measurement: nil,
      invalidAuthority: invalidation.authority,
      invalidReason: invalidation.description
    )
  }
}
