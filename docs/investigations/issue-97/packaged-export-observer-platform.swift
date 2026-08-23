import ApplicationServices
import CryptoKit
import Darwin
import Foundation

extension AccessibilityObserver {
  func issue97PrepareFrontmost() throws {
    guard AXIsProcessTrusted() else {
      throw PreviewObserverInvalidation.accessibility("Accessibility permission was not granted")
    }
    guard AXUIElementSetAttributeValue(
      application,
      kAXFrontmostAttribute as CFString,
      kCFBooleanTrue
    ) == .success else {
      throw PreviewObserverInvalidation.accessibility(
        "the packaged candidate could not acquire the approved unmeasured foreground precondition")
    }
    for _ in 0..<200 {
      if (try? boolean(application, attribute: kAXFrontmostAttribute)) == true { return }
      Thread.sleep(forTimeInterval: 0.01)
    }
    throw PreviewObserverInvalidation.candidateNotFrontmost
  }

  func issue97PressEnabledButton(_ title: String) throws {
    let buttons = try issue97Snapshot().filter {
      (try? issue97String($0, attribute: kAXRoleAttribute)) == kAXButtonRole as String
        && (try? label(of: $0)) == title
    }
    guard buttons.count == 1, let button = buttons.first,
      try boolean(button, attribute: kAXEnabledAttribute),
      AXUIElementPerformAction(button, kAXPressAction as CFString) == .success
    else {
      throw PreviewObserverInvalidation.accessibility(
        "the required production action was missing, disabled, or could not be pressed")
    }
  }

  func issue97ButtonEnabled(_ title: String) throws -> Bool {
    let buttons = try issue97Snapshot().filter {
      (try? issue97String($0, attribute: kAXRoleAttribute)) == kAXButtonRole as String
        && (try? label(of: $0)) == title
    }
    guard buttons.count == 1, let button = buttons.first else { return false }
    return try boolean(button, attribute: kAXEnabledAttribute)
  }

  func issue97SetSaveTarget(_ targetPath: String) throws {
    let fields = try issue97Snapshot().filter {
      guard (try? issue97String($0, attribute: kAXRoleAttribute)) == kAXTextFieldRole as String
      else { return false }
      let label = (try? self.label(of: $0)) ?? ""
      let identifier = (try? issue97String($0, attribute: kAXIdentifierAttribute)) ?? ""
      return label.contains("Save target") || identifier == "mapworld-target"
    }
    guard fields.count == 1, let field = fields.first,
      AXUIElementSetAttributeValue(field, kAXValueAttribute as CFString, targetPath as CFString)
        == .success
    else {
      throw PreviewObserverInvalidation.accessibility(
        "the production save-target field could not be set exactly")
    }
    let readback = try issue97String(field, attribute: kAXValueAttribute)
    guard readback == targetPath else {
      throw PreviewObserverInvalidation.accessibility(
        "the production save-target field did not read back exactly")
    }
  }

  func issue97FixtureReceipt(
    expectedDefinition: GatedAtlasFixtureDefinition,
    expectedPhase: PackagedAtlasObserverPhase
  ) throws -> PackagedAtlasFixtureReceipt {
    let marker = #""version":"packaged-atlas-observer-fixture-v1""#
    let values = try issue97StaticTextValues(marker: marker)
    guard values.count == 1, let value = values.first else {
      throw PreviewObserverInvalidation.fixture(
        "expected exactly one exact-fixture packaged receipt")
    }
    return try PackagedAtlasFixtureReceiptParser.parse(
      value,
      expectedDefinition: expectedDefinition,
      expectedPhase: expectedPhase
    )
  }

  func issue97ExportReceiptText() throws -> String {
    let marker = #""version":"packaged-export-observer-v1""#
    let values = try issue97StaticTextValues(marker: marker)
    guard values.count == 1, let value = values.first else {
      throw ExportObserverInvalidation.state(
        "expected exactly one packaged export observer receipt")
    }
    return value
  }

  func issue97Frontmost() throws -> Bool {
    try boolean(application, attribute: kAXFrontmostAttribute)
  }

  private func issue97StaticTextValues(marker: String) throws -> [String] {
    try issue97Snapshot().compactMap { element -> String? in
      guard (try? issue97String(element, attribute: kAXRoleAttribute)) == kAXStaticTextRole as String,
        let value = try? issue97String(element, attribute: kAXValueAttribute),
        value.contains(marker)
      else { return nil }
      return value
    }
  }

  private func issue97Snapshot() throws -> [AXUIElement] {
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
      pending.append(contentsOf: try issue97Elements(current, attribute: kAXChildrenAttribute))
    }
    return result
  }

  private func issue97Elements(_ element: AXUIElement, attribute: String) throws -> [AXUIElement] {
    (try issue97Value(element, attribute: attribute) as [AXUIElement]?) ?? []
  }

  private func issue97String(_ element: AXUIElement, attribute: String) throws -> String {
    guard let result: String = try issue97Value(element, attribute: attribute) else {
      throw PreviewObserverInvalidation.accessibility("missing Accessibility string attribute")
    }
    return result
  }

  private func issue97Value<T>(_ element: AXUIElement, attribute: String) throws -> T? {
    var raw: CFTypeRef?
    let error = AXUIElementCopyAttributeValue(element, attribute as CFString, &raw)
    if error == .noValue || error == .attributeUnsupported { return nil }
    guard error == .success else {
      throw PreviewObserverInvalidation.accessibility("Accessibility attribute read failed")
    }
    return raw as? T
  }
}

enum Issue97Destination {
  static let staleBytes = Data("issue97-stale-export-destination\n".utf8)

  static func createPrivateWorkRoot(_ path: String) throws {
    let url = URL(fileURLWithPath: path)
    guard url.path == path, url.deletingLastPathComponent().path == "/private/tmp",
      url.lastPathComponent.hasPrefix("issue97-")
    else {
      throw ExportObserverInvalidation.destination(
        "the private observation root was not a direct issue97 child of the approved temporary parent")
    }
    var isDirectory: ObjCBool = false
    guard !FileManager.default.fileExists(atPath: path, isDirectory: &isDirectory) else {
      throw ExportObserverInvalidation.destination(
        "the private observation root already existed")
    }
    do {
      try FileManager.default.createDirectory(
        atPath: path,
        withIntermediateDirectories: false,
        attributes: [.posixPermissions: 0o700]
      )
    } catch {
      throw ExportObserverInvalidation.destination(
        "the private observation root could not be created")
    }
  }

  static func seedStaleDestination(_ path: String) throws -> DestinationFileIdentity {
    guard !FileManager.default.fileExists(atPath: path),
      FileManager.default.createFile(
        atPath: path,
        contents: staleBytes,
        attributes: [.posixPermissions: 0o600]
      )
    else {
      throw ExportObserverInvalidation.destination(
        "the stale destination could not be created as a fresh regular file")
    }
    return try identity(path)
  }

  static func identity(_ path: String) throws -> DestinationFileIdentity {
    var status = stat()
    guard lstat(path, &status) == 0, (status.st_mode & S_IFMT) == S_IFREG else {
      throw ExportObserverInvalidation.destination(
        "the export destination was missing or was not a direct regular file")
    }
    let data: Data
    do { data = try Data(contentsOf: URL(fileURLWithPath: path), options: [.mappedIfSafe]) } catch {
      throw ExportObserverInvalidation.destination(
        "the export destination could not be read completely")
    }
    guard UInt64(data.count) == UInt64(status.st_size) else {
      throw ExportObserverInvalidation.destination(
        "the export destination size changed during readback")
    }
    return DestinationFileIdentity(
      device: UInt64(status.st_dev),
      inode: UInt64(status.st_ino),
      byteLength: UInt64(data.count),
      sha256: sha256(data)
    )
  }

  static func temporaryPath(destinationPath: String, format: PackagedExportFormat) -> String {
    let url = URL(fileURLWithPath: destinationPath)
    let name = ".\(url.lastPathComponent).atlas-\(format.rawValue)-v1.temporary"
    return url.deletingLastPathComponent().appendingPathComponent(name).path
  }

  static func formatValid(path: String, format: PackagedExportFormat) throws -> Bool {
    let data = try Data(contentsOf: URL(fileURLWithPath: path), options: [.mappedIfSafe])
    switch format {
    case .svg:
      guard let text = String(data: data, encoding: .utf8) else { return false }
      return text.hasPrefix(
        #"<svg xmlns="http://www.w3.org/2000/svg" width="400mm" height="200mm" viewBox="0 0 2048 1024""#
      ) && text.contains(#"data-export-profile="atlas-svg-v1" data-export-version="1""#)
    case .png:
      guard data.count >= 33 else { return false }
      let bytes = [UInt8](data.prefix(33))
      let signature: [UInt8] = [137, 80, 78, 71, 13, 10, 26, 10]
      return Array(bytes[0..<8]) == signature
        && String(bytes: bytes[12..<16], encoding: .ascii) == "IHDR"
        && uint32(bytes, at: 16) == 8192
        && uint32(bytes, at: 20) == 4096
        && bytes[24] == 8
        && bytes[25] == 2
    }
  }

  private static func uint32(_ bytes: [UInt8], at offset: Int) -> UInt32 {
    (UInt32(bytes[offset]) << 24) | (UInt32(bytes[offset + 1]) << 16)
      | (UInt32(bytes[offset + 2]) << 8) | UInt32(bytes[offset + 3])
  }

  private static func sha256(_ data: Data) -> String {
    SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
  }
}
