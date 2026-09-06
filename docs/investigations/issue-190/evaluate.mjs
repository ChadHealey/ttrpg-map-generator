import assert from 'node:assert/strict';

import { polygonArea, stitchBody } from '../issue-169/geometry.mjs';
import { certifyCandidate } from '../issue-188/certificates.mjs';
import { CERTIFICATE_OPTIONS } from './corpus.mjs';
import { PANEL, render } from './render.mjs';

export function fit(split, quota) {
  const raw = {
    ...split,
    id: 'local-primary',
    primary: true,
    islands: [],
    bodyBoundary: stitchBody(split.interior, split.attachments),
  };
  const rawBodyArea =
    polygonArea(raw.interior) +
    raw.attachments.reduce((sum, role) => sum + polygonArea(role.polygon), 0);
  if (!(rawBodyArea > 0 && Number.isFinite(rawBodyArea))) throw new Error('Invalid raw body area');
  const scale = Math.sqrt((4 * Math.PI * quota) / rawBodyArea);
  const map = (o) =>
    Array.isArray(o)
      ? o.length === 2 && o.every((x) => typeof x === 'number')
        ? o.map((x) => x * scale)
        : o.map(map)
      : o && typeof o === 'object'
        ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, map(v)]))
        : o;
  return { raw, rawBodyArea, scale, candidate: map(raw) };
}
export function evaluate(buildCoast, inputs) {
  assert.equal(inputs.length, 60);
  const before = structuredClone(inputs);
  let constructorCalls = 0,
    certificateCalls = 0;
  const reports = inputs.map((input) => {
    let certificateAttempted = false;
    try {
      constructorCalls++;
      assert(constructorCalls <= 60);
      const fitted = fit(
        buildCoast('local-primary', { anatomy: input.anatomy, variation: input.variation }),
        input.quota,
      );
      certificateAttempted = true;
      certificateCalls++;
      assert(certificateCalls <= 60);
      const certificate = certifyCandidate(fitted.candidate, {
        quota: input.quota,
        ...CERTIFICATE_OPTIONS,
      });
      return { input, ...fitted, certificate, certificateAttempted };
    } catch (error) {
      return {
        input,
        error: { name: error.name, message: error.message },
        certificate: null,
        certificateAttempted,
      };
    }
  });
  assert.deepEqual(inputs, before, 'Constructor must preserve declared inputs');
  const { images, panels } = render(reports);
  return {
    reports,
    images,
    summary: {
      scope: '60 local body-only cases, not 60 distinct shapes or complete detached owners',
      total: reports.length,
      constructorCalls,
      certificateCalls,
      passed: reports.filter((r) => r.certificate?.ok).length,
      constructionErrors: reports.filter((r) => r.error).length,
      panel: PANEL,
      panels,
      options: CERTIFICATE_OPTIONS,
      failures: reports
        .filter((r) => !r.certificate?.ok)
        .map((r) => ({
          id: r.input.id,
          error: r.error ?? null,
          failures: r.certificate?.failures ?? [],
        })),
    },
  };
}
