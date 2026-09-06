/** Private compilation adapter: the registry consumes only core's declared public entry point. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import ts from 'typescript';

export const HERE = fileURLToPath(new URL('.', import.meta.url));
export const ROOT = resolve(HERE, '../../..');
export const hash = (value) => createHash('sha256').update(value).digest('hex');
export async function runtimeSources() {
  const publicPackage = JSON.parse(
    await readFile(join(ROOT, 'packages/core/package.json'), 'utf8'),
  );
  assert.equal(publicPackage.name, '@ttrpg-map/core', 'Declared core package name changed');
  assert.equal(publicPackage.exports, './src/index.ts', 'Declared core public entry changed');
  const sources = {};
  const pending = ['packages/core/src/index.ts', 'docs/investigations/issue-185/registry.ts'];
  while (pending.length) {
    const file = pending.shift();
    if (Object.hasOwn(sources, file)) continue;
    assert(
      file.startsWith('packages/core/src/') || file === 'docs/investigations/issue-185/registry.ts',
    );
    const text = await readFile(join(ROOT, file), 'utf8');
    sources[file] = text;
    const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    assert.equal(tree.parseDiagnostics.length, 0);
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        assert(ts.isStringLiteral(node.moduleSpecifier));
        const name = node.moduleSpecifier.text;
        if (name === '@ttrpg-map/core') pending.push('packages/core/src/index.ts');
        else {
          assert(
            name.startsWith('.') && name.endsWith('.js'),
            `Unexpected core runtime import: ${name}`,
          );
          pending.push(relative(ROOT, resolve(ROOT, dirname(file), name.replace(/\.js$/, '.ts'))));
        }
      }
      assert(
        !(ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword),
        'Dynamic core import needs a separate adapter decision',
      );
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
  return Object.fromEntries(Object.entries(sources).sort(([a], [b]) => (a < b ? -1 : 1)));
}
export async function loadRuntime(sources) {
  sources ??= await runtimeSources();
  const directory = await mkdtemp(join(tmpdir(), 'issue185-core-public-'));
  try {
    await writeFile(join(directory, 'package.json'), '{"type":"module"}\n');
    for (const [file, source] of Object.entries(sources)) {
      const output = file.startsWith('packages/core/src/')
        ? `core/${file.slice('packages/core/src/'.length).replace(/\.ts$/, '.js')}`
        : 'registry.js';
      const compiled = ts
        .transpileModule(source, {
          compilerOptions: {
            target: ts.ScriptTarget.ES2023,
            module: ts.ModuleKind.ESNext,
            verbatimModuleSyntax: true,
          },
        })
        .outputText.replaceAll("'@ttrpg-map/core'", "'./core/index.js'");
      await mkdir(dirname(join(directory, output)), { recursive: true });
      await writeFile(join(directory, output), compiled);
    }
    const registry = await import(pathToFileURL(join(directory, 'registry.js')).href);
    const core = await import(pathToFileURL(join(directory, 'core/index.js')).href);
    return { registry, core, close: () => rm(directory, { recursive: true }) };
  } catch (error) {
    await rm(directory, { recursive: true });
    throw error;
  }
}
