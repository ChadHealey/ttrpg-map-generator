import Foundation

let issue105ReadinessSchemaVersion = "issue107-target-session-readiness-v4"

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

enum Issue107MinimizeWriteResult: Equatable {
  case success
  case retryableSupportCannotComplete
  case retryableWriteCannotComplete
  case attributeUnsupported
  case notSettable
  case supportFailed
  case writeFailed
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

struct Issue107MinimizeDiagnostics: Codable, Equatable {
  let restorationRequired: Bool
  let attributeSupported: Bool?
  let attributeSettable: Bool?
  let writeAttemptCount: Int
  let retryableSupportFailureCount: Int
  let retryableWriteFailureCount: Int
  let writeSucceeded: Bool
  let nonMinimizedReadbackVerified: Bool
  let frameVisibleReadbackVerified: Bool
  let actionOrder: [String]

  static let none = Issue107MinimizeDiagnostics(
    restorationRequired: false,
    attributeSupported: nil,
    attributeSettable: nil,
    writeAttemptCount: 0,
    retryableSupportFailureCount: 0,
    retryableWriteFailureCount: 0,
    writeSucceeded: false,
    nonMinimizedReadbackVerified: false,
    frameVisibleReadbackVerified: false,
    actionOrder: ["activation-request"]
  )
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
  let minimize: Issue107MinimizeDiagnostics
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
    writeMinimizedFalse: () -> Issue107MinimizeWriteResult,
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
    var visibleWindowWasVerified = false
    var restorationRequired = false
    var minimizeAttributeSupported: Bool?
    var minimizeAttributeSettable: Bool?
    var minimizeWriteAttemptCount = 0
    var retryableMinimizeSupportFailureCount = 0
    var retryableMinimizeWriteFailureCount = 0
    var minimizeWriteSucceeded = false
    var nonMinimizedReadbackVerified = false
    var frameVisibleReadbackVerified = false
    var actionOrder = ["activation-request"]

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
        minimize: Issue107MinimizeDiagnostics(
          restorationRequired: restorationRequired,
          attributeSupported: minimizeAttributeSupported,
          attributeSettable: minimizeAttributeSettable,
          writeAttemptCount: minimizeWriteAttemptCount,
          retryableSupportFailureCount: retryableMinimizeSupportFailureCount,
          retryableWriteFailureCount: retryableMinimizeWriteFailureCount,
          writeSucceeded: minimizeWriteSucceeded,
          nonMinimizedReadbackVerified: nonMinimizedReadbackVerified,
          frameVisibleReadbackVerified: frameVisibleReadbackVerified,
          actionOrder: actionOrder
        ),
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

      guard !visibilityPredicates.applicationHidden else {
        try fail(
          .accessibility(
            "the exact packaged candidate application became hidden; unhide is not authorized"
          ))
      }

      if visibilityPredicates.windowMinimized {
        if visibleWindowWasVerified || nonMinimizedReadbackVerified || raiseAttemptCount > 0
          || frontmostWriteAttemptCount > 0
        {
          try fail(
            .foreground(
              "the exact packaged candidate window became minimized after visibility restoration"
            ))
        }
        restorationRequired = true
        if !minimizeWriteSucceeded {
          minimizeWriteAttemptCount += 1
          switch writeMinimizedFalse() {
          case .success:
            minimizeAttributeSupported = true
            minimizeAttributeSettable = true
            minimizeWriteSucceeded = true
            actionOrder.append("minimize-write-succeeded")
          case .retryableSupportCannotComplete:
            retryableMinimizeSupportFailureCount += 1
            actionOrder.append("minimize-support-cannot-complete")
          case .retryableWriteCannotComplete:
            minimizeAttributeSupported = true
            minimizeAttributeSettable = true
            retryableMinimizeWriteFailureCount += 1
            actionOrder.append("minimize-write-cannot-complete")
          case .attributeUnsupported:
            minimizeAttributeSupported = false
            minimizeAttributeSettable = false
            actionOrder.append("minimize-attribute-unsupported")
            try fail(
              .accessibility(
                "AXMinimized was unsupported for the retained packaged candidate window"
              ))
          case .notSettable:
            minimizeAttributeSupported = true
            minimizeAttributeSettable = false
            actionOrder.append("minimize-attribute-not-settable")
            try fail(
              .accessibility(
                "AXMinimized was not settable for the retained packaged candidate window"
              ))
          case .supportFailed:
            actionOrder.append("minimize-support-failed")
            try fail(
              .accessibility(
                "AXMinimized support could not be verified for the retained packaged candidate window"
              ))
          case .writeFailed:
            minimizeAttributeSupported = true
            minimizeAttributeSettable = true
            actionOrder.append("minimize-write-failed")
            try fail(
              .accessibility(
                "AXMinimized=false failed for the retained packaged candidate window"
              ))
          }
        }
      } else if restorationRequired && !nonMinimizedReadbackVerified {
        nonMinimizedReadbackVerified = true
        actionOrder.append("non-minimized-readback")
      }

      if restorationRequired && nonMinimizedReadbackVerified && visibilityPredicates.windowFrameVisible
        && !frameVisibleReadbackVerified
      {
        frameVisibleReadbackVerified = true
        actionOrder.append("frame-visible-readback")
      }

      if !visibilityPredicates.visibleWindow {
        if visibleWindowWasVerified || raiseAttemptCount > 0 || frontmostWriteAttemptCount > 0 {
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
      visibleWindowWasVerified = true
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
          actionOrder.append("raise-succeeded")
        case .retryableCannotComplete:
          retryableRaiseFailureCount += 1
          actionOrder.append("raise-cannot-complete")
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
          actionOrder.append("frontmost-write-succeeded")
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
