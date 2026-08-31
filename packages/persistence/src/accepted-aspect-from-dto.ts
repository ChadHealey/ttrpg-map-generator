import {
  type AcceptedAspectRecord,
  type AspectDependencyReference,
  type GenerationDiagnostic,
  parseAspectName,
  parseBehaviorVersion,
  parseGenerationDiagnosticCode,
  parseGeneratorId,
  parseParameterSchemaVersion,
  parsePlanetPoint,
  parseSeedInput,
  parseStableId,
  parseVariantRevision,
} from '@ttrpg-map/core';

import { type AcceptedAspectDto } from './accepted-aspect-dto-schema.js';
import {
  atlasAcceptedOutputFromDto,
  atlasAcceptedParametersFromDto,
} from './atlas-accepted-aspect-from-dto.js';
import { parseCoreValue } from './core-parsing.js';
import {
  persistenceDiagnostic,
  persistenceFailure,
  persistenceSuccess,
} from './persistence-diagnostics.js';
import { PERSISTENCE_DIAGNOSTIC_CODES, type PersistenceResult } from './persistence-model.js';

interface ProofOutlineDtoOutput {
  readonly points: readonly {
    readonly longitudeTicks: number;
    readonly latitudeTicks: number;
  }[];
}

interface ProofMarkerDtoOutput {
  readonly markers: readonly {
    readonly markerId: string;
    readonly position: {
      readonly longitudeTicks: number;
      readonly latitudeTicks: number;
    };
  }[];
}

export function acceptedAspectFromDto(
  dto: AcceptedAspectDto,
  filePath: string,
  index: number,
  acceptedOutputOverride?: unknown,
): PersistenceResult<AcceptedAspectRecord> {
  const rootPath = `$.aspects[${String(index)}]`;
  const mapId = parseCoreValue(parseStableId('map', dto.mapId), filePath, `${rootPath}.mapId`);
  if (!mapId.ok) return mapId;
  const entityId = parseCoreValue(
    parseStableId('entity', dto.entityId),
    filePath,
    `${rootPath}.entityId`,
  );
  if (!entityId.ok) return entityId;
  const aspectId = parseCoreValue(
    parseStableId('aspect', dto.aspectId),
    filePath,
    `${rootPath}.aspectId`,
  );
  if (!aspectId.ok) return aspectId;
  const aspectName = parseCoreValue(
    parseAspectName(dto.aspectName),
    filePath,
    `${rootPath}.aspectName`,
  );
  if (!aspectName.ok) return aspectName;
  const generatorId = parseCoreValue(
    parseGeneratorId(dto.generatorId),
    filePath,
    `${rootPath}.generatorId`,
  );
  if (!generatorId.ok) return generatorId;
  const generatorVersion = parseCoreValue(
    parseBehaviorVersion(dto.generatorVersion),
    filePath,
    `${rootPath}.generatorVersion`,
  );
  if (!generatorVersion.ok) return generatorVersion;
  const parameterSchemaVersion = parseCoreValue(
    parseParameterSchemaVersion(dto.parameterSchemaVersion),
    filePath,
    `${rootPath}.parameterSchemaVersion`,
  );
  if (!parameterSchemaVersion.ok) return parameterSchemaVersion;
  const variantRevision = parseCoreValue(
    parseVariantRevision(dto.variantRevision),
    filePath,
    `${rootPath}.variantRevision`,
  );
  if (!variantRevision.ok) return variantRevision;
  const seedMetadata = parseCoreValue(
    parseSeedInput(dto.seedMetadata),
    filePath,
    `${rootPath}.seedMetadata`,
    PERSISTENCE_DIAGNOSTIC_CODES.seedInvalid,
  );
  if (!seedMetadata.ok) return seedMetadata;
  if (dto.seedScope !== seedMetadata.value.seedScope) {
    return persistenceFailure(
      persistenceDiagnostic(
        PERSISTENCE_DIAGNOSTIC_CODES.seedInvalid,
        filePath,
        `${rootPath}.seedScope`,
        'Accepted aspect seedScope must exactly match its complete seedMetadata scope.',
        'Restore the original accepted seed namespace without coercion or scope repair.',
      ),
    );
  }

  const dependencies = dependencyReferences(dto, filePath, rootPath);
  if (!dependencies.ok) return dependencies;
  const diagnostics = generationDiagnostics(dto, filePath, rootPath);
  if (!diagnostics.ok) return diagnostics;
  const output =
    acceptedOutputOverride === undefined
      ? acceptedOutput(dto, filePath, rootPath)
      : persistenceSuccess(acceptedOutputOverride);
  if (!output.ok) return output;
  const parameters = atlasAcceptedParametersFromDto(dto, filePath, rootPath);
  if (!parameters.ok) return parameters;

  return persistenceSuccess({
    mapId: mapId.value,
    entityId: entityId.value,
    aspectId: aspectId.value,
    aspectName: aspectName.value,
    generatorId: generatorId.value,
    generatorVersion: generatorVersion.value,
    parameterSchemaVersion: parameterSchemaVersion.value,
    parameters: parameters.value,
    seedScope: dto.seedScope,
    seedMetadata: seedMetadata.value,
    variantRevision: variantRevision.value,
    dependencyAspects: dependencies.value,
    generationStatus: 'accepted',
    diagnostics: diagnostics.value,
    acceptedOutput: output.value,
  });
}

function dependencyReferences(
  dto: AcceptedAspectDto,
  filePath: string,
  rootPath: string,
): PersistenceResult<readonly AspectDependencyReference[]> {
  const references: AspectDependencyReference[] = [];
  for (const [index, reference] of dto.dependencyAspects.entries()) {
    const aspectId = parseCoreValue(
      parseStableId('aspect', reference.aspectId),
      filePath,
      `${rootPath}.dependencyAspects[${String(index)}].aspectId`,
    );
    if (!aspectId.ok) return aspectId;
    if (reference.contextProvenance === undefined) {
      references.push({ aspectId: aspectId.value });
      continue;
    }
    const parentMapId = parseCoreValue(
      parseStableId('map', reference.contextProvenance.parentMapId),
      filePath,
      `${rootPath}.dependencyAspects[${String(index)}].contextProvenance.parentMapId`,
    );
    if (!parentMapId.ok) return parentMapId;
    const childMapId = parseCoreValue(
      parseStableId('map', reference.contextProvenance.childMapId),
      filePath,
      `${rootPath}.dependencyAspects[${String(index)}].contextProvenance.childMapId`,
    );
    if (!childMapId.ok) return childMapId;
    references.push({
      aspectId: aspectId.value,
      contextProvenance: {
        kind: 'inherited-context',
        parentMapId: parentMapId.value,
        childMapId: childMapId.value,
      },
    });
  }
  return persistenceSuccess(references);
}

function generationDiagnostics(
  dto: AcceptedAspectDto,
  filePath: string,
  rootPath: string,
): PersistenceResult<readonly GenerationDiagnostic[]> {
  const diagnostics: GenerationDiagnostic[] = [];
  for (const [index, finding] of dto.diagnostics.entries()) {
    const code = parseCoreValue(
      parseGenerationDiagnosticCode(finding.code),
      filePath,
      `${rootPath}.diagnostics[${String(index)}].code`,
    );
    if (!code.ok) return code;
    const targetId = parseCoreValue(
      parseStableId('aspect', finding.target.aspectId),
      filePath,
      `${rootPath}.diagnostics[${String(index)}].target.aspectId`,
    );
    if (!targetId.ok) return targetId;
    diagnostics.push({
      code: code.value,
      severity: finding.severity,
      target: { aspectId: targetId.value },
      message: finding.message,
      suggestedAction: finding.suggestedAction,
    });
  }
  return persistenceSuccess(diagnostics);
}

function acceptedOutput(
  dto: AcceptedAspectDto,
  filePath: string,
  rootPath: string,
): PersistenceResult<unknown> {
  const atlasOutput = atlasAcceptedOutputFromDto(dto, filePath, rootPath);
  if (atlasOutput !== undefined) return atlasOutput;
  if (dto.aspectName === 'proof.outline') {
    const output = dto.acceptedOutput as ProofOutlineDtoOutput;
    const points = [];
    for (const [index, point] of output.points.entries()) {
      const parsed = parseCoreValue(
        parsePlanetPoint(point),
        filePath,
        `${rootPath}.acceptedOutput.points[${String(index)}]`,
      );
      if (!parsed.ok) return parsed;
      points.push(parsed.value);
    }
    return persistenceSuccess({ points });
  }
  if (dto.aspectName === 'proof.markers') {
    const output = dto.acceptedOutput as ProofMarkerDtoOutput;
    const markers = [];
    for (const [index, marker] of output.markers.entries()) {
      const markerId = parseCoreValue(
        parseStableId('entity', marker.markerId),
        filePath,
        `${rootPath}.acceptedOutput.markers[${String(index)}].markerId`,
      );
      if (!markerId.ok) return markerId;
      const position = parseCoreValue(
        parsePlanetPoint(marker.position),
        filePath,
        `${rootPath}.acceptedOutput.markers[${String(index)}].position`,
      );
      if (!position.ok) return position;
      markers.push({ markerId: markerId.value, position: position.value });
    }
    return persistenceSuccess({ markers });
  }
  return persistenceSuccess(dto.acceptedOutput);
}
