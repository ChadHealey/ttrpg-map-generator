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
  private var presentationWindow: GenerationCancellationPresentationWindow

  init(operation: GenerationCancellationOperation, foreground: ForegroundMonitor) {
    self.foreground = foreground
    presentationWindow = GenerationCancellationPresentationWindow(operation: operation)
  }

  var presentationSummary: GenerationCancellationPresentationSummary {
    lock.withLock { presentationWindow.summary }
  }
  var presentationBaselineEstablished: Bool {
    lock.withLock { presentationWindow.summary.presentationBaselineEstablished }
  }
  var foregroundIntact: Bool { foreground.isIntact }

  func markAcknowledged(at time: UInt64) {
    lock.withLock { presentationWindow.markAcknowledged(at: time) }
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
    let observation = inspectPixels(pixelBuffer)
    lock.withLock {
      if !presentationWindow.summary.presentationBaselineEstablished {
        presentationWindow.establishPresentationBaseline(observation)
      } else {
        presentationWindow.observeCompleteFrame(
          displayTime: displayTime,
          observation: observation,
          foregroundIntact: foreground.isIntact
        )
      }
    }
  }

  func stream(_ stream: SCStream, didStopWithError error: any Error) {}

  private func inspectPixels(_ buffer: CVPixelBuffer) -> GenerationCancellationFrameObservation {
    CVPixelBufferLockBaseAddress(buffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
    guard let base = CVPixelBufferGetBaseAddress(buffer) else {
      return GenerationCancellationFrameObservation(
        preview: PixelObservation(hash: 0, landLike: 0, waterLike: 0),
        acceptedAtlas: AcceptedAtlasPixelObservation(
          hash: 0,
          landLike: 0,
          waterLike: 0,
          inkLike: 0,
          previewLandLike: 0,
          previewWaterLike: 0
        )
      )
    }
    let bytes = base.assumingMemoryBound(to: UInt8.self)
    let bytesPerRow = CVPixelBufferGetBytesPerRow(buffer)
    var hash: UInt64 = 14_695_981_039_346_656_037
    var previewLandLike = 0
    var previewWaterLike = 0
    var acceptedLandLike = 0
    var acceptedWaterLike = 0
    var acceptedInkLike = 0
    for y in 0..<cancellationCaptureHeight {
      let row = bytes.advanced(by: y * bytesPerRow)
      for offset in 0..<(cancellationCaptureWidth * 4) {
        hash ^= UInt64(row[offset])
        hash &*= 1_099_511_628_211
      }
      for x in 0..<cancellationCaptureWidth {
        let pixel = row.advanced(by: x * 4)
        let blue = Int(pixel[0])
        let green = Int(pixel[1])
        let red = Int(pixel[2])
        if near(red, 220) && near(green, 207) && near(blue, 171) { previewLandLike += 1 }
        if near(red, 180) && near(green, 202) && near(blue, 199) { previewWaterLike += 1 }
        if near(red, 201) && near(green, 195) && near(blue, 154) { acceptedLandLike += 1 }
        if near(red, 175) && near(green, 190) && near(blue, 192) { acceptedWaterLike += 1 }
        if near(red, 40) && near(green, 42) && near(blue, 36) { acceptedInkLike += 1 }
      }
    }
    return GenerationCancellationFrameObservation(
      preview: PixelObservation(
        hash: hash,
        landLike: previewLandLike,
        waterLike: previewWaterLike
      ),
      acceptedAtlas: AcceptedAtlasPixelObservation(
        hash: hash,
        landLike: acceptedLandLike,
        waterLike: acceptedWaterLike,
        inkLike: acceptedInkLike,
        previewLandLike: previewLandLike,
        previewWaterLike: previewWaterLike
      )
    )
  }

  private func near(_ observed: Int, _ expected: Int) -> Bool {
    abs(observed - expected) <= 10
  }
}

final class DeterministicAftermathFrameOutput: NSObject, SCStreamOutput, SCStreamDelegate,
  @unchecked Sendable
{
  let queue = DispatchQueue(label: "issue104.generation-cancellation.aftermath-capture")
  private let lock = NSLock()
  private let foreground: ForegroundMonitor
  private var completeFrameCount = 0
  private var qualifyingObservation: AcceptedAtlasPixelObservation?

  init(foreground: ForegroundMonitor) {
    self.foreground = foreground
  }

  var summary: GenerationCancellationAftermathFrameSummary {
    lock.withLock {
      GenerationCancellationAftermathFrameSummary(
        completeFrameCount: completeFrameCount,
        qualifyingObservation: qualifyingObservation
      )
    }
  }
  var foregroundIntact: Bool { foreground.isIntact }

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
      let pixelBuffer = sampleBuffer.imageBuffer,
      CVPixelBufferGetWidth(pixelBuffer) == cancellationCaptureWidth,
      CVPixelBufferGetHeight(pixelBuffer) == cancellationCaptureHeight
    else { return }
    let observation = inspectPixels(pixelBuffer)
    lock.withLock {
      completeFrameCount += 1
      guard qualifyingObservation == nil,
        GenerationCancellationAftermathFramePredicate.qualifies(
          complete: true,
          candidate: observation,
          foregroundIntact: foreground.isIntact
        )
      else { return }
      qualifyingObservation = observation
    }
  }

  func stream(_ stream: SCStream, didStopWithError error: any Error) {}

  private func inspectPixels(_ buffer: CVPixelBuffer) -> AcceptedAtlasPixelObservation {
    CVPixelBufferLockBaseAddress(buffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
    guard let base = CVPixelBufferGetBaseAddress(buffer) else {
      return AcceptedAtlasPixelObservation(
        hash: 0,
        landLike: 0,
        waterLike: 0,
        inkLike: 0,
        previewLandLike: 0,
        previewWaterLike: 0
      )
    }
    let bytes = base.assumingMemoryBound(to: UInt8.self)
    let bytesPerRow = CVPixelBufferGetBytesPerRow(buffer)
    var hash: UInt64 = 14_695_981_039_346_656_037
    var previewLandLike = 0
    var previewWaterLike = 0
    var acceptedLandLike = 0
    var acceptedWaterLike = 0
    var acceptedInkLike = 0
    for y in 0..<cancellationCaptureHeight {
      let row = bytes.advanced(by: y * bytesPerRow)
      for offset in 0..<(cancellationCaptureWidth * 4) {
        hash ^= UInt64(row[offset])
        hash &*= 1_099_511_628_211
      }
      for x in 0..<cancellationCaptureWidth {
        let pixel = row.advanced(by: x * 4)
        let blue = Int(pixel[0])
        let green = Int(pixel[1])
        let red = Int(pixel[2])
        if near(red, 220) && near(green, 207) && near(blue, 171) { previewLandLike += 1 }
        if near(red, 180) && near(green, 202) && near(blue, 199) { previewWaterLike += 1 }
        if near(red, 201) && near(green, 195) && near(blue, 154) { acceptedLandLike += 1 }
        if near(red, 175) && near(green, 190) && near(blue, 192) { acceptedWaterLike += 1 }
        if near(red, 40) && near(green, 42) && near(blue, 36) { acceptedInkLike += 1 }
      }
    }
    return AcceptedAtlasPixelObservation(
      hash: hash,
      landLike: acceptedLandLike,
      waterLike: acceptedWaterLike,
      inkLike: acceptedInkLike,
      previewLandLike: previewLandLike,
      previewWaterLike: previewWaterLike
    )
  }

  private func near(_ observed: Int, _ expected: Int) -> Bool {
    abs(observed - expected) <= 10
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

  func currentAcceptedCanvasCrop(windowFrame: CGRect) throws
    -> GenerationCancellationAftermathCanvasResolution
  {
    guard AXIsProcessTrusted() else {
      throw PreviewObserverInvalidation.accessibility("Accessibility permission was not granted")
    }
    guard try boolean(application, attribute: kAXFrontmostAttribute) else {
      throw PreviewObserverInvalidation.candidateNotFrontmost
    }
    let acceptedCanvasFrames = try cancellationSnapshot().compactMap { element -> CGRect? in
      guard (try? string(element, attribute: kAXRoleAttribute)) == kAXImageRole as String,
        (try? label(of: element)) == acceptedAtlasLabel
      else { return nil }
      return try cancellationFrame(of: element)
    }
    return try GenerationCancellationAftermathCanvasResolver.resolve(
      acceptedCanvasFrames: acceptedCanvasFrames,
      windowFrame: windowFrame
    )
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

  private func cancellationFrame(of element: AXUIElement) throws -> CGRect {
    guard let positionValue: AXValue = try cancellationValue(
      element,
      attribute: kAXPositionAttribute
    ),
      let sizeValue: AXValue = try cancellationValue(
        element,
        attribute: kAXSizeAttribute
      )
    else {
      throw PreviewObserverInvalidation.accessibility(
        "current accepted canvas bounds were unavailable"
      )
    }
    var point = CGPoint.zero
    var size = CGSize.zero
    guard AXValueGetValue(positionValue, .cgPoint, &point),
      AXValueGetValue(sizeValue, .cgSize, &size)
    else {
      throw PreviewObserverInvalidation.accessibility("current accepted canvas bounds were invalid")
    }
    return CGRect(origin: point, size: size)
  }

  private func cancellationValue<T>(_ element: AXUIElement, attribute: String) throws -> T? {
    var raw: CFTypeRef?
    let error = AXUIElementCopyAttributeValue(element, attribute as CFString, &raw)
    if error == .noValue || error == .attributeUnsupported { return nil }
    guard error == .success else {
      throw PreviewObserverInvalidation.accessibility("Accessibility attribute read failed")
    }
    return raw as? T
  }
}
