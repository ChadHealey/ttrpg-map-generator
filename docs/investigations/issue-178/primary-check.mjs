/** Reproduce all three fixed local primary attempts; no world placement or paid islands. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { format } from 'prettier';
import ts from 'typescript';

import { png } from '../issue-164/render-comparison.mjs';
import { pointLocation, polygonArea, stitchBody } from '../issue-169/geometry.mjs';
import { certifyCandidate } from './certificates.mjs';
import { buildCoast as final } from './primary-final.mjs';
import { buildCoast as initial } from './primary-initial.mjs';
import { buildCoast as lowDisk } from './primary-low-disk.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const OUTPUT = join(HERE, 'primary-evidence');
const hash = (x) => createHash('sha256').update(x).digest('hex');
const serialize = (x) => format(JSON.stringify(x), { parser: 'json', printWidth: 100 });
const scaleCoordinates = (o, scale) =>
  Array.isArray(o)
    ? o.length === 2 && o.every((x) => typeof x === 'number')
      ? o.map((x) => x * scale)
      : o.map((x) => scaleCoordinates(x, scale))
    : o && typeof o === 'object'
      ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, scaleCoordinates(v, scale)]))
      : o;

async function sourceClosure() {
  const sources = {},
    pending = ['primary-check.mjs'];
  while (pending.length) {
    const file = pending.shift();
    if (Object.hasOwn(sources, file)) continue;
    const absolute = resolve(HERE, file);
    assert(absolute.startsWith(resolve(HERE, '..') + '/'));
    const source = await readFile(absolute, 'utf8');
    sources[file] = source;
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const imports = [];
    function visit(node) {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        imports.push(node.moduleSpecifier.text);
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0])
      )
        imports.push(node.arguments[0].text);
      ts.forEachChild(node, visit);
    }
    visit(tree);
    for (const specifier of imports.filter((s) => s.startsWith('.')))
      pending.push(relative(HERE, resolve(dirname(absolute), specifier)));
  }
  return sources;
}

async function main() {
  const mode = process.argv[2];
  assert(['--write', '--verify'].includes(mode), 'Use --write or --verify');
  const sources = await sourceClosure(),
    reports = [],
    images = {};
  for (const [revision, build] of [
    ['initial', initial],
    ['low-disk', lowDisk],
    ['final', final],
  ]) {
    for (const { ownerQuota, detachedFraction } of [
      { ownerQuota: 0.13106846473029043, detachedFraction: 0.0095 },
      { ownerQuota: 0.10494186046511626, detachedFraction: 0.0095 },
      { ownerQuota: 0.06666666666666667, detachedFraction: 0.016 },
    ]) {
      const shape = build('local-primary'),
        quota = ownerQuota * (1 - detachedFraction);
      const bodyBoundary = stitchBody(shape.interior, shape.attachments);
      const scale = Math.sqrt((4 * Math.PI * quota) / polygonArea(bodyBoundary));
      const candidate = scaleCoordinates(
        { id: 'local-primary', primary: true, ...shape, bodyBoundary, islands: [] },
        scale,
      );
      const root = certifyCandidate(candidate, { quota });
      const far = certifyCandidate(candidate, { quota, collarWidthUpperMode: 'root-and-far' });
      assert.deepEqual(
        far,
        certifyCandidate(structuredClone(candidate), {
          quota,
          collarWidthUpperMode: 'root-and-far',
        }),
      );
      if (revision === 'final') assert.equal(far.ok, true, JSON.stringify(far.failures));
      reports.push({ revision, ownerQuota, detachedFraction, quota, scale, candidate, root, far });
      if (ownerQuota === 0.13106846473029043) {
        const width = 600,
          height = 600,
          mask = new Uint8Array(width * height);
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++)
            mask[y * width + x] = Number(
              pointLocation([(x - 300) / 270, (300 - y) / 270], candidate.bodyBoundary) >= 0,
            );
        images[`${revision}.png`] = png(mask, width, height);
      }
    }
  }
  assert.deepEqual(await sourceClosure(), sources, 'Sources changed during local evidence run');
  const result = {
    scope:
      'Three fixed local bare-primary attempts at retained body areas; no paid detached islands, owner placement, world field or visual acceptance.',
    sources: Object.fromEntries(Object.entries(sources).map(([k, v]) => [k, hash(v)])),
    reports,
    imageHashes: Object.fromEntries(Object.entries(images).map(([k, v]) => [k, hash(v)])),
  };
  if (mode === '--write') {
    await mkdir(OUTPUT, { recursive: false });
    await writeFile(join(OUTPUT, 'sources.json'), await serialize(sources));
    await writeFile(join(OUTPUT, 'report.json'), await serialize(result));
    for (const [name, bytes] of Object.entries(images)) await writeFile(join(OUTPUT, name), bytes);
  } else {
    assert.deepEqual(JSON.parse(await readFile(join(OUTPUT, 'sources.json'), 'utf8')), sources);
    assert.deepEqual(JSON.parse(await readFile(join(OUTPUT, 'report.json'), 'utf8')), result);
    for (const [name, bytes] of Object.entries(images))
      assert.deepEqual(await readFile(join(OUTPUT, name)), bytes);
  }
  console.log(
    JSON.stringify({
      verified: true,
      mode,
      reports: reports.length,
      images: Object.keys(images).length,
      rows: reports.map(({ revision, ownerQuota, far }) => ({
        revision,
        ownerQuota,
        ok: far.ok,
        failures: far.failures.map((x) => x.code),
      })),
    }),
  );
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
