import type { AtlasControls } from '@ttrpg-map/core';

import { gatedAtlasFixture, type GatedAtlasFixtureId } from './packaged-atlas-observer-dispatch.js';

export const PACKAGED_EXPORT_OBSERVER_RECEIPT_LABEL = 'Packaged export observer receipt' as const;
export const PACKAGED_EXPORT_OBSERVER_RECEIPT_VERSION = 'packaged-export-observer-v1' as const;

export type PackagedExportFormat = 'svg' | 'png';
export type PackagedExportObserverPhase = 'reopened' | 'svg-complete' | 'png-complete';

interface AcceptedEvidenceReceipt {
  readonly checkpoint: string;
  readonly canonicalAspectSetSha256: string;
  readonly canonicalOutputSetSha256: string;
  readonly canonicalCoastlineOutputSha256: string;
  readonly renderSceneSha256: string;
}

interface ReopenComparisonReceipt {
  readonly passed: boolean;
  readonly canonicalAspectsRestored: boolean;
  readonly canonicalOutputsRestored: boolean;
  readonly canonicalCoastlineRestored: boolean;
  readonly renderSceneRestored: boolean;
  readonly manifestFingerprintRestored: boolean;
}

interface NativeExportReceipt {
  readonly targetPath: string;
  readonly sha256: string;
  readonly byteLength: number;
  readonly platform: 'macos' | 'linux';
}

interface SvgExportReceipt extends NativeExportReceipt {
  readonly profileId: 'atlas-svg-v1';
  readonly profileVersion: 1;
  readonly widthMillimeters: number;
  readonly heightMillimeters: number;
}

interface PngExportReceipt extends NativeExportReceipt {
  readonly profileId: 'atlas-png-v1';
  readonly profileVersion: 1;
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface PackagedExportObserverState {
  readonly fixtureId: GatedAtlasFixtureId | undefined;
  readonly worldSeed: string;
  readonly controls: AtlasControls;
  readonly workflowPhase: string;
  readonly isBusy: boolean;
  readonly hasPreview: boolean;
  readonly acceptedCheckpoint: string | undefined;
  readonly acceptedIdentity: object | undefined;
  readonly acceptedWorldSeed: string | undefined;
  readonly acceptedControls: AtlasControls | undefined;
  readonly savedEvidence: AcceptedEvidenceReceipt | undefined;
  readonly reopenedEvidence: AcceptedEvidenceReceipt | undefined;
  readonly reopenComparison: ReopenComparisonReceipt | undefined;
  readonly savedManifestSha256: string | undefined;
  readonly reopenedManifestSha256: string | undefined;
  readonly reopenGenerationInvocationCount: number | undefined;
  readonly saveTargetPath: string;
  readonly svgExportReceipt: SvgExportReceipt | undefined;
  readonly pngExportReceipt: PngExportReceipt | undefined;
}

export interface PackagedExportObserverCompletion {
  readonly format: PackagedExportFormat;
  readonly sha256: string;
  readonly byteLength: number;
  readonly platform: 'macos' | 'linux';
  readonly profileId: 'atlas-svg-v1' | 'atlas-png-v1';
  readonly profileVersion: 1;
  readonly dimensions: '400x200mm' | '8192x4096px';
  readonly nativeAtomicReceiptVerified: true;
  readonly acceptedStateUnchanged: true;
}

export interface PackagedExportObserverReceipt {
  readonly version: typeof PACKAGED_EXPORT_OBSERVER_RECEIPT_VERSION;
  readonly fixtureId: GatedAtlasFixtureId;
  readonly worldSeed: string;
  readonly controls: AtlasControls;
  readonly phase: PackagedExportObserverPhase;
  readonly productionSavePath: true;
  readonly productionReopenPath: true;
  readonly productionSvgPath: true;
  readonly productionPngPath: true;
  readonly canonicalAspectSetSha256: string;
  readonly canonicalOutputSetSha256: string;
  readonly canonicalCoastlineOutputSha256: string;
  readonly renderSceneSha256: string;
  readonly manifestSha256: string;
  readonly reopenComparisonPassed: true;
  readonly reopenGeneratorInvocations: 0;
  readonly completion?: PackagedExportObserverCompletion | undefined;
}

interface ExportObserverDispatchKeyEvent {
  readonly altKey: boolean;
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly repeat: boolean;
  preventDefault(): void;
}

interface ReopenedAuthority {
  readonly fixtureId: GatedAtlasFixtureId;
  readonly acceptedIdentity: object;
  readonly evidence: AcceptedEvidenceReceipt;
  readonly manifestSha256: string;
  readonly saveTargetPath: string;
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SVG_MAXIMUM_BYTES = 32 * 1_024 * 1_024;
const PNG_MAXIMUM_BYTES = 64 * 1_024 * 1_024;

export function packagedExportDispatch(
  event: ExportObserverDispatchKeyEvent,
): PackagedExportFormat | undefined {
  if (!hasExactObserverModifiers(event)) return undefined;
  if (event.code === 'KeyV') return 'svg';
  if (event.code === 'KeyN') return 'png';
  return undefined;
}

/** Installs only the two success-dispatch chords authorized for observer-enabled packages. */
export function installPackagedExportObserverDispatch(
  target: EventTarget,
  enabled: boolean,
  currentState: () => PackagedExportObserverState,
  exportSvg: (targetPath: string) => Promise<unknown>,
  exportPng: (targetPath: string) => Promise<unknown>,
  recordCompletion: (completion: PackagedExportObserverCompletion | undefined) => void,
): () => void {
  if (!enabled) return () => undefined;
  let dispatchSequence = 0;
  const listener = (rawEvent: Event): void => {
    const event = rawEvent as KeyboardEvent;
    const format = packagedExportDispatch(event);
    if (format === undefined) return;
    event.preventDefault();
    const sequence = ++dispatchSequence;
    recordCompletion(undefined);
    void requestExactFixtureExport(
      format,
      currentState(),
      format === 'svg' ? exportSvg : exportPng,
      currentState,
    ).then((completion) => {
      if (sequence === dispatchSequence) recordCompletion(completion);
    });
  };
  target.addEventListener('keydown', listener);
  return () => {
    dispatchSequence += 1;
    target.removeEventListener('keydown', listener);
  };
}

export async function requestExactFixtureExport(
  format: PackagedExportFormat,
  beforeState: PackagedExportObserverState,
  productionExport: (targetPath: string) => Promise<unknown>,
  currentState: () => PackagedExportObserverState,
): Promise<PackagedExportObserverCompletion | undefined> {
  const before = reopenedAuthority(beforeState);
  if (before === undefined) return undefined;
  const targetPath = exportTargetPath(before.saveTargetPath, format);
  if (targetPath === undefined) return undefined;
  try {
    await productionExport(targetPath);
  } catch {
    return undefined;
  }
  const afterState = currentState();
  const after = reopenedAuthority(afterState);
  if (
    after?.fixtureId !== before.fixtureId ||
    after.acceptedIdentity !== before.acceptedIdentity ||
    after.manifestSha256 !== before.manifestSha256 ||
    !sameEvidence(after.evidence, before.evidence)
  ) {
    return undefined;
  }
  return exportCompletion(format, targetPath, afterState);
}

export function packagedExportObserverReceipt(
  state: PackagedExportObserverState,
  completion: PackagedExportObserverCompletion | undefined,
): PackagedExportObserverReceipt | undefined {
  const authority = reopenedAuthority(state);
  if (authority === undefined) return undefined;
  if (
    completion !== undefined &&
    exportCompletion(
      completion.format,
      exportTargetPath(authority.saveTargetPath, completion.format),
      state,
    ) === undefined
  ) {
    return undefined;
  }
  const fixture = gatedAtlasFixture(authority.fixtureId);
  return Object.freeze({
    version: PACKAGED_EXPORT_OBSERVER_RECEIPT_VERSION,
    fixtureId: fixture.fixtureId,
    worldSeed: fixture.worldSeed,
    controls: fixture.controls,
    phase: completion === undefined ? 'reopened' : `${completion.format}-complete`,
    productionSavePath: true,
    productionReopenPath: true,
    productionSvgPath: true,
    productionPngPath: true,
    canonicalAspectSetSha256: authority.evidence.canonicalAspectSetSha256,
    canonicalOutputSetSha256: authority.evidence.canonicalOutputSetSha256,
    canonicalCoastlineOutputSha256: authority.evidence.canonicalCoastlineOutputSha256,
    renderSceneSha256: authority.evidence.renderSceneSha256,
    manifestSha256: authority.manifestSha256,
    reopenComparisonPassed: true,
    reopenGeneratorInvocations: 0,
    ...(completion === undefined ? {} : { completion }),
  });
}

export function exportTargetPath(
  saveTargetPath: string,
  format: PackagedExportFormat,
): string | undefined {
  if (
    !saveTargetPath.startsWith('/') ||
    saveTargetPath.includes('\0') ||
    !saveTargetPath.endsWith('.mapworld')
  ) {
    return undefined;
  }
  const basenameStart = saveTargetPath.lastIndexOf('/') + 1;
  const basename = saveTargetPath.slice(basenameStart, -'.mapworld'.length);
  if (basename.length === 0 || basename === '.' || basename === '..') return undefined;
  return `${saveTargetPath.slice(0, -'.mapworld'.length)}.issue-97.${format}`;
}

function reopenedAuthority(state: PackagedExportObserverState): ReopenedAuthority | undefined {
  if (
    state.fixtureId === undefined ||
    state.workflowPhase !== 'reopened' ||
    state.isBusy ||
    state.hasPreview ||
    state.acceptedCheckpoint !== 'reopened' ||
    state.acceptedIdentity === undefined ||
    state.acceptedWorldSeed === undefined ||
    state.acceptedControls === undefined ||
    state.savedEvidence?.checkpoint !== 'appearance-rerolled' ||
    state.reopenedEvidence?.checkpoint !== 'reopened' ||
    state.reopenComparison === undefined ||
    !completeReopenComparison(state.reopenComparison) ||
    state.savedManifestSha256 === undefined ||
    state.reopenedManifestSha256 === undefined ||
    state.savedManifestSha256 !== state.reopenedManifestSha256 ||
    state.reopenGenerationInvocationCount !== 0 ||
    exportTargetPath(state.saveTargetPath, 'svg') === undefined ||
    exportTargetPath(state.saveTargetPath, 'png') === undefined
  ) {
    return undefined;
  }
  const fixture = gatedAtlasFixture(state.fixtureId);
  if (
    state.worldSeed !== fixture.worldSeed ||
    state.acceptedWorldSeed !== fixture.worldSeed ||
    !sameControls(state.controls, fixture.controls) ||
    !sameControls(state.acceptedControls, fixture.controls) ||
    !sameEvidence(state.savedEvidence, state.reopenedEvidence)
  ) {
    return undefined;
  }
  return {
    fixtureId: fixture.fixtureId,
    acceptedIdentity: state.acceptedIdentity,
    evidence: state.reopenedEvidence,
    manifestSha256: state.reopenedManifestSha256,
    saveTargetPath: state.saveTargetPath,
  };
}

function exportCompletion(
  format: PackagedExportFormat,
  expectedTargetPath: string | undefined,
  state: PackagedExportObserverState,
): PackagedExportObserverCompletion | undefined {
  if (expectedTargetPath === undefined) return undefined;
  if (format === 'svg') {
    const receipt = state.svgExportReceipt;
    if (
      receipt?.targetPath !== expectedTargetPath ||
      receipt.widthMillimeters !== 400 ||
      receipt.heightMillimeters !== 200 ||
      receipt.platform !== 'macos' ||
      !validArtifact(receipt, SVG_MAXIMUM_BYTES)
    ) {
      return undefined;
    }
    return Object.freeze({
      format,
      sha256: receipt.sha256,
      byteLength: receipt.byteLength,
      platform: receipt.platform,
      profileId: receipt.profileId,
      profileVersion: receipt.profileVersion,
      dimensions: '400x200mm',
      nativeAtomicReceiptVerified: true,
      acceptedStateUnchanged: true,
    });
  }
  const receipt = state.pngExportReceipt;
  if (
    receipt?.targetPath !== expectedTargetPath ||
    receipt.widthPx !== 8192 ||
    receipt.heightPx !== 4096 ||
    receipt.platform !== 'macos' ||
    !validArtifact(receipt, PNG_MAXIMUM_BYTES)
  ) {
    return undefined;
  }
  return Object.freeze({
    format,
    sha256: receipt.sha256,
    byteLength: receipt.byteLength,
    platform: receipt.platform,
    profileId: receipt.profileId,
    profileVersion: receipt.profileVersion,
    dimensions: '8192x4096px',
    nativeAtomicReceiptVerified: true,
    acceptedStateUnchanged: true,
  });
}

function validArtifact(receipt: NativeExportReceipt, maximumBytes: number): boolean {
  return (
    SHA256_PATTERN.test(receipt.sha256) &&
    Number.isSafeInteger(receipt.byteLength) &&
    receipt.byteLength > 0 &&
    receipt.byteLength <= maximumBytes
  );
}

function completeReopenComparison(comparison: ReopenComparisonReceipt): boolean {
  return (
    comparison.passed &&
    comparison.canonicalAspectsRestored &&
    comparison.canonicalOutputsRestored &&
    comparison.canonicalCoastlineRestored &&
    comparison.renderSceneRestored &&
    comparison.manifestFingerprintRestored
  );
}

function sameEvidence(left: AcceptedEvidenceReceipt, right: AcceptedEvidenceReceipt): boolean {
  return (
    left.canonicalAspectSetSha256 === right.canonicalAspectSetSha256 &&
    left.canonicalOutputSetSha256 === right.canonicalOutputSetSha256 &&
    left.canonicalCoastlineOutputSha256 === right.canonicalCoastlineOutputSha256 &&
    left.renderSceneSha256 === right.renderSceneSha256
  );
}

function sameControls(left: AtlasControls, right: AtlasControls): boolean {
  return (
    left.worldCircumferenceKm === right.worldCircumferenceKm &&
    left.targetWaterCoveragePercent === right.targetWaterCoveragePercent &&
    left.continentCountIntent === right.continentCountIntent &&
    left.continentDistribution === right.continentDistribution &&
    left.fragmentationPercent === right.fragmentationPercent &&
    left.islandAbundancePercent === right.islandAbundancePercent &&
    left.archipelagoAbundancePercent === right.archipelagoAbundancePercent &&
    left.oceanConnectivity === right.oceanConnectivity &&
    left.polarCharacter === right.polarCharacter
  );
}

function hasExactObserverModifiers(event: ExportObserverDispatchKeyEvent): boolean {
  return event.metaKey && event.altKey && event.ctrlKey && !event.repeat;
}
