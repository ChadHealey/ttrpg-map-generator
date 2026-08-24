import AppKit
import ApplicationServices
import CryptoKit
import Darwin
import Foundation

struct Issue100PackageIdentity {
  let applicationURL: URL
  let executableURL: URL
  let executableSha256: String
}

enum Issue100TargetSessionPlatform {
  static func verifyTargetHost() throws {
    guard try sysctlString("hw.model") == issue100TargetModel,
      try sysctlString("kern.osproductversion") == issue100TargetOSVersion,
      try sysctlString("kern.osversion") == issue100TargetOSBuild,
      ProcessInfo.processInfo.physicalMemory == issue100TargetMemoryBytes
    else {
      throw TargetSessionReadinessInvalidation.session(
        "host, OS build, or physical memory did not match the approved baseline")
    }
  }

  static func designatedConsoleSessionMatched() -> Bool {
    guard geteuid() == getuid(),
      let dictionary = CGSessionCopyCurrentDictionary() as? [String: Any]
    else { return false }
    let onConsole = dictionary[kCGSessionOnConsoleKey as String] as? Bool
    let loginDone = dictionary[kCGSessionLoginDoneKey as String] as? Bool
    return onConsole == true && loginDone == true
  }

  static func packageIdentity(
    applicationPath: String,
    bundleIdentifier: String,
    expectedExecutableSha256: String
  ) throws -> Issue100PackageIdentity {
    guard applicationPath.hasPrefix("/"), applicationPath.hasSuffix(".app"),
      ExecutableIdentityValidator.isDigest(expectedExecutableSha256)
    else { throw TargetSessionReadinessInvalidation.usage }
    let suppliedURL = URL(fileURLWithPath: applicationPath, isDirectory: true).standardizedFileURL
    let applicationURL = suppliedURL.resolvingSymlinksInPath()
    var isDirectory: ObjCBool = false
    guard FileManager.default.fileExists(atPath: applicationURL.path, isDirectory: &isDirectory),
      isDirectory.boolValue,
      let bundle = Bundle(url: applicationURL),
      bundle.bundleIdentifier == bundleIdentifier,
      let executableURL = bundle.executableURL?.resolvingSymlinksInPath()
    else {
      throw TargetSessionReadinessInvalidation.identity(
        "the supplied packaged candidate app identity did not match")
    }
    let executableSha256: String
    do { executableSha256 = try ExecutableIdentityValidator.sha256(atPath: executableURL.path) }
    catch {
      throw TargetSessionReadinessInvalidation.identity(
        "the packaged candidate executable identity could not be read")
    }
    guard executableSha256 == expectedExecutableSha256 else {
      throw TargetSessionReadinessInvalidation.identity(
        "the packaged candidate executable identity did not match")
    }
    return Issue100PackageIdentity(
      applicationURL: applicationURL,
      executableURL: executableURL,
      executableSha256: executableSha256
    )
  }

  static func exactApplications(bundleIdentifier: String) -> [NSRunningApplication] {
    NSRunningApplication.runningApplications(withBundleIdentifier: bundleIdentifier).filter {
      !$0.isTerminated
    }
  }

  static func exactLiveIdentityMatched(
    _ application: NSRunningApplication,
    package: Issue100PackageIdentity
  ) -> Bool {
    guard application.bundleURL?.resolvingSymlinksInPath() == package.applicationURL,
      application.executableURL?.resolvingSymlinksInPath() == package.executableURL,
      let liveExecutablePath = application.executableURL?.resolvingSymlinksInPath().path,
      let liveSha256 = try? ExecutableIdentityValidator.sha256(atPath: liveExecutablePath)
    else { return false }
    return liveSha256 == package.executableSha256
  }

  static func waitForSingleAccessibilityWindow(
    application: NSRunningApplication,
    bundleIdentifier: String
  ) throws -> AXUIElement {
    guard AXIsProcessTrusted() else {
      throw TargetSessionReadinessInvalidation.accessibility(
        "Accessibility permission was not granted")
    }
    let applicationElement = AXUIElementCreateApplication(application.processIdentifier)
    for _ in 0..<400 {
      let applications = exactApplications(bundleIdentifier: bundleIdentifier)
      guard applications.count <= 1 else {
        throw TargetSessionReadinessInvalidation.processState(
          "multiple packaged candidates appeared during launch")
      }
      guard applications.first?.processIdentifier == application.processIdentifier else {
        throw TargetSessionReadinessInvalidation.processState(
          "the fresh packaged candidate exited or was replaced during launch")
      }
      guard let windows = try launchWindows(applicationElement) else {
        Thread.sleep(forTimeInterval: 0.05)
        continue
      }
      guard windows.count <= 1 else {
        throw TargetSessionReadinessInvalidation.accessibility(
          "multiple packaged candidate Accessibility windows appeared during launch")
      }
      if let window = windows.first { return window }
      Thread.sleep(forTimeInterval: 0.05)
    }
    throw TargetSessionReadinessInvalidation.accessibility(
      "the fresh packaged candidate did not expose one Accessibility window")
  }

  static func performReadinessActions(
    application: NSRunningApplication,
    window: AXUIElement,
    consoleSessionMatched: Bool,
    packageIdentityMatched: Bool
  ) throws -> TargetSessionActionReceipt {
    let activationSucceeded = application.activate(options: [.activateAllWindows])
    let raiseSucceeded =
      AXUIElementPerformAction(window, kAXRaiseAction as CFString) == .success
    let applicationElement = AXUIElementCreateApplication(application.processIdentifier)
    let frontmostWriteSucceeded =
      AXUIElementSetAttributeValue(
        applicationElement,
        kAXFrontmostAttribute as CFString,
        kCFBooleanTrue
      ) == .success
    return TargetSessionActionReceipt(
      consoleSessionMatched: consoleSessionMatched,
      packageIdentityMatched: packageIdentityMatched,
      launchSucceeded: true,
      activationSucceeded: activationSucceeded,
      raiseSucceeded: raiseSucceeded,
      frontmostWriteSucceeded: frontmostWriteSucceeded
    )
  }

  static func readinessSnapshot(
    bundleIdentifier: String,
    expectedExecutableSha256: String
  ) throws -> TargetSessionReadinessSnapshot {
    let applications = exactApplications(bundleIdentifier: bundleIdentifier)
    guard applications.count == 1, let application = applications.first else {
      return TargetSessionReadinessSnapshot(
        applicationCount: applications.count,
        windowCount: 0,
        processIdentifier: nil,
        windowIdentity: nil,
        executableIdentityMatched: false,
        applicationHidden: true,
        windowMinimized: true,
        windowFrameVisible: false,
        accessibilityFrontmost: false,
        workspaceFrontmost: false
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
    let minimized = window.flatMap { try? boolean($0, attribute: kAXMinimizedAttribute) } ?? true
    let frameVisible = window.flatMap { try? positiveFrame($0) } ?? false
    let frontmost = (try? boolean(applicationElement, attribute: kAXFrontmostAttribute)) ?? false
    return TargetSessionReadinessSnapshot(
      applicationCount: applications.count,
      windowCount: windows.count,
      processIdentifier: application.processIdentifier,
      windowIdentity: window.map(CFHash),
      executableIdentityMatched: executableIdentityMatched,
      applicationHidden: application.isHidden,
      windowMinimized: minimized,
      windowFrameVisible: frameVisible,
      accessibilityFrontmost: frontmost,
      workspaceFrontmost: NSWorkspace.shared.frontmostApplication?.processIdentifier
        == application.processIdentifier
    )
  }

  private static func positiveFrame(_ element: AXUIElement) throws -> Bool {
    guard let position: AXValue = try value(element, attribute: kAXPositionAttribute),
      let size: AXValue = try value(element, attribute: kAXSizeAttribute)
    else { return false }
    var point = CGPoint.zero
    var dimensions = CGSize.zero
    guard AXValueGetValue(position, .cgPoint, &point),
      AXValueGetValue(size, .cgSize, &dimensions)
    else { return false }
    return point.x.isFinite && point.y.isFinite && dimensions.width.isFinite
      && dimensions.height.isFinite && dimensions.width > 0 && dimensions.height > 0
  }

  private static func elements(_ element: AXUIElement, attribute: String) throws -> [AXUIElement] {
    (try value(element, attribute: attribute) as [AXUIElement]?) ?? []
  }

  private static func launchWindows(_ application: AXUIElement) throws -> [AXUIElement]? {
    var raw: CFTypeRef?
    let error = AXUIElementCopyAttributeValue(
      application,
      kAXWindowsAttribute as CFString,
      &raw
    )
    if error == .cannotComplete { return nil }
    if error == .noValue || error == .attributeUnsupported { return [] }
    guard error == .success else {
      throw TargetSessionReadinessInvalidation.accessibility(
        "the packaged candidate Accessibility windows could not be read")
    }
    guard let windows = raw as? [AXUIElement] else {
      throw TargetSessionReadinessInvalidation.accessibility(
        "the packaged candidate Accessibility windows had an invalid value")
    }
    return windows
  }

  private static func boolean(_ element: AXUIElement, attribute: String) throws -> Bool {
    guard let result: Bool = try value(element, attribute: attribute) else {
      throw TargetSessionReadinessInvalidation.accessibility(
        "a required Accessibility Boolean attribute was missing")
    }
    return result
  }

  private static func value<T>(_ element: AXUIElement, attribute: String) throws -> T? {
    var raw: CFTypeRef?
    let error = AXUIElementCopyAttributeValue(element, attribute as CFString, &raw)
    if error == .noValue || error == .attributeUnsupported { return nil }
    guard error == .success else {
      throw TargetSessionReadinessInvalidation.accessibility(
        "a required Accessibility attribute could not be read")
    }
    return raw as? T
  }

  private static func sysctlString(_ name: String) throws -> String {
    var size = 0
    guard sysctlbyname(name, nil, &size, nil, 0) == 0, size > 1 else {
      throw TargetSessionReadinessInvalidation.session(
        "the approved target-host identity could not be read")
    }
    var bytes = [CChar](repeating: 0, count: size)
    guard sysctlbyname(name, &bytes, &size, nil, 0) == 0 else {
      throw TargetSessionReadinessInvalidation.session(
        "the approved target-host identity could not be read")
    }
    return String(cString: bytes)
  }
}
