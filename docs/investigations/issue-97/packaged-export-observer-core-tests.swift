import Foundation

@main
enum PackagedExportObserverCoreTests {
  static func main() throws {
    try parsesExactReopenedAndCompletionReceipts()
    try rejectsStateDriftAndBadCompletion()
    try validatesOnlyCompleteAtomicReplacement()
    matchesOnlyTheExactProductionSaveTarget()
    matchesOnlyExactReopenedReadiness()
    validatesTheCompleteProductionSVGPrefix()
    FileHandle.standardOutput.write(Data("issue97 export observer core tests passed\n".utf8))
  }

  private static func parsesExactReopenedAndCompletionReceipts() throws {
    let definition = fixtureDefinition()
    let reopened = try PackagedExportStateReceiptParser.parseReopened(
      receiptJSON(phase: "reopened", completion: nil),
      expectedDefinition: definition
    )
    let completion = try PackagedExportStateReceiptParser.parseCompletion(
      receiptJSON(phase: "svg-complete", completion: completionObject(.svg)),
      expectedDefinition: definition,
      expectedFormat: .svg,
      expectedReopened: reopened
    )
    precondition(completion.completion?.profileId == "atlas-svg-v1")
    let gatedCompletion = try PackagedExportStateReceiptParser.parseCompletionAfterGatedDispatch(
      receiptJSON(phase: "svg-complete", completion: completionObject(.svg)),
      expectedDefinition: definition,
      expectedFormat: .svg
    )
    precondition(gatedCompletion.completion?.acceptedStateUnchanged == true)
  }

  private static func rejectsStateDriftAndBadCompletion() throws {
    let definition = fixtureDefinition()
    let reopened = try PackagedExportStateReceiptParser.parseReopened(
      receiptJSON(phase: "reopened", completion: nil),
      expectedDefinition: definition
    )
    for completion in [
      completionObject(.svg, overrides: ["sha256": "bad"]),
      completionObject(.svg, overrides: ["byteLength": 33 * 1_024 * 1_024]),
      completionObject(.svg, overrides: ["dimensions": "401x200mm"]),
      completionObject(.svg, overrides: ["nativeAtomicReceiptVerified": false]),
      completionObject(.svg, overrides: ["acceptedStateUnchanged": false]),
    ] {
      expectInvalid {
        _ = try PackagedExportStateReceiptParser.parseCompletion(
          receiptJSON(phase: "svg-complete", completion: completion),
          expectedDefinition: definition,
          expectedFormat: .svg,
          expectedReopened: reopened
        )
      }
      expectInvalid {
        _ = try PackagedExportStateReceiptParser.parseCompletionAfterGatedDispatch(
          receiptJSON(phase: "svg-complete", completion: completion),
          expectedDefinition: definition,
          expectedFormat: .svg
        )
      }
    }
    expectInvalid {
      _ = try PackagedExportStateReceiptParser.parseCompletion(
        receiptJSON(
          phase: "svg-complete",
          completion: completionObject(.svg),
          overrides: ["renderSceneSha256": String(repeating: "f", count: 64)]
        ),
        expectedDefinition: definition,
        expectedFormat: .svg,
        expectedReopened: reopened
      )
    }
  }

  private static func validatesOnlyCompleteAtomicReplacement() throws {
    let stale = DestinationFileIdentity(device: 1, inode: 10, byteLength: 5, sha256: digest("a"))
    let committed = DestinationFileIdentity(
      device: 1,
      inode: 11,
      byteLength: 800_000,
      sha256: digest("b")
    )
    let completion = PackagedExportCompletionReceipt(
      format: .svg,
      sha256: digest("b"),
      byteLength: 800_000,
      platform: "macos",
      profileId: "atlas-svg-v1",
      profileVersion: 1,
      dimensions: "400x200mm",
      nativeAtomicReceiptVerified: true,
      acceptedStateUnchanged: true
    )
    try ExportDestinationPredicate.validate(
      stale: stale,
      committed: committed,
      completion: completion,
      temporaryAbsent: true,
      formatValid: true
    )
    for candidate in [
      DestinationFileIdentity(device: 1, inode: 10, byteLength: 800_000, sha256: digest("b")),
      DestinationFileIdentity(device: 1, inode: 11, byteLength: 7, sha256: digest("b")),
      DestinationFileIdentity(device: 1, inode: 11, byteLength: 800_000, sha256: digest("c")),
    ] {
      expectInvalid {
        try ExportDestinationPredicate.validate(
          stale: stale,
          committed: candidate,
          completion: completion,
          temporaryAbsent: true,
          formatValid: true
        )
      }
    }
    expectInvalid {
      try ExportDestinationPredicate.validate(
        stale: stale,
        committed: committed,
        completion: completion,
        temporaryAbsent: false,
        formatValid: true
      )
    }
    expectInvalid {
      try ExportDestinationPredicate.validate(
        stale: stale,
        committed: committed,
        completion: completion,
        temporaryAbsent: true,
        formatValid: false
      )
    }
  }

  private static func matchesOnlyTheExactProductionSaveTarget() {
    precondition(
      ExportSaveTargetPredicate.matches(
        label: "SAVE TARGET · FRESH ABSOLUTE .MAPWORLD PATH",
        domIdentifier: "mapworld-target"
      ))
    precondition(
      !ExportSaveTargetPredicate.matches(
        label: "Save target · fresh absolute .mapworld path",
        domIdentifier: "mapworld-target"
      ))
    precondition(
      !ExportSaveTargetPredicate.matches(
        label: "SAVE TARGET · FRESH ABSOLUTE .MAPWORLD PATH",
        domIdentifier: "other-target"
      ))
  }

  private static func matchesOnlyExactReopenedReadiness() {
    let target = "/private/work/atlas.mapworld"
    let status = ExportReopenedReadinessPredicate.exactStatus
    precondition(
      ExportReopenedReadinessPredicate.matches(
        targetPath: target,
        saveTargetReadback: target,
        saveTargetEnabled: false,
        statusValues: [status]
      ))
    for values in [[], [status, status], ["REOPENED"]] {
      precondition(
        !ExportReopenedReadinessPredicate.matches(
          targetPath: target,
          saveTargetReadback: target,
          saveTargetEnabled: false,
          statusValues: values
        ))
    }
    precondition(
      !ExportReopenedReadinessPredicate.matches(
        targetPath: target,
        saveTargetReadback: "/private/work/other.mapworld",
        saveTargetEnabled: false,
        statusValues: [status]
      ))
    precondition(
      !ExportReopenedReadinessPredicate.matches(
        targetPath: target,
        saveTargetReadback: target,
        saveTargetEnabled: true,
        statusValues: [status]
      ))
  }

  private static func validatesTheCompleteProductionSVGPrefix() {
    let valid = #"<?xml version="1.0" encoding="UTF-8"?>"# + "\n"
      + #"<svg xmlns="http://www.w3.org/2000/svg" width="400mm" height="200mm" viewBox="0 0 2048 1024" data-export-profile="atlas-svg-v1" data-export-version="1"></svg>"#
    precondition(ExportSVGFormatPredicate.matches(valid))
    precondition(!ExportSVGFormatPredicate.matches(valid.dropFirst(39).description))
    precondition(
      !ExportSVGFormatPredicate.matches(
        valid.replacingOccurrences(of: "atlas-svg-v1", with: "other-profile")
      ))
    precondition(!ExportSVGFormatPredicate.matches(#"<?xml version="1.0" encoding="UTF-8"?>"#))
  }

  private static func fixtureDefinition() -> GatedAtlasFixtureDefinition {
    GatedAtlasFixtureDefinition(
      fixtureDefinitionVersion: 2,
      fixtureId: "milestone-2-atlas-proof",
      worldSeed: "81985529216486895",
      controls: controls()
    )
  }

  private static func receiptJSON(
    phase: String,
    completion: [String: Any]?,
    overrides: [String: Any] = [:]
  ) -> String {
    var object: [String: Any] = [
      "version": "packaged-export-observer-v1",
      "fixtureId": "milestone-2-atlas-proof",
      "worldSeed": "81985529216486895",
      "controls": controlsObject(),
      "phase": phase,
      "productionSavePath": true,
      "productionReopenPath": true,
      "productionSvgPath": true,
      "productionPngPath": true,
      "canonicalAspectSetSha256": digest("a"),
      "canonicalOutputSetSha256": digest("b"),
      "canonicalCoastlineOutputSha256": digest("c"),
      "renderSceneSha256": digest("d"),
      "manifestSha256": digest("e"),
      "reopenComparisonPassed": true,
      "reopenGeneratorInvocations": 0,
    ]
    if let completion { object["completion"] = completion }
    object.merge(overrides) { _, next in next }
    let data = try! JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
    return String(decoding: data, as: UTF8.self)
  }

  private static func completionObject(
    _ format: PackagedExportFormat,
    overrides: [String: Any] = [:]
  ) -> [String: Any] {
    var object: [String: Any] = [
      "format": format.rawValue,
      "sha256": digest("b"),
      "byteLength": 800_000,
      "platform": "macos",
      "profileId": format.profileID,
      "profileVersion": 1,
      "dimensions": format.dimensions,
      "nativeAtomicReceiptVerified": true,
      "acceptedStateUnchanged": true,
    ]
    object.merge(overrides) { _, next in next }
    return object
  }

  private static func controls() -> AtlasControlsReceipt {
    AtlasControlsReceipt(
      worldCircumferenceKm: 40_000,
      targetWaterCoveragePercent: 65,
      continentCountIntent: 4,
      continentDistribution: "varied",
      fragmentationPercent: 35,
      islandAbundancePercent: 35,
      archipelagoAbundancePercent: 25,
      oceanConnectivity: "singleGlobal",
      polarCharacter: "neutral"
    )
  }

  private static func controlsObject() -> [String: Any] {
    [
      "worldCircumferenceKm": 40_000,
      "targetWaterCoveragePercent": 65,
      "continentCountIntent": 4,
      "continentDistribution": "varied",
      "fragmentationPercent": 35,
      "islandAbundancePercent": 35,
      "archipelagoAbundancePercent": 25,
      "oceanConnectivity": "singleGlobal",
      "polarCharacter": "neutral",
    ]
  }

  private static func digest(_ character: Character) -> String {
    String(repeating: String(character), count: 64)
  }

  private static func expectInvalid(_ operation: () throws -> Void) {
    do {
      try operation()
      preconditionFailure("expected invalidation")
    } catch {}
  }
}
