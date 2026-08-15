import {
  type ClassifiedMapworldPackageCandidate,
  type ClassifiedMapworldRecoverySnapshot,
  MAPWORLD_RECOVERY_CODES,
  type MapworldRecoveryAttention,
  type MapworldRecoveryCode,
  type MapworldRecoveryConfirmation,
  type MapworldRecoveryDecision,
} from './mapworld-recovery-model.js';

export function markerConflict(
  snapshot: ClassifiedMapworldRecoverySnapshot,
  selected: ClassifiedMapworldPackageCandidate | null,
  candidateFingerprint: string | null,
  previousFingerprint: string | null = null,
): MapworldRecoveryDecision {
  const actualSelected =
    selected ?? (snapshot.target.classification === 'valid' ? snapshot.target : null);
  const packageAttention = packageAttentions(
    snapshot,
    candidateFingerprint,
    previousFingerprint,
    false,
    true,
  ).filter(
    ({ role, actualFingerprint, expectedFingerprint }) =>
      !(
        role === actualSelected?.role &&
        actualFingerprint !== null &&
        actualFingerprint === expectedFingerprint
      ),
  );
  return attentionDecision(
    snapshot,
    MAPWORLD_RECOVERY_CODES.artifactConflict,
    actualSelected,
    Object.freeze([...packageAttention, validMarkerConflictAttention(snapshot)]),
  );
}

export function packageAttentions(
  snapshot: ClassifiedMapworldRecoverySnapshot,
  candidateFingerprint: string | null,
  previousFingerprint: string | null,
  includeValidSelections = false,
  includeExpectedCandidates = false,
): readonly MapworldRecoveryAttention[] {
  const attentions: MapworldRecoveryAttention[] = [];
  for (const candidate of [snapshot.target, snapshot.temporary, snapshot.backup]) {
    if (candidate.classification === 'absent') continue;
    const expectedFingerprint = expectedCandidateFingerprint(
      candidate,
      candidateFingerprint,
      previousFingerprint,
    );
    const isExpected =
      candidate.classification === 'valid' && candidate.fingerprint === expectedFingerprint;
    if (isExpected && !includeValidSelections && !includeExpectedCandidates) continue;
    const confirmations = confirmationsForCandidate(snapshot, candidate, includeValidSelections);
    attentions.push(
      Object.freeze({
        code:
          candidate.classification === 'valid'
            ? includeValidSelections
              ? MAPWORLD_RECOVERY_CODES.ambiguousCandidates
              : isExpected
                ? MAPWORLD_RECOVERY_CODES.artifactConflict
                : MAPWORLD_RECOVERY_CODES.fingerprintMismatch
            : MAPWORLD_RECOVERY_CODES.artifactConflict,
        role: candidate.role,
        observedKind: candidate.observedKind,
        observationToken: candidate.observationToken,
        expectedFingerprint,
        actualFingerprint: candidate.fingerprint ?? null,
        diagnostics: candidate.diagnostics ?? Object.freeze([]),
        confirmations,
        ...(candidate.osContext === undefined ? {} : { osContext: candidate.osContext }),
      }),
    );
  }
  return Object.freeze(attentions);
}

export function markerAttention(
  snapshot: ClassifiedMapworldRecoverySnapshot,
): MapworldRecoveryAttention {
  const canRemove =
    snapshot.marker.observedKind === 'regular-file' &&
    snapshot.temporary.classification === 'absent' &&
    snapshot.backup.classification === 'absent';
  return Object.freeze({
    code:
      snapshot.marker.error?.code ??
      (snapshot.marker.classification === 'incompatible'
        ? MAPWORLD_RECOVERY_CODES.markerVersionIncompatible
        : snapshot.marker.classification === 'invalid'
          ? MAPWORLD_RECOVERY_CODES.markerInvalid
          : MAPWORLD_RECOVERY_CODES.artifactConflict),
    role: 'marker',
    observedKind: snapshot.marker.observedKind,
    observationToken: snapshot.marker.observationToken,
    expectedFingerprint: null,
    actualFingerprint: null,
    diagnostics: snapshot.marker.error?.diagnostics ?? Object.freeze([]),
    confirmations: canRemove
      ? Object.freeze([
          Object.freeze({
            action: 'remove-marker' as const,
            role: 'marker' as const,
            observationToken: snapshot.marker.observationToken,
          }),
        ])
      : Object.freeze([]),
    ...(snapshot.marker.osContext === undefined ? {} : { osContext: snapshot.marker.osContext }),
  });
}

export function attentionDecision(
  _snapshot: ClassifiedMapworldRecoverySnapshot,
  code: MapworldRecoveryCode,
  selected: ClassifiedMapworldPackageCandidate | null,
  attention: readonly MapworldRecoveryAttention[],
): MapworldRecoveryDecision {
  return Object.freeze({
    kind: 'attention',
    code,
    selected,
    canOpenReadOnly: selected?.classification === 'valid',
    attention: Object.freeze([...attention]),
  });
}

export function validCandidates(
  snapshot: ClassifiedMapworldRecoverySnapshot,
): readonly ClassifiedMapworldPackageCandidate[] {
  return [snapshot.target, snapshot.temporary, snapshot.backup].filter(
    (candidate) => candidate.classification === 'valid',
  );
}

export function uniquelySelectableTarget(
  snapshot: ClassifiedMapworldRecoverySnapshot,
  distinctFingerprintCount: number,
): ClassifiedMapworldPackageCandidate | null {
  return distinctFingerprintCount <= 1 ? (validCandidates(snapshot)[0] ?? null) : null;
}

function validMarkerConflictAttention(
  snapshot: ClassifiedMapworldRecoverySnapshot,
): MapworldRecoveryAttention {
  const canRemove =
    snapshot.marker.observedKind === 'regular-file' &&
    snapshot.temporary.classification === 'absent' &&
    snapshot.backup.classification === 'absent';
  return Object.freeze({
    code: MAPWORLD_RECOVERY_CODES.artifactConflict,
    role: 'marker',
    observedKind: snapshot.marker.observedKind,
    observationToken: snapshot.marker.observationToken,
    expectedFingerprint: null,
    actualFingerprint: null,
    diagnostics: Object.freeze([]),
    confirmations: canRemove
      ? Object.freeze([
          Object.freeze({
            action: 'remove-marker' as const,
            role: 'marker' as const,
            observationToken: snapshot.marker.observationToken,
          }),
        ])
      : Object.freeze([]),
  });
}

function expectedCandidateFingerprint(
  candidate: ClassifiedMapworldPackageCandidate,
  candidateFingerprint: string | null,
  previousFingerprint: string | null,
): string | null {
  if (candidate.role === 'temporary') return candidateFingerprint;
  if (candidate.role === 'backup') return previousFingerprint;
  if (
    candidate.fingerprint !== undefined &&
    (candidate.fingerprint === candidateFingerprint ||
      candidate.fingerprint === previousFingerprint)
  ) {
    return candidate.fingerprint;
  }
  return candidateFingerprint ?? previousFingerprint;
}

function confirmationsForCandidate(
  snapshot: ClassifiedMapworldRecoverySnapshot,
  candidate: ClassifiedMapworldPackageCandidate,
  selectValid: boolean,
): readonly MapworldRecoveryConfirmation[] {
  const candidates = validCandidates(snapshot);
  if (candidate.observedKind === 'symlink' || candidate.observedKind === 'special')
    return Object.freeze([]);
  if (candidate.classification === 'unreadable') return Object.freeze([]);
  if (selectValid && candidate.classification === 'valid' && candidate.fingerprint !== undefined) {
    const confirmations: MapworldRecoveryConfirmation[] = [
      Object.freeze({
        action: 'select-candidate',
        role: candidate.role,
        observationToken: candidate.observationToken,
        fingerprint: candidate.fingerprint,
      }),
    ];
    if (candidates.length > 1) {
      confirmations.push(
        Object.freeze({
          action: 'remove-artifact',
          role: candidate.role,
          observationToken: candidate.observationToken,
          fingerprint: candidate.fingerprint,
        }),
      );
    }
    return Object.freeze(confirmations);
  }
  if (
    candidate.role !== 'target' &&
    candidate.classification === 'valid' &&
    candidate.fingerprint !== undefined &&
    snapshot.target.classification !== 'valid' &&
    snapshot.target.classification !== 'unreadable' &&
    snapshot.target.observedKind !== 'symlink' &&
    snapshot.target.observedKind !== 'special'
  ) {
    return Object.freeze([
      Object.freeze({
        action: 'promote-candidate',
        role: candidate.role,
        observationToken: candidate.observationToken,
        fingerprint: candidate.fingerprint,
        ...(snapshot.target.classification === 'absent'
          ? {}
          : { invalidTargetObservationToken: snapshot.target.observationToken }),
      }),
    ]);
  }
  if (
    (candidate.classification === 'valid' && candidates.length <= 1) ||
    ((candidate.classification === 'invalid' || candidate.classification === 'wrong-kind') &&
      candidates.length === 0)
  ) {
    return Object.freeze([]);
  }
  return Object.freeze([
    Object.freeze({
      action: 'remove-artifact',
      role: candidate.role,
      observationToken: candidate.observationToken,
      ...(candidate.fingerprint === undefined ? {} : { fingerprint: candidate.fingerprint }),
    }),
  ]);
}
