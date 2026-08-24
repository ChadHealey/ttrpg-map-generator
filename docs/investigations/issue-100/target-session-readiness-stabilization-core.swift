import Foundation

let issue105ReadinessSchemaVersion = "issue106-target-session-readiness-v3"

struct Issue105RetainedCandidateIdentity: Equatable {
  let processIdentifier: Int32
  let windowIdentity: UInt
}

enum Issue105SessionActionResult: Equatable {
  case success
  case retryableCannotComplete
  case unsupported
  case failed
}

struct Issue105StabilizationPolicy: Equatable {
  let timeoutMilliseconds: UInt64
  let pollIntervalMilliseconds: UInt64
  let maximumObservationCount: Int

  static let approved = Issue105StabilizationPolicy(
    timeoutMilliseconds: 20_000,
    pollIntervalMilliseconds: 50,
    maximumObservationCount: 401
  )
}

struct Issue105TerminalPredicates: Codable, Equatable {
  let exactCandidateRetained: Bool
  let exactWindowRetained: Bool
  let visibleWindow: Bool
  let workspaceFrontmost: Bool
  let accessibilityFrontmost: Bool
  let independentObserverVerified: Bool

  static let none = Issue105TerminalPredicates(
    exactCandidateRetained: false,
    exactWindowRetained: false,
    visibleWindow: false,
    workspaceFrontmost: false,
    accessibilityFrontmost: false,
    independentObserverVerified: false
  )
}

struct Issue106VisibilityPredicates: Codable, Equatable {
  let applicationHidden: Bool
  let windowMinimized: Bool
  let windowFrameVisible: Bool
  let visibleWindow: Bool

  init(snapshot: TargetSessionReadinessSnapshot) {
    applicationHidden = snapshot.applicationHidden
    windowMinimized = snapshot.windowMinimized
    windowFrameVisible = snapshot.windowFrameVisible
    visibleWindow = snapshot.visibleWindow
  }
}

struct Issue105StabilizationDiagnostics: Codable, Equatable {
  let policyTimeoutMilliseconds: UInt64
  let pollIntervalMilliseconds: UInt64
  let stabilizationDurationMilliseconds: UInt64
  let activationRequestCount: Int
  let stabilizationObservationCount: Int
  let raiseAttemptCount: Int
  let retryableRaiseFailureCount: Int
  let frontmostWriteAttemptCount: Int
  let initialVisibilityPredicates: Issue106VisibilityPredicates?
  let terminalVisibilityPredicates: Issue106VisibilityPredicates?
  let visibilityPendingObservationCount: Int
  let visibilityPendingDurationMilliseconds: UInt64
  let terminalPredicates: Issue105TerminalPredicates
}

struct Issue105StabilizationOutcome: Equatable {
  let diagnostics: Issue105StabilizationDiagnostics
  let terminalSnapshot: TargetSessionReadinessSnapshot
}

struct Issue105ReadinessFailure: Error {
  let invalidation: TargetSessionReadinessInvalidation
  let diagnostics: Issue105StabilizationDiagnostics
}

enum Issue105TargetSessionStabilizer {
  static func validateActivationRequest(accepted: Bool) throws {
    guard accepted else {
      throw TargetSessionReadinessInvalidation.action(
        "the exact packaged candidate activation request was not accepted")
    }
  }

  static func validateRetainedIdentity(
    _ snapshot: TargetSessionReadinessSnapshot,
    retainedIdentity: Issue105RetainedCandidateIdentity
  ) throws {
    guard snapshot.applicationCount == 1, snapshot.processIdentifier != nil else {
      throw TargetSessionReadinessInvalidation.processState(
        "expected exactly one live packaged candidate during stabilization")
    }
    guard snapshot.windowCount == 1, snapshot.windowIdentity != nil else {
      throw TargetSessionReadinessInvalidation.accessibility(
        "expected exactly one packaged candidate Accessibility window during stabilization")
    }
    guard snapshot.processIdentifier == retainedIdentity.processIdentifier,
      snapshot.windowIdentity == retainedIdentity.windowIdentity
    else {
      throw TargetSessionReadinessInvalidation.processState(
        "the packaged candidate application or window identity changed during stabilization")
    }
    guard snapshot.executableIdentityMatched else {
      throw TargetSessionReadinessInvalidation.identity(
        "the live packaged candidate executable identity drifted during stabilization")
    }
  }

  static func stabilize(
    policy: Issue105StabilizationPolicy,
    retainedIdentity: Issue105RetainedCandidateIdentity,
    elapsedMilliseconds: () -> UInt64,
    observe: () throws -> TargetSessionReadinessSnapshot,
    performRaise: () -> Issue105SessionActionResult,
    writeFrontmost: () -> Issue105SessionActionResult,
    wait: (_ milliseconds: UInt64) -> Void
  ) throws -> Issue105StabilizationOutcome {
    var observationCount = 0
    var raiseAttemptCount = 0
    var retryableRaiseFailureCount = 0
    var frontmostWriteAttemptCount = 0
    var raiseSucceeded = false
    var frontmostWriteSucceeded = false
    var initialVisibilityPredicates: Issue106VisibilityPredicates?
    var terminalVisibilityPredicates: Issue106VisibilityPredicates?
    var visibilityPendingObservationCount = 0
    var firstVisibilityPendingElapsedMilliseconds: UInt64?
    var visibilityBecameReadyElapsedMilliseconds: UInt64?

    func boundedElapsedMilliseconds() -> UInt64 {
      min(elapsedMilliseconds(), policy.timeoutMilliseconds)
    }

    func visibilityPendingDurationMilliseconds() -> UInt64 {
      guard let firstVisibilityPendingElapsedMilliseconds else { return 0 }
      let terminalElapsedMilliseconds =
        visibilityBecameReadyElapsedMilliseconds ?? boundedElapsedMilliseconds()
      return terminalElapsedMilliseconds - firstVisibilityPendingElapsedMilliseconds
    }

    func diagnostics(
      terminalPredicates: Issue105TerminalPredicates = .none
    ) -> Issue105StabilizationDiagnostics {
      Issue105StabilizationDiagnostics(
        policyTimeoutMilliseconds: policy.timeoutMilliseconds,
        pollIntervalMilliseconds: policy.pollIntervalMilliseconds,
        stabilizationDurationMilliseconds: boundedElapsedMilliseconds(),
        activationRequestCount: 1,
        stabilizationObservationCount: observationCount,
        raiseAttemptCount: raiseAttemptCount,
        retryableRaiseFailureCount: retryableRaiseFailureCount,
        frontmostWriteAttemptCount: frontmostWriteAttemptCount,
        initialVisibilityPredicates: initialVisibilityPredicates,
        terminalVisibilityPredicates: terminalVisibilityPredicates,
        visibilityPendingObservationCount: visibilityPendingObservationCount,
        visibilityPendingDurationMilliseconds: visibilityPendingDurationMilliseconds(),
        terminalPredicates: terminalPredicates
      )
    }

    func fail(_ invalidation: TargetSessionReadinessInvalidation) throws -> Never {
      throw Issue105ReadinessFailure(
        invalidation: invalidation,
        diagnostics: diagnostics()
      )
    }

    while elapsedMilliseconds() <= policy.timeoutMilliseconds,
      observationCount < policy.maximumObservationCount
    {
      let snapshot: TargetSessionReadinessSnapshot
      do {
        snapshot = try observe()
        observationCount += 1
        try validateRetainedIdentity(snapshot, retainedIdentity: retainedIdentity)
      } catch let invalidation as TargetSessionReadinessInvalidation {
        try fail(invalidation)
      } catch {
        try fail(
          .accessibility("the retained readiness state could not be observed during stabilization"))
      }

      let visibilityPredicates = Issue106VisibilityPredicates(snapshot: snapshot)
      if initialVisibilityPredicates == nil {
        initialVisibilityPredicates = visibilityPredicates
      }
      terminalVisibilityPredicates = visibilityPredicates
      if !visibilityPredicates.visibleWindow {
        if raiseAttemptCount > 0 || frontmostWriteAttemptCount > 0 {
          try fail(
            .foreground(
              "the packaged candidate lost visible-window readiness after a session action"
            ))
        }
        if firstVisibilityPendingElapsedMilliseconds == nil {
          firstVisibilityPendingElapsedMilliseconds = boundedElapsedMilliseconds()
        }
        visibilityPendingObservationCount += 1
        wait(policy.pollIntervalMilliseconds)
        continue
      }
      if firstVisibilityPendingElapsedMilliseconds != nil,
        visibilityBecameReadyElapsedMilliseconds == nil
      {
        visibilityBecameReadyElapsedMilliseconds = boundedElapsedMilliseconds()
      }

      if !raiseSucceeded {
        if !snapshot.workspaceFrontmost {
          wait(policy.pollIntervalMilliseconds)
          continue
        }

        raiseAttemptCount += 1
        switch performRaise() {
        case .success:
          raiseSucceeded = true
        case .retryableCannotComplete:
          retryableRaiseFailureCount += 1
          wait(policy.pollIntervalMilliseconds)
          continue
        case .unsupported:
          try fail(
            .accessibility("AXRaise was unsupported for the retained packaged candidate window"))
        case .failed:
          try fail(
            .accessibility("AXRaise failed for the retained packaged candidate window"))
        }

        frontmostWriteAttemptCount += 1
        switch writeFrontmost() {
        case .success:
          frontmostWriteSucceeded = true
        case .retryableCannotComplete:
          try fail(
            .accessibility("the Accessibility frontmost write could not complete"))
        case .unsupported:
          try fail(
            .accessibility("the Accessibility frontmost write was unsupported"))
        case .failed:
          try fail(
            .accessibility("the Accessibility frontmost write failed"))
        }
        wait(policy.pollIntervalMilliseconds)
        continue
      }

      guard frontmostWriteSucceeded else {
        try fail(.accessibility("the Accessibility frontmost write did not complete"))
      }
      guard snapshot.workspaceFrontmost else {
        try fail(
          .foreground("the packaged candidate lost Workspace foreground during stabilization"))
      }
      if snapshot.accessibilityFrontmost {
        let terminalPredicates = Issue105TerminalPredicates(
          exactCandidateRetained: true,
          exactWindowRetained: true,
          visibleWindow: true,
          workspaceFrontmost: true,
          accessibilityFrontmost: true,
          independentObserverVerified: false
        )
        return Issue105StabilizationOutcome(
          diagnostics: diagnostics(terminalPredicates: terminalPredicates),
          terminalSnapshot: snapshot
        )
      }
      wait(policy.pollIntervalMilliseconds)
    }

    if terminalVisibilityPredicates?.visibleWindow == false {
      try fail(
        .accessibility(
          "the retained packaged candidate window did not become visibly ready before the stabilization timeout"
        ))
    }
    try fail(
      .foreground(
        "the packaged candidate did not reach retained frontmost readiness before the stabilization timeout"
      ))
  }
}
