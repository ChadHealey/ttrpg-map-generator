import { describe, expect, it } from 'vitest';

import { planConfirmedMapworldRecovery } from './mapworld-recovery-confirmation.js';
import { decideMapworldRecovery } from './mapworld-recovery-decision.js';
import {
  MAPWORLD_RECOVERY_CODES,
  type MapworldRecoveryDecision,
  type MapworldRecoveryStep,
} from './mapworld-recovery-model.js';
import {
  classified,
  directory,
  emptyDirectory,
  FIRST_MARKER,
  FIRST_PLAN,
  invalidDirectory,
  NEW_DUPLICATE,
  NEW_PACKAGE,
  OLD_PACKAGE,
  OLD_PLAN,
  rawSnapshot,
  REPLACEMENT_MARKER,
  THIRD_PACKAGE,
} from './mapworld-recovery-test-support.js';

describe('ADR-0008 first-save recovery matrix', () => {
  it.each([
    {
      name: 'F2 promotes Vn from W',
      overrides: { temporary: directory('b', FIRST_PLAN), marker: FIRST_MARKER },
      steps: ['rename-temporary-to-target', 'sync-target-commit', 'remove-marker'],
      selected: 'temporary',
    },
    {
      name: 'committed Vn repeats its barrier',
      overrides: { target: directory('b', FIRST_PLAN), marker: FIRST_MARKER },
      steps: ['sync-target-commit', 'remove-marker'],
      selected: 'target',
    },
    {
      name: 'committed Vn removes an exact W duplicate',
      overrides: {
        target: directory('a', FIRST_PLAN),
        temporary: directory('b', FIRST_PLAN),
        marker: FIRST_MARKER,
      },
      steps: ['sync-target-commit', 'remove-temporary-exact-candidate', 'remove-marker'],
      selected: 'target',
    },
    {
      name: 'committed Vn removes empty W scaffolding',
      overrides: {
        target: directory('a', FIRST_PLAN),
        temporary: emptyDirectory('b'),
        marker: FIRST_MARKER,
      },
      steps: ['sync-target-commit', 'remove-temporary-empty', 'remove-marker'],
      selected: 'target',
    },
    {
      name: 'F1 abort removes only J',
      overrides: { marker: FIRST_MARKER },
      steps: ['remove-marker'],
      selected: null,
    },
    {
      name: 'F1 abort removes proven-empty W then J',
      overrides: { temporary: emptyDirectory('b'), marker: FIRST_MARKER },
      steps: ['remove-temporary-empty', 'remove-marker'],
      selected: null,
    },
  ] as const)('$name', ({ overrides, steps, selected }) => {
    expectApply(rawSnapshot(overrides), steps, selected);
  });

  it.each([
    {
      name: 'committed target plus non-empty invalid W',
      overrides: {
        target: directory('a', FIRST_PLAN),
        temporary: invalidDirectory('b'),
        marker: FIRST_MARKER,
      },
      code: MAPWORLD_RECOVERY_CODES.artifactConflict,
      selected: 'target',
    },
    {
      name: 'missing target plus invalid W',
      overrides: { temporary: invalidDirectory('b'), marker: FIRST_MARKER },
      code: MAPWORLD_RECOVERY_CODES.noValidPackage,
      selected: null,
    },
    {
      name: 'missing target plus a valid wrong-fingerprint W',
      overrides: { temporary: OLD_PACKAGE, marker: FIRST_MARKER },
      code: MAPWORLD_RECOVERY_CODES.noValidPackage,
      selected: null,
    },
    {
      name: 'unexpected backup on first save',
      overrides: {
        temporary: directory('b', FIRST_PLAN),
        backup: emptyDirectory('c'),
        marker: FIRST_MARKER,
      },
      code: MAPWORLD_RECOVERY_CODES.artifactConflict,
      selected: null,
    },
    {
      name: 'different valid target in an impossible role',
      overrides: {
        target: OLD_PACKAGE,
        temporary: directory('b', FIRST_PLAN),
        marker: FIRST_MARKER,
      },
      code: MAPWORLD_RECOVERY_CODES.artifactConflict,
      selected: 'target',
    },
  ] as const)('preserves $name', ({ overrides, code, selected }) => {
    expectAttention(rawSnapshot(overrides), code, selected);
  });
});

describe('ADR-0008 replacement recovery matrix', () => {
  it.each([
    {
      name: 'R2 moves old T to B then commits W',
      overrides: { target: OLD_PACKAGE, temporary: NEW_PACKAGE, marker: REPLACEMENT_MARKER },
      steps: [
        'rename-target-to-backup',
        'rename-temporary-to-target',
        'sync-target-commit',
        'remove-backup-exact-previous',
        'remove-marker',
      ],
      selected: 'temporary',
    },
    {
      name: 'R4 commits W while old B remains',
      overrides: {
        temporary: NEW_PACKAGE,
        backup: OLD_PACKAGE,
        marker: REPLACEMENT_MARKER,
      },
      steps: [
        'rename-temporary-to-target',
        'sync-target-commit',
        'remove-backup-exact-previous',
        'remove-marker',
      ],
      selected: 'temporary',
    },
    {
      name: 'committed Vn with no scaffolding repeats the barrier',
      overrides: { target: NEW_PACKAGE, marker: REPLACEMENT_MARKER },
      steps: ['sync-target-commit', 'remove-marker'],
      selected: 'target',
    },
    {
      name: 'committed Vn removes exact W and old B',
      overrides: {
        target: NEW_PACKAGE,
        temporary: NEW_DUPLICATE,
        backup: OLD_PACKAGE,
        marker: REPLACEMENT_MARKER,
      },
      steps: [
        'sync-target-commit',
        'remove-temporary-exact-candidate',
        'remove-backup-exact-previous',
        'remove-marker',
      ],
      selected: 'target',
    },
    {
      name: 'committed Vn removes empty W and B',
      overrides: {
        target: NEW_PACKAGE,
        temporary: emptyDirectory('c'),
        backup: emptyDirectory('d'),
        marker: REPLACEMENT_MARKER,
      },
      steps: [
        'sync-target-commit',
        'remove-temporary-empty',
        'remove-backup-empty',
        'remove-marker',
      ],
      selected: 'target',
    },
    {
      name: 'old T aborts with absent W',
      overrides: { target: OLD_PACKAGE, marker: REPLACEMENT_MARKER },
      steps: ['remove-marker'],
      selected: 'target',
    },
    {
      name: 'old T aborts after removing empty W',
      overrides: {
        target: OLD_PACKAGE,
        temporary: emptyDirectory('c'),
        marker: REPLACEMENT_MARKER,
      },
      steps: ['remove-temporary-empty', 'remove-marker'],
      selected: 'target',
    },
    {
      name: 'old B rolls back with absent W',
      overrides: { backup: OLD_PACKAGE, marker: REPLACEMENT_MARKER },
      steps: ['rename-backup-to-target', 'remove-marker'],
      selected: 'backup',
    },
    {
      name: 'old B rolls back then removes empty W',
      overrides: {
        temporary: emptyDirectory('c'),
        backup: OLD_PACKAGE,
        marker: REPLACEMENT_MARKER,
      },
      steps: ['rename-backup-to-target', 'remove-temporary-empty', 'remove-marker'],
      selected: 'backup',
    },
    {
      name: 'old B rolls back but preserves conflicting W and J',
      overrides: {
        temporary: invalidDirectory('c'),
        backup: OLD_PACKAGE,
        marker: REPLACEMENT_MARKER,
      },
      steps: ['rename-backup-to-target'],
      selected: 'backup',
    },
  ] as const)('$name', ({ overrides, steps, selected }) => {
    expectApply(rawSnapshot(overrides), steps, selected);
  });

  it.each([
    {
      name: 'committed Vn plus conflicting W',
      overrides: {
        target: NEW_PACKAGE,
        temporary: invalidDirectory('c'),
        marker: REPLACEMENT_MARKER,
      },
      selected: 'target',
    },
    {
      name: 'committed Vn plus partial B cleanup',
      overrides: {
        target: NEW_PACKAGE,
        backup: invalidDirectory('d'),
        marker: REPLACEMENT_MARKER,
      },
      selected: 'target',
    },
    {
      name: 'old T plus conflicting W',
      overrides: {
        target: OLD_PACKAGE,
        temporary: THIRD_PACKAGE,
        marker: REPLACEMENT_MARKER,
      },
      selected: 'target',
    },
    {
      name: 'simultaneous old T and old B impossible state',
      overrides: {
        target: OLD_PACKAGE,
        backup: directory('d', OLD_PLAN),
        marker: REPLACEMENT_MARKER,
      },
      selected: 'target',
    },
    {
      name: 'prepared W without the required old T or B',
      overrides: { temporary: NEW_PACKAGE, marker: REPLACEMENT_MARKER },
      selected: null,
    },
  ] as const)('preserves $name', ({ overrides, selected }) => {
    expectAttention(rawSnapshot(overrides), MAPWORLD_RECOVERY_CODES.artifactConflict, selected);
  });

  it('surfaces W conflict after a rollback plan is applied and re-enumerated', () => {
    expectAttention(
      rawSnapshot({
        target: OLD_PACKAGE,
        temporary: invalidDirectory('c'),
        marker: REPLACEMENT_MARKER,
      }),
      MAPWORLD_RECOVERY_CODES.artifactConflict,
      'target',
    );
  });

  it('does not misreport the selected old target while a prepared candidate conflicts', () => {
    const decision = expectAttention(
      rawSnapshot({
        target: OLD_PACKAGE,
        temporary: THIRD_PACKAGE,
        marker: REPLACEMENT_MARKER,
      }),
      MAPWORLD_RECOVERY_CODES.artifactConflict,
      'target',
    );
    expect(decision.attention.find(({ role }) => role === 'target')).toBeUndefined();
    expect(decision.selected?.fingerprint).toBe(OLD_PLAN.candidateManifestSha256);
  });

  it('offers executable exact resolutions for individually valid impossible states', () => {
    const preparedOnly = decideMapworldRecovery(
      classified(rawSnapshot({ temporary: NEW_PACKAGE, marker: REPLACEMENT_MARKER })),
    );
    if (preparedOnly.kind !== 'attention') throw new Error('Expected prepared-only conflict.');
    const promotion = preparedOnly.attention
      .find(({ role }) => role === 'temporary')
      ?.confirmations.find(({ action }) => action === 'promote-candidate');
    if (promotion === undefined) throw new Error('Expected exact promotion confirmation.');
    expect(
      planConfirmedMapworldRecovery(
        classified(
          rawSnapshot({
            temporary: NEW_PACKAGE,
            marker: REPLACEMENT_MARKER,
          }),
        ),
        promotion,
      ),
    ).toMatchObject({
      ok: true,
      value: { steps: ['rename-temporary-to-target', 'sync-target-commit'] },
    });

    const duplicatedOld = classified(
      rawSnapshot({
        target: OLD_PACKAGE,
        backup: directory('d', OLD_PLAN),
        marker: REPLACEMENT_MARKER,
      }),
    );
    const duplicateDecision = decideMapworldRecovery(duplicatedOld);
    if (duplicateDecision.kind !== 'attention') throw new Error('Expected duplicate conflict.');
    const removal = duplicateDecision.attention
      .find(({ role }) => role === 'backup')
      ?.confirmations.find(({ action }) => action === 'remove-artifact');
    if (removal === undefined) throw new Error('Expected exact duplicate removal.');
    expect(planConfirmedMapworldRecovery(duplicatedOld, removal)).toMatchObject({
      ok: true,
      value: { selectedRole: 'target', steps: ['remove-confirmed-backup'] },
    });
  });

  it('offers exact stale-marker removal when its named artifacts are absent', () => {
    const snapshot = classified(rawSnapshot({ target: THIRD_PACKAGE, marker: REPLACEMENT_MARKER }));
    const decision = decideMapworldRecovery(snapshot);
    if (decision.kind !== 'attention') throw new Error('Expected stale-marker conflict.');
    const confirmation = decision.attention
      .find(({ role }) => role === 'marker')
      ?.confirmations.find(({ action }) => action === 'remove-marker');
    if (confirmation === undefined) throw new Error('Expected marker removal confirmation.');
    expect(planConfirmedMapworldRecovery(snapshot, confirmation)).toMatchObject({
      ok: true,
      value: { steps: ['remove-confirmed-marker'] },
    });
  });
});

function expectApply(
  input: unknown,
  steps: readonly MapworldRecoveryStep[],
  selectedRole: string | null,
): void {
  const decision = decideMapworldRecovery(classified(input));
  expect(decision.kind).toBe('apply');
  if (decision.kind !== 'apply') throw new Error(JSON.stringify(decision));
  expect(decision.plan.steps).toEqual(steps);
  expect(decision.plan.selectedRole).toBe(selectedRole);
}

function expectAttention(
  input: unknown,
  code: string,
  selectedRole: string | null,
): Extract<MapworldRecoveryDecision, { readonly kind: 'attention' }> {
  const decision = decideMapworldRecovery(classified(input));
  expect(decision).toMatchObject({ kind: 'attention', code });
  if (decision.kind !== 'attention') throw new Error(JSON.stringify(decision));
  expect(decision.selected?.role ?? null).toBe(selectedRole);
  return decision;
}
