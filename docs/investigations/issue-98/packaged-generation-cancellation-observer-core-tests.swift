import Foundation

@main
enum PackagedGenerationCancellationObserverCoreTests {
  static func main() throws {
    try acceptsEveryRequiredClass()
    try rejectsSafePointAmbiguity()
    try rejectsProgressRegressionAndLateCompletion()
    try rejectsLatencyAndCanonicalDrift()
    print("packaged-generation-cancellation-observer-core-tests: passed")
  }

  private static func acceptsEveryRequiredClass() throws {
    for operation in GenerationCancellationOperation.allCases {
      for safePoint in GenerationCancellationSafePoint.allCases {
        let receipt = try GenerationCancellationReceiptValidator.parse(
          receiptText(operation: operation, safePoint: safePoint),
          definition: definition,
          operation: operation,
          safePoint: safePoint,
          expectedStatus: "aftermath-complete"
        )
        expect(receipt.nextCompletionCanonicallyDeterministic == true, "canonical aftermath")
      }
    }
  }

  private static func rejectsSafePointAmbiguity() throws {
    try expectRejected(
      receiptText(operation: .preview, safePoint: .middle, observedWork: 990),
      operation: .preview,
      safePoint: .middle
    )
  }

  private static func rejectsProgressRegressionAndLateCompletion() throws {
    try expectRejected(
      receiptText(operation: .full, safePoint: .middle, terminalWork: 499),
      operation: .full,
      safePoint: .middle
    )
    try expectRejected(
      receiptText(operation: .full, safePoint: .late, terminalStage: "completed"),
      operation: .full,
      safePoint: .late
    )
  }

  private static func rejectsLatencyAndCanonicalDrift() throws {
    try expectRejected(
      receiptText(operation: .preview, safePoint: .early, latency: 100.01),
      operation: .preview,
      safePoint: .early
    )
    try expectRejected(
      receiptText(operation: .full, safePoint: .early, canonicalDigest: "bad"),
      operation: .full,
      safePoint: .early
    )
  }

  private static func expectRejected(
    _ text: String,
    operation: GenerationCancellationOperation,
    safePoint: GenerationCancellationSafePoint
  ) throws {
    do {
      _ = try GenerationCancellationReceiptValidator.parse(
        text,
        definition: definition,
        operation: operation,
        safePoint: safePoint,
        expectedStatus: "aftermath-complete"
      )
      throw TestFailure(message: "expected fail-closed rejection")
    } catch is PreviewObserverInvalidation {}
  }

  private static func receiptText(
    operation: GenerationCancellationOperation,
    safePoint: GenerationCancellationSafePoint,
    observedWork: Int? = nil,
    terminalWork: Int? = nil,
    terminalStage: String = "cancelled",
    latency: Double = 12,
    canonicalDigest: String = String(repeating: "a", count: 64)
  ) -> String {
    let work = observedWork ?? safePoint.targetCompletedWork
    let finalWork = terminalWork ?? work
    let prePhase = operation == .preview ? "empty" : "preview"
    let preview = operation == .full
    return """
      {"version":"packaged-generation-cancellation-observer-v1","fixtureId":"milestone-2-atlas-proof","worldSeed":"81985529216486895","controls":\(controlsText),"operation":"\(operation.rawValue)","safePoint":"\(safePoint.rawValue)","targetCompletedWork":\(safePoint.targetCompletedWork),"status":"aftermath-complete","productionPreviewPath":true,"productionFullPath":true,"productionCancellationPath":true,"preState":{"workflowPhase":"\(prePhase)","disposablePreviewPresent":\(preview),"acceptedAtlasPresent":false},"observedSafePoint":{"operationId":"atlas:test:1","stage":"sampling","completedWork":\(work),"totalWork":1000,"isCancellationRequested":false,"isTerminal":false},"progressSamples":[{"operationId":"atlas:test:1","stage":"sampling","completedWork":\(work),"totalWork":1000,"isCancellationRequested":false,"isTerminal":false},{"operationId":"atlas:test:1","stage":"\(terminalStage)","completedWork":\(finalWork),"totalWork":1000,"isCancellationRequested":true,"isTerminal":true}],"cancellationDispatchEpochMilliseconds":1000,"terminalAcknowledgementEpochMilliseconds":\(1000 + latency),"acknowledgementMilliseconds":\(latency),"terminalProgress":{"operationId":"atlas:test:1","stage":"\(terminalStage)","completedWork":\(finalWork),"totalWork":1000,"isCancellationRequested":true,"isTerminal":true},"costlySchedulingStopped":true,"previousStatePreserved":true,"noAcceptedCommitAtAcknowledgement":true,"nextCompletion":{"canonicalAspectSetSha256":"\(canonicalDigest)","canonicalOutputSetSha256":"\(String(repeating: "b", count: 64))","canonicalCoastlineOutputSha256":"\(String(repeating: "c", count: 64))"},"nextCompletionCanonicallyDeterministic":true}
      """
  }

  private static let definition = GatedAtlasFixtureDefinition(
    fixtureDefinitionVersion: 2,
    fixtureId: "milestone-2-atlas-proof",
    worldSeed: "81985529216486895",
    controls: AtlasControlsReceipt(
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
  )

  private static let controlsText = """
    {"worldCircumferenceKm":40000,"targetWaterCoveragePercent":65,"continentCountIntent":4,"continentDistribution":"varied","fragmentationPercent":35,"islandAbundancePercent":35,"archipelagoAbundancePercent":25,"oceanConnectivity":"singleGlobal","polarCharacter":"neutral"}
    """

  private static func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
    if !condition() { fatalError(message) }
  }
}

private struct TestFailure: Error { let message: String }
