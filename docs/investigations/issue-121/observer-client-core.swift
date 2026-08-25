import Foundation

let issue121ProtocolMagic: [UInt8] = Array("TMOC".utf8)
let issue121ProtocolVersion: UInt16 = 1
let issue121FixedPayloadBytes = 32
let issue121MaximumPayloadBytes = 65_536
let issue121MaximumPreparePathBytes = 1_024

enum Issue121Failure: Error, Equatable, CustomStringConvertible {
  case bootstrap
  case candidateIdentity
  case cleanup
  case deadline
  case disconnect
  case framing
  case lifecycle
  case malformed
  case pathPolicy
  case peerIdentity
  case privacy
  case receipt
  case rejected
  case sequence
  case usage
  case version

  var description: String {
    switch self {
    case .bootstrap: "observer-client.bootstrap"
    case .candidateIdentity: "observer-client.candidate-identity"
    case .cleanup: "observer-client.cleanup"
    case .deadline: "observer-client.deadline"
    case .disconnect: "observer-client.disconnect"
    case .framing: "observer-client.framing"
    case .lifecycle: "observer-client.lifecycle"
    case .malformed: "observer-client.malformed"
    case .pathPolicy: "observer-client.path-policy"
    case .peerIdentity: "observer-client.peer-identity"
    case .privacy: "observer-client.privacy"
    case .receipt: "observer-client.receipt"
    case .rejected: "observer-client.rejected"
    case .sequence: "observer-client.sequence"
    case .usage: "observer-client.usage"
    case .version: "observer-client.version"
    }
  }
}

enum Issue121FrameKind: UInt8, CaseIterable {
  case hello = 1
  case ready = 2
  case command = 3
  case started = 4
  case complete = 5
  case reject = 6
}

struct Issue121Frame: Equatable {
  let kind: Issue121FrameKind
  let session: [UInt8]
  let sequence: UInt64
  let body: [UInt8]
}

enum Issue121Hex {
  static func encode(_ bytes: [UInt8]) -> String {
    let digits = Array("0123456789abcdef".utf8)
    var result = [UInt8]()
    result.reserveCapacity(bytes.count * 2)
    for byte in bytes {
      result.append(digits[Int(byte >> 4)])
      result.append(digits[Int(byte & 0x0f)])
    }
    return String(decoding: result, as: UTF8.self)
  }

  static func decode(_ value: String, byteCount: Int) throws -> [UInt8] {
    let bytes = Array(value.utf8)
    guard bytes.count == byteCount * 2,
      bytes.allSatisfy({ byte in
        (UInt8(ascii: "0")...UInt8(ascii: "9")).contains(byte)
          || (UInt8(ascii: "a")...UInt8(ascii: "f")).contains(byte)
      })
    else { throw Issue121Failure.bootstrap }
    var decoded = [UInt8]()
    decoded.reserveCapacity(byteCount)
    for index in stride(from: 0, to: bytes.count, by: 2) {
      decoded.append(try nibble(bytes[index]) << 4 | nibble(bytes[index + 1]))
    }
    return decoded
  }

  private static func nibble(_ byte: UInt8) throws -> UInt8 {
    switch byte {
    case UInt8(ascii: "0")...UInt8(ascii: "9"): byte - UInt8(ascii: "0")
    case UInt8(ascii: "a")...UInt8(ascii: "f"): byte - UInt8(ascii: "a") + 10
    default: throw Issue121Failure.bootstrap
    }
  }
}

enum Issue121Codec {
  static func encode(_ frame: Issue121Frame) throws -> [UInt8] {
    guard frame.session.count == 16 else { throw Issue121Failure.framing }
    let payloadLength = issue121FixedPayloadBytes + frame.body.count
    guard (issue121FixedPayloadBytes...issue121MaximumPayloadBytes).contains(payloadLength),
      let length = UInt32(exactly: payloadLength)
    else { throw Issue121Failure.framing }
    var bytes = [UInt8]()
    bytes.reserveCapacity(4 + payloadLength)
    append(length, to: &bytes)
    bytes.append(contentsOf: issue121ProtocolMagic)
    append(issue121ProtocolVersion, to: &bytes)
    bytes.append(frame.kind.rawValue)
    bytes.append(0)
    bytes.append(contentsOf: frame.session)
    append(frame.sequence, to: &bytes)
    bytes.append(contentsOf: frame.body)
    return bytes
  }

  static func decodePayload(_ payload: [UInt8]) throws -> Issue121Frame {
    guard payload.count >= issue121FixedPayloadBytes else { throw Issue121Failure.framing }
    guard Array(payload[0..<4]) == issue121ProtocolMagic else { throw Issue121Failure.malformed }
    guard readUInt16(payload, at: 4) == issue121ProtocolVersion else {
      throw Issue121Failure.version
    }
    guard payload[7] == 0, let kind = Issue121FrameKind(rawValue: payload[6]) else {
      throw Issue121Failure.malformed
    }
    return Issue121Frame(
      kind: kind,
      session: Array(payload[8..<24]),
      sequence: readUInt64(payload, at: 24),
      body: Array(payload[32...])
    )
  }

  static func append(_ value: UInt16, to bytes: inout [UInt8]) {
    bytes.append(UInt8(truncatingIfNeeded: value >> 8))
    bytes.append(UInt8(truncatingIfNeeded: value))
  }

  static func append(_ value: UInt32, to bytes: inout [UInt8]) {
    bytes.append(UInt8(truncatingIfNeeded: value >> 24))
    bytes.append(UInt8(truncatingIfNeeded: value >> 16))
    bytes.append(UInt8(truncatingIfNeeded: value >> 8))
    bytes.append(UInt8(truncatingIfNeeded: value))
  }

  static func append(_ value: UInt64, to bytes: inout [UInt8]) {
    for shift in stride(from: 56, through: 0, by: -8) {
      bytes.append(UInt8(truncatingIfNeeded: value >> UInt64(shift)))
    }
  }

  static func readUInt16(_ bytes: [UInt8], at index: Int) -> UInt16 {
    UInt16(bytes[index]) << 8 | UInt16(bytes[index + 1])
  }

  static func readUInt32(_ bytes: [UInt8], at index: Int) -> UInt32 {
    UInt32(bytes[index]) << 24 | UInt32(bytes[index + 1]) << 16
      | UInt32(bytes[index + 2]) << 8 | UInt32(bytes[index + 3])
  }

  static func readUInt64(_ bytes: [UInt8], at index: Int) -> UInt64 {
    var value: UInt64 = 0
    for byte in bytes[index..<(index + 8)] { value = value << 8 | UInt64(byte) }
    return value
  }
}

struct Issue121FrameStreamDecoder {
  private(set) var bytes = [UInt8]()

  mutating func append(_ fragment: [UInt8]) throws -> [Issue121Frame] {
    bytes.append(contentsOf: fragment)
    var frames = [Issue121Frame]()
    while bytes.count >= 4 {
      let length = Int(Issue121Codec.readUInt32(bytes, at: 0))
      guard (issue121FixedPayloadBytes...issue121MaximumPayloadBytes).contains(length) else {
        throw Issue121Failure.framing
      }
      guard bytes.count >= 4 + length else { break }
      frames.append(try Issue121Codec.decodePayload(Array(bytes[4..<(4 + length)])))
      bytes.removeFirst(4 + length)
    }
    return frames
  }

  mutating func finish() throws {
    guard bytes.isEmpty else { throw Issue121Failure.disconnect }
  }
}

enum Issue121Command: Equatable {
  case configureFixture(UInt8)
  case coarsePreview
  case fullGeneration
  case cancelPreviewEarly
  case cancelPreviewMiddle
  case cancelPreviewLate
  case cancelFullEarly
  case cancelFullMiddle
  case cancelFullLate
  case cancellationAftermath
  case prepareReopen(String)
  case exportSVG
  case exportPNG

  func body() throws -> [UInt8] {
    switch self {
    case .configureFixture(let code):
      guard code <= 2 else { throw Issue121Failure.malformed }
      return [0x10, code]
    case .coarsePreview: return [0x11]
    case .fullGeneration: return [0x12]
    case .cancelPreviewEarly: return [0x13]
    case .cancelPreviewMiddle: return [0x14]
    case .cancelPreviewLate: return [0x15]
    case .cancelFullEarly: return [0x16]
    case .cancelFullMiddle: return [0x17]
    case .cancelFullLate: return [0x18]
    case .cancellationAftermath: return [0x19]
    case .prepareReopen(let path):
      let payload = Array(path.utf8)
      guard path.hasPrefix("/"), path.hasSuffix(".mapworld"), !payload.contains(0),
        payload.count <= issue121MaximumPreparePathBytes
      else { throw Issue121Failure.malformed }
      return [0x1a] + payload
    case .exportSVG: return [0x1b]
    case .exportPNG: return [0x1c]
    }
  }
}

struct Issue121Completion: Equatable {
  let sequence: UInt64
  let status: UInt16
  let receipt: String
}

struct Issue121PrivacyGuard {
  let privateValues: [String]

  func validate(_ value: String) throws {
    guard !privateValues.contains(where: { !$0.isEmpty && value.contains($0) }) else {
      throw Issue121Failure.privacy
    }
  }
}

struct Issue121DeadlinePolicy: Equatable {
  let authenticationNanoseconds: UInt64
  let readyNanoseconds: UInt64
  let startedNanoseconds: UInt64
  let completionNanoseconds: UInt64

  static let fixed = Issue121DeadlinePolicy(
    authenticationNanoseconds: 5_000_000_000,
    readyNanoseconds: 30_000_000_000,
    startedNanoseconds: 2_000_000_000,
    completionNanoseconds: 120_000_000_000
  )
}

enum Issue121ControllerState: Equatable {
  case awaitingReady
  case ready(nextSequence: UInt64)
  case awaitingStarted(sequence: UInt64)
  case awaitingCompletion(sequence: UInt64)
  case terminal
}

struct Issue121ControllerSession {
  let session: [UInt8]
  let capability: [UInt8]
  let privacy: Issue121PrivacyGuard
  private(set) var state: Issue121ControllerState = .awaitingReady

  init(session: [UInt8], capability: [UInt8], privateValues: [String]) throws {
    guard session.count == 16, capability.count == 32 else { throw Issue121Failure.bootstrap }
    self.session = session
    self.capability = capability
    privacy = Issue121PrivacyGuard(privateValues: privateValues)
  }

  func hello() -> Issue121Frame {
    Issue121Frame(kind: .hello, session: session, sequence: 0, body: capability)
  }

  mutating func receiveReady(_ frame: Issue121Frame) throws {
    guard state == .awaitingReady else { throw fail(.lifecycle) }
    try validateCommon(frame, expectedSequence: 0)
    guard frame.kind == .ready, frame.sequence == 0, frame.body.isEmpty else {
      throw fail(.lifecycle)
    }
    state = .ready(nextSequence: 1)
  }

  mutating func command(_ command: Issue121Command) throws -> Issue121Frame {
    guard case .ready(let nextSequence) = state else { throw fail(.lifecycle) }
    let body: [UInt8]
    do {
      body = try command.body()
    } catch let failure as Issue121Failure {
      throw fail(failure)
    } catch {
      throw fail(.malformed)
    }
    state = .awaitingStarted(sequence: nextSequence)
    return Issue121Frame(
      kind: .command,
      session: session,
      sequence: nextSequence,
      body: body
    )
  }

  mutating func finishQualification() throws {
    guard state == .ready(nextSequence: 1) else { throw fail(.lifecycle) }
    state = .terminal
  }

  mutating func receiveStarted(_ frame: Issue121Frame) throws {
    guard case .awaitingStarted(let sequence) = state else { throw fail(.lifecycle) }
    try validateCommon(frame, expectedSequence: sequence)
    guard frame.kind == .started, frame.sequence == sequence, frame.body.isEmpty else {
      throw fail(frame.sequence == sequence ? .lifecycle : .sequence)
    }
    state = .awaitingCompletion(sequence: sequence)
  }

  mutating func receiveCompletion(_ frame: Issue121Frame) throws -> Issue121Completion {
    guard case .awaitingCompletion(let sequence) = state else { throw fail(.lifecycle) }
    try validateCommon(frame, expectedSequence: sequence)
    guard frame.kind == .complete, frame.sequence == sequence else {
      throw fail(frame.sequence == sequence ? .lifecycle : .sequence)
    }
    let completion = try decodeCompletion(frame)
    let (nextSequence, overflow) = sequence.addingReportingOverflow(1)
    guard !overflow else { throw fail(.sequence) }
    state = .ready(nextSequence: nextSequence)
    return completion
  }

  mutating func invalidate() { state = .terminal }

  private mutating func validateCommon(
    _ frame: Issue121Frame,
    expectedSequence: UInt64
  ) throws {
    guard constantTimeEqual(frame.session, session) else { throw fail(.candidateIdentity) }
    if frame.kind == .reject {
      guard frame.sequence == expectedSequence else { throw fail(.sequence) }
      guard frame.body.count == 2,
        (1...8).contains(Issue121Codec.readUInt16(frame.body, at: 0))
      else { throw fail(.malformed) }
      throw fail(.rejected)
    }
  }

  private mutating func decodeCompletion(_ frame: Issue121Frame) throws -> Issue121Completion {
    guard frame.body.count >= 6 else { throw fail(.receipt) }
    let status = Issue121Codec.readUInt16(frame.body, at: 0)
    let length = Int(Issue121Codec.readUInt32(frame.body, at: 2))
    guard status <= 4, length == frame.body.count - 6,
      let receipt = String(bytes: frame.body[6...], encoding: .utf8)
    else { throw fail(.receipt) }
    if status != 0 {
      guard receipt.hasPrefix("observer."), receipt.utf8.count <= 96,
        receipt.utf8.allSatisfy({ byte in
          byte.isASCIILowercase || byte.isASCIIDigit || byte == 0x2e || byte == 0x2d
        })
      else { throw fail(.receipt) }
    }
    do { try privacy.validate(receipt) } catch { throw fail(.privacy) }
    return Issue121Completion(sequence: frame.sequence, status: status, receipt: receipt)
  }

  private mutating func fail(_ error: Issue121Failure) -> Issue121Failure {
    state = .terminal
    return error
  }
}

func issue121ConstantTimeEqual(_ left: [UInt8], _ right: [UInt8]) -> Bool {
  var difference = left.count ^ right.count
  for index in 0..<max(left.count, right.count) {
    let leftByte = index < left.count ? left[index] : 0
    let rightByte = index < right.count ? right[index] : 0
    difference |= Int(leftByte ^ rightByte)
  }
  return difference == 0
}

private func constantTimeEqual(_ left: [UInt8], _ right: [UInt8]) -> Bool {
  issue121ConstantTimeEqual(left, right)
}

extension UInt8 {
  fileprivate var isASCIILowercase: Bool { (0x61...0x7a).contains(self) }
  fileprivate var isASCIIDigit: Bool { (0x30...0x39).contains(self) }
}
