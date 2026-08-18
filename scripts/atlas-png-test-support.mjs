/** Independent, bounded PNG inspection used only by atlas-png-v1 verification. */

import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { createInflate } from 'node:zlib';

import { expect } from 'vitest';

const PNG_SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
const PRODUCTION_IDAT_BYTES = 1_048_576;
const CRC32_TABLE = createCrc32Table();

/** Parse chunks and verify the complete canonical atlas-png-v1 container independently. */
export function inspectAtlasPngContainer(bytes, expectedDimensions) {
  expect(bytes.subarray(0, PNG_SIGNATURE.length)).toEqual(PNG_SIGNATURE);
  const chunks = [];
  let offset = PNG_SIGNATURE.length;
  while (offset < bytes.length) {
    expect(offset + 12).toBeLessThanOrEqual(bytes.length);
    const length = readUint32(bytes, offset);
    const end = offset + 12 + length;
    expect(end).toBeLessThanOrEqual(bytes.length);
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = String.fromCharCode(...typeBytes);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    expect(readUint32(bytes, offset + 8 + length), `${type} CRC`).toBe(crc32(typeBytes, data));
    chunks.push({ type, data });
    offset = end;
  }
  expect(offset).toBe(bytes.length);
  expect(chunks.map(({ type }) => type)).toEqual([
    'IHDR',
    'sRGB',
    ...chunks.slice(2, -1).map(() => 'IDAT'),
    'IEND',
  ]);
  const header = requiredChunk(chunks, 'IHDR').data;
  expect(header).toHaveLength(13);
  const widthPx = readUint32(header, 0);
  const heightPx = readUint32(header, 4);
  expect({ widthPx, heightPx }).toEqual(expectedDimensions);
  expect([...header.subarray(8)]).toEqual([8, 2, 0, 0, 0]);
  expect([...requiredChunk(chunks, 'sRGB').data]).toEqual([0]);
  expect(requiredChunk(chunks, 'IEND').data).toHaveLength(0);
  const idat = chunks.filter(({ type }) => type === 'IDAT');
  expect(idat.length).toBeGreaterThan(0);
  expect(idat.slice(0, -1).every(({ data }) => data.length === PRODUCTION_IDAT_BYTES)).toBe(true);
  expect(idat.at(-1)?.data.length).toBeGreaterThan(0);
  expect(idat.at(-1)?.data.length).toBeLessThanOrEqual(PRODUCTION_IDAT_BYTES);
  expect(readLogicalByte(idat, 0)).toBe(0x78);
  expect(readLogicalByte(idat, 1)).toBe(0x01);
  expect(readLogicalByte(idat, 2) & 0b111).toBe(0b011);
  return { chunks, idat, widthPx, heightPx };
}

/**
 * Inflate, check filters and Adler-32, and hash reconstructed RGB pixels one row at a time.
 * Only explicitly selected rows are retained, so an 8192 by 4096 check stays bounded.
 */
export async function inspectAtlasPngPixels(bytes, expectedDimensions, selectedRowIndexes = []) {
  const container = inspectAtlasPngContainer(bytes, expectedDimensions);
  const selected = new Set(selectedRowIndexes);
  const sampledRows = new Map();
  const rgbHash = createHash('sha256');
  const rowBytes = container.widthPx * 3;
  const scanlineBytes = rowBytes + 1;
  let previous = new Uint8Array(rowBytes);
  let pending = Buffer.alloc(0);
  let rowIndex = 0;
  let adlerFirst = 1;
  let adlerSecond = 0;
  const source = Readable.from(
    container.idat.map(({ data }) => Buffer.from(data.buffer, data.byteOffset, data.byteLength)),
  );
  const inflated = source.pipe(createInflate());
  for await (const value of inflated) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    pending = pending.length === 0 ? chunk : Buffer.concat([pending, chunk]);
    while (pending.length >= scanlineBytes) {
      const scanline = pending.subarray(0, scanlineBytes);
      pending = pending.subarray(scanlineBytes);
      expect(scanline[0]).toBe(rowIndex === 0 ? 1 : 2);
      [adlerFirst, adlerSecond] = updateAdler(scanline, adlerFirst, adlerSecond);
      const row = reconstructRow(scanline, previous);
      rgbHash.update(row);
      if (selected.has(rowIndex)) sampledRows.set(rowIndex, Uint8Array.from(row));
      previous = row;
      rowIndex += 1;
    }
  }
  expect(pending).toHaveLength(0);
  expect(rowIndex).toBe(container.heightPx);
  const storedAdler = readLogicalUint32FromEnd(container.idat);
  expect(((adlerSecond << 16) | adlerFirst) >>> 0).toBe(storedAdler);
  return {
    ...container,
    pixelSha256: rgbHash.digest('hex'),
    sampledRows,
  };
}

function reconstructRow(scanline, previous) {
  const filter = scanline[0];
  const row = new Uint8Array(scanline.length - 1);
  for (let index = 0; index < row.length; index += 1) {
    const encoded = scanline[index + 1] ?? 0;
    const predictor =
      filter === 1 ? (index < 3 ? 0 : (row[index - 3] ?? 0)) : (previous[index] ?? 0);
    row[index] = (encoded + predictor) & 0xff;
  }
  return row;
}

function updateAdler(bytes, first, second) {
  for (const byte of bytes) {
    first = (first + byte) % 65_521;
    second = (second + first) % 65_521;
  }
  return [first, second];
}

function requiredChunk(chunks, type) {
  const value = chunks.find((chunk) => chunk.type === type);
  if (value === undefined) throw new Error(`Missing ${type} chunk.`);
  return value;
}

function readLogicalByte(idat, logicalOffset) {
  let remaining = logicalOffset;
  for (const { data } of idat) {
    if (remaining < data.length) return data[remaining] ?? 0;
    remaining -= data.length;
  }
  throw new Error('PNG IDAT stream ended unexpectedly.');
}

function readLogicalUint32FromEnd(idat) {
  const total = idat.reduce((sum, { data }) => sum + data.length, 0);
  return (
    ((readLogicalByte(idat, total - 4) << 24) |
      (readLogicalByte(idat, total - 3) << 16) |
      (readLogicalByte(idat, total - 2) << 8) |
      readLogicalByte(idat, total - 1)) >>>
    0
  );
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

function crc32(type, data) {
  let crc = 0xffff_ffff;
  for (const bytes of [type, data]) {
    for (const byte of bytes) crc = (crc >>> 8) ^ (CRC32_TABLE[(crc ^ byte) & 0xff] ?? 0);
  }
  return (crc ^ 0xffff_ffff) >>> 0;
}

function createCrc32Table() {
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
