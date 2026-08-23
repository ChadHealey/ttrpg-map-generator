import Foundation

@main
enum PackagedAtlasObserverCoreTests {
  static func main() throws {
    try parsesExactDefinitionAndReceipt()
    try rejectsUnknownDriftedIncompleteAndMalformedReceipts()
    checksAcceptedAtlasFramePredicate()
    print("packaged-atlas-observer-core-tests: passed")
  }

  private static func parsesExactDefinitionAndReceipt() throws {
    let definition = try AtlasFixtureDefinitionParser.parse(
      definitionData(),
      expectedFixture: .controlMax
    )
    expect(definition.fixtureDefinitionVersion == 2, "fixture definition version")
    expect(definition.worldSeed == "16045690984503098046", "canonical unsigned seed")
    let receipt = try PackagedAtlasFixtureReceiptParser.parse(
      receiptText(),
      expectedDefinition: definition,
      expectedPhase: .accepted
    )
    expect(receipt.fixtureId == GatedAtlasFixtureID.controlMax.rawValue, "gated fixture identity")
    expect(receipt.controls.continentDistribution == "oneDominant", "exact enum control")
    expect(receipt.controls.oceanConnectivity == "multipleBasins", "second enum control")
    expect(receipt.controls.polarCharacter == "oceanBiased", "third enum control")
    expect(GatedAtlasFixtureID(rawValue: "milestone-2-atlas-control-min") == nil, "unknown ID")
  }

  private static func rejectsUnknownDriftedIncompleteAndMalformedReceipts() throws {
    try expectInvalid("fixture identity drift") {
      _ = try AtlasFixtureDefinitionParser.parse(definitionData(), expectedFixture: .proof)
    }
    let definition = try AtlasFixtureDefinitionParser.parse(
      definitionData(),
      expectedFixture: .controlMax
    )
    try expectInvalid("fixture control drift") {
      _ = try PackagedAtlasFixtureReceiptParser.parse(
        receiptText().replacingOccurrences(
          of: #""polarCharacter":"oceanBiased""#,
          with: #""polarCharacter":"neutral""#
        ),
        expectedDefinition: definition,
        expectedPhase: .accepted
      )
    }
    try expectInvalid("wrong phase") {
      _ = try PackagedAtlasFixtureReceiptParser.parse(
        receiptText(),
        expectedDefinition: definition,
        expectedPhase: .preview
      )
    }
    try expectInvalid("partial receipt") {
      _ = try PackagedAtlasFixtureReceiptParser.parse(
        receiptText().replacingOccurrences(of: #","productionFullPath":true"#, with: ""),
        expectedDefinition: definition,
        expectedPhase: .accepted
      )
    }
    try expectInvalid("unknown receipt field") {
      _ = try PackagedAtlasFixtureReceiptParser.parse(
        receiptText().replacingOccurrences(of: "{", with: #"{"unexpected":true,"#, options: [], range: receiptText().startIndex..<receiptText().index(after: receiptText().startIndex)),
        expectedDefinition: definition,
        expectedPhase: .accepted
      )
    }
    try expectInvalid("malformed receipt") {
      _ = try PackagedAtlasFixtureReceiptParser.parse(
        "not-json",
        expectedDefinition: definition,
        expectedPhase: .accepted
      )
    }
  }

  private static func checksAcceptedAtlasFramePredicate() {
    let accepted = AcceptedAtlasPixelObservation(
      hash: 2,
      landLike: 40_000,
      waterLike: 80_000,
      inkLike: 100,
      previewLandLike: 0,
      previewWaterLike: 0
    )
    expect(
      AcceptedAtlasFramePredicate.qualifies(
        complete: true,
        displayTime: 11,
        dispatchTime: 10,
        baselineHash: 1,
        candidate: accepted,
        foregroundIntact: true
      ),
      "complete changed accepted-atlas frame"
    )
    for (label, candidate) in [
      (
        "disposable preview",
        AcceptedAtlasPixelObservation(
          hash: 3,
          landLike: 0,
          waterLike: 0,
          inkLike: 0,
          previewLandLike: 40_000,
          previewWaterLike: 80_000
        )
      ),
      (
        "incomplete accepted paint",
        AcceptedAtlasPixelObservation(
          hash: 4,
          landLike: 40_000,
          waterLike: 80_000,
          inkLike: 0,
          previewLandLike: 0,
          previewWaterLike: 0
        )
      ),
    ] {
      expect(
        !AcceptedAtlasFramePredicate.qualifies(
          complete: true,
          displayTime: 11,
          dispatchTime: 10,
          baselineHash: 1,
          candidate: candidate,
          foregroundIntact: true
        ),
        "\(label) rejection"
      )
    }
    expect(
      !AcceptedAtlasFramePredicate.qualifies(
        complete: false,
        displayTime: 11,
        dispatchTime: 10,
        baselineHash: 1,
        candidate: accepted,
        foregroundIntact: true
      ),
      "partial frame rejection"
    )
    expect(
      !AcceptedAtlasFramePredicate.qualifies(
        complete: true,
        displayTime: 9,
        dispatchTime: 10,
        baselineHash: 1,
        candidate: accepted,
        foregroundIntact: true
      ),
      "stale frame rejection"
    )
    expect(
      !AcceptedAtlasFramePredicate.qualifies(
        complete: true,
        displayTime: 11,
        dispatchTime: 10,
        baselineHash: 2,
        candidate: accepted,
        foregroundIntact: true
      ),
      "unchanged frame rejection"
    )
    expect(
      !AcceptedAtlasFramePredicate.qualifies(
        complete: true,
        displayTime: 11,
        dispatchTime: 10,
        baselineHash: 1,
        candidate: accepted,
        foregroundIntact: false
      ),
      "foreground loss rejection"
    )
  }

  private static func definitionData() -> Data {
    """
    {
      "fixtureDefinitionVersion": 2,
      "fixtureId": "milestone-2-atlas-control-max",
      "worldSeed": "16045690984503098046",
      "controls": \(controlsText()),
      "reviewPurpose": "ignored repository-owned metadata"
    }
    """.data(using: .utf8)!
  }

  private static func receiptText() -> String {
    """
    {"version":"packaged-atlas-observer-fixture-v1","fixtureId":"milestone-2-atlas-control-max","worldSeed":"16045690984503098046","controls":\(controlsText()),"phase":"accepted","productionPreviewPath":true,"productionFullPath":true}
    """.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private static func controlsText() -> String {
    """
    {"worldCircumferenceKm":80000,"targetWaterCoveragePercent":80,"continentCountIntent":8,"continentDistribution":"oneDominant","fragmentationPercent":100,"islandAbundancePercent":100,"archipelagoAbundancePercent":100,"oceanConnectivity":"multipleBasins","polarCharacter":"oceanBiased"}
    """.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private static func expect(_ condition: @autoclosure () -> Bool, _ label: String) {
    if !condition() { fatalError("expectation failed: \(label)") }
  }

  private static func expectInvalid(_ label: String, _ body: () throws -> Void) throws {
    do {
      try body()
      fatalError("expected invalidation: \(label)")
    } catch is PreviewObserverInvalidation {}
  }
}
