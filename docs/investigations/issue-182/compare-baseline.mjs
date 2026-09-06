/** Read-only comparison against the complete final180 corpus; no generation or acceptance. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const BASE = new URL('.', import.meta.url);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const load = async (path) => JSON.parse(gunzipSync(await readFile(new URL(path, BASE))));
let unchanged = 0,
  recovered = 0,
  maximumSelectedIndex = 0,
  maximumGuard = 0,
  minimumGap = Infinity;
for (let i = 1; i <= 128; i++) {
  const name = `default-${String(i).padStart(3, '0')}.json.gz`,
    before = await load(`../issue-180/evidence-final/${name}`),
    after = await load(`evidence/${name}`),
    old = before.result.construction,
    { extension, ...current } = after.result.construction;
  assert.deepEqual(after.result.probe, before.result.probe);
  assert.equal(after.result.status, 'geometry-and-placement-pass');
  assert.equal(after.repeat.equal, true);
  assert.equal(extension.totalCandidateLimit, 16);
  assert.deepEqual(
    current.receipts.filter((r) => r.templateIndex < 12),
    old.receipts,
  );
  for (const owner of old.owners)
    assert.deepEqual(
      current.owners.find((o) => o.id === owner.id),
      owner,
    );
  if (old.ok) {
    assert.deepEqual(current, old);
    assert.deepEqual(after.result.placement, before.result.placement);
    unchanged++;
  } else {
    assert.equal(before.result.status, 'construction-no-proposal');
    recovered++;
  }
  for (const r of current.receipts.filter((r) => r.ok))
    maximumSelectedIndex = Math.max(maximumSelectedIndex, r.templateIndex);
  for (const owner of current.owners) maximumGuard = Math.max(maximumGuard, owner.radius);
  minimumGap = Math.min(minimumGap, after.result.placement.minimumGap);
}
assert.equal(unchanged, 90);
assert.equal(recovered, 38);
console.log(
  JSON.stringify({
    scope: 'Exact retained additional-default comparison; no production or visual acceptance',
    unchanged,
    recovered,
    maximumSelectedIndex,
    maximumGuard,
    minimumGap,
    oldCompletionSha256: sha(
      await readFile(new URL('../issue-180/evidence-final/completion.json', BASE)),
    ),
    newCompletionSha256: sha(await readFile(new URL('evidence/completion.json', BASE))),
  }),
);
