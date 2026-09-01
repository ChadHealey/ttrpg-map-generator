import {
  type AcceptedAspectRecord,
  ATLAS_FULL_SAMPLE_COUNT,
  createBehaviorVersion,
  createNumericWorldPhysicalFieldReader,
  createParameterSchemaVersion,
  createVariantRevision,
  deriveWorldPhysicalContextAspectId,
  fingerprintWorldPhysicalField,
  parseAspectName,
  parseGeneratorId,
  parseSeedInput,
  type WorldDocument,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import { decodeBase64Bytes } from './base64-bytes.js';
import { canonicalJsonBytes } from './canonical-json.js';
import { classifyMapworldRecoverySnapshot } from './mapworld-recovery-classification.js';
import { planConfirmedMapworldRecovery } from './mapworld-recovery-confirmation.js';
import { decideMapworldRecovery } from './mapworld-recovery-decision.js';
import {
  createMapworldSavePlan,
  createMapworldV2SavePlan,
  deriveMapworldRecoveryArtifactNames,
} from './mapworld-recovery-marker.js';
import {
  MAPWORLD_RECOVERY_CODES,
  type MapworldRecoveryConfirmation,
  type MapworldSavePlan,
} from './mapworld-recovery-model.js';
import { createProofDocument } from './mapworld-test-support.js';

const TARGET_NAME = 'World.mapworld';
const ABSENT_TARGET = absent('1');
const ABSENT_TEMPORARY = absent('2');
const ABSENT_BACKUP = absent('3');
const ABSENT_MARKER = absent('4');

describe('mapworld recovery names, marker, and save plan', () => {
  it('derives the exact fixed sibling names and validates the Unix basename boundary', () => {
    expect(value(deriveMapworldRecoveryArtifactNames(TARGET_NAME))).toEqual({
      targetName: 'World.mapworld',
      temporaryName: '.World.mapworld.commit-v1.temporary',
      backupName: '.World.mapworld.commit-v1.backup',
      markerName: '.World.mapworld.commit-v1.json',
    });
    expect(value(deriveMapworldRecoveryArtifactNames('World\\draft.mapworld')).targetName).toBe(
      'World\\draft.mapworld',
    );
    for (const invalidName of [
      '',
      '.',
      '..',
      'World',
      'folder/World.mapworld',
      `World\0.mapworld`,
      `${'a'.repeat(230)}.mapworld`,
    ]) {
      const result = deriveMapworldRecoveryArtifactNames(invalidName);
      expect(result).toMatchObject({
        ok: false,
        error: { code: MAPWORLD_RECOVERY_CODES.artifactNameInvalid },
      });
    }
  });

  it('creates a complete immutable save plan with exact canonical marker bytes', () => {
    const oldPlan = savePlan(createProofDocument(0), {
      operation: 'first-save',
      targetName: TARGET_NAME,
      previousManifestSha256: null,
    });
    const plan = savePlan(createProofDocument(1), {
      operation: 'replacement-save',
      targetName: TARGET_NAME,
      previousManifestSha256: oldPlan.candidateManifestSha256,
    });
    const markerText = new TextDecoder().decode(requiredBase64(plan.markerBase64));

    expect(markerText).toBe(`{
  "backupName": ".World.mapworld.commit-v1.backup",
  "candidateManifestSha256": "${plan.candidateManifestSha256}",
  "checksumAlgorithm": "sha256",
  "operation": "replacement-save",
  "previousManifestSha256": "${oldPlan.candidateManifestSha256}",
  "protocol": "mapworld-directory-commit",
  "protocolVersion": 1,
  "targetName": "World.mapworld",
  "temporaryName": ".World.mapworld.commit-v1.temporary"
}
`);
    expect(Object.isFrozen(plan)).toBe(true);
    expect(typeof plan.markerBase64).toBe('string');
    expect(Object.isFrozen(plan.files)).toBe(true);
    expect(plan.files.every((file) => Object.isFrozen(file))).toBe(true);
    expect(plan.files.every(({ bytesBase64 }) => typeof bytesBase64 === 'string')).toBe(true);
  });

  it('does not read map discriminators before immutable save-plan validation', () => {
    let accessorReads = 0;
    const source = createProofDocument();
    const map = { ...source.maps[0] };
    Object.defineProperty(map, 'aspects', {
      enumerable: true,
      get: () => {
        accessorReads += 1;
        throw new Error('Map discriminator accessor must not execute.');
      },
    });
    const result = createMapworldSavePlan({ ...source, maps: [map] } as unknown as typeof source, {
      operation: 'first-save',
      targetName: TARGET_NAME,
      previousManifestSha256: null,
    });
    expect(result.ok).toBe(false);
    expect(accessorReads).toBe(0);
  });

  it('classifies canonical unknown marker versions separately from noncanonical bytes', () => {
    const plan = savePlan(createProofDocument(), {
      operation: 'first-save',
      targetName: TARGET_NAME,
      previousManifestSha256: null,
    });
    const marker = JSON.parse(
      new TextDecoder().decode(requiredBase64(plan.markerBase64)),
    ) as Record<string, unknown>;
    marker.protocolVersion = 2;
    const canonical = canonicalJsonBytes(marker, 'marker');
    if (!canonical.ok) throw new Error(JSON.stringify(canonical.diagnostics));
    const incompatible = classified(
      rawSnapshot({ marker: regular('5', Array.from(canonical.value)) }),
    );
    const noncanonical = classified(
      rawSnapshot({
        marker: regular('5', Array.from(new TextEncoder().encode(JSON.stringify(marker)))),
      }),
    );

    expect(incompatible.marker.classification).toBe('incompatible');
    expect(incompatible.marker.error?.code).toBe(MAPWORLD_RECOVERY_CODES.markerVersionIncompatible);
    expect(noncanonical.marker.classification).toBe('invalid');
    expect(noncanonical.marker.error?.code).toBe(MAPWORLD_RECOVERY_CODES.markerInvalid);
  });

  it('rejects missing or corrupt external-aspect and field owners as whole v2 candidates', () => {
    const plan = value(
      createMapworldV2SavePlan(createExternalFieldDocument(), {
        operation: 'first-save',
        targetName: TARGET_NAME,
        previousManifestSha256: null,
      }),
    );
    const valid = classified(rawSnapshot({ temporary: directory('6', plan) }));
    expect(valid.temporary.classification).toBe('valid');

    const aspectPath = plan.files.find(({ path }) => path.includes('/aspects/'))?.path;
    const fieldPath = plan.files.find(({ path }) => path.endsWith('.mwf'))?.path;
    if (aspectPath === undefined || fieldPath === undefined) {
      throw new Error('Expected an external aspect and field owner in the v2 save plan.');
    }
    expect(plan.files.map(({ path }) => path)).toEqual(
      expect.arrayContaining([aspectPath, fieldPath]),
    );

    for (const [index, missingPath] of [aspectPath, fieldPath].entries()) {
      const partial = directoryEntries(
        String(7 + index),
        plan.files
          .filter(({ path }) => path !== missingPath)
          .map(({ path, bytesBase64 }) => ({
            path,
            bytes: Array.from(requiredBase64(bytesBase64)),
          })),
      );
      expect(classified(rawSnapshot({ temporary: partial })).temporary.classification).toBe(
        'invalid',
      );
    }

    const corrupt = directoryEntries(
      '9',
      plan.files.map(({ path, bytesBase64 }) => {
        const bytes = Array.from(requiredBase64(bytesBase64));
        if (path === fieldPath) bytes[bytes.length - 1] = (bytes.at(-1) ?? 0) ^ 1;
        return { path, bytes };
      }),
    );
    expect(classified(rawSnapshot({ temporary: corrupt })).temporary.classification).toBe(
      'invalid',
    );
  }, 60_000);
});

describe('pure mapworld recovery decision', () => {
  const oldPlan = savePlan(createProofDocument(0), {
    operation: 'first-save',
    targetName: TARGET_NAME,
    previousManifestSha256: null,
  });
  const firstPlan = savePlan(createProofDocument(1), {
    operation: 'first-save',
    targetName: TARGET_NAME,
    previousManifestSha256: null,
  });
  const replacementPlan = savePlan(createProofDocument(1), {
    operation: 'replacement-save',
    targetName: TARGET_NAME,
    previousManifestSha256: oldPlan.candidateManifestSha256,
  });
  const oldPackage = directory('a', oldPlan);
  const newPackage = directory('b', replacementPlan);
  const firstMarker = regular('c', Array.from(requiredBase64(firstPlan.markerBase64)));
  const replacementMarker = regular('d', Array.from(requiredBase64(replacementPlan.markerBase64)));

  it.each([
    {
      name: 'resumes first-save prepared candidate',
      snapshot: rawSnapshot({ temporary: directory('b', firstPlan), marker: firstMarker }),
      steps: ['rename-temporary-to-target', 'sync-target-commit', 'remove-marker'],
    },
    {
      name: 'repeats first-save commit barrier',
      snapshot: rawSnapshot({ target: directory('b', firstPlan), marker: firstMarker }),
      steps: ['sync-target-commit', 'remove-marker'],
    },
    {
      name: 'resumes replacement before the first rename',
      snapshot: rawSnapshot({
        target: oldPackage,
        temporary: newPackage,
        marker: replacementMarker,
      }),
      steps: [
        'rename-target-to-backup',
        'rename-temporary-to-target',
        'sync-target-commit',
        'remove-backup-exact-previous',
        'remove-marker',
      ],
    },
    {
      name: 'resumes replacement from durable old backup',
      snapshot: rawSnapshot({
        temporary: newPackage,
        backup: oldPackage,
        marker: replacementMarker,
      }),
      steps: [
        'rename-temporary-to-target',
        'sync-target-commit',
        'remove-backup-exact-previous',
        'remove-marker',
      ],
    },
    {
      name: 'finishes committed replacement cleanup',
      snapshot: rawSnapshot({
        target: newPackage,
        backup: oldPackage,
        marker: replacementMarker,
      }),
      steps: ['sync-target-commit', 'remove-backup-exact-previous', 'remove-marker'],
    },
    {
      name: 'rolls the old backup back when no candidate remains',
      snapshot: rawSnapshot({ backup: oldPackage, marker: replacementMarker }),
      steps: ['rename-backup-to-target', 'remove-marker'],
    },
  ])('$name', ({ snapshot, steps }) => {
    const decision = decideMapworldRecovery(classified(snapshot));
    expect(decision.kind).toBe('apply');
    if (decision.kind !== 'apply') throw new Error('Expected automatic recovery plan.');
    expect(decision.plan.steps).toEqual(steps);
    expect(decision.plan.expectedObservations.map(({ role }) => role)).toEqual([
      'target',
      'temporary',
      'backup',
      'marker',
    ]);
    expect(Object.isFrozen(decision.plan.steps)).toBe(true);
  });

  it('preserves a partial non-empty backup and requires its exact confirmation', () => {
    const invalidBackup = directoryEntries('e', [{ path: 'manifest.json', bytes: [0x7b] }]);
    const snapshot = classified(
      rawSnapshot({
        target: newPackage,
        backup: invalidBackup,
        marker: replacementMarker,
      }),
    );
    const decision = decideMapworldRecovery(snapshot);

    expect(decision).toMatchObject({
      kind: 'attention',
      code: MAPWORLD_RECOVERY_CODES.artifactConflict,
      canOpenReadOnly: true,
    });
    if (decision.kind !== 'attention') throw new Error('Expected artifact attention.');
    const confirmation = decision.attention.find(({ role }) => role === 'backup')?.confirmations[0];
    expect(confirmation).toEqual({
      action: 'remove-artifact',
      role: 'backup',
      observationToken: token('e'),
    });
    if (confirmation === undefined) throw new Error('Expected exact backup confirmation.');
    const confirmed = planConfirmedMapworldRecovery(snapshot, confirmation);
    expect(confirmed).toMatchObject({
      ok: true,
      value: {
        selectedRole: 'target',
        steps: ['remove-confirmed-backup'],
        confirmationTokens: [`backup|${token('e')}`],
      },
    });
  });

  it('reports different valid fingerprints as ambiguous and resolves an exact selection', () => {
    const snapshot = classified(
      rawSnapshot({ target: oldPackage, temporary: newPackage, marker: ABSENT_MARKER }),
    );
    const decision = decideMapworldRecovery(snapshot);
    expect(decision).toMatchObject({
      kind: 'attention',
      code: MAPWORLD_RECOVERY_CODES.ambiguousCandidates,
    });
    if (decision.kind !== 'attention') throw new Error('Expected ambiguous candidates.');
    const confirmation = decision.attention.find(({ role }) => role === 'temporary')
      ?.confirmations[0];
    expect(confirmation).toMatchObject({
      action: 'select-candidate',
      role: 'temporary',
      fingerprint: replacementPlan.candidateManifestSha256,
    });
    if (confirmation === undefined) throw new Error('Expected candidate selection confirmation.');
    const selected = planConfirmedMapworldRecovery(snapshot, confirmation);
    expect(selected).toMatchObject({
      ok: true,
      value: { selectedRole: 'temporary', steps: [] },
    });
  });

  it('never confirms removal of the only valid package', () => {
    const snapshot = classified(rawSnapshot({ temporary: newPackage }));
    const confirmation: MapworldRecoveryConfirmation = {
      action: 'remove-artifact',
      role: 'temporary',
      observationToken: token('b'),
    };

    expect(planConfirmedMapworldRecovery(snapshot, confirmation)).toMatchObject({
      ok: false,
      error: { code: MAPWORLD_RECOVERY_CODES.confirmationRequired },
    });
  });

  it('preserves a wrong-fingerprint artifact beside a committed valid target', () => {
    const snapshot = classified(
      rawSnapshot({ target: newPackage, temporary: oldPackage, marker: replacementMarker }),
    );
    const decision = decideMapworldRecovery(snapshot);
    expect(decision).toMatchObject({
      kind: 'attention',
      code: MAPWORLD_RECOVERY_CODES.artifactConflict,
      selected: { role: 'target', fingerprint: replacementPlan.candidateManifestSha256 },
    });
  });
});

function rawSnapshot(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    targetName: TARGET_NAME,
    snapshotId: token('f'),
    target: ABSENT_TARGET,
    temporary: ABSENT_TEMPORARY,
    backup: ABSENT_BACKUP,
    marker: ABSENT_MARKER,
    ...overrides,
  };
}

function absent(character: string) {
  return { kind: 'absent', observationToken: token(character) };
}

function regular(character: string, bytes: readonly number[]) {
  return { kind: 'regular-file', observationToken: token(character), bytes: [...bytes] };
}

function directory(character: string, plan: MapworldSavePlan) {
  return directoryEntries(
    character,
    plan.files.map(({ path, bytesBase64 }) => ({
      path,
      bytes: Array.from(requiredBase64(bytesBase64)),
    })),
  );
}

function directoryEntries(
  character: string,
  entries: readonly { readonly path: string; readonly bytes: readonly number[] }[],
) {
  return {
    kind: 'directory',
    observationToken: token(character),
    entries: [...entries].sort(({ path: left }, { path: right }) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  };
}

function token(character: string): string {
  return character.repeat(64);
}

function classified(input: unknown) {
  return value(classifyMapworldRecoverySnapshot(input));
}

function savePlan(
  document: Parameters<typeof createMapworldSavePlan>[0],
  intent: Parameters<typeof createMapworldSavePlan>[1],
) {
  return value(createMapworldSavePlan(document, intent));
}

function value<Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false },
): Value {
  if (!result.ok) throw new Error(`Expected successful recovery result: ${JSON.stringify(result)}`);
  return result.value;
}

function requiredBase64(value: string): Uint8Array {
  const bytes = decodeBase64Bytes(value, Number.MAX_SAFE_INTEGER);
  if (bytes === null) throw new Error('Test save plan contains invalid canonical base64.');
  return bytes;
}

function createExternalFieldDocument(): WorldDocument {
  const document = createProofDocument();
  const map = document.maps[0];
  const entity = map?.entities[0];
  const sourceAspect = map?.aspects[0];
  if (map === undefined || entity === undefined || sourceAspect === undefined) {
    throw new Error('Expected a synthetic external-field owner.');
  }
  const aspectName = value(parseAspectName('worldClimate.temperature'));
  const generatorId = value(parseGeneratorId('worldClimate.temperature'));
  const generatorVersion = value(createBehaviorVersion(1));
  const parameterSchemaVersion = value(createParameterSchemaVersion(1));
  const variantRevision = value(createVariantRevision(0));
  const aspectId = deriveWorldPhysicalContextAspectId(entity.entityId, 'worldClimate.temperature');
  const values = createNumericWorldPhysicalFieldReader(new Int16Array(ATLAS_FULL_SAMPLE_COUNT));
  const provenanceWithoutFingerprint = {
    contractVersion: 1,
    fieldKind: 'temperature',
    ownerAspectId: aspectId,
    sourceAspectIds: [sourceAspect.aspectId],
    fieldBehaviorVersion: 1,
    fieldEncodingVersion: 1,
    valueEncoding: 'signed-integer-ticks',
    quantizationScale: 10,
    samplingProfileId: 'world-atlas-full-v1',
    samplingPolicyVersion: 1,
    longitudeCellCount: 2_048,
    latitudeBandCount: 1_024,
    canonicalTraversal: 'south-pole-then-rows-then-north-pole',
  } as const;
  const aspect: AcceptedAspectRecord = {
    mapId: map.mapId,
    entityId: entity.entityId,
    aspectId,
    aspectName,
    generatorId,
    generatorVersion,
    parameterSchemaVersion,
    parameters: { parameterSchemaVersion: 1, fieldEncodingVersion: 1, climateCharacter: 'varied' },
    seedScope: 'map/entity',
    seedMetadata: value(
      parseSeedInput({
        seedDerivationVersion: 1,
        deterministicStreamVersion: 1,
        seedScope: 'map/entity',
        worldSeed: document.worldSeed.toString(),
        generatorId,
        generatorVersion,
        aspectName,
        variantRevision,
        mapId: map.mapId,
        entityId: entity.entityId,
      }),
    ),
    variantRevision,
    dependencyAspects: [],
    generationStatus: 'accepted',
    diagnostics: [],
    acceptedOutput: {
      provenance: {
        ...provenanceWithoutFingerprint,
        fingerprint: fingerprintWorldPhysicalField({
          provenance: provenanceWithoutFingerprint,
          minimumValue: 0,
          maximumValue: 0,
          values,
        }),
      },
      minimumValue: 0,
      maximumValue: 0,
      values,
      quantumCelsius: 0.1,
    },
  };
  return {
    ...document,
    maps: document.maps.map((item) =>
      item.mapId === map.mapId ? { ...item, aspects: [...item.aspects, aspect] } : item,
    ),
  };
}
