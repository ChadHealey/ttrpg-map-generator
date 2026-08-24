import Foundation

enum GenerationCancellationOperation: String, Codable, CaseIterable {
  case preview
  case full

  var acknowledgementLimitMilliseconds: Double { self == .preview ? 100 : 500 }
}

enum GenerationCancellationSafePoint: String, Codable, CaseIterable {
  case early
  case middle
  case late

  var targetCompletedWork: Int {
    switch self {
    case .early: 0
    case .middle: 500
    case .late: 980
    }
  }
}

struct GenerationCancellationProgressReceipt: Codable, Equatable {
  let operationId: String
  let stage: String
  let completedWork: Int
  let totalWork: Int
  let isCancellationRequested: Bool
  let isTerminal: Bool
}

struct GenerationCancellationCanonicalAuthority: Codable, Equatable {
  let canonicalAspectSetSha256: String
  let canonicalOutputSetSha256: String
  let canonicalCoastlineOutputSha256: String
}

struct GenerationCancellationPreState: Codable, Equatable {
  let workflowPhase: String
  let disposablePreviewPresent: Bool
  let acceptedAtlasPresent: Bool
}

struct PackagedGenerationCancellationReceipt: Codable, Equatable {
  let version: String
  let fixtureId: String
  let worldSeed: String
  let controls: AtlasControlsReceipt
  let operation: GenerationCancellationOperation
  let safePoint: GenerationCancellationSafePoint
  let targetCompletedWork: Int
  let status: String
  let productionPreviewPath: Bool
  let productionFullPath: Bool
  let productionCancellationPath: Bool
  let preState: GenerationCancellationPreState
  let observedSafePoint: GenerationCancellationProgressReceipt?
  let progressSamples: [GenerationCancellationProgressReceipt]
  let cancellationDispatchEpochMilliseconds: Double?
  let terminalAcknowledgementEpochMilliseconds: Double?
  let acknowledgementMilliseconds: Double?
  let terminalProgress: GenerationCancellationProgressReceipt?
  let costlySchedulingStopped: Bool?
  let previousStatePreserved: Bool?
  let noAcceptedCommitAtAcknowledgement: Bool?
  let nextCompletion: GenerationCancellationCanonicalAuthority?
  let nextCompletionCanonicallyDeterministic: Bool?
  let invalidReason: String?
}

enum GenerationCancellationReceiptValidator {
  static func parse(
    _ text: String,
    definition: GatedAtlasFixtureDefinition,
    operation: GenerationCancellationOperation,
    safePoint: GenerationCancellationSafePoint,
    expectedStatus: String
  ) throws -> PackagedGenerationCancellationReceipt {
    guard let data = text.data(using: .utf8) else {
      throw invalid("the generation-cancellation receipt was not UTF-8")
    }
    let receipt: PackagedGenerationCancellationReceipt
    do { receipt = try JSONDecoder().decode(PackagedGenerationCancellationReceipt.self, from: data) }
    catch { throw invalid("the generation-cancellation receipt was malformed") }
    guard receipt.version == "packaged-generation-cancellation-observer-v1",
      receipt.fixtureId == definition.fixtureId,
      receipt.worldSeed == definition.worldSeed,
      receipt.controls == definition.controls,
      receipt.operation == operation,
      receipt.safePoint == safePoint,
      receipt.targetCompletedWork == safePoint.targetCompletedWork,
      receipt.status == expectedStatus,
      receipt.productionPreviewPath,
      receipt.productionFullPath,
      receipt.productionCancellationPath,
      receipt.invalidReason == nil
    else { throw invalid("the generation-cancellation receipt contradicted its authority") }
    try validatePreState(receipt)
    try validateProgress(receipt)
    if expectedStatus == "cancelled" || expectedStatus == "aftermath-complete" {
      try validateTerminal(receipt)
    }
    if expectedStatus == "aftermath-complete" { try validateAftermath(receipt) }
    return receipt
  }

  private static func validatePreState(_ receipt: PackagedGenerationCancellationReceipt) throws {
    let expectedPhase = receipt.operation == .preview ? "empty" : "preview"
    let expectedPreview = receipt.operation == .full
    guard receipt.preState.workflowPhase == expectedPhase,
      receipt.preState.disposablePreviewPresent == expectedPreview,
      !receipt.preState.acceptedAtlasPresent
    else { throw invalid("the cancellation pre-state did not preserve the normal workflow boundary") }
  }

  private static func validateProgress(_ receipt: PackagedGenerationCancellationReceipt) throws {
    guard let observed = receipt.observedSafePoint,
      !receipt.progressSamples.isEmpty,
      receipt.progressSamples.contains(observed),
      observed.totalWork == 1_000,
      !observed.isTerminal,
      !observed.isCancellationRequested,
      safePointContains(receipt.safePoint, work: observed.completedWork)
    else { throw invalid("the declared safe point was missing or ambiguous") }
    let operationId = receipt.progressSamples.first?.operationId
    var previousWork = -1
    var terminalSeen = false
    for sample in receipt.progressSamples {
      guard sample.operationId == operationId,
        sample.totalWork == 1_000,
        sample.completedWork >= previousWork,
        sample.completedWork >= 0,
        sample.completedWork <= sample.totalWork,
        !terminalSeen
      else { throw invalid("progress identity, bounds, monotonicity, or ordering was invalid") }
      previousWork = sample.completedWork
      terminalSeen = sample.isTerminal
    }
  }

  private static func validateTerminal(_ receipt: PackagedGenerationCancellationReceipt) throws {
    guard let dispatched = receipt.cancellationDispatchEpochMilliseconds,
      let acknowledged = receipt.terminalAcknowledgementEpochMilliseconds,
      let latency = receipt.acknowledgementMilliseconds,
      dispatched.isFinite,
      acknowledged.isFinite,
      latency.isFinite,
      acknowledged >= dispatched,
      abs((acknowledged - dispatched) - latency) < 0.01,
      latency >= 0,
      latency <= receipt.operation.acknowledgementLimitMilliseconds,
      let terminal = receipt.terminalProgress,
      terminal == receipt.progressSamples.last,
      terminal.stage == "cancelled",
      terminal.isTerminal,
      terminal.isCancellationRequested,
      receipt.costlySchedulingStopped == true,
      receipt.previousStatePreserved == true,
      receipt.noAcceptedCommitAtAcknowledgement == true
    else { throw invalid("terminal acknowledgement, latency, or preservation proof was invalid") }
  }

  private static func validateAftermath(_ receipt: PackagedGenerationCancellationReceipt) throws {
    guard let next = receipt.nextCompletion,
      receipt.nextCompletionCanonicallyDeterministic == true,
      isDigest(next.canonicalAspectSetSha256),
      isDigest(next.canonicalOutputSetSha256),
      isDigest(next.canonicalCoastlineOutputSha256)
    else { throw invalid("the deterministic next-completion authority was incomplete") }
  }

  private static func safePointContains(
    _ safePoint: GenerationCancellationSafePoint,
    work: Int
  ) -> Bool {
    switch safePoint {
    case .early: work >= 0 && work < 500
    case .middle: work >= 500 && work < 980
    case .late: work >= 980 && work < 1_000
    }
  }

  private static func isDigest(_ value: String) -> Bool {
    value.count == 64 && value.allSatisfy { $0.isHexDigit && !$0.isUppercase }
  }

  private static func invalid(_ reason: String) -> PreviewObserverInvalidation {
    .accessibility(reason)
  }
}
