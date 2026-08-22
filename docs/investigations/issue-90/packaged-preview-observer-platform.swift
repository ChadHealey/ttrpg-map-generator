import AppKit
import ApplicationServices
import CoreMedia
import CoreVideo
import Foundation
import ScreenCaptureKit

final class PreviewFrameOutput: NSObject, SCStreamOutput, SCStreamDelegate,
  @unchecked Sendable
{
  let queue = DispatchQueue(label: "issue90.packaged-preview.capture")
  private let lock = NSLock()
  private let foreground: ForegroundMonitor
  private var storedBaseline: PixelObservation?
  private var dispatchTime: UInt64?
  private var storedQualifyingFrame: QualifyingFrame?

  init(foreground: ForegroundMonitor) {
    self.foreground = foreground
  }

  var baseline: PixelObservation? { lock.withLock { storedBaseline } }
  var qualifyingFrame: QualifyingFrame? { lock.withLock { storedQualifyingFrame } }
  var foregroundIntact: Bool { foreground.isIntact }

  func markDispatched(at time: UInt64) {
    lock.withLock { dispatchTime = time }
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
      let statusValue = frame[.status] as? Int,
      let status = SCFrameStatus(rawValue: statusValue),
      let displayTime = frame[.displayTime] as? UInt64,
      let pixelBuffer = sampleBuffer.imageBuffer
    else { return }
    guard CVPixelBufferGetWidth(pixelBuffer) == captureWidth,
      CVPixelBufferGetHeight(pixelBuffer) == captureHeight
    else { return }
    let observation = inspectPixels(pixelBuffer)
    lock.withLock {
      guard storedQualifyingFrame == nil else { return }
      guard let baseline = storedBaseline else {
        if status == .complete { storedBaseline = observation }
        return
      }
      guard let dispatchTime else { return }
      if PreviewFramePredicate.qualifies(
        complete: status == .complete,
        displayTime: displayTime,
        dispatchTime: dispatchTime,
        baseline: baseline,
        candidate: observation,
        foregroundIntact: foreground.isIntact
      ) {
        storedQualifyingFrame = QualifyingFrame(
          displayTime: displayTime,
          callbackTime: mach_absolute_time(),
          observation: observation
        )
      }
    }
  }

  func stream(_ stream: SCStream, didStopWithError error: any Error) {}

  private func inspectPixels(_ pixelBuffer: CVPixelBuffer) -> PixelObservation {
    CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }
    guard let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer) else {
      return PixelObservation(hash: 0, landLike: 0, waterLike: 0)
    }
    let bytes = baseAddress.assumingMemoryBound(to: UInt8.self)
    let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)
    var hash: UInt64 = 14_695_981_039_346_656_037
    var landLike = 0
    var waterLike = 0
    for y in 0..<captureHeight {
      let row = bytes.advanced(by: y * bytesPerRow)
      for offset in 0..<(captureWidth * 4) {
        hash ^= UInt64(row[offset])
        hash &*= 1_099_511_628_211
      }
      for x in 0..<captureWidth {
        let pixel = row.advanced(by: x * 4)
        let blue = Int(pixel[0])
        let green = Int(pixel[1])
        let red = Int(pixel[2])
        if near(red, 220) && near(green, 207) && near(blue, 171) { landLike += 1 }
        if near(red, 180) && near(green, 202) && near(blue, 199) { waterLike += 1 }
      }
    }
    return PixelObservation(hash: hash, landLike: landLike, waterLike: waterLike)
  }

  private func near(_ observed: Int, _ expected: Int) -> Bool {
    abs(observed - expected) <= 10
  }
}

struct QualifyingFrame {
  let displayTime: UInt64
  let callbackTime: UInt64
  let observation: PixelObservation
}

final class ForegroundMonitor: @unchecked Sendable {
  private let applicationPID: pid_t
  private let lock = NSLock()
  private var intact = true
  private var token: NSObjectProtocol?

  init(applicationPID: pid_t) throws {
    self.applicationPID = applicationPID
    guard NSWorkspace.shared.frontmostApplication?.processIdentifier == applicationPID else {
      throw PreviewObserverInvalidation.candidateNotFrontmost
    }
    token = NSWorkspace.shared.notificationCenter.addObserver(
      forName: NSWorkspace.didActivateApplicationNotification,
      object: nil,
      queue: nil
    ) { [weak self] notification in
      guard let self,
        let app = notification.userInfo?[NSWorkspace.applicationUserInfoKey]
          as? NSRunningApplication
      else { return }
      if app.processIdentifier != self.applicationPID {
        self.lock.withLock { self.intact = false }
      }
    }
  }

  var isIntact: Bool {
    lock.withLock {
      intact && NSWorkspace.shared.frontmostApplication?.processIdentifier == applicationPID
    }
  }

  func stop() {
    if let token { NSWorkspace.shared.notificationCenter.removeObserver(token) }
    token = nil
  }
}

final class AccessibilityObserver {
  private let applicationPID: pid_t
  private let application: AXUIElement

  init(applicationPID: pid_t) {
    self.applicationPID = applicationPID
    application = AXUIElementCreateApplication(applicationPID)
  }

  func prepareVisibleCanvas(windowFrame: CGRect) throws -> CGRect {
    guard AXIsProcessTrusted() else {
      throw PreviewObserverInvalidation.accessibility("Accessibility permission was not granted")
    }
    try set(application, attribute: kAXFrontmostAttribute, value: kCFBooleanTrue)
    var images: [AXUIElement] = []
    for _ in 0..<200 {
      images = try descendants(role: kAXImageRole as String).filter {
        guard let label = try? label(of: $0) else { return false }
        return label == initialCanvasLabel || label == previewLabel
      }
      if images.count == 1, try boolean(application, attribute: kAXFrontmostAttribute) { break }
      Thread.sleep(forTimeInterval: 0.01)
    }
    guard images.count == 1, let image = images.first else {
      throw PreviewObserverInvalidation.accessibility("expected exactly one preview canvas image")
    }
    let actionError = AXUIElementPerformAction(image, "AXScrollToVisible" as CFString)
    guard actionError == .success else {
      throw PreviewObserverInvalidation.accessibility(
        "could not scroll the canvas visible before dispatch")
    }
    Thread.sleep(forTimeInterval: 0.5)
    guard try boolean(application, attribute: kAXFrontmostAttribute) else {
      throw PreviewObserverInvalidation.candidateNotFrontmost
    }
    let canvasFrame = try frame(of: image)
    let crop = CGRect(
      x: canvasFrame.origin.x - windowFrame.origin.x,
      y: canvasFrame.origin.y - windowFrame.origin.y,
      width: canvasFrame.width,
      height: canvasFrame.height
    )
    let windowLocal = CGRect(origin: .zero, size: windowFrame.size)
    guard crop.width > 0, crop.height > 0, windowLocal.contains(crop) else {
      throw PreviewObserverInvalidation.accessibility(
        "the visible canvas crop was outside the candidate window")
    }
    return crop
  }

  func finalReceipt() throws -> AccessibilityReceipt {
    let frontmost = try boolean(application, attribute: kAXFrontmostAttribute)
    let images = try descendants(role: kAXImageRole as String).filter {
      (try? label(of: $0)) == previewLabel
    }
    let captions = try descendants(role: kAXStaticTextRole as String).filter {
      (try? string($0, attribute: kAXValueAttribute)) == previewCaption
    }
    let buttons = try descendants(role: kAXButtonRole as String).filter {
      (try? label(of: $0)) == acceptFullTitle
    }
    guard images.count == 1, captions.count == 1, buttons.count == 1,
      let button = buttons.first,
      try boolean(button, attribute: kAXEnabledAttribute)
    else {
      throw PreviewObserverInvalidation.accessibility(
        "the final structured preview receipt was incomplete or contradictory")
    }
    return AccessibilityReceipt(
      previewLabel: true,
      disposableCaption: true,
      acceptFullEnabled: true,
      frontmost: frontmost
    )
  }

  private func descendants(role: String) throws -> [AXUIElement] {
    var result: [AXUIElement] = []
    var pending: [AXUIElement] = [application]
    var visited = 0
    while let current = pending.popLast() {
      visited += 1
      guard visited <= 4_096 else {
        throw PreviewObserverInvalidation.accessibility(
          "Accessibility tree exceeded the bounded traversal")
      }
      if (try? string(current, attribute: kAXRoleAttribute)) == role { result.append(current) }
      pending.append(contentsOf: (try? elements(current, attribute: kAXChildrenAttribute)) ?? [])
    }
    return result
  }

  private func label(of element: AXUIElement) throws -> String {
    for attribute in [kAXTitleAttribute, kAXDescriptionAttribute, kAXValueAttribute] {
      if let value = try? string(element, attribute: attribute), !value.isEmpty { return value }
    }
    return ""
  }

  private func frame(of element: AXUIElement) throws -> CGRect {
    guard let positionValue: AXValue = try value(element, attribute: kAXPositionAttribute),
      let sizeValue: AXValue = try value(element, attribute: kAXSizeAttribute)
    else {
      throw PreviewObserverInvalidation.accessibility("canvas bounds were unavailable")
    }
    var point = CGPoint.zero
    var size = CGSize.zero
    guard AXValueGetValue(positionValue, .cgPoint, &point),
      AXValueGetValue(sizeValue, .cgSize, &size)
    else {
      throw PreviewObserverInvalidation.accessibility("canvas bounds were invalid")
    }
    return CGRect(origin: point, size: size)
  }

  private func string(_ element: AXUIElement, attribute: String) throws -> String {
    guard let result: String = try value(element, attribute: attribute) else {
      throw PreviewObserverInvalidation.accessibility("missing string attribute")
    }
    return result
  }

  private func boolean(_ element: AXUIElement, attribute: String) throws -> Bool {
    guard let result: Bool = try value(element, attribute: attribute) else {
      throw PreviewObserverInvalidation.accessibility("missing boolean attribute")
    }
    return result
  }

  private func elements(_ element: AXUIElement, attribute: String) throws -> [AXUIElement] {
    (try value(element, attribute: attribute) as [AXUIElement]?) ?? []
  }

  private func value<T>(_ element: AXUIElement, attribute: String) throws -> T? {
    var raw: CFTypeRef?
    let error = AXUIElementCopyAttributeValue(element, attribute as CFString, &raw)
    if error == .noValue || error == .attributeUnsupported { return nil }
    guard error == .success else {
      throw PreviewObserverInvalidation.accessibility("Accessibility attribute read failed")
    }
    return raw as? T
  }

  private func set(_ element: AXUIElement, attribute: String, value: CFTypeRef) throws {
    guard AXUIElementSetAttributeValue(element, attribute as CFString, value) == .success else {
      throw PreviewObserverInvalidation.accessibility("Accessibility attribute write failed")
    }
  }
}
