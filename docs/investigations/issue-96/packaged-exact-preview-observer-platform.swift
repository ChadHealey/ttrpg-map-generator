import ApplicationServices
import Foundation

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

  func exactFixturePreviewReceipt(
    expectedDefinition: GatedAtlasFixtureDefinition
  ) throws -> ExactFixturePreviewAccessibilityReceipt {
    let preview = try finalReceipt()
    _ = try packagedFixtureReceipt(
      expectedDefinition: expectedDefinition,
      expectedPhase: .preview
    )
    return ExactFixturePreviewAccessibilityReceipt(
      previewLabel: preview.previewLabel,
      disposableCaption: preview.disposableCaption,
      acceptFullEnabled: preview.acceptFullEnabled,
      fixtureReceiptMatched: true,
      frontmost: preview.frontmost
    )
  }
}
