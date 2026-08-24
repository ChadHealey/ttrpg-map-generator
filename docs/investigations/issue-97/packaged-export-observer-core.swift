import Foundation

enum PackagedExportFormat: String, Codable, CaseIterable {
  case svg
  case png

  var dispatchKeyCode: UInt16 {
    switch self {
    case .svg: 9
    case .png: 45
    }
  }

  var phase: String { "\(rawValue)-complete" }
  var profileID: String { rawValue == "svg" ? "atlas-svg-v1" : "atlas-png-v1" }
  var dimensions: String { rawValue == "svg" ? "400x200mm" : "8192x4096px" }
  var maximumBytes: UInt64 { rawValue == "svg" ? 32 * 1_024 * 1_024 : 64 * 1_024 * 1_024 }
}

enum ExportObserverInvalidation: Error, Equatable, CustomStringConvertible {
  case destination(String)
  case state(String)

  var authority: String {
    switch self {
    case .destination: "destination-replacement"
    case .state: "accepted-state-receipt"
    }
  }

  var description: String {
    switch self {
    case .destination(let reason), .state(let reason): reason
    }
  }
}

struct PackagedExportCompletionReceipt: Codable, Equatable {
  let format: PackagedExportFormat
  let sha256: String
  let byteLength: UInt64
  let platform: String
  let profileId: String
  let profileVersion: Int
  let dimensions: String
  let nativeAtomicReceiptVerified: Bool
  let acceptedStateUnchanged: Bool
}

struct PackagedExportStateReceipt: Codable, Equatable {
  let version: String
  let fixtureId: String
  let worldSeed: String
  let controls: AtlasControlsReceipt
  let phase: String
  let productionSavePath: Bool
  let productionReopenPath: Bool
  let productionSvgPath: Bool
  let productionPngPath: Bool
  let canonicalAspectSetSha256: String
  let canonicalOutputSetSha256: String
  let canonicalCoastlineOutputSha256: String
  let renderSceneSha256: String
  let manifestSha256: String
  let reopenComparisonPassed: Bool
  let reopenGeneratorInvocations: Int
  let completion: PackagedExportCompletionReceipt?
}

enum PackagedExportStateReceiptParser {
  private static let baseKeys: Set<String> = [
    "version", "fixtureId", "worldSeed", "controls", "phase", "productionSavePath",
    "productionReopenPath", "productionSvgPath", "productionPngPath",
    "canonicalAspectSetSha256", "canonicalOutputSetSha256",
    "canonicalCoastlineOutputSha256", "renderSceneSha256", "manifestSha256",
    "reopenComparisonPassed", "reopenGeneratorInvocations",
  ]
  private static let controlKeys: Set<String> = [
    "worldCircumferenceKm", "targetWaterCoveragePercent", "continentCountIntent",
    "continentDistribution", "fragmentationPercent", "islandAbundancePercent",
    "archipelagoAbundancePercent", "oceanConnectivity", "polarCharacter",
  ]
  private static let completionKeys: Set<String> = [
    "format", "sha256", "byteLength", "platform", "profileId", "profileVersion",
    "dimensions", "nativeAtomicReceiptVerified", "acceptedStateUnchanged",
  ]

  static func parseReopened(
    _ text: String,
    expectedDefinition: GatedAtlasFixtureDefinition
  ) throws -> PackagedExportStateReceipt {
    let receipt = try parse(text, completionExpected: false)
    try validateBase(receipt, expectedDefinition: expectedDefinition, expectedPhase: "reopened")
    guard receipt.completion == nil else {
      throw ExportObserverInvalidation.state("the reopened receipt unexpectedly contained export completion")
    }
    return receipt
  }

  static func parseCompletion(
    _ text: String,
    expectedDefinition: GatedAtlasFixtureDefinition,
    expectedFormat: PackagedExportFormat,
    expectedReopened: PackagedExportStateReceipt
  ) throws -> PackagedExportStateReceipt {
    let receipt = try parse(text, completionExpected: true)
    try validateBase(
      receipt,
      expectedDefinition: expectedDefinition,
      expectedPhase: expectedFormat.phase
    )
    guard let completion = receipt.completion,
      completion.format == expectedFormat,
      completion.platform == "macos",
      completion.profileId == expectedFormat.profileID,
      completion.profileVersion == 1,
      completion.dimensions == expectedFormat.dimensions,
      completion.nativeAtomicReceiptVerified,
      completion.acceptedStateUnchanged,
      isDigest(completion.sha256),
      completion.byteLength > 0,
      completion.byteLength <= expectedFormat.maximumBytes,
      sameAcceptedState(receipt, expectedReopened)
    else {
      throw ExportObserverInvalidation.state(
        "the export completion contradicted its format, ceiling, native receipt, or reopened state")
    }
    return receipt
  }

  static func parseCompletionAfterGatedDispatch(
    _ text: String,
    expectedDefinition: GatedAtlasFixtureDefinition,
    expectedFormat: PackagedExportFormat
  ) throws -> PackagedExportStateReceipt {
    let receipt = try parse(text, completionExpected: true)
    try validateBase(
      receipt,
      expectedDefinition: expectedDefinition,
      expectedPhase: expectedFormat.phase
    )
    guard let completion = receipt.completion,
      completion.format == expectedFormat,
      completion.platform == "macos",
      completion.profileId == expectedFormat.profileID,
      completion.profileVersion == 1,
      completion.dimensions == expectedFormat.dimensions,
      completion.nativeAtomicReceiptVerified,
      completion.acceptedStateUnchanged,
      isDigest(completion.sha256),
      completion.byteLength > 0,
      completion.byteLength <= expectedFormat.maximumBytes
    else {
      throw ExportObserverInvalidation.state(
        "the gated export completion contradicted its format, ceiling, native receipt, or accepted state")
    }
    return receipt
  }

  private static func parse(
    _ text: String,
    completionExpected: Bool
  ) throws -> PackagedExportStateReceipt {
    guard let data = text.data(using: .utf8) else {
      throw ExportObserverInvalidation.state("the packaged export receipt was not UTF-8")
    }
    let raw: Any
    do { raw = try JSONSerialization.jsonObject(with: data) } catch {
      throw ExportObserverInvalidation.state("the packaged export receipt was malformed")
    }
    let expectedKeys = completionExpected ? baseKeys.union(["completion"]) : baseKeys
    guard let object = raw as? [String: Any], Set(object.keys) == expectedKeys,
      let controls = object["controls"] as? [String: Any], Set(controls.keys) == controlKeys
    else {
      throw ExportObserverInvalidation.state(
        "the packaged export receipt was incomplete or contained unknown fields")
    }
    if completionExpected {
      guard let completion = object["completion"] as? [String: Any],
        Set(completion.keys) == completionKeys
      else {
        throw ExportObserverInvalidation.state(
          "the packaged export completion was incomplete or contained unknown fields")
      }
    }
    do { return try JSONDecoder().decode(PackagedExportStateReceipt.self, from: data) } catch {
      throw ExportObserverInvalidation.state("the packaged export receipt fields were invalid")
    }
  }

  private static func validateBase(
    _ receipt: PackagedExportStateReceipt,
    expectedDefinition: GatedAtlasFixtureDefinition,
    expectedPhase: String
  ) throws {
    guard receipt.version == "packaged-export-observer-v1",
      receipt.fixtureId == expectedDefinition.fixtureId,
      receipt.worldSeed == expectedDefinition.worldSeed,
      receipt.controls == expectedDefinition.controls,
      receipt.phase == expectedPhase,
      receipt.productionSavePath,
      receipt.productionReopenPath,
      receipt.productionSvgPath,
      receipt.productionPngPath,
      isDigest(receipt.canonicalAspectSetSha256),
      isDigest(receipt.canonicalOutputSetSha256),
      isDigest(receipt.canonicalCoastlineOutputSha256),
      isDigest(receipt.renderSceneSha256),
      isDigest(receipt.manifestSha256),
      receipt.reopenComparisonPassed,
      receipt.reopenGeneratorInvocations == 0
    else {
      throw ExportObserverInvalidation.state(
        "the packaged export receipt contradicted the exact fixture or reopened authority")
    }
  }

  private static func sameAcceptedState(
    _ completion: PackagedExportStateReceipt,
    _ reopened: PackagedExportStateReceipt
  ) -> Bool {
    completion.fixtureId == reopened.fixtureId
      && completion.worldSeed == reopened.worldSeed
      && completion.controls == reopened.controls
      && completion.canonicalAspectSetSha256 == reopened.canonicalAspectSetSha256
      && completion.canonicalOutputSetSha256 == reopened.canonicalOutputSetSha256
      && completion.canonicalCoastlineOutputSha256 == reopened.canonicalCoastlineOutputSha256
      && completion.renderSceneSha256 == reopened.renderSceneSha256
      && completion.manifestSha256 == reopened.manifestSha256
  }

  private static func isDigest(_ value: String) -> Bool {
    value.count == 64 && value.allSatisfy { $0.isNumber || ("a"..."f").contains(String($0)) }
  }
}

struct DestinationFileIdentity: Equatable {
  let device: UInt64
  let inode: UInt64
  let byteLength: UInt64
  let sha256: String
}

enum ExportDestinationPredicate {
  static func validate(
    stale: DestinationFileIdentity,
    committed: DestinationFileIdentity,
    completion: PackagedExportCompletionReceipt,
    temporaryAbsent: Bool,
    formatValid: Bool
  ) throws {
    guard stale.device == committed.device,
      stale.inode != committed.inode,
      stale.sha256 != committed.sha256,
      committed.sha256 == completion.sha256,
      committed.byteLength == completion.byteLength,
      committed.byteLength > 0,
      committed.byteLength <= completion.format.maximumBytes,
      temporaryAbsent,
      formatValid
    else {
      throw ExportObserverInvalidation.destination(
        "the destination did not prove one complete atomic replacement matching the native receipt")
    }
  }
}

enum ExportSaveTargetPredicate {
  static func matches(label: String, domIdentifier: String) -> Bool {
    label == "SAVE TARGET · FRESH ABSOLUTE .MAPWORLD PATH"
      && domIdentifier == "mapworld-target"
  }
}

enum ExportReopenedReadinessPredicate {
  static let exactStatus =
    "Reopened exact accepted atlas from native bytes with zero generator calls; SVG and PNG export are ready."

  static func matches(
    targetPath: String,
    saveTargetReadback: String,
    saveTargetEnabled: Bool,
    statusValues: [String]
  ) -> Bool {
    saveTargetReadback == targetPath
      && !saveTargetEnabled
      && statusValues.filter { $0 == exactStatus }.count == 1
  }
}

enum ExportSVGFormatPredicate {
  static func matches(_ text: String) -> Bool {
    text.hasPrefix(
      #"<?xml version="1.0" encoding="UTF-8"?>"# + "\n"
        + #"<svg xmlns="http://www.w3.org/2000/svg" width="400mm" height="200mm" viewBox="0 0 2048 1024""#
    ) && text.contains(#"data-export-profile="atlas-svg-v1" data-export-version="1""#)
  }
}
