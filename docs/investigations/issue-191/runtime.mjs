/** Private trusted compiler for declared core/generation public exports. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import ts from 'typescript';
export const HERE = fileURLToPath(new URL('.', import.meta.url));
export const ROOT = resolve(HERE, '../../..');
export const hash = (x) => createHash('sha256').update(x).digest('hex');
const privateFiles = ['policy.ts'];
const allowed = (file) =>
  /^(packages\/(core|generation)\/src\/)[a-z0-9-/]+\.ts$/.test(file) ||
  privateFiles.some((name) => file === `docs/investigations/issue-191/${name}`);
const packageEntry = (name) =>
  name === '@ttrpg-map/core'
    ? 'packages/core/src/index.ts'
    : name === '@ttrpg-map/generation'
      ? 'packages/generation/src/index.ts'
      : null;
export async function runtimeSources() {
  for (const name of ['core', 'generation']) {
    const p = JSON.parse(await readFile(join(ROOT, `packages/${name}/package.json`), 'utf8'));
    assert.equal(p.name, `@ttrpg-map/${name}`);
    assert.equal(p.exports, './src/index.ts');
  }
  const pending = ['docs/investigations/issue-191/policy.ts'],
    sources = {};
  while (pending.length) {
    const file = pending.shift();
    if (Object.hasOwn(sources, file)) continue;
    assert(allowed(file), `Untrusted source path ${file}`);
    const actual = await realpath(join(ROOT, file));
    assert(actual.startsWith(ROOT + sep), 'Escaped source root');
    const text = await readFile(actual, 'utf8');
    sources[file] = text;
    const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    assert.equal(tree.parseDiagnostics.length, 0);
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        assert(ts.isStringLiteral(node.moduleSpecifier));
        const name = node.moduleSpecifier.text,
          entry = packageEntry(name);
        if (entry) pending.push(entry);
        else {
          assert(name.startsWith('.') && name.endsWith('.js'), `Unexpected runtime import ${name}`);
          pending.push(relative(ROOT, resolve(ROOT, dirname(file), name.replace(/\.js$/, '.ts'))));
        }
      }
      assert(
        !(ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword),
        'Dynamic import needs separate decision',
      );
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
  return Object.fromEntries(Object.entries(sources).sort(([a], [b]) => (a < b ? -1 : 1)));
}
export async function loadRuntime(snapshot) {
  const trusted = await runtimeSources();
  if (snapshot !== undefined)
    assert.deepEqual(snapshot, trusted, 'Captured source differs from trusted current closure');
  const directory = await mkdtemp(join(tmpdir(), 'issue191-public-'));
  try {
    await writeFile(join(directory, 'package.json'), '{"type":"module"}\n');
    for (const [file, source] of Object.entries(trusted)) {
      const output = file.replace(/\.ts$/, '.js'),
        parent = dirname(join(directory, output));
      let compiled = ts.transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2023,
          module: ts.ModuleKind.ESNext,
          verbatimModuleSyntax: true,
        },
      }).outputText;
      for (const name of ['core', 'generation']) {
        let target = relative(parent, join(directory, `packages/${name}/src/index.js`))
          .split(sep)
          .join('/');
        if (!target.startsWith('.')) target = './' + target;
        compiled = compiled
          .replaceAll(`'@ttrpg-map/${name}'`, `'${target}'`)
          .replaceAll(`"@ttrpg-map/${name}"`, `"${target}"`);
      }
      await mkdir(parent, { recursive: true });
      await writeFile(join(directory, output), compiled);
    }
    const policy = await import(
      pathToFileURL(join(directory, 'docs/investigations/issue-191/policy.js')).href
    );
    const generation = await import(
      pathToFileURL(join(directory, 'packages/generation/src/index.js')).href
    );
    const core = await import(pathToFileURL(join(directory, 'packages/core/src/index.js')).href);
    return { policy, generation, core, close: () => rm(directory, { recursive: true }) };
  } catch (error) {
    await rm(directory, { recursive: true });
    throw error;
  }
}
