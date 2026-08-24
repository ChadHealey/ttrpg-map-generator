import Foundation

@main
enum TargetSessionReadinessCoreTests {
  static func main() throws {
    try acceptsOnlyRetainedExactReadiness()
    rejectsWrongIdentityAndStaleProcessState()
    rejectsZeroOrMultipleCandidatesAndWindows()
    rejectsActivationAndRaiseFailures()
    rejectsForegroundLossAndIdentityReplacement()
    FileHandle.standardOutput.write(Data("issue100 target-session readiness core tests passed\n".utf8))
  }

  private static func acceptsOnlyRetainedExactReadiness() throws {
    try TargetSessionReadinessPredicate.validatePrelaunch(
      existingApplicationCount: 0,
      consoleSessionMatched: true,
      packageIdentityMatched: true
    )
    try TargetSessionReadinessPredicate.validateAction(validAction())
    try TargetSessionReadinessPredicate.validateRetained(first: validSnapshot(), second: validSnapshot())
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

  private enum ExpectedAuthority {
    case action
    case accessibility
    case foreground
    case identity
    case processState

    func matches(_ invalidation: TargetSessionReadinessInvalidation) -> Bool {
      switch (self, invalidation) {
      case (.action, .action), (.accessibility, .accessibility), (.foreground, .foreground),
        (.identity, .identity), (.processState, .processState):
        true
      default:
        false
      }
    }
  }
}
