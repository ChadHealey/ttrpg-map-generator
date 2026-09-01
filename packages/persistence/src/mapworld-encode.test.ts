import type { AcceptedAspectRecord } from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import { acceptedAspectToDto } from './domain-to-dto.js';
import {
  canonicalAspectBytes,
  canonicalAspectOutputBytes,
  encodeMapworld,
} from './mapworld-encode.js';
import {
  createProofDocument,
  proofAspect,
  reorderProofDocument,
  TEST_MARKER_ASPECT_ID,
  TEST_OUTLINE_ASPECT_ID,
  withDiagnosticTarget,
} from './mapworld-test-support.js';
import { PERSISTENCE_DIAGNOSTIC_CODES } from './persistence-model.js';
import { createWorldWithGenericPayload } from './regional-mapworld-test-support.js';

describe('canonical mapworld v1 encoding', () => {
  it('produces identical package bytes repeatedly and across collection insertion orders', () => {
    const baseline = encoded(createProofDocument());
    const repeated = encoded(createProofDocument());
    const reordered = encoded(reorderProofDocument(createProofDocument()));

    expect(packageEvidence(repeated)).toStrictEqual(packageEvidence(baseline));
    expect(packageEvidence(reordered)).toStrictEqual(packageEvidence(baseline));
    expect(baseline.files.map(({ path }) => path)).toStrictEqual([
      'manifest.json',
      'world.json',
      'maps/a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7.json',
    ]);
    for (const file of baseline.files) {
      expect(new TextDecoder().decode(file.bytes)).toMatch(/\n$/u);
      expect(new TextDecoder().decode(file.bytes)).not.toContain('\r');
    }
  });

  it('implements the normative complete-aspect and accepted-output comparison boundaries', () => {
    const baseline = createProofDocument(0);
    const rerolled = createProofDocument(1);
    const baselineOutline = proofAspect(baseline, TEST_OUTLINE_ASPECT_ID);
    const rerolledOutline = proofAspect(rerolled, TEST_OUTLINE_ASPECT_ID);
    const baselineMarkers = proofAspect(baseline, TEST_MARKER_ASPECT_ID);
    const rerolledMarkers = proofAspect(rerolled, TEST_MARKER_ASPECT_ID);

    expect(bytes(canonicalAspectBytes(baselineOutline))).toStrictEqual(
      bytes(canonicalAspectBytes(rerolledOutline)),
    );
    expect(bytes(canonicalAspectOutputBytes(baselineOutline))).toStrictEqual(
      bytes(canonicalAspectOutputBytes(rerolledOutline)),
    );
    expect(bytes(canonicalAspectBytes(baselineMarkers))).not.toStrictEqual(
      bytes(canonicalAspectBytes(rerolledMarkers)),
    );
    expect(bytes(canonicalAspectOutputBytes(baselineMarkers))).not.toStrictEqual(
      bytes(canonicalAspectOutputBytes(rerolledMarkers)),
    );
    expect(bytes(canonicalAspectBytes(rerolledMarkers))).toStrictEqual(
      bytes(canonicalAspectBytes(proofAspect(createProofDocument(1), TEST_MARKER_ASPECT_ID))),
    );
  });

  it('rejects executable and exotic generic JSON without invoking accessors or stripping data', () => {
    let accessorReads = 0;
    const accessor = {};
    Object.defineProperty(accessor, 'value', {
      enumerable: true,
      get: () => {
        accessorReads += 1;
        return 1;
      },
    });
    const symbolRecord = { value: 1 } as Record<PropertyKey, unknown>;
    symbolRecord[Symbol('hidden')] = 2;
    const sparse = new Array<unknown>(3);
    sparse[0] = 1;
    sparse[2] = 3;
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const exotic = Object.create({ inherited: true }) as Record<string, unknown>;
    exotic.value = 1;

    for (const candidate of [accessor, symbolRecord, sparse, cyclic, exotic, { run: () => 1 }]) {
      const result = encodeMapworld(createWorldWithGenericPayload(candidate, { stable: true }));
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected exotic generic JSON to be rejected.');
      expect(result.diagnostics.map(({ code }) => code)).toContain(
        PERSISTENCE_DIAGNOSTIC_CODES.immutableSnapshotInvalid,
      );
    }
    expect(accessorReads).toBe(0);

    for (const candidate of [{ unsafe: Number.MAX_SAFE_INTEGER + 1 }, { negativeZero: -0 }]) {
      const result = encodeMapworld(createWorldWithGenericPayload(candidate, { stable: true }));
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected noncanonical JSON numbers to be rejected.');
      expect(result.diagnostics.map(({ code }) => code)).toContain(
        PERSISTENCE_DIAGNOSTIC_CODES.schemaInvalid,
      );
    }
  });

  it('does not read an accepted-aspect discriminator accessor before immutable validation', () => {
    let accessorReads = 0;
    const source = proofAspect(createProofDocument(), TEST_OUTLINE_ASPECT_ID);
    const candidate = { ...source } as AcceptedAspectRecord;
    Object.defineProperty(candidate, 'aspectName', {
      enumerable: true,
      get: () => {
        accessorReads += 1;
        throw new Error('Aspect discriminator accessor must not execute.');
      },
    });

    for (const result of [canonicalAspectBytes(candidate), canonicalAspectOutputBytes(candidate)]) {
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected accessor-bearing aspect rejection.');
      expect(result.diagnostics.map(({ code }) => code)).toContain(
        PERSISTENCE_DIAGNOSTIC_CODES.immutableSnapshotInvalid,
      );
    }
    expect(accessorReads).toBe(0);
  });

  it('rejects an accepted generation diagnostic whose target does not exist', () => {
    const result = encodeMapworld(
      withDiagnosticTarget(createProofDocument(), '00000000-0000-4000-8000-000000000099'),
    );

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: PERSISTENCE_DIAGNOSTIC_CODES.referenceInvalid,
          fieldPath:
            '$.aspects["54b92092-3d5f-4bca-a12c-353185de1557"].diagnostics["proof.outline.review-warning"].target',
        },
      ],
    });
  });

  it('returns a persistence diagnostic when an atlas output lacks a project-owned reader', () => {
    const aspect: AcceptedAspectRecord = {
      ...proofAspect(createProofDocument(), TEST_OUTLINE_ASPECT_ID),
      aspectName: 'worldTerrain.macroElevation' as AcceptedAspectRecord['aspectName'],
      acceptedOutput: Object.freeze({ provenance: {}, values: Object.freeze([0]) }),
    };

    const result = acceptedAspectToDto(aspect, '$aspect');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected malformed atlas output to be rejected.');
    expect(result.diagnostics.map(({ code }) => code)).toContain(
      PERSISTENCE_DIAGNOSTIC_CODES.schemaInvalid,
    );
  });
});

function encoded(document: Parameters<typeof encodeMapworld>[0]) {
  const result = encodeMapworld(document);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function bytes(result: ReturnType<typeof canonicalAspectBytes>): Uint8Array {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function packageEvidence(pkg: ReturnType<typeof encoded>) {
  return pkg.files.map((file) => ({ path: file.path, bytes: file.bytes }));
}
