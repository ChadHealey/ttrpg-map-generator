import AppKit
import ApplicationServices
import Foundation

enum Issue105TargetSessionStabilizationPlatform {
  static func requestActivation(_ application: NSRunningApplication) -> Bool {
    application.activate(options: [.activateAllWindows])
  }

  static func stabilize(
    application: NSRunningApplication,
    window: AXUIElement,
    bundleIdentifier: String,
    expectedExecutableSha256: String
  ) throws -> Issue105StabilizationOutcome {
    let retainedIdentity = Issue105RetainedCandidateIdentity(
      processIdentifier: application.processIdentifier,
      windowIdentity: CFHash(window)
    )
    let applicationElement = AXUIElementCreateApplication(application.processIdentifier)
    let start = DispatchTime.now().uptimeNanoseconds

    return try Issue105TargetSessionStabilizer.stabilize(
      policy: .approved,
      retainedIdentity: retainedIdentity,
      elapsedMilliseconds: {
        (DispatchTime.now().uptimeNanoseconds - start) / 1_000_000
      },
      observe: {
        guard Issue100TargetSessionPlatform.designatedConsoleSessionMatched() else {
          throw TargetSessionReadinessInvalidation.session(
            "the designated logged-in console GUI session changed during stabilization")
        }
        return try Issue100TargetSessionPlatform.readinessSnapshot(
          bundleIdentifier: bundleIdentifier,
          expectedExecutableSha256: expectedExecutableSha256
        )
      },
      writeMinimizedFalse: {
        minimizedFalseWriteResult(window)
      },
      performRaise: {
        raiseResult(window)
      },
      writeFrontmost: {
        frontmostWriteResult(applicationElement)
      },
      wait: { milliseconds in
        Thread.sleep(forTimeInterval: Double(milliseconds) / 1_000)
      }
    )
  }

  private static func minimizedFalseWriteResult(
    _ window: AXUIElement
  ) -> Issue107MinimizeWriteResult {
    var settable = DarwinBoolean(false)
    let supportError = AXUIElementIsAttributeSettable(
      window,
      kAXMinimizedAttribute as CFString,
      &settable
    )
    switch supportError {
    case .success:
      break
    case .cannotComplete:
      return .retryableSupportCannotComplete
    case .attributeUnsupported:
      return .attributeUnsupported
    default:
      return .supportFailed
    }
    guard settable.boolValue else { return .notSettable }

    switch AXUIElementSetAttributeValue(
      window,
      kAXMinimizedAttribute as CFString,
      kCFBooleanFalse
    ) {
    case .success:
      return .success
    case .cannotComplete:
      return .retryableWriteCannotComplete
    case .attributeUnsupported:
      return .attributeUnsupported
    default:
      return .writeFailed
    }
  }

  private static func raiseResult(_ window: AXUIElement) -> Issue105SessionActionResult {
    var rawActions: CFArray?
    let supportError = AXUIElementCopyActionNames(window, &rawActions)
    guard supportError == .success else { return actionResult(supportError) }
    guard let actions = rawActions as? [String], actions.contains(kAXRaiseAction) else {
      return .unsupported
    }
    return actionResult(AXUIElementPerformAction(window, kAXRaiseAction as CFString))
  }

  private static func frontmostWriteResult(
    _ applicationElement: AXUIElement
  ) -> Issue105SessionActionResult {
    var settable = DarwinBoolean(false)
    let supportError = AXUIElementIsAttributeSettable(
      applicationElement,
      kAXFrontmostAttribute as CFString,
      &settable
    )
    guard supportError == .success else { return actionResult(supportError) }
    guard settable.boolValue else { return .unsupported }
    return actionResult(
      AXUIElementSetAttributeValue(
        applicationElement,
        kAXFrontmostAttribute as CFString,
        kCFBooleanTrue
      ))
  }

  private static func actionResult(_ error: AXError) -> Issue105SessionActionResult {
    switch error {
    case .success:
      .success
    case .cannotComplete:
      .retryableCannotComplete
    case .actionUnsupported, .attributeUnsupported:
      .unsupported
    default:
      .failed
    }
  }
}
