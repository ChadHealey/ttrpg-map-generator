import AppKit
import Foundation

@main
enum TargetSessionReadinessController {
  static func main() async {
    do {
      let arguments = try Arguments(CommandLine.arguments)
      let receipt = try await qualify(arguments)
      try issue100Emit(receipt)
    } catch let failure as Issue105ReadinessFailure {
      try? issue100Emit(
        Issue105TargetSessionReadinessQualificationReceipt.invalid(
          failure.invalidation,
          diagnostics: failure.diagnostics
        ))
      exit(2)
    } catch let invalidation as TargetSessionReadinessInvalidation {
      try? issue100Emit(Issue105TargetSessionReadinessQualificationReceipt.invalid(invalidation))
      exit(2)
    } catch {
      let invalidation = TargetSessionReadinessInvalidation.action(
        "unexpected internal target-session readiness controller failure")
      try? issue100Emit(Issue105TargetSessionReadinessQualificationReceipt.invalid(invalidation))
      exit(2)
    }
  }

  @MainActor
  private static func qualify(_ arguments: Arguments) async throws
    -> Issue105TargetSessionReadinessQualificationReceipt
  {
    try Issue100TargetSessionPlatform.verifyTargetHost()
    let consoleSessionMatched = Issue100TargetSessionPlatform.designatedConsoleSessionMatched()
    let package = try Issue100TargetSessionPlatform.packageIdentity(
      applicationPath: arguments.applicationPath,
      bundleIdentifier: arguments.bundleIdentifier,
      expectedExecutableSha256: arguments.expectedCandidateSha256
    )
    let observerSha256 = try executableIdentity(
      path: arguments.readinessObserverPath,
      expectedSha256: arguments.expectedReadinessObserverSha256,
      label: "readiness observer"
    )
    let controllerSha256 = try executableIdentity(
      path: CommandLine.arguments[0],
      expectedSha256: nil,
      label: "readiness controller"
    )

    let observerApplication = NSApplication.shared
    if observerApplication.activationPolicy() != .prohibited {
      _ = observerApplication.setActivationPolicy(.prohibited)
    }
    guard observerApplication.windows.isEmpty,
      NSWorkspace.shared.frontmostApplication?.processIdentifier
        != ProcessInfo.processInfo.processIdentifier
    else {
      throw TargetSessionReadinessInvalidation.foreground(
        "the readiness controller acquired a window or foreground ownership")
    }

    let existingApplications = Issue100TargetSessionPlatform.exactApplications(
      bundleIdentifier: arguments.bundleIdentifier)
    try TargetSessionReadinessPredicate.validatePrelaunch(
      existingApplicationCount: existingApplications.count,
      consoleSessionMatched: consoleSessionMatched,
      packageIdentityMatched: true
    )

    let configuration = NSWorkspace.OpenConfiguration()
    configuration.activates = true
    configuration.addsToRecentItems = false
    configuration.createsNewApplicationInstance = true
    let application: NSRunningApplication
    do {
      application = try await NSWorkspace.shared.openApplication(
        at: package.applicationURL,
        configuration: configuration
      )
    } catch {
      throw TargetSessionReadinessInvalidation.action(
        "the exact packaged candidate could not be launched in the target GUI session")
    }
    var qualificationSucceeded = false
    defer {
      if !qualificationSucceeded { _ = application.terminate() }
    }
    let applicationsAfterLaunch = Issue100TargetSessionPlatform.exactApplications(
      bundleIdentifier: arguments.bundleIdentifier)
    guard applicationsAfterLaunch.count == 1,
      applicationsAfterLaunch.first?.processIdentifier == application.processIdentifier,
      Issue100TargetSessionPlatform.exactLiveIdentityMatched(application, package: package)
    else {
      throw TargetSessionReadinessInvalidation.processState(
        "the exact fresh packaged candidate process could not be established")
    }
    let window = try Issue100TargetSessionPlatform.waitForSingleAccessibilityWindow(
      application: application,
      bundleIdentifier: arguments.bundleIdentifier
    )
    let activationAccepted = Issue105TargetSessionStabilizationPlatform.requestActivation(
      application)
    do {
      try Issue105TargetSessionStabilizer.validateActivationRequest(accepted: activationAccepted)
    } catch let invalidation as TargetSessionReadinessInvalidation {
      throw Issue105ReadinessFailure(
        invalidation: invalidation,
        diagnostics: Issue105StabilizationDiagnostics(
          policyTimeoutMilliseconds: Issue105StabilizationPolicy.approved.timeoutMilliseconds,
          pollIntervalMilliseconds: Issue105StabilizationPolicy.approved.pollIntervalMilliseconds,
          stabilizationDurationMilliseconds: 0,
          activationRequestCount: 1,
          stabilizationObservationCount: 0,
          raiseAttemptCount: 0,
          retryableRaiseFailureCount: 0,
          frontmostWriteAttemptCount: 0,
          initialVisibilityPredicates: nil,
          terminalVisibilityPredicates: nil,
          visibilityPendingObservationCount: 0,
          visibilityPendingDurationMilliseconds: 0,
          terminalPredicates: .none
        )
      )
    }
    let stabilization = try Issue105TargetSessionStabilizationPlatform.stabilize(
      application: application,
      window: window,
      bundleIdentifier: arguments.bundleIdentifier,
      expectedExecutableSha256: arguments.expectedCandidateSha256
    )

    let observerReceipt = try runReadinessObserver(
      path: arguments.readinessObserverPath,
      bundleIdentifier: arguments.bundleIdentifier,
      expectedCandidateSha256: arguments.expectedCandidateSha256
    )
    guard observerReceipt.status == "valid",
      observerReceipt.bundleIdentifier == arguments.bundleIdentifier,
      observerReceipt.candidateExecutableSha256 == arguments.expectedCandidateSha256,
      observerReceipt.applicationCount == 1,
      observerReceipt.accessibilityWindowCount == 1,
      observerReceipt.visibleAccessibilityWindow == true,
      observerReceipt.accessibilityFrontmost == true,
      observerReceipt.workspaceFrontmost == true,
      observerReceipt.applicationAndWindowIdentityRetained
    else {
      throw TargetSessionReadinessInvalidation.foreground(
        "the independent readiness observer did not verify the approved retained state")
    }

    guard Issue100TargetSessionPlatform.designatedConsoleSessionMatched() else {
      throw TargetSessionReadinessInvalidation.session(
        "the designated logged-in console GUI session changed before terminal verification")
    }

    let finalSnapshot = try Issue100TargetSessionPlatform.readinessSnapshot(
      bundleIdentifier: arguments.bundleIdentifier,
      expectedExecutableSha256: arguments.expectedCandidateSha256
    )
    try Issue105TargetSessionStabilizer.validateRetainedIdentity(
      finalSnapshot,
      retainedIdentity: Issue105RetainedCandidateIdentity(
        processIdentifier: application.processIdentifier,
        windowIdentity: CFHash(window)
      )
    )
    try TargetSessionReadinessPredicate.validateSnapshot(finalSnapshot)

    let finalStabilizationDiagnostics = Issue105StabilizationDiagnostics(
      policyTimeoutMilliseconds: stabilization.diagnostics.policyTimeoutMilliseconds,
      pollIntervalMilliseconds: stabilization.diagnostics.pollIntervalMilliseconds,
      stabilizationDurationMilliseconds:
        stabilization.diagnostics.stabilizationDurationMilliseconds,
      activationRequestCount: stabilization.diagnostics.activationRequestCount,
      stabilizationObservationCount: stabilization.diagnostics.stabilizationObservationCount,
      raiseAttemptCount: stabilization.diagnostics.raiseAttemptCount,
      retryableRaiseFailureCount: stabilization.diagnostics.retryableRaiseFailureCount,
      frontmostWriteAttemptCount: stabilization.diagnostics.frontmostWriteAttemptCount,
      initialVisibilityPredicates: stabilization.diagnostics.initialVisibilityPredicates,
      terminalVisibilityPredicates: Issue106VisibilityPredicates(snapshot: finalSnapshot),
      visibilityPendingObservationCount:
        stabilization.diagnostics.visibilityPendingObservationCount,
      visibilityPendingDurationMilliseconds:
        stabilization.diagnostics.visibilityPendingDurationMilliseconds,
      terminalPredicates: Issue105TerminalPredicates(
        exactCandidateRetained: true,
        exactWindowRetained: true,
        visibleWindow: finalSnapshot.visibleWindow,
        workspaceFrontmost: finalSnapshot.workspaceFrontmost,
        accessibilityFrontmost: finalSnapshot.accessibilityFrontmost,
        independentObserverVerified: true
      )
    )

    let receipt = Issue105TargetSessionReadinessQualificationReceipt(
      controllerVersion: issue105ReadinessSchemaVersion,
      status: "valid",
      qualificationKind: "non-measurement-target-session-readiness",
      target: .approved,
      sessionMechanism:
        "exact-path NSWorkspace launch in active console GUI session; accepted AppKit activation request; bounded retained-frontmost stabilization; AXRaise; AXFrontmost; independent retained Accessibility/NSWorkspace verification",
      bundleIdentifier: arguments.bundleIdentifier,
      candidateExecutableSha256: package.executableSha256,
      controllerSha256: controllerSha256,
      readinessObserverSha256: observerSha256,
      predicates: Issue100ReadinessPredicates(
        freshProcess: true,
        exactApplicationCount: true,
        exactAccessibilityWindowCount: true,
        visibleAccessibilityWindow: true,
        activationSucceeded: true,
        raiseSucceeded: true,
        accessibilityFrontmostWriteSucceeded: true,
        accessibilityFrontmostVerified: true,
        workspaceFrontmostVerified: true,
        applicationAndWindowIdentityRetained: true
      ),
      stabilization: finalStabilizationDiagnostics,
      zeroOperationProof: .zero,
      invalidAuthority: nil,
      invalidReason: nil
    )
    qualificationSucceeded = true
    return receipt
  }

  private static func executableIdentity(
    path: String,
    expectedSha256: String?,
    label: String
  ) throws -> String {
    let canonicalPath = URL(fileURLWithPath: path).resolvingSymlinksInPath().path
    guard FileManager.default.isExecutableFile(atPath: canonicalPath) else {
      throw TargetSessionReadinessInvalidation.identity(
        "the (label) was not an executable file")
    }
    let digest: String
    do { digest = try ExecutableIdentityValidator.sha256(atPath: canonicalPath) } catch {
      throw TargetSessionReadinessInvalidation.identity(
        "the (label) identity could not be read")
    }
    if let expectedSha256, digest != expectedSha256 {
      throw TargetSessionReadinessInvalidation.identity(
        "the (label) identity did not match")
    }
    return digest
  }

  private static func runReadinessObserver(
    path: String,
    bundleIdentifier: String,
    expectedCandidateSha256: String
  ) throws -> TargetSessionReadinessObserverReceipt {
    let process = Process()
    let output = Pipe()
    process.executableURL = URL(fileURLWithPath: path).resolvingSymlinksInPath()
    process.arguments = [bundleIdentifier, expectedCandidateSha256]
    process.standardOutput = output
    process.standardError = FileHandle.nullDevice
    do { try process.run() } catch {
      throw TargetSessionReadinessInvalidation.action(
        "the independent readiness observer could not be started")
    }
    process.waitUntilExit()
    let data = output.fileHandleForReading.readDataToEndOfFile()
    guard process.terminationStatus == 0,
      let receipt = try? JSONDecoder().decode(
        TargetSessionReadinessObserverReceipt.self,
        from: data
      )
    else {
      throw TargetSessionReadinessInvalidation.foreground(
        "the independent readiness observer failed closed")
    }
    return receipt
  }
}

private struct Arguments {
  let applicationPath: String
  let bundleIdentifier: String
  let expectedCandidateSha256: String
  let readinessObserverPath: String
  let expectedReadinessObserverSha256: String

  init(_ arguments: [String]) throws {
    guard arguments.count == 6,
      arguments[1].hasPrefix("/"),
      arguments[2] == "app.ttrpgmap.generator",
      ExecutableIdentityValidator.isDigest(arguments[3]),
      arguments[4].hasPrefix("/"),
      ExecutableIdentityValidator.isDigest(arguments[5])
    else { throw TargetSessionReadinessInvalidation.usage }
    applicationPath = arguments[1]
    bundleIdentifier = arguments[2]
    expectedCandidateSha256 = arguments[3]
    readinessObserverPath = arguments[4]
    expectedReadinessObserverSha256 = arguments[5]
  }
}
