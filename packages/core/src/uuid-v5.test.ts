import { describe, expect, it } from 'vitest';

import { deriveUuidV5 } from './uuid-v5.js';

describe('UUIDv5 derivation', () => {
  it('matches the RFC namespace and name example', () => {
    expect(deriveUuidV5('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'www.widgets.com')).toBe(
      '21f7f8de-8051-5b89-8680-0195ef798b6a',
    );
  });
});
