import Foundation

@main
enum TargetSessionReadinessCoreTests {
  static func main() throws {
    try acceptsOnlyRetainedExactReadiness()
    distinguishesUnsupportedMinimizedFromObservedTrue()
    recordsMissingFrameAsUnavailable()
    try writesApplicationFrontmostBeforeWindowReadinessAndRaise()
    try acceptsDelayedWorkspaceAndFrameReadiness()
    try retriesOnlyCannotCompleteFrontmostBoundaries()
    rejectsFrontmostSupportAndWriteFailures()
    rejectsFrontmostReadbackFailures()
    try retriesCannotCompleteFrontmostReadback()
    try acceptsTransientRaiseCannotComplete()
    rejectsPermanentActivationAndRaiseFailures()
    rejectsIdentityDriftAndAmbiguityBeforeActions()
    rejectsIdentityDriftWhileWorkspaceOrFrameIsPending()
    rejectsForegroundLossBeforeRaise()
    rejectsHiddenApplicationWithoutUnhide()
    rejectsPersistentFrontmostAndFrameTimeouts()
    rejectsForegroundOrVisibilityLossAfterRaise()
    rejectsWrongIdentityStaleAndMissingCandidateState()
    FileHandle.standardOutput.write(
      Data("issue100 target-session readiness core tests passed\n".utf8))
  }

  private static func distinguishesUnsupportedMinimizedFromObservedTrue() {
    let unsupported = validSnapshot(windowMinimized: .unavailable(.attributeUnsupported))
    precondition(unsupported.windowMinimized.supportedValue == nil)
    precondition(unsupported.visibleWindow)
    let unsupportedReceipt = Issue108AccessibilityBooleanReadReceipt(
      unsupported.windowMinimized)
    precondition(unsupportedReceipt.state == .unavailable)
    precondition(unsupportedReceipt.value == nil)
    precondition(unsupportedReceipt.unavailableReason == .attributeUnsupported)

    let observedTrue = validSnapshot(windowMinimized: .supported(true))
    precondition(observedTrue.windowMinimized.supportedValue == true)
    precondition(!observedTrue.visibleWindow)
    let observedReceipt = Issue108AccessibilityBooleanReadReceipt(observedTrue.windowMinimized)
    precondition(observedReceipt.state == .supported)
    precondition(observedReceipt.value == true)
    precondition(observedReceipt.unavailableReason == nil)
  }

  private static func recordsMissingFrameAsUnavailable() {
    for reason in [
      Issue108AccessibilityReadUnavailable.noValue,
      .attributeUnsupported,
      .cannotComplete,
      .invalidValue,
      .readError,
    ] {
      let snapshot = validSnapshot(windowFrameVisible: .unavailable(reason))
      precondition(!snapshot.visibleWindow)
      let receipt = Issue106VisibilityPredicates(snapshot: snapshot).windowFrameVisible
      precondition(receipt.state == .unavailable)
      precondition(receipt.value == nil)
      precondition(receipt.unavailableReason == reason)
    }
  }

  private static func writesApplicationFrontmostBeforeWindowReadinessAndRaise() throws {
    var elapsed: UInt64 = 0
    var observationCount = 0
    var frontmostWriteCount = 0
    var raiseCount = 0
    var observations = [
      validSnapshot(
        windowMinimized: .unavailable(.attributeUnsupported),
        windowFrameVisible: .unavailable(.noValue),
        accessibilityFrontmost: .supported(false),
        workspaceFrontmost: false
      ),
      validSnapshot(
        windowMinimized: .unavailable(.attributeUnsupported),
        windowFrameVisible: .unavailable(.noValue),
        workspaceFrontmost: false
      ),
      validSnapshot(
        windowMinimized: .unavailable(.attributeUnsupported),
        windowFrameVisible: .unavailable(.attributeUnsupported)
      ),
      validSnapshot(windowMinimized: .unavailable(.attributeUnsupported)),
      validSnapshot(windowMinimized: .unavailable(.attributeUnsupported)),
    ]
    let outcome = try Issue105TargetSessionStabilizer.stabilize(
      policy: testPolicy,
      retainedIdentity: retainedIdentity,
      elapsedMilliseconds: { elapsed },
      observe: {
        observationCount += 1
        return observations.removeFirst()
      },
      writeFrontmost: {
        precondition(observationCount == 1)
        precondition(raiseCount == 0)
        frontmostWriteCount += 1
        return .success
      },
      performRaise: {
        precondition(observationCount == 4)
        precondition(frontmostWriteCount == 1)
        raiseCount += 1
        return .success
      },
      wait: { elapsed += $0 }
    )
    precondition(frontmostWriteCount == 1)
    precondition(raiseCount == 1)
    precondition(outcome.diagnostics.frontmost.attributeSupported == true)
    precondition(outcome.diagnostics.frontmost.attributeSettable == true)
    precondition(outcome.diagnostics.frontmost.writeSucceeded)
    precondition(outcome.diagnostics.frontmost.accessibilityReadback?.value == true)
    precondition(outcome.diagnostics.frontmost.workspaceReadbackVerified)
    precondition(outcome.diagnostics.visibilityPendingObservationCount == 1)
    precondition(
      outcome.diagnostics.actionOrder == [
        "activation-request",
        "frontmost-write-succeeded",
        "accessibility-frontmost-readback",
        "workspace-frontmost-readback",
        "supported-positive-frame-readback",
        "raise-succeeded",
      ])
  }

  private static func acceptsDelayedWorkspaceAndFrameReadiness() throws {
    var elapsed: UInt64 = 0
    var observations = [
      validSnapshot(
        windowFrameVisible: .unavailable(.noValue),
        accessibilityFrontmost: .supported(false),
        workspaceFrontmost: false
      ),
      validSnapshot(windowFrameVisible: .unavailable(.noValue), workspaceFrontmost: false),
      validSnapshot(windowFrameVisible: .unavailable(.noValue)),
      validSnapshot(windowFrameVisible: .supported(false)),
      validSnapshot(),
      validSnapshot(),
    ]
    var raiseCount = 0
    let outcome = try Issue105TargetSessionStabilizer.stabilize(
      policy: testPolicy,
      retainedIdentity: retainedIdentity,
      elapsedMilliseconds: { elapsed },
      observe: { observations.removeFirst() },
      writeFrontmost: { .success },
      performRaise: {
        raiseCount += 1
        return .success
      },
      wait: { elapsed += $0 }
    )
    precondition(raiseCount == 1)
    precondition(outcome.diagnostics.stabilizationObservationCount == 6)
    precondition(outcome.diagnostics.visibilityPendingObservationCount == 2)
    precondition(outcome.diagnostics.visibilityPendingDurationMilliseconds == 100)
  }

  private static func retriesOnlyCannotCompleteFrontmostBoundaries() throws {
    var elapsed: UInt64 = 0
    var frontmostResults: [Issue108FrontmostWriteResult] = [
      .retryableSupportCannotComplete,
      .retryableWriteCannotComplete,
      .success,
    ]
    var observations = [
      validSnapshot(accessibilityFrontmost: .supported(false), workspaceFrontmost: false),
      validSnapshot(accessibilityFrontmost: .supported(false), workspaceFrontmost: false),
      validSnapshot(accessibilityFrontmost: .supported(false), workspaceFrontmost: false),
      validSnapshot(),
      validSnapshot(),
    ]
    let outcome = try Issue105TargetSessionStabilizer.stabilize(
      policy: testPolicy,
      retainedIdentity: retainedIdentity,
      elapsedMilliseconds: { elapsed },
      observe: { observations.removeFirst() },
      writeFrontmost: { frontmostResults.removeFirst() },
      performRaise: { .success },
      wait: { elapsed += $0 }
    )
    precondition(outcome.diagnostics.frontmost.writeAttemptCount == 3)
    precondition(outcome.diagnostics.frontmost.retryableSupportFailureCount == 1)
    precondition(outcome.diagnostics.frontmost.retryableWriteFailureCount == 1)
    precondition(outcome.diagnostics.raiseAttemptCount == 1)
  }

  private static func rejectsFrontmostSupportAndWriteFailures() {
    for result in [
      Issue108FrontmostWriteResult.attributeUnsupported,
      .notSettable,
      .supportFailed,
      .writeFailed,
    ] {
      var raiseCount = 0
      do {
        _ = try stabilize(
          observations: [
            validSnapshot(
              windowFrameVisible: .unavailable(.noValue),
              accessibilityFrontmost: .supported(false),
              workspaceFrontmost: false
            )
          ],
          frontmostResults: [result],
          performRaise: {
            raiseCount += 1
            return .success
          }
        )
        preconditionFailure("expected frontmost capability invalidation")
      } catch let failure as Issue105ReadinessFailure {
        precondition(ExpectedAuthority.accessibility.matches(failure.invalidation))
        precondition(failure.diagnostics.frontmost.writeAttemptCount == 1)
        precondition(failure.diagnostics.raiseAttemptCount == 0)
      } catch {
        preconditionFailure("unexpected frontmost capability error")
      }
      precondition(raiseCount == 0)
    }
  }

  private static func rejectsFrontmostReadbackFailures() {
    for reason in [
      Issue108AccessibilityReadUnavailable.attributeUnsupported,
      .noValue,
      .invalidValue,
      .readError,
    ] {
      expectStabilizationInvalid(.accessibility) {
        try stabilize(
          observations: [
            validSnapshot(accessibilityFrontmost: .supported(false)),
            validSnapshot(accessibilityFrontmost: .unavailable(reason)),
          ]
        )
      }
    }
  }

  private static func retriesCannotCompleteFrontmostReadback() throws {
    let outcome = try stabilize(
      observations: [
        validSnapshot(accessibilityFrontmost: .supported(false), workspaceFrontmost: false),
        validSnapshot(accessibilityFrontmost: .unavailable(.cannotComplete)),
        validSnapshot(),
        validSnapshot(),
      ]
    )
    precondition(outcome.diagnostics.frontmost.retryableReadbackFailureCount == 1)
    precondition(outcome.diagnostics.frontmost.accessibilityReadback?.value == true)
  }

  private static func acceptsTransientRaiseCannotComplete() throws {
    var raiseResults: [Issue105SessionActionResult] = [.retryableCannotComplete, .success]
    let outcome = try stabilize(
      observations: [
        validSnapshot(accessibilityFrontmost: .supported(false)),
        validSnapshot(),
        validSnapshot(),
        validSnapshot(),
      ],
      performRaise: { raiseResults.removeFirst() }
    )
    precondition(outcome.diagnostics.raiseAttemptCount == 2)
    precondition(outcome.diagnostics.retryableRaiseFailureCount == 1)
    precondition(outcome.diagnostics.raiseSucceeded)
  }

  private static func rejectsPermanentActivationAndRaiseFailures() {
    expectInvalid(.action) {
      try Issue105TargetSessionStabilizer.validateActivationRequest(accepted: false)
    }
    for result in [Issue105SessionActionResult.unsupported, .failed] {
      expectStabilizationInvalid(.accessibility) {
        try stabilize(
          observations: [
            validSnapshot(accessibilityFrontmost: .supported(false)),
            validSnapshot(),
          ],
          performRaise: { result }
        )
      }
    }
  }

  private static func rejectsIdentityDriftAndAmbiguityBeforeActions() {
    for (snapshot, authority) in [
      (validSnapshot(processIdentifier: 43), ExpectedAuthority.processState),
      (validSnapshot(windowIdentity: 8), ExpectedAuthority.processState),
      (validSnapshot(applicationCount: 2), ExpectedAuthority.processState),
      (validSnapshot(windowCount: 2), ExpectedAuthority.accessibility),
      (validSnapshot(executableIdentityMatched: false), ExpectedAuthority.identity),
    ] {
      var frontmostWriteCount = 0
      do {
        _ = try stabilize(
          observations: [snapshot],
          writeFrontmost: {
            frontmostWriteCount += 1
            return .success
          }
        )
        preconditionFailure("expected pre-action identity invalidation")
      } catch let failure as Issue105ReadinessFailure {
        precondition(authority.matches(failure.invalidation))
        precondition(failure.diagnostics.frontmost.writeAttemptCount == 0)
        precondition(failure.diagnostics.raiseAttemptCount == 0)
      } catch {
        preconditionFailure("unexpected pre-action identity error")
      }
      precondition(frontmostWriteCount == 0)
    }
  }

  private static func rejectsIdentityDriftWhileWorkspaceOrFrameIsPending() {
    for driftingSnapshot in [
      validSnapshot(processIdentifier: 43, workspaceFrontmost: false),
      validSnapshot(windowIdentity: 8, windowFrameVisible: .unavailable(.noValue)),
      validSnapshot(applicationCount: 2, workspaceFrontmost: false),
      validSnapshot(windowCount: 2, windowFrameVisible: .unavailable(.noValue)),
    ] {
      do {
        _ = try stabilize(
          observations: [
            validSnapshot(accessibilityFrontmost: .supported(false), workspaceFrontmost: false),
            validSnapshot(workspaceFrontmost: false),
            driftingSnapshot,
          ]
        )
        preconditionFailure("expected pending identity invalidation")
      } catch let failure as Issue105ReadinessFailure {
        precondition(
          ExpectedAuthority.processState.matches(failure.invalidation)
            || ExpectedAuthority.accessibility.matches(failure.invalidation))
        precondition(failure.diagnostics.raiseAttemptCount == 0)
      } catch {
        preconditionFailure("unexpected pending identity error")
      }
    }

    var elapsed: UInt64 = 0
    expectStabilizationInvalid(.session) {
      _ = try Issue105TargetSessionStabilizer.stabilize(
        policy: testPolicy,
        retainedIdentity: retainedIdentity,
        elapsedMilliseconds: { elapsed },
        observe: {
          throw TargetSessionReadinessInvalidation.session(
            "the designated session changed during frontmost settling")
        },
        writeFrontmost: { preconditionFailure("frontmost must not run after session drift") },
        performRaise: { preconditionFailure("raise must not run after session drift") },
        wait: { elapsed += $0 }
      )
    }
  }

  private static func rejectsHiddenApplicationWithoutUnhide() {
    var frontmostWriteCount = 0
    expectStabilizationInvalid(.accessibility) {
      try stabilize(
        observations: [validSnapshot(applicationHidden: true)],
        writeFrontmost: {
          frontmostWriteCount += 1
          return .success
        }
      )
    }
    precondition(frontmostWriteCount == 0)
  }

  private static func rejectsForegroundLossBeforeRaise() {
    for terminal in [
      validSnapshot(
        windowFrameVisible: .unavailable(.noValue),
        accessibilityFrontmost: .supported(false)
      ),
      validSnapshot(
        windowFrameVisible: .unavailable(.noValue),
        workspaceFrontmost: false
      ),
    ] {
      do {
        _ = try stabilize(
          observations: [
            validSnapshot(
              windowFrameVisible: .unavailable(.noValue),
              accessibilityFrontmost: .supported(false),
              workspaceFrontmost: false
            ),
            validSnapshot(windowFrameVisible: .unavailable(.noValue)),
            terminal,
          ]
        )
        preconditionFailure("expected verified-foreground loss")
      } catch let failure as Issue105ReadinessFailure {
        precondition(ExpectedAuthority.foreground.matches(failure.invalidation))
        precondition(failure.diagnostics.raiseAttemptCount == 0)
      } catch {
        preconditionFailure("unexpected verified-foreground loss error")
      }
    }
  }

  private static func rejectsPersistentFrontmostAndFrameTimeouts() {
    var frontmostElapsed: UInt64 = 0
    do {
      _ = try Issue105TargetSessionStabilizer.stabilize(
        policy: timeoutPolicy,
        retainedIdentity: retainedIdentity,
        elapsedMilliseconds: { frontmostElapsed },
        observe: { validSnapshot(accessibilityFrontmost: .supported(false)) },
        writeFrontmost: { .success },
        performRaise: { preconditionFailure("raise must not run before frontmost readback") },
        wait: { frontmostElapsed += $0 }
      )
      preconditionFailure("expected frontmost timeout")
    } catch let failure as Issue105ReadinessFailure {
      precondition(ExpectedAuthority.foreground.matches(failure.invalidation))
      precondition(failure.diagnostics.frontmost.writeAttemptCount == 1)
      precondition(failure.diagnostics.raiseAttemptCount == 0)
    } catch {
      preconditionFailure("unexpected frontmost timeout error")
    }

    var frameElapsed: UInt64 = 0
    do {
      _ = try Issue105TargetSessionStabilizer.stabilize(
        policy: timeoutPolicy,
        retainedIdentity: retainedIdentity,
        elapsedMilliseconds: { frameElapsed },
        observe: {
          validSnapshot(
            windowMinimized: .unavailable(.attributeUnsupported),
            windowFrameVisible: .unavailable(.noValue)
          )
        },
        writeFrontmost: { .success },
        performRaise: { preconditionFailure("raise must not run without a supported frame") },
        wait: { frameElapsed += $0 }
      )
      preconditionFailure("expected frame timeout")
    } catch let failure as Issue105ReadinessFailure {
      precondition(ExpectedAuthority.accessibility.matches(failure.invalidation))
      precondition(failure.diagnostics.visibilityPendingObservationCount == 2)
      precondition(failure.diagnostics.raiseAttemptCount == 0)
      precondition(
        failure.diagnostics.terminalVisibilityPredicates?.windowFrameVisible.state
          == .unavailable)
    } catch {
      preconditionFailure("unexpected frame timeout error")
    }
  }

  private static func rejectsForegroundOrVisibilityLossAfterRaise() {
    for terminal in [
      validSnapshot(workspaceFrontmost: false),
      validSnapshot(accessibilityFrontmost: .supported(false)),
      validSnapshot(windowFrameVisible: .unavailable(.noValue)),
      validSnapshot(windowMinimized: .supported(true)),
      validSnapshot(processIdentifier: 43),
    ] {
      do {
        _ = try stabilize(
          observations: [
            validSnapshot(accessibilityFrontmost: .supported(false)),
            validSnapshot(),
            terminal,
          ]
        )
        preconditionFailure("expected retained-state invalidation")
      } catch let failure as Issue105ReadinessFailure {
        precondition(failure.diagnostics.raiseSucceeded)
      } catch {
        preconditionFailure("unexpected retained-state error")
      }
    }
  }

  private static func acceptsOnlyRetainedExactReadiness() throws {
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
    expectInvalid(.accessibility) {
      try Issue105TargetSessionStabilizer.validateSnapshot(
        validSnapshot(windowFrameVisible: .unavailable(.noValue)))
    }
    expectInvalid(.foreground) {
      try Issue105TargetSessionStabilizer.validateSnapshot(
        validSnapshot(accessibilityFrontmost: .unavailable(.attributeUnsupported)))
    }
  }

  @discardableResult
  private static func stabilize(
    observations suppliedObservations: [Issue108TargetSessionReadinessSnapshot],
    frontmostResults suppliedFrontmostResults: [Issue108FrontmostWriteResult] = [.success],
    writeFrontmost suppliedWriteFrontmost: (() -> Issue108FrontmostWriteResult)? = nil,
    performRaise suppliedPerformRaise: (() -> Issue105SessionActionResult)? = nil
  ) throws -> Issue105StabilizationOutcome {
    var elapsed: UInt64 = 0
    var observations = suppliedObservations
    var frontmostResults = suppliedFrontmostResults
    return try Issue105TargetSessionStabilizer.stabilize(
      policy: testPolicy,
      retainedIdentity: retainedIdentity,
      elapsedMilliseconds: { elapsed },
      observe: { observations.removeFirst() },
      writeFrontmost: suppliedWriteFrontmost ?? { frontmostResults.removeFirst() },
      performRaise: suppliedPerformRaise ?? { .success },
      wait: { elapsed += $0 }
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

  private static func validSnapshot(
    applicationCount: Int = 1,
    windowCount: Int = 1,
    processIdentifier: Int32? = 42,
    windowIdentity: UInt? = 7,
    executableIdentityMatched: Bool = true,
    applicationHidden: Bool = false,
    windowMinimized: Issue108AccessibilityBooleanRead = .supported(false),
    windowFrameVisible: Issue108AccessibilityBooleanRead = .supported(true),
    accessibilityFrontmost: Issue108AccessibilityBooleanRead = .supported(true),
    workspaceFrontmost: Bool = true
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
      workspaceFrontmost: workspaceFrontmost
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

  private static func expectStabilizationInvalid(
    _ expectedAuthority: ExpectedAuthority,
    _ operation: () throws -> Void
  ) {
    do {
      try operation()
      preconditionFailure("expected fail-closed stabilization invalidation")
    } catch let failure as Issue105ReadinessFailure {
      precondition(expectedAuthority.matches(failure.invalidation))
      precondition(failure.diagnostics.activationRequestCount == 1)
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
