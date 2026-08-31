import {
  type AcceptedAspectRecord,
  type BiomeBeltField,
  type ClimateZoneField,
  createImmutableDomainSnapshot,
  deriveWorldPhysicalContextAspectId,
  isWorldPhysicalFieldReader,
  type MajorLake,
  type MajorRiver,
  type MoistureField,
  type MountainSystems,
  type PrevailingWindField,
  type TemperatureField,
  validateWorldPhysicalBiomeBeltField,
  validateWorldPhysicalClimateZoneField,
  validateWorldPhysicalMajorLakes,
  validateWorldPhysicalMajorRivers,
  validateWorldPhysicalMoistureField,
  validateWorldPhysicalMountainSystems,
  validateWorldPhysicalPrevailingWindField,
  validateWorldPhysicalTemperatureField,
  validateWorldPhysicalWatersheds,
  type WatershedRecords,
  WORLD_PHYSICAL_TEMPERATURE_QUANTUM_CELSIUS,
  WORLD_PHYSICAL_WIND_SPEED_QUANTUM_METERS_PER_SECOND,
  type WorldDocument,
  type WorldPhysicalContextAspectKind,
  type WorldPhysicalContextDiagnostic,
  type WorldPhysicalFieldReader,
} from '@ttrpg-map/core';
import { z } from 'zod';

import { acceptedAspectDtoSchema } from './accepted-aspect-dto-schema.js';
import { acceptedAspectFromDto } from './accepted-aspect-from-dto.js';
import { decodeCanonicalDto } from './canonical-dto-decoding.js';
import {
  bytesEqual,
  canonicalJsonBytes,
  parseCanonicalJsonBytes,
  sha256Hex,
} from './canonical-json.js';
import { validateDocumentForPersistence } from './document-validation.js';
import {
  acceptedAspectToDto,
  mapDocumentToDto,
  orderedMaps,
  worldIndexRaw,
} from './domain-to-dto.js';
import { orderAcceptedAspectDto, orderMapDocumentDto, orderWorldIndexDto } from './dto-ordering.js';
import { type MapDocumentDto, mapDocumentDtoSchema } from './map-document-dto-schema.js';
import {
  decodeMapworldField,
  encodeMapworldField,
  isMapworldFieldDescriptor,
} from './mapworld-field-codec.js';
import { MAPWORLD_NATIVE_LIMITS } from './mapworld-recovery-model.js';
import { mapworldV2AcceptedAspectDtoSchema } from './mapworld-v2-aspect-dto-schema.js';
import { type WorldIndexDto, worldIndexDtoSchema } from './package-dto-schemas.js';
import { validateMapIndexEntry, validateWorldIndex } from './package-index-validation.js';
import {
  comparePersistenceDiagnostics,
  persistenceDiagnostic,
  persistenceFailure,
  persistenceSuccess,
} from './persistence-diagnostics.js';
import {
  ACCEPTED_ASPECT_SCHEMA_VERSION,
  MAPWORLD_CHECKSUM_ALGORITHM,
  MAPWORLD_FIELD_FILE_SCHEMA_VERSION,
  MAPWORLD_V2_ACCEPTED_ASPECT_SCHEMA_VERSION,
  MAPWORLD_V2_APPLICATION_COMPATIBILITY,
  MAPWORLD_V2_MAP_DOCUMENT_SCHEMA_VERSION,
  MAPWORLD_V2_PACKAGE_VERSION,
  MAPWORLD_V2_SCHEMA_VERSION,
  type MapworldPackage,
  type MapworldPackageFile,
  PERSISTENCE_DIAGNOSTIC_CODES,
  type PersistenceDiagnostic,
  type PersistenceResult,
  WORLD_INDEX_SCHEMA_VERSION,
} from './persistence-model.js';
import { validateDto } from './schema-validation.js';
import { worldDocumentFromDtos } from './world-document-from-dtos.js';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const MAP_PATH = new RegExp(`^maps/${UUID}\\.json$`, 'u');
const ASPECT_PATH = new RegExp(`^data/(${UUID})/aspects/(${UUID})\\.json$`, 'u');
const FIELD_PATH = new RegExp(`^data/(${UUID})/fields/(${UUID})\\.([a-z0-9-]+)\\.mwf$`, 'u');
const M3_ASPECT_NAMES = new Set([
  'worldTerrain.mountainSystems',
  'worldClimate.temperature',
  'worldClimate.prevailingWinds',
  'worldClimate.moisture',
  'worldClimate.zones',
  'worldEcology.biomeBelts',
  'worldHydrology.watersheds',
  'worldHydrology.majorRivers',
  'worldHydrology.majorLakes',
]);

export function isMapworldV2ExternalAspectName(value: string): boolean {
  return M3_ASPECT_NAMES.has(value);
}

const externalReferenceSchema = z.strictObject({
  acceptedAspectSchemaVersion: z.literal(MAPWORLD_V2_ACCEPTED_ASPECT_SCHEMA_VERSION),
  aspectId: z.string(),
  aspectName: z.string(),
  path: z.string().regex(ASPECT_PATH),
});

const authoritativeFileSchema = z.strictObject({
  path: z
    .string()
    .refine(
      (path) =>
        path === 'world.json' ||
        MAP_PATH.test(path) ||
        ASPECT_PATH.test(path) ||
        FIELD_PATH.test(path),
    ),
  checksumAlgorithm: z.literal(MAPWORLD_CHECKSUM_ALGORITHM),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u),
});

export const mapworldV2ManifestDtoSchema = z.strictObject({
  packageVersion: z.literal(MAPWORLD_V2_PACKAGE_VERSION),
  schemaVersion: z.literal(MAPWORLD_V2_SCHEMA_VERSION),
  applicationCompatibility: z.strictObject({
    minimumVersion: z.literal(MAPWORLD_V2_APPLICATION_COMPATIBILITY.minimumVersion),
    maximumVersionExclusive: z.literal(
      MAPWORLD_V2_APPLICATION_COMPATIBILITY.maximumVersionExclusive,
    ),
  }),
  recordSchemaVersions: z.strictObject({
    worldIndex: z.literal(WORLD_INDEX_SCHEMA_VERSION),
    mapDocument: z.literal(MAPWORLD_V2_MAP_DOCUMENT_SCHEMA_VERSION),
    acceptedAspect: z.literal(MAPWORLD_V2_ACCEPTED_ASPECT_SCHEMA_VERSION),
    externalFieldFile: z.literal(MAPWORLD_FIELD_FILE_SCHEMA_VERSION),
  }),
  authoritativeFiles: z.array(authoritativeFileSchema).min(2),
  recovery: z.strictObject({ mode: z.literal('none') }),
});

export type MapworldV2ManifestDto = z.infer<typeof mapworldV2ManifestDtoSchema>;
type ExternalReference = z.infer<typeof externalReferenceSchema>;

export interface DecodedV2Map {
  readonly dto: MapDocumentDto;
  readonly externalAspects: readonly AcceptedAspectRecord[];
}

export interface DecodedV2Dtos {
  readonly world: WorldIndexDto;
  readonly maps: readonly DecodedV2Map[];
}

interface EncodedExternalAspect {
  readonly aspect: AcceptedAspectRecord;
  readonly aspectPath: string;
  readonly aspectBytes: Uint8Array;
  readonly fieldFiles: readonly MapworldPackageFile[];
}

const FIELD_SPECS = Object.freeze({
  'worldClimate.temperature': [{ path: ['values'], component: 'temperature', encoding: 'i16' }],
  'worldClimate.prevailingWinds': [
    { path: ['xComponents', 'values'], component: 'prevailing-winds-x', encoding: 'i32' },
    { path: ['yComponents', 'values'], component: 'prevailing-winds-y', encoding: 'i32' },
    { path: ['zComponents', 'values'], component: 'prevailing-winds-z', encoding: 'i32' },
    { path: ['speed', 'values'], component: 'prevailing-winds-speed', encoding: 'u16' },
  ],
  'worldClimate.moisture': [{ path: ['values'], component: 'moisture', encoding: 'u32' }],
  'worldClimate.zones': [{ path: ['values'], component: 'climate-zones' }],
  'worldEcology.biomeBelts': [{ path: ['values'], component: 'biome-belts' }],
  'worldHydrology.watersheds': [{ path: ['values'], component: 'watersheds' }],
} as const);

export function encodeMapworldV2(
  document: WorldDocument,
  externalAspects: readonly AcceptedAspectRecord[],
): PersistenceResult<MapworldPackage> {
  const snapshot = createImmutableDomainSnapshot({ document, externalAspects });
  if (!snapshot.ok) return invalidSnapshot('$document');
  const safeDocument = snapshot.value.document;
  const safeExternal = snapshot.value.externalAspects as readonly AcceptedAspectRecord[];
  const externalIds = new Set(safeExternal.map(({ aspectId }) => aspectId));
  if (externalIds.size !== safeExternal.length)
    return referenceFailure('External aspect IDs must be unique.');
  if (
    safeDocument.maps.some((map) => map.aspects.some(({ aspectId }) => externalIds.has(aspectId)))
  ) {
    return referenceFailure('An accepted aspect cannot be both inline and external.');
  }
  if (
    safeDocument.maps.some((map) =>
      map.aspects.some(({ aspectName }) => M3_ASPECT_NAMES.has(aspectName)),
    )
  ) {
    return referenceFailure('Milestone 3 physical aspects must be external in a v2 package.');
  }
  for (const aspect of safeExternal) {
    const owner = safeDocument.maps.find(({ mapId }) => mapId === aspect.mapId);
    if (owner === undefined || !M3_ASPECT_NAMES.has(aspect.aspectName)) {
      return referenceFailure(
        'Every external aspect must be a known M3 physical aspect owned by a package map.',
      );
    }
  }
  const completeDocument: WorldDocument = {
    ...safeDocument,
    maps: safeDocument.maps.map((map) => ({
      ...map,
      aspects: [...map.aspects, ...safeExternal.filter(({ mapId }) => mapId === map.mapId)],
    })),
  };
  const documentDiagnostics = validateDocumentForPersistence(completeDocument);
  if (documentDiagnostics.length > 0) return persistenceFailure(...documentDiagnostics);

  const physicalDiagnostics = safeDocument.maps.flatMap((map) =>
    validatePhysicalAspectSet(
      map.mapId,
      safeExternal.filter(({ mapId }) => mapId === map.mapId),
    ),
  );
  if (physicalDiagnostics.length > 0) return persistenceFailure(...physicalDiagnostics);

  const encodedAspects: EncodedExternalAspect[] = [];
  for (const aspect of [...safeExternal].sort((left, right) =>
    compareText(left.aspectId, right.aspectId),
  )) {
    const encoded = encodeExternalAspect(aspect);
    if (!encoded.ok) return encoded;
    encodedAspects.push(encoded.value);
  }

  const authoritativeFiles: MapworldPackageFile[] = [];
  const world = validateDto(worldIndexDtoSchema, worldIndexRaw(safeDocument), 'world.json');
  if (!world.ok) return world;
  const worldBytes = canonicalJsonBytes(orderWorldIndexDto(world.value), 'world.json');
  if (!worldBytes.ok) return worldBytes;
  authoritativeFiles.push({ path: 'world.json', bytes: worldBytes.value });

  for (const map of orderedMaps(safeDocument)) {
    const inline = mapDocumentToDto(map);
    if (!inline.ok) return inline;
    const references = encodedAspects
      .filter(({ aspect }) => aspect.mapId === map.mapId)
      .map(({ aspect, aspectPath }) => ({
        acceptedAspectSchemaVersion: MAPWORLD_V2_ACCEPTED_ASPECT_SCHEMA_VERSION,
        aspectId: aspect.aspectId,
        aspectName: aspect.aspectName,
        path: aspectPath,
      }))
      .sort((left, right) => compareText(left.aspectId, right.aspectId));
    const raw = v2MapFromV1(inline.value, references);
    const path = `maps/${map.mapId}.json`;
    const bytes = canonicalJsonBytes(raw, path);
    if (!bytes.ok) return bytes;
    authoritativeFiles.push({ path, bytes: bytes.value });
  }
  for (const encoded of encodedAspects)
    authoritativeFiles.push(
      { path: encoded.aspectPath, bytes: encoded.aspectBytes },
      ...encoded.fieldFiles,
    );
  authoritativeFiles.sort((left, right) => compareAuthoritativePaths(left.path, right.path));

  const manifest: MapworldV2ManifestDto = {
    packageVersion: MAPWORLD_V2_PACKAGE_VERSION,
    schemaVersion: MAPWORLD_V2_SCHEMA_VERSION,
    applicationCompatibility: { ...MAPWORLD_V2_APPLICATION_COMPATIBILITY },
    recordSchemaVersions: {
      worldIndex: WORLD_INDEX_SCHEMA_VERSION,
      mapDocument: MAPWORLD_V2_MAP_DOCUMENT_SCHEMA_VERSION,
      acceptedAspect: MAPWORLD_V2_ACCEPTED_ASPECT_SCHEMA_VERSION,
      externalFieldFile: MAPWORLD_FIELD_FILE_SCHEMA_VERSION,
    },
    authoritativeFiles: authoritativeFiles.map(({ path, bytes }) => ({
      path,
      checksumAlgorithm: MAPWORLD_CHECKSUM_ALGORITHM,
      sha256: sha256Hex(bytes),
    })),
    recovery: { mode: 'none' },
  };
  const manifestBytes = canonicalJsonBytes(manifest, 'manifest.json');
  if (!manifestBytes.ok) return manifestBytes;
  const files = [
    frozenFile('manifest.json', manifestBytes.value),
    ...authoritativeFiles.map(({ path, bytes }) => frozenFile(path, bytes)),
  ];
  const limits = validatePackageLimits(files);
  if (limits.length > 0) return persistenceFailure(...limits);
  const packageValue = Object.freeze({ files: Object.freeze(files) });
  const reopened = decodeMapworldV2Files(packageValue.files);
  return reopened.ok ? persistenceSuccess(packageValue) : reopened;
}

export function decodeMapworldV2Files(
  packageFiles: readonly MapworldPackageFile[],
): PersistenceResult<WorldDocument> {
  const filesByPath = new Map(packageFiles.map((file) => [file.path, file.bytes] as const));
  const decoded = decodeMapworldV2Dtos(filesByPath);
  if (!decoded.ok) return decoded;
  const indexDiagnostics = validateWorldIndex(
    {
      authoritativeFiles: [
        { path: 'world.json' },
        ...decoded.value.world.mapFiles.map(({ path }) => ({ path })),
      ],
    } as Parameters<typeof validateWorldIndex>[0],
    decoded.value.world,
  );
  if (indexDiagnostics.length > 0) return persistenceFailure(...indexDiagnostics);
  const mapDtos = decoded.value.maps.map(({ dto }) => dto);
  for (const [index, dto] of mapDtos.entries()) {
    const entry = decoded.value.world.mapFiles[index];
    if (entry === undefined) return missing('world.json');
    const diagnostic = validateMapIndexEntry(entry, dto);
    if (diagnostic !== undefined) return persistenceFailure(diagnostic);
  }
  return worldDocumentFromDtos(
    decoded.value.world,
    mapDtos,
    decoded.value.maps.map(({ externalAspects }) => externalAspects),
  );
}

export function decodeMapworldV2Dtos(
  filesByPath: ReadonlyMap<string, Uint8Array>,
): PersistenceResult<DecodedV2Dtos> {
  const manifestBytes = filesByPath.get('manifest.json');
  if (manifestBytes === undefined) return missing('manifest.json');
  const manifest = decodeCanonicalDto(
    manifestBytes,
    'manifest.json',
    mapworldV2ManifestDtoSchema,
    orderV2Manifest,
    [
      { path: ['packageVersion'], expected: MAPWORLD_V2_PACKAGE_VERSION },
      { path: ['schemaVersion'], expected: MAPWORLD_V2_SCHEMA_VERSION },
      {
        path: ['applicationCompatibility', 'minimumVersion'],
        expected: MAPWORLD_V2_APPLICATION_COMPATIBILITY.minimumVersion,
      },
      {
        path: ['applicationCompatibility', 'maximumVersionExclusive'],
        expected: MAPWORLD_V2_APPLICATION_COMPATIBILITY.maximumVersionExclusive,
      },
      { path: ['recordSchemaVersions', 'worldIndex'], expected: WORLD_INDEX_SCHEMA_VERSION },
      {
        path: ['recordSchemaVersions', 'mapDocument'],
        expected: MAPWORLD_V2_MAP_DOCUMENT_SCHEMA_VERSION,
      },
      {
        path: ['recordSchemaVersions', 'acceptedAspect'],
        expected: MAPWORLD_V2_ACCEPTED_ASPECT_SCHEMA_VERSION,
      },
      {
        path: ['recordSchemaVersions', 'externalFieldFile'],
        expected: MAPWORLD_FIELD_FILE_SCHEMA_VERSION,
      },
    ],
  );
  if (!manifest.ok) return manifest;
  const fileDiagnostics = validateV2FileSet(manifest.value, filesByPath);
  if (fileDiagnostics.length > 0) return persistenceFailure(...fileDiagnostics);
  const checksumDiagnostics = validateV2Checksums(manifest.value, filesByPath);
  if (checksumDiagnostics.length > 0) return persistenceFailure(...checksumDiagnostics);

  const worldBytes = filesByPath.get('world.json');
  if (worldBytes === undefined) return missing('world.json');
  const world = decodeCanonicalDto(
    worldBytes,
    'world.json',
    worldIndexDtoSchema,
    orderWorldIndexDto,
    [{ path: ['worldIndexSchemaVersion'], expected: WORLD_INDEX_SCHEMA_VERSION }],
  );
  if (!world.ok) return world;

  const maps: DecodedV2Map[] = [];
  const referencedData = new Set<string>();
  for (const entry of world.value.mapFiles) {
    const bytes = filesByPath.get(entry.path);
    if (bytes === undefined) return missing(entry.path);
    const decodedMap = decodeV2Map(bytes, entry.path);
    if (!decodedMap.ok) return decodedMap;
    if (
      decodedMap.value.dto.mapId !== entry.mapId ||
      decodedMap.value.dto.mapKind !== entry.mapKind
    )
      return referenceFailure('Map identity must match world.json.', entry.path);
    const externalAspects: AcceptedAspectRecord[] = [];
    for (const reference of decodedMap.value.references) {
      if (reference.path !== `data/${entry.mapId}/aspects/${reference.aspectId}.json`)
        return referenceFailure(
          'External aspect path must be derived from its owning map and aspect IDs.',
          entry.path,
        );
      referencedData.add(reference.path);
      const aspectBytes = filesByPath.get(reference.path);
      if (aspectBytes === undefined) return missing(reference.path);
      const aspect = decodeExternalAspect(reference, aspectBytes, filesByPath, referencedData);
      if (!aspect.ok) return aspect;
      if (aspect.value.mapId !== entry.mapId)
        return referenceFailure(
          'External aspect owner map does not match its reference.',
          reference.path,
        );
      externalAspects.push(aspect.value);
    }
    const firstExternal = externalAspects[0];
    const physicalDiagnostics =
      firstExternal === undefined
        ? []
        : validatePhysicalAspectSet(firstExternal.mapId, externalAspects);
    if (physicalDiagnostics.length > 0) return persistenceFailure(...physicalDiagnostics);
    maps.push({ dto: decodedMap.value.dto, externalAspects: Object.freeze(externalAspects) });
  }
  const expectedPaths = new Set([
    'world.json',
    ...world.value.mapFiles.map(({ path }) => path),
    ...referencedData,
  ]);
  const declaredPaths = new Set(manifest.value.authoritativeFiles.map(({ path }) => path));
  if (
    expectedPaths.size !== declaredPaths.size ||
    [...expectedPaths].some((path) => !declaredPaths.has(path))
  )
    return referenceFailure(
      'The v2 manifest contains unreferenced or missing authoritative data files.',
      'manifest.json',
    );
  return persistenceSuccess({ world: world.value, maps: Object.freeze(maps) });
}

export function canonicalV2AspectBytes(
  aspect: AcceptedAspectRecord,
  outputOnly: boolean,
): PersistenceResult<Uint8Array> {
  const encoded = encodeExternalAspect(aspect);
  if (!encoded.ok) return encoded;
  let owners: MapworldPackageFile[];
  if (outputOnly) {
    const output = outputWithDescriptors(
      aspect,
      encoded.value.fieldFiles.map(({ path, bytes }) => ({ path, bytes })),
    );
    if (!output.ok) return output;
    const bytes = canonicalJsonBytes(output.value, '$accepted-output.json');
    if (!bytes.ok) return bytes;
    owners = [{ path: '$accepted-output.json', bytes: bytes.value }, ...encoded.value.fieldFiles];
  } else {
    owners = [
      { path: encoded.value.aspectPath, bytes: encoded.value.aspectBytes },
      ...encoded.value.fieldFiles,
    ];
  }
  return frameEvidence(
    outputOnly ? 'MWASOUT2' : 'MWASPCT2',
    owners.sort((left, right) => compareText(left.path, right.path)),
  );
}

function encodeExternalAspect(
  aspect: AcceptedAspectRecord,
): PersistenceResult<EncodedExternalAspect> {
  if (!M3_ASPECT_NAMES.has(aspect.aspectName))
    return referenceFailure('Only known M3 physical aspects can use external v2 ownership.');
  const transformed = encodeAspectOutput(aspect);
  if (!transformed.ok) return transformed;
  const dto = acceptedAspectToDto(
    { ...aspect, acceptedOutput: transformed.value.output },
    `$aspect:${aspect.aspectId}`,
  );
  if (!dto.ok) return dto;
  const v2Dto = {
    ...dto.value,
    acceptedAspectSchemaVersion: MAPWORLD_V2_ACCEPTED_ASPECT_SCHEMA_VERSION,
  };
  const aspectPath = `data/${aspect.mapId}/aspects/${aspect.aspectId}.json`;
  const strictDto = validateDto(mapworldV2AcceptedAspectDtoSchema, v2Dto, aspectPath, 'v2');
  if (!strictDto.ok) return strictDto;
  const aspectBytes = canonicalJsonBytes(strictDto.value, aspectPath);
  if (!aspectBytes.ok) return aspectBytes;
  return persistenceSuccess({
    aspect,
    aspectPath,
    aspectBytes: aspectBytes.value,
    fieldFiles: transformed.value.files,
  });
}

function encodeAspectOutput(
  aspect: AcceptedAspectRecord,
): PersistenceResult<{ readonly output: unknown; readonly files: readonly MapworldPackageFile[] }> {
  const quantumOutput = encodeQuantumOutput(aspect);
  if (!quantumOutput.ok) return quantumOutput;
  let output: unknown = quantumOutput.value;
  const files: MapworldPackageFile[] = [];
  const specs = fieldSpecsFor(aspect.aspectName);
  for (const spec of specs) {
    const reader = valueAt(output, spec.path);
    const path = `data/${aspect.mapId}/fields/${aspect.aspectId}.${spec.component}.mwf`;
    const encoded = encodeMapworldField(
      path,
      reader as WorldPhysicalFieldReader<number | string>,
      'encoding' in spec ? spec.encoding : undefined,
    );
    if (!encoded.ok) return encoded;
    output = replaceAt(output, spec.path, encoded.value.descriptor);
    files.push({ path, bytes: encoded.value.bytes });
  }
  if (containsReader(output))
    return fieldFailure(
      `data/${aspect.mapId}/aspects/${aspect.aspectId}.json`,
      'External aspect contains a reader outside its declared field components.',
    );
  return persistenceSuccess({
    output,
    files: Object.freeze(files.sort((left, right) => compareText(left.path, right.path))),
  });
}

function encodeQuantumOutput(aspect: AcceptedAspectRecord): PersistenceResult<unknown> {
  if (aspect.aspectName === 'worldClimate.temperature') {
    if (
      valueAt(aspect.acceptedOutput, ['quantumCelsius']) !==
      WORLD_PHYSICAL_TEMPERATURE_QUANTUM_CELSIUS
    )
      return fieldFailure(
        `$aspect:${aspect.aspectId}`,
        'Temperature quantum must be the exact domain constant 0.1.',
      );
    return persistenceSuccess(
      replaceAt(aspect.acceptedOutput, ['quantumCelsius'], { denominator: 10, numerator: 1 }),
    );
  }
  if (aspect.aspectName === 'worldClimate.prevailingWinds') {
    if (
      valueAt(aspect.acceptedOutput, ['speedQuantumMetersPerSecond']) !==
      WORLD_PHYSICAL_WIND_SPEED_QUANTUM_METERS_PER_SECOND
    )
      return fieldFailure(
        `$aspect:${aspect.aspectId}`,
        'Prevailing-wind speed quantum must be the exact domain constant 0.1.',
      );
    return persistenceSuccess(
      replaceAt(aspect.acceptedOutput, ['speedQuantumMetersPerSecond'], {
        denominator: 10,
        numerator: 1,
      }),
    );
  }
  return persistenceSuccess(aspect.acceptedOutput);
}

function decodeQuantumOutput(aspectName: string, output: unknown): unknown {
  if (aspectName === 'worldClimate.temperature') {
    return replaceAt(output, ['quantumCelsius'], WORLD_PHYSICAL_TEMPERATURE_QUANTUM_CELSIUS);
  }
  if (aspectName === 'worldClimate.prevailingWinds') {
    return replaceAt(
      output,
      ['speedQuantumMetersPerSecond'],
      WORLD_PHYSICAL_WIND_SPEED_QUANTUM_METERS_PER_SECOND,
    );
  }
  return output;
}

function validatePhysicalAspectSet(
  mapId: AcceptedAspectRecord['mapId'],
  aspects: readonly AcceptedAspectRecord[],
): readonly PersistenceDiagnostic[] {
  const diagnostics: PersistenceDiagnostic[] = [];
  const byName = new Map(aspects.map((aspect) => [aspect.aspectName, aspect] as const));
  if (byName.size !== aspects.length) {
    diagnostics.push(
      referenceDiagnostic(
        `maps/${mapId}.json`,
        '$.externalAcceptedAspects',
        'A map cannot contain duplicate M3 physical aspect names.',
      ),
    );
  }
  const watersheds = aspects.find(({ aspectName }) => aspectName === 'worldHydrology.watersheds')
    ?.acceptedOutput as WatershedRecords | undefined;
  const rivers = aspects.find(({ aspectName }) => aspectName === 'worldHydrology.majorRivers')
    ?.acceptedOutput as readonly MajorRiver[] | undefined;
  for (const aspect of aspects) {
    if (!isMapworldV2ExternalAspectName(aspect.aspectName)) continue;
    const aspectKind = aspect.aspectName as WorldPhysicalContextAspectKind;
    const expectedId = deriveWorldPhysicalContextAspectId(aspect.entityId, aspectKind);
    if (aspect.aspectId !== expectedId) {
      diagnostics.push(
        referenceDiagnostic(
          `data/${mapId}/aspects/${aspect.aspectId}.json`,
          '$.aspectId',
          'M3 aspect ID must be derived from its world-surface entity and aspect name.',
        ),
      );
      continue;
    }
    let findings: readonly WorldPhysicalContextDiagnostic[];
    try {
      switch (aspect.aspectName) {
        case 'worldTerrain.mountainSystems':
          findings = validateWorldPhysicalMountainSystems(
            aspect.acceptedOutput as MountainSystems,
            aspect.entityId,
            mapId,
          );
          break;
        case 'worldClimate.temperature':
          findings = validateWorldPhysicalTemperatureField(
            aspect.acceptedOutput as TemperatureField,
            aspect.entityId,
          );
          break;
        case 'worldClimate.prevailingWinds':
          findings = validateWorldPhysicalPrevailingWindField(
            aspect.acceptedOutput as PrevailingWindField,
            aspect.entityId,
          );
          break;
        case 'worldClimate.moisture':
          findings = validateWorldPhysicalMoistureField(
            aspect.acceptedOutput as MoistureField,
            aspect.entityId,
          );
          break;
        case 'worldClimate.zones':
          findings = validateWorldPhysicalClimateZoneField(
            aspect.acceptedOutput as ClimateZoneField,
            aspect.entityId,
          );
          break;
        case 'worldEcology.biomeBelts':
          findings = validateWorldPhysicalBiomeBeltField(
            aspect.acceptedOutput as BiomeBeltField,
            aspect.entityId,
            mapId,
          );
          break;
        case 'worldHydrology.watersheds':
          findings = validateWorldPhysicalWatersheds(
            aspect.acceptedOutput as WatershedRecords,
            aspect.entityId,
            mapId,
          );
          break;
        case 'worldHydrology.majorRivers':
          findings =
            watersheds === undefined
              ? [
                  {
                    code: 'world-physical-context.reference.invalid',
                    message: 'Major rivers require the external watershed aspect.',
                  },
                ]
              : validateWorldPhysicalMajorRivers(
                  aspect.acceptedOutput as readonly MajorRiver[],
                  watersheds.watersheds,
                  mapId,
                );
          break;
        case 'worldHydrology.majorLakes':
          findings =
            watersheds === undefined || rivers === undefined
              ? [
                  {
                    code: 'world-physical-context.reference.invalid',
                    message: 'Major lakes require the external watershed and river aspects.',
                  },
                ]
              : validateWorldPhysicalMajorLakes(
                  aspect.acceptedOutput as readonly MajorLake[],
                  watersheds.watersheds,
                  rivers,
                  mapId,
                );
          break;
        default:
          findings = [];
      }
    } catch {
      findings = [
        {
          code: 'world-physical-context.field.metadata.invalid',
          message: 'M3 accepted output is not structurally valid domain data.',
        },
      ];
    }
    diagnostics.push(
      ...findings.map((finding) =>
        persistenceDiagnostic(
          PERSISTENCE_DIAGNOSTIC_CODES.fieldInvalid,
          `data/${mapId}/aspects/${aspect.aspectId}.json`,
          '$.acceptedOutput',
          `${finding.code}: ${finding.message}`,
          'Restore the exact accepted M3 output and its logical provenance fingerprint.',
        ),
      ),
    );
  }
  return diagnostics.sort(comparePersistenceDiagnostics);
}

function outputWithDescriptors(
  aspect: AcceptedAspectRecord,
  _files: readonly MapworldPackageFile[],
): PersistenceResult<unknown> {
  const transformed = encodeAspectOutput(aspect);
  return transformed.ok ? persistenceSuccess(transformed.value.output) : transformed;
}

function decodeExternalAspect(
  reference: ExternalReference,
  bytes: Uint8Array,
  filesByPath: ReadonlyMap<string, Uint8Array>,
  referencedData: Set<string>,
): PersistenceResult<AcceptedAspectRecord> {
  const parsed = parseCanonicalJsonBytes(bytes, reference.path);
  if (!parsed.ok) return parsed;
  const v2Dto = validateDto(mapworldV2AcceptedAspectDtoSchema, parsed.value, reference.path, 'v2');
  if (!v2Dto.ok) return v2Dto;
  const normalized = {
    ...v2Dto.value,
    acceptedAspectSchemaVersion: ACCEPTED_ASPECT_SCHEMA_VERSION,
  };
  const dto = validateDto(acceptedAspectDtoSchema, normalized, reference.path);
  if (!dto.ok) return dto;
  if (
    dto.value.aspectId !== reference.aspectId ||
    dto.value.aspectName !== reference.aspectName ||
    !M3_ASPECT_NAMES.has(dto.value.aspectName)
  )
    return referenceFailure(
      'External aspect identity and known name must exactly match its map reference.',
      reference.path,
    );
  const ordered = {
    ...orderAcceptedAspectDto(dto.value),
    acceptedAspectSchemaVersion: MAPWORLD_V2_ACCEPTED_ASPECT_SCHEMA_VERSION,
  };
  const canonical = canonicalJsonBytes(ordered, reference.path);
  if (!canonical.ok) return canonical;
  if (!bytesEqual(bytes, canonical.value)) return noncanonical(reference.path);

  let hydrated: unknown = dto.value.acceptedOutput;
  const specs = fieldSpecsFor(dto.value.aspectName);
  for (const spec of specs) {
    const candidate = valueAt(hydrated, spec.path);
    if (!isMapworldFieldDescriptor(candidate))
      return fieldFailure(reference.path, `Missing field descriptor for ${spec.component}.`);
    const expectedPath = `data/${dto.value.mapId}/fields/${dto.value.aspectId}.${spec.component}.mwf`;
    if (
      candidate.path !== expectedPath ||
      ('encoding' in spec && candidate.valueEncoding !== spec.encoding) ||
      (!('encoding' in spec) && !candidate.valueEncoding.startsWith('dictionary-'))
    )
      return fieldFailure(
        reference.path,
        `Field descriptor for ${spec.component} has a noncanonical path or encoding.`,
      );
    const fieldBytes = filesByPath.get(candidate.path);
    if (fieldBytes === undefined) return missing(candidate.path);
    referencedData.add(candidate.path);
    const reader = decodeMapworldField(candidate, fieldBytes);
    if (!reader.ok) return reader;
    hydrated = replaceAt(hydrated, spec.path, reader.value);
  }
  if (containsDescriptor(hydrated))
    return fieldFailure(reference.path, 'External aspect contains an undeclared field descriptor.');
  hydrated = decodeQuantumOutput(dto.value.aspectName, hydrated);
  return acceptedAspectFromDto(dto.value, reference.path, 0, hydrated);
}

function decodeV2Map(
  bytes: Uint8Array,
  path: string,
): PersistenceResult<{
  readonly dto: MapDocumentDto;
  readonly references: readonly ExternalReference[];
}> {
  const parsed = parseCanonicalJsonBytes(bytes, path);
  if (!parsed.ok) return parsed;
  if (!isRecord(parsed.value)) return schemaFailure(path, 'Map document must be a strict object.');
  if (parsed.value.mapDocumentSchemaVersion !== MAPWORLD_V2_MAP_DOCUMENT_SCHEMA_VERSION)
    return incompatible(path, '$.mapDocumentSchemaVersion', parsed.value.mapDocumentSchemaVersion);
  const rawReferences = parsed.value.externalAcceptedAspects;
  const references = validateDto(z.array(externalReferenceSchema), rawReferences, path);
  if (!references.ok) return references;
  if (!isStrictlyOrdered(references.value, (item) => item.aspectId))
    return referenceFailure(
      'External aspect references must be unique and sorted by aspectId.',
      path,
    );
  const inline = parsed.value.aspects;
  if (!Array.isArray(inline)) return schemaFailure(path, 'Map aspects must be an array.');
  if (inline.some((item) => isRecord(item) && M3_ASPECT_NAMES.has(String(item.aspectName))))
    return referenceFailure('M3 physical aspects cannot appear inline in a v2 map.', path);
  const normalizedAspects: unknown[] = inline.map((item: unknown): unknown =>
    isRecord(item)
      ? { ...item, acceptedAspectSchemaVersion: ACCEPTED_ASPECT_SCHEMA_VERSION }
      : item,
  );
  const { externalAcceptedAspects: _externalAcceptedAspects, ...mapWithoutExternal } = parsed.value;
  const normalizedRaw = {
    ...mapWithoutExternal,
    mapDocumentSchemaVersion: 1,
    aspects: normalizedAspects,
  };
  const dto = validateDto(mapDocumentDtoSchema, normalizedRaw, path);
  if (!dto.ok) return dto;
  const orderedV2 = v2MapFromV1(orderMapDocumentDto(dto.value), references.value);
  const canonical = canonicalJsonBytes(orderedV2, path);
  if (!canonical.ok) return canonical;
  if (!bytesEqual(bytes, canonical.value)) return noncanonical(path);
  const inlineIds = new Set(dto.value.aspects.map(({ aspectId }) => aspectId));
  if (references.value.some(({ aspectId }) => inlineIds.has(aspectId)))
    return referenceFailure('Inline and external aspect IDs must be one unique logical set.', path);
  return persistenceSuccess({ dto: dto.value, references: Object.freeze(references.value) });
}

function v2MapFromV1(
  dto: MapDocumentDto,
  references: readonly ExternalReference[],
): Record<string, unknown> {
  return {
    ...dto,
    mapDocumentSchemaVersion: MAPWORLD_V2_MAP_DOCUMENT_SCHEMA_VERSION,
    aspects: dto.aspects.map((aspect) => ({
      ...aspect,
      acceptedAspectSchemaVersion: MAPWORLD_V2_ACCEPTED_ASPECT_SCHEMA_VERSION,
    })),
    externalAcceptedAspects: references,
  };
}

export function orderV2Manifest(dto: MapworldV2ManifestDto): MapworldV2ManifestDto {
  return {
    ...dto,
    authoritativeFiles: [...dto.authoritativeFiles].sort((left, right) =>
      compareAuthoritativePaths(left.path, right.path),
    ),
  };
}

function validateV2FileSet(
  manifest: MapworldV2ManifestDto,
  filesByPath: ReadonlyMap<string, Uint8Array>,
): readonly PersistenceDiagnostic[] {
  const diagnostics: PersistenceDiagnostic[] = [];
  const paths = manifest.authoritativeFiles.map(({ path }) => path);
  if (!isStrictlyOrdered(paths, (path) => path, compareAuthoritativePaths))
    diagnostics.push(
      referenceDiagnostic(
        'manifest.json',
        '$.authoritativeFiles',
        'Authoritative paths must be unique and in world/map/data order.',
      ),
    );
  const expected = new Set(['manifest.json', ...paths]);
  for (const path of expected)
    if (!filesByPath.has(path)) diagnostics.push(missingDiagnostic(path));
  for (const path of filesByPath.keys())
    if (!expected.has(path))
      diagnostics.push(
        persistenceDiagnostic(
          PERSISTENCE_DIAGNOSTIC_CODES.fileUnexpected,
          path,
          '$',
          `The v2 package contains undeclared file ${path}.`,
          'Remove undeclared content only through an explicit compatible package operation.',
        ),
      );
  return diagnostics.sort(comparePersistenceDiagnostics);
}

function validateV2Checksums(
  manifest: MapworldV2ManifestDto,
  filesByPath: ReadonlyMap<string, Uint8Array>,
): readonly PersistenceDiagnostic[] {
  const diagnostics: PersistenceDiagnostic[] = [];
  for (const [index, entry] of manifest.authoritativeFiles.entries()) {
    const bytes = filesByPath.get(entry.path);
    if (bytes !== undefined && sha256Hex(bytes) !== entry.sha256)
      diagnostics.push(
        persistenceDiagnostic(
          PERSISTENCE_DIAGNOSTIC_CODES.checksumMismatch,
          entry.path,
          `manifest.json#$.authoritativeFiles[${String(index)}].sha256`,
          `SHA-256 does not match the authoritative bytes for ${entry.path}.`,
          'Restore the exact authoritative file or its matching manifest.',
        ),
      );
  }
  return diagnostics;
}

export function validatePackageLimits(
  files: readonly MapworldPackageFile[],
): readonly PersistenceDiagnostic[] {
  const diagnostics: PersistenceDiagnostic[] = [];
  if (files.length === 0 || files.length > MAPWORLD_NATIVE_LIMITS.maximumPackageFiles)
    diagnostics.push(
      limitDiagnostic('$package', '$.files', 'Package file count exceeds the native limit.'),
    );
  let aggregate = 0;
  for (const file of files) {
    const pathBytes = new TextEncoder().encode(file.path).byteLength;
    const components = file.path.split('/');
    if (
      pathBytes === 0 ||
      pathBytes > MAPWORLD_NATIVE_LIMITS.maximumRelativePathBytes ||
      components.length - 1 > MAPWORLD_NATIVE_LIMITS.maximumDirectoryDepth ||
      components.some(
        (component) =>
          component.length === 0 ||
          component === '.' ||
          component === '..' ||
          new TextEncoder().encode(component).byteLength >
            MAPWORLD_NATIVE_LIMITS.maximumBasenameBytes,
      )
    )
      diagnostics.push(
        limitDiagnostic(
          file.path,
          '$.path',
          'Package path exceeds the native path or component limit.',
        ),
      );
    if (file.bytes.byteLength > MAPWORLD_NATIVE_LIMITS.maximumFileBytes)
      diagnostics.push(
        limitDiagnostic(
          file.path,
          '$.bytes',
          'Package entry exceeds the native per-file byte limit.',
        ),
      );
    aggregate += file.bytes.byteLength;
  }
  if (aggregate > MAPWORLD_NATIVE_LIMITS.maximumPackageBytes)
    diagnostics.push(
      limitDiagnostic('$package', '$.files', 'Package exceeds the native aggregate byte limit.'),
    );
  return diagnostics.sort(comparePersistenceDiagnostics);
}

function frameEvidence(
  magic: 'MWASPCT2' | 'MWASOUT2',
  owners: readonly MapworldPackageFile[],
): PersistenceResult<Uint8Array> {
  const encoder = new TextEncoder();
  const total =
    12 +
    owners.reduce(
      (sum, owner) => sum + 12 + encoder.encode(owner.path).byteLength + owner.bytes.byteLength,
      0,
    );
  if (!Number.isSafeInteger(total))
    return fieldFailure('$aspect', 'Canonical evidence framing exceeds safe allocation bounds.');
  const bytes = new Uint8Array(total);
  bytes.set(encoder.encode(magic), 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, owners.length, true);
  let offset = 12;
  owners.forEach((owner) => {
    const path = encoder.encode(owner.path);
    view.setUint32(offset, path.byteLength, true);
    view.setBigUint64(offset + 4, BigInt(owner.bytes.byteLength), true);
    offset += 12;
    bytes.set(path, offset);
    offset += path.byteLength;
    bytes.set(owner.bytes, offset);
    offset += owner.bytes.byteLength;
  });
  return persistenceSuccess(bytes);
}

function valueAt(value: unknown, path: readonly string[]): unknown {
  let current = value;
  for (const segment of path) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function replaceAt(value: unknown, path: readonly string[], replacement: unknown): unknown {
  const [segment, ...remaining] = path;
  if (segment === undefined) return replacement;
  if (!isRecord(value)) return value;
  return { ...value, [segment]: replaceAt(value[segment], remaining, replacement) };
}

function containsReader(value: unknown, seen = new Set<object>()): boolean {
  if (typeof value !== 'object' || value === null) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (isWorldPhysicalFieldReader(value)) return true;
  return Object.values(value).some((item) => containsReader(item, seen));
}

function containsDescriptor(value: unknown): boolean {
  if (isMapworldFieldDescriptor(value)) return true;
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value).some(containsDescriptor);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStrictlyOrdered<Value>(
  values: readonly Value[],
  key: (value: Value) => string,
  compare: (left: string, right: string) => number = compareText,
): boolean {
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (
      previous === undefined ||
      current === undefined ||
      compare(key(previous), key(current)) >= 0
    )
      return false;
  }
  return true;
}

function fieldSpecsFor(aspectName: string) {
  switch (aspectName) {
    case 'worldClimate.temperature':
    case 'worldClimate.prevailingWinds':
    case 'worldClimate.moisture':
    case 'worldClimate.zones':
    case 'worldEcology.biomeBelts':
    case 'worldHydrology.watersheds':
      return FIELD_SPECS[aspectName];
    default:
      return [];
  }
}

function compareAuthoritativePaths(left: string, right: string): number {
  const rank = (path: string) => (path === 'world.json' ? 0 : path.startsWith('maps/') ? 1 : 2);
  return rank(left) - rank(right) || compareText(left, right);
}

function compareText(left: string, right: string): -1 | 0 | 1 {
  return left < right ? -1 : left > right ? 1 : 0;
}
function frozenFile(path: string, bytes: Uint8Array): MapworldPackageFile {
  return Object.freeze({ path, bytes: bytes.slice() });
}
function missing<Value>(path: string): PersistenceResult<Value> {
  return persistenceFailure(missingDiagnostic(path));
}
function missingDiagnostic(path: string): PersistenceDiagnostic {
  return persistenceDiagnostic(
    PERSISTENCE_DIAGNOSTIC_CODES.fileMissing,
    path,
    '$',
    `Required package file is missing: ${path}.`,
    'Restore the complete authoritative package.',
  );
}
function referenceFailure<Value>(
  message: string,
  filePath = 'manifest.json',
): PersistenceResult<Value> {
  return persistenceFailure(referenceDiagnostic(filePath, '$', message));
}
function referenceDiagnostic(
  filePath: string,
  fieldPath: string,
  message: string,
): PersistenceDiagnostic {
  return persistenceDiagnostic(
    PERSISTENCE_DIAGNOSTIC_CODES.referenceInvalid,
    filePath,
    fieldPath,
    message,
    'Restore matching stable IDs, owners, and canonical references without guessing.',
  );
}
function fieldFailure<Value>(path: string, message: string): PersistenceResult<Value> {
  return persistenceFailure(
    persistenceDiagnostic(
      PERSISTENCE_DIAGNOSTIC_CODES.fieldInvalid,
      path,
      '$',
      message,
      'Restore the exact canonical field descriptor and chunk bytes.',
    ),
  );
}
function schemaFailure<Value>(path: string, message: string): PersistenceResult<Value> {
  return persistenceFailure(
    persistenceDiagnostic(
      PERSISTENCE_DIAGNOSTIC_CODES.schemaInvalid,
      path,
      '$',
      message,
      'Restore a value matching the strict v2 schema.',
    ),
  );
}
function incompatible<Value>(
  path: string,
  fieldPath: string,
  actual: unknown,
): PersistenceResult<Value> {
  return persistenceFailure(
    persistenceDiagnostic(
      PERSISTENCE_DIAGNOSTIC_CODES.versionIncompatible,
      path,
      fieldPath,
      `Unsupported v2 compatibility value ${JSON.stringify(actual)}.`,
      'Open the package with a compatible application or apply an explicit supported migration.',
    ),
  );
}
function noncanonical<Value>(path: string): PersistenceResult<Value> {
  return persistenceFailure(
    persistenceDiagnostic(
      PERSISTENCE_DIAGNOSTIC_CODES.jsonNoncanonical,
      path,
      '$',
      'JSON bytes do not use canonical v2 ordering, whitespace, or newline rules.',
      'Regenerate the file with the v2 canonical serializer.',
    ),
  );
}
function limitDiagnostic(
  filePath: string,
  fieldPath: string,
  message: string,
): PersistenceDiagnostic {
  return persistenceDiagnostic(
    PERSISTENCE_DIAGNOSTIC_CODES.limitExceeded,
    filePath,
    fieldPath,
    message,
    'Reduce the bounded package before encoding or restore an in-limit package.',
  );
}
function invalidSnapshot<Value>(path: string): PersistenceResult<Value> {
  return persistenceFailure(
    persistenceDiagnostic(
      PERSISTENCE_DIAGNOSTIC_CODES.immutableSnapshotInvalid,
      path,
      '$',
      'Persistence input must be an immutable plain-data graph plus project-owned readers.',
      'Provide independently owned project records and readers.',
    ),
  );
}
