import Foundation

@main
enum TargetSessionReadinessCoreTests {
  static func main() throws {
    try acceptsPredecessorRetainedReadiness()
    distinguishesUnsupportedMinimizedFromObservedTrue()
    try validatesExplicitAwaitingState()
    try acceptsOneDetectedOperatorFocusTransition()
    try acceptsDelayedAccessibilityFrameAndRaise()
    rejectsWrongApplicationFocus()
    rejectsIdentityOrWindowReplacement()
    rejectsSessionDrift()
    rejectsTimeoutWithoutOperatorFocus()
    rejectsPostFocusFrameTimeout()
    rejectsDuplicateDeclaredOperatorAction()
    rejectsPostFocusLoss()
    rejectsHiddenOrInvisiblePostFocusCandidate()
    rejectsRaiseAndObserverFailures()
    rejectsNonzeroOperationOrdering()
    rejectsWrongIdentityStaleAndMissingCandidateState()
    FileHandle.standardOutput.write(
      Data("issue109 operator-focus readiness core tests passed\n".utf8))
  }

  private static func distinguishesUnsupportedMinimizedFromObservedTrue() {
    let unsupported = candidateSnapshot(windowMinimized: .unavailable(.attributeUnsupported))
    precondition(unsupported.windowMinimized.supportedValue == nil)
    precondition(unsupported.visibleWindow)
    let unsupportedReceipt = Issue108AccessibilityBooleanReadReceipt(
      unsupported.windowMinimized)
    precondition(unsupportedReceipt.state == .unavailable)
    precondition(unsupportedReceipt.value == nil)
    precondition(unsupportedReceipt.unavailableReason == .attributeUnsupported)

    let observedTrue = candidateSnapshot(windowMinimized: .supported(true))
    precondition(observedTrue.windowMinimized.supportedValue == true)
    precondition(!observedTrue.visibleWindow)
  }

  private static func validatesExplicitAwaitingState() throws {
    try Issue105TargetSessionStabilizer.validateDeclaredOperatorFocusActionCount(1)
    try Issue105TargetSessionStabilizer.validateZeroOperationProof(.zero)
    try Issue105TargetSessionStabilizer.validatePreHandoff(
      awaitingSnapshot(), retainedIdentity: retainedIdentity)

    for snapshot in [
      candidateSnapshot(),
      awaitingSnapshot(applicationHidden: true),
      awaitingSnapshot(processIdentifier: 43),
    ] {
      expectInvalidAny {
        try Issue105TargetSessionStabilizer.validatePreHandoff(
          snapshot, retainedIdentity: retainedIdentity)
      }
    }
  }

  private static func acceptsOneDetectedOperatorFocusTransition() throws {
    var raiseCount = 0
    let outcome = try stabilize(
      observations: [
        awaitingSnapshot(),
        candidateSnapshot(),
        candidateSnapshot(),
      ],
      performRaise: {
        raiseCount += 1
        return .success
      }
    )
    precondition(raiseCount == 1)
    precondition(outcome.diagnostics.activationRequestCount == 0)
    precondition(outcome.diagnostics.frontmost.writeAttemptCount == 0)
    precondition(outcome.diagnostics.operatorHandoff.awaitingStateEmitted)
    precondition(outcome.diagnostics.operatorHandoff.declaredOperatorFocusActionCount == 1)
    precondition(outcome.diagnostics.operatorHandoff.focusTransitionDetected)
    precondition(
      outcome.diagnostics.operatorHandoff.stateTransitions == [
        "exact-candidate-validated",
        "awaiting-operator-focus",
        "operator-focus-detected",
        "accessibility-frontmost-readback",
        "workspace-frontmost-readback",
        "supported-positive-frame-readback",
        "raise-succeeded",
      ])
    precondition(outcome.diagnostics.terminalPredicates.visibleWindow)
    precondition(outcome.diagnostics.terminalPredicates.workspaceFrontmost)
  }

  private static func acceptsDelayedAccessibilityFrameAndRaise() throws {
    var raiseResults: [Issue105SessionActionResult] = [.retryableCannotComplete, .success]
    let outcome = try stabilize(
      observations: [
        candidateSnapshot(
          windowFrameVisible: .unavailable(.attributeUnsupported),
          accessibilityFrontmost: .supported(false)
        ),
        candidateSnapshot(windowFrameVisible: .unavailable(.noValue)),
        candidateSnapshot(),
        candidateSnapshot(),
        candidateSnapshot(),
      ],
      performRaise: { raiseResults.removeFirst() }
    )
    precondition(outcome.diagnostics.visibilityPendingObservationCount == 1)
    precondition(outcome.diagnostics.retryableRaiseFailureCount == 1)
    precondition(outcome.diagnostics.raiseAttemptCount == 2)
    precondition(outcome.diagnostics.raiseSucceeded)
  }

  private static func rejectsWrongApplicationFocus() {
    expectStabilizationInvalid(.foreground) {
      try stabilize(observations: [candidateSnapshot(workspaceFocusState: .otherApplication)])
    }
  }

  private static func rejectsIdentityOrWindowReplacement() {
    for (snapshot, authority) in [
      (candidateSnapshot(processIdentifier: 43), ExpectedAuthority.processState),
      (candidateSnapshot(windowIdentity: 8), ExpectedAuthority.processState),
      (candidateSnapshot(applicationCount: 2), ExpectedAuthority.processState),
      (candidateSnapshot(windowCount: 2), ExpectedAuthority.accessibility),
      (candidateSnapshot(executableIdentityMatched: false), ExpectedAuthority.identity),
    ] {
      var raiseCount = 0
      expectStabilizationInvalid(authority) {
        try stabilize(
          observations: [snapshot],
          performRaise: {
            raiseCount += 1
            return .success
          })
      }
      precondition(raiseCount == 0)
    }
  }

  private static func rejectsSessionDrift() {
    var elapsed: UInt64 = 0
    expectStabilizationInvalid(.session) {
      _ = try Issue105TargetSessionStabilizer.stabilize(
        policy: testPolicy,
        retainedIdentity: retainedIdentity,
        initialSnapshot: awaitingSnapshot(),
        declaredOperatorFocusActionCount: 1,
        elapsedMilliseconds: { elapsed },
        observe: {
          throw TargetSessionReadinessInvalidation.session(
            "the designated session changed during operator handoff")
        },
        performRaise: { preconditionFailure("raise must not run after session drift") },
        wait: { elapsed += $0 }
      )
    }
  }

  private static func rejectsTimeoutWithoutOperatorFocus() {
    var elapsed: UInt64 = 0
    do {
      _ = try Issue105TargetSessionStabilizer.stabilize(
        policy: timeoutPolicy,
        retainedIdentity: retainedIdentity,
        initialSnapshot: awaitingSnapshot(),
        declaredOperatorFocusActionCount: 1,
        elapsedMilliseconds: { elapsed },
        observe: { awaitingSnapshot() },
        performRaise: { preconditionFailure("raise must not precede detected focus") },
        wait: { elapsed += $0 }
      )
      preconditionFailure("expected no-action timeout")
    } catch let failure as Issue105ReadinessFailure {
      precondition(ExpectedAuthority.foreground.matches(failure.invalidation))
      precondition(!failure.diagnostics.operatorHandoff.focusTransitionDetected)
      precondition(failure.diagnostics.raiseAttemptCount == 0)
      precondition(failure.diagnostics.frontmost.writeAttemptCount == 0)
    } catch {
      preconditionFailure("unexpected no-action timeout error")
    }
  }

  private static func rejectsPostFocusFrameTimeout() {
    var elapsed: UInt64 = 0
    do {
      _ = try Issue105TargetSessionStabilizer.stabilize(
        policy: timeoutPolicy,
        retainedIdentity: retainedIdentity,
        initialSnapshot: awaitingSnapshot(),
        declaredOperatorFocusActionCount: 1,
        elapsedMilliseconds: { elapsed },
        observe: {
          candidateSnapshot(windowFrameVisible: .unavailable(.attributeUnsupported))
        },
        performRaise: { preconditionFailure("raise must not run without a supported frame") },
        wait: { elapsed += $0 }
      )
      preconditionFailure("expected supported-frame timeout")
    } catch let failure as Issue105ReadinessFailure {
      precondition(ExpectedAuthority.accessibility.matches(failure.invalidation))
      precondition(failure.diagnostics.operatorHandoff.focusTransitionDetected)
      precondition(failure.diagnostics.visibilityPendingObservationCount == 3)
      precondition(failure.diagnostics.raiseAttemptCount == 0)
    } catch {
      preconditionFailure("unexpected supported-frame timeout error")
    }
  }

  private static func rejectsDuplicateDeclaredOperatorAction() {
    for count in [0, 2] {
      expectInvalid(.action) {
        try Issue105TargetSessionStabilizer.validateDeclaredOperatorFocusActionCount(count)
      }
      var observationCount = 0
      expectInvalid(.action) {
        _ = try Issue105TargetSessionStabilizer.stabilize(
          policy: testPolicy,
          retainedIdentity: retainedIdentity,
          initialSnapshot: awaitingSnapshot(),
          declaredOperatorFocusActionCount: count,
          elapsedMilliseconds: { 0 },
          observe: {
            observationCount += 1
            return candidateSnapshot()
          },
          performRaise: { preconditionFailure("raise must not run for duplicate declaration") },
          wait: { _ in }
        )
      }
      precondition(observationCount == 0)
    }
  }

  private static func rejectsPostFocusLoss() {
    for terminal in [
      awaitingSnapshot(),
      candidateSnapshot(accessibilityFrontmost: .supported(false)),
      candidateSnapshot(windowFrameVisible: .supported(false)),
      candidateSnapshot(processIdentifier: 43),
    ] {
      do {
        _ = try stabilize(observations: [candidateSnapshot(), terminal])
        preconditionFailure("expected post-focus loss")
      } catch let failure as Issue105ReadinessFailure {
        precondition(failure.diagnostics.operatorHandoff.focusTransitionDetected)
        precondition(failure.diagnostics.raiseSucceeded)
      } catch {
        preconditionFailure("unexpected post-focus loss error")
      }
    }
  }

  private static func rejectsHiddenOrInvisiblePostFocusCandidate() {
    for snapshot in [
      candidateSnapshot(applicationHidden: true),
      candidateSnapshot(windowMinimized: .supported(true)),
      candidateSnapshot(windowFrameVisible: .supported(false)),
      candidateSnapshot(windowFrameVisible: .unavailable(.invalidValue)),
      candidateSnapshot(windowFrameVisible: .unavailable(.readError)),
      candidateSnapshot(accessibilityFrontmost: .unavailable(.attributeUnsupported)),
      candidateSnapshot(accessibilityFrontmost: .unavailable(.readError)),
    ] {
      expectStabilizationInvalid(.accessibility) {
        try stabilize(observations: [snapshot])
      }
    }
  }

  private static func rejectsRaiseAndObserverFailures() {
    for result in [Issue105SessionActionResult.unsupported, .failed] {
      expectStabilizationInvalid(.accessibility) {
        try stabilize(observations: [candidateSnapshot()], performRaise: { result })
      }
    }
    try? Issue105TargetSessionStabilizer.validateIndependentObserverAgreement(true)
    expectInvalid(.foreground) {
      try Issue105TargetSessionStabilizer.validateIndependentObserverAgreement(false)
    }
  }

  private static func rejectsNonzeroOperationOrdering() {
    let nonzeroProofs = [
      operationProof(fixtureConfigured: true),
      operationProof(samplerStarted: true),
      operationProof(exportDestinationCreated: true),
      operationProof(svgDispatched: true),
      operationProof(pngDispatched: true),
      operationProof(measurementCount: 1),
      operationProof(rawArtifactCount: 1),
    ]
    for proof in nonzeroProofs {
      expectInvalid(.action) {
        try Issue105TargetSessionStabilizer.validateZeroOperationProof(proof)
      }
    }
  }

  private static func acceptsPredecessorRetainedReadiness() throws {
    try TargetSessionReadinessPredicate.validatePrelaunch(
      existingApplicationCount: 0,
      consoleSessionMatched: true,
      packageIdentityMatched: true
    )
    try TargetSessionReadinessPredicate.validateAction(validAction())
    try TargetSessionReadinessPredicate.validateRetained(
      first: validPredecessorSnapshot(), second: validPredecessorSnapshot())
  }

  private static func rejectsWrongIdentityStaleAndMissingCandidateState() {
    expectInvalid(.session) {
      try TargetSessionReadinessPredicate.validatePrelaunch(
        existingApplicationCount: 0,
        consoleSessionMatched: false,
        packageIdentityMatched: true
      )
    }
    expectInvalid(.identity) {
      try TargetSessionReadinessPredicate.validatePrelaunch(
        existingApplicationCount: 0,
        consoleSessionMatched: true,
        packageIdentityMatched: false
      )
    }
    expectInvalid(.processState) {
      try TargetSessionReadinessPredicate.validatePrelaunch(
        existingApplicationCount: 1,
        consoleSessionMatched: true,
        packageIdentityMatched: true
      )
    }
    for count in [0, 2] {
      expectInvalid(.processState) {
        try TargetSessionReadinessPredicate.validateSnapshot(
          validPredecessorSnapshot(applicationCount: count))
      }
      expectInvalid(.accessibility) {
        try TargetSessionReadinessPredicate.validateSnapshot(
          validPredecessorSnapshot(windowCount: count))
      }
    }
  }

  @discardableResult
  private static func stabilize(
    observations suppliedObservations: [Issue108TargetSessionReadinessSnapshot],
    declaredOperatorFocusActionCount: Int = 1,
    performRaise suppliedPerformRaise: (() -> Issue105SessionActionResult)? = nil
  ) throws -> Issue105StabilizationOutcome {
    var elapsed: UInt64 = 0
    var observations = suppliedObservations
    return try Issue105TargetSessionStabilizer.stabilize(
      policy: testPolicy,
      retainedIdentity: retainedIdentity,
      initialSnapshot: awaitingSnapshot(),
      declaredOperatorFocusActionCount: declaredOperatorFocusActionCount,
      elapsedMilliseconds: { elapsed },
      observe: { observations.removeFirst() },
      performRaise: suppliedPerformRaise ?? { .success },
      wait: { elapsed += $0 }
    )
  }

  private static func awaitingSnapshot(
    applicationCount: Int = 1,
    windowCount: Int = 1,
    processIdentifier: Int32? = 42,
    windowIdentity: UInt? = 7,
    executableIdentityMatched: Bool = true,
    applicationHidden: Bool = false
  ) -> Issue108TargetSessionReadinessSnapshot {
    snapshot(
      applicationCount: applicationCount,
      windowCount: windowCount,
      processIdentifier: processIdentifier,
      windowIdentity: windowIdentity,
      executableIdentityMatched: executableIdentityMatched,
      applicationHidden: applicationHidden,
      windowMinimized: .unavailable(.attributeUnsupported),
      windowFrameVisible: .unavailable(.attributeUnsupported),
      accessibilityFrontmost: .supported(false),
      workspaceFrontmost: false,
      workspaceFocusState: .awaitingInitialApplication
    )
  }

  private static func candidateSnapshot(
    applicationCount: Int = 1,
    windowCount: Int = 1,
    processIdentifier: Int32? = 42,
    windowIdentity: UInt? = 7,
    executableIdentityMatched: Bool = true,
    applicationHidden: Bool = false,
    windowMinimized: Issue108AccessibilityBooleanRead = .supported(false),
    windowFrameVisible: Issue108AccessibilityBooleanRead = .supported(true),
    accessibilityFrontmost: Issue108AccessibilityBooleanRead = .supported(true),
    workspaceFocusState: Issue109WorkspaceFocusState = .candidate
  ) -> Issue108TargetSessionReadinessSnapshot {
    snapshot(
      applicationCount: applicationCount,
      windowCount: windowCount,
      processIdentifier: processIdentifier,
      windowIdentity: windowIdentity,
      executableIdentityMatched: executableIdentityMatched,
      applicationHidden: applicationHidden,
      windowMinimized: windowMinimized,
      windowFrameVisible: windowFrameVisible,
      accessibilityFrontmost: accessibilityFrontmost,
      workspaceFrontmost: workspaceFocusState == .candidate,
      workspaceFocusState: workspaceFocusState
    )
  }

  private static func snapshot(
    applicationCount: Int,
    windowCount: Int,
    processIdentifier: Int32?,
    windowIdentity: UInt?,
    executableIdentityMatched: Bool,
    applicationHidden: Bool,
    windowMinimized: Issue108AccessibilityBooleanRead,
    windowFrameVisible: Issue108AccessibilityBooleanRead,
    accessibilityFrontmost: Issue108AccessibilityBooleanRead,
    workspaceFrontmost: Bool,
    workspaceFocusState: Issue109WorkspaceFocusState
  ) -> Issue108TargetSessionReadinessSnapshot {
    Issue108TargetSessionReadinessSnapshot(
      applicationCount: applicationCount,
      windowCount: windowCount,
      processIdentifier: applicationCount == 1 ? processIdentifier : nil,
      windowIdentity: windowCount == 1 ? windowIdentity : nil,
      executableIdentityMatched: executableIdentityMatched,
      applicationHidden: applicationHidden,
      windowMinimized: windowMinimized,
      windowFrameVisible: windowFrameVisible,
      accessibilityFrontmost: accessibilityFrontmost,
      workspaceFrontmost: workspaceFrontmost,
      workspaceFocusState: workspaceFocusState
    )
  }

  private static func operationProof(
    fixtureConfigured: Bool = false,
    samplerStarted: Bool = false,
    exportDestinationCreated: Bool = false,
    svgDispatched: Bool = false,
    pngDispatched: Bool = false,
    measurementCount: Int = 0,
    rawArtifactCount: Int = 0
  ) -> Issue100ZeroOperationReceipt {
    Issue100ZeroOperationReceipt(
      fixtureConfigured: fixtureConfigured,
      samplerStarted: samplerStarted,
      exportDestinationCreated: exportDestinationCreated,
      svgDispatched: svgDispatched,
      pngDispatched: pngDispatched,
      measurementCount: measurementCount,
      rawArtifactCount: rawArtifactCount
    )
  }

  private static func validAction() -> TargetSessionActionReceipt {
    TargetSessionActionReceipt(
      consoleSessionMatched: true,
      packageIdentityMatched: true,
      launchSucceeded: true,
      activationSucceeded: true,
      raiseSucceeded: true,
      frontmostWriteSucceeded: true
    )
  }

  private static func validPredecessorSnapshot(
    applicationCount: Int = 1,
    windowCount: Int = 1
  ) -> TargetSessionReadinessSnapshot {
    TargetSessionReadinessSnapshot(
      applicationCount: applicationCount,
      windowCount: windowCount,
      processIdentifier: applicationCount == 1 ? 42 : nil,
      windowIdentity: windowCount == 1 ? 7 : nil,
      executableIdentityMatched: true,
      applicationHidden: false,
      windowMinimized: false,
      windowFrameVisible: true,
      accessibilityFrontmost: true,
      workspaceFrontmost: true
    )
  }

  private static func expectInvalid(
    _ expectedAuthority: ExpectedAuthority,
    _ operation: () throws -> Void
  ) {
    do {
      try operation()
      preconditionFailure("expected fail-closed readiness invalidation")
    } catch let invalidation as TargetSessionReadinessInvalidation {
      precondition(expectedAuthority.matches(invalidation))
    } catch {
      preconditionFailure("unexpected readiness error")
    }
  }

  private static func expectInvalidAny(_ operation: () throws -> Void) {
    do {
      try operation()
      preconditionFailure("expected fail-closed readiness invalidation")
    } catch is TargetSessionReadinessInvalidation {
      return
    } catch {
      preconditionFailure("unexpected readiness error")
    }
  }

  private static func expectStabilizationInvalid(
    _ expectedAuthority: ExpectedAuthority,
    _ operation: () throws -> Void
  ) {
    do {
      try operation()
      preconditionFailure("expected fail-closed stabilization invalidation")
    } catch let failure as Issue105ReadinessFailure {
      precondition(expectedAuthority.matches(failure.invalidation))
      precondition(failure.diagnostics.activationRequestCount == 0)
    } catch {
      preconditionFailure("unexpected stabilization error")
    }
  }

  private static let retainedIdentity = Issue105RetainedCandidateIdentity(
    processIdentifier: 42,
    windowIdentity: 7
  )

  private static let testPolicy = Issue105StabilizationPolicy(
    timeoutMilliseconds: 400,
    pollIntervalMilliseconds: 50,
    maximumObservationCount: 9
  )

  private static let timeoutPolicy = Issue105StabilizationPolicy(
    timeoutMilliseconds: 100,
    pollIntervalMilliseconds: 50,
    maximumObservationCount: 3
  )

  private enum ExpectedAuthority {
    case action
    case accessibility
    case foreground
    case identity
    case processState
    case session

    func matches(_ invalidation: TargetSessionReadinessInvalidation) -> Bool {
      switch (self, invalidation) {
      case (.action, .action), (.accessibility, .accessibility), (.foreground, .foreground),
        (.identity, .identity), (.processState, .processState), (.session, .session):
        true
      default:
        false
      }
    }
  }
}
