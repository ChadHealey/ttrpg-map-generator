import AppKit
import ApplicationServices
import CoreMedia
import CoreVideo
import Foundation
import ScreenCaptureKit

// Keep the audited dispatch -> frame -> Accessibility completion order contiguous here. Predicate,
// platform, receipt, parser, RSS, security, and retention responsibilities remain split by owner.
let observerSchemaVersion = "packaged-preview-observer-v2"
let fullAtlasObserverSchemaVersion = "packaged-full-atlas-observer-v1"
let targetModel = "Mac17,2"
let targetOSVersion = "26.5.1"
let targetOSBuild = "25F80"
let targetMemoryBytes: UInt64 = 24 * 1024 * 1024 * 1024
let previewLabel = "Disposable coarse atlas preview"
let initialCanvasLabel = "Accepted whole-world ink atlas"
let acceptedAtlasLabel = initialCanvasLabel
let previewCaption = "DISPOSABLE COARSE PREVIEW — not accepted, saveable, or promotable."
let acceptedAtlasCaption = "Accepted atlas — canonical PlanetPoints mapped through one RenderScene."
let acceptFullTitle = "Accept full atlas"
let captureWidth = 512
let captureHeight = 256
let fullAtlasCaptureWidth = 512
let fullAtlasCaptureHeight = 256

@main
enum PackagedAtlasObserver {
  static func main() async {
    do {
      let arguments = try FullAtlasObserverArguments(CommandLine.arguments)
      let receipt = try await qualify(arguments)
      try emit(receipt)
    } catch let invalidation as PreviewObserverInvalidation {
      try? emit(FullAtlasObserverReceipt.invalid(invalidation))
    } catch {
      try? emit(
        FullAtlasObserverReceipt.invalid(
          .capture("unexpected internal full-atlas observer failure")
        )
      )
    }
  }

  @MainActor
  private static func qualify(_ arguments: FullAtlasObserverArguments) async throws
    -> FullAtlasObserverReceipt
  {
    try verifyTargetHost()
    let fixturePath = try arguments.validatedFixtureDefinitionPath()
    let fixtureData: Data
    do { fixtureData = try Data(contentsOf: URL(fileURLWithPath: fixturePath)) } catch {
      throw PreviewObserverInvalidation.fixture(
        "the registered fixture definition could not be read")
    }
    let fixtureDefinition = try AtlasFixtureDefinitionParser.parse(
      fixtureData,
      expectedFixture: arguments.fixtureId
    )
    let fixtureDefinitionSha256: String
    do {
      fixtureDefinitionSha256 = try ExecutableIdentityValidator.sha256(atPath: fixturePath)
    } catch {
      throw PreviewObserverInvalidation.fixture(
        "the registered fixture definition identity could not be read")
    }

    let samplerPath = URL(fileURLWithPath: arguments.samplerPath).resolvingSymlinksInPath().path
    guard FileManager.default.isExecutableFile(atPath: samplerPath) else {
      throw PreviewObserverInvalidation.sampler("the precompiled RSS sampler was not executable")
    }
    let samplerSha256: String
    do { samplerSha256 = try ExecutableIdentityValidator.sha256(atPath: samplerPath) } catch {
      throw PreviewObserverInvalidation.sampler("the RSS sampler identity could not be read")
    }
    guard samplerSha256 == arguments.expectedSamplerSha256 else {
      throw PreviewObserverInvalidation.sampler("the RSS sampler identity did not match")
    }
    let rawSamplesPath = try QualificationFileValidator.freshRawSamplesPath(
      arguments.rawSamplesPath)
    guard CGPreflightScreenCaptureAccess() else {
      throw PreviewObserverInvalidation.capture("Screen Recording permission was not granted")
    }
    let observerApplication = NSApplication.shared
    if observerApplication.activationPolicy() != .prohibited {
      _ = observerApplication.setActivationPolicy(.prohibited)
    }
    guard observerApplication.windows.isEmpty,
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
    let initialMembership = try resolveProcesses(appPID: target.applicationPID)
    guard initialMembership.coalition.bundleIdentifier == arguments.bundleIdentifier else {
      throw PreviewObserverInvalidation.launchctl("candidate bundle ID did not match its coalition")
    }

    let accessibility = AccessibilityObserver(applicationPID: target.applicationPID)
    let crop = try accessibility.prepareVisibleCanvas(windowFrame: target.window.frame)
    let foreground = try ForegroundMonitor(applicationPID: target.applicationPID)
    defer { foreground.stop() }

    let previewOutput = PreviewFrameOutput(foreground: foreground)
    let previewStream = try makePreviewStream(
      window: target.window,
      crop: crop,
      output: previewOutput
    )
    try await previewStream.startCapture()
    try await waitForPreviewBaseline(previewOutput)
    try postObserverDispatch(
      keyCode: arguments.fixtureId.dispatchKeyCode,
      to: target.applicationPID
    )
    let configuredReceipt = try await waitForFixtureReceipt(
      accessibility,
      definition: fixtureDefinition,
      phase: .configured
    )
    guard foreground.isIntact else { throw PreviewObserverInvalidation.candidateNotFrontmost }

    let previewDispatchMach = mach_absolute_time()
    previewOutput.markDispatched(at: previewDispatchMach)
    try postObserverDispatch(keyCode: 35, to: target.applicationPID)
    _ = try await waitForPreviewFrame(previewOutput)
    _ = try accessibility.finalReceipt()
    _ = try await waitForFixtureReceipt(
      accessibility,
      definition: fixtureDefinition,
      phase: .preview
    )
    try await previewStream.stopCapture()

    let baselineMembership = try resolveProcesses(appPID: target.applicationPID)
    try PreviewProcessResolver.revalidate(
      baseline: initialMembership,
      completion: baselineMembership
    )
    let sampler = try RSSSampler(
      executablePath: samplerPath,
      rawSamplesPath: rawSamplesPath,
      pids: baselineMembership.orderedPIDs
    )
    try sampler.start()
    defer { sampler.stopIfRunning() }
    try await Task.sleep(nanoseconds: 500_000_000)

    let fullOutput = AcceptedAtlasFrameOutput(foreground: foreground)
    let fullStream = try makeFullStream(window: target.window, crop: crop, output: fullOutput)
    defer { Task { try? await fullStream.stopCapture() } }
    try await fullStream.startCapture()
    try await waitForFullBaseline(fullOutput)

    guard foreground.isIntact else { throw PreviewObserverInvalidation.candidateNotFrontmost }
    let dispatchEpochMilliseconds = Date().timeIntervalSince1970 * 1_000
    let dispatchMach = mach_absolute_time()
    fullOutput.markDispatched(at: dispatchMach)
    try postObserverDispatch(keyCode: 3, to: target.applicationPID)
    let qualifyingFrame = try await waitForAcceptedAtlasFrame(fullOutput)
    let accessibilityReceipt = try await waitForAcceptedAtlasReceipt(
      accessibility,
      definition: fixtureDefinition
    )
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

    return FullAtlasObserverReceipt(
      observerVersion: fullAtlasObserverSchemaVersion,
      status: "valid",
      target: .approved,
      fixture: FixtureAuthorityReceipt(
        fixtureId: configuredReceipt.fixtureId,
        fixtureDefinitionSha256: fixtureDefinitionSha256,
        worldSeed: configuredReceipt.worldSeed,
        controls: configuredReceipt.controls,
        configuredBeforeMeasuredDispatch: true
      ),
      roleCounts: sanitizedRoleCounts(baselineMembership),
      visual: AcceptedAtlasVisualReceipt(
        completePostDispatchFrame: true,
        changedCanvasCrop: qualifyingFrame.observation.hash != fullOutput.baselineHash,
        cropPixels: "512x256",
        foregroundIntact: foreground.isIntact,
        acceptedLandPalettePresent:
          qualifyingFrame.observation.landLike
          >= AcceptedAtlasFramePredicate.minimumLandOrWaterPopulation,
        acceptedWaterPalettePresent:
          qualifyingFrame.observation.waterLike
          >= AcceptedAtlasFramePredicate.minimumLandOrWaterPopulation,
        acceptedInkPalettePresent:
          qualifyingFrame.observation.inkLike >= AcceptedAtlasFramePredicate.minimumInkPopulation,
        disposablePreviewPaletteRejected:
          qualifyingFrame.observation.previewLandLike
          <= AcceptedAtlasFramePredicate.maximumPreviewPopulation
          && qualifyingFrame.observation.previewWaterLike
            <= AcceptedAtlasFramePredicate.maximumPreviewPopulation
      ),
      accessibility: accessibilityReceipt,
      executableIdentity: ExecutableIdentityReceipt(
        candidateSha256: candidateSha256,
        samplerSha256: samplerSha256
      ),
      membershipRevalidated: true,
      dispatchBoundary: "production-accept-full-key-dispatch",
      completionBoundary: "accepted-atlas-frame-then-final-accessibility-receipt",
      postDispatchAccessibilityReceiptCount: 1,
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

  private static func makePreviewStream(
    window: SCWindow,
    crop: CGRect,
    output: PreviewFrameOutput
  ) throws -> SCStream {
    try makeStream(window: window, crop: crop, output: output, queue: output.queue)
  }

  private static func makeFullStream(
    window: SCWindow,
    crop: CGRect,
    output: AcceptedAtlasFrameOutput
  ) throws -> SCStream {
    try makeStream(window: window, crop: crop, output: output, queue: output.queue)
  }

  private static func makeStream(
    window: SCWindow,
    crop: CGRect,
    output: any SCStreamOutput,
    queue: DispatchQueue
  ) throws -> SCStream {
    let configuration = SCStreamConfiguration()
    configuration.sourceRect = crop
    configuration.width = fullAtlasCaptureWidth
    configuration.height = fullAtlasCaptureHeight
    configuration.minimumFrameInterval = CMTime(value: 1, timescale: 60)
    configuration.queueDepth = 3
    configuration.pixelFormat = kCVPixelFormatType_32BGRA
    configuration.showsCursor = false
    let stream = SCStream(
      filter: SCContentFilter(desktopIndependentWindow: window),
      configuration: configuration,
      delegate: nil
    )
    try stream.addStreamOutput(output, type: .screen, sampleHandlerQueue: queue)
    return stream
  }

  private static func waitForPreviewBaseline(_ output: PreviewFrameOutput) async throws {
    for _ in 0..<500 {
      if output.baseline != nil { return }
      try await Task.sleep(nanoseconds: 10_000_000)
    }
    throw PreviewObserverInvalidation.capture(
      "no complete baseline frame arrived before preview dispatch")
  }

  private static func waitForPreviewFrame(_ output: PreviewFrameOutput) async throws
    -> QualifyingFrame
  {
    for _ in 0..<500 {
      if let frame = output.qualifyingFrame { return frame }
      if !output.foregroundIntact { throw PreviewObserverInvalidation.candidateNotFrontmost }
      try await Task.sleep(nanoseconds: 10_000_000)
    }
    throw PreviewObserverInvalidation.capture(
      "the production preview prerequisite did not reach its qualified frame")
  }

  private static func waitForFullBaseline(_ output: AcceptedAtlasFrameOutput) async throws {
    for _ in 0..<500 {
      if output.baselineHash != nil { return }
      try await Task.sleep(nanoseconds: 10_000_000)
    }
    throw PreviewObserverInvalidation.capture(
      "no complete disposable-preview baseline frame arrived before full dispatch")
  }

  private static func waitForAcceptedAtlasFrame(_ output: AcceptedAtlasFrameOutput) async throws
    -> AcceptedAtlasQualifyingFrame
  {
    for _ in 0..<1_500 {
      if let frame = output.qualifyingFrame { return frame }
      if !output.foregroundIntact { throw PreviewObserverInvalidation.candidateNotFrontmost }
      try await Task.sleep(nanoseconds: 10_000_000)
    }
    throw PreviewObserverInvalidation.capture(
      "no complete changed post-dispatch frame satisfied the accepted-atlas predicate")
  }

  private static func waitForFixtureReceipt(
    _ accessibility: AccessibilityObserver,
    definition: GatedAtlasFixtureDefinition,
    phase: PackagedAtlasObserverPhase
  ) async throws -> PackagedAtlasFixtureReceipt {
    for _ in 0..<200 {
      if let receipt = try? accessibility.packagedFixtureReceipt(
        expectedDefinition: definition,
        expectedPhase: phase
      ) { return receipt }
      try await Task.sleep(nanoseconds: 10_000_000)
    }
    throw PreviewObserverInvalidation.fixture(
      "the exact packaged fixture receipt did not appear before measured dispatch")
  }

  private static func waitForAcceptedAtlasReceipt(
    _ accessibility: AccessibilityObserver,
    definition: GatedAtlasFixtureDefinition
  ) async throws -> AcceptedAtlasAccessibilityReceipt {
    for _ in 0..<200 {
      if let receipt = try? accessibility.acceptedAtlasReceipt(expectedDefinition: definition) {
        return receipt
      }
      try await Task.sleep(nanoseconds: 10_000_000)
    }
    throw PreviewObserverInvalidation.accessibility(
      "the final accepted-atlas Accessibility receipt did not become complete")
  }

  private static func postObserverDispatch(keyCode: UInt16, to pid: pid_t) throws {
    guard let source = CGEventSource(stateID: .hidSystemState),
      let keyDown = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: true),
      let keyUp = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: false)
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
      if role != .application { helperReceipts[role] = try launchctlReceipt(for: pid) }
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
    guard model == targetModel, productVersion.status == 0,
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

  private static func emit(_ receipt: FullAtlasObserverReceipt) throws {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    let data = try encoder.encode(receipt)
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0A]))
  }
}

private struct FullAtlasObserverArguments {
  let bundleIdentifier: String
  let fixtureId: GatedAtlasFixtureID
  let fixtureDefinitionPath: String
  let expectedCandidateSha256: String
  let samplerPath: String
  let expectedSamplerSha256: String
  let rawSamplesPath: String

  init(_ arguments: [String]) throws {
    guard arguments.count == 8,
      arguments[1] == "app.ttrpgmap.generator",
      let fixtureId = GatedAtlasFixtureID(rawValue: arguments[2]),
      ExecutableIdentityValidator.isDigest(arguments[4]),
      ExecutableIdentityValidator.isDigest(arguments[6])
    else { throw PreviewObserverInvalidation.usage }
    bundleIdentifier = arguments[1]
    self.fixtureId = fixtureId
    fixtureDefinitionPath = arguments[3]
    expectedCandidateSha256 = arguments[4]
    samplerPath = arguments[5]
    expectedSamplerSha256 = arguments[6]
    rawSamplesPath = arguments[7]
  }

  func validatedFixtureDefinitionPath() throws -> String {
    let url = URL(fileURLWithPath: fixtureDefinitionPath).resolvingSymlinksInPath()
    let suffix = "/fixtures/fixed-seeds/\(fixtureId.rawValue)/fixture-definition.json"
    guard url.path.hasSuffix(suffix),
      FileManager.default.fileExists(atPath: url.path)
    else {
      throw PreviewObserverInvalidation.fixture(
        "the fixture path was not the registered definition for the requested gated fixture")
    }
    return url.path
  }
}

private struct CaptureTarget {
  let applicationPID: pid_t
  let window: SCWindow
}
