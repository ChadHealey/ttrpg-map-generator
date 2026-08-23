import Darwin
import Foundation

@main
enum PackagedPreviewRetentionCommand {
  static func main() {
    exit(
      PackagedPreviewRetentionCommandRunner.run(
        arguments: Array(CommandLine.arguments.dropFirst()),
        receiptSink: emit
      )
    )
  }

  private static func emit(_ receipt: SanitizedRetentionReceipt) throws {
    var data = try RetentionReceiptEncoder.encode(receipt)
    data.append(0x0A)
    try FileHandle.standardOutput.write(contentsOf: data)
  }
}
