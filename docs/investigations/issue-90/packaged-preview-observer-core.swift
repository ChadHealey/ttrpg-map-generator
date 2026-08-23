import Foundation

enum PreviewProcessRole: String, CaseIterable, Codable, Comparable {
  case application
  case gpu
  case networking
  case webContent

  static func < (left: PreviewProcessRole, right: PreviewProcessRole) -> Bool {
    left.rawValue < right.rawValue
  }
}

struct LaunchctlCoalition: Equatable {
  let id: UInt64
  let name: String
  let bundleIdentifier: String
}

struct LaunchctlPIDReceipt {
  let pid: Int32
  let handle: Int32
  let coalition: LaunchctlCoalition
  let liveServices: [String: Int32]
}

struct ResolvedPreviewProcesses: Equatable {
  let coalition: LaunchctlCoalition
  let pidsByRole: [PreviewProcessRole: Int32]

  var orderedPIDs: [Int32] {
    PreviewProcessRole.allCases.compactMap { pidsByRole[$0] }
  }
}

enum PreviewObserverInvalidation: Error, Equatable, CustomStringConvertible {
  case accessibility(String)
  case candidateNotFrontmost
  case capture(String)
  case dispatch(String)
  case fixture(String)
  case host(String)
  case launchctl(String)
  case membershipChanged
  case processExited(PreviewProcessRole)
  case processRole(String)
  case sampler(String)
  case usage

  var authority: String {
    switch self {
    case .accessibility: "accessibility"
    case .candidateNotFrontmost: "foreground"
    case .capture: "screen-capture"
    case .dispatch: "dispatch"
    case .fixture: "fixture-receipt"
    case .host: "target-host"
    case .launchctl: "launchctl-membership"
    case .membershipChanged: "launchctl-membership"
    case .processExited: "launchctl-membership"
    case .processRole: "process-role"
    case .sampler: "rss-sampler"
    case .usage: "arguments"
    }
  }

  var description: String {
    switch self {
    case .accessibility(let reason): reason
    case .candidateNotFrontmost: "the packaged candidate did not remain frontmost"
    case .capture(let reason): reason
    case .dispatch(let reason): reason
    case .fixture(let reason): reason
    case .host(let reason): reason
    case .launchctl(let reason): reason
    case .membershipChanged: "the required PID-domain/resource-coalition membership changed"
    case .processExited(let role): "the \(role.rawValue) role exited before completion"
    case .processRole(let reason): reason
    case .sampler(let reason): reason
    case .usage: "invalid observer arguments"
    }
  }
}

enum LaunchctlReceiptParser {
  private static let pidHeader = try! NSRegularExpression(
    pattern: #"^pid/([0-9]+)\s*=\s*\{"#,
    options: [.anchorsMatchLines]
  )
  private static let handle = try! NSRegularExpression(
    pattern: #"^\s*handle\s*=\s*([0-9]+)\s*$"#,
    options: [.anchorsMatchLines]
  )
  private static let service = try! NSRegularExpression(
    pattern: #"^\s*([0-9]+)\s+\S+\s+([^\s]+)\s*$"#,
    options: [.anchorsMatchLines]
  )

  static func parse(_ output: String, expectedPID: Int32) throws -> LaunchctlPIDReceipt {
    let parsedPID = try integerMatch(pidHeader, in: output, label: "PID-domain header")
    guard parsedPID == expectedPID else {
      throw PreviewObserverInvalidation.launchctl(
        "PID-domain header did not match the requested PID")
    }
    let parsedHandle = try integerMatch(handle, in: output, label: "PID-domain handle")
    guard parsedHandle == expectedPID else {
      throw PreviewObserverInvalidation.launchctl(
        "PID-domain handle did not match the requested PID")
    }
    let coalitionBlock = try block(named: "resource coalition", in: output)
    let coalition = LaunchctlCoalition(
      id: try unsignedField("ID", in: coalitionBlock),
      name: try textField("name", in: coalitionBlock),
      bundleIdentifier: try textField("bundle ID", in: coalitionBlock)
    )
    guard try textField("type", in: coalitionBlock) == "resource",
      try textField("state", in: coalitionBlock) == "active"
    else {
      throw PreviewObserverInvalidation.launchctl("resource coalition was not active")
    }
    let servicesBlock = try block(named: "services", in: output)
    var services: [String: Int32] = [:]
    for line in servicesBlock.split(separator: "\n", omittingEmptySubsequences: false) {
      let value = String(line)
      guard let match = firstMatch(service, in: value),
        let pid = Int32(capture(1, match: match, source: value)),
        pid > 0
      else { continue }
      let name = capture(2, match: match, source: value)
      guard services.updateValue(pid, forKey: name) == nil else {
        throw PreviewObserverInvalidation.launchctl("duplicate live service name")
      }
    }
    return LaunchctlPIDReceipt(
      pid: parsedPID,
      handle: parsedHandle,
      coalition: coalition,
      liveServices: services
    )
  }

  private static func block(named name: String, in output: String) throws -> String {
    guard let start = output.range(of: "\n\t\(name) = {\n") else {
      throw PreviewObserverInvalidation.launchctl("missing \(name) block")
    }
    let contentStart = start.upperBound
    guard let end = output.range(of: "\n\t}\n", range: contentStart..<output.endIndex) else {
      throw PreviewObserverInvalidation.launchctl("unterminated \(name) block")
    }
    return String(output[contentStart..<end.lowerBound])
  }

  private static func integerMatch(
    _ expression: NSRegularExpression,
    in source: String,
    label: String
  ) throws -> Int32 {
    guard let match = firstMatch(expression, in: source),
      let value = Int32(capture(1, match: match, source: source))
    else {
      throw PreviewObserverInvalidation.launchctl("missing or invalid \(label)")
    }
    return value
  }

  private static func unsignedField(_ name: String, in block: String) throws -> UInt64 {
    let text = try textField(name, in: block)
    guard let value = UInt64(text) else {
      throw PreviewObserverInvalidation.launchctl("invalid \(name) field")
    }
    return value
  }

  private static func textField(_ name: String, in block: String) throws -> String {
    let escaped = NSRegularExpression.escapedPattern(for: name)
    let expression = try! NSRegularExpression(
      pattern: "^\\s*\(escaped)\\s*=\\s*(.+?)\\s*$",
      options: [.anchorsMatchLines]
    )
    guard let match = firstMatch(expression, in: block) else {
      throw PreviewObserverInvalidation.launchctl("missing \(name) field")
    }
    return capture(1, match: match, source: block)
  }

  private static func firstMatch(
    _ expression: NSRegularExpression,
    in source: String
  ) -> NSTextCheckingResult? {
    expression.firstMatch(in: source, range: NSRange(source.startIndex..., in: source))
  }

  private static func capture(
    _ index: Int,
    match: NSTextCheckingResult,
    source: String
  ) -> String {
    guard let range = Range(match.range(at: index), in: source) else { return "" }
    return String(source[range])
  }
}

enum PreviewProcessResolver {
  private static let servicePattern = try! NSRegularExpression(
    pattern:
      #"^com\.apple\.WebKit\.(GPU|Networking|WebContent)\.([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})$"#
  )

  static func serviceRoles(from appReceipt: LaunchctlPIDReceipt) throws -> [PreviewProcessRole:
    Int32]
  {
    var roles: [PreviewProcessRole: Int32] = [.application: appReceipt.pid]
    for (name, pid) in appReceipt.liveServices {
      let range = NSRange(name.startIndex..., in: name)
      guard name.hasPrefix("com.apple.WebKit.") else { continue }
      guard let match = servicePattern.firstMatch(in: name, range: range),
        let roleRange = Range(match.range(at: 1), in: name)
      else {
        throw PreviewObserverInvalidation.launchctl(
          "unexpected live service in application PID domain")
      }
      let role: PreviewProcessRole
      switch name[roleRange] {
      case "GPU": role = .gpu
      case "Networking": role = .networking
      case "WebContent": role = .webContent
      default:
        throw PreviewObserverInvalidation.launchctl("unrecognized WebKit service role")
      }
      guard roles.updateValue(pid, forKey: role) == nil else {
        throw PreviewObserverInvalidation.launchctl("duplicate required WebKit role")
      }
    }
    guard Set(roles.keys) == Set(PreviewProcessRole.allCases) else {
      throw PreviewObserverInvalidation.launchctl("missing required app or WebKit role")
    }
    guard Set(roles.values).count == roles.count else {
      throw PreviewObserverInvalidation.launchctl("one PID was assigned to multiple roles")
    }
    return roles
  }

  static func validate(
    appReceipt: LaunchctlPIDReceipt,
    helperReceipts: [PreviewProcessRole: LaunchctlPIDReceipt],
    executableNames: [PreviewProcessRole: String]
  ) throws -> ResolvedPreviewProcesses {
    let roles = try serviceRoles(from: appReceipt)
    guard appReceipt.coalition.bundleIdentifier.count > 0 else {
      throw PreviewObserverInvalidation.launchctl("application coalition bundle ID was empty")
    }
    for role in PreviewProcessRole.allCases where role != .application {
      guard let pid = roles[role], let receipt = helperReceipts[role] else {
        throw PreviewObserverInvalidation.launchctl("missing helper PID-domain receipt")
      }
      guard receipt.pid == pid, receipt.handle == pid else {
        throw PreviewObserverInvalidation.launchctl("helper PID-domain receipt was replaced")
      }
      guard receipt.coalition == appReceipt.coalition else {
        throw PreviewObserverInvalidation.launchctl(
          "helper resource coalition did not match the app")
      }
    }
    for role in PreviewProcessRole.allCases {
      guard executableNames[role] == expectedExecutableName(for: role) else {
        throw PreviewObserverInvalidation.processRole(
          "unexpected executable for \(role.rawValue) role")
      }
    }
    return ResolvedPreviewProcesses(coalition: appReceipt.coalition, pidsByRole: roles)
  }

  static func revalidate(
    baseline: ResolvedPreviewProcesses,
    completion: ResolvedPreviewProcesses
  ) throws {
    guard baseline == completion else {
      throw PreviewObserverInvalidation.membershipChanged
    }
  }

  static func requireLiveRoles(
    _ pidsByRole: [PreviewProcessRole: Int32],
    isLive: (Int32) -> Bool
  ) throws {
    for role in PreviewProcessRole.allCases {
      guard let pid = pidsByRole[role], isLive(pid) else {
        throw PreviewObserverInvalidation.processExited(role)
      }
    }
  }

  static func expectedExecutableName(for role: PreviewProcessRole) -> String {
    switch role {
    case .application: "ttrpg-map-desktop"
    case .gpu: "com.apple.WebKit.GPU"
    case .networking: "com.apple.WebKit.Networking"
    case .webContent: "com.apple.WebKit.WebContent"
    }
  }
}

struct PixelObservation: Equatable {
  let hash: UInt64
  let landLike: Int
  let waterLike: Int
}

enum PreviewFramePredicate {
  static let minimumPalettePopulation = 100
  static let maximumPalettePopulation = (512 * 256) - minimumPalettePopulation

  static func qualifies(
    complete: Bool,
    displayTime: UInt64,
    dispatchTime: UInt64,
    baseline: PixelObservation,
    candidate: PixelObservation,
    foregroundIntact: Bool
  ) -> Bool {
    complete && displayTime > dispatchTime && candidate.hash != baseline.hash && foregroundIntact
      && bounded(candidate.landLike) && bounded(candidate.waterLike)
  }

  private static func bounded(_ population: Int) -> Bool {
    population >= minimumPalettePopulation && population <= maximumPalettePopulation
  }
}
