import { describe, expect, it } from 'vitest';

import { hash } from '../issue-177/local-evidence.mjs';
import { readTrustedLocalStage, validateLocalSnapshot } from './verify-local.mjs';

describe('issue-182 local saved-source execution guard', () => {
  it('validates the exact known current source closure before replay', async () => {
    const stage = await readTrustedLocalStage();
    expect(() => validateLocalSnapshot(stage)).not.toThrow();
  });
  it('rejects coherently rehashed source replacement before reaching execution', async () => {
    const stage = await readTrustedLocalStage(),
      name = stage.manifest.sources['../issue-182/layout-large.mjs'];
    stage.files[name] = Buffer.from('throw new Error("injected saved module");');
    stage.manifest.artifacts[name] = hash(stage.files[name]);
    let executionReached = false;
    expect(() => {
      validateLocalSnapshot(stage);
      executionReached = true;
    }).toThrow('Untrusted local source');
    expect(executionReached).toBe(false);
  });
  it('rejects a path escape or omitted source instead of treating hashes as authority', async () => {
    const stage = await readTrustedLocalStage();
    stage.manifest.sources['../issue-182/layout-large.mjs'] = '../outside.mjs';
    expect(() => validateLocalSnapshot(stage)).toThrow();
  });
});
