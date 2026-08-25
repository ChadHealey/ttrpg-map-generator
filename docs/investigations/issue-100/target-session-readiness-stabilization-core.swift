import Foundation

let issue105ReadinessSchemaVersion = "issue110-target-session-readiness-v7"
let issue110OperatorReadyLatchSchemaVersion = "issue110-operator-ready-latch-v1"

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

enum Issue109WorkspaceFocusState: String, Codable, Equatable {
  case awaitingInitialApplication = "awaiting-initial-application"
  case candidate
  case otherApplication = "other-application"
}

enum Issue116WorkspaceFocusState: Equatable {
  case awaitingInitialApplication
  case awaitingDesktop
  case candidate
  case unavailable
  case otherApplication

  var diagnosticsState: Issue109WorkspaceFocusState {
    switch self {
    case .awaitingInitialApplication, .awaitingDesktop:
      return .awaitingInitialApplication
    case .candidate:
      return .candidate
    case .otherApplication, .unavailable:
      return .otherApplication
    }
  }
}

enum Issue116WorkspaceForegroundState: Equatable {
  case application(processIdentifier: Int32)
  case desktop
  case unavailable
}

struct Issue116CandidateLaunch<Candidate> {
  let initialWorkspaceForeground: Issue116WorkspaceForegroundState
  let candidate: Candidate
}

enum Issue116PrelaunchForegroundController {
  static func captureWorkspaceForeground(
    processIdentifier: Int32?
  ) -> Issue116WorkspaceForegroundState {
    guard let processIdentifier else { return .desktop }
    return .application(processIdentifier: processIdentifier)
  }

  static func validateInitialWorkspaceForeground(
    _ foreground: Issue116WorkspaceForegroundState,
    controllerProcessIdentifier: Int32
  ) throws {
    switch foreground {
    case .application(let processIdentifier)
    where processIdentifier == controllerProcessIdentifier:
      throw TargetSessionReadinessInvalidation.foreground(
        "the readiness controller acquired foreground ownership before candidate launch")
    case .application, .desktop:
      return
    case .unavailable:
      throw TargetSessionReadinessInvalidation.foreground(
        "initial Workspace foreground authority was unavailable before candidate launch")
    }
  }

  @MainActor
  static func captureThenLaunch<Candidate>(
    controllerProcessIdentifier: Int32,
    captureWorkspaceForeground: () -> Issue116WorkspaceForegroundState,
    launchCandidate: (_ requestsActivation: Bool) async throws -> Candidate
  ) async throws -> Issue116CandidateLaunch<Candidate> {
    let initialWorkspaceForeground = captureWorkspaceForeground()
    try validateInitialWorkspaceForeground(
      initialWorkspaceForeground,
      controllerProcessIdentifier: controllerProcessIdentifier
    )
    let candidate = try await launchCandidate(false)
    return Issue116CandidateLaunch(
      initialWorkspaceForeground: initialWorkspaceForeground,
      candidate: candidate
    )
  }

  static func classifyWorkspaceFocus(
    currentForeground: Issue116WorkspaceForegroundState,
    initialForeground: Issue116WorkspaceForegroundState,
    candidateProcessIdentifier: Int32
  ) -> Issue116WorkspaceFocusState {
    switch currentForeground {
    case .application(let processIdentifier)
    where processIdentifier == candidateProcessIdentifier:
      return .candidate
    case .application(let processIdentifier):
      guard
        case .application(let initialProcessIdentifier) = initialForeground,
        processIdentifier == initialProcessIdentifier
      else { return .otherApplication }
      return .awaitingInitialApplication
    case .desktop:
      guard initialForeground == .desktop else { return .otherApplication }
      return .awaitingDesktop
    case .unavailable:
      return .unavailable
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
  let workspaceFocusState: Issue116WorkspaceFocusState

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

struct Issue105StabilizationPolicy: Equatable {
  let timeoutMilliseconds: UInt64
  let pollIntervalMilliseconds: UInt64
  let maximumObservationCount: Int

  static let approved = Issue105StabilizationPolicy(
    timeoutMilliseconds: 120_000,
    pollIntervalMilliseconds: 50,
    maximumObservationCount: 2_401
  )
}

struct Issue110OperatorReadyLatchConfiguration: Equatable {
  let path: String
  let token: String
}

struct Issue110OperatorReadyMarker: Codable {
  let schemaVersion: String
  let state: String
  let token: String
  let bundleIdentifier: String
  let candidateExecutableSha256: String
  let exactCandidateValidated: Bool
  let consoleSessionValidated: Bool
  let declaredOperatorFocusActionCount: Int
  let handoffTimeoutMilliseconds: UInt64
  let zeroOperationProof: Issue100ZeroOperationReceipt
}

struct Issue110OperatorReadyLatchDiagnostics: Codable, Equatable {
  let pathPolicy: String
  let tokenValidated: Bool
  let existingMarkerCollisionChecked: Bool
  let atomicPublicationSucceeded: Bool
  let cleanupAttempted: Bool
  let cleanupSucceeded: Bool
  let handoffTimeoutMilliseconds: UInt64
  let stateTransitions: [String]

  static let none = Issue110OperatorReadyLatchDiagnostics(
    pathPolicy: "explicit-private-tmp-file",
    tokenValidated: false,
    existingMarkerCollisionChecked: false,
    atomicPublicationSucceeded: false,
    cleanupAttempted: false,
    cleanupSucceeded: false,
    handoffTimeoutMilliseconds: Issue105StabilizationPolicy.approved.timeoutMilliseconds,
    stateTransitions: []
  )
}

enum Issue110OperatorReadyTerminalPath: CaseIterable, Equatable {
  case success
  case timeout
  case invalidation
  case signal
  case launchFailure
}

enum Issue110OperatorReadyLatchValidator {
  static func validateConfiguration(_ configuration: Issue110OperatorReadyLatchConfiguration)
    throws
  {
    let path = configuration.path
    let prefix = "/private/tmp/ttrpg-map-generator-issue110-operator-ready-"
    let suffix = ".json"
    guard path.hasPrefix(prefix), path.hasSuffix(suffix), !path.contains("/../"),
      !path.contains("/./"), !path.contains("//")
    else {
      throw TargetSessionReadinessInvalidation.action(
        "the operator-ready latch path was outside the approved explicit /private/tmp policy")
    }
    let pathScope = String(path.dropFirst(prefix.count).dropLast(suffix.count))
    guard isLowercaseHex(pathScope, exactCount: 32) else {
      throw TargetSessionReadinessInvalidation.action(
        "the operator-ready latch path scope was invalid")
    }
    let tokenPrefix = "issue110-"
    guard configuration.token.hasPrefix(tokenPrefix),
      isLowercaseHex(String(configuration.token.dropFirst(tokenPrefix.count)), exactCount: 32)
    else {
      throw TargetSessionReadinessInvalidation.action(
        "the explicit operator-ready latch token was invalid")
    }
  }

  static func validatePublicationAuthority(
    exactCandidateValidated: Bool,
    consoleSessionValidated: Bool,
    zeroOperationProof: Issue100ZeroOperationReceipt
  ) throws {
    guard exactCandidateValidated, consoleSessionValidated else {
      throw TargetSessionReadinessInvalidation.action(
        "operator-ready publication preceded exact candidate or console-session validation")
    }
    try Issue105TargetSessionStabilizer.validateZeroOperationProof(zeroOperationProof)
  }

  static func validateNoExistingMarker(_ markerExists: Bool) throws {
    guard !markerExists else {
      throw TargetSessionReadinessInvalidation.action(
        "the explicit operator-ready latch path already existed")
    }
  }

  static func validateCleanup(markerStillExists: Bool) throws {
    guard !markerStillExists else {
      throw TargetSessionReadinessInvalidation.action(
        "the operator-ready latch marker could not be cleaned")
    }
  }

  static func validateTerminalCleanup(
    _ terminalPath: Issue110OperatorReadyTerminalPath,
    markerWasPublished: Bool,
    cleanupAttempted: Bool,
    markerStillExists: Bool
  ) throws {
    _ = terminalPath
    guard cleanupAttempted, !markerStillExists else {
      throw TargetSessionReadinessInvalidation.action(
        "the operator-ready latch was not clean on a terminal path")
    }
    if markerWasPublished {
      try validateCleanup(markerStillExists: markerStillExists)
    }
  }

  private static func isLowercaseHex(_ value: String, exactCount: Int) -> Bool {
    value.utf8.count == exactCount
      && value.utf8.allSatisfy { byte in
        (byte >= 0x30 && byte <= 0x39) || (byte >= 0x61 && byte <= 0x66)
      }
  }
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

struct Issue109OperatorFocusHandoffDiagnostics: Codable, Equatable {
  let awaitingStateEmitted: Bool
  let declaredOperatorFocusActionCount: Int
  let focusTransitionDetected: Bool
  let waitDurationMilliseconds: UInt64
  let observationCount: Int
  let initialWorkspaceFocusState: Issue109WorkspaceFocusState
  let terminalWorkspaceFocusState: Issue109WorkspaceFocusState?
  let stateTransitions: [String]
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
  let operatorHandoff: Issue109OperatorFocusHandoffDiagnostics
  let operatorReadyLatch: Issue110OperatorReadyLatchDiagnostics
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
  static func validateDeclaredOperatorFocusActionCount(_ count: Int) throws {
    guard count == 1 else {
      throw TargetSessionReadinessInvalidation.action(
        "exactly one operator focus action must be declared before launch")
    }
  }

  static func validateZeroOperationProof(_ proof: Issue100ZeroOperationReceipt) throws {
    guard !proof.fixtureConfigured,
      !proof.samplerStarted,
      !proof.exportDestinationCreated,
      !proof.svgDispatched,
      !proof.pngDispatched,
      proof.measurementCount == 0,
      proof.rawArtifactCount == 0
    else {
      throw TargetSessionReadinessInvalidation.action(
        "product or measurement activity preceded readiness qualification")
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

  static func validatePreHandoff(
    _ snapshot: Issue108TargetSessionReadinessSnapshot,
    retainedIdentity: Issue105RetainedCandidateIdentity
  ) throws {
    try validateRetainedIdentity(snapshot, retainedIdentity: retainedIdentity)
    guard !snapshot.applicationHidden else {
      throw TargetSessionReadinessInvalidation.accessibility(
        "the exact packaged candidate application was hidden before operator handoff")
    }
    let awaitingInitialForeground: Bool
    switch snapshot.workspaceFocusState {
    case .awaitingInitialApplication, .awaitingDesktop:
      awaitingInitialForeground = true
    case .candidate, .otherApplication, .unavailable:
      awaitingInitialForeground = false
    }
    guard awaitingInitialForeground, !snapshot.workspaceFrontmost,
      snapshot.accessibilityFrontmost == .supported(false)
    else {
      throw TargetSessionReadinessInvalidation.foreground(
        "the exact candidate was not proven non-frontmost before the operator handoff began")
    }
  }

  static func validateIndependentObserverAgreement(_ verified: Bool) throws {
    guard verified else {
      throw TargetSessionReadinessInvalidation.foreground(
        "the independent readiness observer did not verify the approved retained state")
    }
  }

  static func validateSnapshot(_ snapshot: Issue108TargetSessionReadinessSnapshot) throws {
    guard snapshot.visibleWindow else {
      throw TargetSessionReadinessInvalidation.accessibility(
        "the packaged candidate Accessibility window was not visibly frame-ready")
    }
    guard snapshot.accessibilityFrontmost.supportedValue == true,
      snapshot.workspaceFrontmost,
      snapshot.workspaceFocusState == .candidate
    else {
      throw TargetSessionReadinessInvalidation.foreground(
        "the packaged candidate did not retain independently verified frontmost state")
    }
  }

  static func stabilize(
    policy: Issue105StabilizationPolicy,
    retainedIdentity: Issue105RetainedCandidateIdentity,
    initialSnapshot: Issue108TargetSessionReadinessSnapshot,
    operatorReadyLatch: Issue110OperatorReadyLatchDiagnostics,
    declaredOperatorFocusActionCount: Int,
    elapsedMilliseconds: () -> UInt64,
    observe: () throws -> Issue108TargetSessionReadinessSnapshot,
    performRaise: () -> Issue105SessionActionResult,
    wait: (_ milliseconds: UInt64) -> Void
  ) throws -> Issue105StabilizationOutcome {
    try validateDeclaredOperatorFocusActionCount(declaredOperatorFocusActionCount)
    try validatePreHandoff(initialSnapshot, retainedIdentity: retainedIdentity)
    guard operatorReadyLatch.pathPolicy == "explicit-private-tmp-file",
      operatorReadyLatch.tokenValidated,
      operatorReadyLatch.existingMarkerCollisionChecked,
      operatorReadyLatch.atomicPublicationSucceeded,
      !operatorReadyLatch.cleanupAttempted,
      operatorReadyLatch.handoffTimeoutMilliseconds == policy.timeoutMilliseconds,
      operatorReadyLatch.stateTransitions == [
        "exact-candidate-validated",
        "zero-operation-validated",
        "awaiting-operator-ready-published",
      ]
    else {
      throw TargetSessionReadinessInvalidation.action(
        "operator focus observation began before atomic ready-marker publication")
    }

    var observationCount = 0
    var raiseAttemptCount = 0
    var retryableRaiseFailureCount = 0
    var raiseSucceeded = false
    var focusTransitionDetected = false
    var accessibilityReadbackVerified = false
    var workspaceReadbackVerified = false
    var frontmostReadback: Issue108AccessibilityBooleanReadReceipt?
    var retryableFrontmostReadbackFailureCount = 0
    var terminalWorkspaceFocusState: Issue109WorkspaceFocusState?
    var terminalVisibilityPredicates = Issue106VisibilityPredicates(snapshot: initialSnapshot)
    var visibilityPendingObservationCount = 0
    var firstVisibilityPendingElapsedMilliseconds: UInt64?
    var visibilityBecameReadyElapsedMilliseconds: UInt64?
    var visibleWindowWasVerified = false
    var stateTransitions = operatorReadyLatch.stateTransitions + ["awaiting-operator-focus"]
    var actionOrder = stateTransitions

    func boundedElapsedMilliseconds() -> UInt64 {
      min(elapsedMilliseconds(), policy.timeoutMilliseconds)
    }

    func visibilityPendingDurationMilliseconds() -> UInt64 {
      guard let firstVisibilityPendingElapsedMilliseconds else { return 0 }
      return (visibilityBecameReadyElapsedMilliseconds ?? boundedElapsedMilliseconds())
        - firstVisibilityPendingElapsedMilliseconds
    }

    func diagnostics(
      terminalPredicates: Issue105TerminalPredicates = .none
    ) -> Issue105StabilizationDiagnostics {
      Issue105StabilizationDiagnostics(
        policyTimeoutMilliseconds: policy.timeoutMilliseconds,
        pollIntervalMilliseconds: policy.pollIntervalMilliseconds,
        stabilizationDurationMilliseconds: boundedElapsedMilliseconds(),
        activationRequestCount: 0,
        stabilizationObservationCount: observationCount,
        raiseAttemptCount: raiseAttemptCount,
        retryableRaiseFailureCount: retryableRaiseFailureCount,
        raiseSucceeded: raiseSucceeded,
        frontmost: Issue108FrontmostDiagnostics(
          attributeSupported: nil,
          attributeSettable: nil,
          writeAttemptCount: 0,
          retryableSupportFailureCount: 0,
          retryableWriteFailureCount: 0,
          writeSucceeded: false,
          accessibilityReadback: frontmostReadback,
          retryableReadbackFailureCount: retryableFrontmostReadbackFailureCount,
          workspaceReadbackVerified: workspaceReadbackVerified
        ),
        operatorHandoff: Issue109OperatorFocusHandoffDiagnostics(
          awaitingStateEmitted: true,
          declaredOperatorFocusActionCount: declaredOperatorFocusActionCount,
          focusTransitionDetected: focusTransitionDetected,
          waitDurationMilliseconds: boundedElapsedMilliseconds(),
          observationCount: observationCount,
          initialWorkspaceFocusState: initialSnapshot.workspaceFocusState.diagnosticsState,
          terminalWorkspaceFocusState: terminalWorkspaceFocusState,
          stateTransitions: stateTransitions
        ),
        operatorReadyLatch: operatorReadyLatch,
        initialVisibilityPredicates: Issue106VisibilityPredicates(snapshot: initialSnapshot),
        terminalVisibilityPredicates: terminalVisibilityPredicates,
        visibilityPendingObservationCount: visibilityPendingObservationCount,
        visibilityPendingDurationMilliseconds: visibilityPendingDurationMilliseconds(),
        actionOrder: actionOrder,
        terminalPredicates: terminalPredicates
      )
    }

    func fail(_ invalidation: TargetSessionReadinessInvalidation) throws -> Never {
      throw Issue105ReadinessFailure(invalidation: invalidation, diagnostics: diagnostics())
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
        try fail(.accessibility("the retained readiness state could not be observed"))
      }

      terminalWorkspaceFocusState = snapshot.workspaceFocusState.diagnosticsState
      terminalVisibilityPredicates = Issue106VisibilityPredicates(snapshot: snapshot)
      guard !snapshot.applicationHidden else {
        try fail(.accessibility("the exact packaged candidate application became hidden"))
      }

      switch snapshot.workspaceFocusState {
      case .otherApplication:
        try fail(.foreground("focus moved to an undeclared application during operator handoff"))
      case .unavailable:
        try fail(.foreground("Workspace foreground authority became unavailable during handoff"))
      case .awaitingInitialApplication, .awaitingDesktop:
        if focusTransitionDetected {
          try fail(.foreground("the candidate lost Workspace focus after operator handoff"))
        }
        guard snapshot.accessibilityFrontmost == .supported(false) else {
          try fail(.foreground("Accessibility and Workspace focus disagreed during handoff"))
        }
        wait(policy.pollIntervalMilliseconds)
        continue
      case .candidate:
        if !focusTransitionDetected {
          focusTransitionDetected = true
          stateTransitions.append("operator-focus-detected")
          actionOrder.append("operator-focus-detected")
        }
      }

      frontmostReadback = Issue108AccessibilityBooleanReadReceipt(snapshot.accessibilityFrontmost)
      switch snapshot.accessibilityFrontmost {
      case .supported(true):
        if !accessibilityReadbackVerified {
          accessibilityReadbackVerified = true
          stateTransitions.append("accessibility-frontmost-readback")
          actionOrder.append("accessibility-frontmost-readback")
        }
      case .supported(false):
        if accessibilityReadbackVerified {
          try fail(.foreground("the candidate lost Accessibility focus after operator handoff"))
        }
        wait(policy.pollIntervalMilliseconds)
        continue
      case .unavailable(.cannotComplete):
        retryableFrontmostReadbackFailureCount += 1
        wait(policy.pollIntervalMilliseconds)
        continue
      case .unavailable:
        try fail(.accessibility("AXFrontmost readback was unavailable after operator handoff"))
      }

      if !workspaceReadbackVerified {
        workspaceReadbackVerified = true
        stateTransitions.append("workspace-frontmost-readback")
        actionOrder.append("workspace-frontmost-readback")
      }

      if snapshot.windowMinimized.supportedValue == true {
        try fail(.accessibility("the exact candidate window was minimized after operator handoff"))
      }
      switch snapshot.windowFrameVisible {
      case .supported(true):
        if !visibleWindowWasVerified {
          visibleWindowWasVerified = true
          visibilityBecameReadyElapsedMilliseconds = boundedElapsedMilliseconds()
          stateTransitions.append("supported-positive-frame-readback")
          actionOrder.append("supported-positive-frame-readback")
        }
      case .supported(false):
        try fail(
          .accessibility("the exact candidate window was not visible after operator handoff"))
      case .unavailable(.noValue), .unavailable(.attributeUnsupported),
        .unavailable(.cannotComplete):
        if firstVisibilityPendingElapsedMilliseconds == nil {
          firstVisibilityPendingElapsedMilliseconds = boundedElapsedMilliseconds()
        }
        visibilityPendingObservationCount += 1
        wait(policy.pollIntervalMilliseconds)
        continue
      case .unavailable:
        try fail(
          .accessibility("the exact candidate window frame was invalid after operator handoff"))
      }

      if !raiseSucceeded {
        raiseAttemptCount += 1
        switch performRaise() {
        case .success:
          raiseSucceeded = true
          stateTransitions.append("raise-succeeded")
          actionOrder.append("raise-succeeded")
        case .retryableCannotComplete:
          retryableRaiseFailureCount += 1
          actionOrder.append("raise-cannot-complete")
        case .unsupported:
          try fail(.accessibility("AXRaise was unsupported for the retained candidate window"))
        case .failed:
          try fail(.accessibility("AXRaise failed for the retained candidate window"))
        }
        wait(policy.pollIntervalMilliseconds)
        continue
      }

      try validateSnapshot(snapshot)
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

    if !focusTransitionDetected {
      try fail(.foreground("operator focus was not detected before the handoff timeout"))
    }
    if !accessibilityReadbackVerified || !workspaceReadbackVerified {
      try fail(.foreground("exact-candidate foreground did not settle before the handoff timeout"))
    }
    if !visibleWindowWasVerified {
      try fail(
        .accessibility("a supported positive candidate frame was not observed before timeout"))
    }
    try fail(.foreground("the candidate did not retain raised readiness before timeout"))
  }
}
