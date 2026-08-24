import AppKit
import ApplicationServices
import Foundation

let observerSchemaVersion = "packaged-preview-observer-v2"
let packagedExportObserverSchemaVersion = "packaged-export-completion-observer-v1"
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
enum PackagedExportObserver {
  static func main() async {
    do {
      let arguments = try PackagedExportObserverArguments(CommandLine.arguments)
      let receipt = try await qualify(arguments)
      try emit(receipt)
    } catch let invalidation as PreviewObserverInvalidation {
      try? emit(
        PackagedExportQualificationReceipt.invalid(
          authority: invalidation.authority,
          reason: invalidation.description
        )
      )
    } catch let invalidation as ExportObserverInvalidation {
      try? emit(
        PackagedExportQualificationReceipt.invalid(
          authority: invalidation.authority,
          reason: invalidation.description
        )
      )
    } catch {
      try? emit(
        PackagedExportQualificationReceipt.invalid(
          authority: "observer-internal",
          reason: "unexpected internal packaged export observer failure"
        )
      )
    }
  }

  @MainActor
  private static func qualify(
    _ arguments: PackagedExportObserverArguments
  ) async throws -> PackagedExportQualificationReceipt {
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
    try Issue97Destination.createPrivateWorkRoot(arguments.workRoot)
    let packagePath = URL(fileURLWithPath: arguments.workRoot)
      .appendingPathComponent("atlas.mapworld").path
    let destinationPath = URL(fileURLWithPath: arguments.workRoot)
      .appendingPathComponent("atlas.issue-97.\(arguments.format.rawValue)").path
    let temporaryPath = Issue97Destination.temporaryPath(
      destinationPath: destinationPath,
      format: arguments.format
    )

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

    let targetPID = try targetApplicationPID(bundleIdentifier: arguments.bundleIdentifier)
    let candidateExecutablePath = try executablePath(for: targetPID)
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
    let accessibility = AccessibilityObserver(applicationPID: targetPID)
    try accessibility.issue97PrepareFrontmost()
    let initialMembership = try resolveProcesses(appPID: targetPID)
    guard initialMembership.coalition.bundleIdentifier == arguments.bundleIdentifier else {
      throw PreviewObserverInvalidation.launchctl("candidate bundle ID did not match its coalition")
    }

    try await prepareExactReopenedAtlas(
      accessibility: accessibility,
      targetPID: targetPID,
      fixtureDefinition: fixtureDefinition,
      fixtureId: arguments.fixtureId,
      packagePath: packagePath
    )
    let baselineMembership = try resolveProcesses(appPID: targetPID)
    try PreviewProcessResolver.revalidate(
      baseline: initialMembership,
      completion: baselineMembership
    )
    let staleIdentity = try Issue97Destination.seedStaleDestination(destinationPath)
    guard !FileManager.default.fileExists(atPath: temporaryPath) else {
      throw ExportObserverInvalidation.destination(
        "a partial or stale native temporary artifact existed before dispatch")
    }

    let foreground = try ForegroundMonitor(applicationPID: targetPID)
    defer { foreground.stop() }
    let sampler = try RSSSampler(
      executablePath: samplerPath,
      rawSamplesPath: rawSamplesPath,
      pids: baselineMembership.orderedPIDs
    )
    try sampler.start()
    defer { sampler.stopIfRunning() }
    try await Task.sleep(nanoseconds: 500_000_000)
    guard foreground.isIntact else { throw PreviewObserverInvalidation.candidateNotFrontmost }

    // No Accessibility traversal or application action occurs between this dispatch and the one
    // final receipt after the filesystem has independently observed complete replacement.
    let dispatchEpochMilliseconds = Date().timeIntervalSince1970 * 1_000
    try postObserverDispatch(keyCode: arguments.format.dispatchKeyCode, to: targetPID)
    let committedIdentity = try await waitForDestinationReplacement(
      destinationPath: destinationPath,
      staleIdentity: staleIdentity,
      foreground: foreground
    )
    try await Task.sleep(nanoseconds: 250_000_000)
    let completionText = try accessibility.issue97ExportReceiptText()
    let completionEpochMilliseconds = Date().timeIntervalSince1970 * 1_000
    let completionReceipt = try PackagedExportStateReceiptParser.parseCompletionAfterGatedDispatch(
      completionText,
      expectedDefinition: fixtureDefinition,
      expectedFormat: arguments.format
    )
    guard let completion = completionReceipt.completion else {
      throw ExportObserverInvalidation.state("the final export receipt omitted completion")
    }
    let temporaryAbsent = !FileManager.default.fileExists(atPath: temporaryPath)
    let formatValid = try Issue97Destination.formatValid(
      path: destinationPath,
      format: arguments.format
    )
    try ExportDestinationPredicate.validate(
      stale: staleIdentity,
      committed: committedIdentity,
      completion: completion,
      temporaryAbsent: temporaryAbsent,
      formatValid: formatValid
    )
    let frontmost = try accessibility.issue97Frontmost()
    guard foreground.isIntact, frontmost else {
      throw PreviewObserverInvalidation.candidateNotFrontmost
    }

    let completionMembership = try resolveProcesses(appPID: targetPID)
    try PreviewProcessResolver.revalidate(
      baseline: baselineMembership,
      completion: completionMembership
    )
    sampler.stop()
    let rss = try sampler.measurement(
      dispatchEpochMilliseconds: dispatchEpochMilliseconds,
      completionEpochMilliseconds: completionEpochMilliseconds
    )

    return PackagedExportQualificationReceipt(
      observerVersion: packagedExportObserverSchemaVersion,
      status: "valid",
      target: .approved,
      fixture: ExportFixtureAuthorityReceipt(
        fixtureId: fixtureDefinition.fixtureId,
        fixtureDefinitionSha256: fixtureDefinitionSha256,
        worldSeed: fixtureDefinition.worldSeed,
        controls: fixtureDefinition.controls,
        exactReopenedStateBeforeDispatch: true
      ),
      roleCounts: sanitizedRoleCounts(baselineMembership),
      acceptedState: ExportAcceptedStateReceipt(
        canonicalAspectSetSha256: completionReceipt.canonicalAspectSetSha256,
        canonicalOutputSetSha256: completionReceipt.canonicalOutputSetSha256,
        canonicalCoastlineOutputSha256: completionReceipt.canonicalCoastlineOutputSha256,
        renderSceneSha256: completionReceipt.renderSceneSha256,
        manifestSha256: completionReceipt.manifestSha256,
        reopenComparisonPassed: completionReceipt.reopenComparisonPassed,
        reopenGeneratorInvocations: completionReceipt.reopenGeneratorInvocations,
        unchangedAfterExport: completion.acceptedStateUnchanged
      ),
      destination: ExportDestinationReceipt(
        format: arguments.format.rawValue,
        profileId: completion.profileId,
        profileVersion: completion.profileVersion,
        dimensions: completion.dimensions,
        staleRegularDestinationSeeded: true,
        atomicIdentityReplacementObserved: staleIdentity.inode != committedIdentity.inode,
        temporaryAbsent: temporaryAbsent,
        sha256Matched: committedIdentity.sha256 == completion.sha256,
        byteLengthMatched: committedIdentity.byteLength == completion.byteLength,
        byteLength: completion.byteLength,
        sizeCeilingBytes: arguments.format.maximumBytes,
        sizeCeilingPassed: completion.byteLength <= arguments.format.maximumBytes,
        completeFormatValidated: formatValid
      ),
      accessibility: ExportAccessibilityReceipt(
        exactCompletionReceiptMatched: true,
        foregroundIntact: foreground.isIntact,
        frontmost: frontmost
      ),
      executableIdentity: ExecutableIdentityReceipt(
        candidateSha256: candidateSha256,
        samplerSha256: samplerSha256
      ),
      membershipRevalidated: true,
      dispatchBoundary: "exact-reopened-production-\(arguments.format.rawValue)-key-dispatch",
      completionBoundary:
        "atomic-destination-replacement-then-one-exact-final-accessibility-receipt",
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

  @MainActor
  private static func prepareExactReopenedAtlas(
    accessibility: AccessibilityObserver,
    targetPID: pid_t,
    fixtureDefinition: GatedAtlasFixtureDefinition,
    fixtureId: GatedAtlasFixtureID,
    packagePath: String
  ) async throws {
    try postObserverDispatch(keyCode: fixtureId.dispatchKeyCode, to: targetPID)
    _ = try await waitForFixtureReceipt(
      accessibility,
      definition: fixtureDefinition,
      phase: .configured,
      attempts: 500
    )
    try postObserverDispatch(keyCode: 35, to: targetPID)
    _ = try await waitForFixtureReceipt(
      accessibility,
      definition: fixtureDefinition,
      phase: .preview,
      attempts: 3_000
    )
    try postObserverDispatch(keyCode: 3, to: targetPID)
    _ = try await waitForFixtureReceipt(
      accessibility,
      definition: fixtureDefinition,
      phase: .accepted,
      attempts: 30_000
    )

    try await waitToSetSaveTarget(accessibility, targetPath: packagePath, attempts: 1_200)
    try postObserverDispatch(keyCode: 15, to: targetPID)
    try await waitForReopenedReadiness(
      accessibility,
      packagePath: packagePath,
      attempts: 1_200
    )
  }

  private static func waitForFixtureReceipt(
    _ accessibility: AccessibilityObserver,
    definition: GatedAtlasFixtureDefinition,
    phase: PackagedAtlasObserverPhase,
    attempts: Int
  ) async throws -> PackagedAtlasFixtureReceipt {
    for _ in 0..<attempts {
      if let receipt = try? accessibility.issue97FixtureReceipt(
        expectedDefinition: definition,
        expectedPhase: phase
      ) { return receipt }
      try await Task.sleep(nanoseconds: 250_000_000)
    }
    throw PreviewObserverInvalidation.fixture(
      "the exact packaged fixture receipt did not reach the required preparation phase")
  }

  private static func waitForReopenedReadiness(
    _ accessibility: AccessibilityObserver,
    packagePath: String,
    attempts: Int
  ) async throws {
    for _ in 0..<attempts {
      if (try? accessibility.issue97ReopenedReadiness(packagePath)) == true { return }
      try await Task.sleep(nanoseconds: 250_000_000)
    }
    throw ExportObserverInvalidation.state(
      "the exact generator-free reopened production readiness did not become complete")
  }

  private static func waitToSetSaveTarget(
    _ accessibility: AccessibilityObserver,
    targetPath: String,
    attempts: Int
  ) async throws {
    for _ in 0..<attempts {
      if (try? accessibility.issue97SetSaveTarget(targetPath)) != nil { return }
      try await Task.sleep(nanoseconds: 250_000_000)
    }
    throw PreviewObserverInvalidation.accessibility(
      "the unchanged production save target did not become writable after appearance acceptance")
  }

  private static func waitForDestinationReplacement(
    destinationPath: String,
    staleIdentity: DestinationFileIdentity,
    foreground: ForegroundMonitor
  ) async throws -> DestinationFileIdentity {
    for _ in 0..<12_000 {
      guard foreground.isIntact else { throw PreviewObserverInvalidation.candidateNotFrontmost }
      if let identity = try? Issue97Destination.identity(destinationPath),
        identity.inode != staleIdentity.inode,
        identity.sha256 != staleIdentity.sha256
      {
        return identity
      }
      try await Task.sleep(nanoseconds: 10_000_000)
    }
    throw ExportObserverInvalidation.destination(
      "no complete atomic destination replacement appeared after measured dispatch")
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

  private static func targetApplicationPID(bundleIdentifier: String) throws -> pid_t {
    let applications = NSRunningApplication.runningApplications(
      withBundleIdentifier: bundleIdentifier
    ).filter { !$0.isTerminated }
    guard applications.count == 1, let application = applications.first,
      application.processIdentifier > 0
    else {
      throw PreviewObserverInvalidation.capture(
        "expected exactly one live packaged candidate before observer preparation")
    }
    return application.processIdentifier
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

  private static func emit(_ receipt: PackagedExportQualificationReceipt) throws {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    let data = try encoder.encode(receipt)
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0A]))
  }
}

private struct PackagedExportObserverArguments {
  let bundleIdentifier: String
  let fixtureId: GatedAtlasFixtureID
  let fixtureDefinitionPath: String
  let format: PackagedExportFormat
  let expectedCandidateSha256: String
  let samplerPath: String
  let expectedSamplerSha256: String
  let rawSamplesPath: String
  let workRoot: String

  init(_ arguments: [String]) throws {
    guard arguments.count == 10,
      arguments[1] == "app.ttrpgmap.generator",
      let fixtureId = GatedAtlasFixtureID(rawValue: arguments[2]),
      let format = PackagedExportFormat(rawValue: arguments[4]),
      ExecutableIdentityValidator.isDigest(arguments[5]),
      ExecutableIdentityValidator.isDigest(arguments[7])
    else { throw PreviewObserverInvalidation.usage }
    bundleIdentifier = arguments[1]
    self.fixtureId = fixtureId
    fixtureDefinitionPath = arguments[3]
    self.format = format
    expectedCandidateSha256 = arguments[5]
    samplerPath = arguments[6]
    expectedSamplerSha256 = arguments[7]
    rawSamplesPath = arguments[8]
    workRoot = arguments[9]
  }

  func validatedFixtureDefinitionPath() throws -> String {
    let url = URL(fileURLWithPath: fixtureDefinitionPath).resolvingSymlinksInPath()
    let suffix = "/fixtures/fixed-seeds/\(fixtureId.rawValue)/fixture-definition.json"
    guard url.path.hasSuffix(suffix), FileManager.default.fileExists(atPath: url.path) else {
      throw PreviewObserverInvalidation.fixture(
        "the fixture path was not the registered definition for the requested gated fixture")
    }
    return url.path
  }
}
