/** Compact, separately named evidence for accepted and generator-free reopened atlases. */

import { canonicalAspectBytes, canonicalAspectOutputBytes } from '@ttrpg-map/persistence';

import type { AcceptedAtlasState } from './atlas-workflow-generation.js';

export type AtlasAcceptedCheckpoint =
  'baseline' | 'geography-rerolled' | 'appearance-rerolled' | 'reopened';

export interface AtlasAspectEvidence {
  readonly aspectId: string;
  readonly aspectName: string;
  readonly variantRevision: number;
  readonly canonicalAspectByteLength: number;
  readonly canonicalAspectSha256: string;
  readonly canonicalOutputByteLength: number;
  readonly canonicalOutputSha256: string;
}

export interface AtlasAcceptedEvidence {
  readonly checkpoint: AtlasAcceptedCheckpoint;
  readonly aspects: readonly AtlasAspectEvidence[];
  readonly canonicalAspectSetSha256: string;
  readonly canonicalOutputSetSha256: string;
  readonly canonicalCoastlineOutputSha256: string;
  readonly renderSceneSha256: string;
}

export interface AtlasReopenComparison {
  readonly passed: boolean;
  readonly canonicalAspectsRestored: boolean;
  readonly canonicalOutputsRestored: boolean;
  readonly canonicalCoastlineRestored: boolean;
  readonly renderSceneRestored: boolean;
  readonly manifestFingerprintRestored: boolean;
}

export type AtlasAcceptedEvidenceResult =
  | { readonly ok: true; readonly evidence: AtlasAcceptedEvidence }
  | {
      readonly ok: false;
      readonly code: 'atlas.evidence.canonicalization-failed';
      readonly message: string;
    };

const TEXT_ENCODER = new TextEncoder();

export async function createAtlasAcceptedEvidence(
  accepted: AcceptedAtlasState,
  checkpoint: AtlasAcceptedCheckpoint,
): Promise<AtlasAcceptedEvidenceResult> {
  const root = accepted.document.maps[0];
  if (root?.mapKind !== 'world') return evidenceFailure('The accepted root world map is missing.');
  const aspects: AtlasAspectEvidence[] = [];
  for (const aspect of [...root.aspects].sort((left, right) =>
    compareText(left.aspectId, right.aspectId),
  )) {
    const aspectBytes = canonicalAspectBytes(aspect);
    const outputBytes = canonicalAspectOutputBytes(aspect);
    if (!aspectBytes.ok || !outputBytes.ok) {
      const diagnostic = !aspectBytes.ok
        ? aspectBytes.diagnostics[0]
        : !outputBytes.ok
          ? outputBytes.diagnostics[0]
          : undefined;
      return evidenceFailure(
        diagnostic?.message ?? 'An accepted atlas aspect could not be canonicalized.',
      );
    }
    aspects.push(
      Object.freeze({
        aspectId: aspect.aspectId,
        aspectName: aspect.aspectName,
        variantRevision: aspect.variantRevision,
        canonicalAspectByteLength: aspectBytes.value.byteLength,
        canonicalAspectSha256: await digest(aspectBytes.value),
        canonicalOutputByteLength: outputBytes.value.byteLength,
        canonicalOutputSha256: await digest(outputBytes.value),
      }),
    );
  }
  const coastline = aspects.find(({ aspectName }) => aspectName === 'worldCoastline.geometry');
  if (coastline === undefined) {
    return evidenceFailure('The accepted atlas has no canonical coastline evidence.');
  }
  const immutableAspects = Object.freeze(aspects);
  const canonicalAspectSetSha256 = await digestEvidenceSet(
    immutableAspects,
    'canonicalAspectSha256',
  );
  const canonicalOutputSetSha256 = await digestEvidenceSet(
    immutableAspects,
    'canonicalOutputSha256',
  );
  const renderSceneSha256 = await digest(TEXT_ENCODER.encode(JSON.stringify(accepted.scene)));
  return Object.freeze({
    ok: true,
    evidence: Object.freeze({
      checkpoint,
      aspects: immutableAspects,
      canonicalAspectSetSha256,
      canonicalOutputSetSha256,
      canonicalCoastlineOutputSha256: coastline.canonicalOutputSha256,
      renderSceneSha256,
    }),
  });
}

export function compareAtlasReopenEvidence(
  saved: AtlasAcceptedEvidence,
  reopened: AtlasAcceptedEvidence,
  savedManifestSha256: string,
  reopenedManifestSha256: string,
): AtlasReopenComparison {
  const comparison = {
    canonicalAspectsRestored: saved.canonicalAspectSetSha256 === reopened.canonicalAspectSetSha256,
    canonicalOutputsRestored: saved.canonicalOutputSetSha256 === reopened.canonicalOutputSetSha256,
    canonicalCoastlineRestored:
      saved.canonicalCoastlineOutputSha256 === reopened.canonicalCoastlineOutputSha256,
    renderSceneRestored: saved.renderSceneSha256 === reopened.renderSceneSha256,
    manifestFingerprintRestored: savedManifestSha256 === reopenedManifestSha256,
  };
  return Object.freeze({
    ...comparison,
    passed: Object.values(comparison).every(Boolean),
  });
}

async function digestEvidenceSet(
  aspects: readonly AtlasAspectEvidence[],
  field: 'canonicalAspectSha256' | 'canonicalOutputSha256',
): Promise<string> {
  return digest(
    TEXT_ENCODER.encode(
      JSON.stringify(
        aspects.map((aspect) => ({
          aspectId: aspect.aspectId,
          byteLength:
            field === 'canonicalAspectSha256'
              ? aspect.canonicalAspectByteLength
              : aspect.canonicalOutputByteLength,
          sha256: aspect[field],
        })),
      ),
    ),
  );
}

async function digest(bytes: Uint8Array): Promise<string> {
  const input = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(input).set(bytes);
  const digestBytes = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', input));
  return Array.from(digestBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function evidenceFailure(message: string): Extract<AtlasAcceptedEvidenceResult, { ok: false }> {
  return Object.freeze({
    ok: false,
    code: 'atlas.evidence.canonicalization-failed',
    message,
  });
}
