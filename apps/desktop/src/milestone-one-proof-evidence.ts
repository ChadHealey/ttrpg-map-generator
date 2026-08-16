/** Canonical semantic and disposable render evidence for the three Milestone 1 checkpoints. */

import { sha256, type WorldDocument } from '@ttrpg-map/core';
import {
  MILESTONE_ONE_PROOF_ENTITY_ID,
  milestoneOneMarkerIds,
  milestoneOneProofAspects,
  milestoneOneRootMap,
} from '@ttrpg-map/generation';
import {
  canonicalAspectBytes,
  canonicalAspectOutputBytes,
  encodeMapworld,
} from '@ttrpg-map/persistence';
import { renderSceneToSvg } from '@ttrpg-map/render';

import { createMilestoneOneProofScene } from './milestone-one-proof-scene.js';

export type MilestoneOneProofCheckpoint = 'baseline' | 'rerolled' | 'reopened';

export interface MilestoneOneAspectEvidence {
  readonly aspectId: string;
  readonly revision: number;
  readonly canonicalAspectSha256: string;
  readonly canonicalOutputSha256: string;
  readonly aspectBytes: Uint8Array;
  readonly outputBytes: Uint8Array;
}

export interface MilestoneOneProofEvidence {
  readonly checkpoint: MilestoneOneProofCheckpoint;
  readonly outline: MilestoneOneAspectEvidence;
  readonly markers: MilestoneOneAspectEvidence;
  readonly markerIds: readonly string[];
  readonly unaffectedState: unknown;
  readonly packageManifestSha256: string;
  readonly canonicalSvgSha256: string;
  readonly canonicalSvg: string;
}

export interface MilestoneOneIsolationComparison {
  readonly outlineAspectStable: boolean;
  readonly outlineOutputStable: boolean;
  readonly outlineRevisionStable: boolean;
  readonly markerAspectChanged: boolean;
  readonly markerOutputChanged: boolean;
  readonly markerIdentityStable: boolean;
  readonly unaffectedStateStable: boolean;
  readonly outlineRenderStable: boolean;
  readonly markerRenderChanged: boolean;
  readonly passed: boolean;
}

export interface MilestoneOneReopenComparison {
  readonly outlineAspectRestored: boolean;
  readonly outlineOutputRestored: boolean;
  readonly markerAspectRestored: boolean;
  readonly markerOutputRestored: boolean;
  readonly revisionsRestored: boolean;
  readonly markerIdentityRestored: boolean;
  readonly unaffectedStateRestored: boolean;
  readonly packageBytesRestored: boolean;
  readonly renderSceneRestored: boolean;
  readonly passed: boolean;
}

/** Compute hashes from persistence-owned canonical bytes and SVG from the shared RenderScene. */
export function createMilestoneOneProofEvidence(
  document: WorldDocument,
  checkpoint: MilestoneOneProofCheckpoint,
): MilestoneOneProofEvidence {
  const aspects = milestoneOneProofAspects(document);
  const outline = aspectEvidence(aspects.outline);
  const markers = aspectEvidence(aspects.markers);
  const scene = createMilestoneOneProofScene({
    sourceEntityId: MILESTONE_ONE_PROOF_ENTITY_ID,
    outline: aspects.outline.acceptedOutput.points,
    markers: aspects.markers.acceptedOutput.markers,
  });
  const canonicalSvg = renderSceneToSvg(scene);
  const package_ = persistenceValue(encodeMapworld(document));
  const manifest = package_.files.find(({ path }) => path === 'manifest.json');
  if (manifest === undefined) throw new Error('Encoded proof package omitted manifest.json.');
  return Object.freeze({
    checkpoint,
    outline,
    markers,
    markerIds: milestoneOneMarkerIds(document),
    unaffectedState: unaffectedState(document),
    packageManifestSha256: hash(manifest.bytes),
    canonicalSvgSha256: hash(new TextEncoder().encode(canonicalSvg)),
    canonicalSvg,
  });
}

export function compareMilestoneOneIsolation(
  baselineDocument: WorldDocument,
  rerolledDocument: WorldDocument,
  baseline: MilestoneOneProofEvidence,
  rerolled: MilestoneOneProofEvidence,
): MilestoneOneIsolationComparison {
  const baselineScene = proofScene(baselineDocument);
  const rerolledScene = proofScene(rerolledDocument);
  const comparison = {
    outlineAspectStable: bytesEqual(baseline.outline.aspectBytes, rerolled.outline.aspectBytes),
    outlineOutputStable: bytesEqual(baseline.outline.outputBytes, rerolled.outline.outputBytes),
    outlineRevisionStable: baseline.outline.revision === rerolled.outline.revision,
    markerAspectChanged: !bytesEqual(baseline.markers.aspectBytes, rerolled.markers.aspectBytes),
    markerOutputChanged: !bytesEqual(baseline.markers.outputBytes, rerolled.markers.outputBytes),
    markerIdentityStable: valuesEqual(baseline.markerIds, rerolled.markerIds),
    unaffectedStateStable: valuesEqual(
      unaffectedState(baselineDocument),
      unaffectedState(rerolledDocument),
    ),
    outlineRenderStable: valuesEqual(baselineScene.nodes[1], rerolledScene.nodes[1]),
    markerRenderChanged: !valuesEqual(baselineScene.nodes.slice(2), rerolledScene.nodes.slice(2)),
  };
  return Object.freeze({
    ...comparison,
    passed: Object.values(comparison).every(Boolean),
  });
}

export function compareMilestoneOneReopen(
  rerolledDocument: WorldDocument,
  reopenedDocument: WorldDocument,
  rerolled: MilestoneOneProofEvidence,
  reopened: MilestoneOneProofEvidence,
): MilestoneOneReopenComparison {
  const comparison = {
    outlineAspectRestored: bytesEqual(rerolled.outline.aspectBytes, reopened.outline.aspectBytes),
    outlineOutputRestored: bytesEqual(rerolled.outline.outputBytes, reopened.outline.outputBytes),
    markerAspectRestored: bytesEqual(rerolled.markers.aspectBytes, reopened.markers.aspectBytes),
    markerOutputRestored: bytesEqual(rerolled.markers.outputBytes, reopened.markers.outputBytes),
    revisionsRestored:
      rerolled.outline.revision === reopened.outline.revision &&
      rerolled.markers.revision === reopened.markers.revision,
    markerIdentityRestored: valuesEqual(rerolled.markerIds, reopened.markerIds),
    unaffectedStateRestored: valuesEqual(rerolled.unaffectedState, reopened.unaffectedState),
    packageBytesRestored: packageBytesEqual(rerolledDocument, reopenedDocument),
    renderSceneRestored: rerolled.canonicalSvg === reopened.canonicalSvg,
  };
  return Object.freeze({
    ...comparison,
    passed: Object.values(comparison).every(Boolean),
  });
}

/** Compare retained audit evidence after unload without retaining a reconstructable package. */
export function compareMilestoneOneReopenEvidence(
  rerolled: MilestoneOneProofEvidence,
  reopened: MilestoneOneProofEvidence,
): Omit<MilestoneOneReopenComparison, 'packageBytesRestored'> & {
  readonly manifestFingerprintRestored: boolean;
} {
  const comparison = {
    outlineAspectRestored: bytesEqual(rerolled.outline.aspectBytes, reopened.outline.aspectBytes),
    outlineOutputRestored: bytesEqual(rerolled.outline.outputBytes, reopened.outline.outputBytes),
    markerAspectRestored: bytesEqual(rerolled.markers.aspectBytes, reopened.markers.aspectBytes),
    markerOutputRestored: bytesEqual(rerolled.markers.outputBytes, reopened.markers.outputBytes),
    revisionsRestored:
      rerolled.outline.revision === reopened.outline.revision &&
      rerolled.markers.revision === reopened.markers.revision,
    markerIdentityRestored: valuesEqual(rerolled.markerIds, reopened.markerIds),
    unaffectedStateRestored: valuesEqual(rerolled.unaffectedState, reopened.unaffectedState),
    manifestFingerprintRestored: rerolled.packageManifestSha256 === reopened.packageManifestSha256,
    renderSceneRestored: rerolled.canonicalSvg === reopened.canonicalSvg,
  };
  return Object.freeze({
    ...comparison,
    passed: Object.values(comparison).every(Boolean),
  });
}

function aspectEvidence(
  aspect: ReturnType<typeof milestoneOneProofAspects>['outline' | 'markers'],
): MilestoneOneAspectEvidence {
  const aspectBytes = persistenceValue(canonicalAspectBytes(aspect));
  const outputBytes = persistenceValue(canonicalAspectOutputBytes(aspect));
  return Object.freeze({
    aspectId: aspect.aspectId,
    revision: aspect.variantRevision,
    canonicalAspectSha256: hash(aspectBytes),
    canonicalOutputSha256: hash(outputBytes),
    aspectBytes,
    outputBytes,
  });
}

function proofScene(document: WorldDocument) {
  const aspects = milestoneOneProofAspects(document);
  return createMilestoneOneProofScene({
    sourceEntityId: MILESTONE_ONE_PROOF_ENTITY_ID,
    outline: aspects.outline.acceptedOutput.points,
    markers: aspects.markers.acceptedOutput.markers,
  });
}

function unaffectedState(document: WorldDocument): unknown {
  const map = milestoneOneRootMap(document);
  const markerAspectId = milestoneOneProofAspects(document).markers.aspectId;
  return Object.freeze({
    worldDocumentId: document.worldDocumentId,
    displayName: document.displayName,
    worldSeed: document.worldSeed,
    rootMapId: document.rootMapId,
    map: Object.freeze({
      mapId: map.mapId,
      mapKind: map.mapKind,
      scaleClass: map.scaleClass,
      displayName: map.displayName,
      coordinateSystem: map.coordinateSystem,
      extent: map.extent,
      entities: map.entities,
      unselectedAspects: map.aspects.filter(({ aspectId }) => aspectId !== markerAspectId),
      constraints: map.constraints,
      locks: map.locks,
      decoration: map.decoration,
      layout: map.layout,
    }),
  });
}

function packageBytesEqual(left: WorldDocument, right: WorldDocument): boolean {
  const leftPackage = persistenceValue(encodeMapworld(left));
  const rightPackage = persistenceValue(encodeMapworld(right));
  return (
    leftPackage.files.length === rightPackage.files.length &&
    leftPackage.files.every((file, index) => {
      const rightFile = rightPackage.files[index];
      if (rightFile === undefined) return false;
      return file.path === rightFile.path && bytesEqual(file.bytes, rightFile.bytes);
    })
  );
}

function persistenceValue<Value>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly diagnostics: readonly unknown[] },
): Value {
  if (!result.ok)
    throw new Error(`Milestone 1 evidence failed: ${JSON.stringify(result.diagnostics)}`);
  return result.value;
}

function hash(bytes: Uint8Array): string {
  return Array.from(sha256(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => valuesEqual(value, right[index]))
    );
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    valuesEqual(leftKeys, rightKeys) && leftKeys.every((key) => valuesEqual(left[key], right[key]))
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}
