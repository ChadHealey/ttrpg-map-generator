import Foundation

@main
enum Issue121ObserverClientTests {
  @MainActor
  static func main() throws {
    if CommandLine.arguments == [CommandLine.arguments[0], "closed-peer-write-child"] {
      issue121RunClosedPeerWriteChild()
    }
    var runner = Issue121TestRunner()
    try issue121RunCodecLifecycleTests(&runner)
    try issue121RunSecurityPlatformTests(&runner)
    try runner.test("closed peer write survives SIGPIPE and returns typed disconnect") {
      let process = Process()
      process.executableURL = URL(fileURLWithPath: CommandLine.arguments[0])
      process.arguments = ["closed-peer-write-child"]
      let output = Pipe()
      process.standardOutput = output
      process.standardError = Pipe()
      try process.run()
      process.waitUntilExit()
      let rendered = String(
        decoding: output.fileHandleForReading.readDataToEndOfFile(),
        as: UTF8.self
      )
      try issue121Expect(process.terminationReason == .exit, "child exited normally")
      try issue121Expect(process.terminationStatus == 0, "child returned success")
      try issue121Expect(rendered == "observer-client.disconnect\n", "typed disconnect")
    }
    print("issue121 Swift focused tests: \(runner.count) passed")
  }
}
