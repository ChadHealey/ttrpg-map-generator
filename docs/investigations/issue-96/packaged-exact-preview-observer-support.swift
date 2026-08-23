import Foundation

struct ExactFixturePreviewAuthorityReceipt: Codable {
  let fixtureId: String
  let fixtureDefinitionSha256: String
  let worldSeed: String
  let controls: AtlasControlsReceipt
  let readbackImmediatelyBeforeMeasuredDispatch: Bool
}

struct ExactFixturePreviewAccessibilityReceipt: Codable {
  let previewLabel: Bool
  let disposableCaption: Bool
  let acceptFullEnabled: Bool
  let fixtureReceiptMatched: Bool
  let frontmost: Bool
}

struct ExactFixturePreviewObserverReceipt: Codable {
  let observerVersion: String
  let status: String
  let target: TargetReceipt
  let fixture: ExactFixturePreviewAuthorityReceipt?
  let roleCounts: [String: Int]?
  let visual: VisualReceipt?
  let accessibility: ExactFixturePreviewAccessibilityReceipt?
  let executableIdentity: ExecutableIdentityReceipt?
  let membershipRevalidated: Bool
  let dispatchBoundary: String?
  let completionBoundary: String?
  let postDispatchAccessibilityReceiptCount: Int?
  let invalidAuthority: String?
  let invalidReason: String?
  let measurement: MeasurementReceipt?

  static func invalid(
    _ invalidation: PreviewObserverInvalidation
  ) -> ExactFixturePreviewObserverReceipt {
    ExactFixturePreviewObserverReceipt(
      observerVersion: exactFixturePreviewObserverSchemaVersion,
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
