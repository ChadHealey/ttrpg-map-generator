/** Validated canonical project-package boundaries around project-owned core domain records. */

export { decodedBase64ByteLength, encodeBase64Bytes } from './base64-bytes.js';
export { decodeMapworld, decodeMapworldV1 } from './mapworld-decode.js';
export {
  canonicalAspectBytes,
  canonicalAspectOutputBytes,
  encodeMapworld,
} from './mapworld-encode.js';
export type { MapworldFieldDescriptor, MapworldFieldEncoding } from './mapworld-field-codec.js';
export { classifyMapworldRecoverySnapshot } from './mapworld-recovery-classification.js';
export { planConfirmedMapworldRecovery } from './mapworld-recovery-confirmation.js';
export { decideMapworldRecovery } from './mapworld-recovery-decision.js';
export {
  createMapworldSavePlan,
  createMapworldV2SavePlan,
  deriveMapworldRecoveryArtifactNames,
} from './mapworld-recovery-marker.js';
export {
  type ClassifiedMapworldMarkerCandidate,
  type ClassifiedMapworldPackageCandidate,
  type ClassifiedMapworldRecoverySnapshot,
  MAPWORLD_NATIVE_LIMITS,
  MAPWORLD_RECOVERY_CODES,
  MAPWORLD_RECOVERY_PROTOCOL_VERSION,
  type MapworldPackageRole,
  type MapworldRecoveryArtifactNames,
  type MapworldRecoveryAttention,
  type MapworldRecoveryCode,
  type MapworldRecoveryConfirmation,
  type MapworldRecoveryDecision,
  type MapworldRecoveryError,
  type MapworldRecoveryExpectedObservation,
  type MapworldRecoveryMarker,
  type MapworldRecoveryNativePlan,
  type MapworldRecoveryResult,
  type MapworldRecoveryRole,
  type MapworldRecoveryStep,
  type MapworldSaveIntent,
  type MapworldSavePlan,
  type MapworldSavePlanFile,
  type NativeMapworldObservedKind,
  type NativeMapworldOsContext,
  type ReadonlyClassifiedMapworldRecoverySnapshot,
} from './mapworld-recovery-model.js';
export {
  type MapworldNativeApplyRequestDto,
  type MapworldNativeErrorDto,
  type MapworldNativeMutationDto,
  type MapworldNativePlatformDto,
  type MapworldNativeRoleDto,
  type MapworldNativeSaveRequestDto,
  parseMapworldNativeApplyRequestDto,
  parseMapworldNativeMutationResponse,
  parseMapworldNativeSaveRequestDto,
  parseMapworldNativeSnapshotResponse,
  validateMapworldNativeSaveRequestDto,
  validateParsedMapworldNativeSaveRequestDto,
} from './mapworld-recovery-native-dto.js';
export { createMapworldV2Candidate, encodeMapworldV2 } from './mapworld-v2-codec.js';
export {
  ACCEPTED_ASPECT_SCHEMA_VERSION,
  type CanonicalJsonPrimitive,
  type CanonicalJsonValue,
  MAP_DOCUMENT_SCHEMA_VERSION,
  MAPWORLD_APPLICATION_COMPATIBILITY,
  MAPWORLD_CHECKSUM_ALGORITHM,
  MAPWORLD_FIELD_FILE_SCHEMA_VERSION,
  MAPWORLD_PACKAGE_VERSION,
  MAPWORLD_SCHEMA_VERSION,
  MAPWORLD_V2_ACCEPTED_ASPECT_SCHEMA_VERSION,
  MAPWORLD_V2_APPLICATION_COMPATIBILITY,
  MAPWORLD_V2_MAP_DOCUMENT_SCHEMA_VERSION,
  MAPWORLD_V2_PACKAGE_VERSION,
  MAPWORLD_V2_SCHEMA_VERSION,
  type MapworldPackage,
  type MapworldPackageFile,
  PERSISTENCE_DIAGNOSTIC_CODES,
  type PersistenceDiagnostic,
  type PersistenceDiagnosticCode,
  type PersistenceResult,
  type ReadonlyMapworldPackage,
  WORLD_INDEX_SCHEMA_VERSION,
} from './persistence-model.js';
