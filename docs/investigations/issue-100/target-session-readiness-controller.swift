import AppKit
import Foundation

@main
enum TargetSessionReadinessController {
  static func main() async {
    var latch: Issue110OperatorReadyLatchPlatform?
    do {
      let arguments = try Arguments(CommandLine.arguments)
      try Issue105TargetSessionStabilizer.validateDeclaredOperatorFocusActionCount(
        arguments.declaredOperatorFocusActionCount)
      let preparedLatch = try Issue110OperatorReadyLatchPlatform(
        configuration: Issue110OperatorReadyLatchConfiguration(
          path: arguments.operatorReadyLatchPath,
          token: arguments.operatorReadyLatchToken
        ))
      latch = preparedLatch
      try preparedLatch.prepare()
      let receipt = try await qualify(arguments, latch: preparedLatch)
      try issue100Emit(receipt)
    } catch {
      let failure = error as? Issue105ReadinessFailure
      var invalidation =
        failure?.invalidation
        ?? (error as? TargetSessionReadinessInvalidation)
        ?? TargetSessionReadinessInvalidation.action(
          "unexpected internal target-session readiness controller failure")
      var latchDiagnostics = latch?.diagnostics() ?? .none
      if let latch {
        do {
          latchDiagnostics = try latch.cleanup()
        } catch let cleanupInvalidation as TargetSessionReadinessInvalidation {
          invalidation = cleanupInvalidation
          latchDiagnostics = latch.diagnostics()
        } catch {
          invalidation = TargetSessionReadinessInvalidation.action(
            "unexpected operator-ready latch cleanup failure")
          latchDiagnostics = latch.diagnostics()
        }
      }
      try? issue100Emit(
        Issue105TargetSessionReadinessQualificationReceipt.invalid(
          invalidation,
          diagnostics: failure?.diagnostics,
          operatorReadyLatch: latchDiagnostics
        ))
      exit(2)
    }
  }

  @MainActor
  private static func qualify(
    _ arguments: Arguments,
    latch: Issue110OperatorReadyLatchPlatform
  ) async throws
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

    let launch: Issue116CandidateLaunch<NSRunningApplication>
    do {
      launch = try await Issue116PrelaunchForegroundController.captureThenLaunch(
        controllerProcessIdentifier: ProcessInfo.processInfo.processIdentifier,
        captureWorkspaceForeground: {
          Issue105TargetSessionStabilizationPlatform.currentWorkspaceForeground()
        },
        launchCandidate: { requestsActivation in
          let configuration = NSWorkspace.OpenConfiguration()
          configuration.activates = requestsActivation
          configuration.addsToRecentItems = false
          configuration.createsNewApplicationInstance = true
          return try await NSWorkspace.shared.openApplication(
            at: package.applicationURL,
            configuration: configuration
          )
        }
      )
    } catch let invalidation as TargetSessionReadinessInvalidation {
      throw invalidation
    } catch {
      throw TargetSessionReadinessInvalidation.action(
        "the exact packaged candidate could not be launched in the target GUI session")
    }
    let application = launch.candidate
    let initialWorkspaceForeground = launch.initialWorkspaceForeground
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
    let retainedIdentity = Issue105RetainedCandidateIdentity(
      processIdentifier: application.processIdentifier,
      windowIdentity: CFHash(window)
    )
    let initialSnapshot = try Issue105TargetSessionStabilizationPlatform.readinessSnapshot(
      bundleIdentifier: arguments.bundleIdentifier,
      expectedExecutableSha256: arguments.expectedCandidateSha256,
      initialWorkspaceForeground: initialWorkspaceForeground
    )
    try Issue105TargetSessionStabilizer.validateZeroOperationProof(.zero)
    try Issue105TargetSessionStabilizer.validatePreHandoff(
      initialSnapshot, retainedIdentity: retainedIdentity)
    latch.installSignalCleanup {
      _ = application.terminate()
    }
    let publishedLatch = try latch.publish(
      bundleIdentifier: arguments.bundleIdentifier,
      candidateExecutableSha256: arguments.expectedCandidateSha256,
      exactCandidateValidated: true,
      consoleSessionValidated: Issue100TargetSessionPlatform.designatedConsoleSessionMatched(),
      declaredOperatorFocusActionCount: arguments.declaredOperatorFocusActionCount,
      zeroOperationProof: .zero
    )
    try issue109EmitPrompt(
      Issue109OperatorFocusPromptReceipt(
        controllerVersion: issue105ReadinessSchemaVersion,
        state: "awaiting-operator-focus",
        bundleIdentifier: arguments.bundleIdentifier,
        declaredOperatorFocusActionCount: arguments.declaredOperatorFocusActionCount,
        timeoutMilliseconds: Issue105StabilizationPolicy.approved.timeoutMilliseconds,
        prompt:
          "Click exactly once on the packaged app window or its Dock icon, then do not interact with it again.",
        zeroOperationProof: .zero
      ))
    let stabilization = try Issue105TargetSessionStabilizationPlatform.stabilize(
      application: application,
      window: window,
      bundleIdentifier: arguments.bundleIdentifier,
      expectedExecutableSha256: arguments.expectedCandidateSha256,
      initialWorkspaceForeground: initialWorkspaceForeground,
      initialSnapshot: initialSnapshot,
      operatorReadyLatch: publishedLatch,
      declaredOperatorFocusActionCount: arguments.declaredOperatorFocusActionCount
    )

    let observerReceipt = try runReadinessObserver(
      path: arguments.readinessObserverPath,
      bundleIdentifier: arguments.bundleIdentifier,
      expectedCandidateSha256: arguments.expectedCandidateSha256
    )
    let observerVerified =
      observerReceipt.status == "valid"
      && observerReceipt.bundleIdentifier == arguments.bundleIdentifier
    let observerIdentityVerified =
      observerReceipt.candidateExecutableSha256 == arguments.expectedCandidateSha256
    let observerPredicatesVerified =
      observerReceipt.applicationCount == 1
      && observerReceipt.accessibilityWindowCount == 1
      && observerReceipt.visibleAccessibilityWindow == true
      && observerReceipt.accessibilityFrontmost == true
      && observerReceipt.workspaceFrontmost == true
      && observerReceipt.applicationAndWindowIdentityRetained
    try Issue105TargetSessionStabilizer.validateIndependentObserverAgreement(
      observerVerified && observerIdentityVerified && observerPredicatesVerified)

    guard Issue100TargetSessionPlatform.designatedConsoleSessionMatched() else {
      throw TargetSessionReadinessInvalidation.session(
        "the designated logged-in console GUI session changed before terminal verification")
    }

    let finalSnapshot = try Issue105TargetSessionStabilizationPlatform.readinessSnapshot(
      bundleIdentifier: arguments.bundleIdentifier,
      expectedExecutableSha256: arguments.expectedCandidateSha256,
      initialWorkspaceForeground: initialWorkspaceForeground
    )
    try Issue105TargetSessionStabilizer.validateRetainedIdentity(
      finalSnapshot,
      retainedIdentity: Issue105RetainedCandidateIdentity(
        processIdentifier: application.processIdentifier,
        windowIdentity: CFHash(window)
      )
    )
    try Issue105TargetSessionStabilizer.validateSnapshot(finalSnapshot)

    let cleanedLatch = try latch.cleanup()
    let finalStabilizationDiagnostics = Issue105StabilizationDiagnostics(
      policyTimeoutMilliseconds: stabilization.diagnostics.policyTimeoutMilliseconds,
      pollIntervalMilliseconds: stabilization.diagnostics.pollIntervalMilliseconds,
      stabilizationDurationMilliseconds:
        stabilization.diagnostics.stabilizationDurationMilliseconds,
      activationRequestCount: stabilization.diagnostics.activationRequestCount,
      stabilizationObservationCount: stabilization.diagnostics.stabilizationObservationCount,
      raiseAttemptCount: stabilization.diagnostics.raiseAttemptCount,
      retryableRaiseFailureCount: stabilization.diagnostics.retryableRaiseFailureCount,
      raiseSucceeded: stabilization.diagnostics.raiseSucceeded,
      frontmost: stabilization.diagnostics.frontmost,
      operatorHandoff: stabilization.diagnostics.operatorHandoff,
      operatorReadyLatch: cleanedLatch,
      initialVisibilityPredicates: stabilization.diagnostics.initialVisibilityPredicates,
      terminalVisibilityPredicates: Issue106VisibilityPredicates(snapshot: finalSnapshot),
      visibilityPendingObservationCount:
        stabilization.diagnostics.visibilityPendingObservationCount,
      visibilityPendingDurationMilliseconds:
        stabilization.diagnostics.visibilityPendingDurationMilliseconds,
      actionOrder: stabilization.diagnostics.actionOrder,
      terminalPredicates: Issue105TerminalPredicates(
        exactCandidateRetained: true,
        exactWindowRetained: true,
        visibleWindow: finalSnapshot.visibleWindow,
        workspaceFrontmost: finalSnapshot.workspaceFrontmost,
        accessibilityFrontmost: finalSnapshot.accessibilityFrontmost.supportedValue == true,
        independentObserverVerified: true
      )
    )

    let receipt = Issue105TargetSessionReadinessQualificationReceipt(
      controllerVersion: issue105ReadinessSchemaVersion,
      status: "valid",
      qualificationKind: "non-measurement-target-session-readiness",
      target: .approved,
      sessionMechanism:
        "prelaunch-captured explicit Workspace application/desktop anchor; exact-path nonactivating NSWorkspace launch in active console GUI session; bounded explicit awaiting-operator-focus handoff; one declared operator focus action; independently detected exact-candidate Workspace and Accessibility frontmost plus supported positive frame; AXRaise; unchanged retained Accessibility/NSWorkspace observer verification",
      bundleIdentifier: arguments.bundleIdentifier,
      candidateExecutableSha256: package.executableSha256,
      controllerSha256: controllerSha256,
      readinessObserverSha256: observerSha256,
      predicates: Issue100ReadinessPredicates(
        freshProcess: true,
        exactApplicationCount: true,
        exactAccessibilityWindowCount: true,
        visibleAccessibilityWindow: true,
        activationSucceeded: false,
        raiseSucceeded: true,
        accessibilityFrontmostWriteSucceeded: false,
        accessibilityFrontmostVerified: true,
        workspaceFrontmostVerified: true,
        applicationAndWindowIdentityRetained: true
      ),
      stabilization: finalStabilizationDiagnostics,
      operatorReadyLatch: cleanedLatch,
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
  let declaredOperatorFocusActionCount: Int
  let operatorReadyLatchPath: String
  let operatorReadyLatchToken: String

  init(_ arguments: [String]) throws {
    guard arguments.count == 9,
      arguments[1].hasPrefix("/"),
      arguments[2] == "app.ttrpgmap.generator",
      ExecutableIdentityValidator.isDigest(arguments[3]),
      arguments[4].hasPrefix("/"),
      ExecutableIdentityValidator.isDigest(arguments[5]),
      let declaredOperatorFocusActionCount = Int(arguments[6])
    else { throw TargetSessionReadinessInvalidation.usage }
    applicationPath = arguments[1]
    bundleIdentifier = arguments[2]
    expectedCandidateSha256 = arguments[3]
    readinessObserverPath = arguments[4]
    expectedReadinessObserverSha256 = arguments[5]
    self.declaredOperatorFocusActionCount = declaredOperatorFocusActionCount
    operatorReadyLatchPath = arguments[7]
    operatorReadyLatchToken = arguments[8]
  }
}
