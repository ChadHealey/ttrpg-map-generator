import { describe, expect, it } from 'vitest';

import reopenSource from './atlas-workflow-reopen.ts?raw';

describe('accepted atlas reopen dependency boundary', () => {
  it('has no generation package or workflow-generation invocation dependency', () => {
    expect(reopenSource).not.toContain('@ttrpg-map/generation');
    expect(reopenSource).not.toContain('productionAtlasWorkflowGeneration');
    expect(reopenSource).not.toContain('AtlasWorkflowGenerationPort');
  });
});
