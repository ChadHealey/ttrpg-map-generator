import { corpus } from '../issue-180/corpus.mjs';
import { retainedInputs } from '../issue-183/corpus.mjs';
export const sweep = corpus()
  .filter((p) => p.cohort === 'additional-default')
  .map((p) => p.input);
export const rows = [...retainedInputs, ...sweep.slice(0, 12)];
