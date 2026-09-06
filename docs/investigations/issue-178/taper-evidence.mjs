/** Immutable local taper evidence; default execution verifies without writing. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

import { format, resolveConfig } from 'prettier';

import { png } from '../issue-164/render-comparison.mjs';
import { pointInPolygon } from '../issue-169/geometry.mjs';
import { captureSources, hash, loadSnapshot } from '../issue-177/local-evidence.mjs';

const base = new URL('.', import.meta.url),
  directory = new URL('local-taper/', base);
const entries = [
  '../issue-178/taper-example.mjs',
  '../issue-178/certificates.mjs',
  '../issue-176/certificates.mjs',
];
const dependencyPaths = [
  'taper-evidence.mjs',
  '../issue-177/local-evidence.mjs',
  '../issue-164/render-comparison.mjs',
  '../issue-164/morphology.mjs',
  '../issue-169/geometry.mjs',
];
async function construct(sources) {
  const { taperExample } = await loadSnapshot(entries[0], sources),
    { certifyCandidate } = await loadSnapshot(entries[1], sources),
    { certifyCandidate: previous } = await loadSnapshot(entries[2], sources);
  const { candidate, quota } = taperExample(),
    old = previous(candidate, { quota }),
    root = certifyCandidate(candidate, { quota, collarWidthUpperMode: 'root' }),
    current = certifyCandidate(candidate, { quota, collarWidthUpperMode: 'root-and-far' });
  assert.deepEqual(root, old);
  assert.equal(current.ok, true);
  assert.equal(old.ok, false);
  const report = {
    scope: 'Complete B+P subordinate topology witness, no complete primary, islands or world claim',
    candidate,
    quota,
    old,
    root,
    current,
  };
  const width = 600,
    height = 500,
    pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      pixels[y * width + x] = pointInPolygon(
        [(x / width - 0.5) * 1.6, (0.5 - y / height) * 1.4],
        candidate.bodyBoundary,
      )
        ? 1
        : 0;
  const image = png(pixels, width, height);
  const point = (p) => `${300 + p[0] * 350},${300 - p[1] * 350}`;
  const poly = (p) => p.map(point).join(' '),
    role = current.metrics.roles[0],
    attachment = candidate.attachments[0];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="680" height="640" viewBox="0 0 680 640"><rect width="680" height="640" fill="#f3f0e5"/><g font-family="sans-serif" fill="#263832"><text x="24" y="32" font-size="22">Broad-root taper: local B + P witness</text><text x="24" y="59" font-size="15">Same geometry and quota; explicit new bound changes width and ratio only.</text><polygon points="${poly(candidate.interior)}" fill="#344c49"/><polygon points="${poly(attachment.polygon)}" fill="#d38c43"/><polyline points="${poly(attachment.root)}" stroke="#be4033" stroke-width="4"/><polyline points="${poly(attachment.collar.far)}" stroke="#296d9f" stroke-width="4"/><circle cx="${300 + attachment.collar.disk[0] * 350}" cy="${300 - attachment.collar.disk[1] * 350}" r="${(0.04 / Math.cos(current.metrics.angularRadius / 2)) * 350}" fill="none" stroke="white" stroke-width="2"/><text x="220" y="300" fill="white" font-size="20">B</text><text x="402" y="285" font-size="20">P</text><text x="24" y="515" font-size="17">Root upper ${role.widthUpperRoot.toFixed(6)} → far upper ${role.widthUpperFar.toFixed(6)} rad</text><text x="24" y="545" font-size="17">Extent upper ${role.extentUpper.toFixed(6)} rad; ratio lower ${role.extentWidthRatioLower.toFixed(6)}</text><text x="24" y="575" font-size="16">Red = R; blue = T; circle = required whole .04-rad disk.</text><text x="24" y="607" font-size="15">Old: width/ratio REJECT. New: local certificate PASS. No visual/world acceptance.</text></g></svg>\n`;
  return { report, image, svg };
}
if (process.argv.includes('--write')) {
  const sources = Object.assign(
    {},
    ...(await Promise.all(entries.map((entry) => captureSources(entry)))),
  );
  const actual = await construct(sources);
  await mkdir(directory);
  const config = await resolveConfig(new URL('taper-evidence.json', base).pathname),
    json = (value) => format(JSON.stringify(value), { ...config, parser: 'json' });
  const artifacts = {},
    files = {},
    dependencies = {};
  let i = 0;
  async function save(path, bytes) {
    await writeFile(new URL(path, directory), bytes);
    artifacts[path] = hash(bytes);
  }
  for (const [path, source] of Object.entries(sources)) {
    const name = `source-${String(i++).padStart(2, '0')}.mjs.txt`;
    files[path] = name;
    await save(name, source);
  }
  await save('report.json', await json(actual.report));
  await save('silhouette.png', actual.image);
  await save('labeled.svg', actual.svg);
  for (const path of dependencyPaths)
    dependencies[path] = hash(await readFile(new URL(path, base)));
  await writeFile(
    new URL('manifest.json', directory),
    await json({ scope: 'Immutable local taper example', sources: files, artifacts, dependencies }),
  );
  console.log('Created new local-taper evidence; existing directories are never replaced.');
} else {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
  for (const [path, expected] of Object.entries(manifest.artifacts))
    assert.equal(hash(await readFile(new URL(path, directory))), expected, path);
  for (const [path, expected] of Object.entries(manifest.dependencies))
    assert.equal(hash(await readFile(new URL(path, base))), expected, path);
  const sources = {};
  for (const [path, name] of Object.entries(manifest.sources))
    sources[path] = await readFile(new URL(name, directory), 'utf8');
  const actual = await construct(sources);
  assert.deepEqual(
    actual.report,
    JSON.parse(await readFile(new URL('report.json', directory), 'utf8')),
  );
  assert.deepEqual(actual.image, await readFile(new URL('silhouette.png', directory)));
  assert.equal(actual.svg, await readFile(new URL('labeled.svg', directory), 'utf8'));
  console.log(
    JSON.stringify({ ok: true, oldRejects: true, newPasses: true, exactReportsAndImages: true }),
  );
}
