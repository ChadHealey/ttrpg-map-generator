import { createImmutableDomainSnapshot, type WorldDocument } from '@ttrpg-map/core';

import { encodeBase64Bytes } from './base64-bytes.js';
import {
  bytesEqual,
  canonicalJsonBytes,
  parseCanonicalJsonBytes,
  sha256Hex,
} from './canonical-json.js';
import { decodeMapworld } from './mapworld-decode.js';
import { encodeMapworld } from './mapworld-encode.js';
import {
  MAPWORLD_NATIVE_LIMITS,
  MAPWORLD_RECOVERY_CODES,
  MAPWORLD_RECOVERY_PROTOCOL_VERSION,
  type MapworldRecoveryArtifactNames,
  type MapworldRecoveryMarker,
  type MapworldRecoveryResult,
  type MapworldSaveIntent,
  type MapworldSavePlan,
} from './mapworld-recovery-model.js';
import { recoveryFailure, recoverySuccess } from './mapworld-recovery-result.js';
import {
  mapworldRecoveryMarkerSchema,
  mapworldRecoveryMarkerVersionSchema,
} from './mapworld-recovery-schemas.js';
import { createMapworldV2Candidate, isMapworldV2ExternalAspectName } from './mapworld-v2-codec.js';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const UTF8_ENCODER = new TextEncoder();

export function deriveMapworldRecoveryArtifactNames(
  targetName: string,
): MapworldRecoveryResult<MapworldRecoveryArtifactNames> {
  if (
    targetName.length === 0 ||
    targetName === '.' ||
    targetName === '..' ||
    !targetName.endsWith('.mapworld') ||
    targetName.includes('/') ||
    targetName.includes('\0')
  ) {
    return invalidArtifactName(targetName);
  }
  const protocolVersionText = String(MAPWORLD_RECOVERY_PROTOCOL_VERSION);
  const names = Object.freeze({
    targetName,
    temporaryName: `.${targetName}.commit-v${protocolVersionText}.temporary`,
    backupName: `.${targetName}.commit-v${protocolVersionText}.backup`,
    markerName: `.${targetName}.commit-v${protocolVersionText}.json`,
  });
  if (
    Object.values(names).some(
      (name) => UTF8_ENCODER.encode(name).byteLength > MAPWORLD_NATIVE_LIMITS.maximumBasenameBytes,
    )
  ) {
    return invalidArtifactName(targetName);
  }
  return recoverySuccess(names);
}

export function createMapworldSavePlan(
  document: WorldDocument,
  intent: MapworldSaveIntent,
): MapworldRecoveryResult<MapworldSavePlan> {
  return createMapworldSavePlanForVersion(document, intent, 'automatic');
}

/** Explicit v1-to-v2 candidate creation using the unchanged ADR-0008 staging protocol. */
export function createMapworldV2SavePlan(
  document: WorldDocument,
  intent: MapworldSaveIntent,
): MapworldRecoveryResult<MapworldSavePlan> {
  return createMapworldSavePlanForVersion(document, intent, 'v2');
}

function createMapworldSavePlanForVersion(
  document: WorldDocument,
  intent: MapworldSaveIntent,
  version: 'automatic' | 'v2',
): MapworldRecoveryResult<MapworldSavePlan> {
  const names = deriveMapworldRecoveryArtifactNames(intent.targetName);
  if (!names.ok) return names;
  if (
    intent.operation === 'replacement-save' &&
    !SHA256_PATTERN.test(intent.previousManifestSha256)
  ) {
    return recoveryFailure(
      MAPWORLD_RECOVERY_CODES.fingerprintMismatch,
      'The expected previous manifest fingerprint is not canonical SHA-256.',
      'Reopen the target and use its validated manifest fingerprint before replacing it.',
      { expectedFingerprint: intent.previousManifestSha256 },
    );
  }
  const snapshot = createImmutableDomainSnapshot(document);
  const encoded = !snapshot.ok
    ? encodeMapworld(document)
    : version === 'v2' || requiresMapworldV2(snapshot.value)
      ? createMapworldV2Candidate(snapshot.value)
      : encodeMapworld(snapshot.value);
  if (!encoded.ok) {
    return recoveryFailure(
      MAPWORLD_RECOVERY_CODES.fingerprintMismatch,
      'The immutable world-document snapshot could not be encoded for saving.',
      'Resolve the nested persistence diagnostics before saving.',
      { diagnostics: Object.freeze([...encoded.diagnostics]) },
    );
  }
  const decoded = decodeMapworld(encoded.value);
  if (!decoded.ok) {
    return recoveryFailure(
      MAPWORLD_RECOVERY_CODES.fingerprintMismatch,
      'The encoded save candidate did not pass complete mapworld validation.',
      'Do not write the candidate; resolve the nested persistence diagnostics.',
      { diagnostics: Object.freeze([...decoded.diagnostics]) },
    );
  }
  const manifest = encoded.value.files.find(({ path }) => path === 'manifest.json');
  if (manifest === undefined) {
    return recoveryFailure(
      MAPWORLD_RECOVERY_CODES.fingerprintMismatch,
      'The validated save candidate has no manifest bytes.',
      'Recreate the candidate with the supported mapworld encoder.',
    );
  }
  const candidateManifestSha256 = sha256Hex(manifest.bytes);
  const previousManifestSha256 = intent.previousManifestSha256;
  const marker: MapworldRecoveryMarker = Object.freeze({
    backupName: names.value.backupName,
    candidateManifestSha256,
    checksumAlgorithm: 'sha256',
    operation: intent.operation,
    previousManifestSha256,
    protocol: 'mapworld-directory-commit',
    protocolVersion: MAPWORLD_RECOVERY_PROTOCOL_VERSION,
    targetName: names.value.targetName,
    temporaryName: names.value.temporaryName,
  });
  const markerBytes = canonicalJsonBytes(marker, names.value.markerName);
  if (!markerBytes.ok) {
    return recoveryFailure(
      MAPWORLD_RECOVERY_CODES.markerInvalid,
      'The recovery marker could not be encoded canonically.',
      'Do not begin the native save operation.',
      { diagnostics: Object.freeze([...markerBytes.diagnostics]) },
    );
  }
  return recoverySuccess(
    Object.freeze({
      operation: intent.operation,
      targetName: intent.targetName,
      artifactNames: names.value,
      expectedPreviousManifestSha256: previousManifestSha256,
      candidateManifestSha256,
      markerBase64: encodeBase64Bytes(markerBytes.value),
      files: Object.freeze(
        encoded.value.files.map((file) =>
          Object.freeze({ path: file.path, bytesBase64: encodeBase64Bytes(file.bytes) }),
        ),
      ),
    }),
  );
}

function requiresMapworldV2(document: WorldDocument): boolean {
  const maps = (document as unknown as { readonly maps?: unknown }).maps;
  if (!Array.isArray(maps)) return false;
  return maps.some((map) => {
    if (!isRecord(map) || !Array.isArray(map.aspects)) return false;
    const hasExternalAspect = map.aspects.some(
      (aspect) =>
        isRecord(aspect) &&
        typeof aspect.aspectName === 'string' &&
        isMapworldV2ExternalAspectName(aspect.aspectName),
    );
    return (
      hasExternalAspect ||
      (map.mapKind === 'regional' &&
        isRecord(map.parent) &&
        map.parent.inheritedContext !== undefined)
    );
  });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseMapworldRecoveryMarker(
  bytes: ArrayLike<number>,
  expectedTargetName: string,
): MapworldRecoveryResult<MapworldRecoveryMarker> {
  const byteArray = Uint8Array.from(bytes);
  const parsed = parseCanonicalJsonBytes(byteArray, 'recovery-marker');
  if (!parsed.ok) {
    return recoveryFailure(
      MAPWORLD_RECOVERY_CODES.markerInvalid,
      'Recovery marker bytes are not valid canonical JSON.',
      'Preserve the marker and require explicit candidate-specific resolution.',
      { role: 'marker', diagnostics: Object.freeze([...parsed.diagnostics]) },
    );
  }
  const genericCanonical = canonicalJsonBytes(parsed.value, 'recovery-marker');
  if (!genericCanonical.ok || !bytesEqual(genericCanonical.value, byteArray)) {
    return recoveryFailure(
      MAPWORLD_RECOVERY_CODES.markerInvalid,
      'Recovery marker JSON is not in the exact canonical byte form.',
      'Preserve the marker and require explicit candidate-specific resolution.',
      {
        role: 'marker',
        ...(genericCanonical.ok ? {} : { diagnostics: genericCanonical.diagnostics }),
      },
    );
  }
  const version = mapworldRecoveryMarkerVersionSchema.safeParse(parsed.value);
  if (version.success && version.data.protocolVersion !== MAPWORLD_RECOVERY_PROTOCOL_VERSION) {
    return recoveryFailure(
      MAPWORLD_RECOVERY_CODES.markerVersionIncompatible,
      'The recovery marker protocol version is not implemented.',
      'Preserve the marker and use a reader that implements its protocol version.',
      { role: 'marker' },
    );
  }
  const validated = mapworldRecoveryMarkerSchema.safeParse(parsed.value);
  if (!validated.success) {
    return recoveryFailure(
      MAPWORLD_RECOVERY_CODES.markerInvalid,
      'Recovery marker fields are malformed or inconsistent.',
      'Preserve the marker and require explicit candidate-specific resolution.',
      { role: 'marker' },
    );
  }
  const names = deriveMapworldRecoveryArtifactNames(expectedTargetName);
  if (
    !names.ok ||
    validated.data.targetName !== expectedTargetName ||
    validated.data.temporaryName !== names.value.temporaryName ||
    validated.data.backupName !== names.value.backupName
  ) {
    return recoveryFailure(
      MAPWORLD_RECOVERY_CODES.markerInvalid,
      'Recovery marker artifact names do not match the selected target.',
      'Preserve all artifacts and reopen the target named by the marker.',
      { role: 'marker' },
    );
  }
  return recoverySuccess(
    Object.freeze({
      ...validated.data,
      protocolVersion: MAPWORLD_RECOVERY_PROTOCOL_VERSION,
    }),
  );
}

function invalidArtifactName(
  targetName: string,
): MapworldRecoveryResult<MapworldRecoveryArtifactNames> {
  return recoveryFailure(
    MAPWORLD_RECOVERY_CODES.artifactNameInvalid,
    `The mapworld target name cannot safely derive recovery artifacts: ${JSON.stringify(targetName)}.`,
    'Choose a Unicode basename ending in .mapworld that fits the native basename limit.',
  );
}
