/** Pure prerequisite-boundary tests; these do not construct or import second-state geometry. */
import { expect, it } from 'vitest';

import { hash } from './sources.mjs';
import { validatePrerequisites } from './stage2.mjs';

function fixture() {
  const texts = {
    guard: 'fixed independent second-state guard source',
    design: 'complete second literal design',
    review: 'independent literal design clearance',
    diagnosis: 'first state rejected for the opposing pointed mouth',
    priorReview: 'independent first-state R3 rejection',
    priorManifest: JSON.stringify({ stage: 'state-1' }),
    priorReceipt: JSON.stringify({ stage: 'state-1', complete: true, cases: 60 }),
    priorSummary: JSON.stringify({ total: 60 }),
  };
  texts.authorization = JSON.stringify({
    stage: 'state-2',
    predecessor: 'state-1',
    predecessorDisposition: 'rejected-local-R3',
    assistantDesignReview: 'cleared-for-fixed-60-case-local-experiment',
    hashes: Object.fromEntries(Object.entries(texts).map(([key, value]) => [key, hash(value)])),
  });
  return texts;
}
it('requires the complete predecessor, rejection, design and review hash declaration', () => {
  expect(validatePrerequisites(fixture())).toMatchObject({
    stage: 'state-2',
    predecessor: 'state-1',
  });
  for (const key of ['priorReceipt', 'diagnosis', 'review', 'design', 'authorization']) {
    const input = fixture();
    delete input[key];
    expect(() => validatePrerequisites(input)).toThrow('Complete prerequisite inventory');
  }
});
it('rejects an incomplete or different predecessor even when its hash is updated', () => {
  for (const receipt of [
    { stage: 'state-1', complete: false, cases: 60 },
    { stage: 'state-2', complete: true, cases: 60 },
    { stage: 'state-1', complete: true, cases: 59 },
  ]) {
    const texts = fixture();
    texts.priorReceipt = JSON.stringify(receipt);
    const declaration = JSON.parse(texts.authorization);
    declaration.hashes.priorReceipt = hash(texts.priorReceipt);
    texts.authorization = JSON.stringify(declaration);
    expect(() => validatePrerequisites(texts)).toThrow();
  }
});
it('rejects changed source/design/review/diagnosis bytes against a stale clearance declaration', () => {
  for (const key of [
    'guard',
    'design',
    'review',
    'diagnosis',
    'priorReview',
    'priorManifest',
    'priorSummary',
  ]) {
    const texts = fixture();
    texts[key] += '\nchanged';
    expect(() => validatePrerequisites(texts)).toThrow();
  }
});
it('rejects unknown, absent or substituted authorization fields and a different outcome', () => {
  for (const change of [
    (o) => {
      o.extra = true;
    },
    (o) => {
      delete o.assistantDesignReview;
    },
    (o) => {
      o.assistantDesignReview = 'pending';
    },
    (o) => {
      o.predecessorDisposition = 'numeric-pass';
    },
    (o) => {
      o.stage = 'state-3';
    },
  ]) {
    const texts = fixture(),
      declaration = JSON.parse(texts.authorization);
    change(declaration);
    texts.authorization = JSON.stringify(declaration);
    expect(() => validatePrerequisites(texts)).toThrow(
      'Second-state declaration or prerequisite hashes differ',
    );
  }
});
