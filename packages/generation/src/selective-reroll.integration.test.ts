import {
  type AcceptedAspectRecord,
  commitAspectProposal,
  DOCUMENT_COMMAND_KINDS,
  DOCUMENT_DEPENDENCY_EFFECT_KINDS,
  DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES,
  type DocumentDependencyEffect,
  parseGenerationDiagnosticCode,
  type VariantRevision,
  type WorldDocument,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import {
  createCommitAspectProposalCommand,
  validateGenerationProposal,
} from './generator-contracts.js';
import {
  PROOF_MARKER_ASPECT_ID,
  PROOF_OUTLINE_ASPECT_ID,
  proofMarkerGenerator,
  type ProofOutlineOutput,
} from './proof-marker-generator.js';
import {
  aspect,
  invalidMarkerValidation,
  markerIds,
  OUTLINE_OUTPUT,
  PROOF_ENTITY_ID,
  proofDocument,
  proposeMarkers,
  rerollProposal,
  REVISION_ONE,
  REVISION_ZERO,
  rootMap,
  testEvidenceBytes,
  withMarkerLock,
  withoutLocks,
  WORLD_MAP_ID,
} from './selective-reroll-test-support.js';

describe('transactional selective reroll', () => {
  it('commits the fixed marker reroll deterministically without changing unrelated bytes', () => {
    const baseline = proofDocument();
    const repeatedBaseline = proofDocument();
    const baselineOutline = aspect(baseline, PROOF_OUTLINE_ASPECT_ID);
    const baselineMarkers = aspect(baseline, PROOF_MARKER_ASPECT_ID);
    const proposal = proposeMarkers(baseline, REVISION_ONE);
    const repeatedProposal = proposeMarkers(baseline, REVISION_ONE);

    expect(testEvidenceBytes(repeatedBaseline)).toStrictEqual(testEvidenceBytes(baseline));
    expect(testEvidenceBytes(repeatedProposal.proposal.output)).toStrictEqual(
      testEvidenceBytes(proposal.proposal.output),
    );

    const command = createCommitAspectProposalCommand(proposal, REVISION_ZERO, []);
    const first = commitAspectProposal(baseline, command);
    const second = commitAspectProposal(baseline, command);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error('Expected the valid marker reroll to commit.');

    const rerolledOutline = aspect(first.document, PROOF_OUTLINE_ASPECT_ID);
    const rerolledMarkers = aspect(first.document, PROOF_MARKER_ASPECT_ID);
    expect(testEvidenceBytes(first.document)).toStrictEqual(testEvidenceBytes(second.document));
    expect(testEvidenceBytes(rerolledOutline)).toStrictEqual(testEvidenceBytes(baselineOutline));
    expect(testEvidenceBytes(rerolledMarkers)).not.toStrictEqual(
      testEvidenceBytes(baselineMarkers),
    );
    expect(testEvidenceBytes(rerolledMarkers.acceptedOutput)).not.toStrictEqual(
      testEvidenceBytes(baselineMarkers.acceptedOutput),
    );
    expect(testEvidenceBytes(preservedMetadata(rerolledMarkers))).toStrictEqual(
      testEvidenceBytes(preservedMetadata(baselineMarkers)),
    );
    expect(rerolledMarkers.variantRevision).toBe(REVISION_ONE);
    expect(rerolledOutline.variantRevision).toBe(REVISION_ZERO);
    expect(markerIds(rerolledMarkers)).toStrictEqual(markerIds(baselineMarkers));
    expect(markerIds(rerolledMarkers)).toStrictEqual([...markerIds(rerolledMarkers)].sort());
    expect(first.committedAspectIds).toStrictEqual([PROOF_MARKER_ASPECT_ID]);
    expect(first.dependencyEffects).toStrictEqual([]);

    const baselineMap = rootMap(baseline);
    const rerolledMap = rootMap(first.document);
    expect(testEvidenceBytes(rerolledMap.entities)).toStrictEqual(
      testEvidenceBytes(baselineMap.entities),
    );
    expect(testEvidenceBytes(rerolledMap.constraints)).toStrictEqual(
      testEvidenceBytes(baselineMap.constraints),
    );
    expect(testEvidenceBytes(rerolledMap.locks)).toStrictEqual(
      testEvidenceBytes(baselineMap.locks),
    );
    expect(testEvidenceBytes(rerolledMap.decoration)).toStrictEqual(
      testEvidenceBytes(baselineMap.decoration),
    );
    expect(testEvidenceBytes(rerolledMap.layout)).toStrictEqual(
      testEvidenceBytes(baselineMap.layout),
    );
    expect(rerolledMap.aspects.map(({ aspectId }) => aspectId)).toStrictEqual(
      baselineMap.aspects.map(({ aspectId }) => aspectId),
    );
    expect(first.document.worldDocumentId).toBe(baseline.worldDocumentId);
    expect(first.document.rootMapId).toBe(baseline.rootMapId);
    expect(first.document.maps.map(({ mapId }) => mapId)).toStrictEqual(
      baseline.maps.map(({ mapId }) => mapId),
    );
  });

  it('owns a deeply immutable accepted snapshot instead of caller proposal aliases', () => {
    const baseline = proofDocument();
    const mutable = mutableMarkerValidation(baseline);
    const command = createCommitAspectProposalCommand(mutable.validation, REVISION_ZERO, []);
    const result = commitAspectProposal(baseline, command);

    expect(Object.isFrozen(mutable.output)).toBe(false);
    expect(Object.isFrozen(mutable.seedMetadata)).toBe(false);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));

    const committed = aspect(result.document, PROOF_MARKER_ASPECT_ID);
    const committedBeforeCallerMutation = testEvidenceBytes(committed);
    expect(committed.acceptedOutput).not.toBe(mutable.output);
    expect(committed.seedMetadata).not.toBe(mutable.seedMetadata);
    expect(committed.diagnostics).not.toBe(mutable.diagnostics);
    expectDeeplyFrozen(committed);

    mutateMarkerProposalSource(mutable);

    expect(testEvidenceBytes(committed)).toStrictEqual(committedBeforeCallerMutation);
    const committedOutput = committed.acceptedOutput as {
      readonly markers: readonly { readonly position: { readonly longitudeTicks: number } }[];
    };
    const committedPosition = committedOutput.markers[0]?.position;
    if (committedPosition === undefined) throw new Error('Expected one committed proof marker.');
    expect(() => {
      (committedPosition as { longitudeTicks: number }).longitudeTicks += 1;
    }).toThrow(TypeError);
  });

  it('rejects every required failure with stable codes and the exact original document', () => {
    const baseline = proofDocument();
    const valid = proposeMarkers(baseline, REVISION_ONE);
    const validCommand = createCommitAspectProposalCommand(valid, REVISION_ZERO, []);
    const invalidOutput = invalidMarkerValidation(baseline, valid.proposal);
    const cases = [
      {
        name: 'stale revision',
        document: baseline,
        command: { ...validCommand, expectedPreviousRevision: REVISION_ONE },
        code: DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.staleRevision,
      },
      {
        name: 'invalid proposal',
        document: baseline,
        command: createCommitAspectProposalCommand(invalidOutput, REVISION_ZERO, []),
        code: DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.invalidProposal,
      },
      {
        name: 'invalid dependency effect',
        document: baseline,
        command: {
          ...validCommand,
          declaredDependencyEffects: [
            { aspectId: PROOF_OUTLINE_ASPECT_ID, effect: 'invalidated' as const },
          ],
        },
        code: DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.invalidDependencyEffect,
      },
      {
        name: 'cyclic dependency effect',
        document: baseline,
        command: {
          ...validCommand,
          proposedReplacement: {
            ...valid.proposal,
            dependencyAspects: [{ aspectId: PROOF_MARKER_ASPECT_ID }],
          },
        },
        code: DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.cyclicDependencyEffect,
      },
      {
        name: 'conflicting lock',
        document: withMarkerLock(baseline),
        command: validCommand,
        code: DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.conflictingLock,
      },
    ];

    for (const rejected of cases) {
      const before = testEvidenceBytes(rejected.document);
      const result = commitAspectProposal(rejected.document, rejected.command);
      expect(result.ok, rejected.name).toBe(false);
      if (result.ok) throw new Error(`Expected ${rejected.name} to be rejected.`);
      expect(result.document).toBe(rejected.document);
      expect(testEvidenceBytes(result.document)).toStrictEqual(before);
      expect(result.diagnostics.map(({ code }) => code)).toContain(rejected.code);
    }
  });

  it('atomically changes an explicitly selected dependent and no other accepted state', () => {
    const baseline = withoutLocks(proofDocument());
    const outline = aspect(baseline, PROOF_OUTLINE_ASPECT_ID);
    const mutableMarker = mutableMarkerValidation(baseline);
    const markerCommit = createCommitAspectProposalCommand(
      mutableMarker.validation,
      REVISION_ZERO,
      [],
    );
    const dependencyEffects: DocumentDependencyEffect[] = [
      {
        aspectId: PROOF_MARKER_ASPECT_ID,
        effect: DOCUMENT_DEPENDENCY_EFFECT_KINDS.replace,
        commit: markerCommit,
      },
    ];
    const command = {
      kind: DOCUMENT_COMMAND_KINDS.commitAspectProposal,
      target: {
        mapId: WORLD_MAP_ID,
        entityId: PROOF_ENTITY_ID,
        aspectId: PROOF_OUTLINE_ASPECT_ID,
      },
      expectedPreviousRevision: REVISION_ZERO,
      proposedReplacement: rerollProposal(outline, OUTLINE_OUTPUT),
      diagnostics: [],
      declaredDependencyEffects: dependencyEffects,
    } as const;
    const result = commitAspectProposal(baseline, command);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.committedAspectIds).toStrictEqual([
      PROOF_MARKER_ASPECT_ID,
      PROOF_OUTLINE_ASPECT_ID,
    ]);
    expect(aspect(result.document, PROOF_OUTLINE_ASPECT_ID).variantRevision).toBe(REVISION_ONE);
    expect(aspect(result.document, PROOF_MARKER_ASPECT_ID).variantRevision).toBe(REVISION_ONE);
    expect(testEvidenceBytes(rootMap(result.document).constraints)).toStrictEqual(
      testEvidenceBytes(rootMap(baseline).constraints),
    );
    expect(rootMap(result.document).aspects.map(({ aspectId }) => aspectId)).toStrictEqual(
      rootMap(baseline).aspects.map(({ aspectId }) => aspectId),
    );

    const returnedEffectsBeforeCallerMutation = testEvidenceBytes(result.dependencyEffects);
    expect(result.dependencyEffects).not.toBe(dependencyEffects);
    expect(result.dependencyEffects[0]).not.toBe(dependencyEffects[0]);
    expectDeeplyFrozen(result.dependencyEffects);
    mutateMarkerProposalSource(mutableMarker);
    dependencyEffects.push({
      aspectId: PROOF_OUTLINE_ASPECT_ID,
      effect: 'invalidated',
    });
    expect(testEvidenceBytes(result.dependencyEffects)).toStrictEqual(
      returnedEffectsBeforeCallerMutation,
    );
  });

  it('retains and rejects a locked dependent made inconsistent by an upstream reroll', () => {
    const baseline = withMarkerLock(withoutLocks(proofDocument()));
    const outline = aspect(baseline, PROOF_OUTLINE_ASPECT_ID);
    const command = {
      kind: DOCUMENT_COMMAND_KINDS.commitAspectProposal,
      target: {
        mapId: WORLD_MAP_ID,
        entityId: PROOF_ENTITY_ID,
        aspectId: PROOF_OUTLINE_ASPECT_ID,
      },
      expectedPreviousRevision: REVISION_ZERO,
      proposedReplacement: rerollProposal(outline, OUTLINE_OUTPUT),
      diagnostics: [],
      declaredDependencyEffects: [
        {
          aspectId: PROOF_MARKER_ASPECT_ID,
          effect: 'locked-inconsistent' as const,
        },
      ],
    } as const;
    const before = testEvidenceBytes(baseline);
    const result = commitAspectProposal(baseline, command);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected the conflicting dependent lock to reject the commit.');
    expect(result.document).toBe(baseline);
    expect(testEvidenceBytes(result.document)).toStrictEqual(before);
    expect(result.diagnostics.map(({ code }) => code)).toContain(
      DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.conflictingLock,
    );
  });
});

function preservedMetadata(record: AcceptedAspectRecord): unknown {
  return {
    mapId: record.mapId,
    entityId: record.entityId,
    aspectId: record.aspectId,
    aspectName: record.aspectName,
    generatorId: record.generatorId,
    generatorVersion: record.generatorVersion,
    parameterSchemaVersion: record.parameterSchemaVersion,
    parameters: record.parameters,
    seedScope: record.seedScope,
    seedMetadata: {
      ...record.seedMetadata,
      variantRevision: 0,
    },
    dependencyAspects: record.dependencyAspects,
    generationStatus: record.generationStatus,
  };
}

function mutableMarkerValidation(document: WorldDocument) {
  const generated = proposeMarkers(document, REVISION_ONE);
  if (generated.status !== 'proposed') {
    throw new Error('Expected the fixed mutable marker proposal to be valid.');
  }
  const diagnosticCode = parseGenerationDiagnosticCode('proof.markers.snapshot-warning');
  if (!diagnosticCode.ok) throw new Error(JSON.stringify(diagnosticCode.diagnostic));

  const output = {
    markers: generated.proposal.output.markers.map((marker) => ({
      markerId: marker.markerId,
      position: { ...marker.position },
    })),
  };
  const seedMetadata = { ...generated.proposal.seedMetadata };
  const diagnostic = {
    code: diagnosticCode.value,
    severity: 'warning' as const,
    target: { aspectId: PROOF_MARKER_ASPECT_ID },
    message: 'The mutable proposal is valid and ready for snapshot testing.',
    suggestedAction: 'Commit the proposal through the named document transaction.',
  };
  const diagnostics = [diagnostic];
  const proposal = {
    ...generated.proposal,
    target: {
      ...generated.proposal.target,
      aspect: { ...generated.proposal.target.aspect },
    },
    parameters: { ...generated.proposal.parameters },
    seedMetadata,
    dependencyAspects: generated.proposal.dependencyAspects.map((dependency) => ({
      ...dependency,
    })),
    output,
    diagnostics,
  };
  const outline = aspect(document, PROOF_OUTLINE_ASPECT_ID);
  const validation = validateGenerationProposal(proofMarkerGenerator, proposal, {
    target: proposal.target,
    inputs: [
      {
        reference: { aspectId: PROOF_OUTLINE_ASPECT_ID },
        aspectName: outline.aspectName,
        variantRevision: outline.variantRevision,
        acceptedOutput: outline.acceptedOutput as ProofOutlineOutput,
      },
    ],
  });
  if (validation.status !== 'proposed') {
    throw new Error('Expected generator validation to accept the mutable marker proposal.');
  }
  return {
    diagnostic,
    diagnostics,
    output,
    proposal,
    seedMetadata,
    validation,
  };
}

function mutateMarkerProposalSource(source: ReturnType<typeof mutableMarkerValidation>): void {
  const firstMarker = source.output.markers[0];
  if (firstMarker === undefined) throw new Error('Expected one mutable proof marker.');
  (firstMarker.position as { longitudeTicks: number }).longitudeTicks += 1;
  (source.seedMetadata as { variantRevision: VariantRevision }).variantRevision = REVISION_ZERO;
  source.diagnostic.target.aspectId = PROOF_OUTLINE_ASPECT_ID;
  source.diagnostic.message = 'Caller mutation after commit.';
  source.diagnostics.push({ ...source.diagnostic, target: { ...source.diagnostic.target } });
}

function expectDeeplyFrozen(value: unknown, visited = new Set<object>()): void {
  if (typeof value !== 'object' || value === null || visited.has(value)) return;
  visited.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && 'value' in descriptor) {
      expectDeeplyFrozen(descriptor.value, visited);
    }
  }
}
