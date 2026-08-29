import Darwin
import Foundation

@MainActor
func issue121RunSecurityPlatformTests(_ runner: inout Issue121TestRunner) throws {
  try runner.test("secure bootstrap is unpredictable canonical and owner only") {
    let first = try Issue121PrivateEndpoint.create()
    let second = try Issue121PrivateEndpoint.create()
    defer {
      try? first.cleanup()
      try? second.cleanup()
    }
    try issue121Expect(first.bootstrap.session != second.bootstrap.session, "sessions")
    try issue121Expect(first.bootstrap.capability != second.bootstrap.capability, "capabilities")
    try issue121Expect(first.bootstrap.session.count == 16, "session bytes")
    try issue121Expect(first.bootstrap.capability.count == 32, "capability bytes")
    try first.verifyNamespace(socketMustBeAbsent: true)
  }
  try runner.test("path policy rejects nested relative overlong and NUL") {
    for (directory, socket) in [
      ("relative", "relative/observer.sock"),
      ("/private/tmp/a/nested", "/private/tmp/a/nested/observer.sock"),
      ("/private/tmp/a", "/private/tmp/a/other.sock"),
      ("/private/tmp/a", "/private/tmp/a/observer.sock\0"),
      (
        "/private/tmp/" + String(repeating: "a", count: 110),
        "/private/tmp/" + String(repeating: "a", count: 110) + "/observer.sock"
      ),
    ] {
      try issue121ExpectFailure(.pathPolicy) {
        try Issue121PrivateEndpoint.validatePathPolicy(
          directoryPath: directory,
          socketPath: socket
        )
      }
    }
  }
  try runner.test("collision is preserved and cleanup fails closed") {
    let endpoint = try Issue121PrivateEndpoint.create()
    try Data("collision".utf8).write(to: URL(fileURLWithPath: endpoint.bootstrap.socketPath))
    try issue121ExpectFailure(.pathPolicy) {
      try endpoint.verifyNamespace(socketMustBeAbsent: true)
    }
    try issue121ExpectFailure(.cleanup) { try endpoint.cleanup() }
    try issue121Expect(
      try Data(contentsOf: URL(fileURLWithPath: endpoint.bootstrap.socketPath))
        == Data("collision".utf8),
      "preserved collision"
    )
    unlink(endpoint.bootstrap.socketPath)
    rmdir(endpoint.bootstrap.directoryPath)
  }
  try runner.test("wrong directory mode is terminal") {
    let endpoint = try Issue121PrivateEndpoint.create()
    chmod(endpoint.bootstrap.directoryPath, 0o755)
    try issue121ExpectFailure(.pathPolicy) {
      try endpoint.verifyNamespace(socketMustBeAbsent: true)
    }
    chmod(endpoint.bootstrap.directoryPath, 0o700)
    try endpoint.cleanup()
  }
  try runner.test("directory replacement is terminal and never removed") {
    let endpoint = try Issue121PrivateEndpoint.create()
    let replacementPath = endpoint.bootstrap.directoryPath
    let originalPath = replacementPath + ".original"
    try FileManager.default.moveItem(
      atPath: replacementPath,
      toPath: originalPath
    )
    try FileManager.default.createDirectory(
      atPath: replacementPath,
      withIntermediateDirectories: false,
      attributes: [.posixPermissions: 0o700]
    )
    try issue121ExpectFailure(.pathPolicy) {
      try endpoint.verifyNamespace(socketMustBeAbsent: true)
    }
    try issue121ExpectFailure(.cleanup) { try endpoint.cleanup() }
    var isDirectory: ObjCBool = false
    try issue121Expect(
      FileManager.default.fileExists(atPath: replacementPath, isDirectory: &isDirectory)
        && isDirectory.boolValue,
      "replacement preserved"
    )
    try FileManager.default.removeItem(atPath: replacementPath)
    try FileManager.default.removeItem(atPath: originalPath)
  }
  try runner.test("socket reads fail closed on timeout and disconnect") {
    var timeoutDescriptors = [Int32](repeating: -1, count: 2)
    try issue121Expect(
      socketpair(AF_UNIX, SOCK_STREAM, 0, &timeoutDescriptors) == 0,
      "socketpair"
    )
    let timeoutSocket = try Issue121ConnectedSocket.adoptConnectedDescriptorForTesting(
      timeoutDescriptors[0]
    )
    defer {
      timeoutSocket.closeIfNeeded()
      Darwin.close(timeoutDescriptors[1])
    }
    var timeoutDecoder = Issue121FrameStreamDecoder()
    try issue121ExpectFailure(.deadline) {
      _ = try timeoutSocket.readFrame(
        deadlineNanoseconds: DispatchTime.now().uptimeNanoseconds + 1_000_000,
        decoder: &timeoutDecoder
      )
    }

    var disconnectDescriptors = [Int32](repeating: -1, count: 2)
    try issue121Expect(
      socketpair(AF_UNIX, SOCK_STREAM, 0, &disconnectDescriptors) == 0,
      "disconnect socketpair"
    )
    let disconnectSocket = try Issue121ConnectedSocket.adoptConnectedDescriptorForTesting(
      disconnectDescriptors[0]
    )
    Darwin.close(disconnectDescriptors[1])
    defer { disconnectSocket.closeIfNeeded() }
    var disconnectDecoder = Issue121FrameStreamDecoder()
    try issue121ExpectFailure(.disconnect) {
      _ = try disconnectSocket.readFrame(
        deadlineNanoseconds: DispatchTime.now().uptimeNanoseconds + 1_000_000_000,
        decoder: &disconnectDecoder
      )
    }
  }
  try runner.test("socket adoption installs and verifies per-descriptor no-SIGPIPE policy") {
    var descriptors = [Int32](repeating: -1, count: 2)
    try issue121Expect(socketpair(AF_UNIX, SOCK_STREAM, 0, &descriptors) == 0, "socketpair")
    let socket = try Issue121ConnectedSocket.adoptConnectedDescriptorForTesting(descriptors[0])
    defer {
      socket.closeIfNeeded()
      Darwin.close(descriptors[1])
    }
    var noSignal: Int32 = 0
    var noSignalLength = socklen_t(MemoryLayout.size(ofValue: noSignal))
    try issue121Expect(
      getsockopt(descriptors[0], SOL_SOCKET, SO_NOSIGPIPE, &noSignal, &noSignalLength) == 0,
      "getsockopt"
    )
    try issue121Expect(
      noSignalLength == MemoryLayout.size(ofValue: noSignal) && noSignal == 1,
      "SO_NOSIGPIPE"
    )
  }
  try runner.test("socket adoption failure closes the descriptor with typed disconnect") {
    var descriptors = [Int32](repeating: -1, count: 2)
    try issue121Expect(pipe(&descriptors) == 0, "pipe")
    defer { Darwin.close(descriptors[1]) }
    try issue121ExpectFailure(.disconnect) {
      _ = try Issue121ConnectedSocket.adoptConnectedDescriptorForTesting(descriptors[0])
    }
    errno = 0
    try issue121Expect(
      fcntl(descriptors[0], F_GETFD) == -1 && errno == EBADF,
      "failed descriptor closed"
    )
  }
  try runner.test("socket retains coalesced frames without accepting unsolicited leftovers") {
    var descriptors = [Int32](repeating: -1, count: 2)
    try issue121Expect(socketpair(AF_UNIX, SOCK_STREAM, 0, &descriptors) == 0, "socketpair")
    let reader = try Issue121ConnectedSocket.adoptConnectedDescriptorForTesting(descriptors[0])
    let writer = try Issue121ConnectedSocket.adoptConnectedDescriptorForTesting(descriptors[1])
    defer {
      reader.closeIfNeeded()
      writer.closeIfNeeded()
    }
    try writer.writeAll(
      Issue121Codec.encode(issue121Frame(.ready))
        + Issue121Codec.encode(issue121Frame(.started, sequence: 1))
    )
    var decoder = Issue121FrameStreamDecoder()
    let deadline = DispatchTime.now().uptimeNanoseconds + 1_000_000_000
    try issue121Expect(
      try reader.readFrame(deadlineNanoseconds: deadline, decoder: &decoder)
        == issue121Frame(.ready),
      "ready"
    )
    try issue121ExpectFailure(.lifecycle) {
      try reader.requireNoUnsolicitedInput(decoder: decoder)
    }
    try issue121Expect(
      try reader.readFrame(deadlineNanoseconds: deadline, decoder: &decoder)
        == issue121Frame(.started, sequence: 1),
      "started"
    )
    try reader.requireNoUnsolicitedInput(decoder: decoder)
  }
  try runner.test("qualification rejects buffered available input and disconnect") {
    var descriptors = [Int32](repeating: -1, count: 2)
    try issue121Expect(socketpair(AF_UNIX, SOCK_STREAM, 0, &descriptors) == 0, "socketpair")
    let reader = try Issue121ConnectedSocket.adoptConnectedDescriptorForTesting(descriptors[0])
    let writer = try Issue121ConnectedSocket.adoptConnectedDescriptorForTesting(descriptors[1])
    var decoder = Issue121FrameStreamDecoder()
    try reader.requireNoUnsolicitedInput(decoder: decoder)
    try writer.writeAll(try Issue121Codec.encode(issue121Frame(.started, sequence: 1)))
    try issue121ExpectFailure(.lifecycle) {
      try reader.requireNoUnsolicitedInput(decoder: decoder)
    }
    _ = try reader.readFrame(
      deadlineNanoseconds: DispatchTime.now().uptimeNanoseconds + 1_000_000_000,
      decoder: &decoder
    )
    try reader.requireNoUnsolicitedInput(decoder: decoder)
    writer.closeIfNeeded()
    try issue121ExpectFailure(.disconnect) {
      try reader.requireNoUnsolicitedInput(decoder: decoder)
    }
    reader.closeIfNeeded()

    var bufferedDescriptors = [Int32](repeating: -1, count: 2)
    try issue121Expect(
      socketpair(AF_UNIX, SOCK_STREAM, 0, &bufferedDescriptors) == 0,
      "buffered socketpair"
    )
    let bufferedReader = try Issue121ConnectedSocket.adoptConnectedDescriptorForTesting(
      bufferedDescriptors[0]
    )
    let bufferedWriter = try Issue121ConnectedSocket.adoptConnectedDescriptorForTesting(
      bufferedDescriptors[1]
    )
    defer {
      bufferedReader.closeIfNeeded()
      bufferedWriter.closeIfNeeded()
    }
    var partialDecoder = Issue121FrameStreamDecoder()
    _ = try partialDecoder.append([UInt8(ascii: "T")])
    try issue121ExpectFailure(.lifecycle) {
      try bufferedReader.requireNoUnsolicitedInput(decoder: partialDecoder)
    }
  }
  try runner.test("launch plan contains exactly five future values and no activation") {
    let endpoint = try Issue121PrivateEndpoint.create()
    defer { try? endpoint.cleanup() }
    let candidate = Issue121PreparedCandidate(
      applicationURL: URL(fileURLWithPath: "/Applications/Exact.app"),
      executableURL: URL(fileURLWithPath: "/Applications/Exact.app/Contents/MacOS/Exact"),
      bundleIdentifier: "app.ttrpgmap.generator",
      executableSHA256: String(repeating: "a", count: 64)
    )
    let plan = try endpoint.launchPlan(candidate: candidate, controllerProcessIdentifier: 1234)
    try issue121Expect(plan.environment.count == 5, "five values")
    try issue121Expect(
      Set(plan.environment.keys)
        == Set([
          "TTRPG_OBSERVER_SOCKET_PATH", "TTRPG_OBSERVER_SESSION",
          "TTRPG_OBSERVER_CAPABILITY", "TTRPG_OBSERVER_CONTROLLER_PID",
          "TTRPG_OBSERVER_CANDIDATE_SHA256",
        ]),
      "exact names"
    )
    try issue121Expect(!plan.activates && !plan.addsToRecentItems, "no activation")
    try issue121Expect(plan.createsNewApplicationInstance, "fresh instance")
    let configuration = Issue121PrivateEndpoint.openConfiguration(for: plan)
    try issue121Expect(configuration.environment == plan.environment, "configuration environment")
    try issue121Expect(!configuration.activates, "configuration activation")
    try issue121Expect(!configuration.addsToRecentItems, "configuration recents")
    try issue121Expect(configuration.createsNewApplicationInstance, "configuration instance")
  }
  try runner.test("candidate identity requires retained PID bundle path executable and digest") {
    let retained = Issue121RetainedCandidate(
      processIdentifier: 44,
      applicationURL: URL(fileURLWithPath: "/private/tmp/Exact.app"),
      executableURL: URL(fileURLWithPath: "/private/tmp/Exact.app/Contents/MacOS/Exact"),
      bundleIdentifier: "app.ttrpgmap.generator",
      executableSHA256: String(repeating: "a", count: 64)
    )
    let valid = Issue121CandidateSnapshot(
      processIdentifier: 44,
      applicationURL: retained.applicationURL,
      executableURL: retained.executableURL,
      bundleIdentifier: retained.bundleIdentifier,
      executableSHA256: retained.executableSHA256,
      isTerminated: false
    )
    try Issue121CandidateIdentity.validateRetained(retained, snapshot: valid)
    let invalid = [
      Issue121CandidateSnapshot(
        processIdentifier: 45, applicationURL: valid.applicationURL,
        executableURL: valid.executableURL, bundleIdentifier: valid.bundleIdentifier,
        executableSHA256: valid.executableSHA256, isTerminated: false),
      Issue121CandidateSnapshot(
        processIdentifier: 44, applicationURL: URL(fileURLWithPath: "/private/tmp/Replaced.app"),
        executableURL: valid.executableURL, bundleIdentifier: valid.bundleIdentifier,
        executableSHA256: valid.executableSHA256, isTerminated: false),
      Issue121CandidateSnapshot(
        processIdentifier: 44, applicationURL: valid.applicationURL,
        executableURL: URL(fileURLWithPath: "/private/tmp/other"),
        bundleIdentifier: valid.bundleIdentifier, executableSHA256: valid.executableSHA256,
        isTerminated: false),
      Issue121CandidateSnapshot(
        processIdentifier: 44, applicationURL: valid.applicationURL,
        executableURL: valid.executableURL, bundleIdentifier: "wrong",
        executableSHA256: valid.executableSHA256, isTerminated: false),
      Issue121CandidateSnapshot(
        processIdentifier: 44, applicationURL: valid.applicationURL,
        executableURL: valid.executableURL, bundleIdentifier: valid.bundleIdentifier,
        executableSHA256: String(repeating: "b", count: 64), isTerminated: false),
      Issue121CandidateSnapshot(
        processIdentifier: 44, applicationURL: valid.applicationURL,
        executableURL: valid.executableURL, bundleIdentifier: valid.bundleIdentifier,
        executableSHA256: valid.executableSHA256, isTerminated: true),
    ]
    for snapshot in invalid {
      try issue121ExpectFailure(.candidateIdentity) {
        try Issue121CandidateIdentity.validateRetained(retained, snapshot: snapshot)
      }
    }
  }
  try runner.test("peer adapter checks effective UID and LOCAL_PEERPID") {
    var descriptors = [Int32](repeating: -1, count: 2)
    try issue121Expect(socketpair(AF_UNIX, SOCK_STREAM, 0, &descriptors) == 0, "socketpair")
    let socket = try Issue121ConnectedSocket.adoptConnectedDescriptorForTesting(descriptors[0])
    defer {
      socket.closeIfNeeded()
      Darwin.close(descriptors[1])
    }
    try socket.validatePeer(expectedUID: geteuid(), expectedPID: getpid())
    try issue121ExpectFailure(.peerIdentity) {
      try socket.validatePeer(expectedUID: geteuid() + 1, expectedPID: getpid())
    }
    try issue121ExpectFailure(.peerIdentity) {
      try socket.validatePeer(expectedUID: geteuid(), expectedPID: getpid() + 1)
    }
  }
  try runner.test("public results contain only sanitized fixed fields") {
    for failure in [
      Issue121Failure.candidateIdentity,
      .cleanupCandidate,
      .cleanupEndpoint,
      .cleanupCandidateAndEndpoint,
    ] {
      let data = try JSONEncoder().encode(Issue121PublicResult.invalid(failure))
      let rendered = String(decoding: data, as: UTF8.self)
      try issue121Expect(rendered.contains(failure.description), "authority")
      for privateValue in ["/private/tmp", "TMOC", "TTRPG_", String(getpid())] {
        try issue121Expect(!rendered.contains(privateValue), "private value")
      }
    }
  }
}

func issue121RunClosedPeerWriteChild() -> Never {
  _ = signal(SIGPIPE, SIG_DFL)
  var descriptors = [Int32](repeating: -1, count: 2)
  guard socketpair(AF_UNIX, SOCK_STREAM, 0, &descriptors) == 0 else { exit(3) }
  do {
    let socket = try Issue121ConnectedSocket.adoptConnectedDescriptorForTesting(descriptors[0])
    Darwin.close(descriptors[1])
    do {
      try socket.writeAll(
        [0x54, 0x4d, 0x4f, 0x43],
        deadlineNanoseconds: DispatchTime.now().uptimeNanoseconds + 1_000_000_000
      )
      socket.closeIfNeeded()
      exit(4)
    } catch let failure as Issue121Failure {
      socket.closeIfNeeded()
      guard failure == .disconnect else { exit(5) }
      print(failure.description)
      exit(0)
    }
  } catch {
    Darwin.close(descriptors[1])
    exit(6)
  }
}
