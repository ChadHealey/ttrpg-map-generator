import Foundation

final class RSSSampler {
  private let process = Process()
  private let rawSamplesPath: String
  private let expectedRoleCount: Int
  private let standardError = Pipe()
  private var started = false
  private var stopped = false
  private var summary = ""

  init(executablePath: String, rawSamplesPath: String, pids: [Int32]) throws {
    guard pids.count == PreviewProcessRole.allCases.count else {
      throw PreviewObserverInvalidation.sampler(
        "RSS sampler received an incomplete resolved PID set")
    }
    self.rawSamplesPath = rawSamplesPath
    expectedRoleCount = pids.count
    process.executableURL = URL(fileURLWithPath: executablePath)
    process.arguments = ["30", "5", rawSamplesPath] + pids.map(String.init)
    process.standardError = standardError
    process.standardOutput = FileHandle.nullDevice
  }

  func start() throws {
    do { try process.run() } catch {
      throw PreviewObserverInvalidation.sampler("RSS sampler could not start")
    }
    started = true
  }

  func stop() {
    guard started, !stopped else { return }
    process.interrupt()
    process.waitUntilExit()
    stopped = true
    summary =
      String(
        data: standardError.fileHandleForReading.readDataToEndOfFile(),
        encoding: .utf8
      ) ?? ""
  }

  func stopIfRunning() { stop() }

  func measurement(
    dispatchEpochMilliseconds: Double,
    completionEpochMilliseconds: Double
  ) throws -> RSSMeasurement {
    guard stopped, process.terminationStatus == 0 else {
      throw PreviewObserverInvalidation.sampler("RSS sampler did not stop cleanly")
    }
    return try RSSReceiptValidator.measurement(
      csv: String(contentsOfFile: rawSamplesPath, encoding: .utf8),
      summary: summary,
      expectedRoleCount: expectedRoleCount,
      dispatchEpochMilliseconds: dispatchEpochMilliseconds,
      completionEpochMilliseconds: completionEpochMilliseconds
    )
  }
}

struct ProcessResult {
  let status: Int32
  let standardOutput: String
}

func runProcess(_ executable: String, arguments: [String]) throws -> ProcessResult {
  let process = Process()
  let output = Pipe()
  process.executableURL = URL(fileURLWithPath: executable)
  process.arguments = arguments
  process.standardOutput = output
  process.standardError = FileHandle.nullDevice
  try process.run()
  process.waitUntilExit()
  return ProcessResult(
    status: process.terminationStatus,
    standardOutput: String(
      data: output.fileHandleForReading.readDataToEndOfFile(),
      encoding: .utf8
    ) ?? ""
  )
}

struct TargetReceipt: Codable {
  let model: String
  let osVersion: String
  let osBuild: String
  let memoryGiB: Int

  static let approved = TargetReceipt(
    model: targetModel,
    osVersion: targetOSVersion,
    osBuild: targetOSBuild,
    memoryGiB: 24
  )
}

struct VisualReceipt: Codable {
  let completePostDispatchFrame: Bool
  let changedCanvasCrop: Bool
  let cropPixels: String
  let foregroundIntact: Bool
  let landPaletteBounded: Bool
  let waterPaletteBounded: Bool
}

struct AccessibilityReceipt: Codable {
  let previewLabel: Bool
  let disposableCaption: Bool
  let acceptFullEnabled: Bool
  let frontmost: Bool
}

struct MeasurementReceipt: Codable {
  let elapsedMilliseconds: Double
  let baselineAggregateRSSBytes: UInt64
  let peakAdditionalRSSBytes: UInt64
  let sampleCount: Int
  let maximumSampleIntervalMilliseconds: Double
}

struct ExecutableIdentityReceipt: Codable {
  let candidateSha256: String
  let samplerSha256: String
}

struct ObserverReceipt: Codable {
  let observerVersion: String
  let status: String
  let target: TargetReceipt
  let roleCounts: [String: Int]?
  let visual: VisualReceipt?
  let accessibility: AccessibilityReceipt?
  let executableIdentity: ExecutableIdentityReceipt?
  let membershipRevalidated: Bool
  let invalidAuthority: String?
  let invalidReason: String?
  let measurement: MeasurementReceipt?

  static func invalid(_ invalidation: PreviewObserverInvalidation) -> ObserverReceipt {
    ObserverReceipt(
      observerVersion: observerSchemaVersion,
      status: "invalid",
      target: .approved,
      roleCounts: nil,
      visual: nil,
      accessibility: nil,
      executableIdentity: nil,
      membershipRevalidated: false,
      invalidAuthority: invalidation.authority,
      invalidReason: invalidation.description,
      measurement: nil
    )
  }
}
