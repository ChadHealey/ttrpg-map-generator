import CryptoKit
import Darwin
import Foundation

enum PackagedPreviewRetention {
  private static let archiveFileName = "raw-preview-rss.csv"
  private static let receiptFileName = "retention-receipt.json"

  static func retain(
    repositoryRoot suppliedRepositoryRoot: String,
    sourcePath suppliedSourcePath: String,
    archiveRoot suppliedArchiveRoot: String,
    artifactIdentifier suppliedArtifactIdentifier: String,
    faults: RetentionFaults = .none,
    receiptSink: (SanitizedRetentionReceipt) throws -> Void = { _ in }
  ) throws -> RetentionResult {
    let artifactIdentifier = try OpaqueArtifactIdentifier.validated(
      suppliedArtifactIdentifier)
    let repositoryRoot = try strictCanonicalDirectory(
      suppliedRepositoryRoot,
      failure: .invalidArguments
    )
    let archiveRoot = try strictCanonicalDirectory(
      suppliedArchiveRoot,
      failure: .unsafeArchiveRoot
    )
    guard archiveRoot != repositoryRoot,
      !archiveRoot.hasPrefix(repositoryRoot + "/")
    else {
      throw RetentionFailure(category: .unsafeArchiveRoot)
    }

    let archiveRootFD = open(archiveRoot, O_RDONLY | O_DIRECTORY | O_NOFOLLOW)
    guard archiveRootFD >= 0 else {
      throw RetentionFailure(category: .unsafeArchiveRoot)
    }
    defer { close(archiveRootFD) }
    try validateOwnerOnlyDirectory(fd: archiveRootFD)
    try interruptIfRequested(.archiveRootValidated, faults: faults)

    let sourcePath: String
    do {
      sourcePath = try QualificationFileValidator.canonicalRawSamplesPath(
        suppliedSourcePath)
    } catch {
      throw RetentionFailure(category: .unsafeSource)
    }
    let sourceFD = open(sourcePath, O_RDONLY | O_NOFOLLOW)
    guard sourceFD >= 0 else {
      throw RetentionFailure(category: .unsafeSource)
    }
    defer {
      flock(sourceFD, LOCK_UN)
      close(sourceFD)
    }
    guard flock(sourceFD, LOCK_EX | LOCK_NB) == 0 else {
      throw RetentionFailure(category: .unsafeSource)
    }
    let sourceIdentity = try validateOwnerOnlyRegularFile(fd: sourceFD)

    try requireAbsent(artifactIdentifier, relativeTo: archiveRootFD)
    let stagingName = ".\(artifactIdentifier).incomplete"
    try requireAbsent(stagingName, relativeTo: archiveRootFD)
    guard mkdirat(archiveRootFD, stagingName, mode_t(S_IRWXU)) == 0 else {
      throw RetentionFailure(category: errno == EACCES ? .permissionFailure : .ioFailure)
    }

    var stagingExists = true
    var stagingFD = openat(archiveRootFD, stagingName, O_RDONLY | O_DIRECTORY | O_NOFOLLOW)
    defer {
      if stagingFD >= 0 { close(stagingFD) }
      if stagingExists {
        cleanupStaging(rootFD: archiveRootFD, stagingName: stagingName)
      }
    }
    guard stagingFD >= 0, fchmod(stagingFD, mode_t(S_IRWXU)) == 0 else {
      throw RetentionFailure(category: .permissionFailure)
    }
    try interruptIfRequested(.stagingCreated, faults: faults)

    let copied = try copySource(
      sourceFD: sourceFD,
      stagingFD: stagingFD,
      faults: faults
    )
    try interruptIfRequested(.bytesCopied, faults: faults)

    let archived = try hashFile(
      named: archiveFileName,
      relativeTo: stagingFD,
      failure: .verificationFailure
    )
    let archivedDigest = faults.hashMismatch ? String(repeating: "0", count: 64) : archived.digest
    guard copied.digest == archivedDigest, copied.byteLength == archived.byteLength else {
      throw RetentionFailure(category: .verificationFailure)
    }
    try validateOwnerOnlyRegularFile(named: archiveFileName, relativeTo: stagingFD)
    try interruptIfRequested(.archiveVerified, faults: faults)

    let archivedReceipt = SanitizedRetentionReceipt(
      version: retentionReceiptVersion,
      status: "retained",
      artifactIdentifier: artifactIdentifier,
      sha256: copied.digest,
      byteLength: copied.byteLength,
      failureCategory: nil
    )
    let receiptData = try RetentionReceiptEncoder.encode(archivedReceipt)
    if faults.receiptFailure {
      throw RetentionFailure(category: .receiptFailure)
    }
    try createAndSyncFile(
      named: receiptFileName,
      data: receiptData,
      relativeTo: stagingFD,
      failure: .receiptFailure
    )
    let recordedReceipt = try readFile(
      named: receiptFileName,
      relativeTo: stagingFD,
      failure: .receiptFailure
    )
    guard recordedReceipt == receiptData else {
      throw RetentionFailure(category: .receiptFailure)
    }
    try validateOwnerOnlyRegularFile(named: receiptFileName, relativeTo: stagingFD)
    guard fsync(stagingFD) == 0 else {
      throw RetentionFailure(category: .receiptFailure)
    }
    try interruptIfRequested(.receiptRecorded, faults: faults)

    guard
      renameatx_np(
        archiveRootFD,
        stagingName,
        archiveRootFD,
        artifactIdentifier,
        UInt32(RENAME_EXCL)
      ) == 0
    else {
      throw RetentionFailure(category: errno == EEXIST ? .collision : .ioFailure)
    }
    stagingExists = false
    close(stagingFD)
    stagingFD = -1
    guard fsync(archiveRootFD) == 0 else {
      throw RetentionFailure(category: .ioFailure)
    }
    try verifyCommittedArtifact(
      artifactIdentifier: artifactIdentifier,
      archiveRootFD: archiveRootFD,
      expectedReceipt: receiptData,
      expectedDigest: copied.digest,
      expectedByteLength: copied.byteLength
    )
    try interruptIfRequested(.archiveCommitted, faults: faults)

    do {
      try receiptSink(archivedReceipt)
    } catch {
      throw RetentionFailure(category: .receiptFailure, receiptAlreadyHandled: true)
    }
    do {
      try interruptIfRequested(.receiptEmitted, faults: faults)
    } catch let failure as RetentionFailure {
      throw RetentionFailure(
        category: failure.category,
        receiptAlreadyHandled: true
      )
    }

    if faults.cleanupFailure {
      return retainedSourceResult(archivedReceipt)
    }
    do {
      try verifySourceStillMatches(
        path: sourcePath,
        fd: sourceFD,
        expectedIdentity: sourceIdentity,
        expectedDigest: copied.digest,
        expectedByteLength: copied.byteLength
      )
    } catch {
      return retainedSourceResult(archivedReceipt)
    }
    guard unlink(sourcePath) == 0 else {
      return retainedSourceResult(archivedReceipt)
    }
    return RetentionResult(receipt: archivedReceipt, sourceRemoved: true)
  }

  private static func retainedSourceResult(
    _ receipt: SanitizedRetentionReceipt
  ) -> RetentionResult {
    RetentionResult(receipt: receipt, sourceRemoved: false)
  }

  private static func strictCanonicalDirectory(
    _ suppliedPath: String,
    failure: RetentionFailureCategory
  ) throws -> String {
    guard suppliedPath.hasPrefix("/") else { throw RetentionFailure(category: failure) }
    let standardized = URL(fileURLWithPath: suppliedPath, isDirectory: true)
      .standardizedFileURL.path
    guard standardized == suppliedPath,
      URL(fileURLWithPath: suppliedPath, isDirectory: true).resolvingSymlinksInPath().path
        == suppliedPath
    else {
      throw RetentionFailure(category: failure)
    }
    var status = stat()
    guard lstat(suppliedPath, &status) == 0,
      (status.st_mode & S_IFMT) == S_IFDIR,
      (status.st_mode & S_IFMT) != S_IFLNK
    else {
      throw RetentionFailure(category: failure)
    }
    return suppliedPath
  }

  private static func validateOwnerOnlyDirectory(fd: Int32) throws {
    var status = stat()
    guard fstat(fd, &status) == 0,
      (status.st_mode & S_IFMT) == S_IFDIR,
      status.st_uid == geteuid()
    else {
      throw RetentionFailure(category: .unsafeArchiveRoot)
    }
    guard (status.st_mode & mode_t(0o077)) == 0 else {
      throw RetentionFailure(category: .permissionFailure)
    }
  }

  @discardableResult
  private static func validateOwnerOnlyRegularFile(fd: Int32) throws -> stat {
    var status = stat()
    guard fstat(fd, &status) == 0,
      (status.st_mode & S_IFMT) == S_IFREG,
      status.st_uid == geteuid(),
      (status.st_mode & mode_t(0o077)) == 0
    else {
      throw RetentionFailure(category: .unsafeSource)
    }
    return status
  }

  private static func validateOwnerOnlyRegularFile(
    named name: String,
    relativeTo directoryFD: Int32
  ) throws {
    let fd = openat(directoryFD, name, O_RDONLY | O_NOFOLLOW)
    guard fd >= 0 else { throw RetentionFailure(category: .verificationFailure) }
    defer { close(fd) }
    var status = stat()
    guard fstat(fd, &status) == 0,
      (status.st_mode & S_IFMT) == S_IFREG,
      status.st_uid == geteuid(),
      (status.st_mode & mode_t(0o077)) == 0
    else {
      throw RetentionFailure(category: .verificationFailure)
    }
  }

  private static func requireAbsent(_ name: String, relativeTo directoryFD: Int32) throws {
    var status = stat()
    guard fstatat(directoryFD, name, &status, AT_SYMLINK_NOFOLLOW) != 0, errno == ENOENT else {
      throw RetentionFailure(category: .collision)
    }
  }

  private static func copySource(
    sourceFD: Int32,
    stagingFD: Int32,
    faults: RetentionFaults
  ) throws -> (digest: String, byteLength: UInt64) {
    if faults.copyFailure { throw RetentionFailure(category: .copyFailure) }
    guard lseek(sourceFD, 0, SEEK_SET) >= 0 else {
      throw RetentionFailure(category: .copyFailure)
    }
    let destinationFD = openat(
      stagingFD,
      archiveFileName,
      O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW,
      mode_t(S_IRUSR | S_IWUSR)
    )
    guard destinationFD >= 0 else {
      throw RetentionFailure(category: errno == EEXIST ? .collision : .copyFailure)
    }
    defer { close(destinationFD) }
    guard fchmod(destinationFD, mode_t(S_IRUSR | S_IWUSR)) == 0 else {
      throw RetentionFailure(category: .permissionFailure)
    }

    var hasher = SHA256()
    var byteLength: UInt64 = 0
    var buffer = [UInt8](repeating: 0, count: 64 * 1024)
    while true {
      let readCount = buffer.withUnsafeMutableBytes { bytes in
        Darwin.read(sourceFD, bytes.baseAddress, bytes.count)
      }
      if readCount == 0 { break }
      if readCount < 0 {
        if errno == EINTR { continue }
        throw RetentionFailure(category: .copyFailure)
      }
      let chunk = Data(buffer[0..<readCount])
      hasher.update(data: chunk)
      byteLength += UInt64(readCount)
      if faults.shortWrite {
        let partialCount = max(1, readCount / 2)
        _ = chunk.withUnsafeBytes { bytes in
          Darwin.write(destinationFD, bytes.baseAddress, partialCount)
        }
        throw RetentionFailure(category: .copyFailure)
      }
      try writeAll(chunk, to: destinationFD, failure: .copyFailure)
    }
    guard fsync(destinationFD) == 0 else {
      throw RetentionFailure(category: .copyFailure)
    }
    return (hexDigest(hasher.finalize()), byteLength)
  }

  private static func hashFile(
    named name: String,
    relativeTo directoryFD: Int32,
    failure: RetentionFailureCategory
  ) throws -> (digest: String, byteLength: UInt64) {
    let fd = openat(directoryFD, name, O_RDONLY | O_NOFOLLOW)
    guard fd >= 0 else { throw RetentionFailure(category: failure) }
    defer { close(fd) }
    return try hash(fd: fd, failure: failure)
  }

  private static func hash(
    fd: Int32,
    failure: RetentionFailureCategory
  ) throws -> (digest: String, byteLength: UInt64) {
    guard lseek(fd, 0, SEEK_SET) >= 0 else { throw RetentionFailure(category: failure) }
    var hasher = SHA256()
    var byteLength: UInt64 = 0
    var buffer = [UInt8](repeating: 0, count: 64 * 1024)
    while true {
      let readCount = buffer.withUnsafeMutableBytes { bytes in
        Darwin.read(fd, bytes.baseAddress, bytes.count)
      }
      if readCount == 0 { break }
      if readCount < 0 {
        if errno == EINTR { continue }
        throw RetentionFailure(category: failure)
      }
      hasher.update(data: Data(buffer[0..<readCount]))
      byteLength += UInt64(readCount)
    }
    return (hexDigest(hasher.finalize()), byteLength)
  }

  private static func hexDigest<D: Sequence>(_ digest: D) -> String where D.Element == UInt8 {
    digest.map { String(format: "%02x", $0) }.joined()
  }

  private static func createAndSyncFile(
    named name: String,
    data: Data,
    relativeTo directoryFD: Int32,
    failure: RetentionFailureCategory
  ) throws {
    let fd = openat(
      directoryFD,
      name,
      O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW,
      mode_t(S_IRUSR | S_IWUSR)
    )
    guard fd >= 0 else { throw RetentionFailure(category: failure) }
    defer { close(fd) }
    guard fchmod(fd, mode_t(S_IRUSR | S_IWUSR)) == 0 else {
      throw RetentionFailure(category: failure)
    }
    try writeAll(data, to: fd, failure: failure)
    guard fsync(fd) == 0 else { throw RetentionFailure(category: failure) }
  }

  private static func writeAll(
    _ data: Data,
    to fd: Int32,
    failure: RetentionFailureCategory
  ) throws {
    try data.withUnsafeBytes { bytes in
      guard let baseAddress = bytes.baseAddress else { return }
      var offset = 0
      while offset < bytes.count {
        let written = Darwin.write(fd, baseAddress.advanced(by: offset), bytes.count - offset)
        if written < 0 {
          if errno == EINTR { continue }
          throw RetentionFailure(category: failure)
        }
        guard written > 0 else { throw RetentionFailure(category: failure) }
        offset += written
      }
    }
  }

  private static func readFile(
    named name: String,
    relativeTo directoryFD: Int32,
    failure: RetentionFailureCategory
  ) throws -> Data {
    let fd = openat(directoryFD, name, O_RDONLY | O_NOFOLLOW)
    guard fd >= 0 else { throw RetentionFailure(category: failure) }
    defer { close(fd) }
    var data = Data()
    var buffer = [UInt8](repeating: 0, count: 4096)
    while true {
      let count = buffer.withUnsafeMutableBytes { bytes in
        Darwin.read(fd, bytes.baseAddress, bytes.count)
      }
      if count == 0 { return data }
      if count < 0 {
        if errno == EINTR { continue }
        throw RetentionFailure(category: failure)
      }
      data.append(contentsOf: buffer[0..<count])
    }
  }

  private static func verifyCommittedArtifact(
    artifactIdentifier: String,
    archiveRootFD: Int32,
    expectedReceipt: Data,
    expectedDigest: String,
    expectedByteLength: UInt64
  ) throws {
    let artifactFD = openat(
      archiveRootFD,
      artifactIdentifier,
      O_RDONLY | O_DIRECTORY | O_NOFOLLOW
    )
    guard artifactFD >= 0 else {
      throw RetentionFailure(category: .verificationFailure)
    }
    defer { close(artifactFD) }
    try validateOwnerOnlyDirectory(fd: artifactFD)
    let archived = try hashFile(
      named: archiveFileName,
      relativeTo: artifactFD,
      failure: .verificationFailure
    )
    guard archived.digest == expectedDigest,
      archived.byteLength == expectedByteLength,
      try readFile(
        named: receiptFileName,
        relativeTo: artifactFD,
        failure: .verificationFailure
      ) == expectedReceipt
    else {
      throw RetentionFailure(category: .verificationFailure)
    }
  }

  private static func verifySourceStillMatches(
    path: String,
    fd: Int32,
    expectedIdentity: stat,
    expectedDigest: String,
    expectedByteLength: UInt64
  ) throws {
    var pathStatus = stat()
    guard lstat(path, &pathStatus) == 0,
      (pathStatus.st_mode & S_IFMT) == S_IFREG,
      pathStatus.st_dev == expectedIdentity.st_dev,
      pathStatus.st_ino == expectedIdentity.st_ino
    else {
      throw RetentionFailure(category: .cleanupFailure)
    }
    let current = try hash(fd: fd, failure: .cleanupFailure)
    guard current.digest == expectedDigest, current.byteLength == expectedByteLength else {
      throw RetentionFailure(category: .cleanupFailure)
    }
  }

  private static func interruptIfRequested(
    _ boundary: RetentionBoundary,
    faults: RetentionFaults
  ) throws {
    if faults.interruption == boundary {
      throw RetentionFailure(category: .interruption)
    }
  }

  private static func cleanupStaging(rootFD: Int32, stagingName: String) {
    let fd = openat(rootFD, stagingName, O_RDONLY | O_DIRECTORY | O_NOFOLLOW)
    guard fd >= 0 else { return }
    _ = unlinkat(fd, archiveFileName, 0)
    _ = unlinkat(fd, receiptFileName, 0)
    close(fd)
    _ = unlinkat(rootFD, stagingName, AT_REMOVEDIR)
  }
}
