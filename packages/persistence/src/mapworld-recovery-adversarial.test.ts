import { describe, expect, it } from 'vitest';

import decodeSource from './mapworld-decode.ts?raw';
import attentionSource from './mapworld-recovery-attention.ts?raw';
import classificationSource from './mapworld-recovery-classification.ts?raw';
import { planConfirmedMapworldRecovery } from './mapworld-recovery-confirmation.js';
import confirmationSource from './mapworld-recovery-confirmation.ts?raw';
import { decideMapworldRecovery } from './mapworld-recovery-decision.js';
import decisionSource from './mapworld-recovery-decision.ts?raw';
import markerSource from './mapworld-recovery-marker.ts?raw';
import {
  MAPWORLD_RECOVERY_CODES,
  type MapworldRecoveryConfirmation,
} from './mapworld-recovery-model.js';
import modelSource from './mapworld-recovery-model.ts?raw';
import nativeDtoSource from './mapworld-recovery-native-dto.ts?raw';
import resultSource from './mapworld-recovery-result.ts?raw';
import schemasSource from './mapworld-recovery-schemas.ts?raw';
import {
  canonicalBytes,
  classified,
  directory,
  directoryEntries,
  emptyDirectory,
  FIRST_PLAN,
  invalidDirectory,
  markerBytesWith,
  NEW_DUPLICATE,
  NEW_PACKAGE,
  OLD_PACKAGE,
  OLD_PLAN,
  planMarkerBytes,
  rawSnapshot,
  regular,
  REPLACEMENT_PLAN,
  savePlan,
  THIRD_PACKAGE,
  token,
  unreadable,
  wrongKind,
} from './mapworld-recovery-test-support.js';

describe('marker classification and impossible states', () => {
  it.each([
    {
      name: 'canonical malformed current marker',
      marker: regular('e', canonicalBytes({ protocolVersion: 1 })),
      classification: 'invalid',
      code: MAPWORLD_RECOVERY_CODES.markerInvalid,
    },
    {
      name: 'canonical unknown marker version',
      marker: regular('e', markerBytesWith({ protocolVersion: 2 })),
      classification: 'incompatible',
      code: MAPWORLD_RECOVERY_CODES.markerVersionIncompatible,
    },
    {
      name: 'target-name mismatch',
      marker: regular('e', planMarkerBytes(savePlan(1, 'first-save', null, 'Other.mapworld'))),
      classification: 'invalid',
      code: MAPWORLD_RECOVERY_CODES.markerInvalid,
    },
    {
      name: 'noncanonical JSON bytes',
      marker: regular('e', Array.from(new TextEncoder().encode('{"protocolVersion":2}'))),
      classification: 'invalid',
      code: MAPWORLD_RECOVERY_CODES.markerInvalid,
    },
  ] as const)('preserves a $name', ({ marker, classification, code }) => {
    const snapshot = classified(rawSnapshot({ marker, temporary: NEW_PACKAGE }));
    expect(snapshot.marker.classification).toBe(classification);
    expect(decideMapworldRecovery(snapshot)).toMatchObject({
      kind: 'attention',
      code,
      selected: { role: 'temporary' },
      canOpenReadOnly: true,
    });
  });

  it.each([
    ['empty-directory', emptyDirectory('e')],
    ['non-empty-directory', directoryEntries('e', [{ path: 'marker', bytes: [1] }])],
    ['symlink', wrongKind('e', 'symlink')],
    ['special', wrongKind('e', 'special')],
  ] as const)('preserves marker wrong-kind %s without offering deletion', (_name, marker) => {
    const decision = decideMapworldRecovery(classified(rawSnapshot({ marker })));
    expect(decision).toMatchObject({
      kind: 'attention',
      code: MAPWORLD_RECOVERY_CODES.artifactConflict,
      attention: [{ role: 'marker' }],
    });
    if (decision.kind !== 'attention') throw new Error('Expected marker attention.');
    expect(decision.attention[0]?.confirmations).toEqual([]);
  });

  it('carries OS context for an unreadable marker without offering deletion', () => {
    const decision = decideMapworldRecovery(
      classified(rawSnapshot({ marker: unreadable('e', 'openat', 13, 'EACCES') })),
    );
    expect(decision).toMatchObject({
      kind: 'attention',
      code: MAPWORLD_RECOVERY_CODES.artifactConflict,
      attention: [
        {
          role: 'marker',
          osContext: { primitive: 'openat', osErrorNumber: 13, osErrorName: 'EACCES' },
        },
      ],
    });
    if (decision.kind !== 'attention') throw new Error('Expected marker attention.');
    expect(decision.attention[0]?.confirmations).toEqual([]);
  });

  it('keeps unique W or B read-only selectable under invalid and incompatible markers', () => {
    for (const [role, marker] of [
      ['temporary', regular('e', [0x7b])],
      ['backup', regular('e', markerBytesWith({ protocolVersion: 2 }))],
    ] as const) {
      const decision = decideMapworldRecovery(
        classified(rawSnapshot({ [role]: NEW_PACKAGE, marker })),
      );
      expect(decision).toMatchObject({
        kind: 'attention',
        selected: { role },
        canOpenReadOnly: true,
      });
    }
  });
});

describe('no-marker conservative recovery', () => {
  it('returns clean only for a valid target without recovery artifacts', () => {
    expect(decideMapworldRecovery(classified(rawSnapshot({ target: NEW_PACKAGE })))).toMatchObject({
      kind: 'clean',
      selected: { role: 'target' },
      canSave: true,
    });
  });

  it.each([
    ['unique W', { temporary: NEW_PACKAGE }, 'temporary', 'rename-temporary-to-target'],
    ['unique B', { backup: NEW_PACKAGE }, 'backup', 'rename-backup-to-target'],
    [
      'same-fingerprint W and B',
      { temporary: NEW_PACKAGE, backup: NEW_DUPLICATE },
      'temporary',
      'rename-temporary-to-target',
    ],
    [
      'unique W beside invalid B',
      { temporary: NEW_PACKAGE, backup: invalidDirectory('d') },
      'temporary',
      'rename-temporary-to-target',
    ],
  ] as const)(
    'promotes %s without deleting unowned artifacts',
    (_name, overrides, role, rename) => {
      const decision = decideMapworldRecovery(classified(rawSnapshot(overrides)));
      expect(decision).toMatchObject({
        kind: 'apply',
        selected: { role },
        plan: { steps: [rename, 'sync-target-commit'] },
      });
    },
  );

  it('keeps same-fingerprint artifacts visible beside a selected target', () => {
    expect(
      decideMapworldRecovery(
        classified(rawSnapshot({ target: NEW_PACKAGE, temporary: NEW_DUPLICATE })),
      ),
    ).toMatchObject({
      kind: 'attention',
      code: MAPWORLD_RECOVERY_CODES.artifactConflict,
      selected: { role: 'target' },
    });
  });

  it.each([
    ['invalid target', invalidDirectory('1')],
    ['unreadable target', unreadable('1', 'openat', 13, 'EACCES')],
    ['regular-file target', regular('1', [1])],
    ['symlink target', wrongKind('1', 'symlink')],
  ] as const)('never overwrites an %s', (_name, target) => {
    expect(
      decideMapworldRecovery(classified(rawSnapshot({ target, temporary: NEW_PACKAGE }))),
    ).toMatchObject({
      kind: 'attention',
      code: MAPWORLD_RECOVERY_CODES.artifactConflict,
      selected: { role: 'temporary' },
    });
  });

  it('reports different fingerprints as ambiguous with exact selections', () => {
    const decision = decideMapworldRecovery(
      classified(
        rawSnapshot({ target: OLD_PACKAGE, temporary: NEW_PACKAGE, backup: THIRD_PACKAGE }),
      ),
    );
    expect(decision).toMatchObject({
      kind: 'attention',
      code: MAPWORLD_RECOVERY_CODES.ambiguousCandidates,
      selected: null,
    });
    if (decision.kind !== 'attention') throw new Error('Expected ambiguity.');
    expect(
      decision.attention.map(({ role, confirmations }) => [role, confirmations[0]?.action]),
    ).toEqual([
      ['target', 'select-candidate'],
      ['temporary', 'select-candidate'],
      ['backup', 'select-candidate'],
    ]);
  });

  it.each([
    ['all absent', {}],
    ['empty W', { temporary: emptyDirectory('2') }],
    ['invalid W', { temporary: invalidDirectory('2') }],
    ['unreadable W', { temporary: unreadable('2', 'openat', 5, 'EIO') }],
    ['regular-file W', { temporary: regular('2', [1]) }],
    ['symlink W', { temporary: wrongKind('2', 'symlink') }],
    ['special W', { temporary: wrongKind('2', 'special') }],
  ] as const)('reports no valid package for %s', (_name, overrides) => {
    expect(decideMapworldRecovery(classified(rawSnapshot(overrides)))).toMatchObject({
      kind: 'attention',
      code: MAPWORLD_RECOVERY_CODES.noValidPackage,
      selected: null,
    });
  });

  it('carries decode diagnostics and unreadable OS context without unsafe confirmation', () => {
    const invalid = decideMapworldRecovery(
      classified(rawSnapshot({ temporary: invalidDirectory('2') })),
    );
    const unreadableDecision = decideMapworldRecovery(
      classified(rawSnapshot({ backup: unreadable('3', 'openat', 5, 'EIO') })),
    );
    expect(invalid).toMatchObject({
      kind: 'attention',
      attention: [{ role: 'temporary' }],
    });
    if (invalid.kind !== 'attention') throw new Error('Expected invalid-package attention.');
    expect(invalid.attention[0]?.diagnostics.length).toBeGreaterThan(0);
    expect(invalid.attention[0]?.confirmations).toEqual([]);
    expect(unreadableDecision).toMatchObject({
      kind: 'attention',
      attention: [
        {
          role: 'backup',
          osContext: { primitive: 'openat', osErrorNumber: 5, osErrorName: 'EIO' },
        },
      ],
    });
    if (unreadableDecision.kind !== 'attention') throw new Error('Expected unreadable attention.');
    expect(unreadableDecision.attention[0]?.confirmations).toEqual([]);
  });

  it('does not offer deletion of the only valid package or promotion over unreadable T', () => {
    const onlyValid = decideMapworldRecovery(
      classified(rawSnapshot({ target: NEW_PACKAGE, temporary: invalidDirectory('2') })),
    );
    const unreadableTarget = decideMapworldRecovery(
      classified(
        rawSnapshot({
          target: unreadable('1', 'openat', 13, 'EACCES'),
          temporary: NEW_PACKAGE,
        }),
      ),
    );
    if (onlyValid.kind !== 'attention' || unreadableTarget.kind !== 'attention') {
      throw new Error('Expected attention states.');
    }
    expect(onlyValid.attention.find(({ role }) => role === 'target')).toBeUndefined();
    expect(
      unreadableTarget.attention.find(({ role }) => role === 'temporary')?.confirmations,
    ).toEqual([]);
  });
});

describe('candidate-specific confirmation and immutable inputs', () => {
  it('rejects stale observation tokens and stale fingerprints', () => {
    const snapshot = classified(rawSnapshot({ target: OLD_PACKAGE, temporary: NEW_PACKAGE }));
    const confirmations: MapworldRecoveryConfirmation[] = [
      {
        action: 'select-candidate',
        role: 'temporary',
        observationToken: token('9'),
        fingerprint: REPLACEMENT_PLAN.candidateManifestSha256,
      },
      {
        action: 'select-candidate',
        role: 'temporary',
        observationToken: token('b'),
        fingerprint: token('9'),
      },
    ];
    for (const confirmation of confirmations) {
      expect(planConfirmedMapworldRecovery(snapshot, confirmation)).toMatchObject({
        ok: false,
        error: { code: MAPWORLD_RECOVERY_CODES.confirmationRequired },
      });
    }
  });

  it('selects an exact ambiguous candidate without mutation', () => {
    const snapshot = classified(rawSnapshot({ target: OLD_PACKAGE, temporary: NEW_PACKAGE }));
    expect(
      planConfirmedMapworldRecovery(snapshot, {
        action: 'select-candidate',
        role: 'temporary',
        observationToken: token('b'),
        fingerprint: REPLACEMENT_PLAN.candidateManifestSha256,
      }),
    ).toMatchObject({
      ok: true,
      value: { selectedRole: 'temporary', steps: [], confirmationTokens: [] },
    });
  });

  it('binds confirmed valid-package deletion to its offered fingerprint', () => {
    const snapshot = classified(rawSnapshot({ target: OLD_PACKAGE, temporary: NEW_PACKAGE }));
    const decision = decideMapworldRecovery(snapshot);
    if (decision.kind !== 'attention') throw new Error('Expected ambiguity.');
    const removal = decision.attention
      .find(({ role }) => role === 'temporary')
      ?.confirmations.find(({ action }) => action === 'remove-artifact');
    expect(removal).toEqual({
      action: 'remove-artifact',
      role: 'temporary',
      observationToken: token('b'),
      fingerprint: REPLACEMENT_PLAN.candidateManifestSha256,
    });
    if (removal === undefined) throw new Error('Expected exact valid-candidate removal.');
    expect(planConfirmedMapworldRecovery(snapshot, removal)).toMatchObject({
      ok: true,
      value: {
        steps: ['remove-confirmed-temporary'],
        confirmationTokens: [`temporary|${token('b')}|${REPLACEMENT_PLAN.candidateManifestSha256}`],
      },
    });
  });

  it('promotes a valid candidate only over an exact confirmed invalid target', () => {
    const snapshot = classified(
      rawSnapshot({ target: invalidDirectory('1'), temporary: NEW_PACKAGE }),
    );
    const decision = decideMapworldRecovery(snapshot);
    if (decision.kind !== 'attention') throw new Error('Expected invalid-target attention.');
    const confirmation = decision.attention.find(({ role }) => role === 'temporary')
      ?.confirmations[0];
    if (confirmation === undefined) throw new Error('Expected promotion confirmation.');
    expect(planConfirmedMapworldRecovery(snapshot, confirmation)).toMatchObject({
      ok: true,
      value: {
        steps: ['remove-confirmed-target', 'rename-temporary-to-target', 'sync-target-commit'],
        confirmationTokens: [
          `temporary|${token('b')}|${REPLACEMENT_PLAN.candidateManifestSha256}`,
          `target|${token('1')}`,
        ],
      },
    });
  });

  it.each([
    ['only valid package', classified(rawSnapshot({ temporary: NEW_PACKAGE })), token('b')],
    ['symlink', classified(rawSnapshot({ temporary: wrongKind('2', 'symlink') })), token('2')],
    [
      'unreadable artifact',
      classified(rawSnapshot({ temporary: unreadable('2', 'openat', 13, 'EACCES') })),
      token('2'),
    ],
  ] as const)('rejects confirmed removal of %s', (_name, snapshot, observationToken) => {
    expect(
      planConfirmedMapworldRecovery(snapshot, {
        action: 'remove-artifact',
        role: 'temporary',
        observationToken,
      }),
    ).toMatchObject({
      ok: false,
      error: { code: MAPWORLD_RECOVERY_CODES.confirmationRequired },
    });
  });

  it('requires the exact marker token in a confirmed removal plan', () => {
    expect(
      planConfirmedMapworldRecovery(classified(rawSnapshot({ marker: regular('e', [0x7b]) })), {
        action: 'remove-marker',
        role: 'marker',
        observationToken: token('e'),
      }),
    ).toMatchObject({
      ok: true,
      value: {
        steps: ['remove-confirmed-marker'],
        confirmationTokens: [`marker|${token('e')}`],
      },
    });
  });

  it('rejects marker removal that the current recognized state did not offer', () => {
    const snapshot = classified(
      rawSnapshot({
        target: OLD_PACKAGE,
        temporary: NEW_PACKAGE,
        marker: regular('e', planMarkerBytes(REPLACEMENT_PLAN)),
      }),
    );
    expect(
      planConfirmedMapworldRecovery(snapshot, {
        action: 'remove-marker',
        role: 'marker',
        observationToken: token('e'),
      }),
    ).toMatchObject({
      ok: false,
      error: { code: MAPWORLD_RECOVERY_CODES.confirmationRequired },
    });
  });

  it('keeps a malformed marker until sibling recovery artifacts are resolved', () => {
    const snapshot = classified(
      rawSnapshot({ marker: regular('e', [0x7b]), temporary: invalidDirectory('2') }),
    );
    const decision = decideMapworldRecovery(snapshot);
    if (decision.kind !== 'attention') throw new Error('Expected marker attention.');
    expect(decision.attention.find(({ role }) => role === 'marker')?.confirmations).toEqual([]);
    expect(
      planConfirmedMapworldRecovery(snapshot, {
        action: 'remove-marker',
        role: 'marker',
        observationToken: token('e'),
      }),
    ).toMatchObject({
      ok: false,
      error: { code: MAPWORLD_RECOVERY_CODES.confirmationRequired },
    });
  });

  it('retains no mutable native bytes and exposes a deeply frozen decoded document', () => {
    const input = rawSnapshot({ target: directory('a', OLD_PLAN) });
    const target = input.target as unknown as {
      kind: string;
      entries: { path: string; bytes: number[] }[];
    };
    const snapshot = classified(input);
    const originalFingerprint = snapshot.target.fingerprint;
    target.kind = 'absent';
    if (target.entries[0] !== undefined) target.entries[0].bytes[0] = 255;

    expect(snapshot.target.classification).toBe('valid');
    expect(snapshot.target.fingerprint).toBe(originalFingerprint);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.target.document)).toBe(true);
    expect(Object.isFrozen(snapshot.target.document?.maps)).toBe(true);
    expect(Object.isFrozen(snapshot.target.document?.maps[0]?.aspects)).toBe(true);
  });

  it('keeps all recovery source and imports generator-free', () => {
    for (const source of [
      attentionSource,
      classificationSource,
      confirmationSource,
      decisionSource,
      markerSource,
      modelSource,
      nativeDtoSource,
      resultSource,
      schemasSource,
      decodeSource,
    ]) {
      expect(source).not.toContain('@ttrpg-map/generation');
      expect(source).not.toMatch(/\bgenerate(?:d|r|s|ion)?\b/u);
    }
  });

  it('post-plan source mutation cannot alter immutable save bytes', () => {
    const markerBefore = FIRST_PLAN.markerBase64;
    const fileBefore = FIRST_PLAN.files[0]?.bytesBase64;
    expect(typeof markerBefore).toBe('string');
    expect(typeof fileBefore).toBe('string');
    expect(FIRST_PLAN.markerBase64).toBe(markerBefore);
    expect(FIRST_PLAN.files[0]?.bytesBase64).toBe(fileBefore);
  });
});
