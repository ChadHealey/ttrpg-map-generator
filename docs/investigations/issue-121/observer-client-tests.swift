@main
enum Issue121ObserverClientTests {
  @MainActor
  static func main() throws {
    var runner = Issue121TestRunner()
    try issue121RunCodecLifecycleTests(&runner)
    try issue121RunSecurityPlatformTests(&runner)
    print("issue121 Swift focused tests: \(runner.count) passed")
  }
}
