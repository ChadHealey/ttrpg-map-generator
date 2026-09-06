import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { stream } from '../issue-164/morphology.mjs';
import { polygonArea } from '../issue-169/geometry.mjs';
import { certifyCandidate } from '../issue-178/certificates.mjs';
import {
  constructOwners as oldOwners,
  constructTemplate as oldTemplate,
} from '../issue-179/templates-r2.mjs';
import { checkConstruction } from '../issue-180/audit-final.mjs';
import { corpus, DEFAULT_CONTROLS } from '../issue-180/corpus.mjs';
import {
  CERTIFICATE_OPTIONS,
  constructOwners,
  constructTemplate,
  controlRecipe,
  TEMPLATE_LIMIT,
} from './templates.mjs';

describe('issue-182 appended large-primary fallback', () => {
  it('preserves all six retained constructions including failed-attempt receipts exactly', async () => {
    const inputs = JSON.parse(
      await readFile(new URL('../issue-179/local-diagnostics/inputs.json', import.meta.url)),
    );
    expect(inputs).toHaveLength(6);
    for (const input of inputs) {
      const { extension, ...result } = constructOwners(input);
      expect(result).toEqual(oldOwners(input));
      expect(extension).toEqual({
        revision: 'issue-182-large-primary-r1',
        frozenCandidateCount: 12,
        fallbackCandidateCount: 4,
        totalCandidateLimit: 16,
      });
    }
  });

  it('delegates every original candidate without changing its geometry, streams or error', () => {
    const base = {
      quota: 0.13106846473029043,
      recipe: controlRecipe(DEFAULT_CONTROLS),
      seed: '1',
    };
    for (let templateIndex = 0; templateIndex < 12; templateIndex++) {
      const input = { ...base, templateIndex };
      let old;
      try {
        old = oldTemplate(input);
      } catch (error) {
        expect(() => constructTemplate(input)).toThrow(error.message);
        continue;
      }
      expect(constructTemplate(input)).toEqual(old);
    }
  });

  it('recovers an originally exhausted owner after all twelve attempts and pays each category', () => {
    const input = corpus()[0].input,
      before = structuredClone(input),
      previous = oldOwners(input),
      result = constructOwners(input);
    expect(previous.ok).toBe(false);
    expect(result.ok).toBe(true);
    expect(input).toEqual(before);
    const failed = previous.receipts.filter((r) => r.ownerId === 'owner-0');
    expect(failed).toHaveLength(12);
    expect(result.receipts.filter((r) => r.ownerId === 'owner-0').slice(0, 12)).toEqual(failed);
    expect(result.receipts.find((r) => r.ownerId === 'owner-0' && r.ok).templateIndex).toBe(12);
    expect(
      checkConstruction(input, result, {
        stream,
        polygonArea,
        certifyCandidate,
        CERTIFICATE_OPTIONS,
        TEMPLATE_LIMIT,
      }),
    ).toEqual([]);
    const owner = result.owners[0];
    expect(owner.quota).toBe(0.17451657458563533);
    expect(owner.certificate.metrics.bodyArea).toBeCloseTo(owner.quota * 0.9905, 14);
    expect(owner.candidate.islands.filter((i) => i.kind === 'island')).toHaveLength(2);
    expect(owner.candidate.islands.filter((i) => i.kind === 'archipelago')).toHaveLength(2);
    expect(owner.candidate.siteReceipts.every((r) => r.attempt <= 24)).toBe(true);
    expect(owner.certificate.metrics.vertexCount).toBeLessThanOrEqual(256);
  });

  it('retains explicit exhaustion at sixteen on an unsupported cap without changing its quota', () => {
    const controls = {
      ...DEFAULT_CONTROLS,
      continentCountIntent: 1,
      targetWaterCoveragePercent: 45,
    };
    const result = constructOwners({ seed: '1', controls });
    expect(result.ok).toBe(false);
    expect(result.receipts.map((r) => r.templateIndex)).toEqual(
      Array.from({ length: 16 }, (_, i) => i),
    );
    expect(result.failures).toEqual([
      { code: 'template-budget-exhausted', ownerId: 'owner-0', quota: 0.55, candidateCount: 16 },
    ]);
  });

  it('keeps all four bounded fallbacks deterministic and pays independent abundance zeros', () => {
    for (const patch of [
      {},
      { islandAbundancePercent: 0 },
      { archipelagoAbundancePercent: 0 },
      { islandAbundancePercent: 0, archipelagoAbundancePercent: 0 },
    ]) {
      const recipe = controlRecipe({ ...DEFAULT_CONTROLS, ...patch }),
        quota = 0.17451657458563533;
      for (let templateIndex = 12; templateIndex < 16; templateIndex++) {
        const args = { quota, recipe, seed: '180000000000000001', templateIndex },
          candidate = constructTemplate(args),
          certificate = certifyCandidate(candidate, { quota, ...CERTIFICATE_OPTIONS });
        expect(constructTemplate(args)).toEqual(candidate);
        expect(certificate.failures).toEqual([]);
        expect(certificate.metrics.bodyArea).toBeCloseTo(
          quota * (1 - recipe.islandShare - recipe.archipelagoShare),
          14,
        );
        for (const [kind, share, count] of [
          ['island', recipe.islandShare, recipe.islandCount],
          ['archipelago', recipe.archipelagoShare, recipe.archipelagoCount],
        ]) {
          const members = candidate.islands.filter((p) => p.kind === kind);
          expect(members).toHaveLength(count);
          expect(
            members.reduce((s, p) => s + polygonArea(p.polygon), 0) / (4 * Math.PI),
          ).toBeCloseTo(quota * share, 14);
        }
      }
    }
  });

  it('rejects invalid fallback inputs and never wraps candidate17 back to the first recipe', () => {
    const base = {
      quota: 0.17451657458563533,
      recipe: controlRecipe(DEFAULT_CONTROLS),
      seed: '1',
      templateIndex: 12,
    };
    for (const patch of [
      { templateIndex: 16 },
      { templateIndex: -1 },
      { templateIndex: 12.5 },
      { seed: '' },
      { seed: 1 },
      { primary: false },
      { quota: NaN },
    ])
      expect(() => constructTemplate({ ...base, ...patch })).toThrow();
  });
});
