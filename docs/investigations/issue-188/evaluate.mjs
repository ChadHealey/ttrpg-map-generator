/** Retain the complete fixed component cohort, including failed construction. */
import assert from 'node:assert/strict';

import { certifyCandidate } from './certificates.mjs';
import { options } from './corpus.mjs';
import { render } from './render.mjs';

export function evaluate(buildFixture, inputs) {
  const before = structuredClone(inputs);
  const reports = inputs.map((input) => {
    try {
      const { candidate, quota } = buildFixture(input.id),
        original = structuredClone(candidate);
      const certificate = certifyCandidate(candidate, { ...options, quota });
      assert.deepEqual(candidate, original, 'Certificate preserves literal fixture');
      return { input, quota, candidate, certificate };
    } catch (error) {
      return { input, constructionError: { name: error.name, message: error.message } };
    }
  });
  assert.deepEqual(inputs, before, 'Input preservation');
  const imageResult = render(reports);
  return {
    reports,
    images: imageResult.images,
    summary: {
      total: reports.length,
      passed: reports.filter((r) => r.certificate?.ok).length,
      constructionErrors: reports.filter((r) => r.constructionError).length,
      panels: imageResult.panels,
      failures: reports.flatMap((r) =>
        (r.certificate?.failures ?? []).map((f) => ({ id: r.input.id, ...f })),
      ),
    },
  };
}
