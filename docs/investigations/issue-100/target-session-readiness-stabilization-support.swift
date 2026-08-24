import Darwin
import Foundation

final class Issue110OperatorReadyLatchPlatform {
  private let configuration: Issue110OperatorReadyLatchConfiguration
  private let temporaryPath: String
  private var collisionChecked = false
  private var published = false
  private var temporaryOwned = false
  private var cleanupAttempted = false
  private var cleanupSucceeded = false
  private var stateTransitions: [String] = []
  private var signalSources: [DispatchSourceSignal] = []
  private let lifecycleLock = NSLock()
  private let signalQueue = DispatchQueue(label: "issue110.operator-ready-latch.signal")

  init(configuration: Issue110OperatorReadyLatchConfiguration) throws {
    try Issue110OperatorReadyLatchValidator.validateConfiguration(configuration)
    self.configuration = configuration
    temporaryPath = configuration.path + ".publishing-" + configuration.token
  }

  func prepare() throws {
    lifecycleLock.lock()
    defer { lifecycleLock.unlock() }
    try Issue110OperatorReadyLatchValidator.validateNoExistingMarker(
      pathExists(configuration.path))
    try Issue110OperatorReadyLatchValidator.validateNoExistingMarker(pathExists(temporaryPath))
    collisionChecked = true
  }

  func installSignalCleanup(candidateTermination: @escaping () -> Void) {
    for signalNumber in [SIGHUP, SIGINT, SIGTERM] {
      signal(signalNumber, SIG_IGN)
      let source = DispatchSource.makeSignalSource(signal: signalNumber, queue: signalQueue)
      source.setEventHandler { [weak self] in
        guard let self else { exit(128 + signalNumber) }
        let invalidation: TargetSessionReadinessInvalidation
        let latchDiagnostics: Issue110OperatorReadyLatchDiagnostics
        do {
          latchDiagnostics = try self.cleanup()
          invalidation = .action(
            "the target-session readiness controller received a termination signal")
        } catch let cleanupInvalidation as TargetSessionReadinessInvalidation {
          latchDiagnostics = self.diagnostics()
          invalidation = cleanupInvalidation
        } catch {
          latchDiagnostics = self.diagnostics()
          invalidation = .action("unexpected operator-ready latch signal cleanup failure")
        }
        try? issue100Emit(
          Issue105TargetSessionReadinessQualificationReceipt.invalid(
            invalidation,
            operatorReadyLatch: latchDiagnostics
          ))
        candidateTermination()
        exit(128 + signalNumber)
      }
      source.resume()
      signalSources.append(source)
    }
  }

  func publish(
    bundleIdentifier: String,
    candidateExecutableSha256: String,
    exactCandidateValidated: Bool,
    consoleSessionValidated: Bool,
    declaredOperatorFocusActionCount: Int,
    zeroOperationProof: Issue100ZeroOperationReceipt
  ) throws -> Issue110OperatorReadyLatchDiagnostics {
    lifecycleLock.lock()
    defer { lifecycleLock.unlock() }
    guard collisionChecked, !published, !cleanupAttempted else {
      throw TargetSessionReadinessInvalidation.action(
        "the operator-ready latch lifecycle was not ready for publication")
    }
    try Issue110OperatorReadyLatchValidator.validatePublicationAuthority(
      exactCandidateValidated: exactCandidateValidated,
      consoleSessionValidated: consoleSessionValidated,
      zeroOperationProof: zeroOperationProof
    )
    let marker = Issue110OperatorReadyMarker(
      schemaVersion: issue110OperatorReadyLatchSchemaVersion,
      state: "awaiting-operator-ready",
      token: configuration.token,
      bundleIdentifier: bundleIdentifier,
      candidateExecutableSha256: candidateExecutableSha256,
      exactCandidateValidated: true,
      consoleSessionValidated: true,
      declaredOperatorFocusActionCount: declaredOperatorFocusActionCount,
      handoffTimeoutMilliseconds: Issue105StabilizationPolicy.approved.timeoutMilliseconds,
      zeroOperationProof: zeroOperationProof
    )
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    var data = try encoder.encode(marker)
    data.append(0x0A)
    try publishAtomically(data)
    stateTransitions = [
      "exact-candidate-validated",
      "zero-operation-validated",
      "awaiting-operator-ready-published",
    ]
    return diagnosticsUnlocked()
  }

  func cleanup() throws -> Issue110OperatorReadyLatchDiagnostics {
    lifecycleLock.lock()
    defer { lifecycleLock.unlock() }
    guard !cleanupAttempted else {
      if cleanupSucceeded { return diagnosticsUnlocked() }
      throw TargetSessionReadinessInvalidation.action(
        "the operator-ready latch cleanup had already failed")
    }
    cleanupAttempted = true

    var cleanupFailed = false
    if published {
      if unlink(configuration.path) != 0 { cleanupFailed = true }
    }
    if temporaryOwned {
      if unlink(temporaryPath) == 0 {
        temporaryOwned = false
      } else {
        cleanupFailed = true
      }
    }
    if published, pathExists(configuration.path) { cleanupFailed = true }
    cleanupSucceeded = !cleanupFailed
    if cleanupSucceeded, published { stateTransitions.append("operator-ready-marker-cleaned") }
    guard cleanupSucceeded else {
      throw TargetSessionReadinessInvalidation.action(
        "the operator-ready latch marker could not be cleaned")
    }
    return diagnosticsUnlocked()
  }

  func diagnostics() -> Issue110OperatorReadyLatchDiagnostics {
    lifecycleLock.lock()
    defer { lifecycleLock.unlock() }
    return diagnosticsUnlocked()
  }

  private func diagnosticsUnlocked() -> Issue110OperatorReadyLatchDiagnostics {
    Issue110OperatorReadyLatchDiagnostics(
      pathPolicy: "explicit-private-tmp-file",
      tokenValidated: true,
      existingMarkerCollisionChecked: collisionChecked,
      atomicPublicationSucceeded: published,
      cleanupAttempted: cleanupAttempted,
      cleanupSucceeded: cleanupSucceeded,
      handoffTimeoutMilliseconds: Issue105StabilizationPolicy.approved.timeoutMilliseconds,
      stateTransitions: stateTransitions
    )
  }

  private func publishAtomically(_ data: Data) throws {
    let descriptor = open(
      temporaryPath,
      O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW,
      S_IRUSR | S_IWUSR
    )
    guard descriptor >= 0 else {
      throw TargetSessionReadinessInvalidation.action(
        "the operator-ready latch temporary could not be created")
    }
    temporaryOwned = true
    var descriptorOpen = true
    defer {
      if descriptorOpen { _ = close(descriptor) }
      if temporaryOwned, unlink(temporaryPath) == 0 { temporaryOwned = false }
    }

    let wroteCompleteMarker = data.withUnsafeBytes { rawBuffer -> Bool in
      guard let baseAddress = rawBuffer.baseAddress else { return data.isEmpty }
      var written = 0
      while written < rawBuffer.count {
        let result = write(descriptor, baseAddress.advanced(by: written), rawBuffer.count - written)
        if result > 0 {
          written += result
        } else if result < 0, errno == EINTR {
          continue
        } else {
          return false
        }
      }
      return true
    }
    guard wroteCompleteMarker, fsync(descriptor) == 0 else {
      throw TargetSessionReadinessInvalidation.action(
        "the complete operator-ready latch marker could not be flushed")
    }
    guard close(descriptor) == 0 else {
      descriptorOpen = false
      throw TargetSessionReadinessInvalidation.action(
        "the operator-ready latch marker could not be closed")
    }
    descriptorOpen = false

    guard link(temporaryPath, configuration.path) == 0 else {
      if errno == EEXIST {
        throw TargetSessionReadinessInvalidation.action(
          "the explicit operator-ready latch path collided during atomic publication")
      }
      throw TargetSessionReadinessInvalidation.action(
        "the operator-ready latch marker could not be atomically published")
    }
    published = true
    guard unlink(temporaryPath) == 0 else {
      throw TargetSessionReadinessInvalidation.action(
        "the operator-ready latch publication temporary could not be cleaned")
    }
    temporaryOwned = false
  }

  private func pathExists(_ path: String) -> Bool {
    var metadata = stat()
    if lstat(path, &metadata) == 0 { return true }
    return errno != ENOENT
  }
}

struct Issue109OperatorFocusPromptReceipt: Codable {
  let controllerVersion: String
  let state: String
  let bundleIdentifier: String
  let declaredOperatorFocusActionCount: Int
  let timeoutMilliseconds: UInt64
  let prompt: String
  let zeroOperationProof: Issue100ZeroOperationReceipt
}

func issue109EmitPrompt(_ receipt: Issue109OperatorFocusPromptReceipt) throws {
  let encoder = JSONEncoder()
  encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
  FileHandle.standardError.write(try encoder.encode(receipt))
  FileHandle.standardError.write(Data([0x0A]))
}

struct Issue105TargetSessionReadinessQualificationReceipt: Codable {
  let controllerVersion: String
  let status: String
  let qualificationKind: String
  let target: Issue100TargetReceipt
  let sessionMechanism: String?
  let bundleIdentifier: String?
  let candidateExecutableSha256: String?
  let controllerSha256: String?
  let readinessObserverSha256: String?
  let predicates: Issue100ReadinessPredicates?
  let stabilization: Issue105StabilizationDiagnostics?
  let operatorReadyLatch: Issue110OperatorReadyLatchDiagnostics
  let zeroOperationProof: Issue100ZeroOperationReceipt
  let invalidAuthority: String?
  let invalidReason: String?

  static func invalid(
    _ invalidation: TargetSessionReadinessInvalidation,
    diagnostics: Issue105StabilizationDiagnostics? = nil,
    operatorReadyLatch: Issue110OperatorReadyLatchDiagnostics = .none
  ) -> Self {
    Issue105TargetSessionReadinessQualificationReceipt(
      controllerVersion: issue105ReadinessSchemaVersion,
      status: "invalid",
      qualificationKind: "non-measurement-target-session-readiness",
      target: .approved,
      sessionMechanism: nil,
      bundleIdentifier: nil,
      candidateExecutableSha256: nil,
      controllerSha256: nil,
      readinessObserverSha256: nil,
      predicates: nil,
      stabilization: diagnostics,
      operatorReadyLatch: operatorReadyLatch,
      zeroOperationProof: .zero,
      invalidAuthority: invalidation.authority,
      invalidReason: invalidation.description
    )
  }
}
