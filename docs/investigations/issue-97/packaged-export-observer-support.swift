import Foundation

struct ExportFixtureAuthorityReceipt: Codable {
  let fixtureId: String
  let fixtureDefinitionSha256: String
  let worldSeed: String
  let controls: AtlasControlsReceipt
  let exactReopenedStateBeforeDispatch: Bool
}

struct ExportAcceptedStateReceipt: Codable {
  let canonicalAspectSetSha256: String
  let canonicalOutputSetSha256: String
  let canonicalCoastlineOutputSha256: String
  let renderSceneSha256: String
  let manifestSha256: String
  let reopenComparisonPassed: Bool
  let reopenGeneratorInvocations: Int
  let unchangedAfterExport: Bool
}

struct ExportDestinationReceipt: Codable {
  let format: String
  let profileId: String
  let profileVersion: Int
  let dimensions: String
  let staleRegularDestinationSeeded: Bool
  let atomicIdentityReplacementObserved: Bool
  let temporaryAbsent: Bool
  let sha256Matched: Bool
  let byteLengthMatched: Bool
  let byteLength: UInt64
  let sizeCeilingBytes: UInt64
  let sizeCeilingPassed: Bool
  let completeFormatValidated: Bool
}

struct ExportAccessibilityReceipt: Codable {
  let exactCompletionReceiptMatched: Bool
  let foregroundIntact: Bool
  let frontmost: Bool
}

struct PackagedExportQualificationReceipt: Codable {
  let observerVersion: String
  let status: String
  let target: TargetReceipt
  let fixture: ExportFixtureAuthorityReceipt?
  let roleCounts: [String: Int]?
  let acceptedState: ExportAcceptedStateReceipt?
  let destination: ExportDestinationReceipt?
  let accessibility: ExportAccessibilityReceipt?
  let executableIdentity: ExecutableIdentityReceipt?
  let membershipRevalidated: Bool
  let dispatchBoundary: String?
  let completionBoundary: String?
  let postDispatchAccessibilityReceiptCount: Int?
  let invalidAuthority: String?
  let invalidReason: String?
  let measurement: MeasurementReceipt?

  static func invalid(
    authority: String,
    reason: String
  ) -> PackagedExportQualificationReceipt {
    PackagedExportQualificationReceipt(
      observerVersion: packagedExportObserverSchemaVersion,
      status: "invalid",
      target: .approved,
      fixture: nil,
      roleCounts: nil,
      acceptedState: nil,
      destination: nil,
      accessibility: nil,
      executableIdentity: nil,
      membershipRevalidated: false,
      dispatchBoundary: nil,
      completionBoundary: nil,
      postDispatchAccessibilityReceiptCount: nil,
      invalidAuthority: authority,
      invalidReason: reason,
      measurement: nil
    )
  }
}
