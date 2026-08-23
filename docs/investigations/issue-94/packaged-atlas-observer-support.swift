import Foundation

struct FixtureAuthorityReceipt: Codable {
  let fixtureId: String
  let fixtureDefinitionSha256: String
  let worldSeed: String
  let controls: AtlasControlsReceipt
  let configuredBeforeMeasuredDispatch: Bool
}

struct AcceptedAtlasVisualReceipt: Codable {
  let completePostDispatchFrame: Bool
  let changedCanvasCrop: Bool
  let cropPixels: String
  let foregroundIntact: Bool
  let acceptedLandPalettePresent: Bool
  let acceptedWaterPalettePresent: Bool
  let acceptedInkPalettePresent: Bool
  let disposablePreviewPaletteRejected: Bool
}

struct AcceptedAtlasAccessibilityReceipt: Codable {
  let acceptedCanvasLabel: Bool
  let acceptedCaption: Bool
  let disposablePreviewAbsent: Bool
  let acceptFullDisabled: Bool
  let fixtureReceiptMatched: Bool
  let frontmost: Bool
}

struct FullAtlasObserverReceipt: Codable {
  let observerVersion: String
  let status: String
  let target: TargetReceipt
  let fixture: FixtureAuthorityReceipt?
  let roleCounts: [String: Int]?
  let visual: AcceptedAtlasVisualReceipt?
  let accessibility: AcceptedAtlasAccessibilityReceipt?
  let executableIdentity: ExecutableIdentityReceipt?
  let membershipRevalidated: Bool
  let dispatchBoundary: String?
  let completionBoundary: String?
  let postDispatchAccessibilityReceiptCount: Int?
  let invalidAuthority: String?
  let invalidReason: String?
  let measurement: MeasurementReceipt?

  static func invalid(_ invalidation: PreviewObserverInvalidation) -> FullAtlasObserverReceipt {
    FullAtlasObserverReceipt(
      observerVersion: fullAtlasObserverSchemaVersion,
      status: "invalid",
      target: .approved,
      fixture: nil,
      roleCounts: nil,
      visual: nil,
      accessibility: nil,
      executableIdentity: nil,
      membershipRevalidated: false,
      dispatchBoundary: nil,
      completionBoundary: nil,
      postDispatchAccessibilityReceiptCount: nil,
      invalidAuthority: invalidation.authority,
      invalidReason: invalidation.description,
      measurement: nil
    )
  }
}
