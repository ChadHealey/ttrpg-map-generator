import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { test } from 'vitest';

import { canonicalBytes, errorLedger, evaluatePolicies, sharedAnchors } from './measure.mjs';
import { captureSources, checkpoint, verifyAuthority, verifyEvidence } from './run.mjs';
import { hash } from './runtime.mjs';
test('canonical array bytes fix float/int endianness and signed owner bytes', () => {
  assert.equal(canonicalBytes([1, -1], 'i32').toString('hex'), '01000000ffffffff');
  assert.equal(canonicalBytes([1], 'f64').toString('hex'), '000000000000f03f');
  assert.equal(canonicalBytes([-1, 1], 'u8').toString('hex'), 'ff01');
});
test('one policy exception retains its counterpart evaluation', () => {
  const visited = [];
  const rows = evaluatePolicies((p) => {
    visited.push(p);
    if (p === 'Z') throw new RangeError('declared injected extraction fault');
    return { rings: [] };
  });
  assert.deepEqual(visited, ['Z', 'H']);
  assert.equal(rows[0].error.name, 'RangeError');
  assert.deepEqual(rows[1].value, { rings: [] });
  assert(rows.every((r) => r.attempted));
});
test('shared-anchor failure returns both offending values rather than throwing away evidence', () => {
  const g = {
    WORLD_ATLAS_PREVIEW_PROFILE: { latitudeBandCount: 1, longitudeCellCount: 1 },
    WORLD_ATLAS_FULL_PROFILE: {},
    getAtlasSampleStorageIndex: (_, x, y) => y,
    getFullProfileAddressForPreview: (x, y) => ({ longitudeIndex: x, latitudeIndex: y }),
  };
  const r = sharedAnchors(
    { ticks: [1, 2], normalized: [0.1, 0.2] },
    { ticks: [1, 3], normalized: [0.1, 0.3] },
    g,
  );
  assert.equal(r.exact, false);
  assert.equal(r.checked, 2);
  assert.equal(r.mismatches, 1);
  assert.equal(r.firstMismatch.previewTick, 2);
  assert.equal(r.firstMismatch.fullTick, 3);
});
test('retained geometry exposes concrete preview bound and tight full role margins without field evaluation', async () => {
  const { reports } = await checkpoint(),
    preview = { longitudeCellCount: 512, latitudeBandCount: 256 },
    full = { longitudeCellCount: 2048, latitudeBandCount: 1024 };
  for (const r of reports) {
    assert.equal(errorLedger(r, preview, 'H').rawOneSidedBoundWithinTarget, false);
    assert.equal(errorLedger(r, full, 'H').rawOneSidedBoundWithinTarget, true);
  }
  const ordinary = errorLedger(reports[0], full, 'H');
  assert(
    ordinary.owners
      .flatMap((o) => o.roleMargins)
      .some(
        (r) =>
          r.conditionalWidthUpperSlackAfterDelta !== null &&
          r.conditionalWidthUpperSlackAfterDelta < 0,
      ),
  );
  const balanced = errorLedger(reports[4], full, 'H');
  assert(
    balanced.owners.flatMap((o) => o.roleMargins).some((r) => r.conditionalDiskSlackAfterDelta < 0),
  );
});
test('trusted authority rejects coherent source edits, changed row inputs and omitted artifact hashes before execution', async () => {
  const captured = await captureSources(),
    d = await mkdtemp(join(tmpdir(), 'issue186-authority-test-'));
  const save = async (manifest, snapshot) => {
    await writeFile(join(d, 'source-manifest.json'), JSON.stringify(manifest));
    await writeFile(
      join(d, 'source-snapshot.json.gz'),
      gzipSync(Buffer.from(JSON.stringify(snapshot))),
    );
  };
  try {
    const key = 'docs/investigations/issue-186/policy.ts',
      snapshot = {
        ...captured.snapshot,
        [key]: captured.snapshot[key] + '\nthrow new Error("must not execute");',
      },
      manifest = structuredClone(captured.manifest);
    manifest.sources[key] = hash(snapshot[key]);
    await save(manifest, snapshot);
    await assert.rejects(verifyAuthority(d), /trusted current/);
    const changed = structuredClone(captured.manifest);
    changed.checkpoint.rows[0].input.seed = 'unapproved';
    await save(changed, captured.snapshot);
    await assert.rejects(verifyAuthority(d), /trusted current/);
    await save(captured.manifest, captured.snapshot);
    await writeFile(
      join(d, 'completion.json'),
      JSON.stringify({
        complete: true,
        artifacts: {},
        sourceManifestSha256: hash(JSON.stringify(captured.manifest)),
      }),
    );
    await assert.rejects(verifyEvidence(d, { replay: false }), /artifact hashes/);
  } finally {
    await rm(d, { recursive: true });
  }
}, 30000);
