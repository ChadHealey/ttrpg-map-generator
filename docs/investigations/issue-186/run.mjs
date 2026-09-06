/** One manifest-first six-row pass and one guarded read-only computational replay. */
import assert from 'node:assert/strict';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

import { format, version as prettierVersion } from 'prettier';
import ts from 'typescript';

import { evaluateProfile, sharedAnchors } from './measure.mjs';
import { hash, HERE, loadRuntime, ROOT, runtimeSources } from './runtime.mjs';
import { evaluateSynthetics } from './synthetics.mjs';
export const IDS = [
  'normal-01',
  'normal-02',
  'normal-03',
  'normal-04',
  'connected-majority',
  'fragmented-islands',
];
const CHECKPOINT = 'docs/investigations/issue-184/comparison-r1';
const PINS = {
  'manifest.json': 'e84aced071922f04e360a52e7f3bb97fb824d007cb27d619e521791217623aa4',
  'results.json': '5de2b6cc06b690b8925d7b5b19c3f1fac2aeb7f1c106a136eec2409f8832a6ae',
};
const FIELD_FILES = ['field.mjs', 'geometry.mjs', 'placement.mjs'].map(
  (x) => `docs/investigations/issue-169/${x}`,
);
const FIXED = [
  'runtime.mjs',
  'measure.mjs',
  'diagnostics.mjs',
  'run.mjs',
  'synthetics.mjs',
  'policy.md',
  'error-budget.md',
  'tsconfig.json',
]
  .map((x) => `docs/investigations/issue-186/${x}`)
  .concat(FIELD_FILES, [
    'packages/core/package.json',
    'packages/generation/package.json',
    'package.json',
    'pnpm-lock.yaml',
    'docs/investigations/issue-181/production-contract.md',
    'docs/investigations/issue-181/child-plan.md',
  ]);
const json = (value) => format(JSON.stringify(value), { parser: 'json', printWidth: 100 });
export async function checkpoint() {
  const bytes = {};
  for (const [file, pin] of Object.entries(PINS)) {
    bytes[file] = await readFile(join(ROOT, CHECKPOINT, file));
    assert.equal(hash(bytes[file]), pin, `Frozen checkpoint ${file} changed`);
  }
  const manifest = JSON.parse(bytes['manifest.json']),
    results = JSON.parse(bytes['results.json']);
  assert.equal(manifest.revision, 'issue-184-world-r1');
  assert.equal(results.revision, manifest.revision);
  assert.deepEqual(results.sources, manifest.sources);
  const reports = results.reports.slice(0, 6);
  assert.deepEqual(
    reports.map((r) => r.input.id),
    IDS,
  );
  const references = [];
  for (const r of reports) {
    const bytes = await readFile(join(ROOT, CHECKPOINT, `${r.input.id}.json`));
    assert.deepEqual(JSON.parse(bytes), r);
    assert(r.numericEligible && r.construction.ok && r.placement.ok && r.exactRepeat);
    references.push({
      path: `${CHECKPOINT}/${r.input.id}.json`,
      sha256: hash(bytes),
      input: r.input,
    });
  }
  for (const file of FIELD_FILES) {
    assert.equal(
      hash(await readFile(join(ROOT, file))),
      manifest.sources[`../issue-169/${file.split('/').at(-1)}`],
      `Frozen evaluator ${file} changed`,
    );
  }
  return { reports, reference: { directory: CHECKPOINT, pins: PINS, rows: references } };
}
export async function captureSources() {
  const frozen = await checkpoint(),
    runtime = await runtimeSources(),
    snapshot = { ...runtime };
  for (const file of FIXED) snapshot[file] = await readFile(join(ROOT, file), 'utf8');
  const ordered = Object.fromEntries(Object.entries(snapshot).sort(([a], [b]) => (a < b ? -1 : 1)));
  return {
    runtime,
    snapshot: ordered,
    manifest: {
      revision: 'issue-186-D1-r1',
      checkpoint: frozen.reference,
      nodeVersion: process.versions.node,
      typescriptVersion: ts.version,
      prettierVersion,
      sources: Object.fromEntries(
        Object.entries(ordered).map(([file, text]) => [file, hash(text)]),
      ),
      budget: {
        rows: 6,
        profiles: 2,
        policies: 2,
        synthetics: 8,
        fieldSamples: 6 * (130562 + 2095106),
        replayPasses: 1,
        diagnosticPanels: 0,
      },
    },
  };
}
export async function verifyAuthority(directory) {
  const trusted = await captureSources(),
    manifest = JSON.parse(await readFile(join(directory, 'source-manifest.json'))),
    snapshot = JSON.parse(gunzipSync(await readFile(join(directory, 'source-snapshot.json.gz'))));
  assert.deepEqual(
    manifest,
    trusted.manifest,
    'Manifest differs from trusted current/checkpoint authority',
  );
  assert.deepEqual(snapshot, trusted.snapshot, 'Snapshot differs from trusted current closure');
  return trusted;
}
async function evaluate(captured, visit) {
  const loaded = await loadRuntime(captured.runtime);
  try {
    const checked = await checkpoint();
    const { createPlacedField } = await import(pathToFileURL(join(ROOT, FIELD_FILES[0])).href);
    const geometry = await import(pathToFileURL(join(ROOT, FIELD_FILES[1])).href);
    const synthetics = await evaluateSynthetics(loaded, hash);
    await visit('synthetics.json', await json(synthetics));
    const summaries = [];
    for (const report of checked.reports) {
      const field = createPlacedField(report.placement.owners, report.input);
      const values = [];
      for (const profile of [
        loaded.generation.WORLD_ATLAS_PREVIEW_PROFILE,
        loaded.generation.WORLD_ATLAS_FULL_PROFILE,
      ]) {
        try {
          values.push(await evaluateProfile(report, profile, loaded, field, geometry));
        } catch (error) {
          values.push({
            summary: {
              input: report.input,
              profileId: profile.profileId,
              status: 'sampling-or-field-boundary-exception',
              error: { name: error.name, message: error.message },
              policies: ['Z', 'H'].map((policy) => ({
                policy,
                proposalEligible: false,
                attempted: false,
                extractionStatus: 'not-attempted',
                failures: ['sampling-or-field-boundary-exception'],
              })),
            },
            rings: [],
            samples: null,
          });
        }
      }
      let shared = { exact: false, reason: 'incomplete-profile' };
      if (values.every((v) => v.samples))
        shared = sharedAnchors(values[0].samples, values[1].samples, loaded.generation);
      for (const value of values) {
        const short = value.summary.profileId === 'world-atlas-preview-v1' ? 'preview' : 'full',
          key = `${report.input.id}-${short}`;
        value.summary.sharedAnchors = shared;
        if (!shared.exact)
          for (const policy of value.summary.policies)
            policy.failures.push('shared-anchor-mismatch-or-incomplete');
        summaries.push(value.summary);
        await visit(`${key}.json`, await json(value.summary));
        await visit(`${key}-rings.json.gz`, gzipSync(Buffer.from(JSON.stringify(value.rings))));
      }
      console.log(
        JSON.stringify({
          completed: report.input.id,
          profiles: values.map((v) => ({
            profile: v.summary.profileId,
            status: v.summary.status ?? 'evaluated',
            policyFailures: v.summary.policies.map((p) => ({
              policy: p.policy,
              failures: p.failures,
            })),
          })),
        }),
      );
    }
    const result = {
      revision: 'issue-186-D1-r1',
      rows: 6,
      profiles: 2,
      plannedPolicyEvaluations: 24,
      policyEvaluations: summaries.reduce(
        (n, s) => n + s.policies.filter((p) => p.attempted).length,
        0,
      ),
      selectedProposal: null,
      disposition:
        'No policy selected: extracted-role certification is not established within this bounded adapter contract.',
      cases: summaries.map((s) => ({
        id: s.input.id,
        profile: s.profileId,
        zeroCount: s.zeroCount ?? null,
        coverage: s.classification ?? null,
        shared: s.sharedAnchors,
        policies: s.policies.map((p) => ({
          policy: p.policy,
          status: p.extractionStatus ?? 'evaluation-exception',
          failures: p.failures,
          proposalEligible: false,
        })),
      })),
    };
    await visit('decision.json', await json(result));
    return result;
  } finally {
    await loaded.close();
  }
}
export async function runEvidence(directory) {
  const captured = await verifyAuthority(directory);
  assert.deepEqual((await readdir(directory)).sort(), [
    'source-manifest.json',
    'source-snapshot.json.gz',
  ]);
  const hashes = {};
  await evaluate(captured, async (name, bytes) => {
    await writeFile(join(directory, name), bytes, { flag: 'wx' });
    hashes[name] = hash(bytes);
  });
  assert.deepEqual(
    (await captureSources()).manifest,
    captured.manifest,
    'Sources changed during run',
  );
  await writeFile(
    join(directory, 'completion.json'),
    await json({
      complete: true,
      artifacts: hashes,
      sourceManifestSha256: hash(await readFile(join(directory, 'source-manifest.json'))),
    }),
    { flag: 'wx' },
  );
}
const artifacts = () => [
  'synthetics.json',
  'decision.json',
  ...IDS.flatMap((id) =>
    ['preview', 'full'].flatMap((p) => [`${id}-${p}.json`, `${id}-${p}-rings.json.gz`]),
  ),
];
export async function verifyEvidence(directory, { replay = true } = {}) {
  const captured = await verifyAuthority(directory),
    completion = JSON.parse(await readFile(join(directory, 'completion.json')));
  assert.equal(completion.complete, true);
  assert.equal(
    completion.sourceManifestSha256,
    hash(await readFile(join(directory, 'source-manifest.json'))),
  );
  assert.deepEqual(
    Object.keys(completion.artifacts).sort(),
    artifacts().sort(),
    'Missing/extra artifact hashes',
  );
  assert.deepEqual(
    (await readdir(directory)).sort(),
    [...artifacts(), 'completion.json', 'source-manifest.json', 'source-snapshot.json.gz'].sort(),
  );
  for (const [file, digest] of Object.entries(completion.artifacts))
    assert.equal(hash(await readFile(join(directory, file))), digest, file);
  if (replay)
    await evaluate(captured, async (name, bytes) =>
      assert.equal(hash(bytes), completion.artifacts[name], `Replay differs: ${name}`),
    );
  assert.deepEqual((await captureSources()).manifest, captured.manifest);
  return {
    verified: true,
    replay,
    rows: 6,
    profiles: 2,
    plannedPolicyEvaluations: 24,
    policyEvaluations: JSON.parse(await readFile(join(directory, 'decision.json')))
      .policyEvaluations,
    synthetics: 8,
    sources: Object.keys(captured.manifest.sources).length,
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2],
    directory = join(HERE, 'evidence-r1');
  assert(
    ['--prepare', '--run', '--verify', '--hashes-only'].includes(mode),
    'Use --prepare/--run/--verify/--hashes-only',
  );
  if (mode === '--prepare') {
    const captured = await captureSources();
    await mkdir(directory);
    await writeFile(join(directory, 'source-manifest.json'), await json(captured.manifest), {
      flag: 'wx',
    });
    await writeFile(
      join(directory, 'source-snapshot.json.gz'),
      gzipSync(Buffer.from(JSON.stringify(captured.snapshot))),
      { flag: 'wx' },
    );
    console.log(
      JSON.stringify({
        prepared: true,
        sources: Object.keys(captured.snapshot).length,
        budget: captured.manifest.budget,
      }),
    );
  } else if (mode === '--run') await runEvidence(directory);
  else
    console.log(JSON.stringify(await verifyEvidence(directory, { replay: mode === '--verify' })));
}
