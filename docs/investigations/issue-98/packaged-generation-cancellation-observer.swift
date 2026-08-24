import AppKit
import ApplicationServices
import CoreMedia
import CoreVideo
import Darwin
import Foundation
import ScreenCaptureKit

let observerSchemaVersion = "packaged-preview-observer-v2"
let exactFixturePreviewObserverSchemaVersion = "packaged-exact-preview-observer-v1"
let fullAtlasObserverSchemaVersion = "packaged-full-atlas-observer-v1"
let generationCancellationObserverSchemaVersion =
  "packaged-generation-cancellation-host-observer-v1"
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
let cancellationCaptureWidth = 512
let cancellationCaptureHeight = 256

@main
enum PackagedGenerationCancellationObserver {
  static func main() async {
    do {
      let arguments = try Arguments(CommandLine.arguments)
      try emit(try await qualify(arguments))
    } catch let invalidation as PreviewObserverInvalidation {
      try? emit(GenerationCancellationObserverReceipt.invalid(invalidation))
    } catch {
      try? emit(
        GenerationCancellationObserverReceipt.invalid(
          .capture("unexpected internal generation-cancellation observer failure")
        )
      )
    }
  }

  @MainActor
  private static func qualify(_ arguments: Arguments) async throws
    -> GenerationCancellationObserverReceipt
  {
    try verifyTargetHost()
    let fixturePath = try arguments.validatedFixtureDefinitionPath()
    let fixtureData: Data
    do { fixtureData = try Data(contentsOf: URL(fileURLWithPath: fixturePath)) } catch {
      throw PreviewObserverInvalidation.fixture("the registered fixture definition could not be read")
    }
    let definition = try AtlasFixtureDefinitionParser.parse(
      fixtureData,
      expectedFixture: arguments.fixtureId
    )
    let fixtureDefinitionSha256 = try ExecutableIdentityValidator.sha256(atPath: fixturePath)
    let samplerPath = URL(fileURLWithPath: arguments.samplerPath).resolvingSymlinksInPath().path
    guard FileManager.default.isExecutableFile(atPath: samplerPath) else {
      throw PreviewObserverInvalidation.sampler("the precompiled RSS sampler was not executable")
    }
    let samplerSha256 = try ExecutableIdentityValidator.sha256(atPath: samplerPath)
    guard samplerSha256 == arguments.expectedSamplerSha256 else {
      throw PreviewObserverInvalidation.sampler("the RSS sampler identity did not match")
    }
    let rawSamplesPath = try QualificationFileValidator.freshRawSamplesPath(arguments.rawSamplesPath)
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
    else { throw PreviewObserverInvalidation.capture("observer acquired foreground ownership") }

    let target = try await captureTarget(bundleIdentifier: arguments.bundleIdentifier)
    let candidateExecutablePath = try executablePath(for: target.applicationPID)
    let candidateSha256 = try ExecutableIdentityValidator.sha256(
      atPath: candidateExecutablePath.path
    )
    guard candidateSha256 == arguments.expectedCandidateSha256 else {
      throw PreviewObserverInvalidation.processRole("the candidate executable identity did not match")
    }
    let initialMembership = try resolveProcesses(appPID: target.applicationPID)
    guard initialMembership.coalition.bundleIdentifier == arguments.bundleIdentifier else {
      throw PreviewObserverInvalidation.launchctl("candidate bundle ID did not match its coalition")
    }
    let accessibility = AccessibilityObserver(applicationPID: target.applicationPID)
    let crop = try accessibility.prepareVisibleCanvas(windowFrame: target.window.frame)
    let foreground = try ForegroundMonitor(applicationPID: target.applicationPID)
    defer { foreground.stop() }

    let setupOutput = PreviewFrameOutput(foreground: foreground)
    let setupStream = try makeStream(
      window: target.window,
      crop: crop,
      output: setupOutput,
      queue: setupOutput.queue
    )
    try await setupStream.startCapture()
    try await waitForPreviewBaseline(setupOutput)
    try postObserverDispatch(keyCode: arguments.fixtureId.dispatchKeyCode, to: target.applicationPID)
    _ = try await waitForFixtureReceipt(accessibility, definition: definition, phase: .configured)
    if arguments.operation == .full {
      setupOutput.markDispatched(at: mach_absolute_time())
      try postObserverDispatch(keyCode: 35, to: target.applicationPID)
      _ = try await waitForPreviewFrame(setupOutput)
      _ = try accessibility.finalReceipt()
      _ = try await waitForFixtureReceipt(accessibility, definition: definition, phase: .preview)
    }
    try await setupStream.stopCapture()
    guard foreground.isIntact else { throw PreviewObserverInvalidation.candidateNotFrontmost }

    let expectedPhase: PackagedAtlasObserverPhase = arguments.operation == .preview
      ? .configured : .preview
    let readback = try accessibility.packagedFixtureReceipt(
      expectedDefinition: definition,
      expectedPhase: expectedPhase
    )
    let baselineMembership = try resolveProcesses(appPID: target.applicationPID)
    try PreviewProcessResolver.revalidate(baseline: initialMembership, completion: baselineMembership)
    let sampler = try RSSSampler(
      executablePath: samplerPath,
      rawSamplesPath: rawSamplesPath,
      pids: baselineMembership.orderedPIDs
    )
    try sampler.start()
    defer { sampler.stopIfRunning() }
    try await Task.sleep(nanoseconds: 500_000_000)

    let cancellationOutput = CancellationQuiescenceFrameOutput(foreground: foreground)
    let cancellationStream = try makeStream(
      window: target.window,
      crop: crop,
      output: cancellationOutput,
      queue: cancellationOutput.queue
    )
    try await cancellationStream.startCapture()
    try await waitForCancellationBaseline(cancellationOutput)
    guard foreground.isIntact else { throw PreviewObserverInvalidation.candidateNotFrontmost }
    try postObserverDispatch(keyCode: arguments.trialKeyCode, to: target.applicationPID)
    let cancelled = try await waitForCancellationReceipt(
      accessibility,
      definition: definition,
      operation: arguments.operation,
      safePoint: arguments.safePoint,
      status: "cancelled"
    )
    cancellationOutput.markAcknowledged(at: mach_absolute_time())
    sampler.stop()
    guard let dispatchEpoch = cancelled.cancellationDispatchEpochMilliseconds,
      let acknowledgementEpoch = cancelled.terminalAcknowledgementEpochMilliseconds
    else { throw PreviewObserverInvalidation.accessibility("cancellation timing was absent") }
    let rss = try sampler.measurement(
      dispatchEpochMilliseconds: dispatchEpoch,
      completionEpochMilliseconds: acknowledgementEpoch
    )
    try await Task.sleep(nanoseconds: 1_000_000_000)
    guard cancellationOutput.framesAfterAcknowledgement > 0,
      !cancellationOutput.changedAfterAcknowledgement,
      cancellationOutput.foregroundIntact,
      try accessibility.cancellationPresentationState(
        operation: arguments.operation,
        definition: definition
      )
    else {
      throw PreviewObserverInvalidation.capture(
        "post-acknowledgement presentation, state, or foreground changed"
      )
    }
    _ = try accessibility.generationCancellationReceipt(
      definition: definition,
      operation: arguments.operation,
      safePoint: arguments.safePoint,
      status: "cancelled"
    )
    let cancellationMembership = try resolveProcesses(appPID: target.applicationPID)
    try PreviewProcessResolver.revalidate(
      baseline: baselineMembership,
      completion: cancellationMembership
    )
    try await cancellationStream.stopCapture()

    let aftermathOutput = AcceptedAtlasFrameOutput(foreground: foreground)
    let aftermathStream = try makeStream(
      window: target.window,
      crop: crop,
      output: aftermathOutput,
      queue: aftermathOutput.queue
    )
    try await aftermathStream.startCapture()
    try await waitForFullBaseline(aftermathOutput)
    aftermathOutput.markDispatched(at: mach_absolute_time())
    try postObserverDispatch(keyCode: 5, to: target.applicationPID)
    let acceptedFrame = try await waitForAcceptedAtlasFrame(aftermathOutput)
    let acceptedAccessibility = try await waitForAcceptedAtlasReceipt(
      accessibility,
      definition: definition
    )
    let aftermath = try await waitForCancellationReceipt(
      accessibility,
      definition: definition,
      operation: arguments.operation,
      safePoint: arguments.safePoint,
      status: "aftermath-complete"
    )
    guard foreground.isIntact, acceptedAccessibility.frontmost,
      let canonical = aftermath.nextCompletion
    else { throw PreviewObserverInvalidation.candidateNotFrontmost }
    let completionMembership = try resolveProcesses(appPID: target.applicationPID)
    try PreviewProcessResolver.revalidate(
      baseline: baselineMembership,
      completion: completionMembership
    )
    try await aftermathStream.stopCapture()

    return GenerationCancellationObserverReceipt(
      observerVersion: generationCancellationObserverSchemaVersion,
      status: "valid",
      target: .approved,
      fixture: ExactFixturePreviewAuthorityReceipt(
        fixtureId: readback.fixtureId,
        fixtureDefinitionSha256: fixtureDefinitionSha256,
        worldSeed: readback.worldSeed,
        controls: readback.controls,
        readbackImmediatelyBeforeMeasuredDispatch: true
      ),
      trial: GenerationCancellationTrialReceipt(
        operation: arguments.operation.rawValue,
        safePoint: arguments.safePoint.rawValue,
        targetCompletedWork: arguments.safePoint.targetCompletedWork,
        observedStage: cancelled.observedSafePoint!.stage,
        observedCompletedWork: cancelled.observedSafePoint!.completedWork,
        acknowledgementLimitMilliseconds:
          arguments.operation.acknowledgementLimitMilliseconds,
        acknowledgementMilliseconds: cancelled.acknowledgementMilliseconds!,
        progressSampleCount: cancelled.progressSamples.count,
        progressMonotonic: true,
        costlySchedulingStopped: true,
        previousStatePreserved: true,
        noAcceptedCommitAtAcknowledgement: true,
        noLatePresentationOrCommit: true,
        quietWindowMilliseconds: 1_000,
        nextCompletionCanonicallyDeterministic: true,
        canonicalAspectSetSha256: canonical.canonicalAspectSetSha256,
        canonicalOutputSetSha256: canonical.canonicalOutputSetSha256,
        canonicalCoastlineOutputSha256: canonical.canonicalCoastlineOutputSha256
      ),
      roleCounts: sanitizedRoleCounts(baselineMembership),
      visual: GenerationCancellationVisualReceipt(
        cancellationBaselineRetained: true,
        postAcknowledgementFrameCount: cancellationOutput.framesAfterAcknowledgement,
        acceptedAftermathFrameQualified:
          acceptedFrame.observation.hash != aftermathOutput.baselineHash,
        acceptedAccessibilityQualified: true,
        foregroundUninterrupted: foreground.isIntact
      ),
      executableIdentity: ExecutableIdentityReceipt(
        candidateSha256: candidateSha256,
        samplerSha256: samplerSha256
      ),
      membershipRevalidated: true,
      measurement: MeasurementReceipt(
        elapsedMilliseconds: acknowledgementEpoch - dispatchEpoch,
        baselineAggregateRSSBytes: rss.baselineAggregateRSSBytes,
        peakAdditionalRSSBytes: rss.peakAdditionalRSSBytes,
        sampleCount: rss.sampleCount,
        maximumSampleIntervalMilliseconds: rss.maximumSampleIntervalMilliseconds
      ),
      invalidAuthority: nil,
      invalidReason: nil
    )
  }

  private static func makeStream(
    window: SCWindow,
    crop: CGRect,
    output: any SCStreamOutput,
    queue: DispatchQueue
  ) throws -> SCStream {
    let configuration = SCStreamConfiguration()
    configuration.sourceRect = crop
    configuration.width = cancellationCaptureWidth
    configuration.height = cancellationCaptureHeight
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
    throw PreviewObserverInvalidation.capture("no complete setup baseline frame arrived")
  }

  private static func waitForPreviewFrame(_ output: PreviewFrameOutput) async throws
    -> QualifyingFrame
  {
    for _ in 0..<1_000 {
      if let frame = output.qualifyingFrame { return frame }
      if !output.foregroundIntact { throw PreviewObserverInvalidation.candidateNotFrontmost }
      try await Task.sleep(nanoseconds: 10_000_000)
    }
    throw PreviewObserverInvalidation.capture("the exact preview setup did not qualify")
  }

  private static func waitForCancellationBaseline(
    _ output: CancellationQuiescenceFrameOutput
  ) async throws {
    for _ in 0..<500 {
      if output.baselineHash != nil { return }
      try await Task.sleep(nanoseconds: 10_000_000)
    }
    throw PreviewObserverInvalidation.capture("no cancellation baseline frame arrived")
  }

  private static func waitForFullBaseline(_ output: AcceptedAtlasFrameOutput) async throws {
    for _ in 0..<500 {
      if output.baselineHash != nil { return }
      try await Task.sleep(nanoseconds: 10_000_000)
    }
    throw PreviewObserverInvalidation.capture("no deterministic-aftermath baseline frame arrived")
  }

  private static func waitForAcceptedAtlasFrame(_ output: AcceptedAtlasFrameOutput) async throws
    -> AcceptedAtlasQualifyingFrame
  {
    for _ in 0..<2_000 {
      if let frame = output.qualifyingFrame { return frame }
      if !output.foregroundIntact { throw PreviewObserverInvalidation.candidateNotFrontmost }
      try await Task.sleep(nanoseconds: 10_000_000)
    }
    throw PreviewObserverInvalidation.capture("the deterministic accepted aftermath did not qualify")
  }

  private static func waitForFixtureReceipt(
    _ accessibility: AccessibilityObserver,
    definition: GatedAtlasFixtureDefinition,
    phase: PackagedAtlasObserverPhase
  ) async throws -> PackagedAtlasFixtureReceipt {
    for _ in 0..<300 {
      if let receipt = try? accessibility.packagedFixtureReceipt(
        expectedDefinition: definition,
        expectedPhase: phase
      ) { return receipt }
      try await Task.sleep(nanoseconds: 10_000_000)
    }
    throw PreviewObserverInvalidation.fixture("the exact fixture receipt did not appear")
  }

  private static func waitForCancellationReceipt(
    _ accessibility: AccessibilityObserver,
    definition: GatedAtlasFixtureDefinition,
    operation: GenerationCancellationOperation,
    safePoint: GenerationCancellationSafePoint,
    status: String
  ) async throws -> PackagedGenerationCancellationReceipt {
    for _ in 0..<2_000 {
      if let receipt = try? accessibility.generationCancellationReceipt(
        definition: definition,
        operation: operation,
        safePoint: safePoint,
        status: status
      ) { return receipt }
      try await Task.sleep(nanoseconds: 5_000_000)
    }
    throw PreviewObserverInvalidation.accessibility(
      "the generation-cancellation receipt did not reach \(status)"
    )
  }

  private static func waitForAcceptedAtlasReceipt(
    _ accessibility: AccessibilityObserver,
    definition: GatedAtlasFixtureDefinition
  ) async throws -> AcceptedAtlasAccessibilityReceipt {
    for _ in 0..<300 {
      if let receipt = try? accessibility.acceptedAtlasReceipt(expectedDefinition: definition) {
        return receipt
      }
      try await Task.sleep(nanoseconds: 10_000_000)
    }
    throw PreviewObserverInvalidation.accessibility("accepted aftermath Accessibility did not qualify")
  }

  private static func postObserverDispatch(keyCode: UInt16, to pid: pid_t) throws {
    guard let source = CGEventSource(stateID: .hidSystemState),
      let keyDown = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: true),
      let keyUp = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: false)
    else { throw PreviewObserverInvalidation.dispatch("could not create observer dispatch") }
    let flags: CGEventFlags = [.maskCommand, .maskAlternate, .maskControl]
    keyDown.flags = flags
    keyUp.flags = flags
    keyDown.postToPid(pid)
    keyUp.postToPid(pid)
  }

  private static func captureTarget(bundleIdentifier: String) async throws -> CaptureTarget {
    let windows = try await SCShareableContent.current.windows.filter {
      $0.owningApplication?.bundleIdentifier == bundleIdentifier && $0.isOnScreen
        && $0.windowLayer == 0
    }
    guard windows.count == 1, let window = windows.first,
      let pid = window.owningApplication?.processID
    else {
      throw PreviewObserverInvalidation.capture("expected one on-screen candidate window")
    }
    return CaptureTarget(applicationPID: pid, window: window)
  }

  private static func resolveProcesses(appPID: pid_t) throws -> ResolvedPreviewProcesses {
    let appReceipt = try launchctlReceipt(for: appPID)
    let roles = try PreviewProcessResolver.serviceRoles(from: appReceipt)
    try PreviewProcessResolver.requireLiveRoles(roles) { kill($0, 0) == 0 }
    var helperReceipts: [PreviewProcessRole: LaunchctlPIDReceipt] = [:]
    var names: [PreviewProcessRole: String] = [:]
    for role in PreviewProcessRole.allCases {
      guard let pid = roles[role] else { throw PreviewObserverInvalidation.processExited(role) }
      names[role] = try executablePath(for: pid).lastPathComponent
      if role != .application { helperReceipts[role] = try launchctlReceipt(for: pid) }
    }
    return try PreviewProcessResolver.validate(
      appReceipt: appReceipt,
      helperReceipts: helperReceipts,
      executableNames: names
    )
  }

  private static func launchctlReceipt(for pid: pid_t) throws -> LaunchctlPIDReceipt {
    let result = try runProcess("/bin/launchctl", arguments: ["print", "pid/\(pid)"])
    guard result.status == 0 else {
      throw PreviewObserverInvalidation.launchctl("launchctl could not resolve a required PID")
    }
    return try LaunchctlReceiptParser.parse(result.standardOutput, expectedPID: pid)
  }

  private static func executablePath(for pid: pid_t) throws -> URL {
    var buffer = [CChar](repeating: 0, count: 4_096)
    guard proc_pidpath(pid, &buffer, UInt32(buffer.count)) > 0 else {
      throw PreviewObserverInvalidation.processRole("a coalition executable was unresolvable")
    }
    return URL(fileURLWithPath: String(cString: buffer)).resolvingSymlinksInPath()
  }

  private static func verifyTargetHost() throws {
    let productVersion = try runProcess("/usr/bin/sw_vers", arguments: ["-productVersion"])
    let buildVersion = try runProcess("/usr/bin/sw_vers", arguments: ["-buildVersion"])
    guard try sysctlString("hw.model") == targetModel,
      productVersion.standardOutput.trimmingCharacters(in: .whitespacesAndNewlines)
        == targetOSVersion,
      buildVersion.standardOutput.trimmingCharacters(in: .whitespacesAndNewlines)
        == targetOSBuild,
      ProcessInfo.processInfo.physicalMemory == targetMemoryBytes
    else { throw PreviewObserverInvalidation.host("host identity did not match the target") }
  }

  private static func sysctlString(_ name: String) throws -> String {
    var size = 0
    guard sysctlbyname(name, nil, &size, nil, 0) == 0, size > 1 else {
      throw PreviewObserverInvalidation.host("could not inspect target model")
    }
    var bytes = [CChar](repeating: 0, count: size)
    guard sysctlbyname(name, &bytes, &size, nil, 0) == 0 else {
      throw PreviewObserverInvalidation.host("could not inspect target model")
    }
    return String(cString: bytes)
  }

  private static func sanitizedRoleCounts(_ membership: ResolvedPreviewProcesses) -> [String: Int] {
    Dictionary(uniqueKeysWithValues: PreviewProcessRole.allCases.map {
      ($0.rawValue, membership.pidsByRole[$0] == nil ? 0 : 1)
    })
  }

  private static func emit(_ receipt: GenerationCancellationObserverReceipt) throws {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    FileHandle.standardOutput.write(try encoder.encode(receipt))
    FileHandle.standardOutput.write(Data([0x0A]))
  }
}

private struct Arguments {
  let bundleIdentifier: String
  let fixtureId: GatedAtlasFixtureID
  let fixtureDefinitionPath: String
  let operation: GenerationCancellationOperation
  let safePoint: GenerationCancellationSafePoint
  let expectedCandidateSha256: String
  let samplerPath: String
  let expectedSamplerSha256: String
  let rawSamplesPath: String

  init(_ arguments: [String]) throws {
    guard arguments.count == 10,
      arguments[1] == "app.ttrpgmap.generator",
      let fixtureId = GatedAtlasFixtureID(rawValue: arguments[2]),
      let operation = GenerationCancellationOperation(rawValue: arguments[4]),
      let safePoint = GenerationCancellationSafePoint(rawValue: arguments[5]),
      ExecutableIdentityValidator.isDigest(arguments[6]),
      ExecutableIdentityValidator.isDigest(arguments[8])
    else { throw PreviewObserverInvalidation.usage }
    bundleIdentifier = arguments[1]
    self.fixtureId = fixtureId
    fixtureDefinitionPath = arguments[3]
    self.operation = operation
    self.safePoint = safePoint
    expectedCandidateSha256 = arguments[6]
    samplerPath = arguments[7]
    expectedSamplerSha256 = arguments[8]
    rawSamplesPath = arguments[9]
  }

  var trialKeyCode: UInt16 {
    switch (operation, safePoint) {
    case (.preview, .early): 12
    case (.preview, .middle): 13
    case (.preview, .late): 14
    case (.full, .early): 0
    case (.full, .middle): 1
    case (.full, .late): 2
    }
  }

  func validatedFixtureDefinitionPath() throws -> String {
    let path = URL(fileURLWithPath: fixtureDefinitionPath).resolvingSymlinksInPath().path
    guard path.hasSuffix("/fixtures/fixed-seeds/\(fixtureId.rawValue)/fixture-definition.json"),
      FileManager.default.fileExists(atPath: path)
    else { throw PreviewObserverInvalidation.fixture("fixture path was not registered") }
    return path
  }
}

private struct CaptureTarget {
  let applicationPID: pid_t
  let window: SCWindow
}
