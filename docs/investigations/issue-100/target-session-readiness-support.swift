import Foundation

let issue100ReadinessSchemaVersion = "issue100-target-session-readiness-v1"
let issue100ReadinessObserverSchemaVersion = "issue100-target-session-readiness-observer-v1"
let issue100TargetModel = "Mac17,2"
let issue100TargetOSVersion = "26.5.1"
let issue100TargetOSBuild = "25F80"
let issue100TargetMemoryBytes: UInt64 = 24 * 1_024 * 1_024 * 1_024

struct Issue100TargetReceipt: Codable {
  let model: String
  let osVersion: String
  let osBuild: String
  let memoryGiB: Int

  static let approved = Issue100TargetReceipt(
    model: issue100TargetModel,
    osVersion: issue100TargetOSVersion,
    osBuild: issue100TargetOSBuild,
    memoryGiB: 24
  )
}

struct Issue100ReadinessPredicates: Codable {
  let freshProcess: Bool
  let exactApplicationCount: Bool
  let exactAccessibilityWindowCount: Bool
  let visibleAccessibilityWindow: Bool
  let activationSucceeded: Bool
  let raiseSucceeded: Bool
  let accessibilityFrontmostWriteSucceeded: Bool
  let accessibilityFrontmostVerified: Bool
  let workspaceFrontmostVerified: Bool
  let applicationAndWindowIdentityRetained: Bool
}

struct Issue100ZeroOperationReceipt: Codable {
  let fixtureConfigured: Bool
  let samplerStarted: Bool
  let exportDestinationCreated: Bool
  let svgDispatched: Bool
  let pngDispatched: Bool
  let measurementCount: Int
  let rawArtifactCount: Int
}

struct TargetSessionReadinessObserverReceipt: Codable {
  let observerVersion: String
  let status: String
  let target: Issue100TargetReceipt
  let bundleIdentifier: String?
  let candidateExecutableSha256: String?
  let applicationCount: Int?
  let accessibilityWindowCount: Int?
  let visibleAccessibilityWindow: Bool?
  let accessibilityFrontmost: Bool?
  let workspaceFrontmost: Bool?
  let applicationAndWindowIdentityRetained: Bool
  let invalidAuthority: String?
  let invalidReason: String?

  static func invalid(_ invalidation: TargetSessionReadinessInvalidation) -> Self {
    TargetSessionReadinessObserverReceipt(
      observerVersion: issue100ReadinessObserverSchemaVersion,
      status: "invalid",
      target: .approved,
      bundleIdentifier: nil,
      candidateExecutableSha256: nil,
      applicationCount: nil,
      accessibilityWindowCount: nil,
      visibleAccessibilityWindow: nil,
      accessibilityFrontmost: nil,
      workspaceFrontmost: nil,
      applicationAndWindowIdentityRetained: false,
      invalidAuthority: invalidation.authority,
      invalidReason: invalidation.description
    )
  }
}

struct TargetSessionReadinessQualificationReceipt: Codable {
  let controllerVersion: String
  let status: String
  let qualificationKind: String
  let target: Issue100TargetReceipt
  let sessionMechanism: String?
  let bundleIdentifier: String?
  let candidateExecutableSha256: String?
  let controllerSha256: String?
  let readinessObserverSha256: String?
  let predicates: Issue100ReadinessPredicates?
  let zeroOperationProof: Issue100ZeroOperationReceipt
  let invalidAuthority: String?
  let invalidReason: String?

  static func invalid(_ invalidation: TargetSessionReadinessInvalidation) -> Self {
    TargetSessionReadinessQualificationReceipt(
      controllerVersion: issue100ReadinessSchemaVersion,
      status: "invalid",
      qualificationKind: "non-measurement-target-session-readiness",
      target: .approved,
      sessionMechanism: nil,
      bundleIdentifier: nil,
      candidateExecutableSha256: nil,
      controllerSha256: nil,
      readinessObserverSha256: nil,
      predicates: nil,
      zeroOperationProof: .zero,
      invalidAuthority: invalidation.authority,
      invalidReason: invalidation.description
    )
  }
}

extension Issue100ZeroOperationReceipt {
  static let zero = Issue100ZeroOperationReceipt(
    fixtureConfigured: false,
    samplerStarted: false,
    exportDestinationCreated: false,
    svgDispatched: false,
    pngDispatched: false,
    measurementCount: 0,
    rawArtifactCount: 0
  )
}

func issue100Emit<T: Encodable>(_ receipt: T) throws {
  let encoder = JSONEncoder()
  encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
  FileHandle.standardOutput.write(try encoder.encode(receipt))
  FileHandle.standardOutput.write(Data([0x0A]))
}
