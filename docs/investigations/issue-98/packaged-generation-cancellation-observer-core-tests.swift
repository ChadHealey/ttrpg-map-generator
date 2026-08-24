import Foundation

@main
enum PackagedGenerationCancellationObserverCoreTests {
  static func main() throws {
    try acceptsEveryRequiredClass()
    try rejectsSafePointAmbiguity()
    try rejectsProgressRegressionAndLateCompletion()
    try rejectsLatencyAndCanonicalDrift()
    try acceptsPixelChangesWithoutACompletionSignature()
    try rejectsLatePreviewCompletionEvenAfterStateReturns()
    try rejectsLateAcceptedAtlasCompletionEvenAfterStateReturns()
    try rejectsIndependentPostAcknowledgementFailures()
    try preservesIndependentMembershipAndSamplingFailures()
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

  private static func acceptsPixelChangesWithoutACompletionSignature() throws {
    var window = presentationWindow(operation: .preview)
    window.markAcknowledged(at: 1_000)
    window.observeCompleteFrame(
      displayTime: 999,
      observation: frame(hash: 40, previewLand: 100, previewWater: 100),
      foregroundIntact: true
    )
    window.observeCompleteFrame(
      displayTime: 1_000,
      observation: frame(hash: 50, previewLand: 100, previewWater: 100),
      foregroundIntact: true
    )
    window.observeCompleteFrame(
      displayTime: 1_001,
      observation: frame(hash: 20, previewLand: 0, previewWater: 0),
      foregroundIntact: true
    )
    window.observeCompleteFrame(
      displayTime: 1_002,
      observation: frame(hash: 30, previewLand: 99, previewWater: 99),
      foregroundIntact: true
    )
    expect(window.summary.pixelsChanged, "pixel changes remain diagnostic")
    expect(window.summary.pixelChangeFrameCount == 2, "changed-frame diagnostic count")
    expect(
      window.summary.postAcknowledgementCompleteFrameCount == 2,
      "frames at or before acknowledgement are ignored"
    )
    expect(
      !window.summary.completedPresentationSignatureDetected,
      "pixel changes alone are not completed presentation"
    )
    try GenerationCancellationPostAcknowledgementValidator.validate(
      presentation: window.summary,
      foregroundIntact: true,
      accessibilityStatePreserved: true
    )
  }

  private static func rejectsLatePreviewCompletionEvenAfterStateReturns() throws {
    var window = presentationWindow(operation: .preview)
    window.markAcknowledged(at: 1_000)
    window.observeCompleteFrame(
      displayTime: 1_001,
      observation: frame(hash: 20, previewLand: 100, previewWater: 100),
      foregroundIntact: true
    )
    window.observeCompleteFrame(
      displayTime: 1_002,
      observation: frame(hash: 10),
      foregroundIntact: true
    )
    expect(window.summary.completedPresentationSignatureDetected, "late preview signature is sticky")
    try expectPostAcknowledgementRejected(
      window.summary,
      authority: "screen-capture",
      reason: "completed-presentation signature appeared"
    )
  }

  private static func rejectsLateAcceptedAtlasCompletionEvenAfterStateReturns() throws {
    var window = presentationWindow(operation: .full)
    window.markAcknowledged(at: 1_000)
    window.observeCompleteFrame(
      displayTime: 1_001,
      observation: frame(
        hash: 20,
        acceptedLand: 100,
        acceptedWater: 100,
        acceptedInk: 8,
        previewLand: 0,
        previewWater: 0
      ),
      foregroundIntact: true
    )
    window.observeCompleteFrame(
      displayTime: 1_002,
      observation: frame(hash: 10),
      foregroundIntact: true
    )
    expect(
      window.summary.completedPresentationSignatureDetected,
      "late accepted-atlas signature is sticky"
    )
    try expectPostAcknowledgementRejected(
      window.summary,
      authority: "screen-capture",
      reason: "completed-presentation signature appeared"
    )
  }

  private static func rejectsIndependentPostAcknowledgementFailures() throws {
    try expectPostAcknowledgementRejected(
      summary(baseline: false, frames: 2),
      authority: "screen-capture",
      reason: "no complete pre-dispatch frame"
    )
    try expectPostAcknowledgementRejected(
      summary(baseline: true, frames: 0),
      authority: "screen-capture",
      reason: "fewer than two complete post-acknowledgement"
    )
    try expectPostAcknowledgementRejected(
      summary(baseline: true, frames: 1),
      authority: "screen-capture",
      reason: "fewer than two complete post-acknowledgement"
    )
    try expectPostAcknowledgementRejected(
      summary(baseline: true, frames: 2),
      foregroundIntact: false,
      authority: "foreground",
      reason: "did not remain frontmost"
    )
    try expectPostAcknowledgementRejected(
      summary(baseline: true, frames: 2),
      accessibilityStatePreserved: false,
      authority: "accessibility",
      reason: "Accessibility presentation state drifted"
    )
  }

  private static func preservesIndependentMembershipAndSamplingFailures() throws {
    let coalition = LaunchctlCoalition(id: 1, name: "test", bundleIdentifier: "test.bundle")
    let baseline = ResolvedPreviewProcesses(
      coalition: coalition,
      pidsByRole: [.application: 1, .gpu: 2, .networking: 3, .webContent: 4]
    )
    let completion = ResolvedPreviewProcesses(
      coalition: coalition,
      pidsByRole: [.application: 1, .gpu: 2, .networking: 3, .webContent: 5]
    )
    do {
      try PreviewProcessResolver.revalidate(baseline: baseline, completion: completion)
      throw TestFailure(message: "expected membership rejection")
    } catch let invalidation as PreviewObserverInvalidation {
      expect(invalidation.authority == "launchctl-membership", "membership authority")
    }

    do {
      _ = try RSSReceiptValidator.measurement(
        csv: "epoch_ms,aggregate_rss_bytes,pid_1\n1000,1,1\n1021,1,1\n",
        summary: "samples=2 max_interval_ms=21",
        expectedRoleCount: 1,
        dispatchEpochMilliseconds: 1_000,
        completionEpochMilliseconds: 1_001
      )
      throw TestFailure(message: "expected sampler rejection")
    } catch let invalidation as PreviewObserverInvalidation {
      expect(invalidation.authority == "rss-sampler", "sampler authority")
      expect(invalidation.description.contains("cadence"), "sampler reason")
    }
  }

  private static func expectPostAcknowledgementRejected(
    _ presentation: GenerationCancellationPresentationSummary,
    foregroundIntact: Bool = true,
    accessibilityStatePreserved: Bool = true,
    authority: String,
    reason: String
  ) throws {
    do {
      try GenerationCancellationPostAcknowledgementValidator.validate(
        presentation: presentation,
        foregroundIntact: foregroundIntact,
        accessibilityStatePreserved: accessibilityStatePreserved
      )
      throw TestFailure(message: "expected post-acknowledgement rejection")
    } catch let invalidation as PreviewObserverInvalidation {
      expect(invalidation.authority == authority, "independent invalidation authority")
      expect(invalidation.description.contains(reason), "independent invalidation reason")
    }
  }

  private static func summary(
    baseline: Bool,
    frames: Int,
    pixelChanges: Int = 0,
    signature: Bool = false
  ) -> GenerationCancellationPresentationSummary {
    GenerationCancellationPresentationSummary(
      presentationBaselineEstablished: baseline,
      postAcknowledgementCompleteFrameCount: frames,
      pixelChangeFrameCount: pixelChanges,
      completedPresentationSignatureDetected: signature
    )
  }

  private static func presentationWindow(
    operation: GenerationCancellationOperation
  ) -> GenerationCancellationPresentationWindow {
    var window = GenerationCancellationPresentationWindow(operation: operation)
    window.establishPresentationBaseline(frame(hash: 10))
    return window
  }

  private static func frame(
    hash: UInt64,
    acceptedLand: Int = 0,
    acceptedWater: Int = 0,
    acceptedInk: Int = 0,
    previewLand: Int = 0,
    previewWater: Int = 0
  ) -> GenerationCancellationFrameObservation {
    GenerationCancellationFrameObservation(
      preview: PixelObservation(
        hash: hash,
        landLike: previewLand,
        waterLike: previewWater
      ),
      acceptedAtlas: AcceptedAtlasPixelObservation(
        hash: hash,
        landLike: acceptedLand,
        waterLike: acceptedWater,
        inkLike: acceptedInk,
        previewLandLike: previewLand,
        previewWaterLike: previewWater
      )
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
