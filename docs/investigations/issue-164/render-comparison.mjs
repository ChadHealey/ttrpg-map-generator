/** Reproducible diagnostic rasterization, deliberately separate from the production PNG path. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

import { format } from 'prettier';

import {
  calibrate,
  createField,
  FAMILIES,
  GAP_RAD,
  landFraction,
  REVISION,
  sampleGrid,
  spherePoint,
} from './morphology.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
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
function maskAt(grid, threshold) {
  return Uint8Array.from(grid.values, (v, i) => Number(grid.owners[i] >= 0 && v > threshold));
}
function gridHash(grid) {
  // Explicit byte order: Int32Array's native backing bytes are not portable evidence.
  const bytes = Buffer.alloc(grid.values.length * 5);
  grid.values.forEach((value, i) => {
    bytes.writeInt32BE(value, i * 5);
    bytes.writeInt8(grid.owners[i], i * 5 + 4);
  });
  return sha256(bytes);
}
function componentShares(grid, mask) {
  const visited = new Uint8Array(mask.length),
    areas = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || visited[i]) continue;
    const queue = [i];
    visited[i] = 1;
    let area = 0;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const at = queue[cursor],
        y = Math.floor(at / grid.width),
        x = at % grid.width;
      area += grid.weights[y];
      const adjacent = [
        y * grid.width + ((x + 1) % grid.width),
        y * grid.width + ((x + grid.width - 1) % grid.width),
      ];
      if (y > 0) adjacent.push(at - grid.width);
      if (y < grid.height) adjacent.push(at + grid.width);
      for (const next of adjacent)
        if (mask[next] && !visited[next]) {
          visited[next] = 1;
          queue.push(next);
        }
    }
    areas.push(area);
  }
  const total = areas.reduce((a, b) => a + b, 0);
  return areas.sort((a, b) => b - a).map((area) => Number(((100 * area) / total).toFixed(4)));
}
export function smoke(field, preview, full, threshold) {
  let seamChecks = 0,
    poleChecks = 0,
    anchorChecks = 0,
    seamLand = 0;
  for (let y = 0; y <= 200; y++) {
    const latitude = Math.PI / 2 - (y * Math.PI) / 200;
    const left = field.raw(spherePoint(-Math.PI, latitude)),
      right = field.raw(spherePoint(Math.PI, latitude));
    assert.deepEqual(left, right);
    seamChecks++;
    if (left.guarded && left.value > threshold) seamLand++;
  }
  for (const latitude of [-Math.PI / 2, Math.PI / 2]) {
    const expected = field.raw(spherePoint(0, latitude));
    for (let x = 0; x <= 360; x++) {
      assert.deepEqual(field.raw(spherePoint((x * Math.PI) / 180 - Math.PI, latitude)), expected);
      poleChecks++;
    }
  }
  const ratio = full.width / preview.width;
  for (let y = 0; y <= preview.height; y++)
    for (let x = 0; x < preview.width; x++) {
      const p = y * preview.width + x,
        f = y * ratio * full.width + x * ratio;
      assert.equal(preview.values[p], full.values[f]);
      assert.equal(preview.owners[p], full.owners[f]);
      anchorChecks++;
    }
  return { seamChecks, poleChecks, anchorChecks, seamLandAnchors: seamLand };
}
export async function inputs() {
  const sources = JSON.parse(await readFile(join(HERE, 'v2-provenance.json'), 'utf8'));
  return [
    'normal-01',
    'normal-02',
    'normal-03',
    'normal-04',
    'connected-majority',
    'fragmented-islands',
  ].map((id) => {
    const row = sources.find((source) => source.row === `milestone-2-atlas-v2-${id}`);
    return { id, seed: row.seed, controls: row.controls };
  });
}
export function render(family, input) {
  const field = createField(family, input),
    preview = sampleGrid(field, 400, 200);
  const calibration = calibrate(preview, input.controls.targetWaterCoveragePercent);
  const full = sampleGrid(field, 1600, 800),
    mask = maskAt(full, calibration.threshold);
  const image = png(mask, 1600, 800);
  const report = {
    family,
    input,
    revision: REVISION,
    calibration,
    intendedPrimaryOwners: field.primaryCount,
    previewWaterPercent: 100 * (1 - landFraction(preview, calibration.threshold)),
    fullWaterPercent: 100 * (1 - landFraction(full, calibration.threshold)),
    previewComponentLandSharesPercent: componentShares(
      preview,
      maskAt(preview, calibration.threshold),
    ),
    minimumOceanGapRad: GAP_RAD,
    geometry: smoke(field, preview, full, calibration.threshold),
    fullGridSha256: gridHash(full),
    maskSha256: sha256(mask),
    pngSha256: sha256(image),
    pngBytes: image.length,
  };
  return { image, report };
}
async function main() {
  const output = resolve(process.argv[2] ?? join(HERE, 'comparison'));
  await mkdir(output, { recursive: true });
  const reports = [];
  for (const family of FAMILIES)
    for (const input of await inputs()) {
      const first = render(family, input),
        repeat = render(family, input);
      assert.deepEqual(first.report, repeat.report);
      assert.deepEqual(first.image, repeat.image);
      await writeFile(join(output, `${family}-${input.id}.png`), first.image);
      reports.push({ ...first.report, exactRepeat: true });
      console.log(
        `${family}/${input.id}: ${first.report.calibration.status}, water=${first.report.fullWaterPercent.toFixed(3)}%, repeat equal`,
      );
    }
  const sources = {};
  for (const name of ['morphology.mjs', 'render-comparison.mjs', 'v2-provenance.json'])
    sources[name] = sha256(await readFile(join(HERE, name)));
  await writeFile(
    join(output, 'results.json'),
    await format(
      JSON.stringify(
        {
          generated: true,
          editPolicy: 'regenerate-only',
          revision: REVISION,
          renderer: 'diagnostic-rgb-v1',
          width: 1600,
          height: 800,
          sources,
          reports,
        },
        null,
        2,
      ),
      { parser: 'json', printWidth: 100 },
    ),
  );
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
