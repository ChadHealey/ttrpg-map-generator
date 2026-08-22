import AppKit
import CoreFoundation
import CoreGraphics
import Foundation
import ScreenCaptureKit

/// Feasibility-only screenshot probe for issue 88. Its output is not release evidence.
@main
struct ScreenshotFeasibilityProbe {
  static func main() async throws {
    _ = NSApplication.shared
    guard CommandLine.arguments.count == 2 else {
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

    let filter = SCContentFilter(desktopIndependentWindow: window)
    let configuration = SCStreamConfiguration()
    configuration.width = Int(window.frame.width.rounded(.up))
    configuration.height = Int(window.frame.height.rounded(.up))
    configuration.showsCursor = false

    let image = try await SCScreenshotManager.captureImage(
      contentFilter: filter,
      configuration: configuration
    )
    guard let providerData = image.dataProvider?.data else {
      throw ProbeError.missingImageData
    }

    let byteCount = CFDataGetLength(providerData)
    guard let bytes = CFDataGetBytePtr(providerData) else {
      throw ProbeError.missingImageData
    }
    var hash: UInt64 = 14_695_981_039_346_656_037
    var landLikePixelCount = 0
    var waterLikePixelCount = 0
    for offset in 0..<byteCount {
      hash ^= UInt64(bytes[offset])
      hash &*= 1_099_511_628_211
    }
    if image.bitsPerPixel == 32 {
      for offset in stride(from: 0, to: byteCount - 3, by: 4) {
        let blue = Int(bytes[offset])
        let green = Int(bytes[offset + 1])
        let red = Int(bytes[offset + 2])
        if near(red, 220) && near(green, 207) && near(blue, 171) {
          landLikePixelCount += 1
        }
        if near(red, 180) && near(green, 202) && near(blue, 199) {
          waterLikePixelCount += 1
        }
      }
    }

    print(
      "windowId=\(window.windowID) ownerPid=\(window.owningApplication?.processID ?? -1) "
        + "onScreen=\(window.isOnScreen) active=\(window.isActive) layer=\(window.windowLayer) "
        + "framePoints=\(Int(window.frame.width))x\(Int(window.frame.height)) "
        + "imagePixels=\(image.width)x\(image.height) bitsPerPixel=\(image.bitsPerPixel) "
        + "fnv1a64=\(String(hash, radix: 16)) landLike=\(landLikePixelCount) "
        + "waterLike=\(waterLikePixelCount)"
    )
  }

  private static func near(_ observed: Int, _ expected: Int) -> Bool {
    abs(observed - expected) <= 8
  }
}

enum ProbeError: LocalizedError {
  case missingImageData
  case usage
  case windowCount(Int)

  var errorDescription: String? {
    switch self {
      case .missingImageData:
        return "ScreenCaptureKit returned no image data"
      case .usage:
        return "usage: screenshot-feasibility bundle-identifier"
      case let .windowCount(count):
        return "expected exactly one on-screen layer-zero window, found \(count)"
    }
  }
}
