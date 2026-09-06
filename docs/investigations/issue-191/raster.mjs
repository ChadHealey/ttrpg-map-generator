/** Diagnostic RGB encoder mirrored from issue 164; no production rendering. */
import { deflateSync } from 'node:zlib';
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, payload) {
  const body = Buffer.concat([Buffer.from(type), payload]);
  const result = Buffer.alloc(body.length + 8);
  result.writeUInt32BE(payload.length, 0);
  body.copy(result, 4);
  result.writeUInt32BE(crc32(body), body.length + 4);
  return result;
}
export function png(mask, width, height) {
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const color = mask[y * width + x] ? [42, 55, 51] : [240, 237, 225];
      for (let c = 0; c < 3; c++) rows[y * (width * 3 + 1) + 1 + x * 3 + c] = color[c];
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function raster(samples, profile, width, height) {
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = Math.round((1 - (y + 0.5) / height) * profile.latitudeBandCount);
    for (let x = 0; x < width; x++) {
      const col = Math.floor(((x + 0.5) / width) * profile.longitudeCellCount);
      const index =
        row === 0
          ? 0
          : row === profile.latitudeBandCount
            ? samples.length - 1
            : 1 + (row - 1) * profile.longitudeCellCount + col;
      mask[y * width + x] = Number(samples.at(index) === 'land');
    }
  }
  return { mask, image: png(mask, width, height) };
}
export function half(mask) {
  const small = new Uint8Array(800 * 400);
  for (let y = 0; y < 400; y++)
    for (let x = 0; x < 800; x++) small[y * 800 + x] = mask[2 * y * 1600 + 2 * x];
  return png(small, 800, 400);
}
