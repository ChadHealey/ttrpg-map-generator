/** Canonical deterministic identity for the ADR-0023 regional rectangle footprint. */

import type { EntityId, SemanticKey } from './identity.js';
import { deriveStableId, parseSemanticKey } from './identity.js';
import type { RegionalRectangleFootprint } from './regional-footprint-model.js';
import { sha256 } from './sha-256.js';

const ENCODER = new TextEncoder();

/** Return the explicit, field-bounded ADR-0023 identity tuple before it is hashed. */
export function encodeRegionalFootprintIdentityInput(
  footprint: RegionalRectangleFootprint,
): string {
  return [
    footprint.shapeVersion,
    footprint.rootSurfaceId,
    String(footprint.worldRadius.radiusMillimeters),
    String(footprint.origin.longitudeTicks),
    String(footprint.origin.latitudeTicks),
    String(footprint.extent.minXMillimeters),
    String(footprint.extent.maxXMillimeters),
    String(footprint.extent.minYMillimeters),
    String(footprint.extent.maxYMillimeters),
    footprint.transformId,
    String(footprint.transformVersion),
  ].join('\n');
}

/** Derive the root-surface-owned stable entity ID for one accepted footprint. */
export function deriveRegionalFootprintEntityId(footprint: RegionalRectangleFootprint): EntityId {
  return deriveStableId(
    'entity',
    footprint.rootSurfaceId,
    semanticKey(`regional-footprint-${digestHex(encodeRegionalFootprintIdentityInput(footprint))}`),
  );
}

function digestHex(value: string): string {
  return Array.from(sha256(ENCODER.encode(value)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function semanticKey(value: string): SemanticKey {
  const parsed = parseSemanticKey(value);
  if (!parsed.ok) throw new Error('Internal regional-footprint semantic key is invalid.');
  return parsed.value;
}
