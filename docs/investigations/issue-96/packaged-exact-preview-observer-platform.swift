import ApplicationServices
import Foundation

extension AccessibilityObserver {
  func prepareExactPreviewVisibleCanvas(windowFrame: CGRect) throws -> CGRect {
    guard AXIsProcessTrusted() else {
      throw PreviewObserverInvalidation.accessibility("Accessibility permission was not granted")
    }
    try exactSet(application, attribute: kAXFrontmostAttribute, value: kCFBooleanTrue)
    var images: [AXUIElement] = []
    for _ in 0..<200 {
      images = try boundedAccessibilitySnapshot().filter {
        guard (try? string($0, attribute: kAXRoleAttribute)) == kAXImageRole as String,
          let label = try? label(of: $0)
        else { return false }
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
    let canvasFrame = try exactFrame(of: image)
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

  func packagedFixtureReceipt(
    expectedDefinition: GatedAtlasFixtureDefinition,
    expectedPhase: PackagedAtlasObserverPhase
  ) throws -> PackagedAtlasFixtureReceipt {
    let marker = #""version":"packaged-atlas-observer-fixture-v1""#
    let values = try boundedAccessibilitySnapshot().compactMap { element -> String? in
      guard (try? string(element, attribute: kAXRoleAttribute)) == kAXStaticTextRole as String,
        let value = try? string(element, attribute: kAXValueAttribute),
        value.contains(marker)
      else { return nil }
      return value
    }
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

  func exactFixturePreviewReceipt(
    expectedDefinition: GatedAtlasFixtureDefinition
  ) throws -> ExactFixturePreviewAccessibilityReceipt {
    let elements = try boundedAccessibilitySnapshot()
    let images = elements.filter {
      (try? string($0, attribute: kAXRoleAttribute)) == kAXImageRole as String
        && (try? label(of: $0)) == previewLabel
    }
    let staticText = elements.compactMap { element -> String? in
      guard (try? string(element, attribute: kAXRoleAttribute)) == kAXStaticTextRole as String
      else { return nil }
      return try? string(element, attribute: kAXValueAttribute)
    }
    let captions = staticText.filter { $0 == previewCaption }
    let marker = #""version":"packaged-atlas-observer-fixture-v1""#
    let fixtureValues = staticText.filter { $0.contains(marker) }
    let buttons = elements.filter {
      (try? string($0, attribute: kAXRoleAttribute)) == kAXButtonRole as String
        && (try? label(of: $0)) == acceptFullTitle
    }
    guard images.count == 1, captions.count == 1, buttons.count == 1,
      fixtureValues.count == 1, let button = buttons.first, let fixtureValue = fixtureValues.first,
      try boolean(button, attribute: kAXEnabledAttribute)
    else {
      throw PreviewObserverInvalidation.accessibility(
        "the final exact-fixture preview Accessibility receipt was incomplete or contradictory")
    }
    _ = try PackagedAtlasFixtureReceiptParser.parse(
      fixtureValue,
      expectedDefinition: expectedDefinition,
      expectedPhase: .preview
    )
    return ExactFixturePreviewAccessibilityReceipt(
      previewLabel: true,
      disposableCaption: true,
      acceptFullEnabled: true,
      fixtureReceiptMatched: true,
      frontmost: try boolean(application, attribute: kAXFrontmostAttribute)
    )
  }

  private func boundedAccessibilitySnapshot() throws -> [AXUIElement] {
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
      pending.append(contentsOf: try exactElements(current, attribute: kAXChildrenAttribute))
    }
    return result
  }

  private func exactFrame(of element: AXUIElement) throws -> CGRect {
    guard let positionValue: AXValue = try exactValue(element, attribute: kAXPositionAttribute),
      let sizeValue: AXValue = try exactValue(element, attribute: kAXSizeAttribute)
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

  private func exactElements(_ element: AXUIElement, attribute: String) throws -> [AXUIElement] {
    (try exactValue(element, attribute: attribute) as [AXUIElement]?) ?? []
  }

  private func exactValue<T>(_ element: AXUIElement, attribute: String) throws -> T? {
    var raw: CFTypeRef?
    let error = AXUIElementCopyAttributeValue(element, attribute as CFString, &raw)
    if error == .noValue || error == .attributeUnsupported { return nil }
    guard error == .success else {
      throw PreviewObserverInvalidation.accessibility("Accessibility attribute read failed")
    }
    return raw as? T
  }

  private func exactSet(_ element: AXUIElement, attribute: String, value: CFTypeRef) throws {
    guard AXUIElementSetAttributeValue(element, attribute as CFString, value) == .success else {
      throw PreviewObserverInvalidation.accessibility("Accessibility attribute write failed")
    }
  }
}
