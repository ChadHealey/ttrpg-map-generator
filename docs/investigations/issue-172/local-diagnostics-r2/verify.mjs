/** Read-only local evidence reconstruction. Never writes or replaces retained artifacts. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { png } from '../../issue-164/render-comparison.mjs';
import { pointInPolygon, polygonArea, stitchBody } from '../../issue-169/geometry.mjs';

const HERE = new URL('.', import.meta.url);
const ROOT = new URL('../', HERE);
export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function reconstruct(stage) {
  const modules = new Map();
  async function sourceURL(path) {
    if (modules.has(path)) return modules.get(path);
    let source = await readFile(new URL(stage.sources[path], HERE), 'utf8');
    const imports = [...source.matchAll(/from ['"]([^'"]+)['"]/g)];
    for (const match of imports) {
      const specifier = match[1];
      if (!specifier.startsWith('.')) continue;
      const resolved = new URL(specifier, new URL(path, ROOT));
      const relative = [...Object.keys(stage.sources)].find(
        (p) => new URL(p, ROOT).href === resolved.href,
      );
      const target = relative ? await sourceURL(relative) : resolved.href;
      source = source.replace(match[0], `from ${JSON.stringify(target)}`);
    }
    const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
    modules.set(path, url);
    return url;
  }
  const module = await import(await sourceURL(stage.entry));
  if (stage.kind === 'raw-layout') {
    const raw = { id: 'a', primary: true, ...module.buildCoast('a'), islands: [] };
    raw.bodyBoundary = stitchBody(raw.interior, raw.attachments);
    const { certifyCandidate } = await import(await sourceURL('certificates.mjs'));
    const reports = [0.13106846473029043, 0.10494186046511626, 0.06666666666666667].map((quota) => {
      const scale = Math.sqrt((4 * Math.PI * quota) / polygonArea(raw.bodyBoundary));
      const map = (o) =>
        Array.isArray(o)
          ? o.length === 2 && o.every((x) => typeof x === 'number')
            ? o.map((x) => x * scale)
            : o.map(map)
          : o && typeof o === 'object'
            ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, map(v)]))
            : o;
      const candidate = map(raw);
      return { quota, candidate, certificate: certifyCandidate(candidate, { quota }) };
    });
    const width = 400,
      height = 400,
      span = 2,
      pixels = new Uint8Array(width * height);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        pixels[y * width + x] = pointInPolygon(
          [(x / width - 0.5) * span, (0.5 - y / height) * span],
          raw.bodyBoundary,
        )
          ? 1
          : 0;
    return { reports, image: png(pixels, width, height), width, height, span };
  }
  const inputs = JSON.parse(await readFile(new URL('inputs.json', HERE), 'utf8'));
  const reports = inputs.map((input) => ({ input, result: module.constructOwners(input) }));
  assert.deepEqual(
    reports,
    inputs.map((input) => ({ input, result: module.constructOwners(input) })),
  );
  const panels = [];
  for (const { input, result } of reports.slice(0, 4))
    for (const owner of result.owners.filter((o) => o.primary))
      if (!panels.some((p) => p.layoutIndex === owner.candidate.layoutIndex))
        panels.push({
          inputId: input.id,
          ownerId: owner.id,
          layoutIndex: owner.candidate.layoutIndex,
          quota: owner.quota,
          guardRadius: owner.radius,
          candidate: owner.candidate,
        });
  const width = panels.length * 300,
    height = 300,
    span = 2.4,
    pixels = new Uint8Array(width * height);
  for (let k = 0; k < panels.length; k++) {
    const candidate = panels[k].candidate,
      polygons = [candidate.bodyBoundary, ...candidate.islands.map((i) => i.polygon)];
    for (let y = 0; y < height; y++)
      for (let x = 0; x < 300; x++)
        pixels[y * width + k * 300 + x] = polygons.some((p) =>
          pointInPolygon([(x / 300 - 0.5) * span, (0.5 - y / 300) * span], p),
        )
          ? 1
          : 0;
  }
  return { reports, panels, image: png(pixels, width, height), width, height, span };
}

export async function verify() {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', HERE), 'utf8'));
  for (const [path, expected] of Object.entries(manifest.artifacts))
    assert.equal(hash(await readFile(new URL(path, HERE))), expected, path);
  for (const [path, expected] of Object.entries(manifest.dependencies))
    assert.equal(hash(await readFile(new URL(path, ROOT))), expected, path);
  for (const stage of manifest.stages) {
    const actual = await reconstruct(stage);
    const retained = JSON.parse(await readFile(new URL(stage.report, HERE), 'utf8'));
    assert.deepEqual(JSON.parse(JSON.stringify(actual.reports)), retained.reports, stage.report);
    if (stage.image)
      assert.deepEqual(actual.image, await readFile(new URL(stage.image, HERE)), stage.image);
    if (stage.panels)
      assert.deepEqual(JSON.parse(JSON.stringify(actual.panels)), retained.panels, stage.report);
  }
  return {
    ok: true,
    stageCount: manifest.stages.length,
    reportCount: manifest.stages.reduce((count, s) => count + (s.kind === 'raw-layout' ? 3 : 6), 0),
  };
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  console.log(JSON.stringify(await verify()));
