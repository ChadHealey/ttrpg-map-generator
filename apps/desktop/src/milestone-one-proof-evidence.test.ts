import {
  createMilestoneOneProofDocument,
  MILESTONE_ONE_PROOF_SEED,
  rerollMilestoneOneMarkers,
} from '@ttrpg-map/generation';
import { decodeMapworld, encodeMapworld } from '@ttrpg-map/persistence';
import { describe, expect, it } from 'vitest';

import {
  compareMilestoneOneIsolation,
  compareMilestoneOneReopen,
  createMilestoneOneProofEvidence,
} from './milestone-one-proof-evidence.js';

describe('Milestone 1 proof evidence', () => {
  it('retains the registered canonical hashes while proving the exact reroll delta', () => {
    const baselineDocument = createMilestoneOneProofDocument(MILESTONE_ONE_PROOF_SEED);
    const reroll = rerollMilestoneOneMarkers(baselineDocument);
    expect(reroll.ok).toBe(true);
    if (!reroll.ok) throw new Error(JSON.stringify(reroll.diagnostics));
    const baseline = createMilestoneOneProofEvidence(baselineDocument, 'baseline');
    const rerolled = createMilestoneOneProofEvidence(reroll.document, 'rerolled');

    expect(baseline.outline.canonicalAspectSha256).toBe(
      '8fef307d346dfa7d6a4eab9aacbdbd889b655390ce30b072206605dbfc16fb22',
    );
    expect(baseline.outline.canonicalOutputSha256).toBe(
      'b8287b05282a8d7712194941888b26d0a05d6e18c32593b6b41e4d1356bded9f',
    );
    expect(baseline.markers.canonicalAspectSha256).toBe(
      '7ab5fefbc8383fc81c02032db760f53be8561231cbdcc2a09cbf10718c4ea2a0',
    );
    expect(baseline.markers.canonicalOutputSha256).toBe(
      '9567e8f544db1038e21eebef9ad919dff2f340e2752ece54bff4cda3269ac6ef',
    );
    expect(rerolled.markers.canonicalAspectSha256).toBe(
      'ead4244f3004bf4e7cfa938ee1cb726741f1775b38f3df7ceb3b9f11c9614a64',
    );
    expect(rerolled.markers.canonicalOutputSha256).toBe(
      '3e23ee477dd93c9e45bb74a896683bb7bfd80889c9ef16d03b96cda87dd21a47',
    );
    expect(
      compareMilestoneOneIsolation(baselineDocument, reroll.document, baseline, rerolled),
    ).toMatchObject({ passed: true });
  });

  it('proves reopened accepted, package, and render evidence exactly equals rerolled', () => {
    const baseline = createMilestoneOneProofDocument(MILESTONE_ONE_PROOF_SEED);
    const reroll = rerollMilestoneOneMarkers(baseline);
    if (!reroll.ok) throw new Error(JSON.stringify(reroll.diagnostics));
    const encoded = encodeMapworld(reroll.document);
    if (!encoded.ok) throw new Error(JSON.stringify(encoded.diagnostics));
    const decoded = decodeMapworld(encoded.value);
    if (!decoded.ok) throw new Error(JSON.stringify(decoded.diagnostics));
    const rerolled = createMilestoneOneProofEvidence(reroll.document, 'rerolled');
    const reopened = createMilestoneOneProofEvidence(decoded.value, 'reopened');

    expect(
      compareMilestoneOneReopen(reroll.document, decoded.value, rerolled, reopened),
    ).toMatchObject({ passed: true });
    expect(reopened.canonicalSvgSha256).toBe(rerolled.canonicalSvgSha256);
  });
});
