import Darwin
import Foundation

@main
enum Issue122QualificationMain {
  @MainActor
  static func main() async {
    do {
      guard CommandLine.arguments.count == 4 else { throw Issue121Failure.usage }
      let candidate = try Issue121CandidateIdentity.prepare(
        applicationPath: CommandLine.arguments[1],
        bundleIdentifier: CommandLine.arguments[2],
        expectedExecutableSHA256: CommandLine.arguments[3]
      )
      try emit(try await Issue122QualificationWrapper(candidate: candidate).qualify())
    } catch let failure as Issue121Failure {
      try? emit(.invalid(failure))
      exit(2)
    } catch {
      try? emit(.invalid(.lifecycle))
      exit(2)
    }
  }

  private static func emit(_ result: Issue121PublicResult) throws {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    FileHandle.standardOutput.write(try encoder.encode(result))
    FileHandle.standardOutput.write(Data([0x0a]))
  }
}
