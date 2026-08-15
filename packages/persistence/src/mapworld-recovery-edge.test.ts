import { describe, expect, it } from 'vitest';

import { planConfirmedMapworldRecovery } from './mapworld-recovery-confirmation.js';
import { decideMapworldRecovery } from './mapworld-recovery-decision.js';
import { MAPWORLD_RECOVERY_CODES } from './mapworld-recovery-model.js';
import {
  classified,
  invalidDirectory,
  NEW_PACKAGE,
  rawSnapshot,
  regular,
  token,
} from './mapworld-recovery-test-support.js';

describe('native recovery snapshot edge representations', () => {
  it.each(['target', 'temporary', 'backup', 'marker'] as const)(
    'keeps an exact-name collision on %s as immutable unreadable attention with no confirmation',
    (role) => {
      const observationToken = token(role === 'marker' ? '4' : '2');
      const collision = {
        kind: 'unreadable',
        observationToken,
        osContext: {
          primitive: 'verify-exact-artifact-name',
          osErrorNumber: null,
          osErrorName: null,
        },
      };
      const snapshot = classified(
        rawSnapshot({
          target: NEW_PACKAGE,
          ...(role === 'target' ? { temporary: NEW_PACKAGE } : {}),
          [role]: collision,
        }),
      );
      const candidate = snapshot[role];
      expect(candidate).toMatchObject({
        classification: 'unreadable',
        observedKind: 'unreadable',
        osContext: { primitive: 'verify-exact-artifact-name' },
      });
      expect(Object.isFrozen(candidate.osContext)).toBe(true);

      const decision = decideMapworldRecovery(snapshot);
      if (decision.kind !== 'attention')
        throw new Error('Expected exact-name collision attention.');
      expect(decision.code).toBe(MAPWORLD_RECOVERY_CODES.artifactConflict);
      expect(decision.attention.find((attention) => attention.role === role)).toMatchObject({
        observationToken,
        osContext: { primitive: 'verify-exact-artifact-name' },
        confirmations: [],
      });
      expect(decision.attention.every(({ confirmations }) => confirmations.length === 0)).toBe(
        true,
      );
    },
  );

  it('preserves a readable invalid tree until an exact valid survivor exists', () => {
    const snapshot = classified(
      rawSnapshot({
        temporary: {
          kind: 'invalid-directory',
          observationToken: token('2'),
          entries: [],
          directories: ['maps'],
        },
      }),
    );
    expect(snapshot.temporary).toMatchObject({
      classification: 'invalid',
      observedKind: 'invalid-directory',
    });
    const decision = decideMapworldRecovery(snapshot);
    if (decision.kind !== 'attention') throw new Error('Expected invalid-tree attention.');
    expect(decision.attention[0]?.confirmations).toEqual([]);

    const withSurvivor = decideMapworldRecovery(
      classified(
        rawSnapshot({
          target: NEW_PACKAGE,
          temporary: {
            kind: 'invalid-directory',
            observationToken: token('2'),
            entries: [],
            directories: ['maps'],
          },
        }),
      ),
    );
    if (withSurvivor.kind !== 'attention') throw new Error('Expected invalid-tree attention.');
    const removal = withSurvivor.attention
      .find(({ role }) => role === 'temporary')
      ?.confirmations.find(({ action }) => action === 'remove-artifact');
    expect(removal).toEqual({
      action: 'remove-artifact',
      role: 'temporary',
      observationToken: token('2'),
    });
    if (removal === undefined) throw new Error('Expected exact invalid-tree removal.');
    expect(
      planConfirmedMapworldRecovery(
        classified(
          rawSnapshot({
            target: NEW_PACKAGE,
            temporary: {
              kind: 'invalid-directory',
              observationToken: token('2'),
              entries: [],
              directories: ['maps'],
            },
          }),
        ),
        removal,
      ),
    ).toMatchObject({
      ok: true,
      value: {
        selectedRole: 'target',
        selectedObservationToken: token('b'),
        steps: ['remove-confirmed-temporary'],
      },
    });
  });

  it.each([
    ['malformed package directory', invalidDirectory('2')],
    ['wrong-kind regular file', regular('2', [1])],
  ] as const)('does not offer or accept removal of a sole %s', (_name, temporary) => {
    const snapshot = classified(rawSnapshot({ temporary }));
    const decision = decideMapworldRecovery(snapshot);
    if (decision.kind !== 'attention') throw new Error('Expected artifact attention.');
    expect(decision.attention.find(({ role }) => role === 'temporary')?.confirmations).toEqual([]);
    expect(
      planConfirmedMapworldRecovery(snapshot, {
        action: 'remove-artifact',
        role: 'temporary',
        observationToken: token('2'),
      }),
    ).toMatchObject({
      ok: false,
      error: { code: MAPWORLD_RECOVERY_CODES.confirmationRequired },
    });
  });

  it('accepts native Unicode-scalar path order rather than UTF-16 code-unit order', () => {
    const bmp = '\u{e000}.json';
    const supplementary = '\u{10000}.json';
    const snapshot = classified(
      rawSnapshot({
        temporary: {
          kind: 'directory',
          observationToken: token('2'),
          entries: [
            { path: bmp, bytes: [1] },
            { path: supplementary, bytes: [2] },
          ],
        },
      }),
    );
    expect(snapshot.temporary.classification).toBe('invalid');
  });
});
