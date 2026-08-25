import Foundation

func issue121RunCodecLifecycleTests(_ runner: inout Issue121TestRunner) throws {
  try runner.test("canonical lowercase hex round trip") {
    let bytes = Array(UInt8(0)...UInt8(31))
    let encoded = Issue121Hex.encode(bytes)
    try issue121Expect(
      encoded == "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f", "hex")
    try issue121Expect(try Issue121Hex.decode(encoded, byteCount: 32) == bytes, "round trip")
  }
  try runner.test("hex rejects uppercase malformed and wrong length") {
    try issue121ExpectFailure(.bootstrap) { _ = try Issue121Hex.decode("AA", byteCount: 1) }
    try issue121ExpectFailure(.bootstrap) { _ = try Issue121Hex.decode("0g", byteCount: 1) }
    try issue121ExpectFailure(.bootstrap) { _ = try Issue121Hex.decode("00", byteCount: 2) }
  }
  try runner.test("golden hello vector matches TMOC v1") {
    let encoded = try Issue121Codec.encode(
      issue121Frame(.hello, body: issue121TestCapability)
    )
    let expected =
      "00000040544d4f4300010100" + String(repeating: "51", count: 16)
      + "0000000000000000" + String(repeating: "a7", count: 32)
    try issue121Expect(Issue121Hex.encode(encoded) == expected, "hello golden")
  }
  try runner.test("golden command vector is big endian") {
    let encoded = try Issue121Codec.encode(
      issue121Frame(.command, sequence: 1, body: [0x10, 0x02])
    )
    let expected =
      "00000022544d4f4300010300" + String(repeating: "51", count: 16)
      + "0000000000000001" + "1002"
    try issue121Expect(Issue121Hex.encode(encoded) == expected, "command golden")
  }
  try runner.test("one-byte fragmented frame decodes") {
    var decoder = Issue121FrameStreamDecoder()
    var decoded = [Issue121Frame]()
    for byte in try Issue121Codec.encode(issue121Frame(.ready)) {
      decoded += try decoder.append([byte])
    }
    try issue121Expect(decoded == [issue121Frame(.ready)], "fragmented")
    try decoder.finish()
  }
  try runner.test("coalesced frames decode in order") {
    var decoder = Issue121FrameStreamDecoder()
    let bytes =
      try Issue121Codec.encode(issue121Frame(.ready))
      + Issue121Codec.encode(issue121Frame(.started, sequence: 1))
    try issue121Expect(
      try decoder.append(bytes)
        == [issue121Frame(.ready), issue121Frame(.started, sequence: 1)],
      "coalesced"
    )
  }
  try runner.test("framing rejects short oversized and unfinished streams") {
    for length: UInt32 in [0, 31, 65_537] {
      var bytes = [UInt8]()
      Issue121Codec.append(length, to: &bytes)
      var decoder = Issue121FrameStreamDecoder()
      try issue121ExpectFailure(.framing) { _ = try decoder.append(bytes) }
    }
    var decoder = Issue121FrameStreamDecoder()
    _ = try decoder.append(
      Array((try Issue121Codec.encode(issue121Frame(.ready))).dropLast())
    )
    try issue121ExpectFailure(.disconnect) { try decoder.finish() }
  }
  try runner.test("codec rejects magic version kind and flags") {
    let valid = try Issue121Codec.encode(issue121Frame(.ready))
    for (index, value, failure) in [
      (4, UInt8(0), Issue121Failure.malformed),
      (9, UInt8(2), Issue121Failure.version),
      (10, UInt8(99), Issue121Failure.malformed),
      (11, UInt8(1), Issue121Failure.malformed),
    ] {
      var changed = valid
      changed[index] = value
      var decoder = Issue121FrameStreamDecoder()
      try issue121ExpectFailure(failure) { _ = try decoder.append(changed) }
    }
  }
  try runner.test("session authenticates exact READY") {
    var session = try Issue121ControllerSession(
      session: issue121TestSession,
      capability: issue121TestCapability,
      privateValues: []
    )
    try issue121Expect(
      session.hello() == issue121Frame(.hello, body: issue121TestCapability),
      "hello"
    )
    try session.receiveReady(issue121Frame(.ready))
    try issue121Expect(session.state == .ready(nextSequence: 1), "ready")
  }
  try runner.test("wrong session is terminal") {
    var session = try Issue121ControllerSession(
      session: issue121TestSession,
      capability: issue121TestCapability,
      privateValues: []
    )
    try issue121ExpectFailure(.candidateIdentity) {
      try session.receiveReady(
        issue121Frame(.ready, session: [UInt8](repeating: 0x52, count: 16))
      )
    }
    try issue121Expect(session.state == .terminal, "terminal")
  }
  try runner.test("wrong ready sequence body and kind are terminal") {
    for invalid in [
      issue121Frame(.ready, sequence: 1),
      issue121Frame(.ready, body: [0]),
      issue121Frame(.started),
    ] {
      var session = try Issue121ControllerSession(
        session: issue121TestSession,
        capability: issue121TestCapability,
        privateValues: []
      )
      try issue121ExpectFailure(.lifecycle) { try session.receiveReady(invalid) }
    }
  }
  try runner.test("all fixed command bodies match the Rust opcode table") {
    let cases: [(Issue121Command, [UInt8])] = [
      (.configureFixture(2), [0x10, 2]), (.coarsePreview, [0x11]),
      (.fullGeneration, [0x12]), (.cancelPreviewEarly, [0x13]),
      (.cancelPreviewMiddle, [0x14]), (.cancelPreviewLate, [0x15]),
      (.cancelFullEarly, [0x16]), (.cancelFullMiddle, [0x17]),
      (.cancelFullLate, [0x18]), (.cancellationAftermath, [0x19]),
      (
        .prepareReopen("/private/tmp/a.mapworld"),
        [0x1a] + Array("/private/tmp/a.mapworld".utf8)
      ),
      (.exportSVG, [0x1b]), (.exportPNG, [0x1c]),
    ]
    for (command, expected) in cases {
      try issue121Expect(try command.body() == expected, "opcode")
    }
  }
  try runner.test("command body rejects invalid fixture and prepare path") {
    try issue121ExpectFailure(.malformed) { _ = try Issue121Command.configureFixture(3).body() }
    try issue121ExpectFailure(.malformed) {
      _ = try Issue121Command.prepareReopen("relative.mapworld").body()
    }
    try issue121ExpectFailure(.malformed) {
      _ = try Issue121Command.prepareReopen("/private/tmp/a\0.mapworld").body()
    }
    try issue121ExpectFailure(.malformed) {
      _ = try Issue121Command.prepareReopen(
        "/" + String(repeating: "a", count: 1_025) + ".mapworld"
      ).body()
    }
    var session = try issue121ReadySession()
    try issue121ExpectFailure(.malformed) {
      _ = try session.command(.configureFixture(3))
    }
    try issue121Expect(session.state == .terminal, "invalid command is terminal")
  }
  try runner.test("single in flight and exact STARTED sequence") {
    var session = try issue121ReadySession()
    try issue121Expect(try session.command(.exportSVG).sequence == 1, "sequence")
    try issue121ExpectFailure(.lifecycle) { _ = try session.command(.exportPNG) }
  }
  try runner.test("STARTED wrong sequence and body fail") {
    for invalid in [
      issue121Frame(.started, sequence: 2),
      issue121Frame(.started, sequence: 1, body: [0]),
    ] {
      var session = try issue121ReadySession()
      _ = try session.command(.coarsePreview)
      try issue121ExpectFailure(invalid.sequence == 2 ? .sequence : .lifecycle) {
        try session.receiveStarted(invalid)
      }
    }
  }
  try runner.test("successful completion advances exact sequence") {
    var session = try issue121AwaitingCompletion()
    let receipt = Array("{\"valid\":true}".utf8)
    let completion = try session.receiveCompletion(
      issue121Frame(
        .complete,
        sequence: 1,
        body: issue121CompleteBody(status: 0, receipt: receipt)
      )
    )
    try issue121Expect(completion.status == 0, "status")
    try issue121Expect(session.state == .ready(nextSequence: 2), "next")
  }
  try runner.test("replay sequence is rejected by lifecycle") {
    var session = try issue121AwaitingCompletion()
    _ = try session.receiveCompletion(
      issue121Frame(
        .complete,
        sequence: 1,
        body: issue121CompleteBody(status: 0, receipt: [])
      )
    )
    try issue121Expect(try session.command(.exportPNG).sequence == 2, "second")
    try issue121ExpectFailure(.sequence) {
      try session.receiveStarted(issue121Frame(.started, sequence: 1))
    }
  }
  try runner.test("complete wrong sequence kind and reject are terminal") {
    var wrongSequence = try issue121AwaitingCompletion()
    try issue121ExpectFailure(.sequence) {
      _ = try wrongSequence.receiveCompletion(
        issue121Frame(
          .complete,
          sequence: 2,
          body: issue121CompleteBody(status: 0, receipt: [])
        )
      )
    }
    var wrongKind = try issue121AwaitingCompletion()
    try issue121ExpectFailure(.lifecycle) {
      _ = try wrongKind.receiveCompletion(issue121Frame(.started, sequence: 1))
    }
    var rejected = try issue121AwaitingCompletion()
    try issue121ExpectFailure(.rejected) {
      _ = try rejected.receiveCompletion(issue121Frame(.reject, sequence: 1, body: [0, 5]))
    }
    var wrongRejectSequence = try issue121AwaitingCompletion()
    try issue121ExpectFailure(.sequence) {
      _ = try wrongRejectSequence.receiveCompletion(
        issue121Frame(.reject, sequence: 2, body: [0, 5])
      )
    }
    for body in [[UInt8](arrayLiteral: 0), [0, 0], [0, 9]] {
      var malformedReject = try issue121AwaitingCompletion()
      try issue121ExpectFailure(.malformed) {
        _ = try malformedReject.receiveCompletion(
          issue121Frame(.reject, sequence: 1, body: body)
        )
      }
    }
  }
  try runner.test("completion validates status length and UTF-8") {
    var invalidStatus = try issue121AwaitingCompletion()
    try issue121ExpectFailure(.receipt) {
      _ = try invalidStatus.receiveCompletion(
        issue121Frame(
          .complete,
          sequence: 1,
          body: issue121CompleteBody(status: 5, receipt: [])
        )
      )
    }
    var invalidLength = try issue121AwaitingCompletion()
    try issue121ExpectFailure(.receipt) {
      _ = try invalidLength.receiveCompletion(
        issue121Frame(.complete, sequence: 1, body: [0, 0, 0, 0, 0, 2, 0x61])
      )
    }
    var invalidUTF8 = try issue121AwaitingCompletion()
    try issue121ExpectFailure(.receipt) {
      _ = try invalidUTF8.receiveCompletion(
        issue121Frame(
          .complete,
          sequence: 1,
          body: issue121CompleteBody(status: 0, receipt: [0xff])
        )
      )
    }
  }
  try runner.test("failure completion requires stable diagnostic") {
    var valid = try issue121AwaitingCompletion()
    let completion = try valid.receiveCompletion(
      issue121Frame(
        .complete,
        sequence: 1,
        body: issue121CompleteBody(
          status: 2,
          receipt: Array("observer.operation-failed".utf8)
        )
      )
    )
    try issue121Expect(completion.status == 2, "failure status")
    for diagnostic in ["private path", "Observer.bad", "observer.bad_value"] {
      var invalid = try issue121AwaitingCompletion()
      try issue121ExpectFailure(.receipt) {
        _ = try invalid.receiveCompletion(
          issue121Frame(
            .complete,
            sequence: 1,
            body: issue121CompleteBody(status: 1, receipt: Array(diagnostic.utf8))
          )
        )
      }
    }
  }
  try runner.test("privacy guard rejects every retained private value") {
    for privateValue in ["secret-token", "/private/tmp/private", "12345"] {
      var session = try issue121AwaitingCompletion(privateValues: [privateValue])
      try issue121ExpectFailure(.privacy) {
        _ = try session.receiveCompletion(
          issue121Frame(
            .complete,
            sequence: 1,
            body: issue121CompleteBody(
              status: 0,
              receipt: Array("receipt \(privateValue)".utf8)
            )
          )
        )
      }
    }
  }
  try runner.test("fixed deadlines match ADR-0020") {
    try issue121Expect(
      Issue121DeadlinePolicy.fixed
        == Issue121DeadlinePolicy(
          authenticationNanoseconds: 5_000_000_000,
          readyNanoseconds: 30_000_000_000,
          startedNanoseconds: 2_000_000_000,
          completionNanoseconds: 120_000_000_000
        ),
      "deadlines"
    )
  }
}
