import AppKit
import Darwin
import Foundation
import Security

private let issue121PrivateTemporaryDirectory = "/private/tmp"
private let issue121DarwinSocketPathBytes = 104

struct Issue121Bootstrap: Equatable {
  let directoryPath: String
  let socketPath: String
  let session: [UInt8]
  let capability: [UInt8]

  var privateValues: [String] {
    [directoryPath, socketPath, Issue121Hex.encode(session), Issue121Hex.encode(capability)]
  }
}

struct Issue121SocketNodeIdentity: Equatable {
  let device: UInt64
  let inode: UInt64
}

final class Issue121PrivateEndpoint {
  let bootstrap: Issue121Bootstrap
  private let directoryIdentity: Issue121NodeIdentity
  private var cleaned = false

  private init(bootstrap: Issue121Bootstrap, directoryIdentity: Issue121NodeIdentity) {
    self.bootstrap = bootstrap
    self.directoryIdentity = directoryIdentity
  }

  static func create() throws -> Issue121PrivateEndpoint {
    let session = try secureRandomBytes(count: 16)
    let capability = try secureRandomBytes(count: 32)
    var template = Array("/private/tmp/ttrpg-observer-121.XXXXXXXXXXXX\0".utf8CString)
    let directoryPath: String = try template.withUnsafeMutableBufferPointer { buffer in
      guard let baseAddress = buffer.baseAddress, let created = mkdtemp(baseAddress) else {
        throw Issue121Failure.pathPolicy
      }
      return String(cString: created)
    }
    var requiresCleanup = true
    defer {
      if requiresCleanup { _ = rmdir(directoryPath) }
    }
    let socketPath = directoryPath + "/observer.sock"
    let identity = try validatePrivateDirectory(directoryPath)
    try validateAbsentSocket(socketPath)
    let endpoint = Issue121PrivateEndpoint(
      bootstrap: Issue121Bootstrap(
        directoryPath: directoryPath,
        socketPath: socketPath,
        session: session,
        capability: capability
      ),
      directoryIdentity: identity
    )
    requiresCleanup = false
    return endpoint
  }

  static func adoptNoLaunchInterop(bootstrap: Issue121Bootstrap) throws
    -> Issue121PrivateEndpoint
  {
    try validatePathPolicy(
      directoryPath: bootstrap.directoryPath,
      socketPath: bootstrap.socketPath
    )
    let identity = try validatePrivateDirectory(bootstrap.directoryPath)
    _ = try validateSocketNode(bootstrap.socketPath)
    return Issue121PrivateEndpoint(bootstrap: bootstrap, directoryIdentity: identity)
  }

  static func validatePathPolicy(directoryPath: String, socketPath: String) throws {
    guard
      URL(fileURLWithPath: directoryPath).deletingLastPathComponent().path
        == issue121PrivateTemporaryDirectory,
      URL(fileURLWithPath: socketPath).deletingLastPathComponent().path == directoryPath,
      URL(fileURLWithPath: socketPath).lastPathComponent == "observer.sock",
      socketPath.utf8.count < issue121DarwinSocketPathBytes,
      !directoryPath.contains("\0"), !socketPath.contains("\0")
    else { throw Issue121Failure.pathPolicy }
  }

  func verifyNamespace(socketMustBeAbsent: Bool) throws {
    try Self.validatePathPolicy(
      directoryPath: bootstrap.directoryPath,
      socketPath: bootstrap.socketPath
    )
    guard try Self.validatePrivateDirectory(bootstrap.directoryPath) == directoryIdentity else {
      throw Issue121Failure.pathPolicy
    }
    if socketMustBeAbsent { try Self.validateAbsentSocket(bootstrap.socketPath) }
  }

  func socketIdentityForConnect(deadlineNanoseconds: UInt64) throws -> Issue121SocketNodeIdentity {
    while DispatchTime.now().uptimeNanoseconds < deadlineNanoseconds {
      try verifyNamespace(socketMustBeAbsent: false)
      if let identity = try Self.socketNodeIdentityIfPresent(bootstrap.socketPath) {
        return identity
      }
      usleep(10_000)
    }
    throw Issue121Failure.deadline
  }

  func verifySocketIdentity(_ identity: Issue121SocketNodeIdentity) throws {
    try verifyNamespace(socketMustBeAbsent: false)
    guard try Self.validateSocketNode(bootstrap.socketPath) == identity else {
      throw Issue121Failure.pathPolicy
    }
  }

  func cleanup() throws {
    guard !cleaned else { return }
    do {
      try verifyNamespace(socketMustBeAbsent: true)
    } catch {
      throw Issue121Failure.cleanup
    }
    guard rmdir(bootstrap.directoryPath) == 0 else { throw Issue121Failure.cleanup }
    cleaned = true
  }

  func launchPlan(
    candidate: Issue121PreparedCandidate,
    controllerProcessIdentifier: Int32
  ) throws -> Issue121LaunchPlan {
    guard controllerProcessIdentifier > 0,
      candidate.applicationURL.path.hasPrefix("/"), candidate.applicationURL.path.hasSuffix(".app"),
      !candidate.bundleIdentifier.isEmpty,
      Issue121CandidateIdentity.isCanonicalDigest(candidate.executableSHA256)
    else { throw Issue121Failure.bootstrap }
    try verifyNamespace(socketMustBeAbsent: true)
    let environment = [
      "TTRPG_OBSERVER_SOCKET_PATH": bootstrap.socketPath,
      "TTRPG_OBSERVER_SESSION": Issue121Hex.encode(bootstrap.session),
      "TTRPG_OBSERVER_CAPABILITY": Issue121Hex.encode(bootstrap.capability),
      "TTRPG_OBSERVER_CONTROLLER_PID": String(controllerProcessIdentifier),
      "TTRPG_OBSERVER_CANDIDATE_SHA256": candidate.executableSHA256,
    ]
    guard environment.count == 5 else { throw Issue121Failure.bootstrap }
    return Issue121LaunchPlan(
      applicationURL: candidate.applicationURL,
      environment: environment,
      activates: false,
      addsToRecentItems: false,
      createsNewApplicationInstance: true
    )
  }

  @MainActor
  static func openConfiguration(for plan: Issue121LaunchPlan) -> NSWorkspace.OpenConfiguration {
    let configuration = NSWorkspace.OpenConfiguration()
    configuration.environment = plan.environment
    configuration.activates = plan.activates
    configuration.addsToRecentItems = plan.addsToRecentItems
    configuration.createsNewApplicationInstance = plan.createsNewApplicationInstance
    return configuration
  }

  private static func secureRandomBytes(count: Int) throws -> [UInt8] {
    var bytes = [UInt8](repeating: 0, count: count)
    guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
      throw Issue121Failure.bootstrap
    }
    return bytes
  }

  private static func validatePrivateDirectory(_ path: String) throws -> Issue121NodeIdentity {
    try validatePathPolicy(directoryPath: path, socketPath: path + "/observer.sock")
    var status = stat()
    guard lstat(path, &status) == 0, status.st_uid == geteuid(),
      status.st_mode & S_IFMT == S_IFDIR, status.st_mode & 0o7777 == 0o700
    else { throw Issue121Failure.pathPolicy }
    return Issue121NodeIdentity(device: UInt64(status.st_dev), inode: UInt64(status.st_ino))
  }

  private static func validateAbsentSocket(_ path: String) throws {
    var status = stat()
    errno = 0
    guard lstat(path, &status) != 0, errno == ENOENT else { throw Issue121Failure.pathPolicy }
  }

  static func validateSocketNode(_ path: String) throws -> Issue121SocketNodeIdentity {
    guard let identity = try socketNodeIdentityIfPresent(path) else {
      throw Issue121Failure.pathPolicy
    }
    return identity
  }

  private static func socketNodeIdentityIfPresent(
    _ path: String
  ) throws -> Issue121SocketNodeIdentity? {
    var status = stat()
    errno = 0
    if lstat(path, &status) != 0 {
      if errno == ENOENT { return nil }
      throw Issue121Failure.pathPolicy
    }
    guard status.st_uid == geteuid(),
      status.st_mode & S_IFMT == S_IFSOCK, status.st_mode & 0o7777 == 0o600
    else { throw Issue121Failure.pathPolicy }
    return Issue121SocketNodeIdentity(device: UInt64(status.st_dev), inode: UInt64(status.st_ino))
  }
}

private struct Issue121NodeIdentity: Equatable {
  let device: UInt64
  let inode: UInt64
}

struct Issue121PeerIdentity: Equatable {
  let effectiveUserIdentifier: uid_t
  let processIdentifier: pid_t
}

final class Issue121ConnectedSocket {
  private var descriptor: Int32
  private var pendingFrames = [Issue121Frame]()

  private init(descriptor: Int32) throws {
    self.descriptor = descriptor
    do {
      try Self.configureWritesWithoutSignals(descriptor)
    } catch {
      Darwin.close(descriptor)
      self.descriptor = -1
      throw Issue121Failure.disconnect
    }
  }

  private static func configureWritesWithoutSignals(_ descriptor: Int32) throws {
    var noSignal: Int32 = 1
    guard
      setsockopt(
        descriptor,
        SOL_SOCKET,
        SO_NOSIGPIPE,
        &noSignal,
        socklen_t(MemoryLayout.size(ofValue: noSignal))
      ) == 0
    else {
      throw Issue121Failure.disconnect
    }
    noSignal = 0
    var noSignalLength = socklen_t(MemoryLayout.size(ofValue: noSignal))
    guard
      getsockopt(descriptor, SOL_SOCKET, SO_NOSIGPIPE, &noSignal, &noSignalLength) == 0,
      noSignalLength == MemoryLayout.size(ofValue: noSignal), noSignal == 1
    else {
      throw Issue121Failure.disconnect
    }
  }

  static func adoptConnectedDescriptorForTesting(_ descriptor: Int32) throws
    -> Issue121ConnectedSocket
  {
    try Issue121ConnectedSocket(descriptor: descriptor)
  }

  deinit { closeIfNeeded() }

  static func connect(path: String, deadlineNanoseconds: UInt64) throws -> Issue121ConnectedSocket {
    guard path.utf8.count < issue121DarwinSocketPathBytes else {
      throw Issue121Failure.pathPolicy
    }
    let descriptor = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)
    guard descriptor >= 0 else { throw Issue121Failure.disconnect }
    var address = sockaddr_un()
    address.sun_family = sa_family_t(AF_UNIX)
    let copied = path.withCString { source in
      withUnsafeMutablePointer(to: &address.sun_path) { pointer in
        pointer.withMemoryRebound(to: CChar.self, capacity: issue121DarwinSocketPathBytes) {
          strlcpy($0, source, issue121DarwinSocketPathBytes)
        }
      }
    }
    guard copied == path.utf8.count else {
      Darwin.close(descriptor)
      throw Issue121Failure.pathPolicy
    }
    let result = withUnsafePointer(to: &address) { pointer in
      pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
        Darwin.connect(descriptor, $0, socklen_t(MemoryLayout<sockaddr_un>.size))
      }
    }
    guard result == 0 else {
      Darwin.close(descriptor)
      throw Issue121Failure.disconnect
    }
    let existingFlags = fcntl(descriptor, F_GETFL)
    guard existingFlags >= 0, fcntl(descriptor, F_SETFL, existingFlags | O_NONBLOCK) == 0 else {
      Darwin.close(descriptor)
      throw Issue121Failure.disconnect
    }
    guard DispatchTime.now().uptimeNanoseconds <= deadlineNanoseconds else {
      Darwin.close(descriptor)
      throw Issue121Failure.deadline
    }
    return try Issue121ConnectedSocket(descriptor: descriptor)
  }

  func validatePeer(expectedUID: uid_t, expectedPID: pid_t) throws {
    let peer = try peerIdentity()
    guard peer.effectiveUserIdentifier == expectedUID, peer.processIdentifier == expectedPID else {
      throw Issue121Failure.peerIdentity
    }
  }

  func peerIdentity() throws -> Issue121PeerIdentity {
    var effectiveUID: uid_t = 0
    var effectiveGID: gid_t = 0
    guard getpeereid(descriptor, &effectiveUID, &effectiveGID) == 0 else {
      throw Issue121Failure.peerIdentity
    }
    var processIdentifier: pid_t = 0
    var length = socklen_t(MemoryLayout.size(ofValue: processIdentifier))
    guard getsockopt(descriptor, 0, 2, &processIdentifier, &length) == 0,
      length == MemoryLayout.size(ofValue: processIdentifier), processIdentifier > 0
    else { throw Issue121Failure.peerIdentity }
    return Issue121PeerIdentity(
      effectiveUserIdentifier: effectiveUID,
      processIdentifier: processIdentifier
    )
  }

  func writeAll(
    _ bytes: [UInt8],
    fragmentBytes: Int = .max,
    deadlineNanoseconds: UInt64 = .max
  ) throws {
    guard fragmentBytes > 0 else { throw Issue121Failure.usage }
    var offset = 0
    while offset < bytes.count {
      let requested = min(fragmentBytes, bytes.count - offset)
      let count = bytes.withUnsafeBytes { rawBuffer in
        Darwin.write(descriptor, rawBuffer.baseAddress! + offset, requested)
      }
      if count > 0 {
        offset += count
      } else if count < 0, errno == EINTR {
        continue
      } else if count < 0, errno == EAGAIN || errno == EWOULDBLOCK {
        try requireEvent(Int16(POLLOUT), before: deadlineNanoseconds)
      } else {
        throw Issue121Failure.disconnect
      }
    }
  }

  func readFrame(deadlineNanoseconds: UInt64, decoder: inout Issue121FrameStreamDecoder) throws
    -> Issue121Frame
  {
    if !pendingFrames.isEmpty { return pendingFrames.removeFirst() }
    while true {
      try requireEvent(Int16(POLLIN), before: deadlineNanoseconds)
      var fragment = [UInt8](repeating: 0, count: 4_096)
      let count = Darwin.read(descriptor, &fragment, fragment.count)
      if count < 0, errno == EINTR || errno == EAGAIN || errno == EWOULDBLOCK { continue }
      guard count > 0 else { throw Issue121Failure.disconnect }
      let frames = try decoder.append(Array(fragment[..<count]))
      if let frame = frames.first {
        pendingFrames.append(contentsOf: frames.dropFirst())
        return frame
      }
    }
  }

  func requireNoUnsolicitedInput(decoder: Issue121FrameStreamDecoder) throws {
    try requireNoBufferedInput(decoder: decoder)
    while true {
      var pollDescriptor = pollfd(fd: descriptor, events: Int16(POLLIN), revents: 0)
      let result = poll(&pollDescriptor, 1, 0)
      if result < 0, errno == EINTR { continue }
      guard result >= 0 else { throw Issue121Failure.disconnect }
      if result == 0 { return }
      if pollDescriptor.revents & Int16(POLLHUP | POLLERR | POLLNVAL) != 0 {
        throw Issue121Failure.disconnect
      }
      if pollDescriptor.revents & Int16(POLLIN) != 0 {
        throw Issue121Failure.lifecycle
      }
      throw Issue121Failure.disconnect
    }
  }

  func requireNoBufferedInput(decoder: Issue121FrameStreamDecoder) throws {
    guard pendingFrames.isEmpty, decoder.bytes.isEmpty else {
      throw Issue121Failure.lifecycle
    }
  }

  func closeIfNeeded() {
    if descriptor >= 0 {
      Darwin.close(descriptor)
      descriptor = -1
    }
  }

  private func requireEvent(_ event: Int16, before deadlineNanoseconds: UInt64) throws {
    while true {
      let now = DispatchTime.now().uptimeNanoseconds
      guard deadlineNanoseconds > now else { throw Issue121Failure.deadline }
      let remainingMilliseconds = min(
        UInt64(Int32.max),
        (deadlineNanoseconds - now + 999_999) / 1_000_000
      )
      var pollDescriptor = pollfd(fd: descriptor, events: event, revents: 0)
      let result = poll(&pollDescriptor, 1, Int32(remainingMilliseconds))
      if result < 0, errno == EINTR { continue }
      if result == 0 { throw Issue121Failure.deadline }
      guard result > 0,
        pollDescriptor.revents & Int16(event | Int16(POLLHUP) | Int16(POLLERR)) != 0
      else { throw Issue121Failure.disconnect }
      return
    }
  }
}
