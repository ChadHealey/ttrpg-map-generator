import AppKit
import CryptoKit
import Darwin
import Foundation

struct Issue121LaunchPlan: Equatable {
  let applicationURL: URL
  let environment: [String: String]
  let activates: Bool
  let addsToRecentItems: Bool
  let createsNewApplicationInstance: Bool
}

struct Issue121PreparedCandidate: Equatable {
  let applicationURL: URL
  let executableURL: URL
  let bundleIdentifier: String
  let executableSHA256: String
}

struct Issue121RetainedCandidate: Equatable {
  let processIdentifier: Int32
  let applicationURL: URL
  let executableURL: URL
  let bundleIdentifier: String
  let executableSHA256: String
}

struct Issue121CandidateSnapshot: Equatable {
  let processIdentifier: Int32
  let applicationURL: URL?
  let executableURL: URL?
  let bundleIdentifier: String?
  let executableSHA256: String?
  let isTerminated: Bool
}

enum Issue121CandidateIdentity {
  static func prepare(
    applicationPath: String,
    bundleIdentifier: String,
    expectedExecutableSHA256: String
  ) throws -> Issue121PreparedCandidate {
    guard applicationPath.hasPrefix("/"), applicationPath.hasSuffix(".app"),
      isCanonicalDigest(expectedExecutableSHA256)
    else { throw Issue121Failure.usage }
    let supplied = URL(fileURLWithPath: applicationPath, isDirectory: true).standardizedFileURL
    let applicationURL = supplied.resolvingSymlinksInPath()
    var isDirectory: ObjCBool = false
    guard FileManager.default.fileExists(atPath: applicationURL.path, isDirectory: &isDirectory),
      isDirectory.boolValue,
      let bundle = Bundle(url: applicationURL), bundle.bundleIdentifier == bundleIdentifier,
      let executableURL = bundle.executableURL?.resolvingSymlinksInPath()
    else { throw Issue121Failure.candidateIdentity }
    let digest = try sha256(at: executableURL)
    guard issue121ConstantTimeEqual(Array(digest.utf8), Array(expectedExecutableSHA256.utf8)) else {
      throw Issue121Failure.candidateIdentity
    }
    return Issue121PreparedCandidate(
      applicationURL: applicationURL,
      executableURL: executableURL,
      bundleIdentifier: bundleIdentifier,
      executableSHA256: digest
    )
  }

  static func validateRetained(
    _ retained: Issue121RetainedCandidate,
    snapshot: Issue121CandidateSnapshot
  ) throws {
    guard retained.processIdentifier > 0,
      retained.applicationURL.path.hasPrefix("/"), retained.applicationURL.path.hasSuffix(".app"),
      !retained.bundleIdentifier.isEmpty, isCanonicalDigest(retained.executableSHA256),
      !snapshot.isTerminated,
      snapshot.processIdentifier == retained.processIdentifier,
      snapshot.applicationURL?.resolvingSymlinksInPath() == retained.applicationURL,
      snapshot.executableURL?.resolvingSymlinksInPath() == retained.executableURL,
      snapshot.bundleIdentifier == retained.bundleIdentifier,
      snapshot.executableSHA256 == retained.executableSHA256
    else { throw Issue121Failure.candidateIdentity }
  }

  @MainActor
  static func workspaceSnapshot(
    retained: Issue121RetainedCandidate
  ) -> Issue121CandidateSnapshot {
    let applications = NSRunningApplication.runningApplications(
      withBundleIdentifier: retained.bundleIdentifier
    ).filter { !$0.isTerminated }
    guard applications.count == 1, let application = applications.first,
      application.processIdentifier == retained.processIdentifier,
      let executableURL = application.executableURL?.resolvingSymlinksInPath()
    else {
      return Issue121CandidateSnapshot(
        processIdentifier: retained.processIdentifier,
        applicationURL: nil,
        executableURL: nil,
        bundleIdentifier: nil,
        executableSHA256: nil,
        isTerminated: true
      )
    }
    return Issue121CandidateSnapshot(
      processIdentifier: application.processIdentifier,
      applicationURL: application.bundleURL?.resolvingSymlinksInPath(),
      executableURL: executableURL,
      bundleIdentifier: application.bundleIdentifier,
      executableSHA256: try? sha256(at: executableURL),
      isTerminated: application.isTerminated
    )
  }

  static func processPathSnapshot(
    retained: Issue121RetainedCandidate
  ) -> Issue121CandidateSnapshot {
    var pathBytes = [CChar](repeating: 0, count: 4 * Int(MAXPATHLEN))
    let count = proc_pidpath(
      retained.processIdentifier,
      &pathBytes,
      UInt32(pathBytes.count)
    )
    guard count > 0 else {
      return Issue121CandidateSnapshot(
        processIdentifier: retained.processIdentifier,
        applicationURL: nil,
        executableURL: nil,
        bundleIdentifier: nil,
        executableSHA256: nil,
        isTerminated: true
      )
    }
    let executableURL = URL(fileURLWithPath: String(cString: pathBytes)).resolvingSymlinksInPath()
    return Issue121CandidateSnapshot(
      processIdentifier: retained.processIdentifier,
      applicationURL: retained.applicationURL,
      executableURL: executableURL,
      bundleIdentifier: retained.bundleIdentifier,
      executableSHA256: try? sha256(at: executableURL),
      isTerminated: false
    )
  }

  static func isCanonicalDigest(_ value: String) -> Bool {
    value.utf8.count == 64
      && value.utf8.allSatisfy { byte in
        byte.isASCIIDigit || (UInt8(ascii: "a")...UInt8(ascii: "f")).contains(byte)
      }
  }

  static func sha256(at url: URL) throws -> String {
    let handle = try FileHandle(forReadingFrom: url)
    defer { try? handle.close() }
    var hasher = SHA256()
    while let data = try handle.read(upToCount: 1_048_576), !data.isEmpty {
      hasher.update(data: data)
    }
    return hasher.finalize().map { String(format: "%02x", $0) }.joined()
  }
}

extension UInt8 {
  fileprivate var isASCIIDigit: Bool { (0x30...0x39).contains(self) }
}
