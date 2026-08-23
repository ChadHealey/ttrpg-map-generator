import Darwin
import Foundation

enum PackagedPreviewRetentionCommandRunner {
  static func run(
    arguments: [String],
    receiptSink: (SanitizedRetentionReceipt) throws -> Void
  ) -> Int32 {
    let suppliedArtifactIdentifier = arguments.count == 4 ? arguments[3] : nil
    let artifactIdentifier = OpaqueArtifactIdentifier.sanitized(suppliedArtifactIdentifier)

    guard arguments.count == 4 else {
      try? receiptSink(
        .incomplete(artifactIdentifier: artifactIdentifier, category: .invalidArguments)
      )
      return EXIT_FAILURE
    }

    do {
      let result = try PackagedPreviewRetention.retain(
        repositoryRoot: arguments[0],
        sourcePath: arguments[1],
        archiveRoot: arguments[2],
        artifactIdentifier: arguments[3],
        receiptSink: receiptSink
      )
      return result.sourceRemoved ? EXIT_SUCCESS : 2
    } catch let failure as RetentionFailure {
      if !failure.receiptAlreadyHandled {
        try? receiptSink(
          .incomplete(artifactIdentifier: artifactIdentifier, category: failure.category)
        )
      }
      return EXIT_FAILURE
    } catch {
      try? receiptSink(
        .incomplete(artifactIdentifier: artifactIdentifier, category: .ioFailure)
      )
      return EXIT_FAILURE
    }
  }
}
