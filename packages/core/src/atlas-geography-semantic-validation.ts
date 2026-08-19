/** Exact ownership, connectedness, and stable-identity validation for #59 semantic geography. */

import { deriveAtlasAspectId, deriveAtlasSingletonEntityIds } from './atlas-geography-aspects.js';
import {
  ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES,
  type AtlasGeographyDiagnostic,
} from './atlas-geography-diagnostics.js';
import {
  type AtlasSurfaceKind,
  deriveAtlasIslandGroupEntityId,
  deriveAtlasSemanticComponentIdentity,
  fingerprintAtlasSurfaceComponent,
  isAtlasSemanticFingerprint,
} from './atlas-geography-identity.js';
import {
  ATLAS_FULL_LATITUDE_BAND_COUNT,
  ATLAS_FULL_LONGITUDE_CELL_COUNT,
  ATLAS_FULL_SAMPLE_COUNT,
  ATLAS_SEMANTIC_CLASSIFICATION_VERSION,
  type AtlasSemanticGeographyRecords,
  type AtlasSurfaceComponentMembership,
} from './atlas-geography-model.js';
import {
  createAtlasRowWeights,
  forEachAtlasSurfaceNeighbor,
} from './atlas-geography-surface-topology.js';
import type { EntityId, SurfaceComponentId } from './identity.js';

interface SemanticOwner {
  readonly kind: AtlasSurfaceKind;
  readonly entityId: EntityId;
  readonly componentId: SurfaceComponentId;
  readonly membership: AtlasSurfaceComponentMembership;
}

/** Validate exact sample ownership and identity without inferring renderer-visible types. */
export function validateAtlasSemanticMembership(
  records: AtlasSemanticGeographyRecords,
): readonly AtlasGeographyDiagnostic[] {
  const diagnostics: AtlasGeographyDiagnostic[] = [];
  validateOwnerIdentity(records, diagnostics);
  const owners: readonly SemanticOwner[] = [
    ...records.landmasses.map((landmass) => ({
      kind: 'land' as const,
      entityId: landmass.entityId,
      componentId: landmass.componentId,
      membership: landmass.membership,
    })),
    ...records.waterBodies.map((waterBody) => ({
      kind: 'water' as const,
      entityId: waterBody.entityId,
      componentId: waterBody.componentId,
      membership: waterBody.membership,
    })),
  ];
  const ownerBySample = new Int32Array(ATLAS_FULL_SAMPLE_COUNT);
  const rowWeights = createAtlasRowWeights();
  ownerBySample.fill(-1);
  for (const [ownerIndex, owner] of owners.entries()) {
    validateMembershipIdentity(records, owner, diagnostics);
    assignMembership(records, owner, ownerIndex, ownerBySample, rowWeights, diagnostics);
  }
  if (ownerBySample.includes(-1)) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.unownedSample,
        'Every accepted full-profile sample must belong to exactly one semantic landmass or water body.',
      ),
    );
  }
  validateConnectedOwners(owners, ownerBySample, diagnostics);
  validateGeographicRelationships(records, owners, ownerBySample, diagnostics);
  for (const group of records.islandGroups) {
    const expected = deriveAtlasIslandGroupEntityId(
      records.worldMapId,
      group.kind,
      group.memberLandmassIds,
    );
    if (group.entityId !== expected) {
      diagnostics.push(
        diagnostic(
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.identityCollision,
          `Island group ${group.entityId} does not derive from its stable owner, kind, and canonical member identities.`,
        ),
      );
    }
  }
  return diagnostics;
}

function validateGeographicRelationships(
  records: AtlasSemanticGeographyRecords,
  owners: readonly SemanticOwner[],
  ownerBySample: Int32Array,
  diagnostics: AtlasGeographyDiagnostic[],
): void {
  const landToWater = new Map<EntityId, Set<EntityId>>();
  const waterToLand = new Map<EntityId, Set<EntityId>>();
  const waterToWater = new Map<EntityId, Set<EntityId>>();
  const boundaryCounts = new Map<string, number>();
  for (let index = 0; index < ownerBySample.length; index += 1) {
    const owner = owners[ownerBySample[index] ?? -1];
    if (owner === undefined) continue;
    forEachAtlasSurfaceNeighbor(index, (neighbor) => {
      const other = owners[ownerBySample[neighbor] ?? -1];
      if (other === undefined || other.entityId === owner.entityId) return;
      if (owner.kind === 'land' && other.kind === 'water') {
        addRelationship(landToWater, owner.entityId, other.entityId);
        addRelationship(waterToLand, other.entityId, owner.entityId);
        const key = relationshipKey(owner.entityId, other.entityId);
        boundaryCounts.set(key, (boundaryCounts.get(key) ?? 0) + 1);
      } else if (owner.kind === 'water' && other.kind === 'water') {
        addRelationship(waterToWater, owner.entityId, other.entityId);
      }
    });
  }
  for (const landmass of records.landmasses) {
    const expectedAdjacent = sortedValues(landToWater.get(landmass.entityId));
    const expectedContaining =
      landmass.kind === 'continent'
        ? undefined
        : [...expectedAdjacent].sort(
            (left, right) =>
              (boundaryCounts.get(relationshipKey(landmass.entityId, right)) ?? 0) -
                (boundaryCounts.get(relationshipKey(landmass.entityId, left)) ?? 0) ||
              compareText(left, right),
          )[0];
    if (
      !sameStrings(landmass.adjacentWaterBodyIds, expectedAdjacent) ||
      landmass.containingWaterBodyId !== expectedContaining
    ) {
      diagnostics.push(
        diagnostic(
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.brokenContainment,
          `Landmass ${landmass.entityId} must declare its exact geographic adjacency and version-1 containing water body.`,
        ),
      );
    }
  }
  const waterById = new Map(records.waterBodies.map((body) => [body.entityId, body] as const));
  for (const waterBody of records.waterBodies) {
    const expectedAdjacent = sortedValues(waterToLand.get(waterBody.entityId));
    const expectedEnclosing = waterBody.enclosure === 'enclosed' ? expectedAdjacent : [];
    const expectedConnected =
      records.controls.oceanConnectivity === 'multipleBasins' || waterBody.enclosure === 'enclosed'
        ? []
        : sortedValues(waterToWater.get(waterBody.entityId)).filter(
            (id) => waterById.get(id)?.enclosure === 'open-marine',
          );
    const declaredConnected = waterBody.connectivity
      .map(({ connectedWaterBodyId }) => connectedWaterBodyId)
      .sort(compareText);
    if (
      !sameStrings(waterBody.adjacentLandmassIds, expectedAdjacent) ||
      !sameStrings(waterBody.enclosedByLandmassIds, expectedEnclosing)
    ) {
      diagnostics.push(
        diagnostic(
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.brokenContainment,
          `Water body ${waterBody.entityId} must declare its exact geographic adjacency and enclosure.`,
        ),
      );
    }
    if (!sameStrings(declaredConnected, expectedConnected)) {
      diagnostics.push(
        diagnostic(
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.brokenConnectivity,
          `Water body ${waterBody.entityId} must declare its exact version-1 marine connectivity edges.`,
        ),
      );
    }
  }
}

function addRelationship(
  map: Map<EntityId, Set<EntityId>>,
  owner: EntityId,
  related: EntityId,
): void {
  const values = map.get(owner);
  if (values === undefined) map.set(owner, new Set([related]));
  else values.add(related);
}

function sortedValues(values: ReadonlySet<EntityId> | undefined): EntityId[] {
  return [...(values ?? [])].sort(compareText);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function relationshipKey(left: EntityId, right: EntityId): string {
  return `${left}\0${right}`;
}

function validateOwnerIdentity(
  records: AtlasSemanticGeographyRecords,
  diagnostics: AtlasGeographyDiagnostic[],
): void {
  if (
    (records as unknown as Readonly<Record<string, unknown>>).semanticClassificationVersion !==
    ATLAS_SEMANTIC_CLASSIFICATION_VERSION
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassificationVersion,
        'Semantic geography must use classification behavior version 1.',
      ),
    );
  }
  const expectedSurface = deriveAtlasSingletonEntityIds(records.worldMapId).worldSurfaceEntityId;
  const expectedAspect = deriveAtlasAspectId(
    records.worldSurfaceEntityId,
    'worldSurface.landWaterClassification',
  );
  if (
    records.worldSurfaceEntityId !== expectedSurface ||
    records.landWaterClassificationAspectId !== expectedAspect
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.identityCollision,
        'Semantic geography owner and upstream aspect IDs must derive from the declared stable world-map identity.',
      ),
    );
  }
}

function validateMembershipIdentity(
  records: AtlasSemanticGeographyRecords,
  owner: SemanticOwner,
  diagnostics: AtlasGeographyDiagnostic[],
): void {
  const { membership } = owner;
  const isCanonicalFingerprint =
    (membership as unknown as Readonly<Record<string, unknown>>).classificationVersion ===
      ATLAS_SEMANTIC_CLASSIFICATION_VERSION &&
    isAtlasSemanticFingerprint(membership.fingerprint) &&
    membership.fingerprint ===
      fingerprintAtlasSurfaceComponent(owner.kind, membership.sampleRanges);
  const expected = deriveAtlasSemanticComponentIdentity(
    records.worldMapId,
    records.worldSurfaceEntityId,
    owner.kind,
    membership.sampleRanges,
  );
  if (
    !isCanonicalFingerprint ||
    owner.componentId !== expected.componentId ||
    owner.entityId !== expected.entityId
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.identityCollision,
        `${capitalize(owner.kind)} entity ${owner.entityId} does not derive from its stable owner and canonical component fingerprint.`,
      ),
    );
  }
}

function assignMembership(
  records: AtlasSemanticGeographyRecords,
  owner: SemanticOwner,
  ownerIndex: number,
  ownerBySample: Int32Array,
  rowWeights: Int32Array,
  diagnostics: AtlasGeographyDiagnostic[],
): void {
  let previousEnd = -1;
  let sampleCount = 0;
  let hasInvalidRange = false;
  let hasOverlap = false;
  let hasClassificationMismatch = false;
  let sphericalAreaWeight = 0;
  for (const range of owner.membership.sampleRanges) {
    if (
      !Number.isSafeInteger(range.startIndex) ||
      !Number.isSafeInteger(range.endIndexExclusive) ||
      range.startIndex < 0 ||
      range.startIndex >= range.endIndexExclusive ||
      range.endIndexExclusive > ATLAS_FULL_SAMPLE_COUNT ||
      range.startIndex <= previousEnd
    ) {
      hasInvalidRange = true;
      continue;
    }
    previousEnd = range.endIndexExclusive;
    sampleCount += range.endIndexExclusive - range.startIndex;
    for (let index = range.startIndex; index < range.endIndexExclusive; index += 1) {
      sphericalAreaWeight += rowWeights[latitudeIndexForStorageIndex(index)] ?? 0;
      if (ownerBySample[index] !== -1) hasOverlap = true;
      else ownerBySample[index] = ownerIndex;
      if (records.landWaterClassification.samples.at(index) !== owner.kind) {
        hasClassificationMismatch = true;
      }
    }
  }
  if (hasInvalidRange || sampleCount !== owner.membership.sampleCount) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification,
        `${capitalize(owner.kind)} entity ${owner.entityId} must use canonical non-adjacent sample ranges and an exact sample count.`,
      ),
    );
  }
  if (
    !Number.isSafeInteger(owner.membership.sphericalAreaWeight) ||
    owner.membership.sphericalAreaWeight < 0 ||
    owner.membership.sphericalAreaWeight !== sphericalAreaWeight
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification,
        `${capitalize(owner.kind)} entity ${owner.entityId} must record its exact version-1 safe-integer spherical area weight.`,
      ),
    );
  }
  if (hasOverlap) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.overlappingOwnership,
        `${capitalize(owner.kind)} entity ${owner.entityId} overlaps another semantic component.`,
      ),
    );
  }
  if (hasClassificationMismatch) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification,
        `${capitalize(owner.kind)} entity ${owner.entityId} owns a sample with the opposite accepted land/water classification.`,
      ),
    );
  }
}

function latitudeIndexForStorageIndex(index: number): number {
  if (index === 0) return 0;
  if (index === ATLAS_FULL_SAMPLE_COUNT - 1) return ATLAS_FULL_LATITUDE_BAND_COUNT;
  return Math.floor((index - 1) / ATLAS_FULL_LONGITUDE_CELL_COUNT) + 1;
}

function validateConnectedOwners(
  owners: readonly SemanticOwner[],
  ownerBySample: Int32Array,
  diagnostics: AtlasGeographyDiagnostic[],
): void {
  const visited = new Uint8Array(ATLAS_FULL_SAMPLE_COUNT);
  const queue = new Int32Array(ATLAS_FULL_SAMPLE_COUNT);
  const connectedCounts = new Uint32Array(owners.length);
  for (let start = 0; start < ATLAS_FULL_SAMPLE_COUNT; start += 1) {
    const ownerIndex = ownerBySample[start];
    if (ownerIndex === undefined || ownerIndex < 0 || visited[start] !== 0) continue;
    connectedCounts[ownerIndex] = (connectedCounts[ownerIndex] ?? 0) + 1;
    let head = 0;
    let tail = 0;
    queue[tail] = start;
    tail += 1;
    visited[start] = 1;
    while (head < tail) {
      const current = queue[head];
      head += 1;
      if (current === undefined) continue;
      forEachAtlasSurfaceNeighbor(current, (neighbor) => {
        if (visited[neighbor] === 0 && ownerBySample[neighbor] === ownerIndex) {
          visited[neighbor] = 1;
          queue[tail] = neighbor;
          tail += 1;
        }
      });
    }
  }
  for (const [ownerIndex, count] of connectedCounts.entries()) {
    if (count > 1) {
      diagnostics.push(
        diagnostic(
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.disconnectedComponent,
          `Semantic entity ${owners[ownerIndex]?.entityId ?? 'unknown'} owns disconnected sample regions.`,
        ),
      );
    }
  }
}

function diagnostic(
  code: AtlasGeographyDiagnostic['code'],
  message: string,
): AtlasGeographyDiagnostic {
  return Object.freeze({ code, message });
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
