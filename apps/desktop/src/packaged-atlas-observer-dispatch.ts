import {
  type AtlasControls,
  formatWorldSeed,
  parseAtlasControls,
  parseWorldSeed,
} from '@ttrpg-map/core';

import controlMaxBaselineIndex from '../../../fixtures/fixed-seeds/milestone-2-atlas-control-max/expected/baseline/accepted-aspects.aspects.index.canonical?raw';
import controlMaxDefinition from '../../../fixtures/fixed-seeds/milestone-2-atlas-control-max/fixture-definition.json';
import fragmentedIslandsBaselineIndex from '../../../fixtures/fixed-seeds/milestone-2-atlas-fragmented-islands/expected/baseline/accepted-aspects.aspects.index.canonical?raw';
import fragmentedIslandsDefinition from '../../../fixtures/fixed-seeds/milestone-2-atlas-fragmented-islands/fixture-definition.json';
import proofBaselineIndex from '../../../fixtures/fixed-seeds/milestone-2-atlas-proof/expected/baseline/accepted-aspects.aspects.index.canonical?raw';
import proofDefinition from '../../../fixtures/fixed-seeds/milestone-2-atlas-proof/fixture-definition.json';
import type { AtlasAcceptedEvidence } from './atlas-workflow-evidence.js';
import type { AcceptedAtlasState } from './atlas-workflow-generation.js';

export const PACKAGED_ATLAS_OBSERVER_RECEIPT_LABEL = 'Packaged atlas observer receipt' as const;
export const PACKAGED_ATLAS_OBSERVER_RECEIPT_VERSION =
  'packaged-atlas-observer-fixture-v1' as const;
export const PACKAGED_GENERATION_CANCELLATION_RECEIPT_LABEL =
  'Packaged generation cancellation observer receipt' as const;
export const PACKAGED_GENERATION_CANCELLATION_RECEIPT_VERSION =
  'packaged-generation-cancellation-observer-v1' as const;

export const GATED_ATLAS_FIXTURE_IDS = Object.freeze([
  'milestone-2-atlas-proof',
  'milestone-2-atlas-fragmented-islands',
  'milestone-2-atlas-control-max',
] as const);

export type GatedAtlasFixtureId = (typeof GATED_ATLAS_FIXTURE_IDS)[number];

export interface GatedAtlasFixture {
  readonly fixtureId: GatedAtlasFixtureId;
  readonly worldSeed: string;
  readonly controls: AtlasControls;
}

export type PackagedAtlasObserverPhase = 'configured' | 'preview' | 'accepted';

export type PackagedGenerationCancellationOperation = 'preview' | 'full';
export type PackagedGenerationCancellationSafePoint = 'early' | 'middle' | 'late';

export interface PackagedGenerationCancellationTrial {
  readonly operation: PackagedGenerationCancellationOperation;
  readonly safePoint: PackagedGenerationCancellationSafePoint;
}

export interface PackagedGenerationCancellationProgress {
  readonly operationId: string;
  readonly stage: string;
  readonly completedWork: number;
  readonly totalWork: number;
  readonly isCancellationRequested: boolean;
  readonly isTerminal: boolean;
}

export interface PackagedGenerationCancellationState {
  readonly fixtureId: GatedAtlasFixtureId | undefined;
  readonly worldSeed: string;
  readonly controls: AtlasControls;
  readonly workflowPhase: string;
  readonly isBusy: boolean;
  readonly hasPreview: boolean;
  readonly acceptedCheckpoint?: string | undefined;
  readonly acceptedIdentity?: AcceptedAtlasState | undefined;
  readonly acceptedWorldSeed?: string | undefined;
  readonly acceptedControls?: AtlasControls | undefined;
  readonly progress?: PackagedGenerationCancellationProgress | undefined;
  readonly diagnosticCodes: readonly string[];
}

interface CanonicalBaselineAuthority {
  readonly canonicalAspectSetSha256: string;
  readonly canonicalOutputSetSha256: string;
  readonly canonicalCoastlineOutputSha256: string;
}

interface PackagedGenerationCancellationPreState {
  readonly workflowPhase: 'empty' | 'preview';
  readonly disposablePreviewPresent: boolean;
  readonly acceptedAtlasPresent: boolean;
}

export interface PackagedGenerationCancellationReceipt {
  readonly version: typeof PACKAGED_GENERATION_CANCELLATION_RECEIPT_VERSION;
  readonly fixtureId: GatedAtlasFixtureId;
  readonly worldSeed: string;
  readonly controls: AtlasControls;
  readonly operation: PackagedGenerationCancellationOperation;
  readonly safePoint: PackagedGenerationCancellationSafePoint;
  readonly targetCompletedWork: 0 | 500 | 980;
  readonly status: 'cancellation-requested' | 'cancelled' | 'aftermath-complete' | 'invalid';
  readonly productionPreviewPath: true;
  readonly productionFullPath: true;
  readonly productionCancellationPath: true;
  readonly preState: PackagedGenerationCancellationPreState;
  readonly observedSafePoint?: PackagedGenerationCancellationProgress | undefined;
  readonly progressSamples: readonly PackagedGenerationCancellationProgress[];
  readonly cancellationDispatchEpochMilliseconds?: number | undefined;
  readonly terminalAcknowledgementEpochMilliseconds?: number | undefined;
  readonly acknowledgementMilliseconds?: number | undefined;
  readonly terminalProgress?: PackagedGenerationCancellationProgress | undefined;
  readonly costlySchedulingStopped?: true | undefined;
  readonly previousStatePreserved?: true | undefined;
  readonly noAcceptedCommitAtAcknowledgement?: true | undefined;
  readonly nextCompletion?: CanonicalBaselineAuthority | undefined;
  readonly nextCompletionCanonicallyDeterministic?: true | undefined;
  readonly invalidReason?: string | undefined;
}

export interface PackagedGenerationCancellationContext {
  readonly receipt: PackagedGenerationCancellationReceipt;
  readonly acceptedIdentityBefore: AcceptedAtlasState | undefined;
}

export interface PackagedGenerationCancellationDependencies {
  readonly currentState: () => PackagedGenerationCancellationState;
  readonly requestPreview: () => Promise<unknown>;
  readonly requestFull: () => Promise<unknown>;
  readonly cancelActiveOperation: () => { readonly ok: boolean };
  readonly acceptedEvidence: (
    accepted: AcceptedAtlasState,
  ) => Promise<AtlasAcceptedEvidence | undefined>;
  readonly record: (context: PackagedGenerationCancellationContext | undefined) => void;
  readonly nowEpochMilliseconds?: () => number;
  readonly yieldControl?: () => Promise<void>;
}

export interface PackagedAtlasObserverState {
  readonly workflowPhase: string;
  readonly isBusy: boolean;
  readonly hasPreview: boolean;
  readonly hasAcceptedAtlas: boolean;
  readonly acceptedCheckpoint?: string | undefined;
  readonly sceneKind?: string | undefined;
  readonly acceptedWorldSeed?: string | undefined;
  readonly acceptedControls?: AtlasControls | undefined;
}

export interface PackagedAtlasObserverReceipt {
  readonly version: typeof PACKAGED_ATLAS_OBSERVER_RECEIPT_VERSION;
  readonly fixtureId: GatedAtlasFixtureId;
  readonly worldSeed: string;
  readonly controls: AtlasControls;
  readonly phase: PackagedAtlasObserverPhase;
  readonly productionPreviewPath: true;
  readonly productionFullPath: true;
}

export interface PackagedAtlasObserverInput {
  readonly fixtureId: GatedAtlasFixtureId | undefined;
  readonly worldSeed: string;
  readonly controls: AtlasControls;
}

interface AtlasObserverDispatchKeyEvent {
  readonly altKey: boolean;
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly repeat: boolean;
  preventDefault(): void;
}

const FIXTURE_BY_ID: Readonly<Record<GatedAtlasFixtureId, GatedAtlasFixture>> = Object.freeze({
  'milestone-2-atlas-proof': validateFixtureDefinition(proofDefinition, 'milestone-2-atlas-proof'),
  'milestone-2-atlas-fragmented-islands': validateFixtureDefinition(
    fragmentedIslandsDefinition,
    'milestone-2-atlas-fragmented-islands',
  ),
  'milestone-2-atlas-control-max': validateFixtureDefinition(
    controlMaxDefinition,
    'milestone-2-atlas-control-max',
  ),
});

const FIXTURE_ID_BY_CODE: Readonly<Record<string, GatedAtlasFixtureId>> = Object.freeze({
  KeyJ: 'milestone-2-atlas-proof',
  KeyK: 'milestone-2-atlas-fragmented-islands',
  KeyL: 'milestone-2-atlas-control-max',
});

const CANCELLATION_TRIAL_BY_CODE: Readonly<Record<string, PackagedGenerationCancellationTrial>> =
  Object.freeze({
    KeyQ: Object.freeze({ operation: 'preview', safePoint: 'early' }),
    KeyW: Object.freeze({ operation: 'preview', safePoint: 'middle' }),
    KeyE: Object.freeze({ operation: 'preview', safePoint: 'late' }),
    KeyA: Object.freeze({ operation: 'full', safePoint: 'early' }),
    KeyS: Object.freeze({ operation: 'full', safePoint: 'middle' }),
    KeyD: Object.freeze({ operation: 'full', safePoint: 'late' }),
  });

const BASELINE_AUTHORITY_BY_FIXTURE: Readonly<
  Record<GatedAtlasFixtureId, CanonicalBaselineAuthority>
> = Object.freeze({
  'milestone-2-atlas-proof': baselineAuthority(proofBaselineIndex),
  'milestone-2-atlas-fragmented-islands': baselineAuthority(fragmentedIslandsBaselineIndex),
  'milestone-2-atlas-control-max': baselineAuthority(controlMaxBaselineIndex),
});

export function gatedAtlasFixture(fixtureId: string): GatedAtlasFixture {
  if (!isGatedAtlasFixtureId(fixtureId)) {
    throw new Error('Unknown packaged atlas observer fixture ID.');
  }
  return FIXTURE_BY_ID[fixtureId];
}

export function packagedAtlasFixtureDispatch(
  event: AtlasObserverDispatchKeyEvent,
): GatedAtlasFixtureId | undefined {
  if (!hasExactObserverModifiers(event)) return undefined;
  return FIXTURE_ID_BY_CODE[event.code];
}

export function isPackagedFullAtlasDispatch(event: AtlasObserverDispatchKeyEvent): boolean {
  return hasExactObserverModifiers(event) && event.code === 'KeyF';
}

export function isPackagedAtlasPreviewDispatch(event: AtlasObserverDispatchKeyEvent): boolean {
  return hasExactObserverModifiers(event) && event.code === 'KeyP';
}

export function packagedGenerationCancellationDispatch(
  event: AtlasObserverDispatchKeyEvent,
): PackagedGenerationCancellationTrial | undefined {
  if (!hasExactObserverModifiers(event)) return undefined;
  return CANCELLATION_TRIAL_BY_CODE[event.code];
}

export function isPackagedGenerationCancellationAftermathDispatch(
  event: AtlasObserverDispatchKeyEvent,
): boolean {
  return hasExactObserverModifiers(event) && event.code === 'KeyG';
}

export function requestExactFixturePreview(
  input: PackagedAtlasObserverInput,
  preview: () => void,
): boolean {
  if (input.fixtureId === undefined) return false;
  const fixture = gatedAtlasFixture(input.fixtureId);
  if (input.worldSeed !== fixture.worldSeed || !sameControls(input.controls, fixture.controls)) {
    return false;
  }
  preview();
  return true;
}

/** Installs only the fixture/preview/full actions authorized for observer-enabled packaged builds. */
export function installPackagedAtlasObserverDispatch(
  target: EventTarget,
  enabled: boolean,
  configureFixture: (fixture: GatedAtlasFixture) => void,
  currentInput: () => PackagedAtlasObserverInput,
  preview: () => void,
  acceptFull: () => void,
  startCancellationTrial: (trial: PackagedGenerationCancellationTrial) => void = () => undefined,
  completeCancellationAftermath: () => void = () => undefined,
): () => void {
  if (!enabled) return () => undefined;
  const listener = (rawEvent: Event): void => {
    const event = rawEvent as KeyboardEvent;
    const fixtureId = packagedAtlasFixtureDispatch(event);
    if (fixtureId !== undefined) {
      event.preventDefault();
      configureFixture(gatedAtlasFixture(fixtureId));
      return;
    }
    if (isPackagedAtlasPreviewDispatch(event)) {
      event.preventDefault();
      requestExactFixturePreview(currentInput(), preview);
      return;
    }
    const cancellationTrial = packagedGenerationCancellationDispatch(event);
    if (cancellationTrial !== undefined) {
      event.preventDefault();
      startCancellationTrial(cancellationTrial);
      return;
    }
    if (isPackagedGenerationCancellationAftermathDispatch(event)) {
      event.preventDefault();
      completeCancellationAftermath();
      return;
    }
    if (!isPackagedFullAtlasDispatch(event)) return;
    event.preventDefault();
    acceptFull();
  };
  target.addEventListener('keydown', listener);
  return () => {
    target.removeEventListener('keydown', listener);
  };
}

export async function requestExactFixtureGenerationCancellation(
  trial: PackagedGenerationCancellationTrial,
  dependencies: PackagedGenerationCancellationDependencies,
): Promise<PackagedGenerationCancellationContext | undefined> {
  const before = dependencies.currentState();
  const fixture = exactCancellationFixture(before, trial.operation);
  if (fixture === undefined)
    return invalidContext(undefined, trial, before, 'pre-dispatch authority');
  const acceptedIdentityBefore = before.acceptedIdentity;
  const beforeEvidence = await acceptedAuthority(before.acceptedIdentity, dependencies);

  const samples: PackagedGenerationCancellationProgress[] = [];
  const now = dependencies.nowEpochMilliseconds ?? (() => Date.now());
  const yieldControl =
    dependencies.yieldControl ??
    (() => new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0)));
  const operation =
    trial.operation === 'preview' ? dependencies.requestPreview() : dependencies.requestFull();
  let observed: PackagedGenerationCancellationProgress | undefined;
  let invalidReason: string | undefined;
  while (dependencies.currentState().isBusy) {
    const progress = dependencies.currentState().progress;
    if (progress !== undefined && appendProgressSample(samples, progress)) {
      invalidReason = validateProgressSamples(samples);
      if (invalidReason !== undefined) break;
      if (progress.isTerminal) {
        invalidReason = 'operation became terminal before cancellation dispatch';
        break;
      }
      if (reachedSafePoint(progress, trial.safePoint)) {
        observed = progress;
        break;
      }
      if (overshotSafePoint(progress, trial.safePoint)) {
        invalidReason = 'declared cancellation safe point was skipped or ambiguous';
        break;
      }
    }
    await yieldControl();
  }

  if (observed === undefined) {
    if (dependencies.currentState().isBusy) dependencies.cancelActiveOperation();
    await operation;
    const invalid = invalidContext(
      fixture,
      trial,
      before,
      invalidReason ?? 'operation ended before the declared cancellation safe point',
      samples,
    );
    dependencies.record(invalid);
    return invalid;
  }

  const cancellationDispatchEpochMilliseconds = now();
  const dispatched = dependencies.cancelActiveOperation();
  if (!dispatched.ok) {
    await operation;
    const invalid = invalidContext(
      fixture,
      trial,
      before,
      'production cancellation action rejected the safe-point dispatch',
      samples,
    );
    dependencies.record(invalid);
    return invalid;
  }
  const requestedContext: PackagedGenerationCancellationContext = Object.freeze({
    acceptedIdentityBefore,
    receipt: cancellationReceipt({
      fixture,
      trial,
      before,
      status: 'cancellation-requested',
      samples,
      observed,
      cancellationDispatchEpochMilliseconds,
    }),
  });
  dependencies.record(requestedContext);

  await operation;
  const terminalAcknowledgementEpochMilliseconds = now();
  const after = dependencies.currentState();
  const terminal = after.progress;
  if (terminal !== undefined) appendProgressSample(samples, terminal);
  const afterEvidence = await acceptedAuthority(after.acceptedIdentity, dependencies);
  invalidReason = validateCancellationTerminal(
    trial,
    before,
    after,
    acceptedIdentityBefore,
    beforeEvidence,
    afterEvidence,
    samples,
  );
  if (invalidReason !== undefined) {
    const invalid = invalidContext(fixture, trial, before, invalidReason, samples);
    dependencies.record(invalid);
    return invalid;
  }

  const context: PackagedGenerationCancellationContext = Object.freeze({
    acceptedIdentityBefore,
    receipt: cancellationReceipt({
      fixture,
      trial,
      before,
      status: 'cancelled',
      samples,
      observed,
      cancellationDispatchEpochMilliseconds,
      terminalAcknowledgementEpochMilliseconds,
      terminal,
    }),
  });
  dependencies.record(context);
  return context;
}

export async function requestGenerationCancellationAftermath(
  context: PackagedGenerationCancellationContext | undefined,
  dependencies: PackagedGenerationCancellationDependencies,
): Promise<PackagedGenerationCancellationContext | undefined> {
  if (context?.receipt.status !== 'cancelled') return undefined;
  const before = dependencies.currentState();
  if (!sameCancelledState(context, before)) {
    const invalid = withInvalid(context, 'state changed after acknowledgement before aftermath');
    dependencies.record(invalid);
    return invalid;
  }
  await dependencies.requestFull();
  const after = dependencies.currentState();
  const evidence = await acceptedAuthority(after.acceptedIdentity, dependencies);
  const expected = BASELINE_AUTHORITY_BY_FIXTURE[context.receipt.fixtureId];
  if (
    after.isBusy ||
    after.hasPreview ||
    after.workflowPhase !== 'accepted' ||
    after.acceptedCheckpoint !== 'baseline' ||
    evidence === undefined ||
    !sameCanonicalAuthority(evidence, expected)
  ) {
    const invalid = withInvalid(
      context,
      'the next completed production full operation did not match canonical fixture evidence',
    );
    dependencies.record(invalid);
    return invalid;
  }
  const completed = Object.freeze({
    acceptedIdentityBefore: context.acceptedIdentityBefore,
    receipt: Object.freeze({
      ...context.receipt,
      status: 'aftermath-complete' as const,
      nextCompletion: expected,
      nextCompletionCanonicallyDeterministic: true as const,
    }),
  });
  dependencies.record(completed);
  return completed;
}

export async function requestProductionFullAtlas(
  acceptFull: () => Promise<unknown>,
  present: (operation: Promise<unknown>) => Promise<void>,
): Promise<void> {
  await present(acceptFull());
}

export function packagedAtlasObserverReceipt(
  fixtureId: GatedAtlasFixtureId | undefined,
  seed: string,
  controls: AtlasControls,
  state: PackagedAtlasObserverState,
): PackagedAtlasObserverReceipt | undefined {
  if (fixtureId === undefined || state.isBusy) return undefined;
  const fixture = gatedAtlasFixture(fixtureId);
  if (seed !== fixture.worldSeed || !sameControls(controls, fixture.controls)) return undefined;

  const phase = observerPhase(state, fixture);
  if (phase === undefined) return undefined;
  return Object.freeze({
    version: PACKAGED_ATLAS_OBSERVER_RECEIPT_VERSION,
    fixtureId,
    worldSeed: fixture.worldSeed,
    controls: fixture.controls,
    phase,
    productionPreviewPath: true,
    productionFullPath: true,
  });
}

function observerPhase(
  state: PackagedAtlasObserverState,
  fixture: GatedAtlasFixture,
): PackagedAtlasObserverPhase | undefined {
  if (
    state.workflowPhase === 'empty' &&
    !state.hasPreview &&
    !state.hasAcceptedAtlas &&
    state.acceptedWorldSeed === undefined &&
    state.acceptedControls === undefined
  ) {
    return 'configured';
  }
  if (
    state.workflowPhase === 'preview' &&
    state.hasPreview &&
    !state.hasAcceptedAtlas &&
    state.acceptedWorldSeed === undefined &&
    state.acceptedControls === undefined
  ) {
    return 'preview';
  }
  if (
    state.workflowPhase === 'accepted' &&
    !state.hasPreview &&
    state.hasAcceptedAtlas &&
    state.acceptedCheckpoint === 'baseline' &&
    state.sceneKind === 'whole-world-atlas' &&
    state.acceptedWorldSeed === fixture.worldSeed &&
    state.acceptedControls !== undefined &&
    sameControls(state.acceptedControls, fixture.controls)
  ) {
    return 'accepted';
  }
  return undefined;
}

function validateFixtureDefinition(
  input: unknown,
  expectedFixtureId: GatedAtlasFixtureId,
): GatedAtlasFixture {
  if (!isRecord(input) || input.fixtureDefinitionVersion !== 2) {
    throw new Error('Packaged atlas observer fixture definition version drifted.');
  }
  if (input.fixtureId !== expectedFixtureId) {
    throw new Error('Packaged atlas observer fixture identity drifted.');
  }
  const seed = parseWorldSeed(input.worldSeed);
  const controls = parseAtlasControls(input.controls);
  if (!seed.ok || !controls.ok) {
    throw new Error('Packaged atlas observer fixture inputs are incomplete or invalid.');
  }
  return Object.freeze({
    fixtureId: expectedFixtureId,
    worldSeed: formatWorldSeed(seed.value),
    controls: controls.value,
  });
}

function isGatedAtlasFixtureId(value: string): value is GatedAtlasFixtureId {
  return GATED_ATLAS_FIXTURE_IDS.some((fixtureId) => fixtureId === value);
}

function hasExactObserverModifiers(event: AtlasObserverDispatchKeyEvent): boolean {
  return event.metaKey && event.altKey && event.ctrlKey && !event.repeat;
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

function exactCancellationFixture(
  state: PackagedGenerationCancellationState,
  operation: PackagedGenerationCancellationOperation,
): GatedAtlasFixture | undefined {
  if (state.fixtureId === undefined || state.isBusy) return undefined;
  const fixture = gatedAtlasFixture(state.fixtureId);
  if (state.worldSeed !== fixture.worldSeed || !sameControls(state.controls, fixture.controls)) {
    return undefined;
  }
  if (operation === 'preview') {
    return state.workflowPhase === 'empty' &&
      !state.hasPreview &&
      state.acceptedIdentity === undefined
      ? fixture
      : undefined;
  }
  return state.workflowPhase === 'preview' &&
    state.hasPreview &&
    state.acceptedIdentity === undefined &&
    state.acceptedWorldSeed === undefined &&
    state.acceptedControls === undefined
    ? fixture
    : undefined;
}

function appendProgressSample(
  samples: PackagedGenerationCancellationProgress[],
  progress: PackagedGenerationCancellationProgress,
): boolean {
  const previous = samples.at(-1);
  if (
    previous?.operationId === progress.operationId &&
    previous.stage === progress.stage &&
    previous.completedWork === progress.completedWork &&
    previous.isCancellationRequested === progress.isCancellationRequested &&
    previous.isTerminal === progress.isTerminal
  ) {
    return false;
  }
  samples.push(Object.freeze({ ...progress }));
  return true;
}

function validateProgressSamples(
  samples: readonly PackagedGenerationCancellationProgress[],
): string | undefined {
  const operationId = samples[0]?.operationId;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const previous = samples[index - 1];
    if (
      sample === undefined ||
      sample.operationId !== operationId ||
      sample.totalWork !== 1_000 ||
      sample.completedWork < 0 ||
      sample.completedWork > sample.totalWork ||
      (previous !== undefined && sample.completedWork < previous.completedWork) ||
      previous?.isTerminal === true
    ) {
      return 'progress identity, bounds, monotonicity, or terminal ordering was invalid';
    }
  }
  return undefined;
}

function reachedSafePoint(
  progress: PackagedGenerationCancellationProgress,
  safePoint: PackagedGenerationCancellationSafePoint,
): boolean {
  if (progress.isTerminal) return false;
  if (safePoint === 'early') return progress.completedWork < 500;
  if (safePoint === 'middle') {
    return progress.completedWork >= 500 && progress.completedWork < 980;
  }
  return progress.completedWork >= 980 && progress.completedWork < progress.totalWork;
}

function overshotSafePoint(
  progress: PackagedGenerationCancellationProgress,
  safePoint: PackagedGenerationCancellationSafePoint,
): boolean {
  return (
    (safePoint === 'early' && progress.completedWork >= 500) ||
    (safePoint === 'middle' && progress.completedWork >= 980) ||
    (safePoint === 'late' && progress.completedWork >= progress.totalWork)
  );
}

function targetCompletedWork(safePoint: PackagedGenerationCancellationSafePoint): 0 | 500 | 980 {
  return safePoint === 'early' ? 0 : safePoint === 'middle' ? 500 : 980;
}

async function acceptedAuthority(
  accepted: AcceptedAtlasState | undefined,
  dependencies: PackagedGenerationCancellationDependencies,
): Promise<CanonicalBaselineAuthority | undefined> {
  if (accepted === undefined) return undefined;
  const evidence = await dependencies.acceptedEvidence(accepted);
  return evidence === undefined
    ? undefined
    : Object.freeze({
        canonicalAspectSetSha256: evidence.canonicalAspectSetSha256,
        canonicalOutputSetSha256: evidence.canonicalOutputSetSha256,
        canonicalCoastlineOutputSha256: evidence.canonicalCoastlineOutputSha256,
      });
}

function validateCancellationTerminal(
  trial: PackagedGenerationCancellationTrial,
  before: PackagedGenerationCancellationState,
  after: PackagedGenerationCancellationState,
  acceptedIdentityBefore: AcceptedAtlasState | undefined,
  beforeEvidence: CanonicalBaselineAuthority | undefined,
  afterEvidence: CanonicalBaselineAuthority | undefined,
  samples: readonly PackagedGenerationCancellationProgress[],
): string | undefined {
  const progressFailure = validateProgressSamples(samples);
  if (progressFailure !== undefined) return progressFailure;
  const terminal = samples.at(-1);
  if (
    after.isBusy ||
    after.hasPreview !== before.hasPreview ||
    terminal?.stage !== 'cancelled' ||
    !terminal.isTerminal ||
    !terminal.isCancellationRequested ||
    !after.diagnosticCodes.some((code) => code.includes('cancelled'))
  ) {
    return 'terminal cancellation acknowledgement was incomplete or contradictory';
  }
  if (
    after.acceptedIdentity !== acceptedIdentityBefore ||
    after.workflowPhase !== before.workflowPhase ||
    !sameOptionalCanonicalAuthority(afterEvidence, beforeEvidence)
  ) {
    return 'accepted or previous workflow state changed at cancellation acknowledgement';
  }
  if (trial.operation === 'preview' && after.acceptedIdentity !== undefined) {
    return 'preview cancellation produced an accepted commit';
  }
  return undefined;
}

function sameCancelledState(
  context: PackagedGenerationCancellationContext,
  state: PackagedGenerationCancellationState,
): boolean {
  return (
    !state.isBusy &&
    state.hasPreview === context.receipt.preState.disposablePreviewPresent &&
    state.acceptedIdentity === context.acceptedIdentityBefore &&
    state.workflowPhase === context.receipt.preState.workflowPhase &&
    state.progress?.stage === 'cancelled' &&
    state.progress.isTerminal
  );
}

function cancellationReceipt(input: {
  readonly fixture: GatedAtlasFixture;
  readonly trial: PackagedGenerationCancellationTrial;
  readonly before: PackagedGenerationCancellationState;
  readonly status: 'cancellation-requested' | 'cancelled';
  readonly samples: readonly PackagedGenerationCancellationProgress[];
  readonly observed: PackagedGenerationCancellationProgress;
  readonly cancellationDispatchEpochMilliseconds: number;
  readonly terminalAcknowledgementEpochMilliseconds?: number | undefined;
  readonly terminal?: PackagedGenerationCancellationProgress | undefined;
}): PackagedGenerationCancellationReceipt {
  const acknowledgementMilliseconds =
    input.terminalAcknowledgementEpochMilliseconds === undefined
      ? undefined
      : input.terminalAcknowledgementEpochMilliseconds -
        input.cancellationDispatchEpochMilliseconds;
  return Object.freeze({
    version: PACKAGED_GENERATION_CANCELLATION_RECEIPT_VERSION,
    fixtureId: input.fixture.fixtureId,
    worldSeed: input.fixture.worldSeed,
    controls: input.fixture.controls,
    operation: input.trial.operation,
    safePoint: input.trial.safePoint,
    targetCompletedWork: targetCompletedWork(input.trial.safePoint),
    status: input.status,
    productionPreviewPath: true,
    productionFullPath: true,
    productionCancellationPath: true,
    preState: Object.freeze({
      workflowPhase: input.before.workflowPhase as 'empty' | 'preview',
      disposablePreviewPresent: input.before.hasPreview,
      acceptedAtlasPresent: input.before.acceptedIdentity !== undefined,
    }),
    observedSafePoint: input.observed,
    progressSamples: Object.freeze([...input.samples]),
    cancellationDispatchEpochMilliseconds: input.cancellationDispatchEpochMilliseconds,
    ...(input.terminalAcknowledgementEpochMilliseconds === undefined
      ? {}
      : {
          terminalAcknowledgementEpochMilliseconds: input.terminalAcknowledgementEpochMilliseconds,
          acknowledgementMilliseconds,
          terminalProgress: input.terminal,
          costlySchedulingStopped: true as const,
          previousStatePreserved: true as const,
          noAcceptedCommitAtAcknowledgement: true as const,
        }),
  });
}

function invalidContext(
  fixture: GatedAtlasFixture | undefined,
  trial: PackagedGenerationCancellationTrial,
  before: PackagedGenerationCancellationState,
  invalidReason: string,
  samples: readonly PackagedGenerationCancellationProgress[] = [],
): PackagedGenerationCancellationContext | undefined {
  if (fixture === undefined) return undefined;
  return Object.freeze({
    acceptedIdentityBefore: before.acceptedIdentity,
    receipt: Object.freeze({
      version: PACKAGED_GENERATION_CANCELLATION_RECEIPT_VERSION,
      fixtureId: fixture.fixtureId,
      worldSeed: fixture.worldSeed,
      controls: fixture.controls,
      operation: trial.operation,
      safePoint: trial.safePoint,
      targetCompletedWork: targetCompletedWork(trial.safePoint),
      status: 'invalid',
      productionPreviewPath: true,
      productionFullPath: true,
      productionCancellationPath: true,
      preState: Object.freeze({
        workflowPhase: before.workflowPhase as 'empty' | 'preview',
        disposablePreviewPresent: before.hasPreview,
        acceptedAtlasPresent: before.acceptedIdentity !== undefined,
      }),
      progressSamples: Object.freeze([...samples]),
      invalidReason,
    }),
  });
}

function withInvalid(
  context: PackagedGenerationCancellationContext,
  invalidReason: string,
): PackagedGenerationCancellationContext {
  return Object.freeze({
    acceptedIdentityBefore: context.acceptedIdentityBefore,
    receipt: Object.freeze({ ...context.receipt, status: 'invalid', invalidReason }),
  });
}

function sameOptionalCanonicalAuthority(
  left: CanonicalBaselineAuthority | undefined,
  right: CanonicalBaselineAuthority | undefined,
): boolean {
  return left === undefined
    ? right === undefined
    : right !== undefined && sameCanonicalAuthority(left, right);
}

function sameCanonicalAuthority(
  left: CanonicalBaselineAuthority,
  right: CanonicalBaselineAuthority,
): boolean {
  return (
    left.canonicalAspectSetSha256 === right.canonicalAspectSetSha256 &&
    left.canonicalOutputSetSha256 === right.canonicalOutputSetSha256 &&
    left.canonicalCoastlineOutputSha256 === right.canonicalCoastlineOutputSha256
  );
}

function baselineAuthority(rawIndex: string): CanonicalBaselineAuthority {
  const parsed = JSON.parse(rawIndex) as unknown;
  if (!isRecord(parsed) || !isUnknownArray(parsed.aspects)) {
    throw new Error('Packaged cancellation baseline evidence was malformed.');
  }
  const coastline = parsed.aspects.find(
    (value) => isRecord(value) && value.aspectName === 'worldCoastline.geometry',
  );
  const aspect = parsed.canonicalAspectSetSha256;
  const output = parsed.canonicalAspectOutputSetSha256;
  const coastlineOutput = isRecord(coastline) ? coastline.canonicalAspectOutputSha256 : undefined;
  if (
    typeof aspect !== 'string' ||
    typeof output !== 'string' ||
    typeof coastlineOutput !== 'string'
  ) {
    throw new Error('Packaged cancellation baseline hashes were incomplete.');
  }
  return Object.freeze({
    canonicalAspectSetSha256: aspect,
    canonicalOutputSetSha256: output,
    canonicalCoastlineOutputSha256: coastlineOutput,
  });
}

function isRecord(input: unknown): input is Readonly<Record<string, unknown>> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function isUnknownArray(input: unknown): input is readonly unknown[] {
  return Array.isArray(input);
}
