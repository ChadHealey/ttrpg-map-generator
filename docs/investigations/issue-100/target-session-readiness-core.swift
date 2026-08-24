import Foundation

enum TargetSessionReadinessInvalidation: Error, Equatable, CustomStringConvertible {
  case action(String)
  case accessibility(String)
  case foreground(String)
  case identity(String)
  case processState(String)
  case session(String)
  case usage

  var authority: String {
    switch self {
    case .action: "target-session-action"
    case .accessibility: "accessibility"
    case .foreground: "foreground"
    case .identity: "executable-identity"
    case .processState: "candidate-process-state"
    case .session: "target-session"
    case .usage: "arguments"
    }
  }

  var description: String {
    switch self {
    case .action(let reason), .accessibility(let reason), .foreground(let reason),
      .identity(let reason), .processState(let reason), .session(let reason):
      reason
    case .usage:
      "invalid controller arguments"
    }
  }
}

struct TargetSessionActionReceipt: Equatable {
  let consoleSessionMatched: Bool
  let packageIdentityMatched: Bool
  let launchSucceeded: Bool
  let activationSucceeded: Bool
  let raiseSucceeded: Bool
  let frontmostWriteSucceeded: Bool
}

struct TargetSessionReadinessSnapshot: Equatable {
  let applicationCount: Int
  let windowCount: Int
  let processIdentifier: Int32?
  let windowIdentity: UInt?
  let executableIdentityMatched: Bool
  let applicationHidden: Bool
  let windowMinimized: Bool
  let windowFrameVisible: Bool
  let accessibilityFrontmost: Bool
  let workspaceFrontmost: Bool

  var visibleWindow: Bool {
    !applicationHidden && !windowMinimized && windowFrameVisible
  }
}

enum TargetSessionReadinessPredicate {
  static func validatePrelaunch(
    existingApplicationCount: Int,
    consoleSessionMatched: Bool,
    packageIdentityMatched: Bool
  ) throws {
    guard consoleSessionMatched else {
      throw TargetSessionReadinessInvalidation.session(
        "the controller was not running in the designated logged-in console GUI session")
    }
    guard packageIdentityMatched else {
      throw TargetSessionReadinessInvalidation.identity(
        "the packaged candidate identity did not match")
    }
    guard existingApplicationCount == 0 else {
      throw TargetSessionReadinessInvalidation.processState(
        "a stale or duplicate packaged candidate existed before launch")
    }
  }

  static func validateAction(_ receipt: TargetSessionActionReceipt) throws {
    guard receipt.consoleSessionMatched, receipt.packageIdentityMatched else {
      throw TargetSessionReadinessInvalidation.identity(
        "the launch action did not retain exact target-session and package identity")
    }
    guard receipt.launchSucceeded else {
      throw TargetSessionReadinessInvalidation.action(
        "the exact packaged candidate could not be launched")
    }
    guard receipt.activationSucceeded else {
      throw TargetSessionReadinessInvalidation.action(
        "the exact packaged candidate could not be activated")
    }
    guard receipt.raiseSucceeded else {
      throw TargetSessionReadinessInvalidation.accessibility(
        "the exact packaged candidate window could not be raised")
    }
    guard receipt.frontmostWriteSucceeded else {
      throw TargetSessionReadinessInvalidation.accessibility(
        "the exact packaged candidate could not be made Accessibility-frontmost")
    }
  }

  static func validateSnapshot(_ snapshot: TargetSessionReadinessSnapshot) throws {
    guard snapshot.applicationCount == 1, snapshot.processIdentifier != nil else {
      throw TargetSessionReadinessInvalidation.processState(
        "expected exactly one live packaged candidate")
    }
    guard snapshot.executableIdentityMatched else {
      throw TargetSessionReadinessInvalidation.identity(
        "the live packaged candidate executable identity did not match")
    }
    guard snapshot.windowCount == 1, snapshot.windowIdentity != nil else {
      throw TargetSessionReadinessInvalidation.accessibility(
        "expected exactly one packaged candidate Accessibility window")
    }
    guard snapshot.visibleWindow else {
      throw TargetSessionReadinessInvalidation.accessibility(
        "the packaged candidate Accessibility window was not visible")
    }
    guard snapshot.accessibilityFrontmost, snapshot.workspaceFrontmost else {
      throw TargetSessionReadinessInvalidation.foreground(
        "the packaged candidate did not retain independently verified frontmost state")
    }
  }

  static func validateRetained(
    first: TargetSessionReadinessSnapshot,
    second: TargetSessionReadinessSnapshot
  ) throws {
    try validateSnapshot(first)
    try validateSnapshot(second)
    guard first.processIdentifier == second.processIdentifier,
      first.windowIdentity == second.windowIdentity
    else {
      throw TargetSessionReadinessInvalidation.processState(
        "the packaged candidate application or window identity changed during readiness verification")
    }
  }
}
