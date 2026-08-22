import CryptoKit
import Darwin
import Foundation

enum QualificationFileValidator {
  static func freshRawSamplesPath(_ suppliedPath: String) throws -> String {
    let canonicalPath = try canonicalRawSamplesPath(suppliedPath)
    var fileStatus = stat()
    guard lstat(canonicalPath, &fileStatus) != 0, errno == ENOENT else {
      throw PreviewObserverInvalidation.sampler(
        "raw samples destination must not already exist")
    }
    return canonicalPath
  }

  static func canonicalRawSamplesPath(_ suppliedPath: String) throws -> String {
    guard suppliedPath.hasPrefix("/") else {
      throw PreviewObserverInvalidation.sampler(
        "raw samples path must be an absolute temporary path")
    }
    let temporaryDirectory = URL(fileURLWithPath: "/private/tmp", isDirectory: true)
      .resolvingSymlinksInPath()
    let suppliedURL = URL(fileURLWithPath: suppliedPath).standardizedFileURL
    let resolvedParent = suppliedURL.deletingLastPathComponent().resolvingSymlinksInPath()
    guard resolvedParent.path == temporaryDirectory.path,
      !suppliedURL.lastPathComponent.isEmpty
    else {
      throw PreviewObserverInvalidation.sampler(
        "raw samples must be a direct child of the temporary directory")
    }
    let canonicalURL = temporaryDirectory.appendingPathComponent(
      suppliedURL.lastPathComponent,
      isDirectory: false
    )
    return canonicalURL.path
  }
}

enum ExecutableIdentityValidator {
  static func isDigest(_ value: String) -> Bool {
    value.utf8.count == 64
      && value.utf8.allSatisfy { byte in
        (48...57).contains(byte) || (97...102).contains(byte)
      }
  }

  static func sha256(atPath path: String) throws -> String {
    let handle = try FileHandle(forReadingFrom: URL(fileURLWithPath: path))
    defer { try? handle.close() }
    var hasher = SHA256()
    while let data = try handle.read(upToCount: 1_048_576), !data.isEmpty {
      hasher.update(data: data)
    }
    return hasher.finalize().map { String(format: "%02x", $0) }.joined()
  }
}
