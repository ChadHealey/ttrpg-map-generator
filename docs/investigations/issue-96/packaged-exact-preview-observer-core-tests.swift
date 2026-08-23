import Foundation

@main
enum PackagedExactPreviewObserverCoreTests {
  static func main() throws {
    try acceptsExactlyThreeDefinitionsAndPreviewReceipts()
    try rejectsFixtureControlPhaseAndReceiptDrift()
    rejectsStaleWrongUnchangedAndForegroundLostFrames()
    print("packaged-exact-preview-observer-core-tests: passed")
  }

  private static func acceptsExactlyThreeDefinitionsAndPreviewReceipts() throws {
    let cases: [(GatedAtlasFixtureID, String, AtlasControlsReceipt)] = [
      (
        .proof,
        "81985529216486895",
        controls(
          circumference: 40_000,
          water: 65,
          continents: 4,
          distribution: "varied",
          fragmentation: 35,
          islands: 35,
          archipelagos: 25,
          connectivity: "singleGlobal",
          polar: "neutral"
        )
      ),
      (
        .fragmentedIslands,
        "18364758544493064720",
        controls(
          circumference: 40_000,
          water: 70,
          continents: 5,
          distribution: "varied",
          fragmentation: 90,
          islands: 95,
          archipelagos: 95,
          connectivity: "singleGlobal",
          polar: "neutral"
        )
      ),
      (
        .controlMax,
        "16045690984503098046",
        controls(
          circumference: 80_000,
          water: 80,
          continents: 8,
          distribution: "oneDominant",
          fragmentation: 100,
          islands: 100,
          archipelagos: 100,
          connectivity: "multipleBasins",
          polar: "oceanBiased"
        )
      ),
    ]
    expect(GatedAtlasFixtureID.allCases.count == 3, "exact gated fixture count")
    for (fixture, seed, expectedControls) in cases {
      let definition = try AtlasFixtureDefinitionParser.parse(
        definitionData(fixture: fixture, seed: seed, controls: expectedControls),
        expectedFixture: fixture
      )
      let receipt = try PackagedAtlasFixtureReceiptParser.parse(
        receiptText(definition: definition, phase: .preview),
        expectedDefinition: definition,
        expectedPhase: .preview
      )
      expect(receipt.worldSeed == seed, "canonical seed for \(fixture.rawValue)")
      expect(receipt.controls == expectedControls, "nine controls for \(fixture.rawValue)")
      expect(receipt.productionPreviewPath, "production preview path")
    }
    expect(GatedAtlasFixtureID(rawValue: "milestone-2-atlas-control-min") == nil, "unknown fixture")
  }

  private static func rejectsFixtureControlPhaseAndReceiptDrift() throws {
    let expectedControls = controls(
      circumference: 80_000,
      water: 80,
      continents: 8,
      distribution: "oneDominant",
      fragmentation: 100,
      islands: 100,
      archipelagos: 100,
      connectivity: "multipleBasins",
      polar: "oceanBiased"
    )
    let definition = try AtlasFixtureDefinitionParser.parse(
      definitionData(
        fixture: .controlMax,
        seed: "16045690984503098046",
        controls: expectedControls
      ),
      expectedFixture: .controlMax
    )
    try expectInvalid("fixture mismatch") {
      _ = try AtlasFixtureDefinitionParser.parse(
        definitionData(
          fixture: .controlMax,
          seed: "16045690984503098046",
          controls: expectedControls
        ),
        expectedFixture: .proof
      )
    }
    try expectInvalid("control drift") {
      _ = try PackagedAtlasFixtureReceiptParser.parse(
        receiptText(definition: definition, phase: .preview)
          .replacingOccurrences(of: #""polarCharacter":"oceanBiased""#, with: #""polarCharacter":"neutral""#),
        expectedDefinition: definition,
        expectedPhase: .preview
      )
    }
    try expectInvalid("wrong phase") {
      _ = try PackagedAtlasFixtureReceiptParser.parse(
        receiptText(definition: definition, phase: .configured),
        expectedDefinition: definition,
        expectedPhase: .preview
      )
    }
    try expectInvalid("unknown field") {
      let receipt = receiptText(definition: definition, phase: .preview)
      _ = try PackagedAtlasFixtureReceiptParser.parse(
        receipt.replacingOccurrences(
          of: "{",
          with: #"{"unexpected":true,"#,
          options: [],
          range: receipt.startIndex..<receipt.index(after: receipt.startIndex)
        ),
        expectedDefinition: definition,
        expectedPhase: .preview
      )
    }
    try expectInvalid("malformed receipt") {
      _ = try PackagedAtlasFixtureReceiptParser.parse(
        "not-json",
        expectedDefinition: definition,
        expectedPhase: .preview
      )
    }
  }

  private static func rejectsStaleWrongUnchangedAndForegroundLostFrames() {
    let baseline = PixelObservation(hash: 1, landLike: 0, waterLike: 0)
    let valid = PixelObservation(hash: 2, landLike: 40_000, waterLike: 80_000)
    let wrong = PixelObservation(hash: 3, landLike: 0, waterLike: 131_072)
    expect(
      PreviewFramePredicate.qualifies(
        complete: true,
        displayTime: 11,
        dispatchTime: 10,
        baseline: baseline,
        candidate: valid,
        foregroundIntact: true
      ),
      "valid changed preview frame"
    )
    for (label, complete, displayTime, candidate, foreground) in [
      ("partial", false, UInt64(11), valid, true),
      ("stale", true, UInt64(9), valid, true),
      ("unchanged", true, UInt64(11), baseline, true),
      ("wrong palette", true, UInt64(11), wrong, true),
      ("foreground loss", true, UInt64(11), valid, false),
    ] {
      expect(
        !PreviewFramePredicate.qualifies(
          complete: complete,
          displayTime: displayTime,
          dispatchTime: 10,
          baseline: baseline,
          candidate: candidate,
          foregroundIntact: foreground
        ),
        "\(label) rejection"
      )
    }
  }

  private static func definitionData(
    fixture: GatedAtlasFixtureID,
    seed: String,
    controls: AtlasControlsReceipt
  ) -> Data {
    """
    {"fixtureDefinitionVersion":2,"fixtureId":"\(fixture.rawValue)","worldSeed":"\(seed)","controls":\(controlsText(controls)),"reviewPurpose":"ignored"}
    """.data(using: .utf8)!
  }

  private static func receiptText(
    definition: GatedAtlasFixtureDefinition,
    phase: PackagedAtlasObserverPhase
  ) -> String {
    """
    {"version":"packaged-atlas-observer-fixture-v1","fixtureId":"\(definition.fixtureId)","worldSeed":"\(definition.worldSeed)","controls":\(controlsText(definition.controls)),"phase":"\(phase.rawValue)","productionPreviewPath":true,"productionFullPath":true}
    """.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private static func controls(
    circumference: Int,
    water: Int,
    continents: Int,
    distribution: String,
    fragmentation: Int,
    islands: Int,
    archipelagos: Int,
    connectivity: String,
    polar: String
  ) -> AtlasControlsReceipt {
    AtlasControlsReceipt(
      worldCircumferenceKm: circumference,
      targetWaterCoveragePercent: water,
      continentCountIntent: continents,
      continentDistribution: distribution,
      fragmentationPercent: fragmentation,
      islandAbundancePercent: islands,
      archipelagoAbundancePercent: archipelagos,
      oceanConnectivity: connectivity,
      polarCharacter: polar
    )
  }

  private static func controlsText(_ controls: AtlasControlsReceipt) -> String {
    """
    {"worldCircumferenceKm":\(controls.worldCircumferenceKm),"targetWaterCoveragePercent":\(controls.targetWaterCoveragePercent),"continentCountIntent":\(controls.continentCountIntent),"continentDistribution":"\(controls.continentDistribution)","fragmentationPercent":\(controls.fragmentationPercent),"islandAbundancePercent":\(controls.islandAbundancePercent),"archipelagoAbundancePercent":\(controls.archipelagoAbundancePercent),"oceanConnectivity":"\(controls.oceanConnectivity)","polarCharacter":"\(controls.polarCharacter)"}
    """.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private static func expectInvalid(_ label: String, _ operation: () throws -> Void) throws {
    do {
      try operation()
      fatalError("expected invalidation: \(label)")
    } catch is PreviewObserverInvalidation {}
  }

  private static func expect(_ condition: @autoclosure () -> Bool, _ label: String) {
    guard condition() else { fatalError("failed: \(label)") }
  }
}
