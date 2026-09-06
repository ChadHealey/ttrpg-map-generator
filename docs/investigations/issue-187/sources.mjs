/** Static source capture; a manifest alone never authorizes retained code execution. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { version as prettierVersion } from 'prettier';
import ts from 'typescript';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '../../..');
export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const PREFIX = 'docs/investigations/issue-187/';
const FIXED = [
  'sources.mjs',
  'run.mjs',
  'design.md',
  'independent-design-review.md',
  'harness-plan.md',
].map((p) => PREFIX + p);
export function stageEntry(stage) {
  assert(['state-1', 'state-2'].includes(stage), 'Only two declared material states are permitted');
  return `${PREFIX}states/${stage}/layout.mjs`;
}
function imports(file, text) {
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS),
    output = [];
  assert.equal(tree.parseDiagnostics.length, 0, `Invalid source syntax: ${file}`);
  function visit(node) {
    assert(
      !(ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword),
      'Dynamic runtime imports are outside the pinned graph',
    );
    assert(!ts.isMetaProperty(node), 'Runtime import.meta needs a separately reviewed adapter');
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      const s = node.moduleSpecifier;
      assert(ts.isStringLiteral(s));
      if (!s.text.startsWith('node:')) {
        assert(
          s.text.startsWith('.') && s.text.endsWith('.mjs'),
          'Only static relative investigation imports or node builtins',
        );
        const path = posix.normalize(posix.join(posix.dirname(file), s.text));
        assert(
          path.startsWith('docs/investigations/issue-') && !path.includes('\\'),
          'Runtime dependency escaped investigation roots',
        );
        output.push({ path, start: s.getStart(tree), end: s.getEnd() });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return output;
}
export async function capture(stage) {
  const entry = stageEntry(stage),
    runtime = {},
    pending = [entry, PREFIX + 'evaluate.mjs', PREFIX + 'corpus.mjs'];
  while (pending.length) {
    const file = pending.shift();
    if (Object.hasOwn(runtime, file)) continue;
    const source = await readFile(resolve(ROOT, file), 'utf8');
    runtime[file] = source;
    for (const dependency of imports(file, source)) pending.push(dependency.path);
  }
  const snapshot = { ...runtime };
  for (const file of [...FIXED, 'package.json', 'pnpm-lock.yaml'])
    snapshot[file] = await readFile(resolve(ROOT, file), 'utf8');
  const ordered = Object.fromEntries(Object.entries(snapshot).sort(([a], [b]) => (a < b ? -1 : 1)));
  return {
    entry,
    runtime,
    snapshot: ordered,
    manifest: {
      revision: 'issue-187-local-r1',
      stage,
      entry,
      nodeVersion: process.versions.node,
      typescriptVersion: ts.version,
      prettierVersion,
      sources: Object.fromEntries(
        Object.entries(ordered).map(([path, source]) => [path, hash(source)]),
      ),
    },
  };
}
export async function loadTrustedRuntime(captured) {
  const urls = new Map(),
    visiting = new Set();
  function url(file) {
    if (urls.has(file)) return urls.get(file);
    assert(!visiting.has(file), 'Runtime graph cycle needs a separate adapter');
    visiting.add(file);
    let source = captured.runtime[file];
    assert.equal(typeof source, 'string', `Missing trusted runtime source: ${file}`);
    for (const dependency of imports(file, source).sort((a, b) => b.start - a.start))
      source =
        source.slice(0, dependency.start) +
        JSON.stringify(url(dependency.path)) +
        source.slice(dependency.end);
    const result = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
    visiting.delete(file);
    urls.set(file, result);
    return result;
  }
  const layout = await import(url(captured.entry)),
    evaluator = await import(url(PREFIX + 'evaluate.mjs')),
    corpus = await import(url(PREFIX + 'corpus.mjs'));
  return { layout, evaluator, corpus };
}
