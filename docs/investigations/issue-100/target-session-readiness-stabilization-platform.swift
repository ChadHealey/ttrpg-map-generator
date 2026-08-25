import AppKit
import ApplicationServices
import Foundation

enum Issue105TargetSessionStabilizationPlatform {
  static func readinessSnapshot(
    bundleIdentifier: String,
    expectedExecutableSha256: String,
    initialWorkspaceForeground: Issue116WorkspaceForegroundState
  ) throws -> Issue108TargetSessionReadinessSnapshot {
    let applications = Issue100TargetSessionPlatform.exactApplications(
      bundleIdentifier: bundleIdentifier)
    guard applications.count == 1, let application = applications.first else {
      return Issue108TargetSessionReadinessSnapshot(
        applicationCount: applications.count,
        windowCount: 0,
        processIdentifier: nil,
        windowIdentity: nil,
        executableIdentityMatched: false,
        applicationHidden: true,
        windowMinimized: .unavailable(.noValue),
        windowFrameVisible: .unavailable(.noValue),
        accessibilityFrontmost: .unavailable(.noValue),
        workspaceFrontmost: false,
        workspaceFocusState: .otherApplication
      )
    }

    let applicationElement = AXUIElementCreateApplication(application.processIdentifier)
    let windows = try elements(applicationElement, attribute: kAXWindowsAttribute)
    let window = windows.count == 1 ? windows.first : nil
    let executableIdentityMatched: Bool
    if let path = application.executableURL?.resolvingSymlinksInPath().path,
      let digest = try? ExecutableIdentityValidator.sha256(atPath: path)
    {
      executableIdentityMatched = digest == expectedExecutableSha256
    } else {
      executableIdentityMatched = false
    }

    let workspaceFocusState = Issue116PrelaunchForegroundController.classifyWorkspaceFocus(
      currentForeground: currentWorkspaceForeground(),
      initialForeground: initialWorkspaceForeground,
      candidateProcessIdentifier: application.processIdentifier
    )
    return Issue108TargetSessionReadinessSnapshot(
      applicationCount: applications.count,
      windowCount: windows.count,
      processIdentifier: application.processIdentifier,
      windowIdentity: window.map(CFHash),
      executableIdentityMatched: executableIdentityMatched,
      applicationHidden: application.isHidden,
      windowMinimized: window.map {
        booleanRead($0, attribute: kAXMinimizedAttribute)
      } ?? .unavailable(.noValue),
      windowFrameVisible: window.map(positiveFrame) ?? .unavailable(.noValue),
      accessibilityFrontmost: booleanRead(
        applicationElement, attribute: kAXFrontmostAttribute),
      workspaceFrontmost: workspaceFocusState == .candidate,
      workspaceFocusState: workspaceFocusState
    )
  }

  static func currentWorkspaceForeground() -> Issue116WorkspaceForegroundState {
    Issue116PrelaunchForegroundController.captureWorkspaceForeground(
      processIdentifier: NSWorkspace.shared.frontmostApplication?.processIdentifier
    )
  }

  static func stabilize(
    application: NSRunningApplication,
    window: AXUIElement,
    bundleIdentifier: String,
    expectedExecutableSha256: String,
    initialWorkspaceForeground: Issue116WorkspaceForegroundState,
    initialSnapshot: Issue108TargetSessionReadinessSnapshot,
    operatorReadyLatch: Issue110OperatorReadyLatchDiagnostics,
    declaredOperatorFocusActionCount: Int
  ) throws -> Issue105StabilizationOutcome {
    let retainedIdentity = Issue105RetainedCandidateIdentity(
      processIdentifier: application.processIdentifier,
      windowIdentity: CFHash(window)
    )
    let start = DispatchTime.now().uptimeNanoseconds

    return try Issue105TargetSessionStabilizer.stabilize(
      policy: .approved,
      retainedIdentity: retainedIdentity,
      initialSnapshot: initialSnapshot,
      operatorReadyLatch: operatorReadyLatch,
      declaredOperatorFocusActionCount: declaredOperatorFocusActionCount,
      elapsedMilliseconds: {
        (DispatchTime.now().uptimeNanoseconds - start) / 1_000_000
      },
      observe: {
        guard Issue100TargetSessionPlatform.designatedConsoleSessionMatched() else {
          throw TargetSessionReadinessInvalidation.session(
            "the designated logged-in console GUI session changed during stabilization")
        }
        return try readinessSnapshot(
          bundleIdentifier: bundleIdentifier,
          expectedExecutableSha256: expectedExecutableSha256,
          initialWorkspaceForeground: initialWorkspaceForeground
        )
      },
      performRaise: {
        raiseResult(window)
      },
      wait: { milliseconds in
        Thread.sleep(forTimeInterval: Double(milliseconds) / 1_000)
      }
    )
  }

  private static func positiveFrame(_ element: AXUIElement) -> Issue108AccessibilityBooleanRead {
    let positionRead: Result<AXValue, Issue108AccessibilityReadUnavailable> = readValue(
      element, attribute: kAXPositionAttribute)
    let sizeRead: Result<AXValue, Issue108AccessibilityReadUnavailable> = readValue(
      element, attribute: kAXSizeAttribute)
    guard case .success(let position) = positionRead else {
      guard case .failure(let reason) = positionRead else { preconditionFailure() }
      return .unavailable(reason)
    }
    guard case .success(let size) = sizeRead else {
      guard case .failure(let reason) = sizeRead else { preconditionFailure() }
      return .unavailable(reason)
    }
    var point = CGPoint.zero
    var dimensions = CGSize.zero
    guard AXValueGetValue(position, .cgPoint, &point),
      AXValueGetValue(size, .cgSize, &dimensions)
    else { return .unavailable(.invalidValue) }
    return .supported(
      point.x.isFinite && point.y.isFinite && dimensions.width.isFinite
        && dimensions.height.isFinite && dimensions.width > 0 && dimensions.height > 0)
  }

  private static func elements(_ element: AXUIElement, attribute: String) throws -> [AXUIElement] {
    var raw: CFTypeRef?
    let error = AXUIElementCopyAttributeValue(element, attribute as CFString, &raw)
    if error == .noValue || error == .attributeUnsupported { return [] }
    guard error == .success, let values = raw as? [AXUIElement] else {
      throw TargetSessionReadinessInvalidation.accessibility(
        "the retained packaged candidate Accessibility windows could not be read")
    }
    return values
  }

  private static func booleanRead(
    _ element: AXUIElement,
    attribute: String
  ) -> Issue108AccessibilityBooleanRead {
    let read: Result<Bool, Issue108AccessibilityReadUnavailable> = readValue(
      element, attribute: attribute)
    switch read {
    case .success(let value):
      return .supported(value)
    case .failure(let reason):
      return .unavailable(reason)
    }
  }

  private static func readValue<T>(
    _ element: AXUIElement,
    attribute: String
  ) -> Result<T, Issue108AccessibilityReadUnavailable> {
    var raw: CFTypeRef?
    switch AXUIElementCopyAttributeValue(element, attribute as CFString, &raw) {
    case .success:
      guard let value = raw as? T else { return .failure(.invalidValue) }
      return .success(value)
    case .noValue:
      return .failure(.noValue)
    case .attributeUnsupported:
      return .failure(.attributeUnsupported)
    case .cannotComplete:
      return .failure(.cannotComplete)
    default:
      return .failure(.readError)
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
