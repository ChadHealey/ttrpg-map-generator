import ApplicationServices
import CoreMedia
import CoreVideo
import Foundation
import ScreenCaptureKit

final class AcceptedAtlasFrameOutput: NSObject, SCStreamOutput, SCStreamDelegate,
  @unchecked Sendable
{
  let queue = DispatchQueue(label: "issue94.packaged-atlas.capture")
  private let lock = NSLock()
  private let foreground: ForegroundMonitor
  private var storedBaselineHash: UInt64?
  private var dispatchTime: UInt64?
  private var storedQualifyingFrame: AcceptedAtlasQualifyingFrame?

  init(foreground: ForegroundMonitor) {
    self.foreground = foreground
  }

  var baselineHash: UInt64? { lock.withLock { storedBaselineHash } }
  var qualifyingFrame: AcceptedAtlasQualifyingFrame? { lock.withLock { storedQualifyingFrame } }
  var foregroundIntact: Bool { foreground.isIntact }

  func markDispatched(at time: UInt64) {
    lock.withLock { dispatchTime = time }
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
      let status = SCFrameStatus(rawValue: statusValue),
      let displayTime = frame[.displayTime] as? UInt64,
      let pixelBuffer = sampleBuffer.imageBuffer,
      CVPixelBufferGetWidth(pixelBuffer) == fullAtlasCaptureWidth,
      CVPixelBufferGetHeight(pixelBuffer) == fullAtlasCaptureHeight
    else { return }
    let observation = inspectPixels(pixelBuffer)
    lock.withLock {
      guard storedQualifyingFrame == nil else { return }
      guard let baselineHash = storedBaselineHash else {
        if status == .complete { storedBaselineHash = observation.hash }
        return
      }
      guard let dispatchTime else { return }
      if AcceptedAtlasFramePredicate.qualifies(
        complete: status == .complete,
        displayTime: displayTime,
        dispatchTime: dispatchTime,
        baselineHash: baselineHash,
        candidate: observation,
        foregroundIntact: foreground.isIntact
      ) {
        storedQualifyingFrame = AcceptedAtlasQualifyingFrame(
          displayTime: displayTime,
          observation: observation
        )
      }
    }
  }

  func stream(_ stream: SCStream, didStopWithError error: any Error) {}

  private func inspectPixels(_ pixelBuffer: CVPixelBuffer) -> AcceptedAtlasPixelObservation {
    CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }
    guard let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer) else {
      return AcceptedAtlasPixelObservation(
        hash: 0,
        landLike: 0,
        waterLike: 0,
        inkLike: 0,
        previewLandLike: 0,
        previewWaterLike: 0
      )
    }
    let bytes = baseAddress.assumingMemoryBound(to: UInt8.self)
    let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)
    var observation = MutableAcceptedAtlasPixelObservation()
    for y in 0..<fullAtlasCaptureHeight {
      let row = bytes.advanced(by: y * bytesPerRow)
      for offset in 0..<(fullAtlasCaptureWidth * 4) {
        observation.hash ^= UInt64(row[offset])
        observation.hash &*= 1_099_511_628_211
      }
      for x in 0..<fullAtlasCaptureWidth {
        let pixel = row.advanced(by: x * 4)
        let blue = Int(pixel[0])
        let green = Int(pixel[1])
        let red = Int(pixel[2])
        if near(red, 201) && near(green, 195) && near(blue, 154) { observation.landLike += 1 }
        if near(red, 175) && near(green, 190) && near(blue, 192) { observation.waterLike += 1 }
        if near(red, 40) && near(green, 42) && near(blue, 36) { observation.inkLike += 1 }
        if near(red, 220) && near(green, 207) && near(blue, 171) {
          observation.previewLandLike += 1
        }
        if near(red, 180) && near(green, 202) && near(blue, 199) {
          observation.previewWaterLike += 1
        }
      }
    }
    return observation.immutable
  }

  private func near(_ observed: Int, _ expected: Int) -> Bool {
    abs(observed - expected) <= 10
  }
}

private struct MutableAcceptedAtlasPixelObservation {
  var hash: UInt64 = 14_695_981_039_346_656_037
  var landLike = 0
  var waterLike = 0
  var inkLike = 0
  var previewLandLike = 0
  var previewWaterLike = 0

  var immutable: AcceptedAtlasPixelObservation {
    AcceptedAtlasPixelObservation(
      hash: hash,
      landLike: landLike,
      waterLike: waterLike,
      inkLike: inkLike,
      previewLandLike: previewLandLike,
      previewWaterLike: previewWaterLike
    )
  }
}

struct AcceptedAtlasQualifyingFrame {
  let displayTime: UInt64
  let observation: AcceptedAtlasPixelObservation
}

extension AccessibilityObserver {
  func packagedFixtureReceipt(
    expectedDefinition: GatedAtlasFixtureDefinition,
    expectedPhase: PackagedAtlasObserverPhase
  ) throws -> PackagedAtlasFixtureReceipt {
    let marker = #""version":"packaged-atlas-observer-fixture-v1""#
    let values = try descendants(role: kAXStaticTextRole as String).compactMap {
      try? string($0, attribute: kAXValueAttribute)
    }.filter { $0.contains(marker) }
    guard values.count == 1, let value = values.first else {
      throw PreviewObserverInvalidation.fixture(
        "expected exactly one packaged fixture receipt")
    }
    return try PackagedAtlasFixtureReceiptParser.parse(
      value,
      expectedDefinition: expectedDefinition,
      expectedPhase: expectedPhase
    )
  }

  func acceptedAtlasReceipt(
    expectedDefinition: GatedAtlasFixtureDefinition
  ) throws -> AcceptedAtlasAccessibilityReceipt {
    let images = try descendants(role: kAXImageRole as String)
    let acceptedImages = images.filter { (try? label(of: $0)) == acceptedAtlasLabel }
    let previewImages = images.filter { (try? label(of: $0)) == previewLabel }
    let staticText = try descendants(role: kAXStaticTextRole as String).compactMap {
      try? string($0, attribute: kAXValueAttribute)
    }
    let acceptedCaptions = staticText.filter { $0 == acceptedAtlasCaption }
    let previewCaptions = staticText.filter { $0 == previewCaption }
    let buttons = try descendants(role: kAXButtonRole as String).filter {
      (try? label(of: $0)) == acceptFullTitle
    }
    guard acceptedImages.count == 1, previewImages.isEmpty,
      acceptedCaptions.count == 1, previewCaptions.isEmpty,
      buttons.count == 1, let button = buttons.first,
      !(try boolean(button, attribute: kAXEnabledAttribute))
    else {
      throw PreviewObserverInvalidation.accessibility(
        "the final accepted-atlas Accessibility receipt was incomplete or contradictory")
    }
    _ = try packagedFixtureReceipt(
      expectedDefinition: expectedDefinition,
      expectedPhase: .accepted
    )
    return AcceptedAtlasAccessibilityReceipt(
      acceptedCanvasLabel: true,
      acceptedCaption: true,
      disposablePreviewAbsent: true,
      acceptFullDisabled: true,
      fixtureReceiptMatched: true,
      frontmost: try boolean(application, attribute: kAXFrontmostAttribute)
    )
  }
}
