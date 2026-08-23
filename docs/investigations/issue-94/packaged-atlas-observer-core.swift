import Foundation

enum GatedAtlasFixtureID: String, CaseIterable, Codable {
  case proof = "milestone-2-atlas-proof"
  case fragmentedIslands = "milestone-2-atlas-fragmented-islands"
  case controlMax = "milestone-2-atlas-control-max"

  var dispatchKeyCode: CGKeyCodeValue {
    switch self {
    case .proof: 38
    case .fragmentedIslands: 40
    case .controlMax: 37
    }
  }
}

typealias CGKeyCodeValue = UInt16

struct AtlasControlsReceipt: Codable, Equatable {
  let worldCircumferenceKm: Int
  let targetWaterCoveragePercent: Int
  let continentCountIntent: Int
  let continentDistribution: String
  let fragmentationPercent: Int
  let islandAbundancePercent: Int
  let archipelagoAbundancePercent: Int
  let oceanConnectivity: String
  let polarCharacter: String
}

struct GatedAtlasFixtureDefinition: Codable, Equatable {
  let fixtureDefinitionVersion: Int
  let fixtureId: String
  let worldSeed: String
  let controls: AtlasControlsReceipt
}

enum AtlasFixtureDefinitionParser {
  static func parse(_ data: Data, expectedFixture: GatedAtlasFixtureID) throws
    -> GatedAtlasFixtureDefinition
  {
    let definition: GatedAtlasFixtureDefinition
    do { definition = try JSONDecoder().decode(GatedAtlasFixtureDefinition.self, from: data) } catch {
      throw invalid("the registered fixture definition was malformed")
    }
    guard definition.fixtureDefinitionVersion == 2,
      definition.fixtureId == expectedFixture.rawValue,
      UInt64(definition.worldSeed).map(String.init) == definition.worldSeed
    else {
      throw invalid("the registered fixture definition identity or seed did not match")
    }
    return definition
  }
}

enum PackagedAtlasObserverPhase: String, Codable {
  case configured
  case preview
  case accepted
}

struct PackagedAtlasFixtureReceipt: Codable, Equatable {
  let version: String
  let fixtureId: String
  let worldSeed: String
  let controls: AtlasControlsReceipt
  let phase: PackagedAtlasObserverPhase
  let productionPreviewPath: Bool
  let productionFullPath: Bool
}

enum PackagedAtlasFixtureReceiptParser {
  private static let receiptKeys: Set<String> = [
    "version", "fixtureId", "worldSeed", "controls", "phase", "productionPreviewPath",
    "productionFullPath",
  ]
  private static let controlKeys: Set<String> = [
    "worldCircumferenceKm", "targetWaterCoveragePercent", "continentCountIntent",
    "continentDistribution", "fragmentationPercent", "islandAbundancePercent",
    "archipelagoAbundancePercent", "oceanConnectivity", "polarCharacter",
  ]

  static func parse(
    _ text: String,
    expectedDefinition: GatedAtlasFixtureDefinition,
    expectedPhase: PackagedAtlasObserverPhase
  ) throws -> PackagedAtlasFixtureReceipt {
    guard let data = text.data(using: .utf8) else {
      throw invalid("the packaged fixture receipt was not UTF-8")
    }
    let raw: Any
    do { raw = try JSONSerialization.jsonObject(with: data) } catch {
      throw invalid("the packaged fixture receipt was malformed")
    }
    guard let object = raw as? [String: Any], Set(object.keys) == receiptKeys,
      let controls = object["controls"] as? [String: Any], Set(controls.keys) == controlKeys
    else {
      throw invalid("the packaged fixture receipt was incomplete or had unknown fields")
    }
    let receipt: PackagedAtlasFixtureReceipt
    do { receipt = try JSONDecoder().decode(PackagedAtlasFixtureReceipt.self, from: data) } catch {
      throw invalid("the packaged fixture receipt fields were invalid")
    }
    guard receipt.version == "packaged-atlas-observer-fixture-v1",
      receipt.fixtureId == expectedDefinition.fixtureId,
      receipt.worldSeed == expectedDefinition.worldSeed,
      receipt.controls == expectedDefinition.controls,
      receipt.phase == expectedPhase,
      receipt.productionPreviewPath,
      receipt.productionFullPath
    else {
      throw invalid("the packaged fixture receipt contradicted the registered definition or phase")
    }
    return receipt
  }
}

struct AcceptedAtlasPixelObservation: Equatable {
  let hash: UInt64
  let landLike: Int
  let waterLike: Int
  let inkLike: Int
  let previewLandLike: Int
  let previewWaterLike: Int
}

enum AcceptedAtlasFramePredicate {
  static let minimumLandOrWaterPopulation = 100
  static let minimumInkPopulation = 8
  static let maximumPreviewPopulation = 500

  static func qualifies(
    complete: Bool,
    displayTime: UInt64,
    dispatchTime: UInt64,
    baselineHash: UInt64,
    candidate: AcceptedAtlasPixelObservation,
    foregroundIntact: Bool
  ) -> Bool {
    complete && displayTime > dispatchTime && candidate.hash != baselineHash && foregroundIntact
      && candidate.landLike >= minimumLandOrWaterPopulation
      && candidate.waterLike >= minimumLandOrWaterPopulation
      && candidate.inkLike >= minimumInkPopulation
      && candidate.previewLandLike <= maximumPreviewPopulation
      && candidate.previewWaterLike <= maximumPreviewPopulation
  }
}

private func invalid(_ reason: String) -> PreviewObserverInvalidation {
  .fixture(reason)
}
