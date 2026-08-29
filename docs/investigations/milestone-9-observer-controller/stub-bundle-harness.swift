import AppKit
import Foundation

private let issueM9StubBundleIdentifier = "app.ttrpgmap.observer-cleanup-stub"

private struct IssueM9StubHarnessFailure: Error {}

@main
enum IssueM9ObserverCleanupStubHarness {
  @MainActor
  static func main() async throws {
    if Bundle.main.bundleIdentifier == issueM9StubBundleIdentifier {
      let application = NSApplication.shared
      application.setActivationPolicy(.prohibited)
      application.run()
      return
    }

    let fileManager = FileManager.default
    let root = fileManager.temporaryDirectory.appendingPathComponent(
      "ttrpg-map-observer-cleanup-stub-\(UUID().uuidString)",
      isDirectory: true
    )
    defer { try? fileManager.removeItem(at: root) }

    let applicationURL = root.appendingPathComponent("ObserverCleanupStub.app", isDirectory: true)
    let contentsURL = applicationURL.appendingPathComponent("Contents", isDirectory: true)
    let macOSURL = contentsURL.appendingPathComponent("MacOS", isDirectory: true)
    try fileManager.createDirectory(at: macOSURL, withIntermediateDirectories: true)

    let executableName = "ObserverCleanupStub"
    let executableURL = macOSURL.appendingPathComponent(executableName)
    let sourceExecutable = URL(fileURLWithPath: CommandLine.arguments[0]).resolvingSymlinksInPath()
    try fileManager.copyItem(at: sourceExecutable, to: executableURL)
    try fileManager.setAttributes([.posixPermissions: 0o755], ofItemAtPath: executableURL.path)

    let info: [String: Any] = [
      "CFBundleDevelopmentRegion": "en",
      "CFBundleExecutable": executableName,
      "CFBundleIdentifier": issueM9StubBundleIdentifier,
      "CFBundleInfoDictionaryVersion": "6.0",
      "CFBundleName": "Observer Cleanup Stub",
      "CFBundlePackageType": "APPL",
      "CFBundleSignature": "????",
      "CFBundleShortVersionString": "1.0",
      "CFBundleSupportedPlatforms": ["MacOSX"],
      "CFBundleVersion": "1",
      "LSMinimumSystemVersion": "26.0",
      "LSUIElement": true,
      "NSHighResolutionCapable": true,
      "NSPrincipalClass": "NSApplication",
    ]
    let infoData = try PropertyListSerialization.data(
      fromPropertyList: info,
      format: .xml,
      options: 0
    )
    try infoData.write(to: contentsURL.appendingPathComponent("Info.plist"), options: .atomic)

    let signer = Process()
    signer.executableURL = URL(fileURLWithPath: "/usr/bin/codesign")
    signer.arguments = ["--force", "--sign", "-", applicationURL.path]
    signer.standardOutput = Pipe()
    signer.standardError = Pipe()
    try signer.run()
    signer.waitUntilExit()
    guard signer.terminationReason == .exit, signer.terminationStatus == 0 else {
      throw IssueM9StubHarnessFailure()
    }

    let prepared = try Issue121CandidateIdentity.prepare(
      applicationPath: applicationURL.path,
      bundleIdentifier: issueM9StubBundleIdentifier,
      expectedExecutableSHA256: try Issue121CandidateIdentity.sha256(at: executableURL)
    )
    let wrapper = Issue122QualificationWrapper(candidate: prepared)
    let launched = try await wrapper.launchExactCandidate()
    guard wrapper.terminateAndCleanup(launched) else { throw IssueM9StubHarnessFailure() }
    guard
      NSRunningApplication.runningApplications(
        withBundleIdentifier: issueM9StubBundleIdentifier
      ).isEmpty
    else { throw IssueM9StubHarnessFailure() }
    guard !fileManager.fileExists(atPath: launched.endpoint.bootstrap.directoryPath) else {
      throw IssueM9StubHarnessFailure()
    }
    print("milestone-9 observer cleanup stub harness: passed")
  }
}
