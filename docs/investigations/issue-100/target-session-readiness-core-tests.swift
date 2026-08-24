import Foundation

@main
enum TargetSessionReadinessCoreTests {
  static func main() throws {
    try acceptsOnlyRetainedExactReadiness()
    rejectsWrongIdentityAndStaleProcessState()
    rejectsZeroOrMultipleCandidatesAndWindows()
    rejectsActivationAndRaiseFailures()
    rejectsForegroundLossAndIdentityReplacement()
    try acceptsDelayedActivationAndTransientRaiseFailure()
    try restoresMinimizedExactWindowBeforeRaiseAndFrontmost()
    try acceptsTransientMinimizeWriteFailureThenRestores()
    try acceptsFrameNotVisibleSettling()
    rejectsHiddenApplicationWithoutUnhide()
    rejectsUnsupportedAndNonSettableMinimizeAttribute()
    rejectsPermanentMinimizeSupportAndWriteFailures()
    rejectsSuccessfulMinimizeWriteWithoutReadback()
    rejectsDriftAndAmbiguityDuringRestoration()
    rejectsVisibilityLossAfterRestoration()
    rejectsPermanentActivationAndRaiseFailures()
    rejectsStabilizationDriftAmbiguityForegroundLossAndTimeout()
    rejectsPersistentInvisibilityAtBoundWithoutActions()
    rejectsDriftAndAmbiguityWhileInvisible()
    rejectsVisibilityLossAfterSessionAction()
    FileHandle.standardOutput.write(
      Data("issue100 target-session readiness core tests passed\n".utf8))
  }

  private static func restoresMinimizedExactWindowBeforeRaiseAndFrontmost() throws {
    var elapsed: UInt64 = 0
    var observationCount = 0
    var raiseAttemptCount = 0
    var frontmostWriteAttemptCount = 0
    var observations = [
      validSnapshot(windowMinimized: true, accessibilityFrontmost: false),
      validSnapshot(windowFrameVisible: false, accessibilityFrontmost: false),
      validSnapshot(accessibilityFrontmost: false),
      validSnapshot(),
    ]
    let outcome = try Issue105TargetSessionStabilizer.stabilize(
      policy: testPolicy,
      retainedIdentity: retainedIdentity,
      elapsedMilliseconds: { elapsed },
      observe: {
        observationCount += 1
        return observations.removeFirst()
      },
      writeMinimizedFalse: {
        precondition(observationCount == 1)
        return .success
      },
      performRaise: {
        precondition(observationCount == 3)
        raiseAttemptCount += 1
        return .success
      },
      writeFrontmost: {
        precondition(observationCount == 3)
        frontmostWriteAttemptCount += 1
        return .success
      },
      wait: { elapsed += $0 }
    )
    precondition(raiseAttemptCount == 1)
    precondition(frontmostWriteAttemptCount == 1)
    precondition(outcome.diagnostics.initialVisibilityPredicates?.windowMinimized == true)
    precondition(outcome.diagnostics.initialVisibilityPredicates?.visibleWindow == false)
    precondition(outcome.diagnostics.terminalVisibilityPredicates?.visibleWindow == true)
    precondition(outcome.diagnostics.visibilityPendingObservationCount == 2)
    precondition(outcome.diagnostics.visibilityPendingDurationMilliseconds == 100)
    precondition(outcome.diagnostics.minimize.restorationRequired)
    precondition(outcome.diagnostics.minimize.attributeSupported == true)
    precondition(outcome.diagnostics.minimize.attributeSettable == true)
    precondition(outcome.diagnostics.minimize.writeAttemptCount == 1)
    precondition(outcome.diagnostics.minimize.writeSucceeded)
    precondition(outcome.diagnostics.minimize.nonMinimizedReadbackVerified)
    precondition(outcome.diagnostics.minimize.frameVisibleReadbackVerified)
    precondition(
      outcome.diagnostics.minimize.actionOrder == [
        "activation-request",
        "minimize-write-succeeded",
        "non-minimized-readback",
        "frame-visible-readback",
        "raise-succeeded",
        "frontmost-write-succeeded",
      ])
  }

  private static func acceptsTransientMinimizeWriteFailureThenRestores() throws {
    var elapsed: UInt64 = 0
    var observations = [
      validSnapshot(windowMinimized: true, accessibilityFrontmost: false),
      validSnapshot(windowMinimized: true, accessibilityFrontmost: false),
      validSnapshot(accessibilityFrontmost: false),
      validSnapshot(),
    ]
    var minimizeResults: [Issue107MinimizeWriteResult] = [
      .retryableWriteCannotComplete, .success,
    ]
    let outcome = try Issue105TargetSessionStabilizer.stabilize(
      policy: testPolicy,
      retainedIdentity: retainedIdentity,
      elapsedMilliseconds: { elapsed },
      observe: { observations.removeFirst() },
      writeMinimizedFalse: { minimizeResults.removeFirst() },
      performRaise: { .success },
      writeFrontmost: { .success },
      wait: { elapsed += $0 }
    )
    precondition(outcome.diagnostics.minimize.writeAttemptCount == 2)
    precondition(outcome.diagnostics.minimize.retryableWriteFailureCount == 1)
    precondition(outcome.diagnostics.minimize.writeSucceeded)
    precondition(outcome.diagnostics.raiseAttemptCount == 1)
    precondition(outcome.diagnostics.frontmostWriteAttemptCount == 1)
  }

  private static func acceptsFrameNotVisibleSettling() throws {
    var elapsed: UInt64 = 0
    var observationCount = 0
    var observations = [
      validSnapshot(windowFrameVisible: false, accessibilityFrontmost: false),
      validSnapshot(accessibilityFrontmost: false),
      validSnapshot(),
    ]
    let outcome = try Issue105TargetSessionStabilizer.stabilize(
      policy: testPolicy,
      retainedIdentity: retainedIdentity,
      elapsedMilliseconds: { elapsed },
      observe: {
        observationCount += 1
        return observations.removeFirst()
      },
      writeMinimizedFalse: { preconditionFailure("minimize write must not run") },
      performRaise: {
        precondition(observationCount == 2)
        return .success
      },
      writeFrontmost: {
        precondition(observationCount == 2)
        return .success
      },
      wait: { elapsed += $0 }
    )
    precondition(outcome.diagnostics.initialVisibilityPredicates?.applicationHidden == false)
    precondition(outcome.diagnostics.visibilityPendingObservationCount == 1)
    precondition(outcome.diagnostics.visibilityPendingDurationMilliseconds == 50)
    precondition(outcome.diagnostics.terminalVisibilityPredicates?.visibleWindow == true)
  }

  private static func rejectsHiddenApplicationWithoutUnhide() {
    expectStabilizationInvalid(.accessibility) {
      try stabilization(
        observations: [validSnapshot(applicationHidden: true, accessibilityFrontmost: false)]
      )
    }
  }

  private static func rejectsUnsupportedAndNonSettableMinimizeAttribute() {
    for result in [
      Issue107MinimizeWriteResult.attributeUnsupported,
      Issue107MinimizeWriteResult.notSettable,
    ] {
      expectStabilizationInvalid(.accessibility) {
        try minimizedStabilization(writeResults: [result])
      }
    }
  }

  private static func rejectsPermanentMinimizeSupportAndWriteFailures() {
    for result in [
      Issue107MinimizeWriteResult.supportFailed,
      Issue107MinimizeWriteResult.writeFailed,
    ] {
      expectStabilizationInvalid(.accessibility) {
        try minimizedStabilization(writeResults: [result])
      }
    }
  }

  private static func rejectsSuccessfulMinimizeWriteWithoutReadback() {
    var elapsed: UInt64 = 0
    var minimizeWriteCount = 0
    do {
      _ = try Issue105TargetSessionStabilizer.stabilize(
        policy: testPolicy,
        retainedIdentity: retainedIdentity,
        elapsedMilliseconds: { elapsed },
        observe: { validSnapshot(windowMinimized: true, accessibilityFrontmost: false) },
        writeMinimizedFalse: {
          minimizeWriteCount += 1
          return .success
        },
        performRaise: { preconditionFailure("raise must not run before minimize readback") },
        writeFrontmost: { preconditionFailure("frontmost write must not run before visibility") },
        wait: { elapsed += $0 }
      )
      preconditionFailure("expected bounded minimize-readback timeout")
    } catch let failure as Issue105ReadinessFailure {
      precondition(ExpectedAuthority.accessibility.matches(failure.invalidation))
      precondition(failure.diagnostics.minimize.writeAttemptCount == 1)
      precondition(failure.diagnostics.minimize.writeSucceeded)
      precondition(!failure.diagnostics.minimize.nonMinimizedReadbackVerified)
      precondition(failure.diagnostics.raiseAttemptCount == 0)
      precondition(failure.diagnostics.frontmostWriteAttemptCount == 0)
    } catch {
      preconditionFailure("unexpected minimize-readback timeout error")
    }
    precondition(minimizeWriteCount == 1)
  }

  private static func rejectsDriftAndAmbiguityDuringRestoration() {
    let driftingSnapshots = [
      (validSnapshot(processIdentifier: 43, windowMinimized: true), ExpectedAuthority.processState),
      (validSnapshot(windowIdentity: 8, windowMinimized: true), ExpectedAuthority.processState),
      (validSnapshot(applicationCount: 2, windowMinimized: true), ExpectedAuthority.processState),
      (validSnapshot(windowCount: 2, windowMinimized: true), ExpectedAuthority.accessibility),
      (
        validSnapshot(executableIdentityMatched: false, windowMinimized: true),
        ExpectedAuthority.identity
      ),
    ]
    for (driftingSnapshot, authority) in driftingSnapshots {
      var elapsed: UInt64 = 0
      var observations = [
        validSnapshot(windowMinimized: true, accessibilityFrontmost: false),
        driftingSnapshot,
      ]
      do {
        _ = try Issue105TargetSessionStabilizer.stabilize(
          policy: testPolicy,
          retainedIdentity: retainedIdentity,
          elapsedMilliseconds: { elapsed },
          observe: { observations.removeFirst() },
          writeMinimizedFalse: { .success },
          performRaise: { preconditionFailure("raise must not run during restoration drift") },
          writeFrontmost: {
            preconditionFailure("frontmost write must not run during restoration drift")
          },
          wait: { elapsed += $0 }
        )
        preconditionFailure("expected restoration identity invalidation")
      } catch let failure as Issue105ReadinessFailure {
        precondition(authority.matches(failure.invalidation))
        precondition(failure.diagnostics.stabilizationObservationCount == 2)
        precondition(failure.diagnostics.minimize.writeAttemptCount == 1)
        precondition(failure.diagnostics.raiseAttemptCount == 0)
        precondition(failure.diagnostics.frontmostWriteAttemptCount == 0)
      } catch {
        preconditionFailure("unexpected restoration drift error")
      }
    }
  }

  private static func rejectsVisibilityLossAfterRestoration() {
    var elapsed: UInt64 = 0
    var observations = [
      validSnapshot(windowMinimized: true, accessibilityFrontmost: false),
      validSnapshot(accessibilityFrontmost: false, workspaceFrontmost: false),
      validSnapshot(windowFrameVisible: false, accessibilityFrontmost: false),
    ]
    do {
      _ = try Issue105TargetSessionStabilizer.stabilize(
        policy: testPolicy,
        retainedIdentity: retainedIdentity,
        elapsedMilliseconds: { elapsed },
        observe: { observations.removeFirst() },
        writeMinimizedFalse: { .success },
        performRaise: { preconditionFailure("raise must not run before Workspace foreground") },
        writeFrontmost: { preconditionFailure("frontmost write must not run before raise") },
        wait: { elapsed += $0 }
      )
      preconditionFailure("expected post-restoration visibility loss")
    } catch let failure as Issue105ReadinessFailure {
      precondition(ExpectedAuthority.foreground.matches(failure.invalidation))
      precondition(failure.diagnostics.minimize.nonMinimizedReadbackVerified)
      precondition(failure.diagnostics.minimize.frameVisibleReadbackVerified)
      precondition(failure.diagnostics.raiseAttemptCount == 0)
      precondition(failure.diagnostics.frontmostWriteAttemptCount == 0)
    } catch {
      preconditionFailure("unexpected post-restoration visibility error")
    }
  }

  private static func acceptsDelayedActivationAndTransientRaiseFailure() throws {
    var elapsed: UInt64 = 0
    var observations = [
      validSnapshot(accessibilityFrontmost: false, workspaceFrontmost: false),
      validSnapshot(accessibilityFrontmost: false, workspaceFrontmost: true),
      validSnapshot(accessibilityFrontmost: false, workspaceFrontmost: true),
      validSnapshot(accessibilityFrontmost: true, workspaceFrontmost: true),
    ]
    var raiseResults: [Issue105SessionActionResult] = [.retryableCannotComplete, .success]
    let outcome = try Issue105TargetSessionStabilizer.stabilize(
      policy: testPolicy,
      retainedIdentity: retainedIdentity,
      elapsedMilliseconds: { elapsed },
      observe: { observations.removeFirst() },
      writeMinimizedFalse: { preconditionFailure("minimize write must not run") },
      performRaise: { raiseResults.removeFirst() },
      writeFrontmost: { .success },
      wait: { elapsed += $0 }
    )
    precondition(outcome.diagnostics.stabilizationObservationCount == 4)
    precondition(outcome.diagnostics.raiseAttemptCount == 2)
    precondition(outcome.diagnostics.retryableRaiseFailureCount == 1)
    precondition(outcome.diagnostics.frontmostWriteAttemptCount == 1)
    precondition(outcome.diagnostics.terminalPredicates.accessibilityFrontmost)
  }

  private static func rejectsPermanentActivationAndRaiseFailures() {
    expectInvalid(.action) {
      try Issue105TargetSessionStabilizer.validateActivationRequest(accepted: false)
    }
    expectStabilizationInvalid(.accessibility) {
      try stabilization(raiseResults: [.failed])
    }
    expectStabilizationInvalid(.accessibility) {
      try stabilization(raiseResults: [.unsupported])
    }
    expectStabilizationInvalid(.accessibility) {
      try stabilization(raiseResults: [.success], frontmostWriteResult: .failed)
    }
  }

  private static func rejectsStabilizationDriftAmbiguityForegroundLossAndTimeout() {
    expectStabilizationInvalid(.processState) {
      try stabilization(observations: [validSnapshot(processIdentifier: 43)])
    }
    expectStabilizationInvalid(.processState) {
      try stabilization(observations: [validSnapshot(windowIdentity: 8)])
    }
    expectStabilizationInvalid(.processState) {
      try stabilization(observations: [validSnapshot(applicationCount: 2)])
    }
    expectStabilizationInvalid(.accessibility) {
      try stabilization(observations: [validSnapshot(windowCount: 2)])
    }
    expectStabilizationInvalid(.foreground) {
      try stabilization(
        observations: [
          validSnapshot(accessibilityFrontmost: false),
          validSnapshot(accessibilityFrontmost: false, workspaceFrontmost: false),
        ]
      )
    }

    var elapsed: UInt64 = 0
    expectStabilizationInvalid(.foreground) {
      _ = try Issue105TargetSessionStabilizer.stabilize(
        policy: testPolicy,
        retainedIdentity: retainedIdentity,
        elapsedMilliseconds: { elapsed },
        observe: { validSnapshot(accessibilityFrontmost: false, workspaceFrontmost: false) },
        writeMinimizedFalse: { preconditionFailure("minimize write must not run") },
        performRaise: { preconditionFailure("raise must not run before activation stabilizes") },
        writeFrontmost: { preconditionFailure("frontmost write must not run before raise") },
        wait: { elapsed += $0 }
      )
    }
  }

  private static func rejectsPersistentInvisibilityAtBoundWithoutActions() {
    var elapsed: UInt64 = 0
    var raiseAttemptCount = 0
    var frontmostWriteAttemptCount = 0
    do {
      _ = try Issue105TargetSessionStabilizer.stabilize(
        policy: testPolicy,
        retainedIdentity: retainedIdentity,
        elapsedMilliseconds: { elapsed },
        observe: {
          validSnapshot(windowFrameVisible: false, accessibilityFrontmost: false)
        },
        writeMinimizedFalse: { preconditionFailure("minimize write must not run") },
        performRaise: {
          raiseAttemptCount += 1
          return .success
        },
        writeFrontmost: {
          frontmostWriteAttemptCount += 1
          return .success
        },
        wait: { elapsed += $0 }
      )
      preconditionFailure("expected bounded invisibility timeout")
    } catch let failure as Issue105ReadinessFailure {
      precondition(ExpectedAuthority.accessibility.matches(failure.invalidation))
      precondition(failure.diagnostics.stabilizationDurationMilliseconds == 150)
      precondition(failure.diagnostics.visibilityPendingObservationCount == 4)
      precondition(failure.diagnostics.visibilityPendingDurationMilliseconds == 150)
      precondition(failure.diagnostics.initialVisibilityPredicates?.visibleWindow == false)
      precondition(failure.diagnostics.terminalVisibilityPredicates?.visibleWindow == false)
      precondition(failure.diagnostics.raiseAttemptCount == 0)
      precondition(failure.diagnostics.frontmostWriteAttemptCount == 0)
    } catch {
      preconditionFailure("unexpected bounded invisibility error")
    }
    precondition(raiseAttemptCount == 0)
    precondition(frontmostWriteAttemptCount == 0)
  }

  private static func rejectsDriftAndAmbiguityWhileInvisible() {
    var elapsed: UInt64 = 0
    var observations = [
      validSnapshot(windowFrameVisible: false, accessibilityFrontmost: false),
      validSnapshot(
        processIdentifier: 43,
        windowFrameVisible: false,
        accessibilityFrontmost: false
      ),
    ]
    do {
      _ = try Issue105TargetSessionStabilizer.stabilize(
        policy: testPolicy,
        retainedIdentity: retainedIdentity,
        elapsedMilliseconds: { elapsed },
        observe: { observations.removeFirst() },
        writeMinimizedFalse: { preconditionFailure("minimize write must not run") },
        performRaise: { preconditionFailure("raise must not run while invisible") },
        writeFrontmost: { preconditionFailure("frontmost write must not run while invisible") },
        wait: { elapsed += $0 }
      )
      preconditionFailure("expected invisible identity drift invalidation")
    } catch let failure as Issue105ReadinessFailure {
      precondition(ExpectedAuthority.processState.matches(failure.invalidation))
      precondition(failure.diagnostics.stabilizationObservationCount == 2)
      precondition(failure.diagnostics.visibilityPendingObservationCount == 1)
      precondition(failure.diagnostics.raiseAttemptCount == 0)
      precondition(failure.diagnostics.frontmostWriteAttemptCount == 0)
    } catch {
      preconditionFailure("unexpected invisible identity drift error")
    }

    for (snapshot, authority) in [
      (
        validSnapshot(
          windowIdentity: 8,
          windowFrameVisible: false,
          accessibilityFrontmost: false
        ), ExpectedAuthority.processState
      ),
      (
        validSnapshot(
          executableIdentityMatched: false,
          windowFrameVisible: false,
          accessibilityFrontmost: false
        ), ExpectedAuthority.identity
      ),
      (
        validSnapshot(
          applicationCount: 2,
          windowFrameVisible: false,
          accessibilityFrontmost: false
        ), ExpectedAuthority.processState
      ),
      (
        validSnapshot(
          windowCount: 2,
          windowFrameVisible: false,
          accessibilityFrontmost: false
        ), ExpectedAuthority.accessibility
      ),
    ] {
      expectStabilizationInvalid(authority) {
        try stabilization(observations: [snapshot])
      }
    }

    var sessionElapsed: UInt64 = 0
    expectStabilizationInvalid(.session) {
      _ = try Issue105TargetSessionStabilizer.stabilize(
        policy: testPolicy,
        retainedIdentity: retainedIdentity,
        elapsedMilliseconds: { sessionElapsed },
        observe: {
          throw TargetSessionReadinessInvalidation.session(
            "the designated session changed while visibility was pending")
        },
        writeMinimizedFalse: { preconditionFailure("minimize write must not run") },
        performRaise: { preconditionFailure("raise must not run after session drift") },
        writeFrontmost: { preconditionFailure("frontmost write must not run after session drift") },
        wait: { sessionElapsed += $0 }
      )
    }
  }

  private static func rejectsVisibilityLossAfterSessionAction() {
    var elapsed: UInt64 = 0
    var observations = [
      validSnapshot(accessibilityFrontmost: false),
      validSnapshot(windowMinimized: true, accessibilityFrontmost: false),
    ]
    do {
      _ = try Issue105TargetSessionStabilizer.stabilize(
        policy: testPolicy,
        retainedIdentity: retainedIdentity,
        elapsedMilliseconds: { elapsed },
        observe: { observations.removeFirst() },
        writeMinimizedFalse: { preconditionFailure("minimize write must not run after action") },
        performRaise: { .success },
        writeFrontmost: { .success },
        wait: { elapsed += $0 }
      )
      preconditionFailure("expected post-action visibility-loss invalidation")
    } catch let failure as Issue105ReadinessFailure {
      precondition(ExpectedAuthority.foreground.matches(failure.invalidation))
      precondition(failure.diagnostics.stabilizationObservationCount == 2)
      precondition(failure.diagnostics.visibilityPendingObservationCount == 0)
      precondition(failure.diagnostics.raiseAttemptCount == 1)
      precondition(failure.diagnostics.frontmostWriteAttemptCount == 1)
      precondition(failure.diagnostics.terminalVisibilityPredicates?.visibleWindow == false)
    } catch {
      preconditionFailure("unexpected post-action visibility-loss error")
    }
  }

  @discardableResult
  private static func stabilization(
    observations suppliedObservations: [TargetSessionReadinessSnapshot] = [
      validSnapshot(accessibilityFrontmost: false),
      validSnapshot(),
    ],
    raiseResults suppliedRaiseResults: [Issue105SessionActionResult] = [.success],
    frontmostWriteResult: Issue105SessionActionResult = .success
  ) throws -> Issue105StabilizationOutcome {
    var elapsed: UInt64 = 0
    var observations = suppliedObservations
    var raiseResults = suppliedRaiseResults
    return try Issue105TargetSessionStabilizer.stabilize(
      policy: testPolicy,
      retainedIdentity: retainedIdentity,
      elapsedMilliseconds: { elapsed },
      observe: { observations.removeFirst() },
      writeMinimizedFalse: { preconditionFailure("minimize write must not run") },
      performRaise: { raiseResults.removeFirst() },
      writeFrontmost: { frontmostWriteResult },
      wait: { elapsed += $0 }
    )
  }

  @discardableResult
  private static func minimizedStabilization(
    writeResults suppliedWriteResults: [Issue107MinimizeWriteResult]
  ) throws -> Issue105StabilizationOutcome {
    var elapsed: UInt64 = 0
    var writeResults = suppliedWriteResults
    return try Issue105TargetSessionStabilizer.stabilize(
      policy: testPolicy,
      retainedIdentity: retainedIdentity,
      elapsedMilliseconds: { elapsed },
      observe: { validSnapshot(windowMinimized: true, accessibilityFrontmost: false) },
      writeMinimizedFalse: { writeResults.removeFirst() },
      performRaise: { preconditionFailure("raise must not run while minimized") },
      writeFrontmost: { preconditionFailure("frontmost write must not run while minimized") },
      wait: { elapsed += $0 }
    )
  }

  private static func acceptsOnlyRetainedExactReadiness() throws {
    try TargetSessionReadinessPredicate.validatePrelaunch(
      existingApplicationCount: 0,
      consoleSessionMatched: true,
      packageIdentityMatched: true
    )
    try TargetSessionReadinessPredicate.validateAction(validAction())
    try TargetSessionReadinessPredicate.validateRetained(
      first: validSnapshot(), second: validSnapshot())
  }

  private static func rejectsWrongIdentityAndStaleProcessState() {
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
  }

  private static func rejectsZeroOrMultipleCandidatesAndWindows() {
    for count in [0, 2] {
      expectInvalid(.processState) {
        try TargetSessionReadinessPredicate.validateSnapshot(validSnapshot(applicationCount: count))
      }
    }
    for count in [0, 2] {
      expectInvalid(.accessibility) {
        try TargetSessionReadinessPredicate.validateSnapshot(validSnapshot(windowCount: count))
      }
    }
    expectInvalid(.accessibility) {
      try TargetSessionReadinessPredicate.validateSnapshot(validSnapshot(windowMinimized: true))
    }
  }

  private static func rejectsActivationAndRaiseFailures() {
    expectInvalid(.action) {
      try TargetSessionReadinessPredicate.validateAction(
        TargetSessionActionReceipt(
          consoleSessionMatched: true,
          packageIdentityMatched: true,
          launchSucceeded: true,
          activationSucceeded: false,
          raiseSucceeded: true,
          frontmostWriteSucceeded: true
        ))
    }
    expectInvalid(.accessibility) {
      try TargetSessionReadinessPredicate.validateAction(
        TargetSessionActionReceipt(
          consoleSessionMatched: true,
          packageIdentityMatched: true,
          launchSucceeded: true,
          activationSucceeded: true,
          raiseSucceeded: false,
          frontmostWriteSucceeded: true
        ))
    }
  }

  private static func rejectsForegroundLossAndIdentityReplacement() {
    expectInvalid(.foreground) {
      try TargetSessionReadinessPredicate.validateRetained(
        first: validSnapshot(),
        second: validSnapshot(accessibilityFrontmost: false)
      )
    }
    expectInvalid(.processState) {
      try TargetSessionReadinessPredicate.validateRetained(
        first: validSnapshot(),
        second: validSnapshot(processIdentifier: 43)
      )
    }
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

  private static func validSnapshot(
    applicationCount: Int = 1,
    windowCount: Int = 1,
    processIdentifier: Int32? = 42,
    windowIdentity: UInt? = 7,
    executableIdentityMatched: Bool = true,
    applicationHidden: Bool = false,
    windowMinimized: Bool = false,
    windowFrameVisible: Bool = true,
    accessibilityFrontmost: Bool = true,
    workspaceFrontmost: Bool = true
  ) -> TargetSessionReadinessSnapshot {
    TargetSessionReadinessSnapshot(
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
    timeoutMilliseconds: 150,
    pollIntervalMilliseconds: 50,
    maximumObservationCount: 4
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
        (.identity, .identity), (.processState, .processState):
        true
      case (.session, .session):
        true
      default:
        false
      }
    }
  }
}
