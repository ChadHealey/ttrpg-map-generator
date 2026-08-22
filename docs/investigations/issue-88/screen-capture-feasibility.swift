import AppKit
import CoreMedia
import CoreVideo
import Foundation
import ScreenCaptureKit

/// Feasibility-only SCStream probe for issue 88. Its output is not release evidence.
@main
struct ScreenCaptureFeasibilityProbe {
  static func main() async throws {
    let application = NSApplication.shared
    guard application.activationPolicy() == .prohibited
      || application.setActivationPolicy(.prohibited)
    else {
      throw ProbeError.activationPolicy
    }
    guard CommandLine.arguments.count == 8,
      let durationSeconds = UInt64(CommandLine.arguments[2]),
      durationSeconds > 0,
      let dispatchDelaySeconds = UInt64(CommandLine.arguments[3]),
      dispatchDelaySeconds > 0,
      let sourceX = Double(CommandLine.arguments[4]),
      let sourceY = Double(CommandLine.arguments[5]),
      let sourceWidth = Double(CommandLine.arguments[6]),
      sourceWidth > 0,
      let sourceHeight = Double(CommandLine.arguments[7]),
      sourceHeight > 0
    else {
      throw ProbeError.usage
    }

    let bundleIdentifier = CommandLine.arguments[1]
    let content = try await SCShareableContent.current
    let matchingWindows = content.windows.filter { window in
      window.owningApplication?.bundleIdentifier == bundleIdentifier && window.isOnScreen
        && window.windowLayer == 0
    }
    guard matchingWindows.count == 1, let window = matchingWindows.first else {
      throw ProbeError.windowCount(matchingWindows.count)
    }

    let sourceRect = CGRect(
      x: sourceX,
      y: sourceY,
      width: sourceWidth,
      height: sourceHeight
    )
    let windowBounds = CGRect(origin: .zero, size: window.frame.size)
    guard windowBounds.contains(sourceRect) else {
      throw ProbeError.cropOutsideWindow(sourceRect, windowBounds)
    }

    let filter = SCContentFilter(desktopIndependentWindow: window)
    let configuration = SCStreamConfiguration()
    configuration.sourceRect = sourceRect
    configuration.width = 512
    configuration.height = 256
    configuration.minimumFrameInterval = CMTime(value: 1, timescale: 60)
    configuration.queueDepth = 3
    configuration.pixelFormat = kCVPixelFormatType_32BGRA
    configuration.showsCursor = false

    let output = FrameOutput()
    let stream = SCStream(filter: filter, configuration: configuration, delegate: output)
    try stream.addStreamOutput(output, type: .screen, sampleHandlerQueue: output.queue)

    print(
      "stream=start onScreen=\(window.isOnScreen) active=\(window.isActive) "
        + "layer=\(window.windowLayer) windowFrame=\(describe(window.frame)) "
        + "sourceRect=\(describe(sourceRect)) outputPixels=512x256"
    )
    try await stream.startCapture()
    try await waitForBaseline(output)
    print("stream=baseline-ready dispatchDelaySeconds=\(dispatchDelaySeconds)")
    try await Task.sleep(nanoseconds: dispatchDelaySeconds * 1_000_000_000)
    let dispatchTime = mach_absolute_time()
    output.markDispatched(at: dispatchTime)
    print("stream=dispatch-marker mach=\(dispatchTime)")
    try await Task.sleep(nanoseconds: durationSeconds * 1_000_000_000)
    try await stream.stopCapture()
    output.queue.sync {}
    let summary = output.summary
    print(
      "stream=stop completeFrames=\(summary.completeFrameCount) "
        + "changedFramesAfterDispatch=\(summary.changedFramesAfterDispatch) "
        + "qualifyingFrames=\(summary.qualifyingFrames)"
    )
    guard summary.qualifyingFrames > 0 else {
      throw ProbeError.noQualifyingFrame
    }
  }

  private static func waitForBaseline(_ output: FrameOutput) async throws {
    for _ in 0..<500 {
      if output.summary.hasBaseline {
        return
      }
      try await Task.sleep(nanoseconds: 10_000_000)
    }
    throw ProbeError.baselineTimeout
  }
}

final class FrameOutput: NSObject, SCStreamOutput, SCStreamDelegate, @unchecked Sendable {
  let queue = DispatchQueue(label: "issue88.screen-capture-feasibility")

  private let stateLock = NSLock()
  private var baselineHash: UInt64?
  private var completeFrameCount = 0
  private var dispatchTime: UInt64?
  private var changedFramesAfterDispatch = 0
  private var hasLoggedChangedFrame = false
  private var hasLoggedQualifyingFrame = false
  private var qualifyingFrames = 0

  var summary: ProbeSummary {
    stateLock.withLock {
      ProbeSummary(
        hasBaseline: baselineHash != nil,
        completeFrameCount: completeFrameCount,
        changedFramesAfterDispatch: changedFramesAfterDispatch,
        qualifyingFrames: qualifyingFrames
      )
    }
  }

  func markDispatched(at time: UInt64) {
    stateLock.withLock {
      dispatchTime = time
    }
  }

  func stream(
    _ stream: SCStream,
    didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
    of outputType: SCStreamOutputType
  ) {
    guard outputType == .screen,
      sampleBuffer.isValid,
      let attachments = CMSampleBufferGetSampleAttachmentsArray(
        sampleBuffer,
        createIfNecessary: false
      ) as? [[SCStreamFrameInfo: Any]],
      let frame = attachments.first,
      let statusRawValue = frame[.status] as? Int,
      let status = SCFrameStatus(rawValue: statusRawValue),
      status == .complete,
      let displayTime = frame[.displayTime] as? UInt64,
      let pixelBuffer = sampleBuffer.imageBuffer
    else {
      return
    }

    let metrics = inspectPixels(in: pixelBuffer)
    let dirtyRects = frame[.dirtyRects] as? [CGRect] ?? []
    let callbackTime = mach_absolute_time()
    let observation = stateLock.withLock { () -> FrameObservation in
      completeFrameCount += 1
      if baselineHash == nil {
        baselineHash = metrics.hash
        return FrameObservation(
          isBaseline: true,
          changedAfterDispatch: false,
          qualifies: false,
          shouldLog: true
        )
      }
      let afterDispatch = dispatchTime.map { displayTime > $0 } ?? false
      let changed = afterDispatch && metrics.hash != baselineHash
      let qualifies = changed && metrics.landLike > 100 && metrics.waterLike > 100
      if changed {
        changedFramesAfterDispatch += 1
      }
      if qualifies {
        qualifyingFrames += 1
      }
      let shouldLog = (changed && !hasLoggedChangedFrame)
        || (qualifies && !hasLoggedQualifyingFrame)
      hasLoggedChangedFrame = hasLoggedChangedFrame || changed
      hasLoggedQualifyingFrame = hasLoggedQualifyingFrame || qualifies
      return FrameObservation(
        isBaseline: false,
        changedAfterDispatch: changed,
        qualifies: qualifies,
        shouldLog: shouldLog
      )
    }

    if observation.isBaseline || observation.shouldLog {
      print(
        "frame=\(observation.isBaseline ? "baseline" : "changed") "
          + "displayMach=\(displayTime) callbackMach=\(callbackTime) "
          + "hash=\(String(metrics.hash, radix: 16)) dirtyRects=\(describe(dirtyRects)) "
          + "landLike=\(metrics.landLike) waterLike=\(metrics.waterLike) "
          + "topColors=\(metrics.topColors.joined(separator: ",")) "
          + "qualifies=\(observation.qualifies)"
      )
    }
  }

  func stream(_ stream: SCStream, didStopWithError error: any Error) {
    print("stream=error description=\(error.localizedDescription)")
  }

  private func inspectPixels(in pixelBuffer: CVPixelBuffer) -> PixelMetrics {
    CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }
    guard let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer) else {
      return PixelMetrics(hash: 0, landLike: 0, waterLike: 0, topColors: [])
    }

    let width = CVPixelBufferGetWidth(pixelBuffer)
    let height = CVPixelBufferGetHeight(pixelBuffer)
    let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)
    let bytes = baseAddress.assumingMemoryBound(to: UInt8.self)
    var hash: UInt64 = 14_695_981_039_346_656_037
    var colorCounts: [UInt32: Int] = [:]
    var landLike = 0
    var waterLike = 0
    for y in 0..<height {
      let row = bytes.advanced(by: y * bytesPerRow)
      for offset in 0..<(width * 4) {
        hash ^= UInt64(row[offset])
        hash &*= 1_099_511_628_211
      }
      for x in 0..<width {
        let pixel = row.advanced(by: x * 4)
        let blue = Int(pixel[0])
        let green = Int(pixel[1])
        let red = Int(pixel[2])
        let color = UInt32(red << 16 | green << 8 | blue)
        colorCounts[color, default: 0] += 1
        if near(red, 220) && near(green, 207) && near(blue, 171) {
          landLike += 1
        }
        if near(red, 180) && near(green, 202) && near(blue, 199) {
          waterLike += 1
        }
      }
    }
    let topColors = colorCounts.sorted { left, right in
      left.value == right.value ? left.key < right.key : left.value > right.value
    }.prefix(4)
    return PixelMetrics(
      hash: hash,
      landLike: landLike,
      waterLike: waterLike,
      topColors: topColors.map { color, count in
        "\(String(format: "%06x", color)):\(count)"
      }
    )
  }

  private func near(_ observed: Int, _ expected: Int) -> Bool {
    abs(observed - expected) <= 10
  }
}

private func describe(_ rect: CGRect) -> String {
  "x:\(Int(rect.origin.x)),y:\(Int(rect.origin.y)),w:\(Int(rect.width)),h:\(Int(rect.height))"
}

private func describe(_ rects: [CGRect]) -> String {
  "[\(rects.map(describe).joined(separator: ";"))]"
}

struct PixelMetrics {
  let hash: UInt64
  let landLike: Int
  let waterLike: Int
  let topColors: [String]
}

struct FrameObservation {
  let isBaseline: Bool
  let changedAfterDispatch: Bool
  let qualifies: Bool
  let shouldLog: Bool
}

struct ProbeSummary {
  let hasBaseline: Bool
  let completeFrameCount: Int
  let changedFramesAfterDispatch: Int
  let qualifyingFrames: Int
}

enum ProbeError: LocalizedError {
  case activationPolicy
  case baselineTimeout
  case cropOutsideWindow(CGRect, CGRect)
  case noQualifyingFrame
  case usage
  case windowCount(Int)

  var errorDescription: String? {
    switch self {
      case .activationPolicy:
        return "failed to make the capture observer a foreground-prohibited process"
      case .baselineTimeout:
        return "SCStream did not produce a complete baseline frame within five seconds"
      case let .cropOutsideWindow(crop, window):
        return "source crop \(describe(crop)) is outside window bounds \(describe(window))"
      case .noQualifyingFrame:
        return "no changed post-dispatch frame satisfied the calibrated palette checks"
      case .usage:
        return "usage: screen-capture-feasibility bundle-id duration-seconds dispatch-delay-seconds x y width height"
      case let .windowCount(count):
        return "expected exactly one on-screen layer-zero window, found \(count)"
    }
  }
}
