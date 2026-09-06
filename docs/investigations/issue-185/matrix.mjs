/** Fixed 48-row scope matrix. Hashing here records evidence; it never supplies randomness. */
import assert from 'node:assert/strict';

import { hash } from './runtime.mjs';

const ascii = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export function runMatrix(registry, core) {
  const rows = [],
    vectors = [];
  const reference = new Map();
  for (const variantRevision of [0, 1]) {
    const authority = registry.fixedAuthority(variantRevision);
    const maximum = registry.enumerate(8, 4, 7);
    const keys = maximum.map((concern) => registry.scope(authority, concern).input.aspectName);
    assert.equal(new Set(keys).size, maximum.length, 'Collision in full finite registry');
    assert.equal(maximum.length, 3026, 'Full registry inventory');
    const values = new Map();
    for (const concern of maximum) {
      const result = registry.evaluate(authority, concern);
      const name = result.input.aspectName;
      const vector = {
        concern,
        ...result,
        values: undefined,
        draws: result.values.length,
        firstValues: result.values.slice(0, 4),
        outputSha256: hash(JSON.stringify(result.values)),
      };
      delete vector.values;
      values.set(name, vector);
      vectors.push(vector);
    }
    reference.set(variantRevision, values);
    for (const ownerCount of [1, 4, 8])
      for (const islandCount of [0, 4])
        for (const archipelagoCount of [0, 7])
          for (const order of ['forward', 'reverse']) {
            const concerns = registry.enumerate(ownerCount, islandCount, archipelagoCount);
            if (order === 'reverse') concerns.reverse();
            const records = concerns
              .map((concern) => {
                const result = registry.evaluate(authority, concern);
                const expected = values.get(result.input.aspectName);
                assert(expected, 'Matrix scope absent from full registry');
                const outputSha256 = hash(JSON.stringify(result.values));
                assert.equal(
                  result.seedHex,
                  expected.seedHex,
                  'Scope shifted after reordering/count/category change',
                );
                assert.equal(
                  outputSha256,
                  expected.outputSha256,
                  'Stream shifted after reordering/count/category change',
                );
                return {
                  aspectName: result.input.aspectName,
                  seedHex: result.seedHex,
                  outputSha256,
                  draws: result.values.length,
                };
              })
              .sort((a, b) => ascii(a.aspectName, b.aspectName));
            rows.push({
              ownerCount,
              islandCount,
              archipelagoCount,
              order,
              variantRevision,
              scopeCount: records.length,
              drawCount: records.reduce((sum, r) => sum + r.draws, 0),
              canonicalScopeOutputSha256: hash(JSON.stringify(records)),
            });
          }
  }
  for (const [name, first] of reference.get(0)) {
    const second = reference.get(1).get(name);
    assert.notEqual(first.seedHex, second.seedHex, 'Reroll did not change the declared scope seed');
    assert.notEqual(
      first.outputSha256,
      second.outputSha256,
      'Reroll did not change this finite observed stream',
    );
  }
  for (let i = 0; i < rows.length; i += 2)
    assert.equal(
      rows[i].canonicalScopeOutputSha256,
      rows[i + 1].canonicalScopeOutputSha256,
      'Reorder mismatch',
    );
  const authority = registry.fixedAuthority();
  const sibling = core.parseSeedInput({
    seedDerivationVersion: 1,
    deterministicStreamVersion: 1,
    seedScope: 'map/entity',
    ...authority,
    generatorId: 'worldSurface.landWaterClassification',
    generatorVersion: 1,
    aspectName: 'worldSurface.landWaterClassification',
  });
  assert(sibling.ok);
  const siblingBefore = core.deriveSeed(sibling.value);
  assert(siblingBefore.ok);
  // The macro reroll has no mutation capability over the separately owned classification revision.
  registry.evaluate(registry.fixedAuthority(1), { kind: 'primaryCount' });
  assert.deepEqual(core.deriveSeed(sibling.value), siblingBefore);
  return {
    registryVersion: registry.REGISTRY_VERSION,
    authority,
    matrix: rows,
    vectors: vectors.sort(
      (a, b) =>
        a.input.variantRevision - b.input.variantRevision ||
        ascii(a.input.aspectName, b.input.aspectName),
    ),
    siblingSentinel: {
      input: { ...sibling.value, worldSeed: sibling.value.worldSeed.toString(10) },
      seedHex: siblingBefore.value.hex,
    },
    claim:
      'Exact finite stream/name independence; no geometry, placement, visual, cross-platform or production adoption claim.',
  };
}
