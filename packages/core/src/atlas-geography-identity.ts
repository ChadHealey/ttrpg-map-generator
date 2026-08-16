/** Version-1 stable fingerprints and identities for accepted semantic atlas geography. */

import {
  deriveAtlasFeatureEntityId,
  deriveAtlasSurfaceComponentId,
} from './atlas-geography-aspects.js';
import type { AtlasIslandGroupKind, AtlasSurfaceSampleRange } from './atlas-geography-model.js';
import { ATLAS_SEMANTIC_CLASSIFICATION_VERSION } from './atlas-geography-model.js';
import type { EntityId, MapId, SurfaceComponentId } from './identity.js';
import { parseSemanticKey } from './identity.js';
import { sha256 } from './sha-256.js';

const ENCODER = new TextEncoder();
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;

export type AtlasSurfaceKind = 'land' | 'water';

export interface AtlasSemanticComponentIdentity {
  readonly componentId: SurfaceComponentId;
  readonly entityId: EntityId;
  readonly fingerprint: string;
}

/** Hash canonical sample ranges without traversal-order or insertion-order identity. */
export function fingerprintAtlasSurfaceComponent(
  kind: AtlasSurfaceKind,
  sampleRanges: readonly AtlasSurfaceSampleRange[],
): string {
  const rangeText = sampleRanges
    .map(
      ({ startIndex, endIndexExclusive }) => `${String(startIndex)}:${String(endIndexExclusive)}`,
    )
    .join(',');
  return digestHex(
    `ttrpg-map/atlas-semantic-component/v${String(ATLAS_SEMANTIC_CLASSIFICATION_VERSION)}/${kind}/${rangeText}`,
  );
}

/** Derive both component and feature identity from stable owners and a canonical fingerprint. */
export function deriveAtlasSemanticComponentIdentity(
  worldMapId: MapId,
  worldSurfaceEntityId: EntityId,
  kind: AtlasSurfaceKind,
  sampleRanges: readonly AtlasSurfaceSampleRange[],
): AtlasSemanticComponentIdentity {
  const fingerprint = fingerprintAtlasSurfaceComponent(kind, sampleRanges);
  return Object.freeze({
    componentId: deriveAtlasSurfaceComponentId(
      worldSurfaceEntityId,
      semanticKey(`${kind}-component-${fingerprint}`),
    ),
    entityId: deriveAtlasFeatureEntityId(worldMapId, semanticKey(`${kind}-entity-${fingerprint}`)),
    fingerprint,
  });
}

/** Group identity uses kind plus canonical member identity, never semantic chain array order. */
export function deriveAtlasIslandGroupEntityId(
  worldMapId: MapId,
  kind: AtlasIslandGroupKind,
  memberLandmassIds: readonly EntityId[],
): EntityId {
  const members = [...memberLandmassIds].sort().join(',');
  const fingerprint = digestHex(
    `ttrpg-map/atlas-island-group/v${String(ATLAS_SEMANTIC_CLASSIFICATION_VERSION)}/${kind}/${members}`,
  );
  return deriveAtlasFeatureEntityId(
    worldMapId,
    semanticKey(`island-group-${kind.toLowerCase()}-${fingerprint}`),
  );
}

export function isAtlasSemanticFingerprint(value: unknown): value is string {
  return typeof value === 'string' && FINGERPRINT_PATTERN.test(value);
}

function digestHex(value: string): string {
  return Array.from(sha256(ENCODER.encode(value)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function semanticKey(value: string) {
  const parsed = parseSemanticKey(value);
  if (!parsed.ok) throw new Error('Internal atlas semantic identity key is invalid.');
  return parsed.value;
}
