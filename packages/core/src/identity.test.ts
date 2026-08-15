import { describe, expect, it } from 'vitest';

import {
  compareStableReferences,
  createStableId,
  deriveStableId,
  encodeStableReference,
  type EntityId,
  parseGeneratorId,
  parseSemanticKey,
  parseStableId,
  type StableIdKind,
  stableReferencesEqual,
} from './identity.js';

const PARENT_ID = 'c6f4a17b-dfaf-4dce-9904-9a900d300da4';
const SECOND_ENTITY_ID = 'dc30de77-d7f2-4481-9387-470870b61640';

function requireValue<Value>(result: { ok: true; value: Value } | { ok: false }): Value {
  if (!result.ok) {
    throw new Error('Expected parsing to succeed.');
  }
  return result.value;
}

describe('stable identity parsing', () => {
  it('parses every Milestone 1 UUID-backed identity kind without changing its text', () => {
    const kinds: readonly StableIdKind[] = [
      'world-document',
      'map',
      'entity',
      'aspect',
      'constraint',
      'lock',
      'boundary-portal',
      'root-surface',
    ];

    for (const kind of kinds) {
      expect(parseStableId(kind, PARENT_ID)).toEqual({ ok: true, value: PARENT_ID });
    }
  });

  it('returns stable actionable diagnostics for invalid unknown input', () => {
    expect(parseStableId('map', 42)).toEqual({
      ok: false,
      diagnostic: {
        code: 'identity.expected-string',
        subject: 'map',
        message: 'Expected map ID to be a canonical UUID string; received number.',
      },
    });
    expect(parseStableId('entity', 'not-a-uuid')).toEqual({
      ok: false,
      diagnostic: {
        code: 'identity.invalid-uuid',
        subject: 'entity',
        message: 'Expected entity ID in 8-4-4-4-12 lowercase UUID form.',
      },
    });
    expect(parseStableId('aspect', PARENT_ID.toUpperCase())).toEqual({
      ok: false,
      diagnostic: {
        code: 'identity.noncanonical-uuid',
        subject: 'aspect',
        message: `Expected aspect ID to use lowercase UUID text; use "${PARENT_ID}".`,
      },
    });
    expect(parseStableId('constraint', '00000000-0000-0000-0000-000000000000')).toEqual({
      ok: false,
      diagnostic: {
        code: 'identity.nil-uuid',
        subject: 'constraint',
        message:
          'Expected constraint ID to identify a record; the nil UUID is reserved and cannot be used.',
      },
    });
  });

  it('validates generator IDs and semantic keys without normalization', () => {
    expect(parseGeneratorId('proof.outline')).toEqual({ ok: true, value: 'proof.outline' });
    expect(parseGeneratorId('Proof.Outline')).toMatchObject({
      ok: false,
      diagnostic: { code: 'identity.invalid-generator-id' },
    });
    expect(parseGeneratorId('proof.outline-')).toMatchObject({
      ok: false,
      diagnostic: { code: 'identity.invalid-generator-id' },
    });
    expect(parseGeneratorId('proof-.outline')).toMatchObject({
      ok: false,
      diagnostic: { code: 'identity.invalid-generator-id' },
    });
    expect(parseGeneratorId('proof.1outline')).toEqual({
      ok: false,
      diagnostic: {
        code: 'identity.invalid-generator-id',
        subject: 'generator',
        message:
          'Expected generator ID to contain two or more lowercase dot-separated segments; every segment begins with a lowercase letter and otherwise uses letters, digits, or internal hyphens (maximum 128 characters).',
      },
    });
    expect(parseSemanticKey('marker-000')).toEqual({ ok: true, value: 'marker-000' });
    expect(parseSemanticKey(' marker-000 ')).toMatchObject({
      ok: false,
      diagnostic: { code: 'identity.invalid-semantic-key' },
    });
  });
});

describe('stable identity creation and derivation', () => {
  it('creates IDs only through the supplied source and validates its result', () => {
    const requestedKinds: StableIdKind[] = [];
    const result = createStableId('constraint', {
      nextUuid(kind) {
        requestedKinds.push(kind);
        return 'ac35a7ae-3f2c-4433-9351-e23d52c65870';
      },
    });

    expect(result).toEqual({
      ok: true,
      value: 'ac35a7ae-3f2c-4433-9351-e23d52c65870',
    });
    expect(requestedKinds).toEqual(['constraint']);
    expect(createStableId('lock', { nextUuid: () => 'invalid' })).toMatchObject({
      ok: false,
      diagnostic: { code: 'identity.invalid-uuid', subject: 'lock' },
    });
  });

  it('matches the standard UUIDv5 result for stable parent, kind, and key bytes', () => {
    const parentId = requireValue(parseStableId('entity', PARENT_ID));
    const markerKey = requireValue(parseSemanticKey('marker-000'));

    expect(deriveStableId('entity', parentId, markerKey)).toBe(
      '8823b145-8087-5dae-af1a-9761602e99d7',
    );
  });

  it('is deterministic and domain-separated by parent, target kind, and semantic key', () => {
    const parentId = requireValue(parseStableId('entity', PARENT_ID));
    const secondParentId = requireValue(parseStableId('entity', SECOND_ENTITY_ID));
    const firstKey = requireValue(parseSemanticKey('marker-000'));
    const secondKey = requireValue(parseSemanticKey('marker-001'));

    const first = deriveStableId('entity', parentId, firstKey);
    expect(deriveStableId('entity', parentId, firstKey)).toBe(first);
    expect(deriveStableId('entity', parentId, secondKey)).not.toBe(first);
    expect(deriveStableId('entity', secondParentId, firstKey)).not.toBe(first);
    expect(deriveStableId('aspect', parentId, firstKey)).not.toBe(first);
    expect(first[14]).toBe('5');
    expect(['8', '9', 'a', 'b']).toContain(first[19]);
  });
});

describe('stable reference behavior', () => {
  it('retains identity and references when records are renamed or reordered', () => {
    const firstId = requireValue(parseStableId('entity', PARENT_ID));
    const secondId = requireValue(parseStableId('entity', SECOND_ENTITY_ID));
    const records: readonly [
      { readonly id: EntityId; readonly name: string },
      { readonly id: EntityId; readonly name: string },
    ] = [
      { id: firstId, name: 'Old name' },
      { id: secondId, name: 'Second' },
    ];
    const renamedAndReordered = [
      { ...records[1], name: 'Renamed second' },
      { ...records[0], name: 'Renamed first' },
    ];

    expect(renamedAndReordered.map(({ id }) => id).sort(compareStableReferences)).toEqual(
      records.map(({ id }) => id).sort(compareStableReferences),
    );
  });

  it('uses canonical encoding for equality and ordering', () => {
    const firstId = requireValue(parseStableId('entity', PARENT_ID));
    const secondId = requireValue(parseStableId('entity', SECOND_ENTITY_ID));

    expect(encodeStableReference(firstId)).toBe(PARENT_ID);
    expect(stableReferencesEqual(firstId, firstId)).toBe(true);
    expect(stableReferencesEqual(firstId, secondId)).toBe(false);
    expect(compareStableReferences(firstId, secondId)).toBe(-1);
    expect(compareStableReferences(secondId, firstId)).toBe(1);
    expect(compareStableReferences(firstId, firstId)).toBe(0);
  });

  it('uses the parsed symbolic generator ID as its canonical reference encoding', () => {
    const markerGeneratorId = requireValue(parseGeneratorId('proof.markers'));
    const outlineGeneratorId = requireValue(parseGeneratorId('proof.outline'));

    expect(encodeStableReference(markerGeneratorId)).toBe('proof.markers');
    expect(stableReferencesEqual(markerGeneratorId, markerGeneratorId)).toBe(true);
    expect(stableReferencesEqual(markerGeneratorId, outlineGeneratorId)).toBe(false);
    expect(compareStableReferences(markerGeneratorId, outlineGeneratorId)).toBe(-1);
    expect(compareStableReferences(outlineGeneratorId, markerGeneratorId)).toBe(1);
  });
});
