/** Stable IDs and validation-only parsers for Milestone 3 physical-context contracts. */

import { deriveAtlasFeatureEntityId } from './atlas-geography-aspects.js';
import { parsePlanetPoint, type PlanetPoint } from './coordinates.js';
import {
  type AspectId,
  deriveStableId,
  type EntityId,
  type MapId,
  parseSemanticKey,
  type SemanticKey,
} from './identity.js';
import { sha256 } from './sha-256.js';
import type { WorldPhysicalContextAspectKind } from './world-physical-context-aspects.js';
import {
  type BiomeKey,
  type ClimateZoneKey,
  type WorldPhysicalFieldFingerprint,
  type WorldPhysicalFieldKind,
  type WorldPhysicalFieldProvenance,
  type WorldPhysicalRootSignature,
} from './world-physical-context-model.js';
import {
  getWorldPhysicalFieldReaderValueFingerprint,
  type WorldPhysicalFieldReader,
} from './world-physical-context-readers.js';

const ENCODER = new TextEncoder();
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;

/** Derive a world-surface-owned M3 aspect ID without an aspect display name or position. */
export function deriveWorldPhysicalContextAspectId(
  worldSurfaceEntityId: EntityId,
  kind: WorldPhysicalContextAspectKind,
): AspectId {
  return deriveStableId(
    'aspect',
    worldSurfaceEntityId,
    semanticKey(`world-physical.${canonicalAspectKey(kind)}`),
  );
}

export type WorldPhysicalFeatureKind = 'lake' | 'mountain-system' | 'river' | 'watershed';

/** Derive one biome-belt identity from its canonical class key and representative root. */
export function deriveWorldPhysicalBiomeBeltEntityId(
  worldMapId: MapId,
  biomeKey: BiomeKey,
  signature: WorldPhysicalRootSignature,
): EntityId {
  return deriveAtlasFeatureEntityId(worldMapId, semanticKey(`biome-belt-${biomeKey}-${signature}`));
}

/** Hash the lexicographically first canonical root coordinate, independent of geometry ordering. */
export function fingerprintWorldPhysicalRootSignature(
  points: readonly PlanetPoint[],
): WorldPhysicalRootSignature {
  const root = canonicalRootPoint(points);
  return digestHex(
    `ttrpg-map/world-physical-root-signature/v1/${String(root.longitudeTicks)}:${String(root.latitudeTicks)}`,
  ) as WorldPhysicalRootSignature;
}

/** Derive feature identity from kind and canonical root signature, never labels or array positions. */
export function deriveWorldPhysicalFeatureEntityId(
  worldMapId: MapId,
  kind: WorldPhysicalFeatureKind,
  signature: WorldPhysicalRootSignature,
): EntityId {
  return deriveAtlasFeatureEntityId(worldMapId, semanticKey(`${kind}-${signature}`));
}

/** Fingerprint canonical field metadata and the immutable reader's canonical logical values. */
export function fingerprintWorldPhysicalField<Kind extends WorldPhysicalFieldKind, Value>(
  field: Readonly<{
    provenance: Omit<WorldPhysicalFieldProvenance<Kind>, 'fingerprint'>;
    minimumValue: Value;
    maximumValue: Value;
    values: WorldPhysicalFieldReader<Value>;
  }>,
): WorldPhysicalFieldFingerprint {
  const provenance = field.provenance;
  const canonical = [
    'ttrpg-map/world-physical-field/v1',
    provenance.contractVersion,
    provenance.fieldKind,
    provenance.ownerAspectId,
    ...provenance.sourceAspectIds,
    provenance.fieldBehaviorVersion,
    provenance.fieldEncodingVersion,
    provenance.valueEncoding,
    provenance.quantizationScale,
    provenance.samplingProfileId,
    provenance.samplingPolicyVersion,
    provenance.longitudeCellCount,
    provenance.latitudeBandCount,
    provenance.canonicalTraversal,
    canonicalFieldValue(field.minimumValue),
    canonicalFieldValue(field.maximumValue),
  ];
  canonical.push(getWorldPhysicalFieldReaderValueFingerprint(field.values));
  return digestHex(canonical.join('\n')) as WorldPhysicalFieldFingerprint;
}

export function parseClimateZoneKey(value: unknown): ClimateZoneKey | undefined {
  const parsed = parseSemanticKey(value);
  return parsed.ok ? (parsed.value as ClimateZoneKey) : undefined;
}

export function parseBiomeKey(value: unknown): BiomeKey | undefined {
  const parsed = parseSemanticKey(value);
  return parsed.ok ? (parsed.value as BiomeKey) : undefined;
}

export function isWorldPhysicalFieldFingerprint(
  value: unknown,
): value is WorldPhysicalFieldFingerprint {
  return typeof value === 'string' && FINGERPRINT_PATTERN.test(value);
}

/** Accept an already-derived canonical field fingerprint at the core record boundary. */
export function parseWorldPhysicalFieldFingerprint(
  value: unknown,
): WorldPhysicalFieldFingerprint | undefined {
  return isWorldPhysicalFieldFingerprint(value) ? value : undefined;
}

function digestHex(value: string): string {
  return Array.from(sha256(ENCODER.encode(value)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function canonicalRootPoint(points: readonly PlanetPoint[]): PlanetPoint {
  const roots = points.map((point) => parsePlanetPoint(point));
  if (roots.length === 0 || roots.some((root) => !root.ok)) {
    throw new TypeError(
      'World physical feature roots require one or more canonical planet points.',
    );
  }
  const values = roots.map((root) => (root.ok ? root.value : undefined));
  values.sort(
    (left, right) =>
      (left?.longitudeTicks ?? 0) - (right?.longitudeTicks ?? 0) ||
      (left?.latitudeTicks ?? 0) - (right?.latitudeTicks ?? 0),
  );
  const root = values[0];
  if (root === undefined) throw new Error('Canonical world physical root is missing.');
  return root;
}

function canonicalFieldValue(value: unknown): string {
  if (typeof value === 'number' || typeof value === 'string') return JSON.stringify(value);
  throw new TypeError('World physical field values must be canonical numbers or strings.');
}

function semanticKey(value: string): SemanticKey {
  const parsed = parseSemanticKey(value);
  if (!parsed.ok) throw new Error('Internal world physical-context semantic key is invalid.');
  return parsed.value;
}

function canonicalAspectKey(kind: WorldPhysicalContextAspectKind): string {
  return kind.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}
