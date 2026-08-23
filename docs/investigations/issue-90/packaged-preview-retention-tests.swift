import Darwin
import Foundation

@main
enum PackagedPreviewRetentionTests {
  static func main() throws {
    try archivesExactBytesAndRemovesVerifiedSource()
    try rejectsUnsafeDestinationsAndSources()
    try preservesSourceAcrossCopyVerificationAndReceiptFailures()
    try preservesSourceWhenReceiptEmissionFails()
    try preservesSourceAcrossInterruptionBoundaries()
    try reportsCleanupFailureWithoutRemovingSource()
    try emitsOnlySanitizedReceiptFields()
    print("packaged-preview-retention-tests: passed")
  }

  private static func archivesExactBytesAndRemovesVerifiedSource() throws {
    try withWorkspace { workspace in
      let sourceData = syntheticCSV()
      try writeOwnerOnly(sourceData, to: workspace.source)
      var emittedReceipt: SanitizedRetentionReceipt?
      let result = try PackagedPreviewRetention.retain(
        repositoryRoot: workspace.repository,
        sourcePath: workspace.source,
        archiveRoot: workspace.archive,
        artifactIdentifier: "synthetic-proof-01",
        receiptSink: { receipt in
          expect(exists(workspace.source), "source exists while receipt is emitted")
          emittedReceipt = receipt
        }
      )

      expect(emittedReceipt == result.receipt, "emitted successful receipt")
      expect(result.sourceRemoved, "successful source cleanup")
      expect(!exists(workspace.source), "temporary source removed after retention")
      expect(result.receipt.status == "retained", "successful receipt status")
      expect(result.receipt.byteLength == UInt64(sourceData.count), "receipt byte length")
      let artifact = workspace.archive + "/synthetic-proof-01"
      let archivedCSV = artifact + "/raw-preview-rss.csv"
      let archivedReceipt = artifact + "/retention-receipt.json"
      let archivedCSVData = try Data(contentsOf: URL(fileURLWithPath: archivedCSV))
      let archivedReceiptData = try Data(contentsOf: URL(fileURLWithPath: archivedReceipt))
      let expectedReceiptData = try RetentionReceiptEncoder.encode(result.receipt)
      expect(archivedCSVData == sourceData, "exact bytes")
      expect(mode(artifact) == 0o700, "artifact owner-only mode")
      expect(mode(archivedCSV) == 0o600, "CSV owner-only mode")
      expect(mode(archivedReceipt) == 0o600, "receipt owner-only mode")
      expect(archivedReceiptData == expectedReceiptData, "verified archived receipt")
    }
  }

  private static func rejectsUnsafeDestinationsAndSources() throws {
    try withWorkspace { workspace in
      try writeOwnerOnly(syntheticCSV(), to: workspace.source)
      try expectFailure(.unsafeArchiveRoot, "repository root destination") {
        _ = try retain(workspace, archiveRoot: workspace.repository)
      }
      expect(exists(workspace.source), "repository rejection preserves source")
    }

    try withWorkspace { workspace in
      let nestedArchive = workspace.repository + "/private"
      try createOwnerOnlyDirectory(nestedArchive)
      try writeOwnerOnly(syntheticCSV(), to: workspace.source)
      try expectFailure(.unsafeArchiveRoot, "repository descendant destination") {
        _ = try retain(workspace, archiveRoot: nestedArchive)
      }
    }

    try withWorkspace { workspace in
      try writeOwnerOnly(syntheticCSV(), to: workspace.source)
      try expectFailure(.unsafeArchiveRoot, "relative archive root") {
        _ = try retain(workspace, archiveRoot: "relative-private-archive")
      }
      let aliased =
        workspace.archive + "/../" + URL(fileURLWithPath: workspace.archive).lastPathComponent
      try expectFailure(.unsafeArchiveRoot, "aliased archive root") {
        _ = try retain(workspace, archiveRoot: aliased)
      }
    }

    try withWorkspace { workspace in
      let link = workspace.base + "/archive-link"
      try FileManager.default.createSymbolicLink(
        atPath: link, withDestinationPath: workspace.archive)
      try writeOwnerOnly(syntheticCSV(), to: workspace.source)
      try expectFailure(.unsafeArchiveRoot, "symlink archive root") {
        _ = try retain(workspace, archiveRoot: link)
      }
    }

    try withWorkspace { workspace in
      try createOwnerOnlyDirectory(workspace.archive + "/synthetic-proof-01")
      try writeOwnerOnly(syntheticCSV(), to: workspace.source)
      try expectFailure(.collision, "existing artifact") {
        _ = try retain(workspace)
      }
      expect(exists(workspace.source), "collision preserves source")
    }

    try withWorkspace { workspace in
      chmod(workspace.archive, mode_t(0o705))
      defer { chmod(workspace.archive, mode_t(0o700)) }
      try writeOwnerOnly(syntheticCSV(), to: workspace.source)
      try expectFailure(.permissionFailure, "unsafe archive permissions") {
        _ = try retain(workspace)
      }
    }

    try withWorkspace { workspace in
      chmod(workspace.archive, mode_t(0o500))
      defer { chmod(workspace.archive, mode_t(0o700)) }
      try writeOwnerOnly(syntheticCSV(), to: workspace.source)
      try expectFailure(.permissionFailure, "unwritable archive") {
        _ = try retain(workspace)
      }
    }

    try withWorkspace { workspace in
      let target = workspace.base + "/private-source.csv"
      try writeOwnerOnly(syntheticCSV(), to: target)
      try FileManager.default.createSymbolicLink(
        atPath: workspace.source, withDestinationPath: target)
      try expectFailure(.unsafeSource, "symlink source") {
        _ = try retain(workspace)
      }
    }

    try withWorkspace { workspace in
      try writeOwnerOnly(syntheticCSV(), to: workspace.source)
      chmod(workspace.source, mode_t(0o644))
      try expectFailure(.unsafeSource, "unsafe source permissions") {
        _ = try retain(workspace)
      }
    }
  }

  private static func preservesSourceAcrossCopyVerificationAndReceiptFailures() throws {
    let cases: [(String, RetentionFailureCategory, (inout RetentionFaults) -> Void)] = [
      ("copy failure", .copyFailure, { $0.copyFailure = true }),
      ("short write", .copyFailure, { $0.shortWrite = true }),
      ("hash mismatch", .verificationFailure, { $0.hashMismatch = true }),
      ("receipt failure", .receiptFailure, { $0.receiptFailure = true }),
    ]
    for (label, category, configure) in cases {
      try withWorkspace { workspace in
        try writeOwnerOnly(syntheticCSV(), to: workspace.source)
        var faults = RetentionFaults.none
        configure(&faults)
        try expectFailure(category, label) {
          _ = try retain(workspace, faults: faults)
        }
        expect(exists(workspace.source), "\(label) preserves source")
        expect(
          !exists(workspace.archive + "/synthetic-proof-01"),
          "\(label) does not commit artifact"
        )
      }
    }
  }

  private static func preservesSourceAcrossInterruptionBoundaries() throws {
    for boundary in RetentionBoundary.allCases {
      try withWorkspace { workspace in
        try writeOwnerOnly(syntheticCSV(), to: workspace.source)
        var faults = RetentionFaults.none
        faults.interruption = boundary
        var receiptEmitted = false
        try expectFailure(.interruption, "interruption boundary") {
          _ = try retain(
            workspace,
            faults: faults,
            receiptSink: { _ in receiptEmitted = true }
          )
        }
        expect(exists(workspace.source), "interruption preserves source")
        let committed = exists(workspace.archive + "/synthetic-proof-01")
        expect(
          committed == (boundary == .archiveCommitted || boundary == .receiptEmitted),
          "only postcommit boundaries publish an artifact"
        )
        expect(
          receiptEmitted == (boundary == .receiptEmitted),
          "only the post-emission boundary observes a receipt"
        )
      }
    }
  }

  private static func preservesSourceWhenReceiptEmissionFails() throws {
    try withWorkspace { workspace in
      try writeOwnerOnly(syntheticCSV(), to: workspace.source)
      var emissionAttempts = 0
      let status = PackagedPreviewRetentionCommandRunner.run(
        arguments: [
          workspace.repository,
          workspace.source,
          workspace.archive,
          "synthetic-proof-01",
        ],
        receiptSink: { _ in
          emissionAttempts += 1
          throw SyntheticEmissionFailure()
        }
      )
      expect(status == EXIT_FAILURE, "emission failure exit status")
      expect(emissionAttempts == 1, "failed emission is not retried")
      expect(exists(workspace.source), "emission failure preserves source")
      expect(
        exists(workspace.archive + "/synthetic-proof-01/raw-preview-rss.csv"),
        "emission failure preserves committed archive"
      )
    }
  }

  private static func reportsCleanupFailureWithoutRemovingSource() throws {
    try withWorkspace { workspace in
      try writeOwnerOnly(syntheticCSV(), to: workspace.source)
      var faults = RetentionFaults.none
      faults.cleanupFailure = true
      var emittedReceipt: SanitizedRetentionReceipt?
      let result = try retain(
        workspace,
        faults: faults,
        receiptSink: { emittedReceipt = $0 }
      )
      expect(!result.sourceRemoved, "cleanup failure result")
      expect(exists(workspace.source), "cleanup failure preserves source")
      expect(
        exists(workspace.archive + "/synthetic-proof-01/raw-preview-rss.csv"),
        "cleanup failure retains committed archive"
      )
      expect(result.receipt.status == "retained", "archive retention status")
      expect(emittedReceipt == result.receipt, "cleanup follows receipt emission")
    }
  }

  private static func emitsOnlySanitizedReceiptFields() throws {
    let receipt = SanitizedRetentionReceipt.incomplete(
      artifactIdentifier: "opaque-proof-01",
      category: .copyFailure
    )
    let data = try RetentionReceiptEncoder.encode(receipt)
    let text = String(decoding: data, as: UTF8.self)
    expect(!text.contains("/private/tmp"), "no private path in output")
    expect(!text.contains("pid_"), "no PID header in output")
    expect(!text.contains("epoch_ms"), "no CSV content in output")
    let object = try JSONSerialization.jsonObject(with: data) as? [String: Any]
    let allowed = Set([
      "version", "status", "artifactIdentifier", "sha256", "byteLength", "failureCategory",
    ])
    expect(object.map { Set($0.keys).isSubset(of: allowed) } == true, "sanitized output schema")
  }

  private struct Workspace {
    let base: String
    let repository: String
    let archive: String
    let source: String
  }

  private struct SyntheticEmissionFailure: Error {}

  private static func withWorkspace(_ operation: (Workspace) throws -> Void) throws {
    let token = UUID().uuidString.lowercased()
    let base = "/tmp/issue91-retention-tests-\(token)"
    let workspace = Workspace(
      base: base,
      repository: base + "/repository",
      archive: base + "/private-archive",
      source: "/tmp/issue91-private-source-\(token).csv"
    )
    try createOwnerOnlyDirectory(base)
    try createOwnerOnlyDirectory(workspace.repository)
    try createOwnerOnlyDirectory(workspace.archive)
    defer {
      try? FileManager.default.removeItem(atPath: workspace.source)
      try? FileManager.default.removeItem(atPath: base)
    }
    try operation(workspace)
  }

  private static func retain(
    _ workspace: Workspace,
    archiveRoot: String? = nil,
    faults: RetentionFaults = .none,
    receiptSink: (SanitizedRetentionReceipt) throws -> Void = { _ in }
  ) throws -> RetentionResult {
    try PackagedPreviewRetention.retain(
      repositoryRoot: workspace.repository,
      sourcePath: workspace.source,
      archiveRoot: archiveRoot ?? workspace.archive,
      artifactIdentifier: "synthetic-proof-01",
      faults: faults,
      receiptSink: receiptSink
    )
  }

  private static func createOwnerOnlyDirectory(_ path: String) throws {
    try FileManager.default.createDirectory(atPath: path, withIntermediateDirectories: false)
    guard chmod(path, mode_t(0o700)) == 0 else { throw RetentionFailure(category: .ioFailure) }
  }

  private static func writeOwnerOnly(_ data: Data, to path: String) throws {
    let fd = open(path, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, mode_t(0o600))
    guard fd >= 0 else { throw RetentionFailure(category: .ioFailure) }
    defer { close(fd) }
    guard fchmod(fd, mode_t(0o600)) == 0 else {
      throw RetentionFailure(category: .ioFailure)
    }
    try data.withUnsafeBytes { bytes in
      guard let baseAddress = bytes.baseAddress else { return }
      var offset = 0
      while offset < bytes.count {
        let count = Darwin.write(fd, baseAddress.advanced(by: offset), bytes.count - offset)
        guard count > 0 else { throw RetentionFailure(category: .ioFailure) }
        offset += count
      }
    }
    guard fsync(fd) == 0 else { throw RetentionFailure(category: .ioFailure) }
  }

  private static func syntheticCSV() -> Data {
    Data(
      "epoch_ms,aggregate_rss_bytes,pid_101,pid_102\n1000,300,100,200\n".utf8)
  }

  private static func exists(_ path: String) -> Bool {
    var status = stat()
    return lstat(path, &status) == 0
  }

  private static func mode(_ path: String) -> mode_t {
    var status = stat()
    guard lstat(path, &status) == 0 else { fatalError("missing expected path") }
    return status.st_mode & mode_t(0o777)
  }

  private static func expectFailure(
    _ category: RetentionFailureCategory,
    _ label: String,
    _ operation: () throws -> Void
  ) throws {
    do {
      try operation()
      fatalError("expected failure: \(label)")
    } catch let failure as RetentionFailure {
      expect(failure.category == category, "\(label) category")
    }
  }

  private static func expect(_ condition: @autoclosure () -> Bool, _ label: String) {
    guard condition() else { fatalError("failed: \(label)") }
  }
}
