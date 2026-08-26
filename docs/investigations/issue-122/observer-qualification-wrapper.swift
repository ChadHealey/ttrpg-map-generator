import AppKit
import Darwin
import Foundation

final class Issue122RunningApplicationHandle {
  let processIdentifier: Int32
  let snapshot: () -> Issue121CandidateSnapshot
  let terminate: () -> Bool
  let isTerminated: () -> Bool

  init(
    processIdentifier: Int32,
    snapshot: @escaping () -> Issue121CandidateSnapshot,
    terminate: @escaping () -> Bool,
    isTerminated: @escaping () -> Bool
  ) {
    self.processIdentifier = processIdentifier
    self.snapshot = snapshot
    self.terminate = terminate
    self.isTerminated = isTerminated
  }
}

@MainActor
struct Issue122LaunchDependencies {
  let openApplication:
    (URL, NSWorkspace.OpenConfiguration) async throws -> Issue122RunningApplicationHandle
  let runningApplications: (String) -> [Issue122RunningApplicationHandle]
  let nowNanoseconds: () -> UInt64
  let sleep: (useconds_t) -> Void

  static let live = Issue122LaunchDependencies(
    openApplication: { applicationURL, configuration in
      let application = try await NSWorkspace.shared.openApplication(
        at: applicationURL,
        configuration: configuration
      )
      return handle(application)
    },
    runningApplications: { bundleIdentifier in
      NSRunningApplication.runningApplications(withBundleIdentifier: bundleIdentifier)
        .filter { !$0.isTerminated }
        .map(handle)
    },
    nowNanoseconds: { DispatchTime.now().uptimeNanoseconds },
    sleep: { usleep($0) }
  )

  private static func handle(
    _ application: NSRunningApplication
  ) -> Issue122RunningApplicationHandle {
    Issue122RunningApplicationHandle(
      processIdentifier: application.processIdentifier,
      snapshot: {
        let executableURL = application.executableURL?.resolvingSymlinksInPath()
        return Issue121CandidateSnapshot(
          processIdentifier: application.processIdentifier,
          applicationURL: application.bundleURL?.resolvingSymlinksInPath(),
          executableURL: executableURL,
          bundleIdentifier: application.bundleIdentifier,
          executableSHA256: executableURL.flatMap { try? Issue121CandidateIdentity.sha256(at: $0) },
          isTerminated: application.isTerminated
        )
      },
      terminate: { application.terminate() },
      isTerminated: { application.isTerminated }
    )
  }
}

@MainActor
struct Issue122LaunchedQualification {
  let endpoint: Issue121PrivateEndpoint
  let retainedCandidate: Issue121RetainedCandidate
  let application: Issue122RunningApplicationHandle
}

@MainActor
struct Issue122QualificationWrapper {
  private enum RetainedCandidateState {
    case live(Issue121CandidateSnapshot)
    case transitioning
    case terminated
  }

  private enum ExactBundleScanState: Equatable {
    case absent
    case retained
    case invalid
  }

  let candidate: Issue121PreparedCandidate
  let dependencies: Issue122LaunchDependencies
  let controllerProcessIdentifier: Int32

  init(
    candidate: Issue121PreparedCandidate,
    dependencies: Issue122LaunchDependencies? = nil,
    controllerProcessIdentifier: Int32 = getpid()
  ) {
    self.candidate = candidate
    self.dependencies = dependencies ?? .live
    self.controllerProcessIdentifier = controllerProcessIdentifier
  }

  func qualify() async throws -> Issue121PublicResult {
    let launched = try await launchExactCandidate()
    let retainedCandidate = launched.retainedCandidate
    let application = launched.application
    return try Issue121ObserverController(
      endpoint: launched.endpoint,
      retainedCandidate: retainedCandidate,
      candidateSnapshot: { application.snapshot() },
      terminalCandidateCleanup: {
        terminateAndWait(
          application: application,
          retainedCandidate: retainedCandidate
        )
      },
      deadlinePolicy: .fixed
    ).qualify()
  }

  func launchExactCandidate() async throws -> Issue122LaunchedQualification {
    guard dependencies.runningApplications(candidate.bundleIdentifier).isEmpty else {
      throw Issue121Failure.candidateIdentity
    }
    let endpoint = try Issue121PrivateEndpoint.create()
    var returnedApplication: Issue122RunningApplicationHandle?
    do {
      let plan = try endpoint.launchPlan(
        candidate: candidate,
        controllerProcessIdentifier: controllerProcessIdentifier
      )
      let configuration = Issue121PrivateEndpoint.openConfiguration(for: plan)
      guard !configuration.activates, !configuration.addsToRecentItems,
        configuration.createsNewApplicationInstance,
        configuration.environment == plan.environment
      else { throw Issue121Failure.bootstrap }
      let application = try await dependencies.openApplication(
        plan.applicationURL,
        configuration
      )
      returnedApplication = application
      let running = dependencies.runningApplications(candidate.bundleIdentifier)
      guard running.count == 1, running[0].processIdentifier == application.processIdentifier else {
        throw Issue121Failure.candidateIdentity
      }
      let retainedCandidate = Issue121RetainedCandidate(
        processIdentifier: application.processIdentifier,
        applicationURL: candidate.applicationURL,
        executableURL: candidate.executableURL,
        bundleIdentifier: candidate.bundleIdentifier,
        executableSHA256: candidate.executableSHA256
      )
      try Issue121CandidateIdentity.validateRetained(
        retainedCandidate,
        snapshot: application.snapshot()
      )
      return Issue122LaunchedQualification(
        endpoint: endpoint,
        retainedCandidate: retainedCandidate,
        application: application
      )
    } catch {
      let candidateCleanup =
        returnedApplication.map {
          terminateReturnedApplication($0, bundleIdentifier: candidate.bundleIdentifier)
        } ?? true
      let endpointCleanup = cleanupEndpointWhenAbsent(endpoint)
      guard candidateCleanup, endpointCleanup else { throw Issue121Failure.cleanup }
      throw error
    }
  }

  func terminateAndCleanup(_ launched: Issue122LaunchedQualification) -> Bool {
    let candidateCleanup = terminateAndWait(
      application: launched.application,
      retainedCandidate: launched.retainedCandidate
    )
    let endpointCleanup = cleanupEndpointWhenAbsent(launched.endpoint)
    return candidateCleanup && endpointCleanup
  }

  private func terminateAndWait(
    application: Issue122RunningApplicationHandle,
    retainedCandidate: Issue121RetainedCandidate
  ) -> Bool {
    guard application.processIdentifier == retainedCandidate.processIdentifier else { return false }
    let deadline = deadline(after: 5_000_000_000)
    var terminationRequested = false
    while dependencies.nowNanoseconds() < deadline {
      guard
        let retainedState = retainedCandidateState(
          application: application,
          retainedCandidate: retainedCandidate
        )
      else { return false }
      let scanState = exactBundleScanState(retainedCandidate: retainedCandidate)
      guard scanState != .invalid else { return false }

      switch (retainedState, scanState) {
      case (.terminated, .absent):
        return true
      case (.terminated, .retained):
        break
      case (let .live(snapshot), .retained):
        do {
          try Issue121CandidateIdentity.validateRetained(
            retainedCandidate,
            snapshot: snapshot
          )
        } catch {
          return false
        }
        if !terminationRequested {
          terminationRequested = true
          _ = application.terminate()
        }
      case (.live(_), .absent), (.transitioning, .absent), (.transitioning, .retained):
        break
      case (_, .invalid):
        return false
      }
      dependencies.sleep(10_000)
    }
    return false
  }

  private func retainedCandidateState(
    application: Issue122RunningApplicationHandle,
    retainedCandidate: Issue121RetainedCandidate
  ) -> RetainedCandidateState? {
    let snapshot = application.snapshot()
    guard snapshot.processIdentifier == retainedCandidate.processIdentifier else { return nil }
    let handleIsTerminated = application.isTerminated()
    if snapshot.isTerminated, handleIsTerminated { return .terminated }
    if !snapshot.isTerminated, !handleIsTerminated { return .live(snapshot) }
    return .transitioning
  }

  private func exactBundleScanState(
    retainedCandidate: Issue121RetainedCandidate
  ) -> ExactBundleScanState {
    let running = dependencies.runningApplications(retainedCandidate.bundleIdentifier)
    guard !running.isEmpty else { return .absent }
    guard running.count == 1, let scanned = running.first,
      scanned.processIdentifier == retainedCandidate.processIdentifier
    else { return .invalid }
    do {
      try Issue121CandidateIdentity.validateRetained(
        retainedCandidate,
        snapshot: scanned.snapshot()
      )
      return .retained
    } catch {
      return .invalid
    }
  }

  private func terminateReturnedApplication(
    _ application: Issue122RunningApplicationHandle,
    bundleIdentifier: String
  ) -> Bool {
    guard application.terminate() else { return false }
    let deadline = deadline(after: 5_000_000_000)
    while dependencies.nowNanoseconds() < deadline {
      if application.isTerminated(), dependencies.runningApplications(bundleIdentifier).isEmpty {
        return true
      }
      dependencies.sleep(10_000)
    }
    return false
  }

  private func cleanupEndpointWhenAbsent(_ endpoint: Issue121PrivateEndpoint) -> Bool {
    let deadline = deadline(after: 1_000_000_000)
    while dependencies.nowNanoseconds() < deadline {
      var status = stat()
      errno = 0
      if lstat(endpoint.bootstrap.socketPath, &status) != 0, errno == ENOENT {
        do {
          try endpoint.cleanup()
          return true
        } catch {
          return false
        }
      }
      dependencies.sleep(10_000)
    }
    return false
  }

  private func deadline(after duration: UInt64) -> UInt64 {
    let (value, overflow) = dependencies.nowNanoseconds().addingReportingOverflow(duration)
    return overflow ? UInt64.max : value
  }
}
