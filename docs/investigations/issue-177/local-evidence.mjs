/** Bounded local evidence construction and immutable-source replay. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { posix } from 'node:path';

import { png } from '../issue-164/render-comparison.mjs';
import { pointInPolygon, polygonArea, stitchBody } from '../issue-169/geometry.mjs';

export const BASE = new URL('.', import.meta.url);
export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const imports = (source) => [...source.matchAll(/from ['"]([^'"]+)['"]/g)];
const relative = (path, specifier) => posix.normalize(posix.join(posix.dirname(path), specifier));

export async function captureSources(entry, overrides = {}) {
  const sources = {};
  async function visit(path) {
    if (sources[path]) return;
    const text = await readFile(new URL(overrides[path] ?? path, BASE), 'utf8');
    sources[path] = text;
    for (const match of imports(text))
      if (match[1].startsWith('.')) await visit(relative(path, match[1]));
  }
  await visit(entry);
  // Layout-only stages also certify the fitted body, without paid detached members.
  await visit('../issue-176/certificates.mjs');
  return sources;
}

export async function loadSnapshot(entry, sources) {
  const cache = new Map();
  async function url(path) {
    if (cache.has(path)) return cache.get(path);
    let source = sources[path];
    assert.equal(typeof source, 'string', `Missing frozen source ${path}`);
    for (const match of imports(source))
      if (match[1].startsWith('.'))
        source = source.replace(
          match[0],
          `from ${JSON.stringify(await url(relative(path, match[1])))}`,
        );
    const result = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
    cache.set(path, result);
    return result;
  }
  return import(await url(entry));
}

function fitLayout(split, quota) {
  let candidate = {
    id: 'local-layout',
    primary: true,
    ...split,
    islands: [],
    bodyBoundary: stitchBody(split.interior, split.attachments),
  };
  const scale = Math.sqrt((4 * Math.PI * quota) / polygonArea(candidate.bodyBoundary));
  const map = (o) =>
    Array.isArray(o)
      ? o.length === 2 && o.every((x) => typeof x === 'number')
        ? o.map((x) => x * scale)
        : o.map(map)
      : o && typeof o === 'object'
        ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, map(v)]))
        : o;
  candidate = map(candidate);
  return candidate;
}

export async function reconstruct({ kind, entry, sources, inputs }) {
  const module = await loadSnapshot(entry, sources);
  let reports, panels;
  if (kind === 'initial') {
    const report = module.constructPrimary();
    reports = [report];
    panels = [{ id: 'initial', candidate: report.candidate }];
  } else if (kind === 'layout') {
    const { certifyCandidate } = await loadSnapshot('../issue-176/certificates.mjs', sources);
    const quotas = [
      1.631407882 / (4 * Math.PI),
      0.10494186046511626 * 0.9905,
      0.06666666666666667 * 0.984,
    ];
    reports = quotas.map((quota) => {
      const candidate = fitLayout(module.buildCoast('local-layout'), quota);
      return { quota, candidate, certificate: certifyCandidate(candidate, { quota }) };
    });
    panels = [{ id: 'largest-paid-body', candidate: reports[0].candidate }];
  } else {
    reports = inputs.map((input) => ({ input, result: module.constructOwners(input) }));
    assert.deepEqual(
      reports,
      inputs.map((input) => ({ input, result: module.constructOwners(input) })),
    );
    panels = [];
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
  }
  const width = panels.length * 300,
    height = 300,
    span = 2.5,
    pixels = new Uint8Array(width * height);
  for (let k = 0; k < panels.length; k++) {
    const c = panels[k].candidate,
      polygons = [c.bodyBoundary, ...c.islands.map((i) => i.polygon)];
    for (let y = 0; y < height; y++)
      for (let x = 0; x < 300; x++)
        pixels[y * width + k * 300 + x] = polygons.some((p) =>
          pointInPolygon([(x / 300 - 0.5) * span, (0.5 - y / 300) * span], p),
        )
          ? 1
          : 0;
  }
  return { reports, panels, width, height, span, image: png(pixels, width, height) };
}
