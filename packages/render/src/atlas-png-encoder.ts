/** Dependency-free, bounded atlas-png-v1 RGB row filtering and PNG encoding. */

export const ATLAS_PNG_ENCODER_MAXIMUM_OUTPUT_BYTES = 64 * 1_024 * 1_024;
export const ATLAS_PNG_ENCODER_IDAT_BYTES = 1_024 * 1_024;
export const ATLAS_PNG_ENCODER_MAXIMUM_WIDTH_PX = 8_192;
export const ATLAS_PNG_ENCODER_MAXIMUM_HEIGHT_PX = 4_096;

export const ATLAS_PNG_ENCODER_DIAGNOSTIC_CODES = Object.freeze({
  configurationInvalid: 'atlas-png.encoder.configuration-invalid',
  outputTooLarge: 'atlas-png.encoder.output-too-large',
  rowCountInvalid: 'atlas-png.encoder.row-count-invalid',
  rowLengthInvalid: 'atlas-png.encoder.row-length-invalid',
  stateInvalid: 'atlas-png.encoder.state-invalid',
} as const);

export type AtlasPngEncoderDiagnosticCode =
  (typeof ATLAS_PNG_ENCODER_DIAGNOSTIC_CODES)[keyof typeof ATLAS_PNG_ENCODER_DIAGNOSTIC_CODES];

export interface AtlasPngEncoderDiagnostic {
  readonly code: AtlasPngEncoderDiagnosticCode;
  readonly message: string;
}

export interface AtlasPngEncoderOptions {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly maximumOutputBytes?: number;
  /** Production uses 1 MiB. Smaller values are accepted for focused partition tests. */
  readonly idatChunkBytes?: number;
}

export type AtlasPngEncoderStepResult =
  { readonly ok: true } | { readonly ok: false; readonly diagnostic: AtlasPngEncoderDiagnostic };

export type AtlasPngEncoderResult =
  | { readonly ok: true; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly diagnostic: AtlasPngEncoderDiagnostic };

export type AtlasPngEncoderCreationResult =
  | { readonly ok: true; readonly encoder: AtlasPngRowEncoder }
  | { readonly ok: false; readonly diagnostic: AtlasPngEncoderDiagnostic };

const PNG_SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
const IHDR_TYPE = asciiType(73, 72, 68, 82);
const SRGB_TYPE = asciiType(115, 82, 71, 66);
const IDAT_TYPE = asciiType(73, 68, 65, 84);
const IEND_TYPE = asciiType(73, 69, 78, 68);
const PNG_BYTES_EXCLUDING_IDAT = PNG_SIGNATURE.byteLength + (12 + 13) + (12 + 1) + 12;
const PNG_CHUNK_OVERHEAD = 12;
const ADLER_MODULUS = 65_521;
const ADLER_BATCH_BYTES = 5_552;
const EMPTY_BYTES = new Uint8Array();
const CRC32_TABLE = createCrc32Table();

/** Create an exact-height row stream that exposes no partial bytes before `finish` succeeds. */
export function createAtlasPngRowEncoder(
  options: AtlasPngEncoderOptions,
): AtlasPngEncoderCreationResult {
  return AtlasPngRowEncoder.create(options);
}

export class AtlasPngRowEncoder {
  static create(options: AtlasPngEncoderOptions): AtlasPngEncoderCreationResult {
    const configurationDiagnostic = validateOptions(options);
    if (configurationDiagnostic !== undefined) {
      return { ok: false, diagnostic: configurationDiagnostic };
    }
    const maximumOutputBytes = options.maximumOutputBytes ?? ATLAS_PNG_ENCODER_MAXIMUM_OUTPUT_BYTES;
    const idatChunkBytes = options.idatChunkBytes ?? ATLAS_PNG_ENCODER_IDAT_BYTES;
    const encoder = new AtlasPngRowEncoder(
      options.widthPx,
      options.heightPx,
      maximumOutputBytes,
      idatChunkBytes,
    );
    const startupDiagnostic = encoder.#start();
    return startupDiagnostic === undefined
      ? { ok: true, encoder }
      : { ok: false, diagnostic: startupDiagnostic };
  }

  readonly #widthPx: number;
  readonly #heightPx: number;
  readonly #rowBytes: number;
  readonly #maximumOutputBytes: number;
  readonly #sink: PngCompressedSink;
  readonly #bits: DeflateBitWriter;
  readonly #previousRow: Uint8Array;
  readonly #filteredScanline: Uint8Array;
  #rowCount = 0;
  #adlerFirst = 1;
  #adlerSecond = 0;
  #failure: AtlasPngEncoderDiagnostic | undefined;
  #isFinished = false;

  private constructor(
    widthPx: number,
    heightPx: number,
    maximumOutputBytes: number,
    idatChunkBytes: number,
  ) {
    this.#widthPx = widthPx;
    this.#heightPx = heightPx;
    this.#rowBytes = widthPx * 3;
    this.#maximumOutputBytes = maximumOutputBytes;
    this.#sink = new PngCompressedSink(maximumOutputBytes, idatChunkBytes);
    this.#bits = new DeflateBitWriter(this.#sink);
    this.#previousRow = new Uint8Array(this.#rowBytes);
    this.#filteredScanline = new Uint8Array(this.#rowBytes + 1);
  }

  /** Filter and compress one immutable RGB row synchronously. */
  writeRow(row: Uint8Array): AtlasPngEncoderStepResult {
    const unavailable = this.#unavailableDiagnostic();
    if (unavailable !== undefined) return { ok: false, diagnostic: unavailable };
    if (row.byteLength !== this.#rowBytes) {
      return this.#fail(
        ATLAS_PNG_ENCODER_DIAGNOSTIC_CODES.rowLengthInvalid,
        `Atlas PNG RGB rows must contain exactly ${String(this.#rowBytes)} bytes.`,
      );
    }
    if (this.#rowCount >= this.#heightPx) {
      return this.#fail(
        ATLAS_PNG_ENCODER_DIAGNOSTIC_CODES.rowCountInvalid,
        `Atlas PNG encoding accepts exactly ${String(this.#heightPx)} rows.`,
      );
    }

    if (this.#rowCount === 0) this.#filterSub(row);
    else this.#filterUp(row);
    this.#updateAdler(this.#filteredScanline);
    if (!writeRunLengthEncodedScanline(this.#bits, this.#filteredScanline)) {
      return this.#failOutputTooLarge();
    }
    this.#previousRow.set(row);
    this.#rowCount += 1;
    return { ok: true };
  }

  /** Finish DEFLATE and assemble the canonical PNG, or return one stable failure. */
  finish(): AtlasPngEncoderResult {
    const unavailable = this.#unavailableDiagnostic();
    if (unavailable !== undefined) return { ok: false, diagnostic: unavailable };
    if (this.#rowCount !== this.#heightPx) {
      return this.#failResult(
        ATLAS_PNG_ENCODER_DIAGNOSTIC_CODES.rowCountInvalid,
        `Atlas PNG encoding requires ${String(this.#heightPx)} rows before finishing; received ${String(this.#rowCount)}.`,
      );
    }
    if (!writeFixedLiteral(this.#bits, 256) || !this.#bits.finishByte()) {
      return this.#failOutputTooLargeResult();
    }
    const adler = ((this.#adlerSecond << 16) | this.#adlerFirst) >>> 0;
    if (
      !this.#sink.writeByte(adler >>> 24) ||
      !this.#sink.writeByte(adler >>> 16) ||
      !this.#sink.writeByte(adler >>> 8) ||
      !this.#sink.writeByte(adler)
    ) {
      return this.#failOutputTooLargeResult();
    }
    const idatPayloads = this.#sink.takeChunks();
    const outputLength = pngLength(idatPayloads);
    if (outputLength > this.#maximumOutputBytes) {
      return this.#failOutputTooLargeResult();
    }
    const bytes = assemblePng(this.#widthPx, this.#heightPx, outputLength, idatPayloads);
    this.#isFinished = true;
    return { ok: true, bytes };
  }

  #start(): AtlasPngEncoderDiagnostic | undefined {
    // CMF/FLG select DEFLATE, a 32 KiB window, fastest-level metadata, and no dictionary.
    if (!this.#sink.writeByte(0x78) || !this.#sink.writeByte(0x01)) {
      return this.#recordOutputTooLarge();
    }
    // One final fixed-Huffman block: BFINAL=1, BTYPE=01, in DEFLATE bit order.
    if (!this.#bits.writeBits(1, 1) || !this.#bits.writeBits(1, 2)) {
      return this.#recordOutputTooLarge();
    }
    return undefined;
  }

  #filterSub(row: Uint8Array): void {
    this.#filteredScanline[0] = 1;
    for (let index = 0; index < row.length; index += 1) {
      const left = index < 3 ? 0 : (row[index - 3] ?? 0);
      this.#filteredScanline[index + 1] = ((row[index] ?? 0) - left) & 0xff;
    }
  }

  #filterUp(row: Uint8Array): void {
    this.#filteredScanline[0] = 2;
    for (let index = 0; index < row.length; index += 1) {
      this.#filteredScanline[index + 1] =
        ((row[index] ?? 0) - (this.#previousRow[index] ?? 0)) & 0xff;
    }
  }

  #updateAdler(bytes: Uint8Array): void {
    for (let start = 0; start < bytes.length; start += ADLER_BATCH_BYTES) {
      const end = Math.min(bytes.length, start + ADLER_BATCH_BYTES);
      for (let index = start; index < end; index += 1) {
        this.#adlerFirst += bytes[index] ?? 0;
        this.#adlerSecond += this.#adlerFirst;
      }
      this.#adlerFirst %= ADLER_MODULUS;
      this.#adlerSecond %= ADLER_MODULUS;
    }
  }

  #unavailableDiagnostic(): AtlasPngEncoderDiagnostic | undefined {
    if (this.#failure !== undefined) return this.#failure;
    return this.#isFinished
      ? diagnostic(
          ATLAS_PNG_ENCODER_DIAGNOSTIC_CODES.stateInvalid,
          'Atlas PNG row encoding has already finished.',
        )
      : undefined;
  }

  #fail(
    code: AtlasPngEncoderDiagnosticCode,
    message: string,
  ): Extract<AtlasPngEncoderStepResult, { readonly ok: false }> {
    const finding = diagnostic(code, message);
    this.#failure = finding;
    this.#sink.clear();
    return { ok: false, diagnostic: finding };
  }

  #failResult(code: AtlasPngEncoderDiagnosticCode, message: string): AtlasPngEncoderResult {
    const result = this.#fail(code, message);
    return { ok: false, diagnostic: result.diagnostic };
  }

  #recordOutputTooLarge(): AtlasPngEncoderDiagnostic {
    const finding = diagnostic(
      ATLAS_PNG_ENCODER_DIAGNOSTIC_CODES.outputTooLarge,
      `Atlas PNG output exceeds the ${String(this.#maximumOutputBytes)}-byte limit.`,
    );
    this.#failure = finding;
    this.#sink.clear();
    return finding;
  }

  #failOutputTooLarge(): AtlasPngEncoderStepResult {
    return { ok: false, diagnostic: this.#recordOutputTooLarge() };
  }

  #failOutputTooLargeResult(): AtlasPngEncoderResult {
    return { ok: false, diagnostic: this.#recordOutputTooLarge() };
  }
}

class PngCompressedSink {
  readonly #maximumOutputBytes: number;
  readonly #chunkBytes: number;
  #chunks: Uint8Array[] = [];
  #current: Uint8Array;
  #currentLength = 0;
  #payloadLength = 0;

  constructor(maximumOutputBytes: number, chunkBytes: number) {
    this.#maximumOutputBytes = maximumOutputBytes;
    this.#chunkBytes = chunkBytes;
    this.#current = new Uint8Array(Math.min(chunkBytes, maximumOutputBytes));
  }

  writeByte(value: number): boolean {
    const nextPayloadLength = this.#payloadLength + 1;
    const idatCount = Math.ceil(nextPayloadLength / this.#chunkBytes);
    if (
      PNG_BYTES_EXCLUDING_IDAT + nextPayloadLength + idatCount * PNG_CHUNK_OVERHEAD >
      this.#maximumOutputBytes
    ) {
      return false;
    }
    if (this.#currentLength === this.#current.length) {
      this.#chunks.push(this.#current);
      this.#current = new Uint8Array(
        Math.min(this.#chunkBytes, this.#maximumOutputBytes - this.#payloadLength),
      );
      this.#currentLength = 0;
    }
    this.#current[this.#currentLength] = value & 0xff;
    this.#currentLength += 1;
    this.#payloadLength = nextPayloadLength;
    return true;
  }

  takeChunks(): readonly Uint8Array[] {
    if (this.#currentLength > 0) {
      this.#chunks.push(this.#current.subarray(0, this.#currentLength));
    }
    const result = this.#chunks;
    this.#chunks = [];
    this.#current = EMPTY_BYTES;
    this.#currentLength = 0;
    return result;
  }

  clear(): void {
    this.#chunks = [];
    this.#current = EMPTY_BYTES;
    this.#currentLength = 0;
    this.#payloadLength = 0;
  }
}

class DeflateBitWriter {
  readonly #sink: PngCompressedSink;
  #byte = 0;
  #bitCount = 0;

  constructor(sink: PngCompressedSink) {
    this.#sink = sink;
  }

  writeBits(value: number, count: number): boolean {
    for (let bit = 0; bit < count; bit += 1) {
      this.#byte |= ((value >>> bit) & 1) << this.#bitCount;
      this.#bitCount += 1;
      if (this.#bitCount === 8) {
        if (!this.#sink.writeByte(this.#byte)) return false;
        this.#byte = 0;
        this.#bitCount = 0;
      }
    }
    return true;
  }

  finishByte(): boolean {
    if (this.#bitCount === 0) return true;
    const written = this.#sink.writeByte(this.#byte);
    this.#byte = 0;
    this.#bitCount = 0;
    return written;
  }
}

function writeRunLengthEncodedScanline(writer: DeflateBitWriter, scanline: Uint8Array): boolean {
  for (let start = 0; start < scanline.length;) {
    const value = scanline[start] ?? 0;
    let end = start + 1;
    while (end < scanline.length && scanline[end] === value) end += 1;
    if (!writeFixedLiteral(writer, value)) return false;
    let remaining = end - start - 1;
    while (remaining >= 3) {
      const matchLength = Math.min(258, remaining);
      if (!writeLength(writer, matchLength) || !writer.writeBits(0, 5)) return false;
      remaining -= matchLength;
    }
    while (remaining > 0) {
      if (!writeFixedLiteral(writer, value)) return false;
      remaining -= 1;
    }
    start = end;
  }
  return true;
}

function writeFixedLiteral(writer: DeflateBitWriter, symbol: number): boolean {
  if (symbol <= 143) return writer.writeBits(reverseBits(0x30 + symbol, 8), 8);
  if (symbol <= 255) return writer.writeBits(reverseBits(0x190 + symbol - 144, 9), 9);
  if (symbol <= 279) return writer.writeBits(reverseBits(symbol - 256, 7), 7);
  return writer.writeBits(reverseBits(0xc0 + symbol - 280, 8), 8);
}

function writeLength(writer: DeflateBitWriter, length: number): boolean {
  if (length === 258) return writeFixedLiteral(writer, 285);
  let base = 3;
  for (let symbol = 257; symbol <= 284; symbol += 1) {
    const extraBits = symbol < 265 ? 0 : Math.floor((symbol - 261) / 4);
    const span = 1 << extraBits;
    if (length < base + span) {
      return writeFixedLiteral(writer, symbol) && writer.writeBits(length - base, extraBits);
    }
    base += span;
  }
  return false;
}

function reverseBits(value: number, count: number): number {
  let reversed = 0;
  for (let index = 0; index < count; index += 1) {
    reversed = (reversed << 1) | ((value >>> index) & 1);
  }
  return reversed;
}

function assemblePng(
  widthPx: number,
  heightPx: number,
  outputLength: number,
  idatPayloads: readonly Uint8Array[],
): Uint8Array {
  const output = new Uint8Array(outputLength);
  output.set(PNG_SIGNATURE, 0);
  let offset = PNG_SIGNATURE.byteLength;
  const header = new Uint8Array(13);
  writeUint32(header, 0, widthPx);
  writeUint32(header, 4, heightPx);
  header.set([8, 2, 0, 0, 0], 8);
  offset = writePngChunk(output, offset, IHDR_TYPE, header);
  offset = writePngChunk(output, offset, SRGB_TYPE, Uint8Array.of(0));
  for (const payload of idatPayloads) {
    offset = writePngChunk(output, offset, IDAT_TYPE, payload);
  }
  writePngChunk(output, offset, IEND_TYPE, EMPTY_BYTES);
  return output;
}

function writePngChunk(
  output: Uint8Array,
  offset: number,
  type: Uint8Array,
  data: Uint8Array,
): number {
  writeUint32(output, offset, data.byteLength);
  output.set(type, offset + 4);
  output.set(data, offset + 8);
  writeUint32(output, offset + 8 + data.byteLength, crc32(type, data));
  return offset + PNG_CHUNK_OVERHEAD + data.byteLength;
}

function pngLength(idatPayloads: readonly Uint8Array[]): number {
  return (
    PNG_BYTES_EXCLUDING_IDAT +
    idatPayloads.reduce((total, payload) => total + payload.byteLength, 0) +
    idatPayloads.length * PNG_CHUNK_OVERHEAD
  );
}

function crc32(type: Uint8Array, data: Uint8Array): number {
  let crc = 0xffff_ffff;
  for (const bytes of [type, data]) {
    for (const byte of bytes) {
      crc = (crc >>> 8) ^ (CRC32_TABLE[(crc ^ byte) & 0xff] ?? 0);
    }
  }
  return (crc ^ 0xffff_ffff) >>> 0;
}

function createCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let byte = 0; byte < table.length; byte += 1) {
    let crc = byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb8_8320 : 0);
    }
    table[byte] = crc >>> 0;
  }
  return table;
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value >>> 24;
  bytes[offset + 1] = value >>> 16;
  bytes[offset + 2] = value >>> 8;
  bytes[offset + 3] = value;
}

function validateOptions(options: AtlasPngEncoderOptions): AtlasPngEncoderDiagnostic | undefined {
  const maximumOutputBytes = options.maximumOutputBytes ?? ATLAS_PNG_ENCODER_MAXIMUM_OUTPUT_BYTES;
  const idatChunkBytes = options.idatChunkBytes ?? ATLAS_PNG_ENCODER_IDAT_BYTES;
  if (
    !Number.isSafeInteger(options.widthPx) ||
    options.widthPx < 1 ||
    options.widthPx > ATLAS_PNG_ENCODER_MAXIMUM_WIDTH_PX ||
    !Number.isSafeInteger(options.heightPx) ||
    options.heightPx < 1 ||
    options.heightPx > ATLAS_PNG_ENCODER_MAXIMUM_HEIGHT_PX ||
    !Number.isSafeInteger(maximumOutputBytes) ||
    maximumOutputBytes < 1 ||
    maximumOutputBytes > ATLAS_PNG_ENCODER_MAXIMUM_OUTPUT_BYTES ||
    !Number.isSafeInteger(idatChunkBytes) ||
    idatChunkBytes < 1 ||
    idatChunkBytes > ATLAS_PNG_ENCODER_IDAT_BYTES
  ) {
    return diagnostic(
      ATLAS_PNG_ENCODER_DIAGNOSTIC_CODES.configurationInvalid,
      'Choose positive integer RGB dimensions within 8192 × 4096, an output limit through 64 MiB, and IDAT slices through 1 MiB.',
    );
  }
  return undefined;
}

function diagnostic(
  code: AtlasPngEncoderDiagnosticCode,
  message: string,
): AtlasPngEncoderDiagnostic {
  return Object.freeze({ code, message });
}

function asciiType(first: number, second: number, third: number, fourth: number): Uint8Array {
  return Uint8Array.of(first, second, third, fourth);
}
