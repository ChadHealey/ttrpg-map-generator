import Foundation

@main
enum PackagedPreviewObserverCoreTests {
  static func main() throws {
    try parsesAndResolvesAcceptedMembership()
    try rejectsMissingDuplicateUnexpectedAndMismatchedMembership()
    try rejectsReplacementAtCompletion()
    try rejectsExitedRoles()
    try validatesCompleteRSSCoverageAndRejectsCorruptReceipts()
    try validatesFileAndExecutableIdentityBoundaries()
    checksFramePredicate()
    print("packaged-preview-observer-core-tests: passed")
  }

  private static func parsesAndResolvesAcceptedMembership() throws {
    let app = try LaunchctlReceiptParser.parse(appReceipt(), expectedPID: 100)
    let roles = try PreviewProcessResolver.serviceRoles(from: app)
    expect(roles[.gpu] == 101, "GPU PID")
    expect(roles[.networking] == 102, "Networking PID")
    expect(roles[.webContent] == 103, "WebContent PID")
    let resolved = try PreviewProcessResolver.validate(
      appReceipt: app,
      helperReceipts: helperReceipts(),
      executableNames: expectedExecutableNames()
    )
    expect(resolved.orderedPIDs == [100, 101, 102, 103], "ordered sampler PID set")
  }

  private static func rejectsMissingDuplicateUnexpectedAndMismatchedMembership() throws {
    try expectInvalid("missing role") {
      _ = try PreviewProcessResolver.serviceRoles(
        from: LaunchctlReceiptParser.parse(
          appReceipt().replacingOccurrences(of: serviceLine(.webContent, pid: 103), with: ""),
          expectedPID: 100
        )
      )
    }
    try expectInvalid("duplicate role") {
      _ = try PreviewProcessResolver.serviceRoles(
        from: LaunchctlReceiptParser.parse(
          appReceipt().replacingOccurrences(
            of: "\t}\n\n\tresource coalition",
            with:
              "\t   104      - \tcom.apple.WebKit.GPU.BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB\n\t}\n\n\tresource coalition"
          ),
          expectedPID: 100
        )
      )
    }
    try expectInvalid("unexpected live service") {
      _ = try PreviewProcessResolver.serviceRoles(
        from: LaunchctlReceiptParser.parse(
          appReceipt().replacingOccurrences(
            of: "\t}\n\n\tresource coalition",
            with:
              "\t   104      - \tcom.apple.WebKit.Model.AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA\n\t}\n\n\tresource coalition"
          ),
          expectedPID: 100
        )
      )
    }
    var helpers = try helperReceipts()
    helpers[.gpu] = try LaunchctlReceiptParser.parse(
      pidReceipt(pid: 101, coalitionID: 999),
      expectedPID: 101
    )
    try expectInvalid("coalition mismatch") {
      _ = try PreviewProcessResolver.validate(
        appReceipt: LaunchctlReceiptParser.parse(appReceipt(), expectedPID: 100),
        helperReceipts: helpers,
        executableNames: expectedExecutableNames()
      )
    }
    var names = expectedExecutableNames()
    names[.gpu] = "renamed-helper"
    try expectInvalid("unresolvable role") {
      _ = try PreviewProcessResolver.validate(
        appReceipt: LaunchctlReceiptParser.parse(appReceipt(), expectedPID: 100),
        helperReceipts: try helperReceipts(),
        executableNames: names
      )
    }
  }

  private static func rejectsReplacementAtCompletion() throws {
    let baseline = try resolved()
    let replacement = ResolvedPreviewProcesses(
      coalition: baseline.coalition,
      pidsByRole: baseline.pidsByRole.merging([.webContent: 104]) { _, replacement in replacement }
    )
    try expectInvalid("replaced or late role") {
      try PreviewProcessResolver.revalidate(baseline: baseline, completion: replacement)
    }
  }

  private static func rejectsExitedRoles() throws {
    let processes = try resolved()
    try expectInvalid("exited role") {
      try PreviewProcessResolver.requireLiveRoles(processes.pidsByRole) { $0 != 102 }
    }
  }

  private static func validatesCompleteRSSCoverageAndRejectsCorruptReceipts() throws {
    let validCSV = rssCSV([
      (990, [100, 100, 100, 100]),
      (1_000, [110, 110, 110, 110]),
      (1_005, [120, 120, 120, 120]),
      (1_010, [130, 130, 130, 130]),
      (1_015, [140, 140, 140, 140]),
    ])
    let measurement = try RSSReceiptValidator.measurement(
      csv: validCSV,
      summary: "samples=5 max_interval_ms=10.000\n",
      expectedRoleCount: 4,
      dispatchEpochMilliseconds: 1_001,
      completionEpochMilliseconds: 1_012
    )
    expect(measurement.baselineAggregateRSSBytes == 440, "fresh dispatch baseline")
    expect(measurement.peakAdditionalRSSBytes == 120, "peak through endpoint")
    expect(measurement.sampleCount == 3, "operation sample count includes endpoint coverage")
    expect(measurement.maximumSampleIntervalMilliseconds == 10, "observed cadence")

    try expectInvalid("unresolved process sample") {
      _ = try RSSReceiptValidator.measurement(
        csv: validCSV.replacingOccurrences(of: "480,120,120,120,120", with: "360,120,120,120,0"),
        summary: "samples=5 max_interval_ms=10.000",
        expectedRoleCount: 4,
        dispatchEpochMilliseconds: 1_001,
        completionEpochMilliseconds: 1_012
      )
    }
    try expectInvalid("aggregate mismatch") {
      _ = try RSSReceiptValidator.measurement(
        csv: validCSV.replacingOccurrences(of: "480,120,120,120,120", with: "481,120,120,120,120"),
        summary: "samples=5 max_interval_ms=10.000",
        expectedRoleCount: 4,
        dispatchEpochMilliseconds: 1_001,
        completionEpochMilliseconds: 1_012
      )
    }
    try expectInvalid("malformed row") {
      _ = try RSSReceiptValidator.measurement(
        csv: validCSV.replacingOccurrences(of: "1010,520,130,130,130,130", with: "1010,520,130"),
        summary: "samples=5 max_interval_ms=10.000",
        expectedRoleCount: 4,
        dispatchEpochMilliseconds: 1_001,
        completionEpochMilliseconds: 1_012
      )
    }
    try expectInvalid("summary count mismatch") {
      _ = try RSSReceiptValidator.measurement(
        csv: validCSV,
        summary: "samples=4 max_interval_ms=10.000",
        expectedRoleCount: 4,
        dispatchEpochMilliseconds: 1_001,
        completionEpochMilliseconds: 1_012
      )
    }
    try expectInvalid("missing completion coverage") {
      _ = try RSSReceiptValidator.measurement(
        csv: rssCSV([
          (990, [100, 100, 100, 100]),
          (1_000, [110, 110, 110, 110]),
          (1_005, [120, 120, 120, 120]),
          (1_010, [130, 130, 130, 130]),
        ]),
        summary: "samples=4 max_interval_ms=10.000",
        expectedRoleCount: 4,
        dispatchEpochMilliseconds: 1_001,
        completionEpochMilliseconds: 1_012
      )
    }
    try expectInvalid("cadence gap") {
      _ = try RSSReceiptValidator.measurement(
        csv: rssCSV([
          (990, [100, 100, 100, 100]),
          (1_000, [110, 110, 110, 110]),
          (1_025, [120, 120, 120, 120]),
        ]),
        summary: "samples=3 max_interval_ms=25.000",
        expectedRoleCount: 4,
        dispatchEpochMilliseconds: 1_001,
        completionEpochMilliseconds: 1_010
      )
    }
  }

  private static func validatesFileAndExecutableIdentityBoundaries() throws {
    let canonicalRawPath = try QualificationFileValidator.canonicalRawSamplesPath(
      "/tmp/issue90-fresh-raw-receipt.csv")
    expect(
      canonicalRawPath == "/tmp/issue90-fresh-raw-receipt.csv",
      "canonical direct temporary child"
    )
    try expectInvalid("raw path traversal") {
      _ = try QualificationFileValidator.canonicalRawSamplesPath(
        "/private/tmp/../etc/issue90-escaped.csv")
    }
    try expectInvalid("nested raw path") {
      _ = try QualificationFileValidator.canonicalRawSamplesPath(
        "/private/tmp/nested/issue90.csv")
    }
    expect(
      ExecutableIdentityValidator.isDigest(String(repeating: "a", count: 64)),
      "lowercase SHA-256 input"
    )
    expect(
      !ExecutableIdentityValidator.isDigest(String(repeating: "A", count: 64)),
      "noncanonical SHA-256 input rejection"
    )
    let emptySHA256 = try ExecutableIdentityValidator.sha256(atPath: "/dev/null")
    expect(
      emptySHA256 == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "streamed executable identity hash")
  }

  private static func checksFramePredicate() {
    let baseline = PixelObservation(hash: 1, landLike: 0, waterLike: 0)
    let candidate = PixelObservation(hash: 2, landLike: 40_000, waterLike: 90_000)
    expect(
      PreviewFramePredicate.qualifies(
        complete: true,
        displayTime: 11,
        dispatchTime: 10,
        baseline: baseline,
        candidate: candidate,
        foregroundIntact: true
      ),
      "complete changed post-dispatch palette frame"
    )
    expect(
      !PreviewFramePredicate.qualifies(
        complete: false,
        displayTime: 11,
        dispatchTime: 10,
        baseline: baseline,
        candidate: candidate,
        foregroundIntact: true
      ),
      "partial frame rejection"
    )
    expect(
      !PreviewFramePredicate.qualifies(
        complete: true,
        displayTime: 9,
        dispatchTime: 10,
        baseline: baseline,
        candidate: candidate,
        foregroundIntact: true
      ),
      "stale frame rejection"
    )
    expect(
      !PreviewFramePredicate.qualifies(
        complete: true,
        displayTime: 11,
        dispatchTime: 10,
        baseline: baseline,
        candidate: candidate,
        foregroundIntact: false
      ),
      "foreground loss rejection"
    )
  }

  private static func resolved() throws -> ResolvedPreviewProcesses {
    try PreviewProcessResolver.validate(
      appReceipt: LaunchctlReceiptParser.parse(appReceipt(), expectedPID: 100),
      helperReceipts: helperReceipts(),
      executableNames: expectedExecutableNames()
    )
  }

  private static func helperReceipts() throws -> [PreviewProcessRole: LaunchctlPIDReceipt] {
    [
      .gpu: try LaunchctlReceiptParser.parse(pidReceipt(pid: 101), expectedPID: 101),
      .networking: try LaunchctlReceiptParser.parse(pidReceipt(pid: 102), expectedPID: 102),
      .webContent: try LaunchctlReceiptParser.parse(pidReceipt(pid: 103), expectedPID: 103),
    ]
  }

  private static func expectedExecutableNames() -> [PreviewProcessRole: String] {
    Dictionary(
      uniqueKeysWithValues: PreviewProcessRole.allCases.map {
        ($0, PreviewProcessResolver.expectedExecutableName(for: $0))
      })
  }

  private static func appReceipt() -> String {
    """
    pid/100 = {
    \thandle = 100

    \tservices = {
    \(serviceLine(.gpu, pid: 101))
    \(serviceLine(.networking, pid: 102))
    \(serviceLine(.webContent, pid: 103))
    \t       0      - \tcom.apple.WebKit.GPU
    \t}

    \tresource coalition = {
    \t\tID = 77
    \t\ttype = resource
    \t\tstate = active
    \t\tname = application.app.ttrpgmap.generator.synthetic
    \t\tbundle ID = app.ttrpgmap.generator
    \t}
    }
    """
  }

  private static func serviceLine(_ role: PreviewProcessRole, pid: Int32) -> String {
    let serviceRole: String
    switch role {
    case .gpu: serviceRole = "GPU"
    case .networking: serviceRole = "Networking"
    case .webContent: serviceRole = "WebContent"
    case .application: fatalError("application is not a WebKit service")
    }
    return
      "\t   \(pid)      - \tcom.apple.WebKit.\(serviceRole).AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA"
  }

  private static func pidReceipt(pid: Int32, coalitionID: UInt64 = 77) -> String {
    """
    pid/\(pid) = {
    \thandle = \(pid)

    \tservices = {
    \t}

    \tresource coalition = {
    \t\tID = \(coalitionID)
    \t\ttype = resource
    \t\tstate = active
    \t\tname = application.app.ttrpgmap.generator.synthetic
    \t\tbundle ID = app.ttrpgmap.generator
    \t}
    }
    """
  }

  private static func rssCSV(_ rows: [(Int, [UInt64])]) -> String {
    let header = "epoch_ms,aggregate_rss_bytes,pid_100,pid_101,pid_102,pid_103"
    let body = rows.map { epoch, values in
      ([String(epoch), String(values.reduce(0, +))] + values.map(String.init)).joined(
        separator: ",")
    }
    return ([header] + body).joined(separator: "\n") + "\n"
  }

  private static func expectInvalid(_ label: String, _ operation: () throws -> Void) throws {
    do {
      try operation()
      fatalError("expected invalidation: \(label)")
    } catch is PreviewObserverInvalidation {}
  }

  private static func expect(_ condition: @autoclosure () -> Bool, _ label: String) {
    guard condition() else { fatalError("failed: \(label)") }
  }
}
