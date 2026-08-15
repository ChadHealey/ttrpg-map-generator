import { describe, expect, it } from 'vitest';

import { canonicalJsonBytes } from './canonical-json.js';
import { classifyMapworldRecoverySnapshot } from './mapworld-recovery-classification.js';
import { planConfirmedMapworldRecovery } from './mapworld-recovery-confirmation.js';
import { decideMapworldRecovery } from './mapworld-recovery-decision.js';
import {
  createMapworldSavePlan,
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
    const markerText = new TextDecoder().decode(Uint8Array.from(plan.markerBytes));

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
    expect(Object.isFrozen(plan.markerBytes)).toBe(true);
    expect(Object.isFrozen(plan.files)).toBe(true);
    expect(plan.files.every((file) => Object.isFrozen(file) && Object.isFrozen(file.bytes))).toBe(
      true,
    );
    const firstByte = plan.files[0]?.bytes[0];
    expect(() => {
      const bytes = plan.files[0]?.bytes as number[] | undefined;
      if (bytes !== undefined) bytes[0] = 255;
    }).toThrow();
    expect(plan.files[0]?.bytes[0]).toBe(firstByte);
  });

  it('classifies canonical unknown marker versions separately from noncanonical bytes', () => {
    const plan = savePlan(createProofDocument(), {
      operation: 'first-save',
      targetName: TARGET_NAME,
      previousManifestSha256: null,
    });
    const marker = JSON.parse(
      new TextDecoder().decode(Uint8Array.from(plan.markerBytes)),
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
  const firstMarker = regular('c', firstPlan.markerBytes);
  const replacementMarker = regular('d', replacementPlan.markerBytes);

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
    plan.files.map(({ path, bytes }) => ({ path, bytes: [...bytes] })),
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
