/** One local chart panel from the first declared default receipt; no world rendering. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

import { png } from '../issue-164/render-comparison.mjs';
import { pointInPolygon } from '../issue-169/geometry.mjs';

const BASE = new URL('.', import.meta.url),
  row = JSON.parse(gunzipSync(await readFile(new URL('evidence/default-001.json.gz', BASE)))),
  owner = row.result.construction.owners.find((o) => o.id === 'owner-0');
assert(
  row.result.construction.receipts.some(
    (r) => r.ownerId === owner.id && r.templateIndex === 12 && r.ok,
  ),
);
const polygons = [owner.candidate.bodyBoundary, ...owner.candidate.islands.map((i) => i.polygon)],
  width = 400,
  span = 2.8,
  pixels = new Uint8Array(width * width);
for (let y = 0; y < width; y++)
  for (let x = 0; x < width; x++)
    pixels[y * width + x] = polygons.some((p) =>
      pointInPolygon([(x / width - 0.5) * span, (0.5 - y / width) * span], p),
    )
      ? 1
      : 0;
const image = png(pixels, width, width),
  target = new URL('local-diagnostics/paid-owner.png', BASE);
if (process.argv[2] === '--write') await writeFile(target, image, { flag: 'wx' });
else {
  assert.equal(process.argv[2], '--verify', 'Use --write or read-only --verify');
  assert.deepEqual(await readFile(target), image);
}
console.log(
  JSON.stringify({ localOnly: true, inputId: 'default-001', ownerId: owner.id, width, span }),
);
