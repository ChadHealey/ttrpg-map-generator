import ApplicationServices
import CoreMedia
import CoreVideo
import Foundation
import ScreenCaptureKit

final class CancellationQuiescenceFrameOutput: NSObject, SCStreamOutput, SCStreamDelegate,
  @unchecked Sendable
{
  let queue = DispatchQueue(label: "issue98.generation-cancellation.capture")
  private let lock = NSLock()
  private let foreground: ForegroundMonitor
  private var quietWindow: GenerationCancellationQuietWindow?

  init(foreground: ForegroundMonitor) { self.foreground = foreground }

  var quietWindowSummary: GenerationCancellationQuietWindowSummary {
    lock.withLock {
      quietWindow?.summary
        ?? GenerationCancellationQuietWindowSummary(
          postAcknowledgementBaselineHash: nil,
          comparisonFrameCount: 0,
          pixelsChanged: false
        )
    }
  }
  var foregroundIntact: Bool { foreground.isIntact }

  func markAcknowledged(at time: UInt64) {
    lock.withLock {
      guard quietWindow == nil else { return }
      quietWindow = GenerationCancellationQuietWindow(terminalAcknowledgementTime: time)
    }
  }

  func stream(
    _ stream: SCStream,
    didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
    of outputType: SCStreamOutputType
  ) {
    guard outputType == .screen, sampleBuffer.isValid,
      let attachments = CMSampleBufferGetSampleAttachmentsArray(
        sampleBuffer,
        createIfNecessary: false
      ) as? [[SCStreamFrameInfo: Any]],
      let frame = attachments.first,
      let statusValue = frame[.status] as? Int,
      SCFrameStatus(rawValue: statusValue) == .complete,
      let displayTime = frame[.displayTime] as? UInt64,
      let pixelBuffer = sampleBuffer.imageBuffer,
      CVPixelBufferGetWidth(pixelBuffer) == cancellationCaptureWidth,
      CVPixelBufferGetHeight(pixelBuffer) == cancellationCaptureHeight
    else { return }
    let hash = pixelHash(pixelBuffer)
    lock.withLock {
      quietWindow?.observeCompleteFrame(displayTime: displayTime, hash: hash)
    }
  }

  func stream(_ stream: SCStream, didStopWithError error: any Error) {}

  private func pixelHash(_ buffer: CVPixelBuffer) -> UInt64 {
    CVPixelBufferLockBaseAddress(buffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
    guard let base = CVPixelBufferGetBaseAddress(buffer) else { return 0 }
    let bytes = base.assumingMemoryBound(to: UInt8.self)
    let bytesPerRow = CVPixelBufferGetBytesPerRow(buffer)
    var hash: UInt64 = 14_695_981_039_346_656_037
    for y in 0..<cancellationCaptureHeight {
      let row = bytes.advanced(by: y * bytesPerRow)
      for offset in 0..<(cancellationCaptureWidth * 4) {
        hash ^= UInt64(row[offset])
        hash &*= 1_099_511_628_211
      }
    }
    return hash
  }
}

extension AccessibilityObserver {
  func generationCancellationReceipt(
    definition: GatedAtlasFixtureDefinition,
    operation: GenerationCancellationOperation,
    safePoint: GenerationCancellationSafePoint,
    status: String
  ) throws -> PackagedGenerationCancellationReceipt {
    let marker = #""version":"packaged-generation-cancellation-observer-v1""#
    let values = try cancellationSnapshot().compactMap { element -> String? in
      guard (try? string(element, attribute: kAXRoleAttribute)) == kAXStaticTextRole as String,
        let value = try? string(element, attribute: kAXValueAttribute),
        value.contains(marker)
      else { return nil }
      return value
    }
    guard values.count == 1, let value = values.first else {
      throw PreviewObserverInvalidation.accessibility(
        "expected exactly one generation-cancellation receipt")
    }
    return try GenerationCancellationReceiptValidator.parse(
      value,
      definition: definition,
      operation: operation,
      safePoint: safePoint,
      expectedStatus: status
    )
  }

  func cancellationPresentationState(
    operation: GenerationCancellationOperation,
    definition: GatedAtlasFixtureDefinition
  ) throws -> Bool {
    let elements = try cancellationSnapshot()
    let imageLabels = elements.compactMap { element -> String? in
      guard (try? string(element, attribute: kAXRoleAttribute)) == kAXImageRole as String
      else { return nil }
      return try? label(of: element)
    }
    let text = elements.compactMap { element -> String? in
      guard (try? string(element, attribute: kAXRoleAttribute)) == kAXStaticTextRole as String
      else { return nil }
      return try? string(element, attribute: kAXValueAttribute)
    }
    let expectedFixturePhase: PackagedAtlasObserverPhase = operation == .preview ? .configured : .preview
    _ = try packagedFixtureReceipt(
      expectedDefinition: definition,
      expectedPhase: expectedFixturePhase
    )
    let previewImageCount = imageLabels.filter { $0 == previewLabel }.count
    let previewCaptionCount = text.filter { $0 == previewCaption }.count
    let acceptedCaptionCount = text.filter { $0 == acceptedAtlasCaption }.count
    if operation == .preview {
      return previewImageCount == 0 && previewCaptionCount == 0 && acceptedCaptionCount == 1
    }
    return previewImageCount == 1 && previewCaptionCount == 1 && acceptedCaptionCount == 0
  }

  private func cancellationSnapshot() throws -> [AXUIElement] {
    var result: [AXUIElement] = []
    var pending: [AXUIElement] = [application]
    var visitedByHash: [CFHashCode: [AXUIElement]] = [:]
    while let current = pending.popLast() {
      let hash = CFHash(current)
      if visitedByHash[hash]?.contains(where: { CFEqual($0, current) }) == true { continue }
      visitedByHash[hash, default: []].append(current)
      guard result.count < 4_096 else {
        throw PreviewObserverInvalidation.accessibility(
          "Accessibility tree exceeded the bounded unique-element traversal")
      }
      result.append(current)
      var raw: CFTypeRef?
      let error = AXUIElementCopyAttributeValue(
        current,
        kAXChildrenAttribute as CFString,
        &raw
      )
      if error == .success, let children = raw as? [AXUIElement] {
        pending.append(contentsOf: children)
      } else if error != .noValue && error != .attributeUnsupported {
        throw PreviewObserverInvalidation.accessibility("Accessibility child read failed")
      }
    }
    return result
  }
}
