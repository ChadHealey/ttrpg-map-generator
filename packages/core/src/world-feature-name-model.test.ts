import { describe, expect, it } from 'vitest';

import type { AtlasGeographyRecords } from './atlas-geography-model.js';
import { createBehaviorVersion, createVariantRevision } from './compatibility.js';
import { deriveStableId, parseSemanticKey, parseStableId } from './identity.js';
import { parseWorldSeed } from './seed-input.js';
import {
  collectWorldFeatureNameSources,
  createWorldFeatureNameProposals,
  deriveWorldFeatureNameAspectId,
  parseWorldFeatureNameDisplayName,
  rerollWorldFeatureName,
  WORLD_FEATURE_NAME_DIAGNOSTIC_CODES,
  type WorldFeatureNameContent,
  type WorldFeatureNameLexicon,
  type WorldFeatureNameSource,
} from './world-feature-name-model.js';
import type { WorldPhysicalContextRecords } from './world-physical-context-model.js';

const MAP_ID = required(parseStableId('map', '11111111-1111-4111-8111-111111111111'));
const WORLD_SEED = required(parseWorldSeed('42'));
const REVISION_ZERO = required(createVariantRevision(0));
const LEXICON_VERSION = required(createBehaviorVersion(1));

describe('world-feature name content', () => {
  it('collects only the seven eligible M2/M3 feature record kinds', () => {
    const records = sources();
    const collected = collectWorldFeatureNameSources(
      {
        worldMapId: MAP_ID,
        landmasses: [record(requiredSource(records[0]))],
        islandGroups: [record(requiredSource(records[1]))],
        waterBodies: [record(requiredSource(records[2]))],
      } as unknown as AtlasGeographyRecords,
      {
        worldMapId: MAP_ID,
        mountainSystems: { systems: [record(requiredSource(records[3]))] },
        watersheds: { watersheds: [record(requiredSource(records[4]))] },
        majorRivers: [record(requiredSource(records[5]))],
        majorLakes: [record(requiredSource(records[6]))],
      } as unknown as WorldPhysicalContextRecords,
    );

    expect(
      new Set(collected.map(({ entityId, nameKind }) => `${entityId}/${nameKind}`)),
    ).toStrictEqual(new Set(records.map(({ entityId, nameKind }) => `${entityId}/${nameKind}`)));
  });

  it('generates byte-identical proposals for every eligible name kind regardless of insertion order', () => {
    const forward = sources();
    const reverse = [...forward].reverse();

    const first = requireProposals(
      createWorldFeatureNameProposals({ mapId: MAP_ID, worldSeed: WORLD_SEED, sources: forward }),
    );
    const second = requireProposals(
      createWorldFeatureNameProposals({ mapId: MAP_ID, worldSeed: WORLD_SEED, sources: reverse }),
    );

    expect(first).toStrictEqual(second);
    expect(first.map(({ output }) => output.displayName)).toStrictEqual([
      'Silver Mere',
      'Iron Peaks',
      'Storm Flow',
      'Blue Basin',
      'Thorn Basin',
      'Blue Arch',
      'Dawn Expanse',
    ]);
    expect(first.map(({ target }) => target.entityId)).toStrictEqual(
      [...first.map(({ target }) => target.entityId)].sort(),
    );
    expect(new Set(first.map(({ output }) => output.nameKind))).toStrictEqual(
      new Set([
        'landmass',
        'island-group',
        'water-body',
        'mountain-system',
        'watershed',
        'river',
        'lake',
      ]),
    );
    for (const proposal of first) {
      expect(proposal.target.aspect.aspectId).toBe(
        deriveWorldFeatureNameAspectId(proposal.target.entityId),
      );
      expect(proposal.output.displayName).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/u);
      expect(proposal.output.comparisonKey).toBe(proposal.output.displayName.toLowerCase());
    }
  });

  it('keeps same-kind entity streams and an unrelated control entity isolated', () => {
    const left = source(8, 'landmass');
    const right = source(9, 'landmass');
    const control = source(10, 'river');
    const batched = requireProposals(
      createWorldFeatureNameProposals({
        mapId: MAP_ID,
        worldSeed: WORLD_SEED,
        sources: [left, right, control],
      }),
    );

    for (const sourceValue of [left, right, control]) {
      const individual = requireProposals(
        createWorldFeatureNameProposals({
          mapId: MAP_ID,
          worldSeed: WORLD_SEED,
          sources: [sourceValue],
        }),
      );
      expect(batched.find(({ target }) => target.entityId === sourceValue.entityId)).toStrictEqual(
        individual[0],
      );
    }
  });

  it('resolves generated collisions in source-ID order with the bounded Roman-numeral fallback', () => {
    const result = requireProposals(
      createWorldFeatureNameProposals({
        mapId: MAP_ID,
        worldSeed: WORLD_SEED,
        sources: [source(1, 'landmass'), source(2, 'landmass')],
        lexicon: collisionLexicon(),
      }),
    );

    expect(result.map(({ output }) => output.displayName)).toStrictEqual([
      'Ash Reach',
      'Ash Reach II',
    ]);

    const againstAcceptedPeer = requireProposals(
      createWorldFeatureNameProposals({
        mapId: MAP_ID,
        worldSeed: WORLD_SEED,
        sources: [source(1, 'landmass')],
        acceptedPeerNames: [
          {
            ...manual(source(2, 'landmass'), 'Ash Reach'),
            origin: 'generated' as const,
          },
        ],
        lexicon: collisionLexicon(),
      }),
    );
    expect(againstAcceptedPeer[0]?.output.displayName).toBe('Ash Reach II');

    const suffixFromSixteenth = requireProposals(
      createWorldFeatureNameProposals({
        mapId: MAP_ID,
        worldSeed: WORLD_SEED,
        sources: [source(1, 'landmass')],
        acceptedPeerNames: [
          { ...manual(source(2, 'landmass'), 'Ash One'), origin: 'generated' as const },
          { ...manual(source(3, 'landmass'), 'Ash Two'), origin: 'generated' as const },
        ],
        lexicon: twoNameLexicon(),
      }),
    );
    expect(suffixFromSixteenth[0]?.output.displayName).toBe('Ash Two II');
  });

  it('preserves a valid manual override and rejects an in-domain duplicate without coercion', () => {
    const first = source(1, 'landmass');
    const second = source(2, 'landmass');
    const override = manual(first, 'Amber Crown');
    const preserved = createWorldFeatureNameProposals({
      mapId: MAP_ID,
      worldSeed: WORLD_SEED,
      sources: [first, second],
      manualOverrides: [override],
    });
    if (!preserved.ok) throw new Error('Expected manual override to be retained.');
    expect(preserved.retainedManualOverrides).toStrictEqual([override]);
    expect(preserved.proposals).toHaveLength(1);

    const duplicate = createWorldFeatureNameProposals({
      mapId: MAP_ID,
      worldSeed: WORLD_SEED,
      sources: [first, second],
      manualOverrides: [override, manual(second, 'Amber Crown')],
    });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok)
      expect(duplicate.diagnostics[0]?.code).toBe(WORLD_FEATURE_NAME_DIAGNOSTIC_CODES.duplicate);
    const acceptedGenerated = {
      ...manual(second, 'Amber Crown'),
      origin: 'generated' as const,
    };
    const acceptedCollision = createWorldFeatureNameProposals({
      mapId: MAP_ID,
      worldSeed: WORLD_SEED,
      sources: [first],
      manualOverrides: [override],
      acceptedPeerNames: [acceptedGenerated],
    });
    expect(acceptedCollision.ok).toBe(false);
    if (!acceptedCollision.ok) {
      expect(acceptedCollision.diagnostics[0]?.code).toBe(
        WORLD_FEATURE_NAME_DIAGNOSTIC_CODES.duplicate,
      );
    }
    const orphan = createWorldFeatureNameProposals({
      mapId: MAP_ID,
      worldSeed: WORLD_SEED,
      sources: [first],
      manualOverrides: [manual(second, 'Silver Crown')],
    });
    expect(orphan.ok).toBe(false);
    expect(
      createWorldFeatureNameProposals({
        mapId: MAP_ID,
        worldSeed: WORLD_SEED,
        sources: [first, source(3, 'river')],
        manualOverrides: [override, manual(source(3, 'river'), 'Amber Crown')],
      }).ok,
    ).toBe(true);
    expect(parseWorldFeatureNameDisplayName('Ámber Crown')).toStrictEqual({ ok: false });
    expect(parseWorldFeatureNameDisplayName('Amber  Crown')).toStrictEqual({ ok: false });
  });

  it('rerolls only one generated name and refuses to reroll a manual override', () => {
    const original = requireProposals(
      createWorldFeatureNameProposals({
        mapId: MAP_ID,
        worldSeed: WORLD_SEED,
        sources: [source(1, 'river'), source(2, 'river')],
      }),
    );
    const current = original[0]?.output;
    const peer = original[1]?.output;
    if (current === undefined || peer === undefined)
      throw new Error('Expected two generated names.');

    const rerolled = requireProposals(
      rerollWorldFeatureName({ mapId: MAP_ID, worldSeed: WORLD_SEED, current, otherNames: [peer] }),
    );
    expect(rerolled).toHaveLength(1);
    expect(rerolled[0]?.target.entityId).toBe(current.entityId);
    expect(rerolled[0]?.target.variantRevision).toBe(1);
    expect(peer).toStrictEqual(original[1]?.output);

    const manualResult = rerollWorldFeatureName({
      mapId: MAP_ID,
      worldSeed: WORLD_SEED,
      current: manual(source(3, 'river'), 'Silver River'),
      otherNames: [],
    });
    expect(manualResult.ok).toBe(false);
    if (!manualResult.ok) {
      expect(manualResult.diagnostics[0]?.code).toBe(
        WORLD_FEATURE_NAME_DIAGNOSTIC_CODES.manualReroll,
      );
    }
  });
});

function sources(): readonly WorldFeatureNameSource[] {
  return [
    source(1, 'landmass'),
    source(2, 'island-group'),
    source(3, 'water-body'),
    source(4, 'mountain-system'),
    source(5, 'watershed'),
    source(6, 'river'),
    source(7, 'lake'),
  ];
}

function source(
  index: number,
  nameKind: WorldFeatureNameSource['nameKind'],
): WorldFeatureNameSource {
  return Object.freeze({
    entityId: deriveStableId(
      'entity',
      MAP_ID,
      required(parseSemanticKey(`name-test-${String(index)}`)),
    ),
    nameKind,
    variantRevision: REVISION_ZERO,
  });
}

function record(sourceValue: WorldFeatureNameSource): {
  readonly entityId: typeof sourceValue.entityId;
} {
  return Object.freeze({ entityId: sourceValue.entityId });
}

function requiredSource(value: WorldFeatureNameSource | undefined): WorldFeatureNameSource {
  if (value === undefined) throw new Error('Expected fixed test source.');
  return value;
}

function manual(sourceValue: WorldFeatureNameSource, displayName: string): WorldFeatureNameContent {
  return Object.freeze({
    entityId: sourceValue.entityId,
    nameKind: sourceValue.nameKind,
    nameContentBehaviorVersion: LEXICON_VERSION,
    lexiconVersion: LEXICON_VERSION,
    variantRevision: sourceValue.variantRevision,
    origin: 'manual-override',
    displayName,
    comparisonKey: displayName.toLowerCase(),
  });
}

function collisionLexicon(): WorldFeatureNameLexicon {
  const secondWords = Object.freeze({
    landmass: Object.freeze(['reach']),
    'island-group': Object.freeze(['reach']),
    'water-body': Object.freeze(['reach']),
    'mountain-system': Object.freeze(['reach']),
    watershed: Object.freeze(['reach']),
    river: Object.freeze(['reach']),
    lake: Object.freeze(['reach']),
  });
  return Object.freeze({
    version: LEXICON_VERSION,
    firstWords: Object.freeze(['ash']),
    secondWords,
  });
}

function twoNameLexicon(): WorldFeatureNameLexicon {
  const secondWords = Object.freeze({
    landmass: Object.freeze(['one', 'two']),
    'island-group': Object.freeze(['one']),
    'water-body': Object.freeze(['one']),
    'mountain-system': Object.freeze(['one']),
    watershed: Object.freeze(['one']),
    river: Object.freeze(['one']),
    lake: Object.freeze(['one']),
  });
  return Object.freeze({
    version: LEXICON_VERSION,
    firstWords: Object.freeze(['ash']),
    secondWords,
  });
}

function requireProposals(result: ReturnType<typeof createWorldFeatureNameProposals>) {
  if (!result.ok) throw new Error(result.diagnostics.map(({ message }) => message).join('; '));
  return result.proposals;
}

function required<Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false },
): Value {
  if (!result.ok) throw new Error('Test setup value is invalid.');
  return result.value;
}
