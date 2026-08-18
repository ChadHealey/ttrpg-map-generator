import { inflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import {
  ATLAS_PNG_ENCODER_DIAGNOSTIC_CODES,
  ATLAS_PNG_ENCODER_IDAT_BYTES,
  ATLAS_PNG_ENCODER_MAXIMUM_OUTPUT_BYTES,
  createAtlasPngRowEncoder,
} from './atlas-png-encoder.ts';

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

describe('atlas-png-v1 streaming encoder', () => {
  it('writes canonical RGB chunks and reconstructs Sub then Up filtered rows', () => {
    const rows = [
      Uint8Array.of(10, 20, 30, 10, 25, 40, 9, 25, 41),
      Uint8Array.of(12, 18, 31, 8, 30, 39, 9, 24, 45),
    ];
    const first = encodeRows(3, 2, rows);
    const second = encodeRows(3, 2, rows);
    const parsed = parsePng(first);

    expect(first).toEqual(second);
    expect([...first.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
    expect(parsed.chunks.map(({ type }) => type)).toEqual(['IHDR', 'sRGB', 'IDAT', 'IEND']);
    expect(parsed.chunks.every(({ crcMatches }) => crcMatches)).toBe(true);

    const header = requiredChunk(parsed, 'IHDR').data;
    expect(readUint32(header, 0)).toBe(3);
    expect(readUint32(header, 4)).toBe(2);
    expect([...header.subarray(8)]).toEqual([8, 2, 0, 0, 0]);
    expect([...requiredChunk(parsed, 'sRGB').data]).toEqual([0]);
    expect(requiredChunk(parsed, 'IEND').data).toHaveLength(0);

    const compressed = concatenateIdat(parsed);
    expect([...compressed.subarray(0, 2)]).toEqual([0x78, 0x01]);
    expect((compressed[2] ?? 0) & 0b111).toBe(0b011);
    const filtered = new Uint8Array(inflateSync(compressed));
    expect([...filtered]).toEqual([
      1, 10, 20, 30, 0, 5, 10, 255, 0, 1, 2, 2, 254, 1, 254, 5, 255, 0, 255, 4,
    ]);
    expect(readUint32(compressed, compressed.length - 4)).toBe(adler32(filtered));
    expect(reconstructRows(filtered, 3, 2)).toEqual(rows);
  });

  it('pins the fixed-Huffman block, EOB padding, and checksum bytes', () => {
    const png = encodeRows(1, 1, [Uint8Array.of(0, 0, 0)]);

    expect(hex(png)).toBe(
      '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de000000017352474200aece1ce90000000c49444154780163646060000000080002296b7dd40000000049454e44ae426082',
    );
  });

  it('encodes long adversarial runs greedily with bounded distance-one matches', () => {
    const solid = new Uint8Array(1_024 * 3);
    solid.fill(173);
    const png = encodeRows(1_024, 2, [solid, solid]);
    const parsed = parsePng(png);
    const compressed = concatenateIdat(parsed);
    const filtered = new Uint8Array(inflateSync(compressed));

    expect(reconstructRows(filtered, 1_024, 2)).toEqual([solid, solid]);
    expect(compressed.byteLength).toBeLessThan(100);
    expect(png).toEqual(encodeRows(1_024, 2, [solid, solid]));
  });

  it('uses exact one-MiB production IDAT slices', () => {
    const widthPx = 8_192;
    const heightPx = 48;
    const creation = createAtlasPngRowEncoder({ widthPx, heightPx });
    expect(creation.ok, creation.ok ? undefined : creation.diagnostic.message).toBe(true);
    if (!creation.ok) return;
    let state = 0x1234_5678;
    for (let rowIndex = 0; rowIndex < heightPx; rowIndex += 1) {
      const row = new Uint8Array(widthPx * 3);
      for (let index = 0; index < row.length; index += 1) {
        state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
        row[index] = state >>> 24;
      }
      expect(creation.encoder.writeRow(row).ok).toBe(true);
    }
    const result = creation.encoder.finish();
    expect(result.ok, result.ok ? undefined : result.diagnostic.message).toBe(true);
    if (!result.ok) return;
    const idat = parsePng(result.bytes).chunks.filter(({ type }) => type === 'IDAT');

    expect(idat.length).toBeGreaterThan(1);
    expect(
      idat.slice(0, -1).every(({ data }) => data.length === ATLAS_PNG_ENCODER_IDAT_BYTES),
    ).toBe(true);
    expect(idat.at(-1)?.data.length).toBeLessThanOrEqual(ATLAS_PNG_ENCODER_IDAT_BYTES);
    expect(inflateSync(concatenateIdat(parsePng(result.bytes)))).toHaveLength(
      heightPx * (1 + widthPx * 3),
    );
  });

  it('supports a smaller deterministic IDAT partition only when explicitly requested', () => {
    const rows = [Uint8Array.from({ length: 96 }, (_, index) => (index * 71) & 0xff)];
    const png = encodeRows(32, 1, rows, { idatChunkBytes: 7 });
    const parsed = parsePng(png);
    const idat = parsed.chunks.filter(({ type }) => type === 'IDAT');

    expect(idat.length).toBeGreaterThan(1);
    expect(idat.slice(0, -1).every(({ data }) => data.length === 7)).toBe(true);
    expect(reconstructRows(new Uint8Array(inflateSync(concatenateIdat(parsed))), 32, 1)).toEqual(
      rows,
    );
  });

  it.each([
    { widthPx: 0, heightPx: 1 },
    { widthPx: 8_193, heightPx: 1 },
    { widthPx: 1, heightPx: 0 },
    { widthPx: 1, heightPx: 4_097 },
    { widthPx: 1, heightPx: 1, maximumOutputBytes: 0 },
    {
      widthPx: 1,
      heightPx: 1,
      maximumOutputBytes: ATLAS_PNG_ENCODER_MAXIMUM_OUTPUT_BYTES + 1,
    },
    { widthPx: 1, heightPx: 1, idatChunkBytes: 0 },
    { widthPx: 1, heightPx: 1, idatChunkBytes: ATLAS_PNG_ENCODER_IDAT_BYTES + 1 },
  ])('rejects invalid configuration %# without allocating an encoder', (options) => {
    const result = createAtlasPngRowEncoder(options);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostic.code).toBe(ATLAS_PNG_ENCODER_DIAGNOSTIC_CODES.configurationInvalid);
    expect('encoder' in result).toBe(false);
  });

  it('rejects malformed row lengths and retains the terminal failure', () => {
    const encoder = createEncoder({ widthPx: 2, heightPx: 1 });
    const failed = encoder.writeRow(new Uint8Array(5));

    expect(failed.ok).toBe(false);
    if (failed.ok) return;
    expect(failed.diagnostic.code).toBe(ATLAS_PNG_ENCODER_DIAGNOSTIC_CODES.rowLengthInvalid);
    expect(encoder.finish()).toEqual(failed);
  });

  it('requires exactly the declared row count and rejects rows after completion', () => {
    const tooFew = createEncoder({ widthPx: 1, heightPx: 2 });
    expect(tooFew.writeRow(Uint8Array.of(1, 2, 3)).ok).toBe(true);
    const missing = tooFew.finish();
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.diagnostic.code).toBe(ATLAS_PNG_ENCODER_DIAGNOSTIC_CODES.rowCountInvalid);
    }

    const tooMany = createEncoder({ widthPx: 1, heightPx: 1 });
    expect(tooMany.writeRow(Uint8Array.of(1, 2, 3)).ok).toBe(true);
    const extra = tooMany.writeRow(Uint8Array.of(4, 5, 6));
    expect(extra.ok).toBe(false);
    if (!extra.ok) {
      expect(extra.diagnostic.code).toBe(ATLAS_PNG_ENCODER_DIAGNOSTIC_CODES.rowCountInvalid);
    }

    const finished = createEncoder({ widthPx: 1, heightPx: 1 });
    expect(finished.writeRow(Uint8Array.of(1, 2, 3)).ok).toBe(true);
    expect(finished.finish().ok).toBe(true);
    const after = finished.writeRow(Uint8Array.of(1, 2, 3));
    expect(after.ok).toBe(false);
    if (!after.ok) {
      expect(after.diagnostic.code).toBe(ATLAS_PNG_ENCODER_DIAGNOSTIC_CODES.stateInvalid);
    }
    const repeatedFinish = finished.finish();
    expect(repeatedFinish.ok).toBe(false);
    if (!repeatedFinish.ok) {
      expect(repeatedFinish.diagnostic.code).toBe(ATLAS_PNG_ENCODER_DIAGNOSTIC_CODES.stateInvalid);
    }
  });

  it('enforces the exact final-byte ceiling without returning partial bytes', () => {
    const rows = [Uint8Array.from({ length: 300 }, (_, index) => (index * 113) & 0xff)];
    const accepted = encodeRows(100, 1, rows);
    const exact = encodeRows(100, 1, rows, { maximumOutputBytes: accepted.byteLength });
    expect(exact).toEqual(accepted);

    const rejected = attemptEncoding(100, 1, rows, {
      maximumOutputBytes: accepted.byteLength - 1,
    });
    expect(rejected.ok).toBe(false);
    if (rejected.ok) return;
    expect(rejected.diagnostic.code).toBe(ATLAS_PNG_ENCODER_DIAGNOSTIC_CODES.outputTooLarge);
    expect('bytes' in rejected).toBe(false);

    const impossible = createAtlasPngRowEncoder({
      widthPx: 1,
      heightPx: 1,
      maximumOutputBytes: 1,
    });
    expect(impossible.ok).toBe(false);
    if (!impossible.ok) {
      expect(impossible.diagnostic.code).toBe(ATLAS_PNG_ENCODER_DIAGNOSTIC_CODES.outputTooLarge);
    }
  });
});

function encodeRows(widthPx, heightPx, rows, options = {}) {
  const result = attemptEncoding(widthPx, heightPx, rows, options);
  expect(result.ok, result.ok ? undefined : result.diagnostic.message).toBe(true);
  if (!result.ok) throw new Error(result.diagnostic.message);
  return result.bytes;
}

function attemptEncoding(widthPx, heightPx, rows, options = {}) {
  const creation = createAtlasPngRowEncoder({ widthPx, heightPx, ...options });
  if (!creation.ok) return creation;
  for (const row of rows) {
    const written = creation.encoder.writeRow(row);
    if (!written.ok) return written;
  }
  return creation.encoder.finish();
}

function createEncoder(options) {
  const result = createAtlasPngRowEncoder(options);
  expect(result.ok, result.ok ? undefined : result.diagnostic.message).toBe(true);
  if (!result.ok) throw new Error(result.diagnostic.message);
  return result.encoder;
}

function parsePng(bytes) {
  expect([...bytes.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
  const chunks = [];
  let offset = 8;
  while (offset < bytes.length) {
    const length = readUint32(bytes, offset);
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = String.fromCharCode(...typeBytes);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    const storedCrc = readUint32(bytes, offset + 8 + length);
    chunks.push({ type, data, crcMatches: storedCrc === crc32(typeBytes, data) });
    offset += 12 + length;
  }
  expect(offset).toBe(bytes.length);
  return { chunks };
}

function requiredChunk(parsed, type) {
  const chunk = parsed.chunks.find((candidate) => candidate.type === type);
  if (chunk === undefined) throw new Error(`Missing ${type} chunk.`);
  return chunk;
}

function concatenateIdat(parsed) {
  const idat = parsed.chunks.filter(({ type }) => type === 'IDAT').map(({ data }) => data);
  const length = idat.reduce((total, data) => total + data.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const data of idat) {
    result.set(data, offset);
    offset += data.length;
  }
  return result;
}

function reconstructRows(filtered, widthPx, heightPx) {
  const rowBytes = widthPx * 3;
  const rows = [];
  let previous = new Uint8Array(rowBytes);
  for (let rowIndex = 0; rowIndex < heightPx; rowIndex += 1) {
    const offset = rowIndex * (rowBytes + 1);
    const filter = filtered[offset];
    const row = new Uint8Array(rowBytes);
    for (let index = 0; index < rowBytes; index += 1) {
      const encoded = filtered[offset + 1 + index] ?? 0;
      if (filter === 1) row[index] = (encoded + (index < 3 ? 0 : (row[index - 3] ?? 0))) & 0xff;
      else if (filter === 2) row[index] = (encoded + (previous[index] ?? 0)) & 0xff;
      else throw new Error(`Unexpected PNG filter ${String(filter)}.`);
    }
    rows.push(row);
    previous = row;
  }
  return rows;
}

function adler32(bytes) {
  let first = 1;
  let second = 0;
  for (const byte of bytes) {
    first = (first + byte) % 65_521;
    second = (second + first) % 65_521;
  }
  return ((second << 16) | first) >>> 0;
}

function crc32(type, data) {
  let crc = 0xffff_ffff;
  for (const bytes of [type, data]) {
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb8_8320 : 0);
      }
    }
  }
  return (crc ^ 0xffff_ffff) >>> 0;
}

function readUint32(bytes, offset) {
  return (
    (((bytes[offset] ?? 0) << 24) |
      ((bytes[offset + 1] ?? 0) << 16) |
      ((bytes[offset + 2] ?? 0) << 8) |
      (bytes[offset + 3] ?? 0)) >>>
    0
  );
}

function hex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
