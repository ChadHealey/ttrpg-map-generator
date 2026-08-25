import Foundation

struct Issue121TestFailure: Error, CustomStringConvertible {
  let description: String
}

struct Issue121TestRunner {
  private(set) var count = 0

  mutating func test(_ name: String, _ body: () throws -> Void) throws {
    do {
      try body()
      count += 1
    } catch {
      throw Issue121TestFailure(description: "\(name): \(error)")
    }
  }
}

func issue121Expect(
  _ condition: @autoclosure () throws -> Bool,
  _ message: String
) throws {
  guard try condition() else { throw Issue121TestFailure(description: message) }
}

func issue121ExpectFailure(
  _ expected: Issue121Failure,
  _ body: () throws -> Void
) throws {
  do {
    try body()
    throw Issue121TestFailure(description: "expected \(expected)")
  } catch let actual as Issue121Failure {
    try issue121Expect(actual == expected, "expected \(expected), received \(actual)")
  }
}

let issue121TestSession = [UInt8](repeating: 0x51, count: 16)
let issue121TestCapability = [UInt8](repeating: 0xa7, count: 32)

func issue121Frame(
  _ kind: Issue121FrameKind,
  sequence: UInt64 = 0,
  body: [UInt8] = [],
  session: [UInt8] = issue121TestSession
) -> Issue121Frame {
  Issue121Frame(kind: kind, session: session, sequence: sequence, body: body)
}

func issue121CompleteBody(status: UInt16, receipt: [UInt8]) -> [UInt8] {
  var body = [UInt8]()
  Issue121Codec.append(status, to: &body)
  Issue121Codec.append(UInt32(receipt.count), to: &body)
  body.append(contentsOf: receipt)
  return body
}

func issue121ReadySession(
  privateValues: [String] = []
) throws -> Issue121ControllerSession {
  var session = try Issue121ControllerSession(
    session: issue121TestSession,
    capability: issue121TestCapability,
    privateValues: privateValues
  )
  try session.receiveReady(issue121Frame(.ready))
  return session
}

func issue121AwaitingCompletion(
  privateValues: [String] = []
) throws -> Issue121ControllerSession {
  var session = try issue121ReadySession(privateValues: privateValues)
  _ = try session.command(.coarsePreview)
  try session.receiveStarted(issue121Frame(.started, sequence: 1))
  return session
}
