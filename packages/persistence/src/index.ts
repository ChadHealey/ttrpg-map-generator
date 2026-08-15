/** Validated canonical project-package boundaries around project-owned core domain records. */

export { decodeMapworld } from './mapworld-decode.js';
export {
  canonicalAspectBytes,
  canonicalAspectOutputBytes,
  encodeMapworld,
} from './mapworld-encode.js';
export {
  ACCEPTED_ASPECT_SCHEMA_VERSION,
  type CanonicalJsonPrimitive,
  type CanonicalJsonValue,
  MAP_DOCUMENT_SCHEMA_VERSION,
  MAPWORLD_APPLICATION_COMPATIBILITY,
  MAPWORLD_CHECKSUM_ALGORITHM,
  MAPWORLD_PACKAGE_VERSION,
  MAPWORLD_SCHEMA_VERSION,
  type MapworldPackage,
  type MapworldPackageFile,
  PERSISTENCE_DIAGNOSTIC_CODES,
  type PersistenceDiagnostic,
  type PersistenceDiagnosticCode,
  type PersistenceResult,
  type ReadonlyMapworldPackage,
  WORLD_INDEX_SCHEMA_VERSION,
} from './persistence-model.js';
