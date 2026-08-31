/** Domain-owned checksum grammar for immutable inherited-context snapshots. */

import {
  INHERITED_CONTEXT_SEMANTIC_CHECKSUM_ALGORITHM,
  INHERITED_CONTEXT_SEMANTIC_CHECKSUM_VERSION,
  type InheritedContextSemanticChecksum,
  type InheritedContextSemanticChecksumRecord,
  type InheritedContextSnapshot,
  type InheritedContextSnapshotContent,
} from './inherited-context-model.js';
import { sha256 } from './sha-256.js';

const ENCODER = new TextEncoder();
const CHECKSUM_DOMAIN = 'ttrpg-map/inherited-context-semantic-checksum/v1\n';
const CHECKSUM_PATTERN = /^[0-9a-f]{64}$/;

/** Extract exactly the semantic fields covered by the checksum, excluding the checksum itself. */
export function inheritedContextSnapshotContent(
  snapshot: InheritedContextSnapshot,
): InheritedContextSnapshotContent {
  const {
    semanticChecksum: _semanticChecksum,
    contractVersion,
    rootMapId,
    parentMapId,
    footprintId,
    footprint,
    rootRefinementNamespace,
    collar,
    sourceLineage,
    sourceAspectVersions,
    fields,
    geometryAnchors,
    boundaryPortals,
    namedAnchors,
  } = snapshot;
  return {
    contractVersion,
    rootMapId,
    parentMapId,
    footprintId,
    footprint,
    rootRefinementNamespace,
    collar,
    sourceLineage,
    sourceAspectVersions,
    fields,
    geometryAnchors,
    boundaryPortals,
    namedAnchors,
  };
}

/** Encode the versioned, field-bounded semantic checksum input independently of persistence. */
export function encodeInheritedContextSemanticChecksumInput(
  content: InheritedContextSnapshotContent,
): Uint8Array {
  return ENCODER.encode(CHECKSUM_DOMAIN + encodeCanonicalValue(content));
}

/** Compute the semantic checksum that covers every snapshot field except its checksum record. */
export function computeInheritedContextSemanticChecksum(
  content: InheritedContextSnapshotContent,
): InheritedContextSemanticChecksumRecord {
  const value = digestHex(sha256(encodeInheritedContextSemanticChecksumInput(content)));
  return Object.freeze({
    algorithm: INHERITED_CONTEXT_SEMANTIC_CHECKSUM_ALGORITHM,
    checksumVersion: INHERITED_CONTEXT_SEMANTIC_CHECKSUM_VERSION,
    value,
  });
}

export function isInheritedContextSemanticChecksum(
  value: unknown,
): value is InheritedContextSemanticChecksum {
  return typeof value === 'string' && CHECKSUM_PATTERN.test(value);
}

function encodeCanonicalValue(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      throw new TypeError('Inherited-context checksum input contains a non-canonical number.');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => encodeCanonicalValue(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort(compareAscii);
    if (Reflect.ownKeys(value).length !== keys.length) {
      throw new TypeError('Inherited-context checksum input must contain plain string-keyed data.');
    }
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${encodeCanonicalValue(readDataProperty(value, key))}`)
      .join(',')}}`;
  }
  throw new TypeError('Inherited-context checksum input contains a non-domain value.');
}

function readDataProperty(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined || !('value' in descriptor)) {
    throw new TypeError('Inherited-context checksum input cannot contain accessors.');
  }
  return descriptor.value;
}

function digestHex(bytes: Uint8Array): InheritedContextSemanticChecksum {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  ) as InheritedContextSemanticChecksum;
}

function compareAscii(left: string, right: string): -1 | 0 | 1 {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
