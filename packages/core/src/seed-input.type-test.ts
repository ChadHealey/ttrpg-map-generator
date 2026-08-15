import type {
  MapEntitySeedInput,
  RootCoordinateSeedInput,
  SeedInput,
  SharedBoundarySeedInput,
  WorldSeed,
} from './seed-input.js';

declare const mapEntity: MapEntitySeedInput;
declare const rootCoordinate: RootCoordinateSeedInput;
declare const sharedBoundary: SharedBoundarySeedInput;
declare const seedInput: SeedInput;

// @ts-expect-error World seeds cannot enter the kernel as imprecise JavaScript numbers.
const unparsedWorldSeed: WorldSeed = 8_198_552_921_648_695;
// @ts-expect-error A root-coordinate namespace cannot stand in for a map/entity namespace.
const invalidMapEntity: MapEntitySeedInput = rootCoordinate;
// @ts-expect-error A shared-boundary namespace cannot stand in for a root-coordinate namespace.
const invalidRootCoordinate: RootCoordinateSeedInput = sharedBoundary;
// @ts-expect-error Scope-specific identities cannot be replaced after validation.
mapEntity.mapId = seedInput.seedScope;

void [invalidMapEntity, invalidRootCoordinate, mapEntity, seedInput, unparsedWorldSeed];
