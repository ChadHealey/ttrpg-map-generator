import Foundation

let retentionReceiptVersion = "private-preview-rss-retention-v1"

enum RetentionFailureCategory: String, Codable {
  case invalidArguments
  case unsafeSource
  case unsafeArchiveRoot
  case collision
  case permissionFailure
  case copyFailure
  case verificationFailure
  case interruption
  case receiptFailure
  case cleanupFailure
  case ioFailure
}

struct RetentionFailure: Error {
  let category: RetentionFailureCategory
  let receiptAlreadyHandled: Bool

  init(
    category: RetentionFailureCategory,
    receiptAlreadyHandled: Bool = false
  ) {
    self.category = category
    self.receiptAlreadyHandled = receiptAlreadyHandled
  }
}

struct SanitizedRetentionReceipt: Codable, Equatable {
  let version: String
  let status: String
  let artifactIdentifier: String?
  let sha256: String?
  let byteLength: UInt64?
  let failureCategory: RetentionFailureCategory?

  static func incomplete(
    artifactIdentifier: String?,
    category: RetentionFailureCategory
  ) -> SanitizedRetentionReceipt {
    SanitizedRetentionReceipt(
      version: retentionReceiptVersion,
      status: "incomplete",
      artifactIdentifier: artifactIdentifier,
      sha256: nil,
      byteLength: nil,
      failureCategory: category
    )
  }
}

enum RetentionBoundary: CaseIterable {
  case archiveRootValidated
  case stagingCreated
  case bytesCopied
  case archiveVerified
  case receiptRecorded
  case archiveCommitted
  case receiptEmitted
}

struct RetentionFaults {
  var copyFailure = false
  var shortWrite = false
  var hashMismatch = false
  var receiptFailure = false
  var cleanupFailure = false
  var interruption: RetentionBoundary?

  static let none = RetentionFaults()
}

struct RetentionResult {
  let receipt: SanitizedRetentionReceipt
  let sourceRemoved: Bool
}

enum OpaqueArtifactIdentifier {
  static func validated(_ supplied: String) throws -> String {
    guard (1...128).contains(supplied.utf8.count),
      supplied.utf8.allSatisfy({ byte in
        (48...57).contains(byte) || (65...90).contains(byte)
          || (97...122).contains(byte) || byte == 45 || byte == 95
      })
    else {
      throw RetentionFailure(category: .invalidArguments)
    }
    return supplied
  }

  static func sanitized(_ supplied: String?) -> String? {
    guard let supplied else { return nil }
    return try? validated(supplied)
  }
}

enum RetentionReceiptEncoder {
  static func encode(_ receipt: SanitizedRetentionReceipt) throws -> Data {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
    return try encoder.encode(receipt)
  }
}
