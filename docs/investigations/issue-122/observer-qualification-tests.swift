import AppKit
import Foundation

private final class Issue122FakeProcess {
  let candidate: Issue121PreparedCandidate
  let processIdentifier: Int32
  var terminated = false
  var terminateResult = true

  init(candidate: Issue121PreparedCandidate, processIdentifier: Int32) {
    self.candidate = candidate
    self.processIdentifier = processIdentifier
  }

  func handle(snapshotProcessIdentifier: Int32? = nil) -> Issue122RunningApplicationHandle {
    Issue122RunningApplicationHandle(
      processIdentifier: processIdentifier,
      snapshot: {
        Issue121CandidateSnapshot(
          processIdentifier: snapshotProcessIdentifier ?? self.processIdentifier,
          applicationURL: self.candidate.applicationURL,
          executableURL: self.candidate.executableURL,
          bundleIdentifier: self.candidate.bundleIdentifier,
          executableSHA256: self.candidate.executableSHA256,
          isTerminated: self.terminated
        )
      },
      terminate: {
        guard self.terminateResult else { return false }
        self.terminated = true
        return true
      },
      isTerminated: { self.terminated }
    )
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
  running: @escaping () -> [Issue122RunningApplicationHandle]
) -> Issue122LaunchDependencies {
  Issue122LaunchDependencies(
    openApplication: { _, configuration in try await open(configuration) },
    runningApplications: { _ in running() },
    sleep: { _ in }
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
      try await issue122ExpectFailure(.cleanup) {
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
      try await issue122ExpectFailure(.cleanup) {
        _ = try await wrapper.launchExactCandidate()
      }
      try issue122Expect(returned.terminated, "wrong-returned-identity cleanup")
      count += 1
    }

    do {
      let process = Issue122FakeProcess(candidate: candidate, processIdentifier: 48)
      process.terminateResult = false
      var launched = false
      let handle = process.handle()
      let wrapper = Issue122QualificationWrapper(
        candidate: candidate,
        dependencies: issue122Dependencies(
          open: { _ in
            launched = true
            return handle
          },
          running: { launched ? [handle] : [] }
        )
      )
      let context = try await wrapper.launchExactCandidate()
      try issue122Expect(!wrapper.terminateAndCleanup(context), "termination uncertainty")
      process.terminateResult = true
      _ = process.handle().terminate()
      try? context.endpoint.cleanup()
      count += 1
    }

    print("issue122 Swift no-launch tests: \(count) passed")
  }
}
