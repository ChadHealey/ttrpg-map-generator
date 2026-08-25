import Darwin
import Foundation

@main
enum Issue121ObserverClientMain {
  static func main() {
    let privateNames = [
      "ISSUE121_INTEROP_SOCKET_PATH",
      "ISSUE121_INTEROP_SESSION",
      "ISSUE121_INTEROP_CAPABILITY",
      "ISSUE121_INTEROP_CANDIDATE_PID",
      "ISSUE121_INTEROP_CANDIDATE_EXECUTABLE",
      "ISSUE121_INTEROP_CANDIDATE_BUNDLE",
      "ISSUE121_INTEROP_CANDIDATE_BUNDLE_ID",
      "ISSUE121_INTEROP_CANDIDATE_SHA256",
    ]
    var environment = [String: String]()
    for name in privateNames {
      if let value = getenv(name) { environment[name] = String(cString: value) }
      unsetenv(name)
    }
    do {
      guard CommandLine.arguments == [CommandLine.arguments[0], "interop-client"] else {
        throw Issue121Failure.usage
      }
      try emit(Issue121InteropClient.run(environment: environment))
    } catch let failure as Issue121Failure {
      try? emit(Issue121PublicResult.invalid(failure))
      exit(2)
    } catch {
      try? emit(Issue121PublicResult.invalid(.lifecycle))
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
