import {
  decideMapworldRecovery,
  nativePlan,
  validCandidates,
} from './mapworld-recovery-decision.js';
import {
  type ClassifiedMapworldPackageCandidate,
  type ClassifiedMapworldRecoverySnapshot,
  MAPWORLD_RECOVERY_CODES,
  type MapworldPackageRole,
  type MapworldRecoveryConfirmation,
  type MapworldRecoveryNativePlan,
  type MapworldRecoveryResult,
  type MapworldRecoveryRole,
  type MapworldRecoveryStep,
} from './mapworld-recovery-model.js';
import { recoveryFailure, recoverySuccess } from './mapworld-recovery-result.js';

export function planConfirmedMapworldRecovery(
  snapshot: ClassifiedMapworldRecoverySnapshot,
  confirmation: MapworldRecoveryConfirmation,
): MapworldRecoveryResult<MapworldRecoveryNativePlan> {
  if (!isOfferedConfirmation(snapshot, confirmation)) return invalidConfirmation();
  const candidate = packageCandidate(snapshot, confirmation.role);
  if (confirmation.action === 'remove-marker') {
    if (
      snapshot.marker.observationToken !== confirmation.observationToken ||
      snapshot.marker.classification === 'absent' ||
      snapshot.marker.observedKind !== 'regular-file' ||
      snapshot.temporary.classification !== 'absent' ||
      snapshot.backup.classification !== 'absent'
    ) {
      return invalidConfirmation();
    }
    return recoverySuccess(
      nativePlan(
        snapshot,
        validCandidates(snapshot)[0] ?? null,
        ['remove-confirmed-marker'],
        [confirmationToken('marker', confirmation.observationToken)],
      ),
    );
  }
  if (candidate?.observationToken !== confirmation.observationToken) {
    return invalidConfirmation();
  }
  if (confirmation.action === 'select-candidate') {
    if (
      candidate.classification !== 'valid' ||
      candidate.fingerprint !== confirmation.fingerprint
    ) {
      return invalidConfirmation();
    }
    return recoverySuccess(nativePlan(snapshot, candidate, [], []));
  }
  if (confirmation.action === 'promote-candidate') {
    return planConfirmedPromotion(snapshot, candidate, confirmation);
  }
  const survivor = validCandidates(snapshot).find(({ role }) => role !== candidate.role);
  if (
    candidate.classification === 'absent' ||
    candidate.classification === 'unreadable' ||
    candidate.observedKind === 'symlink' ||
    candidate.observedKind === 'special' ||
    (candidate.classification === 'valid' && survivor === undefined) ||
    ((candidate.classification === 'invalid' || candidate.classification === 'wrong-kind') &&
      survivor === undefined)
  ) {
    return recoveryFailure(
      MAPWORLD_RECOVERY_CODES.confirmationRequired,
      'The confirmation would remove the only valid package or an unsupported artifact kind.',
      'Preserve the artifact or choose a different valid package first.',
      { role: candidate.role, actualFingerprint: candidate.fingerprint ?? null },
    );
  }
  if (
    candidate.classification === 'valid'
      ? confirmation.fingerprint !== candidate.fingerprint
      : confirmation.fingerprint !== undefined
  ) {
    return invalidConfirmation();
  }
  return recoverySuccess(
    nativePlan(
      snapshot,
      survivor ?? null,
      [confirmedRemovalStep(candidate.role)],
      [confirmationToken(candidate.role, candidate.observationToken, candidate.fingerprint)],
    ),
  );
}

function planConfirmedPromotion(
  snapshot: ClassifiedMapworldRecoverySnapshot,
  candidate: ClassifiedMapworldPackageCandidate,
  confirmation: Extract<MapworldRecoveryConfirmation, { readonly action: 'promote-candidate' }>,
): MapworldRecoveryResult<MapworldRecoveryNativePlan> {
  if (
    candidate.role === 'target' ||
    candidate.classification !== 'valid' ||
    candidate.fingerprint !== confirmation.fingerprint
  ) {
    return invalidConfirmation();
  }
  const steps: MapworldRecoveryStep[] = [];
  const tokens = [`${candidate.role}|${candidate.observationToken}|${confirmation.fingerprint}`];
  if (snapshot.target.classification !== 'absent') {
    if (
      confirmation.invalidTargetObservationToken !== snapshot.target.observationToken ||
      snapshot.target.classification === 'valid' ||
      snapshot.target.classification === 'unreadable' ||
      snapshot.target.observedKind === 'symlink' ||
      snapshot.target.observedKind === 'special'
    ) {
      return invalidConfirmation();
    }
    steps.push('remove-confirmed-target');
    tokens.push(confirmationToken('target', snapshot.target.observationToken));
  }
  steps.push(
    candidate.role === 'temporary' ? 'rename-temporary-to-target' : 'rename-backup-to-target',
    'sync-target-commit',
  );
  return recoverySuccess(nativePlan(snapshot, candidate, steps, tokens));
}

function packageCandidate(
  snapshot: ClassifiedMapworldRecoverySnapshot,
  role: MapworldRecoveryRole,
): ClassifiedMapworldPackageCandidate | undefined {
  switch (role) {
    case 'target':
      return snapshot.target;
    case 'temporary':
      return snapshot.temporary;
    case 'backup':
      return snapshot.backup;
    case 'marker':
      return undefined;
  }
}

function confirmationToken(
  role: MapworldRecoveryRole,
  observationToken: string,
  fingerprint?: string,
): string {
  return `${role}|${observationToken}${fingerprint === undefined ? '' : `|${fingerprint}`}`;
}

function isOfferedConfirmation(
  snapshot: ClassifiedMapworldRecoverySnapshot,
  confirmation: MapworldRecoveryConfirmation,
): boolean {
  const decision = decideMapworldRecovery(snapshot);
  return (
    decision.kind === 'attention' &&
    decision.attention.some((attention) =>
      attention.confirmations.some((offered) => confirmationsEqual(offered, confirmation)),
    )
  );
}

function confirmationsEqual(
  offered: MapworldRecoveryConfirmation,
  submitted: MapworldRecoveryConfirmation,
): boolean {
  if (
    offered.action !== submitted.action ||
    offered.role !== submitted.role ||
    offered.observationToken !== submitted.observationToken
  ) {
    return false;
  }
  if (offered.action === 'remove-marker' || submitted.action === 'remove-marker') {
    return offered.action === submitted.action;
  }
  if (offered.action === 'remove-artifact' || submitted.action === 'remove-artifact') {
    return offered.action === submitted.action && offered.fingerprint === submitted.fingerprint;
  }
  if (offered.action === 'select-candidate' || submitted.action === 'select-candidate') {
    return offered.action === submitted.action && offered.fingerprint === submitted.fingerprint;
  }
  return (
    offered.fingerprint === submitted.fingerprint &&
    offered.invalidTargetObservationToken === submitted.invalidTargetObservationToken
  );
}

function confirmedRemovalStep(
  role: MapworldPackageRole,
): Extract<MapworldRecoveryStep, `remove-confirmed-${string}`> {
  switch (role) {
    case 'target':
      return 'remove-confirmed-target';
    case 'temporary':
      return 'remove-confirmed-temporary';
    case 'backup':
      return 'remove-confirmed-backup';
  }
}

function invalidConfirmation<Value>(): MapworldRecoveryResult<Value> {
  return recoveryFailure(
    MAPWORLD_RECOVERY_CODES.confirmationRequired,
    'The candidate-specific confirmation does not match the immutable recovery snapshot.',
    'Enumerate again and confirm the exact current role, fingerprint, and observation token.',
  );
}
