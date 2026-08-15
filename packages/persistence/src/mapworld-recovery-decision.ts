import {
  attentionDecision,
  markerAttention,
  markerConflict,
  packageAttentions,
  uniquelySelectableTarget,
  validCandidates,
} from './mapworld-recovery-attention.js';
import {
  type ClassifiedMapworldPackageCandidate,
  type ClassifiedMapworldRecoverySnapshot,
  MAPWORLD_RECOVERY_CODES,
  type MapworldRecoveryDecision,
  type MapworldRecoveryExpectedObservation,
  type MapworldRecoveryNativePlan,
  type MapworldRecoveryStep,
} from './mapworld-recovery-model.js';

export { validCandidates };

type ExpectedRelation = 'absent' | 'empty' | 'exact' | 'conflict';

export function decideMapworldRecovery(
  snapshot: ClassifiedMapworldRecoverySnapshot,
): MapworldRecoveryDecision {
  if (snapshot.marker.classification !== 'valid' || snapshot.marker.marker === undefined) {
    return decideWithoutValidMarker(snapshot);
  }
  return snapshot.marker.marker.operation === 'first-save'
    ? decideFirstSave(snapshot, snapshot.marker.marker.candidateManifestSha256)
    : decideReplacement(
        snapshot,
        snapshot.marker.marker.previousManifestSha256 ?? '',
        snapshot.marker.marker.candidateManifestSha256,
      );
}

function decideFirstSave(
  snapshot: ClassifiedMapworldRecoverySnapshot,
  candidateFingerprint: string,
): MapworldRecoveryDecision {
  const target = relation(snapshot.target, candidateFingerprint);
  const temporary = relation(snapshot.temporary, candidateFingerprint);
  if (snapshot.backup.classification !== 'absent') return markerConflict(snapshot, null, null);
  if (target === 'absent' && temporary === 'exact') {
    return applyDecision(snapshot, snapshot.temporary, [
      'rename-temporary-to-target',
      'sync-target-commit',
      'remove-marker',
    ]);
  }
  if (
    target === 'exact' &&
    (temporary === 'absent' || temporary === 'empty' || temporary === 'exact')
  ) {
    const cleanup =
      temporary === 'exact'
        ? (['remove-temporary-exact-candidate'] as const)
        : temporary === 'empty'
          ? (['remove-temporary-empty'] as const)
          : ([] as const);
    return applyDecision(snapshot, snapshot.target, [
      'sync-target-commit',
      ...cleanup,
      'remove-marker',
    ]);
  }
  if (target === 'exact' && temporary === 'conflict') {
    return markerConflict(snapshot, snapshot.target, candidateFingerprint);
  }
  if (target === 'absent' && (temporary === 'absent' || temporary === 'empty')) {
    const steps: MapworldRecoveryStep[] = [];
    if (temporary === 'empty') steps.push('remove-temporary-empty');
    steps.push('remove-marker');
    return applyDecision(snapshot, null, steps);
  }
  if (target === 'absent' && temporary === 'conflict') {
    return attentionDecision(
      snapshot,
      MAPWORLD_RECOVERY_CODES.noValidPackage,
      null,
      packageAttentions(snapshot, candidateFingerprint, null),
    );
  }
  return markerConflict(
    snapshot,
    target === 'exact' ? snapshot.target : null,
    candidateFingerprint,
  );
}

function decideReplacement(
  snapshot: ClassifiedMapworldRecoverySnapshot,
  previousFingerprint: string,
  candidateFingerprint: string,
): MapworldRecoveryDecision {
  const targetOld = relation(snapshot.target, previousFingerprint);
  const targetNew = relation(snapshot.target, candidateFingerprint);
  const temporaryNew = relation(snapshot.temporary, candidateFingerprint);
  const backupOld = relation(snapshot.backup, previousFingerprint);
  if (targetNew === 'exact' && (temporaryNew === 'conflict' || backupOld === 'conflict')) {
    return markerConflict(snapshot, snapshot.target, candidateFingerprint, previousFingerprint);
  }
  if (targetOld === 'exact' && temporaryNew === 'exact' && backupOld === 'absent') {
    return applyDecision(snapshot, snapshot.temporary, [
      'rename-target-to-backup',
      'rename-temporary-to-target',
      'sync-target-commit',
      'remove-backup-exact-previous',
      'remove-marker',
    ]);
  }
  if (targetNew === 'absent' && temporaryNew === 'exact' && backupOld === 'exact') {
    return applyDecision(snapshot, snapshot.temporary, [
      'rename-temporary-to-target',
      'sync-target-commit',
      'remove-backup-exact-previous',
      'remove-marker',
    ]);
  }
  if (
    targetNew === 'exact' &&
    (temporaryNew === 'absent' || temporaryNew === 'empty' || temporaryNew === 'exact') &&
    (backupOld === 'absent' || backupOld === 'empty' || backupOld === 'exact')
  ) {
    const steps: MapworldRecoveryStep[] = ['sync-target-commit'];
    if (temporaryNew === 'exact') steps.push('remove-temporary-exact-candidate');
    if (temporaryNew === 'empty') steps.push('remove-temporary-empty');
    if (backupOld === 'exact') steps.push('remove-backup-exact-previous');
    if (backupOld === 'empty') steps.push('remove-backup-empty');
    steps.push('remove-marker');
    return applyDecision(snapshot, snapshot.target, steps);
  }
  if (
    targetOld === 'exact' &&
    (temporaryNew === 'absent' || temporaryNew === 'empty') &&
    backupOld === 'absent'
  ) {
    return applyDecision(snapshot, snapshot.target, [
      ...(temporaryNew === 'empty' ? (['remove-temporary-empty'] as const) : []),
      'remove-marker',
    ]);
  }
  if (targetOld === 'exact' && temporaryNew === 'conflict' && backupOld === 'absent') {
    return markerConflict(snapshot, snapshot.target, candidateFingerprint, previousFingerprint);
  }
  if (
    targetNew === 'absent' &&
    (temporaryNew === 'absent' || temporaryNew === 'empty') &&
    backupOld === 'exact'
  ) {
    return applyDecision(snapshot, snapshot.backup, [
      'rename-backup-to-target',
      ...(temporaryNew === 'empty' ? (['remove-temporary-empty'] as const) : []),
      'remove-marker',
    ]);
  }
  if (targetNew === 'absent' && temporaryNew === 'conflict' && backupOld === 'exact') {
    return applyDecision(snapshot, snapshot.backup, ['rename-backup-to-target']);
  }
  return markerConflict(
    snapshot,
    targetNew === 'exact' || targetOld === 'exact' ? snapshot.target : null,
    candidateFingerprint,
    previousFingerprint,
  );
}

function decideWithoutValidMarker(
  snapshot: ClassifiedMapworldRecoverySnapshot,
): MapworldRecoveryDecision {
  const valid = validCandidates(snapshot);
  const distinctFingerprints = new Set(valid.map(({ fingerprint }) => fingerprint));
  const markerNeedsAttention = snapshot.marker.classification !== 'absent';
  if (markerNeedsAttention) {
    const selected = uniquelySelectableTarget(snapshot, distinctFingerprints.size);
    return attentionDecision(
      snapshot,
      snapshot.marker.classification === 'incompatible'
        ? MAPWORLD_RECOVERY_CODES.markerVersionIncompatible
        : snapshot.marker.classification === 'invalid'
          ? MAPWORLD_RECOVERY_CODES.markerInvalid
          : MAPWORLD_RECOVERY_CODES.artifactConflict,
      selected,
      [markerAttention(snapshot), ...packageAttentions(snapshot, null, null)],
    );
  }
  if (distinctFingerprints.size >= 2) {
    return attentionDecision(
      snapshot,
      MAPWORLD_RECOVERY_CODES.ambiguousCandidates,
      null,
      packageAttentions(snapshot, null, null, true),
    );
  }
  const targetIsValid = snapshot.target.classification === 'valid';
  const recoveryArtifactsExist =
    snapshot.temporary.classification !== 'absent' || snapshot.backup.classification !== 'absent';
  if (targetIsValid) {
    const artifactAttention = packageAttentions(snapshot, null, null).filter(
      ({ role }) => role !== 'target',
    );
    return recoveryArtifactsExist
      ? attentionDecision(
          snapshot,
          MAPWORLD_RECOVERY_CODES.artifactConflict,
          snapshot.target,
          Object.freeze(artifactAttention),
        )
      : cleanDecision(snapshot.target, true);
  }
  if (snapshot.target.classification !== 'absent') {
    return attentionDecision(
      snapshot,
      MAPWORLD_RECOVERY_CODES.artifactConflict,
      valid[0] ?? null,
      packageAttentions(snapshot, null, null),
    );
  }
  if (valid.length > 0) {
    const selected =
      snapshot.temporary.classification === 'valid' ? snapshot.temporary : snapshot.backup;
    return applyDecision(snapshot, selected, [
      selected.role === 'temporary' ? 'rename-temporary-to-target' : 'rename-backup-to-target',
      'sync-target-commit',
    ]);
  }
  return attentionDecision(
    snapshot,
    MAPWORLD_RECOVERY_CODES.noValidPackage,
    null,
    packageAttentions(snapshot, null, null),
  );
}

function applyDecision(
  snapshot: ClassifiedMapworldRecoverySnapshot,
  selected: ClassifiedMapworldPackageCandidate | null,
  steps: readonly MapworldRecoveryStep[],
): MapworldRecoveryDecision {
  return Object.freeze({
    kind: 'apply',
    selected,
    plan: nativePlan(snapshot, selected, steps, []),
  });
}

function cleanDecision(
  selected: ClassifiedMapworldPackageCandidate | null,
  canSave: boolean,
): MapworldRecoveryDecision {
  return Object.freeze({ kind: 'clean', selected, canSave });
}

export function nativePlan(
  snapshot: ClassifiedMapworldRecoverySnapshot,
  selected: ClassifiedMapworldPackageCandidate | null,
  steps: readonly MapworldRecoveryStep[],
  confirmationTokens: readonly string[],
): MapworldRecoveryNativePlan {
  return Object.freeze({
    snapshotId: snapshot.snapshotId,
    selectedRole: selected?.role ?? null,
    selectedObservationToken: selected?.observationToken ?? null,
    selectedManifestSha256: selected?.fingerprint ?? null,
    expectedObservations: expectedObservations(snapshot),
    steps: Object.freeze([...steps]),
    confirmationTokens: Object.freeze([...confirmationTokens]),
  });
}

function expectedObservations(
  snapshot: ClassifiedMapworldRecoverySnapshot,
): readonly MapworldRecoveryExpectedObservation[] {
  return Object.freeze(
    (
      [
        ['target', snapshot.target.observationToken],
        ['temporary', snapshot.temporary.observationToken],
        ['backup', snapshot.backup.observationToken],
        ['marker', snapshot.marker.observationToken],
      ] as const
    ).map(([role, observationToken]) => Object.freeze({ role, observationToken })),
  );
}

function relation(
  candidate: ClassifiedMapworldPackageCandidate,
  expectedFingerprint: string,
): ExpectedRelation {
  if (candidate.classification === 'absent') return 'absent';
  if (candidate.classification === 'empty') return 'empty';
  return candidate.classification === 'valid' && candidate.fingerprint === expectedFingerprint
    ? 'exact'
    : 'conflict';
}
