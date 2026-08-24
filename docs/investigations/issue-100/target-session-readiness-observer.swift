import AppKit
import Foundation

@main
enum TargetSessionReadinessObserver {
  static func main() {
    do {
      let arguments = try Arguments(CommandLine.arguments)
      let receipt = try observe(arguments)
      try issue100Emit(receipt)
    } catch let invalidation as TargetSessionReadinessInvalidation {
      try? issue100Emit(TargetSessionReadinessObserverReceipt.invalid(invalidation))
      exit(2)
    } catch {
      let invalidation = TargetSessionReadinessInvalidation.accessibility(
        "unexpected internal target-session readiness observer failure")
      try? issue100Emit(TargetSessionReadinessObserverReceipt.invalid(invalidation))
      exit(2)
    }
  }

  @MainActor
  private static func observe(_ arguments: Arguments) throws
    -> TargetSessionReadinessObserverReceipt
  {
    try Issue100TargetSessionPlatform.verifyTargetHost()
    guard Issue100TargetSessionPlatform.designatedConsoleSessionMatched() else {
      throw TargetSessionReadinessInvalidation.session(
        "the observer was not running in the designated logged-in console GUI session")
    }
    let observerApplication = NSApplication.shared
    if observerApplication.activationPolicy() != .prohibited {
      _ = observerApplication.setActivationPolicy(.prohibited)
    }
    guard observerApplication.windows.isEmpty,
      NSWorkspace.shared.frontmostApplication?.processIdentifier
        != ProcessInfo.processInfo.processIdentifier
    else {
      throw TargetSessionReadinessInvalidation.foreground(
        "the readiness observer acquired a window or foreground ownership")
    }
    guard AXIsProcessTrusted() else {
      throw TargetSessionReadinessInvalidation.accessibility(
        "Accessibility permission was not granted")
    }

    let first = try Issue100TargetSessionPlatform.readinessSnapshot(
      bundleIdentifier: arguments.bundleIdentifier,
      expectedExecutableSha256: arguments.expectedCandidateSha256
    )
    try TargetSessionReadinessPredicate.validateSnapshot(first)
    Thread.sleep(forTimeInterval: 0.5)
    let second = try Issue100TargetSessionPlatform.readinessSnapshot(
      bundleIdentifier: arguments.bundleIdentifier,
      expectedExecutableSha256: arguments.expectedCandidateSha256
    )
    try TargetSessionReadinessPredicate.validateRetained(first: first, second: second)

    return TargetSessionReadinessObserverReceipt(
      observerVersion: issue100ReadinessObserverSchemaVersion,
      status: "valid",
      target: .approved,
      bundleIdentifier: arguments.bundleIdentifier,
      candidateExecutableSha256: arguments.expectedCandidateSha256,
      applicationCount: second.applicationCount,
      accessibilityWindowCount: second.windowCount,
      visibleAccessibilityWindow: second.visibleWindow,
      accessibilityFrontmost: second.accessibilityFrontmost,
      workspaceFrontmost: second.workspaceFrontmost,
      applicationAndWindowIdentityRetained: true,
      invalidAuthority: nil,
      invalidReason: nil
    )
  }
}

private struct Arguments {
  let bundleIdentifier: String
  let expectedCandidateSha256: String

  init(_ arguments: [String]) throws {
    guard arguments.count == 3,
      arguments[1] == "app.ttrpgmap.generator",
      ExecutableIdentityValidator.isDigest(arguments[2])
    else { throw TargetSessionReadinessInvalidation.usage }
    bundleIdentifier = arguments[1]
    expectedCandidateSha256 = arguments[2]
  }
}
