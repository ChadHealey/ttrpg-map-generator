import { describe, expect, it } from 'vitest';

import {
  GENERATED_ASPECT_DIAGNOSTIC_CODES,
  parseAspectName,
  parseGenerationDiagnosticCode,
} from './generated-aspects.js';

describe('generated-aspect symbolic metadata', () => {
  it('accepts the fixed proof aspect names and actionable diagnostic codes', () => {
    expect(parseAspectName('proof.outline')).toStrictEqual({
      ok: true,
      value: 'proof.outline',
    });
    expect(parseAspectName('proof.markers')).toStrictEqual({
      ok: true,
      value: 'proof.markers',
    });
    expect(parseAspectName('worldClimate.fields')).toStrictEqual({
      ok: true,
      value: 'worldClimate.fields',
    });
    expect(parseGenerationDiagnosticCode('proof.markers.outside-outline')).toStrictEqual({
      ok: true,
      value: 'proof.markers.outside-outline',
    });
  });

  it('rejects noncanonical aspect names with a stable code', () => {
    expect(parseAspectName('Proof.Markers')).toStrictEqual({
      ok: false,
      diagnostic: {
        code: GENERATED_ASPECT_DIAGNOSTIC_CODES.invalidAspectName,
        message:
          'Aspect name must contain two or more lower-camel dot-separated ASCII segments (maximum 128 characters).',
      },
    });
    expect(parseAspectName('markers')).toMatchObject({ ok: false });
    expect(parseAspectName(43)).toMatchObject({ ok: false });
  });

  it('rejects unstable diagnostic-code spellings with a stable code', () => {
    expect(parseGenerationDiagnosticCode('outside outline')).toStrictEqual({
      ok: false,
      diagnostic: {
        code: GENERATED_ASPECT_DIAGNOSTIC_CODES.invalidDiagnosticCode,
        message:
          'Generation diagnostic code must contain two or more lowercase dot-separated segments; every segment begins with a lowercase letter and otherwise uses letters, digits, or internal hyphens (maximum 128 characters).',
      },
    });
  });
});
