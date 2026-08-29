import AppKit
import Foundation

private final class Issue122FakeProcess {
  let candidate: Issue121PreparedCandidate
  let processIdentifier: Int32
  var terminated = false
  var terminateResult = true
  var terminatesWhenRequested = true
  var terminateCallCount = 0
  var snapshotProcessIdentifier: Int32?

  init(candidate: Issue121PreparedCandidate, processIdentifier: Int32) {
    self.candidate = candidate
    self.processIdentifier = processIdentifier
  }

  func handle(snapshotProcessIdentifier: Int32? = nil) -> Issue122RunningApplicationHandle {
    Issue122RunningApplicationHandle(
      processIdentifier: processIdentifier,
      snapshot: {
        Issue121CandidateSnapshot(
          processIdentifier: snapshotProcessIdentifier ?? self.snapshotProcessIdentifier
            ?? self.processIdentifier,
          applicationURL: self.candidate.applicationURL,
          executableURL: self.candidate.executableURL,
          bundleIdentifier: self.candidate.bundleIdentifier,
          executableSHA256: self.candidate.executableSHA256,
          isTerminated: self.terminated
        )
      },
      terminate: {
        self.terminateCallCount += 1
        guard self.terminateResult else { return false }
        if self.terminatesWhenRequested { self.terminated = true }
        return true
      },
      isTerminated: { self.terminated }
    )
  }
}

private final class Issue122FakeClock {
  var nowNanoseconds: UInt64 = 1
  var sleepCount = 0
  var onSleep: ((Int) -> Void)?

  func sleep(_ useconds: useconds_t) {
    sleepCount += 1
    nowNanoseconds += UInt64(useconds) * 1_000
    onSleep?(sleepCount)
  }
}

private struct Issue122TestFailure: Error, CustomStringConvertible {
  let description: String
}

private func issue122Expect(_ condition: @autoclosure () -> Bool, _ message: String) throws {
  guard condition() else { throw Issue122TestFailure(description: message) }
}

private func issue122ExpectFailure(
  _ expected: Issue121Failure,
  _ body: () async throws -> Void
) async throws {
  do {
    try await body()
    throw Issue122TestFailure(description: "expected \(expected)")
  } catch let actual as Issue121Failure {
    try issue122Expect(actual == expected, "expected \(expected), received \(actual)")
  }
}

@MainActor
private func issue122Candidate() -> Issue121PreparedCandidate {
  Issue121PreparedCandidate(
    applicationURL: URL(fileURLWithPath: "/Applications/Exact.app"),
    executableURL: URL(fileURLWithPath: "/Applications/Exact.app/Contents/MacOS/Exact"),
    bundleIdentifier: "app.ttrpgmap.generator",
    executableSHA256: String(repeating: "a", count: 64)
  )
}

@MainActor
private func issue122Dependencies(
  open: @escaping (NSWorkspace.OpenConfiguration) async throws -> Issue122RunningApplicationHandle,
  running: @escaping () -> [Issue122RunningApplicationHandle],
  processSnapshot: ((Issue121RetainedCandidate) -> Issue121CandidateSnapshot)? = nil,
  clock: Issue122FakeClock = Issue122FakeClock()
) -> Issue122LaunchDependencies {
  Issue122LaunchDependencies(
    openApplication: { _, configuration in try await open(configuration) },
    runningApplications: { _ in running() },
    processSnapshot: processSnapshot ?? { retainedCandidate in
      running().first { $0.processIdentifier == retainedCandidate.processIdentifier }?.snapshot()
        ?? Issue121CandidateSnapshot(
          processIdentifier: retainedCandidate.processIdentifier,
          applicationURL: nil,
          executableURL: nil,
          bundleIdentifier: nil,
          executableSHA256: nil,
          isTerminated: true
        )
    },
    nowNanoseconds: { clock.nowNanoseconds },
    sleep: { clock.sleep($0) }
  )
}

@main
enum Issue122QualificationTests {
  @MainActor
  static func main() async throws {
    var count = 0
    let candidate = issue122Candidate()

    do {
      let process = Issue122FakeProcess(candidate: candidate, processIdentifier: 41)
      var launched = false
      var running = [Issue122RunningApplicationHandle]()
      let handle = process.handle()
      let wrapper = Issue122QualificationWrapper(
        candidate: candidate,
        dependencies: issue122Dependencies(
          open: { configuration in
            launched = true
            try issue122Expect(!configuration.activates, "nonactivating")
            try issue122Expect(!configuration.addsToRecentItems, "no recents")
            try issue122Expect(configuration.createsNewApplicationInstance, "fresh instance")
            try issue122Expect(configuration.environment.count == 5, "five-value environment")
            running = [handle]
            return handle
          },
          running: { running.filter { !$0.isTerminated() } }
        ),
        controllerProcessIdentifier: 99
      )
      let context = try await wrapper.launchExactCandidate()
      try issue122Expect(launched, "injected launch")
      try issue122Expect(context.retainedCandidate.processIdentifier == 41, "retained PID")
      try issue122Expect(wrapper.terminateAndCleanup(context), "termination and cleanup")
      try issue122Expect(process.terminated, "terminated")
      try issue122Expect(process.terminateCallCount == 1, "one termination request")
      count += 1
    }

    do {
      let process = Issue122FakeProcess(candidate: candidate, processIdentifier: 42)
      var launchCount = 0
      let wrapper = Issue122QualificationWrapper(
        candidate: candidate,
        dependencies: issue122Dependencies(
          open: { _ in
            launchCount += 1
            return process.handle()
          },
          running: { [process.handle()] }
        )
      )
      try await issue122ExpectFailure(.candidateIdentity) {
        _ = try await wrapper.launchExactCandidate()
      }
      try issue122Expect(launchCount == 0, "prelaunch collision")
      count += 1
    }

    do {
      let process = Issue122FakeProcess(candidate: candidate, processIdentifier: 43)
      var launched = false
      let wrapper = Issue122QualificationWrapper(
        candidate: candidate,
        dependencies: issue122Dependencies(
          open: { _ in
            launched = true
            return process.handle()
          },
          running: { launched ? [] : [] }
        )
      )
      try await issue122ExpectFailure(.candidateIdentity) {
        _ = try await wrapper.launchExactCandidate()
      }
      try issue122Expect(process.terminated, "zero-candidate cleanup")
      count += 1
    }

    do {
      let first = Issue122FakeProcess(candidate: candidate, processIdentifier: 44)
      let second = Issue122FakeProcess(candidate: candidate, processIdentifier: 45)
      var launched = false
      let firstHandle = first.handle()
      let secondHandle = second.handle()
      let wrapper = Issue122QualificationWrapper(
        candidate: candidate,
        dependencies: issue122Dependencies(
          open: { _ in
            launched = true
            return firstHandle
          },
          running: { launched ? [firstHandle, secondHandle] : [] }
        )
      )
      try await issue122ExpectFailure(.cleanupCandidate) {
        _ = try await wrapper.launchExactCandidate()
      }
      try issue122Expect(first.terminated, "multiple-candidate cleanup")
      count += 1
    }

    do {
      let returned = Issue122FakeProcess(candidate: candidate, processIdentifier: 46)
      let other = Issue122FakeProcess(candidate: candidate, processIdentifier: 47)
      var launched = false
      let returnedHandle = returned.handle()
      let otherHandle = other.handle()
      let wrapper = Issue122QualificationWrapper(
        candidate: candidate,
        dependencies: issue122Dependencies(
          open: { _ in
            launched = true
            return returnedHandle
          },
          running: { launched ? [otherHandle] : [] }
        )
      )
      try await issue122ExpectFailure(.cleanupCandidate) {
        _ = try await wrapper.launchExactCandidate()
      }
      try issue122Expect(returned.terminated, "wrong-returned-identity cleanup")
      count += 1
    }

    do {
      let process = Issue122FakeProcess(candidate: candidate, processIdentifier: 48)
      var launched = false
      var endpointDirectoryPath: String?
      var endpointExistedDuringAbsenceScan = false
      let handle = process.handle()
      let wrapper = Issue122QualificationWrapper(
        candidate: candidate,
        dependencies: issue122Dependencies(
          open: { _ in
            launched = true
            return handle
          },
          running: {
            if launched, process.terminated {
              if let endpointDirectoryPath {
                endpointExistedDuringAbsenceScan = FileManager.default.fileExists(
                  atPath: endpointDirectoryPath
                )
              }
              return []
            }
            return launched ? [handle] : []
          }
        )
      )
      let context = try await wrapper.launchExactCandidate()
      endpointDirectoryPath = context.endpoint.bootstrap.directoryPath
      process.terminated = true
      try issue122Expect(wrapper.terminateAndCleanup(context), "idempotent terminated cleanup")
      try issue122Expect(process.terminateCallCount == 0, "no redundant termination request")
      try issue122Expect(endpointExistedDuringAbsenceScan, "absence precedes endpoint cleanup")
      try issue122Expect(
        !FileManager.default.fileExists(atPath: context.endpoint.bootstrap.directoryPath),
        "endpoint cleaned after absence"
      )
      count += 1
    }

    do {
      let process = Issue122FakeProcess(candidate: candidate, processIdentifier: 49)
      process.terminateResult = false
      var launched = false
      let handle = process.handle()
      let clock = Issue122FakeClock()
      clock.onSleep = { _ in process.terminated = true }
      let wrapper = Issue122QualificationWrapper(
        candidate: candidate,
        dependencies: issue122Dependencies(
          open: { _ in
            launched = true
            return handle
          },
          running: { launched && !process.terminated ? [handle] : [] },
          clock: clock
        )
      )
      let context = try await wrapper.launchExactCandidate()
      try issue122Expect(wrapper.terminateAndCleanup(context), "false-return termination race")
      try issue122Expect(process.terminateCallCount == 1, "one raced termination request")
      try issue122Expect(clock.sleepCount == 1, "bounded race observation")
      count += 1
    }

    do {
      let process = Issue122FakeProcess(candidate: candidate, processIdentifier: 58)
      let staleScan = Issue122FakeProcess(candidate: candidate, processIdentifier: 58)
      var launched = false
      var staleScanVisible = true
      let retainedHandle = process.handle()
      let staleScanHandle = staleScan.handle()
      let clock = Issue122FakeClock()
      clock.onSleep = { _ in staleScanVisible = false }
      let wrapper = Issue122QualificationWrapper(
        candidate: candidate,
        dependencies: issue122Dependencies(
          open: { _ in
            launched = true
            return retainedHandle
          },
          running: {
            guard launched else { return [] }
            if !process.terminated { return [retainedHandle] }
            return staleScanVisible ? [staleScanHandle] : []
          },
          processSnapshot: { _ in retainedHandle.snapshot() },
          clock: clock
        )
      )
      let context = try await wrapper.launchExactCandidate()
      process.terminated = true
      try issue122Expect(wrapper.terminateAndCleanup(context), "stale retained scan settles absent")
      try issue122Expect(process.terminateCallCount == 0, "stale scan did not trigger terminate")
      try issue122Expect(clock.sleepCount == 1, "stale scan waited within bound")
      count += 1
    }

    do {
      let process = Issue122FakeProcess(candidate: candidate, processIdentifier: 50)
      process.terminated = true
      let replacement = Issue122FakeProcess(candidate: candidate, processIdentifier: 51)
      var launched = false
      let launchHandle = process.handle()
      let replacementHandle = replacement.handle()
      let wrapper = Issue122QualificationWrapper(
        candidate: candidate,
        dependencies: issue122Dependencies(
          open: { _ in
            process.terminated = false
            launched = true
            return launchHandle
          },
          running: {
            guard launched else { return [] }
            return process.terminated ? [replacementHandle] : [launchHandle]
          }
        )
      )
      let context = try await wrapper.launchExactCandidate()
      process.terminated = true
      try issue122Expect(!wrapper.terminateAndCleanup(context), "replacement rejection")
      try issue122Expect(process.terminateCallCount == 0, "replacement did not trigger terminate")
      count += 1
    }

    do {
      let process = Issue122FakeProcess(candidate: candidate, processIdentifier: 52)
      let replacement = Issue122FakeProcess(candidate: candidate, processIdentifier: 53)
      var launched = false
      var includeReplacement = false
      let handle = process.handle()
      let replacementHandle = replacement.handle()
      let wrapper = Issue122QualificationWrapper(
        candidate: candidate,
        dependencies: issue122Dependencies(
          open: { _ in
            launched = true
            return handle
          },
          running: {
            launched ? (includeReplacement ? [handle, replacementHandle] : [handle]) : []
          }
        )
      )
      let context = try await wrapper.launchExactCandidate()
      includeReplacement = true
      try issue122Expect(!wrapper.terminateAndCleanup(context), "multiple-candidate rejection")
      try issue122Expect(process.terminateCallCount == 0, "ambiguous scan did not terminate")
      process.terminated = true
      count += 1
    }

    do {
      let process = Issue122FakeProcess(candidate: candidate, processIdentifier: 54)
      var launched = false
      let handle = process.handle()
      let wrapper = Issue122QualificationWrapper(
        candidate: candidate,
        dependencies: issue122Dependencies(
          open: { _ in
            launched = true
            return handle
          },
          running: { launched && !process.terminated ? [handle] : [] },
          processSnapshot: { _ in handle.snapshot() }
        )
      )
      let context = try await wrapper.launchExactCandidate()
      process.snapshotProcessIdentifier = 999
      process.terminated = true
      try issue122Expect(!wrapper.terminateAndCleanup(context), "wrong retained PID rejection")
      try issue122Expect(process.terminateCallCount == 0, "wrong PID did not terminate")
      process.terminated = true
      count += 1
    }

    do {
      let process = Issue122FakeProcess(candidate: candidate, processIdentifier: 55)
      let wrongCandidate = Issue121PreparedCandidate(
        applicationURL: candidate.applicationURL,
        executableURL: candidate.executableURL,
        bundleIdentifier: candidate.bundleIdentifier,
        executableSHA256: String(repeating: "b", count: 64)
      )
      let wrong = Issue122FakeProcess(candidate: wrongCandidate, processIdentifier: 55)
      var launched = false
      var useWrongScan = false
      let handle = process.handle()
      let wrongHandle = wrong.handle()
      let wrapper = Issue122QualificationWrapper(
        candidate: candidate,
        dependencies: issue122Dependencies(
          open: { _ in
            launched = true
            return handle
          },
          running: { launched ? [useWrongScan ? wrongHandle : handle] : [] }
        )
      )
      let context = try await wrapper.launchExactCandidate()
      useWrongScan = true
      try issue122Expect(!wrapper.terminateAndCleanup(context), "wrong identity rejection")
      try issue122Expect(process.terminateCallCount == 0, "wrong identity did not terminate")
      process.terminated = true
      count += 1
    }

    do {
      let process = Issue122FakeProcess(candidate: candidate, processIdentifier: 56)
      process.terminateResult = false
      var launched = false
      let handle = process.handle()
      let clock = Issue122FakeClock()
      let wrapper = Issue122QualificationWrapper(
        candidate: candidate,
        dependencies: issue122Dependencies(
          open: { _ in
            launched = true
            return handle
          },
          running: { launched ? [handle] : [] },
          clock: clock
        )
      )
      let context = try await wrapper.launchExactCandidate()
      try issue122Expect(!wrapper.terminateAndCleanup(context), "nontermination deadline")
      try issue122Expect(process.terminateCallCount == 1, "no repeated termination request")
      try issue122Expect(clock.nowNanoseconds == 5_000_000_001, "five-second deadline")
      process.terminated = true
      count += 1
    }

    do {
      let process = Issue122FakeProcess(candidate: candidate, processIdentifier: 57)
      process.terminatesWhenRequested = false
      var launched = false
      let handle = process.handle()
      let clock = Issue122FakeClock()
      let wrapper = Issue122QualificationWrapper(
        candidate: candidate,
        dependencies: issue122Dependencies(
          open: { _ in
            launched = true
            return handle
          },
          running: { launched ? [handle] : [] },
          clock: clock
        )
      )
      let context = try await wrapper.launchExactCandidate()
      try issue122Expect(!wrapper.terminateAndCleanup(context), "accepted request nontermination")
      try issue122Expect(process.terminateCallCount == 1, "accepted request issued once")
      try issue122Expect(clock.nowNanoseconds == 5_000_000_001, "accepted request deadline")
      process.terminated = true
      count += 1
    }

    do {
      let process = Issue122FakeProcess(candidate: candidate, processIdentifier: 59)
      var launched = false
      var kernelTerminated = false
      let frozenHandle = process.handle()
      let wrapper = Issue122QualificationWrapper(
        candidate: candidate,
        dependencies: issue122Dependencies(
          open: { _ in
            launched = true
            return frozenHandle
          },
          running: { launched && !kernelTerminated ? [frozenHandle] : [] },
          processSnapshot: { retainedCandidate in
            if kernelTerminated {
              return Issue121CandidateSnapshot(
                processIdentifier: retainedCandidate.processIdentifier,
                applicationURL: nil,
                executableURL: nil,
                bundleIdentifier: nil,
                executableSHA256: nil,
                isTerminated: true
              )
            }
            return frozenHandle.snapshot()
          }
        )
      )
      let context = try await wrapper.launchExactCandidate()
      kernelTerminated = true
      try issue122Expect(!frozenHandle.isTerminated(), "retained handle remains frozen live")
      try issue122Expect(wrapper.terminateAndCleanup(context), "kernel termination wins")
      try issue122Expect(process.terminateCallCount == 0, "no redundant termination request")
      count += 1
    }

    do {
      let process = Issue122FakeProcess(candidate: candidate, processIdentifier: 60)
      var launched = false
      var scanAbsent = false
      let handle = process.handle()
      let clock = Issue122FakeClock()
      let wrapper = Issue122QualificationWrapper(
        candidate: candidate,
        dependencies: issue122Dependencies(
          open: { _ in
            launched = true
            return handle
          },
          running: { launched && !scanAbsent ? [handle] : [] },
          processSnapshot: { _ in handle.snapshot() },
          clock: clock
        )
      )
      let context = try await wrapper.launchExactCandidate()
      scanAbsent = true
      try issue122Expect(!wrapper.terminateAndCleanup(context), "kernel-live absence fails closed")
      try issue122Expect(
        process.terminateCallCount == 0, "absence does not terminate unknown state")
      try issue122Expect(clock.nowNanoseconds == 5_000_000_001, "kernel-live deadline")
      process.terminated = true
      count += 1
    }

    do {
      let candidateOnly =
        Issue121ObserverController.terminalError(
          operationError: nil,
          candidateCleanupSucceeded: false,
          endpointCleanupSucceeded: true
        ) as? Issue121Failure
      let endpointOnly =
        Issue121ObserverController.terminalError(
          operationError: nil,
          candidateCleanupSucceeded: true,
          endpointCleanupSucceeded: false
        ) as? Issue121Failure
      let both =
        Issue121ObserverController.terminalError(
          operationError: nil,
          candidateCleanupSucceeded: false,
          endpointCleanupSucceeded: false
        ) as? Issue121Failure
      let operationFirst =
        Issue121ObserverController.terminalError(
          operationError: Issue121Failure.deadline,
          candidateCleanupSucceeded: false,
          endpointCleanupSucceeded: false
        ) as? Issue121Failure
      try issue122Expect(candidateOnly == .cleanupCandidate, "candidate-only cleanup token")
      try issue122Expect(endpointOnly == .cleanupEndpoint, "endpoint-only cleanup token")
      try issue122Expect(both == .cleanupCandidateAndEndpoint, "combined cleanup token")
      try issue122Expect(operationFirst == .deadline, "operation error is not masked")
      count += 1
    }

    print("issue122 Swift no-launch tests: \(count) passed")
  }
}
