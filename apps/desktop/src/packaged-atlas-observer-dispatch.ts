import {
  type AtlasControls,
  formatWorldSeed,
  parseAtlasControls,
  parseWorldSeed,
} from '@ttrpg-map/core';

import controlMaxDefinition from '../../../fixtures/fixed-seeds/milestone-2-atlas-control-max/fixture-definition.json';
import fragmentedIslandsDefinition from '../../../fixtures/fixed-seeds/milestone-2-atlas-fragmented-islands/fixture-definition.json';
import proofDefinition from '../../../fixtures/fixed-seeds/milestone-2-atlas-proof/fixture-definition.json';

export const PACKAGED_ATLAS_OBSERVER_RECEIPT_LABEL = 'Packaged atlas observer receipt' as const;
export const PACKAGED_ATLAS_OBSERVER_RECEIPT_VERSION =
  'packaged-atlas-observer-fixture-v1' as const;

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

/** Installs only the fixture/full actions authorized for observer-enabled packaged builds. */
export function installPackagedAtlasObserverDispatch(
  target: EventTarget,
  enabled: boolean,
  configureFixture: (fixture: GatedAtlasFixture) => void,
  acceptFull: () => void,
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
    if (!isPackagedFullAtlasDispatch(event)) return;
    event.preventDefault();
    acceptFull();
  };
  target.addEventListener('keydown', listener);
  return () => {
    target.removeEventListener('keydown', listener);
  };
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

function isRecord(input: unknown): input is Readonly<Record<string, unknown>> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}
