/** Local polygon masks only. PNG encoding follows the project-owned issue-164 diagnostic. */
import { deflateSync } from 'node:zlib';

import { pointInPolygon } from '../issue-169/geometry.mjs';

export const PANEL = Object.freeze({
  width: 900,
  height: 320,
  span: 2.5,
  halfWidth: 450,
  halfHeight: 160,
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, payload) {
  const body = Buffer.concat([Buffer.from(type), payload]),
    result = Buffer.alloc(body.length + 8);
  result.writeUInt32BE(payload.length, 0);
  body.copy(result, 4);
  result.writeUInt32BE(crc32(body), body.length + 4);
  return result;
}
function png(mask, width, height) {
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
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
export function render(reports) {
  const panels = reports.filter((r) => r.input.anatomyIndex === 0 && r.input.variation === 0);
  if (panels.length !== 3) throw new Error('Exactly three central quota panels required');
  const { width, height, span, halfWidth, halfHeight } = PANEL;
  const pixels = new Uint8Array(width * height),
    half = new Uint8Array(halfWidth * halfHeight);
  for (let k = 0; k < 3; k++) {
    const polygon = panels[k].candidate?.bodyBoundary;
    if (!polygon) continue; // Construction failures remain explicit in the panel ledger.
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width / 3; x++)
        pixels[y * width + (k * width) / 3 + x] = pointInPolygon(
          [(x / (width / 3) - 0.5) * span, (0.5 - y / height) * span],
          polygon,
        )
          ? 1
          : 0;
  }
  for (let y = 0; y < halfHeight; y++)
    for (let x = 0; x < halfWidth; x++) half[y * halfWidth + x] = pixels[2 * y * width + 2 * x];
  return {
    images: {
      'panel.png': png(pixels, width, height),
      'panel-half.png': png(half, halfWidth, halfHeight),
    },
    panels: panels.map((r) => ({
      id: r.input.id,
      quota: r.input.quota,
      rendered: !!r.candidate?.bodyBoundary,
      certificateOk: r.certificate?.ok ?? false,
    })),
  };
}
