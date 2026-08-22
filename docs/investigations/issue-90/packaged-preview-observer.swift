import AppKit
import ApplicationServices
import CoreMedia
import CoreVideo
import Foundation
import ScreenCaptureKit

let observerSchemaVersion = "packaged-preview-observer-v2"
let targetModel = "Mac17,2"
let targetOSVersion = "26.5.1"
let targetOSBuild = "25F80"
let targetMemoryBytes: UInt64 = 24 * 1024 * 1024 * 1024
let previewLabel = "Disposable coarse atlas preview"
let initialCanvasLabel = "Accepted whole-world ink atlas"
let previewCaption = "DISPOSABLE COARSE PREVIEW — not accepted, saveable, or promotable."
let acceptFullTitle = "Accept full atlas"
let captureWidth = 512
let captureHeight = 256

@main
enum PackagedPreviewObserver {
  static func main() async {
    do {
      let arguments = try ObserverArguments(CommandLine.arguments)
      let receipt = try await qualify(arguments)
      try emit(receipt)
    } catch let invalidation as PreviewObserverInvalidation {
      try? emit(ObserverReceipt.invalid(invalidation))
    } catch {
      try? emit(
        ObserverReceipt.invalid(
          .capture("unexpected internal observer failure")
        )
      )
    }
  }

  @MainActor
  private static func qualify(_ arguments: ObserverArguments) async throws -> ObserverReceipt {
    try verifyTargetHost()
    let samplerPath = URL(fileURLWithPath: arguments.samplerPath).resolvingSymlinksInPath().path
    guard FileManager.default.isExecutableFile(atPath: samplerPath) else {
      throw PreviewObserverInvalidation.sampler("the precompiled RSS sampler was not executable")
    }
    let samplerSha256: String
    do {
      samplerSha256 = try ExecutableIdentityValidator.sha256(atPath: samplerPath)
    } catch {
      throw PreviewObserverInvalidation.sampler("the RSS sampler identity could not be read")
    }
    guard samplerSha256 == arguments.expectedSamplerSha256 else {
      throw PreviewObserverInvalidation.sampler("the RSS sampler identity did not match")
    }
    let rawSamplesPath = try QualificationFileValidator.freshRawSamplesPath(
      arguments.rawSamplesPath)
    guard CGPreflightScreenCaptureAccess() else {
      throw PreviewObserverInvalidation.capture(
        "Screen Recording permission was not granted")
    }
    let application = NSApplication.shared
    if application.activationPolicy() != .prohibited {
      _ = application.setActivationPolicy(.prohibited)
    }
    guard application.windows.isEmpty,
      NSWorkspace.shared.frontmostApplication?.processIdentifier
        != ProcessInfo.processInfo.processIdentifier
    else {
      throw PreviewObserverInvalidation.capture(
        "observer acquired a window or foreground ownership")
    }

    let target = try await captureTarget(bundleIdentifier: arguments.bundleIdentifier)
    let candidateExecutablePath = try executablePath(for: target.applicationPID)
    let candidateSha256: String
    do {
      candidateSha256 = try ExecutableIdentityValidator.sha256(
        atPath: candidateExecutablePath.path)
    } catch {
      throw PreviewObserverInvalidation.processRole(
        "the candidate executable identity could not be read")
    }
    guard candidateSha256 == arguments.expectedCandidateSha256 else {
      throw PreviewObserverInvalidation.processRole(
        "the candidate executable identity did not match")
    }
    let baselineMembership = try resolveProcesses(appPID: target.applicationPID)
    guard baselineMembership.coalition.bundleIdentifier == arguments.bundleIdentifier else {
      throw PreviewObserverInvalidation.launchctl("candidate bundle ID did not match its coalition")
    }

    let accessibility = AccessibilityObserver(applicationPID: target.applicationPID)
    let crop = try accessibility.prepareVisibleCanvas(windowFrame: target.window.frame)
    let sampler = try RSSSampler(
      executablePath: samplerPath,
      rawSamplesPath: rawSamplesPath,
      pids: baselineMembership.orderedPIDs
    )
    try sampler.start()
    defer { sampler.stopIfRunning() }
    try await Task.sleep(nanoseconds: 500_000_000)

    let foreground = try ForegroundMonitor(applicationPID: target.applicationPID)
    defer { foreground.stop() }
    let frameOutput = PreviewFrameOutput(foreground: foreground)
    let stream = try makeStream(window: target.window, crop: crop, output: frameOutput)
    defer { Task { try? await stream.stopCapture() } }
    try await stream.startCapture()
    try await waitForBaseline(frameOutput)

    guard foreground.isIntact else { throw PreviewObserverInvalidation.candidateNotFrontmost }
    let dispatchEpochMilliseconds = Date().timeIntervalSince1970 * 1_000
    let dispatchMach = mach_absolute_time()
    frameOutput.markDispatched(at: dispatchMach)
    try postPreviewDispatch(to: target.applicationPID)
    let qualifyingFrame = try await waitForQualifyingFrame(frameOutput)
    let accessibilityReceipt = try accessibility.finalReceipt()
    let completionEpochMilliseconds = Date().timeIntervalSince1970 * 1_000
    guard foreground.isIntact, accessibilityReceipt.frontmost else {
      throw PreviewObserverInvalidation.candidateNotFrontmost
    }

    let completionMembership = try resolveProcesses(appPID: target.applicationPID)
    try PreviewProcessResolver.revalidate(
      baseline: baselineMembership,
      completion: completionMembership
    )
    sampler.stop()
    let rss = try sampler.measurement(
      dispatchEpochMilliseconds: dispatchEpochMilliseconds,
      completionEpochMilliseconds: completionEpochMilliseconds
    )

    return ObserverReceipt(
      observerVersion: observerSchemaVersion,
      status: "valid",
      target: .approved,
      roleCounts: sanitizedRoleCounts(baselineMembership),
      visual: VisualReceipt(
        completePostDispatchFrame: true,
        changedCanvasCrop: qualifyingFrame.observation.hash != frameOutput.baseline?.hash,
        cropPixels: "512x256",
        foregroundIntact: foreground.isIntact,
        landPaletteBounded: boundedPalette(qualifyingFrame.observation.landLike),
        waterPaletteBounded: boundedPalette(qualifyingFrame.observation.waterLike)
      ),
      accessibility: accessibilityReceipt,
      executableIdentity: ExecutableIdentityReceipt(
        candidateSha256: candidateSha256,
        samplerSha256: samplerSha256
      ),
      membershipRevalidated: true,
      invalidAuthority: nil,
      invalidReason: nil,
      measurement: MeasurementReceipt(
        elapsedMilliseconds: completionEpochMilliseconds - dispatchEpochMilliseconds,
        baselineAggregateRSSBytes: rss.baselineAggregateRSSBytes,
        peakAdditionalRSSBytes: rss.peakAdditionalRSSBytes,
        sampleCount: rss.sampleCount,
        maximumSampleIntervalMilliseconds: rss.maximumSampleIntervalMilliseconds
      )
    )
  }

  private static func makeStream(
    window: SCWindow,
    crop: CGRect,
    output: PreviewFrameOutput
  ) throws -> SCStream {
    let filter = SCContentFilter(desktopIndependentWindow: window)
    let configuration = SCStreamConfiguration()
    configuration.sourceRect = crop
    configuration.width = captureWidth
    configuration.height = captureHeight
    configuration.minimumFrameInterval = CMTime(value: 1, timescale: 60)
    configuration.queueDepth = 3
    configuration.pixelFormat = kCVPixelFormatType_32BGRA
    configuration.showsCursor = false
    let stream = SCStream(filter: filter, configuration: configuration, delegate: output)
    try stream.addStreamOutput(output, type: .screen, sampleHandlerQueue: output.queue)
    return stream
  }

  private static func waitForBaseline(_ output: PreviewFrameOutput) async throws {
    for _ in 0..<500 {
      if output.baseline != nil { return }
      try await Task.sleep(nanoseconds: 10_000_000)
    }
    throw PreviewObserverInvalidation.capture(
      "no complete baseline frame arrived within five seconds")
  }

  private static func waitForQualifyingFrame(
    _ output: PreviewFrameOutput
  ) async throws -> QualifyingFrame {
    for _ in 0..<500 {
      if let frame = output.qualifyingFrame { return frame }
      if !output.foregroundIntact {
        throw PreviewObserverInvalidation.candidateNotFrontmost
      }
      try await Task.sleep(nanoseconds: 10_000_000)
    }
    throw PreviewObserverInvalidation.capture(
      "no complete changed post-dispatch frame satisfied the palette predicate"
    )
  }

  private static func postPreviewDispatch(to pid: pid_t) throws {
    guard let source = CGEventSource(stateID: .hidSystemState),
      let keyDown = CGEvent(keyboardEventSource: source, virtualKey: 35, keyDown: true),
      let keyUp = CGEvent(keyboardEventSource: source, virtualKey: 35, keyDown: false)
    else {
      throw PreviewObserverInvalidation.dispatch("could not create the test-only keyboard dispatch")
    }
    let flags: CGEventFlags = [.maskCommand, .maskAlternate, .maskControl]
    keyDown.flags = flags
    keyUp.flags = flags
    keyDown.postToPid(pid)
    keyUp.postToPid(pid)
  }

  private static func captureTarget(bundleIdentifier: String) async throws -> CaptureTarget {
    let content = try await SCShareableContent.current
    let windows = content.windows.filter {
      $0.owningApplication?.bundleIdentifier == bundleIdentifier && $0.isOnScreen
        && $0.windowLayer == 0
    }
    guard windows.count == 1, let window = windows.first,
      let applicationPID = window.owningApplication?.processID
    else {
      throw PreviewObserverInvalidation.capture(
        "expected exactly one on-screen layer-zero candidate window")
    }
    return CaptureTarget(applicationPID: applicationPID, window: window)
  }

  private static func resolveProcesses(appPID: pid_t) throws -> ResolvedPreviewProcesses {
    let appReceipt = try launchctlReceipt(for: appPID)
    let roles = try PreviewProcessResolver.serviceRoles(from: appReceipt)
    try PreviewProcessResolver.requireLiveRoles(roles) { kill($0, 0) == 0 }
    var helperReceipts: [PreviewProcessRole: LaunchctlPIDReceipt] = [:]
    var executableNames: [PreviewProcessRole: String] = [:]
    for role in PreviewProcessRole.allCases {
      guard let pid = roles[role] else { throw PreviewObserverInvalidation.processExited(role) }
      executableNames[role] = try executablePath(for: pid).lastPathComponent
      if role != .application {
        helperReceipts[role] = try launchctlReceipt(for: pid)
      }
    }
    return try PreviewProcessResolver.validate(
      appReceipt: appReceipt,
      helperReceipts: helperReceipts,
      executableNames: executableNames
    )
  }

  private static func launchctlReceipt(for pid: pid_t) throws -> LaunchctlPIDReceipt {
    let result = try runProcess("/bin/launchctl", arguments: ["print", "pid/\(pid)"])
    guard result.status == 0 else {
      throw PreviewObserverInvalidation.launchctl(
        "launchctl could not resolve a required PID domain")
    }
    return try LaunchctlReceiptParser.parse(result.standardOutput, expectedPID: pid)
  }

  private static func executablePath(for pid: pid_t) throws -> URL {
    var buffer = [CChar](repeating: 0, count: 4_096)
    let length = proc_pidpath(pid, &buffer, UInt32(buffer.count))
    guard length > 0 else {
      throw PreviewObserverInvalidation.processRole(
        "a coalition member's executable was unresolvable")
    }
    return URL(fileURLWithPath: String(cString: buffer)).resolvingSymlinksInPath()
  }

  private static func verifyTargetHost() throws {
    let model = try sysctlString("hw.model")
    let productVersion = try runProcess("/usr/bin/sw_vers", arguments: ["-productVersion"])
    let buildVersion = try runProcess("/usr/bin/sw_vers", arguments: ["-buildVersion"])
    guard model == targetModel,
      productVersion.status == 0,
      productVersion.standardOutput.trimmingCharacters(in: .whitespacesAndNewlines)
        == targetOSVersion,
      buildVersion.status == 0,
      buildVersion.standardOutput.trimmingCharacters(in: .whitespacesAndNewlines) == targetOSBuild,
      ProcessInfo.processInfo.physicalMemory == targetMemoryBytes
    else {
      throw PreviewObserverInvalidation.host(
        "host, OS build, or physical memory did not match the approved baseline")
    }
  }

  private static func sysctlString(_ name: String) throws -> String {
    var size = 0
    guard sysctlbyname(name, nil, &size, nil, 0) == 0, size > 1 else {
      throw PreviewObserverInvalidation.host("could not inspect the target hardware model")
    }
    var bytes = [CChar](repeating: 0, count: size)
    guard sysctlbyname(name, &bytes, &size, nil, 0) == 0 else {
      throw PreviewObserverInvalidation.host("could not inspect the target hardware model")
    }
    return String(cString: bytes)
  }

  private static func sanitizedRoleCounts(
    _ processes: ResolvedPreviewProcesses
  ) -> [String: Int] {
    Dictionary(
      uniqueKeysWithValues: PreviewProcessRole.allCases.map { role in
        (role.rawValue, processes.pidsByRole[role] == nil ? 0 : 1)
      })
  }

  private static func boundedPalette(_ population: Int) -> Bool {
    population >= PreviewFramePredicate.minimumPalettePopulation
      && population <= PreviewFramePredicate.maximumPalettePopulation
  }

  private static func emit(_ receipt: ObserverReceipt) throws {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    let data = try encoder.encode(receipt)
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0A]))
  }
}

private struct ObserverArguments {
  let bundleIdentifier: String
  let expectedCandidateSha256: String
  let samplerPath: String
  let expectedSamplerSha256: String
  let rawSamplesPath: String

  init(_ arguments: [String]) throws {
    guard arguments.count == 6 else { throw PreviewObserverInvalidation.usage }
    bundleIdentifier = arguments[1]
    expectedCandidateSha256 = arguments[2]
    samplerPath = arguments[3]
    expectedSamplerSha256 = arguments[4]
    rawSamplesPath = arguments[5]
    guard bundleIdentifier == "app.ttrpgmap.generator",
      ExecutableIdentityValidator.isDigest(expectedCandidateSha256),
      ExecutableIdentityValidator.isDigest(expectedSamplerSha256)
    else {
      throw PreviewObserverInvalidation.usage
    }
  }
}

private struct CaptureTarget {
  let applicationPID: pid_t
  let window: SCWindow
}
