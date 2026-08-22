import Foundation

struct RSSMeasurement {
  let baselineAggregateRSSBytes: UInt64
  let peakAdditionalRSSBytes: UInt64
  let sampleCount: Int
  let maximumSampleIntervalMilliseconds: Double
}

enum RSSReceiptValidator {
  private static let maximumAllowedIntervalMilliseconds = 20.0
  private static let summaryExpression = try! NSRegularExpression(
    pattern: #"^samples=([0-9]+) max_interval_ms=([0-9]+(?:\.[0-9]+)?)$"#
  )

  static func measurement(
    csv: String,
    summary: String,
    expectedRoleCount: Int,
    dispatchEpochMilliseconds: Double,
    completionEpochMilliseconds: Double
  ) throws -> RSSMeasurement {
    guard expectedRoleCount > 0,
      dispatchEpochMilliseconds.isFinite,
      completionEpochMilliseconds.isFinite,
      dispatchEpochMilliseconds < completionEpochMilliseconds
    else {
      throw invalid("RSS measurement boundaries were invalid")
    }

    let lines = csv.split(whereSeparator: \.isNewline).map(String.init)
    guard let header = lines.first else {
      throw invalid("RSS sampler emitted no CSV receipt")
    }
    try validateHeader(header, expectedRoleCount: expectedRoleCount)
    let samples = try lines.dropFirst().map {
      try parseSample($0, expectedRoleCount: expectedRoleCount)
    }
    guard !samples.isEmpty else {
      throw invalid("RSS sampler emitted no samples")
    }

    for pair in zip(samples, samples.dropFirst()) {
      guard pair.1.epochMilliseconds > pair.0.epochMilliseconds else {
        throw invalid("RSS sample timestamps were not strictly increasing")
      }
      guard
        pair.1.epochMilliseconds - pair.0.epochMilliseconds
          <= maximumAllowedIntervalMilliseconds
      else {
        throw invalid("RSS sampling cadence exceeded 20 milliseconds")
      }
    }

    let reported = try parseSummary(summary)
    guard reported.sampleCount == samples.count else {
      throw invalid("RSS sample count did not match the sampler summary")
    }
    guard reported.maximumIntervalMilliseconds <= maximumAllowedIntervalMilliseconds else {
      throw invalid("RSS sampling cadence exceeded 20 milliseconds")
    }

    guard
      let baseline = samples.last(where: {
        $0.epochMilliseconds <= dispatchEpochMilliseconds
      }),
      dispatchEpochMilliseconds - baseline.epochMilliseconds
        <= maximumAllowedIntervalMilliseconds
    else {
      throw invalid("RSS sampler did not cover the dispatch boundary")
    }
    guard
      let endpoint = samples.first(where: {
        $0.epochMilliseconds >= completionEpochMilliseconds
      }),
      endpoint.epochMilliseconds - completionEpochMilliseconds
        <= maximumAllowedIntervalMilliseconds
    else {
      throw invalid("RSS sampler did not cover the completion boundary")
    }

    let operationSamples = samples.filter {
      $0.epochMilliseconds >= dispatchEpochMilliseconds
        && $0.epochMilliseconds <= endpoint.epochMilliseconds
    }
    guard let peak = operationSamples.map(\.aggregateRSSBytes).max(),
      !operationSamples.isEmpty
    else {
      throw invalid("RSS sampler emitted no operation samples")
    }
    let observedMaximumInterval =
      zip(samples, samples.dropFirst()).map {
        $0.1.epochMilliseconds - $0.0.epochMilliseconds
      }.max() ?? 0
    return RSSMeasurement(
      baselineAggregateRSSBytes: baseline.aggregateRSSBytes,
      peakAdditionalRSSBytes: peak > baseline.aggregateRSSBytes
        ? peak - baseline.aggregateRSSBytes : 0,
      sampleCount: operationSamples.count,
      maximumSampleIntervalMilliseconds: max(
        reported.maximumIntervalMilliseconds,
        observedMaximumInterval
      )
    )
  }

  private static func validateHeader(_ header: String, expectedRoleCount: Int) throws {
    let columns = header.split(separator: ",", omittingEmptySubsequences: false).map(String.init)
    guard columns.count == expectedRoleCount + 2,
      columns[0] == "epoch_ms",
      columns[1] == "aggregate_rss_bytes"
    else {
      throw invalid("RSS CSV header did not match the resolved role set")
    }
    let pidColumns = Array(columns.dropFirst(2))
    let pids = pidColumns.compactMap { column -> Int32? in
      guard column.hasPrefix("pid_") else { return nil }
      return Int32(column.dropFirst(4))
    }
    guard pids.count == expectedRoleCount,
      pids.allSatisfy({ $0 > 0 }),
      Set(pids).count == expectedRoleCount
    else {
      throw invalid("RSS CSV header contained an invalid PID set")
    }
  }

  private static func parseSample(_ line: String, expectedRoleCount: Int) throws -> RSSSample {
    let columns = line.split(separator: ",", omittingEmptySubsequences: false)
    guard columns.count == expectedRoleCount + 2,
      let epoch = Double(columns[0]), epoch.isFinite,
      let aggregate = UInt64(columns[1])
    else {
      throw invalid("RSS sampler emitted a malformed sample")
    }
    let perRole = try columns.dropFirst(2).map { column -> UInt64 in
      guard let value = UInt64(column), value > 0 else {
        throw invalid("RSS sampler could not resolve every required process")
      }
      return value
    }
    var computedAggregate: UInt64 = 0
    for value in perRole {
      let addition = computedAggregate.addingReportingOverflow(value)
      guard !addition.overflow else {
        throw invalid("RSS sample aggregate overflowed")
      }
      computedAggregate = addition.partialValue
    }
    guard computedAggregate == aggregate else {
      throw invalid("RSS sample aggregate did not match its required processes")
    }
    return RSSSample(epochMilliseconds: epoch, aggregateRSSBytes: aggregate)
  }

  private static func parseSummary(_ summary: String) throws -> RSSSummary {
    let sanitized = summary.trimmingCharacters(in: .whitespacesAndNewlines)
    let range = NSRange(sanitized.startIndex..., in: sanitized)
    guard let match = summaryExpression.firstMatch(in: sanitized, range: range),
      match.range == range,
      let countRange = Range(match.range(at: 1), in: sanitized),
      let intervalRange = Range(match.range(at: 2), in: sanitized),
      let sampleCount = Int(sanitized[countRange]),
      let maximumInterval = Double(sanitized[intervalRange]),
      maximumInterval.isFinite
    else {
      throw invalid("RSS sampler summary was unavailable or malformed")
    }
    return RSSSummary(
      sampleCount: sampleCount,
      maximumIntervalMilliseconds: maximumInterval
    )
  }

  private static func invalid(_ reason: String) -> PreviewObserverInvalidation {
    .sampler(reason)
  }
}

private struct RSSSample {
  let epochMilliseconds: Double
  let aggregateRSSBytes: UInt64
}

private struct RSSSummary {
  let sampleCount: Int
  let maximumIntervalMilliseconds: Double
}
