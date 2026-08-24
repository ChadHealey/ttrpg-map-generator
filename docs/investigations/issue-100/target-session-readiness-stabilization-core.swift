import Foundation

let issue105ReadinessSchemaVersion = "issue108-target-session-readiness-v5"

enum Issue108AccessibilityReadUnavailable: String, Codable, Equatable, Error {
  case attributeUnsupported = "attribute-unsupported"
  case cannotComplete = "cannot-complete"
  case invalidValue = "invalid-value"
  case noValue = "no-value"
  case readError = "read-error"
}

enum Issue108AccessibilityBooleanRead: Equatable {
  case supported(Bool)
  case unavailable(Issue108AccessibilityReadUnavailable)

  var supportedValue: Bool? {
    guard case .supported(let value) = self else { return nil }
    return value
  }
}

enum Issue108AccessibilityReadState: String, Codable, Equatable {
  case supported
  case unavailable
}

struct Issue108AccessibilityBooleanReadReceipt: Codable, Equatable {
  let state: Issue108AccessibilityReadState
  let value: Bool?
  let unavailableReason: Issue108AccessibilityReadUnavailable?

  init(_ read: Issue108AccessibilityBooleanRead) {
    switch read {
    case .supported(let value):
      state = .supported
      self.value = value
      unavailableReason = nil
    case .unavailable(let reason):
      state = .unavailable
      value = nil
      unavailableReason = reason
    }
  }
}

struct Issue108TargetSessionReadinessSnapshot: Equatable {
  let applicationCount: Int
  let windowCount: Int
  let processIdentifier: Int32?
  let windowIdentity: UInt?
  let executableIdentityMatched: Bool
  let applicationHidden: Bool
  let windowMinimized: Issue108AccessibilityBooleanRead
  let windowFrameVisible: Issue108AccessibilityBooleanRead
  let accessibilityFrontmost: Issue108AccessibilityBooleanRead
  let workspaceFrontmost: Bool

  var visibleWindow: Bool {
    !applicationHidden && windowMinimized.supportedValue != true
      && windowFrameVisible.supportedValue == true
  }
}

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

enum Issue108FrontmostWriteResult: Equatable {
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
  let windowMinimized: Issue108AccessibilityBooleanReadReceipt
  let windowFrameVisible: Issue108AccessibilityBooleanReadReceipt
  let visibleWindow: Bool

  init(snapshot: Issue108TargetSessionReadinessSnapshot) {
    applicationHidden = snapshot.applicationHidden
    windowMinimized = Issue108AccessibilityBooleanReadReceipt(snapshot.windowMinimized)
    windowFrameVisible = Issue108AccessibilityBooleanReadReceipt(snapshot.windowFrameVisible)
    visibleWindow = snapshot.visibleWindow
  }
}

struct Issue108FrontmostDiagnostics: Codable, Equatable {
  let attributeSupported: Bool?
  let attributeSettable: Bool?
  let writeAttemptCount: Int
  let retryableSupportFailureCount: Int
  let retryableWriteFailureCount: Int
  let writeSucceeded: Bool
  let accessibilityReadback: Issue108AccessibilityBooleanReadReceipt?
  let retryableReadbackFailureCount: Int
  let workspaceReadbackVerified: Bool

  static let none = Issue108FrontmostDiagnostics(
    attributeSupported: nil,
    attributeSettable: nil,
    writeAttemptCount: 0,
    retryableSupportFailureCount: 0,
    retryableWriteFailureCount: 0,
    writeSucceeded: false,
    accessibilityReadback: nil,
    retryableReadbackFailureCount: 0,
    workspaceReadbackVerified: false
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
  let raiseSucceeded: Bool
  let frontmost: Issue108FrontmostDiagnostics
  let initialVisibilityPredicates: Issue106VisibilityPredicates?
  let terminalVisibilityPredicates: Issue106VisibilityPredicates?
  let visibilityPendingObservationCount: Int
  let visibilityPendingDurationMilliseconds: UInt64
  let actionOrder: [String]
  let terminalPredicates: Issue105TerminalPredicates
}

struct Issue105StabilizationOutcome: Equatable {
  let diagnostics: Issue105StabilizationDiagnostics
  let terminalSnapshot: Issue108TargetSessionReadinessSnapshot
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
    _ snapshot: Issue108TargetSessionReadinessSnapshot,
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

  static func validateSnapshot(_ snapshot: Issue108TargetSessionReadinessSnapshot) throws {
    guard snapshot.visibleWindow else {
      throw TargetSessionReadinessInvalidation.accessibility(
        "the packaged candidate Accessibility window was not visibly frame-ready")
    }
    guard snapshot.accessibilityFrontmost.supportedValue == true,
      snapshot.workspaceFrontmost
    else {
      throw TargetSessionReadinessInvalidation.foreground(
        "the packaged candidate did not retain independently verified frontmost state")
    }
  }

  static func stabilize(
    policy: Issue105StabilizationPolicy,
    retainedIdentity: Issue105RetainedCandidateIdentity,
    elapsedMilliseconds: () -> UInt64,
    observe: () throws -> Issue108TargetSessionReadinessSnapshot,
    writeFrontmost: () -> Issue108FrontmostWriteResult,
    performRaise: () -> Issue105SessionActionResult,
    wait: (_ milliseconds: UInt64) -> Void
  ) throws -> Issue105StabilizationOutcome {
    var observationCount = 0
    var raiseAttemptCount = 0
    var retryableRaiseFailureCount = 0
    var raiseSucceeded = false
    var frontmostAttributeSupported: Bool?
    var frontmostAttributeSettable: Bool?
    var frontmostWriteAttemptCount = 0
    var retryableFrontmostSupportFailureCount = 0
    var retryableFrontmostWriteFailureCount = 0
    var frontmostWriteSucceeded = false
    var frontmostReadback: Issue108AccessibilityBooleanReadReceipt?
    var retryableFrontmostReadbackFailureCount = 0
    var accessibilityReadbackVerified = false
    var workspaceReadbackVerified = false
    var initialVisibilityPredicates: Issue106VisibilityPredicates?
    var terminalVisibilityPredicates: Issue106VisibilityPredicates?
    var visibilityPendingObservationCount = 0
    var firstVisibilityPendingElapsedMilliseconds: UInt64?
    var visibilityBecameReadyElapsedMilliseconds: UInt64?
    var visibleWindowWasVerified = false
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
        raiseSucceeded: raiseSucceeded,
        frontmost: Issue108FrontmostDiagnostics(
          attributeSupported: frontmostAttributeSupported,
          attributeSettable: frontmostAttributeSettable,
          writeAttemptCount: frontmostWriteAttemptCount,
          retryableSupportFailureCount: retryableFrontmostSupportFailureCount,
          retryableWriteFailureCount: retryableFrontmostWriteFailureCount,
          writeSucceeded: frontmostWriteSucceeded,
          accessibilityReadback: frontmostReadback,
          retryableReadbackFailureCount: retryableFrontmostReadbackFailureCount,
          workspaceReadbackVerified: workspaceReadbackVerified
        ),
        initialVisibilityPredicates: initialVisibilityPredicates,
        terminalVisibilityPredicates: terminalVisibilityPredicates,
        visibilityPendingObservationCount: visibilityPendingObservationCount,
        visibilityPendingDurationMilliseconds: visibilityPendingDurationMilliseconds(),
        actionOrder: actionOrder,
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
      let snapshot: Issue108TargetSessionReadinessSnapshot
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

      if !frontmostWriteSucceeded {
        frontmostWriteAttemptCount += 1
        switch writeFrontmost() {
        case .success:
          frontmostAttributeSupported = true
          frontmostAttributeSettable = true
          frontmostWriteSucceeded = true
          actionOrder.append("frontmost-write-succeeded")
        case .retryableSupportCannotComplete:
          retryableFrontmostSupportFailureCount += 1
          actionOrder.append("frontmost-support-cannot-complete")
        case .retryableWriteCannotComplete:
          frontmostAttributeSupported = true
          frontmostAttributeSettable = true
          retryableFrontmostWriteFailureCount += 1
          actionOrder.append("frontmost-write-cannot-complete")
        case .attributeUnsupported:
          frontmostAttributeSupported = false
          frontmostAttributeSettable = false
          actionOrder.append("frontmost-attribute-unsupported")
          try fail(
            .accessibility(
              "AXFrontmost was unsupported for the retained packaged candidate application"
            ))
        case .notSettable:
          frontmostAttributeSupported = true
          frontmostAttributeSettable = false
          actionOrder.append("frontmost-attribute-not-settable")
          try fail(
            .accessibility(
              "AXFrontmost was not settable for the retained packaged candidate application"
            ))
        case .supportFailed:
          actionOrder.append("frontmost-support-failed")
          try fail(
            .accessibility(
              "AXFrontmost support could not be verified for the retained packaged candidate application"
            ))
        case .writeFailed:
          frontmostAttributeSupported = true
          frontmostAttributeSettable = true
          actionOrder.append("frontmost-write-failed")
          try fail(
            .accessibility(
              "AXFrontmost=true failed for the retained packaged candidate application"
            ))
        }
        wait(policy.pollIntervalMilliseconds)
        continue
      }

      frontmostReadback = Issue108AccessibilityBooleanReadReceipt(snapshot.accessibilityFrontmost)
      switch snapshot.accessibilityFrontmost {
      case .supported(true):
        if !accessibilityReadbackVerified {
          accessibilityReadbackVerified = true
          actionOrder.append("accessibility-frontmost-readback")
        }
      case .supported(false):
        if accessibilityReadbackVerified {
          try fail(
            .foreground(
              "the packaged candidate lost Accessibility foreground after verified readback"
            ))
        }
        wait(policy.pollIntervalMilliseconds)
        continue
      case .unavailable(.cannotComplete):
        retryableFrontmostReadbackFailureCount += 1
        wait(policy.pollIntervalMilliseconds)
        continue
      case .unavailable:
        try fail(
          .accessibility(
            "AXFrontmost readback was unavailable for the retained packaged candidate application"
          ))
      }

      if !snapshot.workspaceFrontmost {
        if workspaceReadbackVerified {
          try fail(
            .foreground(
              "the packaged candidate lost Workspace foreground after verified readback"
            ))
        }
        wait(policy.pollIntervalMilliseconds)
        continue
      }
      if !workspaceReadbackVerified {
        workspaceReadbackVerified = true
        actionOrder.append("workspace-frontmost-readback")
      }

      if !visibilityPredicates.visibleWindow {
        if visibleWindowWasVerified || raiseSucceeded {
          try fail(
            .foreground(
              "the packaged candidate lost visible-window readiness after it was verified"
            ))
        }
        if firstVisibilityPendingElapsedMilliseconds == nil {
          firstVisibilityPendingElapsedMilliseconds = boundedElapsedMilliseconds()
        }
        visibilityPendingObservationCount += 1
        wait(policy.pollIntervalMilliseconds)
        continue
      }
      if !visibleWindowWasVerified {
        visibleWindowWasVerified = true
        actionOrder.append("supported-positive-frame-readback")
      }
      if firstVisibilityPendingElapsedMilliseconds != nil,
        visibilityBecameReadyElapsedMilliseconds == nil
      {
        visibilityBecameReadyElapsedMilliseconds = boundedElapsedMilliseconds()
      }

      if !raiseSucceeded {
        raiseAttemptCount += 1
        switch performRaise() {
        case .success:
          raiseSucceeded = true
          actionOrder.append("raise-succeeded")
        case .retryableCannotComplete:
          retryableRaiseFailureCount += 1
          actionOrder.append("raise-cannot-complete")
        case .unsupported:
          try fail(
            .accessibility("AXRaise was unsupported for the retained packaged candidate window"))
        case .failed:
          try fail(
            .accessibility("AXRaise failed for the retained packaged candidate window"))
        }
        wait(policy.pollIntervalMilliseconds)
        continue
      }

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

    if !frontmostWriteSucceeded || frontmostReadback?.value != true || !workspaceReadbackVerified {
      try fail(
        .foreground(
          "the packaged candidate did not reach retained frontmost readiness before the stabilization timeout"
        ))
    }
    if terminalVisibilityPredicates?.visibleWindow == false {
      try fail(
        .accessibility(
          "the retained packaged candidate window did not become visibly ready before the stabilization timeout"
        ))
    }
    try fail(
      .foreground(
        "the packaged candidate did not retain raised readiness before the stabilization timeout"
      ))
  }
}
