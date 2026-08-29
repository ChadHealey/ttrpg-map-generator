import Darwin
import Foundation

struct Issue121PublicResult: Codable, Equatable {
  let controllerVersion: String
  let status: String
  let commandCount: Int
  let terminalCleanupSucceeded: Bool
  let invalidAuthority: String?

  static func valid(commandCount: Int, cleanup: Bool) -> Issue121PublicResult {
    Issue121PublicResult(
      controllerVersion: "issue121-observer-client-v1",
      status: "valid",
      commandCount: commandCount,
      terminalCleanupSucceeded: cleanup,
      invalidAuthority: nil
    )
  }

  static func invalid(_ failure: Issue121Failure) -> Issue121PublicResult {
    Issue121PublicResult(
      controllerVersion: "issue121-observer-client-v1",
      status: "invalid",
      commandCount: 0,
      terminalCleanupSucceeded: false,
      invalidAuthority: failure.description
    )
  }
}

struct Issue121ObserverController {
  let endpoint: Issue121PrivateEndpoint
  let retainedCandidate: Issue121RetainedCandidate
  let candidateSnapshot: () -> Issue121CandidateSnapshot
  let terminalCandidateCleanup: () -> Bool
  let deadlinePolicy: Issue121DeadlinePolicy

  func qualify() throws -> Issue121PublicResult {
    let completions = try run(commands: [])
    guard completions.isEmpty else { throw Issue121Failure.lifecycle }
    return .valid(commandCount: 0, cleanup: true)
  }

  func execute(_ commands: [Issue121Command]) throws -> [Issue121Completion] {
    guard !commands.isEmpty else { throw Issue121Failure.usage }
    return try run(commands: commands)
  }

  private func run(commands: [Issue121Command]) throws -> [Issue121Completion] {
    let authenticationDeadline = deadline(after: deadlinePolicy.authenticationNanoseconds)
    var session = try Issue121ControllerSession(
      session: endpoint.bootstrap.session,
      capability: endpoint.bootstrap.capability,
      privateValues: endpoint.bootstrap.privateValues + [
        String(retainedCandidate.processIdentifier),
        retainedCandidate.applicationURL.path,
        retainedCandidate.executableURL.path,
        retainedCandidate.executableSHA256,
      ]
    )
    var decoder = Issue121FrameStreamDecoder()
    var completed = [Issue121Completion]()
    var operationError: (any Error)?
    var connectedSocket: Issue121ConnectedSocket?
    do {
      let socketIdentity = try endpoint.socketIdentityForConnect(
        deadlineNanoseconds: authenticationDeadline
      )
      let socket = try Issue121ConnectedSocket.connect(
        path: endpoint.bootstrap.socketPath,
        deadlineNanoseconds: authenticationDeadline
      )
      connectedSocket = socket
      try socket.validatePeer(
        expectedUID: geteuid(),
        expectedPID: retainedCandidate.processIdentifier
      )
      try endpoint.verifySocketIdentity(socketIdentity)
      try Issue121CandidateIdentity.validateRetained(
        retainedCandidate,
        snapshot: candidateSnapshot()
      )
      guard DispatchTime.now().uptimeNanoseconds < authenticationDeadline else {
        throw Issue121Failure.deadline
      }
      try socket.writeAll(
        try Issue121Codec.encode(session.hello()),
        deadlineNanoseconds: authenticationDeadline
      )
      let ready = try socket.readFrame(
        deadlineNanoseconds: deadline(after: deadlinePolicy.readyNanoseconds),
        decoder: &decoder
      )
      try session.receiveReady(ready)
      try socket.requireNoUnsolicitedInput(decoder: decoder)

      if commands.isEmpty {
        try session.finishQualification()
      } else {
        for command in commands {
          let commandFrame = try session.command(command)
          let startedDeadline = deadline(after: deadlinePolicy.startedNanoseconds)
          try socket.writeAll(
            try Issue121Codec.encode(commandFrame),
            deadlineNanoseconds: startedDeadline
          )
          let started = try socket.readFrame(
            deadlineNanoseconds: startedDeadline,
            decoder: &decoder
          )
          try session.receiveStarted(started)
          let complete = try socket.readFrame(
            deadlineNanoseconds: deadline(after: deadlinePolicy.completionNanoseconds),
            decoder: &decoder
          )
          completed.append(try session.receiveCompletion(complete))
          try socket.requireNoBufferedInput(decoder: decoder)
        }
      }
    } catch {
      operationError = error
    }
    session.invalidate()
    connectedSocket?.closeIfNeeded()
    let candidateCleanupSucceeded = terminalCandidateCleanup()
    let endpointCleanupSucceeded = waitForEndpointRemovalAndCleanup()
    if let terminalError = Self.terminalError(
      operationError: operationError,
      candidateCleanupSucceeded: candidateCleanupSucceeded,
      endpointCleanupSucceeded: endpointCleanupSucceeded
    ) {
      throw terminalError
    }
    return completed
  }

  static func terminalError(
    operationError: (any Error)?,
    candidateCleanupSucceeded: Bool,
    endpointCleanupSucceeded: Bool
  ) -> (any Error)? {
    if let operationError { return operationError }
    return Issue121Failure.terminalCleanupFailure(
      candidateSucceeded: candidateCleanupSucceeded,
      endpointSucceeded: endpointCleanupSucceeded
    )
  }

  private func deadline(after duration: UInt64) -> UInt64 {
    let (value, overflow) = DispatchTime.now().uptimeNanoseconds.addingReportingOverflow(duration)
    return overflow ? UInt64.max : value
  }

  private func waitForEndpointRemovalAndCleanup() -> Bool {
    let deadline = DispatchTime.now().uptimeNanoseconds + 1_000_000_000
    while DispatchTime.now().uptimeNanoseconds < deadline {
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
      usleep(10_000)
    }
    return false
  }
}

enum Issue121InteropClient {
  static func run(environment: [String: String]) throws -> Issue121PublicResult {
    let context = try context(environment: environment)
    let socketIdentity = try Issue121PrivateEndpoint.validateSocketNode(context.socketPath)
    let socket = try Issue121ConnectedSocket.connect(
      path: context.socketPath,
      deadlineNanoseconds: DispatchTime.now().uptimeNanoseconds + 5_000_000_000
    )
    defer { socket.closeIfNeeded() }
    try socket.validatePeer(
      expectedUID: geteuid(),
      expectedPID: context.retainedCandidate.processIdentifier
    )
    guard try Issue121PrivateEndpoint.validateSocketNode(context.socketPath) == socketIdentity
    else {
      throw Issue121Failure.pathPolicy
    }
    try Issue121CandidateIdentity.validateRetained(
      context.retainedCandidate,
      snapshot: Issue121CandidateIdentity.processPathSnapshot(retained: context.retainedCandidate)
    )
    var controller = try Issue121ControllerSession(
      session: context.session,
      capability: context.capability,
      privateValues: context.privateValues
    )
    var decoder = Issue121FrameStreamDecoder()
    let authenticationDeadline = DispatchTime.now().uptimeNanoseconds + 5_000_000_000
    try socket.writeAll(
      try Issue121Codec.encode(controller.hello()),
      fragmentBytes: 1,
      deadlineNanoseconds: authenticationDeadline
    )
    let ready = try socket.readFrame(
      deadlineNanoseconds: DispatchTime.now().uptimeNanoseconds + 30_000_000_000,
      decoder: &decoder
    )
    try controller.receiveReady(ready)
    try socket.requireNoUnsolicitedInput(decoder: decoder)
    let command = try controller.command(.coarsePreview)
    let startedDeadline = DispatchTime.now().uptimeNanoseconds + 2_000_000_000
    try socket.writeAll(
      try Issue121Codec.encode(command),
      fragmentBytes: 1,
      deadlineNanoseconds: startedDeadline
    )
    let started = try socket.readFrame(
      deadlineNanoseconds: startedDeadline,
      decoder: &decoder
    )
    try controller.receiveStarted(started)
    let complete = try socket.readFrame(
      deadlineNanoseconds: DispatchTime.now().uptimeNanoseconds + 120_000_000_000,
      decoder: &decoder
    )
    let receipt = try controller.receiveCompletion(complete)
    try socket.requireNoBufferedInput(decoder: decoder)
    guard receipt.status == 0, receipt.receipt == "{\"interop\":\"production-rust-authority\"}"
    else {
      throw Issue121Failure.receipt
    }
    return .valid(commandCount: 1, cleanup: true)
  }

  static func qualify(environment: [String: String]) throws -> Issue121PublicResult {
    let context = try context(environment: environment)
    let endpoint = try Issue121PrivateEndpoint.adoptNoLaunchInterop(
      bootstrap: Issue121Bootstrap(
        directoryPath: URL(fileURLWithPath: context.socketPath).deletingLastPathComponent().path,
        socketPath: context.socketPath,
        session: context.session,
        capability: context.capability
      )
    )
    let retainedCandidate = context.retainedCandidate
    return try Issue121ObserverController(
      endpoint: endpoint,
      retainedCandidate: retainedCandidate,
      candidateSnapshot: {
        Issue121CandidateIdentity.processPathSnapshot(retained: retainedCandidate)
      },
      terminalCandidateCleanup: {
        do {
          try Issue121CandidateIdentity.validateRetained(
            retainedCandidate,
            snapshot: Issue121CandidateIdentity.processPathSnapshot(retained: retainedCandidate)
          )
          return true
        } catch {
          return false
        }
      },
      deadlinePolicy: .fixed
    ).qualify()
  }

  private struct Context {
    let socketPath: String
    let session: [UInt8]
    let capability: [UInt8]
    let retainedCandidate: Issue121RetainedCandidate

    var privateValues: [String] {
      [
        socketPath, Issue121Hex.encode(session), Issue121Hex.encode(capability),
        String(retainedCandidate.processIdentifier), retainedCandidate.executableURL.path,
        retainedCandidate.applicationURL.path, retainedCandidate.executableSHA256,
      ]
    }
  }

  private static func context(environment: [String: String]) throws -> Context {
    let socketPath = try value("ISSUE121_INTEROP_SOCKET_PATH", environment: environment)
    let session = try Issue121Hex.decode(
      value("ISSUE121_INTEROP_SESSION", environment: environment), byteCount: 16
    )
    let capability = try Issue121Hex.decode(
      value("ISSUE121_INTEROP_CAPABILITY", environment: environment), byteCount: 32
    )
    guard
      let candidatePID = Int32(
        try value("ISSUE121_INTEROP_CANDIDATE_PID", environment: environment)
      ), candidatePID > 0
    else { throw Issue121Failure.usage }
    let candidateExecutable = URL(
      fileURLWithPath: try value("ISSUE121_INTEROP_CANDIDATE_EXECUTABLE", environment: environment)
    ).resolvingSymlinksInPath()
    let candidateApplication = URL(
      fileURLWithPath: try value("ISSUE121_INTEROP_CANDIDATE_BUNDLE", environment: environment),
      isDirectory: true
    ).resolvingSymlinksInPath()
    let candidateBundleIdentifier = try value(
      "ISSUE121_INTEROP_CANDIDATE_BUNDLE_ID", environment: environment
    )
    let candidateDigest = try value(
      "ISSUE121_INTEROP_CANDIDATE_SHA256", environment: environment
    )
    guard Issue121CandidateIdentity.isCanonicalDigest(candidateDigest) else {
      throw Issue121Failure.usage
    }
    try Issue121PrivateEndpoint.validatePathPolicy(
      directoryPath: URL(fileURLWithPath: socketPath).deletingLastPathComponent().path,
      socketPath: socketPath
    )
    return Context(
      socketPath: socketPath,
      session: session,
      capability: capability,
      retainedCandidate: Issue121RetainedCandidate(
        processIdentifier: candidatePID,
        applicationURL: candidateApplication,
        executableURL: candidateExecutable,
        bundleIdentifier: candidateBundleIdentifier,
        executableSHA256: candidateDigest
      )
    )
  }

  private static func value(_ name: String, environment: [String: String]) throws -> String {
    guard let value = environment[name], !value.isEmpty else { throw Issue121Failure.usage }
    return value
  }
}
