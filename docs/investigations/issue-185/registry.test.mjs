import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runMatrix } from './matrix.mjs';
import { capture, verifyEvidence } from './run.mjs';
import { hash, loadRuntime } from './runtime.mjs';

let loaded;
beforeAll(async () => {
  loaded = await loadRuntime();
});
afterAll(async () => {
  await loaded.close();
});
describe('proposed v3 typed concern registry', () => {
  it('validates the complete finite matrix and exact stream independence through public core', () => {
    const result = runMatrix(loaded.registry, loaded.core);
    expect(result.matrix).toHaveLength(48);
    expect(result.vectors).toHaveLength(6052);
    expect(new Set(result.vectors.map((v) => v.seedHex)).size).toBe(6052);
    expect(result.matrix.at(-1)).toMatchObject({ scopeCount: 3026, drawCount: 170226 });
    expect(result.vectors.every((v) => v.input.entityId === result.authority.entityId)).toBe(true);
  }, 15000);
  it('rejects unknown concern/field, ambiguous indices and owner/category bounds', () => {
    const a = loaded.registry.fixedAuthority();
    for (const concern of [
      null,
      {},
      { kind: 'other' },
      { kind: 'island', candidate: 0, 'member,owner': 0 },
      { kind: 'primaryCount', aspectName: 'worldTerrain.unregistered' },
      { kind: 'primaryCount', owner: 0 },
      { kind: 'anatomyBase', owner: '0' },
      { kind: 'anatomyBase', owner: -0 },
      { kind: 'anatomyBase', owner: 8 },
      { kind: 'island', owner: 0, candidate: 16, member: 0 },
      { kind: 'island', owner: 0, candidate: 0, member: 4 },
      { kind: 'archipelagoMember', owner: 0, candidate: 0, member: 7 },
      { kind: 'orientation', owner: 0, attempt: 64 },
    ])
      expect(() => loaded.registry.scope(a, concern)).toThrow();
    for (const count of ['4', 0, -0, 9, NaN, 1.5])
      expect(() => loaded.registry.enumerate(count, 4, 7)).toThrow();
  });
  it('fails the finite-name proof if two concerns are deliberately aliased', () => {
    const registry = {
      ...loaded.registry,
      scope: (authority) => loaded.registry.scope(authority, { kind: 'primaryCount' }),
    };
    expect(() => runMatrix(registry, loaded.core)).toThrow('Collision in full finite registry');
  });
  it('keeps real authority identity and rejects coercion, extra seed fields and false entities', () => {
    const a = loaded.registry.fixedAuthority();
    for (const invalid of [
      { ...a, worldSeed: 1 },
      { ...a, worldSeed: '01' },
      { ...a, variantRevision: -1 },
      { ...a, variantRevision: 0.5 },
      { ...a, entityId: 'owner-0' },
      { ...a, entityId: 'c6f4a17b-dfaf-4dce-9904-9a900d300da4' },
      { ...a, ownerId: 0 },
    ])
      expect(() => loaded.registry.scope(invalid, { kind: 'primaryCount' })).toThrow();
    const value = loaded.registry.scope(a, { kind: 'anatomyBase', owner: 0 }).input;
    expect(
      loaded.core.parseSeedInput({ ...value, worldSeed: value.worldSeed.toString(), owner: 0 }).ok,
    ).toBe(false);
    expect(loaded.core.parseAspectName('worldTerrain.macroElevation.owner-0').ok).toBe(false);
  });
  it('keeps candidate, category and owner concerns distinct without coupling their stream positions', () => {
    const a = loaded.registry.fixedAuthority();
    const concerns = [
      { kind: 'island', owner: 0, candidate: 0, member: 0 },
      { kind: 'island', owner: 0, candidate: 1, member: 0 },
      { kind: 'archipelagoMember', owner: 0, candidate: 0, member: 0 },
      { kind: 'island', owner: 1, candidate: 0, member: 0 },
    ];
    const first = concerns.map((c) => loaded.registry.evaluate(a, c));
    expect(new Set(first.map((r) => r.seedHex)).size).toBe(4);
    const left = loaded.core.createDeterministicRandomStream(
      loaded.registry.scope(a, concerns[0]).input,
    );
    expect(left.ok).toBe(true);
    for (let i = 0; i < 1000; i++) left.value.nextFloat64();
    expect(loaded.registry.evaluate(a, concerns[1])).toEqual(first[1]);
  });
  it('rejects coherently rehashed source injection and untrusted paths before any replay', async () => {
    const captured = await capture();
    const directory = await mkdtemp(join(tmpdir(), 'issue185-tamper-'));
    try {
      for (const file of [
        'source-manifest.json',
        'source-snapshot.json.gz',
        'vectors.json.gz',
        'matrix.json',
        'receipt.json',
      ])
        await writeFile(join(directory, file), '{}');
      const key = 'docs/investigations/issue-185/registry.ts';
      captured.snapshot[key] += '\nthrow new Error("injected source must never execute");';
      captured.manifest.sources[key] = hash(captured.snapshot[key]);
      await writeFile(join(directory, 'source-manifest.json'), JSON.stringify(captured.manifest));
      await writeFile(
        join(directory, 'source-snapshot.json.gz'),
        gzipSync(Buffer.from(JSON.stringify(captured.snapshot))),
      );
      await expect(verifyEvidence(directory)).rejects.toThrow('trusted current closure');
      const cleanManifest = (await capture()).manifest;
      cleanManifest.sources['../../outside.ts'] = 'a'.repeat(64);
      await writeFile(join(directory, 'source-manifest.json'), JSON.stringify(cleanManifest));
      await expect(verifyEvidence(directory)).rejects.toThrow('trusted current closure');
    } finally {
      await rm(directory, { recursive: true });
    }
  });
});
