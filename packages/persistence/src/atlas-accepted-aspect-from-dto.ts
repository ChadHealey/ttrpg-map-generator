import {
  createImmutableDomainArray,
  createLandWaterSampleReader,
  createMacroElevationSampleReader,
  type MacroElevationValueTicks,
  parsePlanetPoint,
  parseSemanticKey,
  parseStableId,
  type StableIdByKind,
  type StableIdKind,
} from '@ttrpg-map/core';

import { type AcceptedAspectDto } from './accepted-aspect-dto-schema.js';
import { ATLAS_ACCEPTED_ASPECT_NAMES } from './atlas-accepted-aspect-dto-schema.js';
import { parseCoreValue } from './core-parsing.js';
import {
  persistenceDiagnostic,
  persistenceFailure,
  persistenceSuccess,
} from './persistence-diagnostics.js';
import { PERSISTENCE_DIAGNOSTIC_CODES, type PersistenceResult } from './persistence-model.js';

export function atlasAcceptedParametersFromDto(
  dto: AcceptedAspectDto,
  filePath: string,
  rootPath: string,
): PersistenceResult<unknown> {
  if (!dto.aspectName.startsWith('atlas.')) return persistenceSuccess(dto.parameters);
  const parameters = dto.parameters as unknown as AppearanceParametersDto;
  const styleId = parseCoreValue(
    parseSemanticKey(parameters.styleId),
    filePath,
    `${rootPath}.parameters.styleId`,
  );
  return styleId.ok ? persistenceSuccess({ ...parameters, styleId: styleId.value }) : styleId;
}

export function atlasAcceptedOutputFromDto(
  dto: AcceptedAspectDto,
  filePath: string,
  rootPath: string,
): PersistenceResult<unknown> | undefined {
  if (!ATLAS_ACCEPTED_ASPECT_NAMES.has(dto.aspectName)) return undefined;
  const outputPath = `${rootPath}.acceptedOutput`;
  switch (dto.aspectName) {
    case 'worldTerrain.macroElevation': {
      const output = dto.acceptedOutput as unknown as MacroElevationOutputDto;
      const values = createImmutableDomainArray(output.values);
      return values.ok
        ? persistenceSuccess({
            ...output,
            values: createMacroElevationSampleReader(
              values.value as readonly MacroElevationValueTicks[],
            ),
          })
        : persistenceFailure(
            persistenceDiagnostic(
              PERSISTENCE_DIAGNOSTIC_CODES.schemaInvalid,
              filePath,
              `${outputPath}.values`,
              'Macro elevation samples could not be made immutable.',
              'Restore the canonical accepted macro-elevation values.',
            ),
          );
    }
    case 'worldSurface.landWaterClassification': {
      const output = dto.acceptedOutput as unknown as LandWaterOutputDto;
      const samples = createImmutableDomainArray(output.samples);
      return samples.ok
        ? persistenceSuccess({ ...output, samples: createLandWaterSampleReader(samples.value) })
        : persistenceFailure(
            persistenceDiagnostic(
              PERSISTENCE_DIAGNOSTIC_CODES.schemaInvalid,
              filePath,
              `${outputPath}.samples`,
              'Land/water samples could not be made immutable.',
              'Restore the canonical accepted land/water samples.',
            ),
          );
    }
    case 'landmass.classification':
      return landmassFromDto(
        dto.acceptedOutput as unknown as LandmassOutputDto,
        filePath,
        outputPath,
      );
    case 'islandGroup.classification':
      return islandGroupFromDto(
        dto.acceptedOutput as unknown as IslandGroupOutputDto,
        filePath,
        outputPath,
      );
    case 'waterBody.classification':
      return waterBodyFromDto(
        dto.acceptedOutput as unknown as WaterBodyOutputDto,
        filePath,
        outputPath,
      );
    case 'worldCoastline.geometry':
      return coastlineFromDto(
        dto.acceptedOutput as unknown as CoastlineOutputDto,
        filePath,
        outputPath,
      );
    case 'atlas.coastlineAppearance':
      return coastlineAppearanceFromDto(
        dto.acceptedOutput as unknown as CoastlineAppearanceOutputDto,
        filePath,
        outputPath,
      );
    case 'atlas.waterDecoration':
      return waterDecorationFromDto(
        dto.acceptedOutput as unknown as WaterDecorationOutputDto,
        filePath,
        outputPath,
      );
    case 'atlas.paperTreatment':
      return paperTreatmentFromDto(
        dto.acceptedOutput as unknown as PaperTreatmentOutputDto,
        filePath,
        outputPath,
      );
  }
  return undefined;
}

interface MacroElevationOutputDto {
  readonly provenance: unknown;
  readonly values: readonly number[];
}

interface LandWaterOutputDto {
  readonly classificationBehaviorVersion: 1;
  readonly seaLevelContourDoubledTicks: number;
  readonly samples: readonly ('land' | 'water')[];
}

function landmassFromDto(
  dto: LandmassOutputDto,
  filePath: string,
  path: string,
): PersistenceResult<unknown> {
  const entityId = id('entity', dto.entityId, filePath, `${path}.entityId`);
  if (!entityId.ok) return entityId;
  const aspectId = id(
    'aspect',
    dto.sourceClassificationAspectId,
    filePath,
    `${path}.sourceClassificationAspectId`,
  );
  if (!aspectId.ok) return aspectId;
  const componentId = id('surface-component', dto.componentId, filePath, `${path}.componentId`);
  if (!componentId.ok) return componentId;
  const containing = optionalId(
    'entity',
    dto.containingWaterBodyId,
    filePath,
    `${path}.containingWaterBodyId`,
  );
  if (!containing.ok) return containing;
  const adjacent = idList(
    'entity',
    dto.adjacentWaterBodyIds,
    filePath,
    `${path}.adjacentWaterBodyIds`,
  );
  if (!adjacent.ok) return adjacent;
  return persistenceSuccess({
    ...dto,
    entityId: entityId.value,
    sourceClassificationAspectId: aspectId.value,
    componentId: componentId.value,
    ...(containing.value === undefined ? {} : { containingWaterBodyId: containing.value }),
    adjacentWaterBodyIds: adjacent.value,
  });
}

function islandGroupFromDto(
  dto: IslandGroupOutputDto,
  filePath: string,
  path: string,
): PersistenceResult<unknown> {
  const entityId = id('entity', dto.entityId, filePath, `${path}.entityId`);
  if (!entityId.ok) return entityId;
  const members = idList('entity', dto.memberLandmassIds, filePath, `${path}.memberLandmassIds`);
  if (!members.ok) return members;
  return persistenceSuccess({ ...dto, entityId: entityId.value, memberLandmassIds: members.value });
}

function waterBodyFromDto(
  dto: WaterBodyOutputDto,
  filePath: string,
  path: string,
): PersistenceResult<unknown> {
  const entityId = id('entity', dto.entityId, filePath, `${path}.entityId`);
  if (!entityId.ok) return entityId;
  const aspectId = id(
    'aspect',
    dto.sourceClassificationAspectId,
    filePath,
    `${path}.sourceClassificationAspectId`,
  );
  if (!aspectId.ok) return aspectId;
  const componentId = id('surface-component', dto.componentId, filePath, `${path}.componentId`);
  if (!componentId.ok) return componentId;
  const enclosed = idList(
    'entity',
    dto.enclosedByLandmassIds,
    filePath,
    `${path}.enclosedByLandmassIds`,
  );
  if (!enclosed.ok) return enclosed;
  const adjacent = idList(
    'entity',
    dto.adjacentLandmassIds,
    filePath,
    `${path}.adjacentLandmassIds`,
  );
  if (!adjacent.ok) return adjacent;
  const connectivity = [];
  for (const [index, connection] of dto.connectivity.entries()) {
    const connected = id(
      'entity',
      connection.connectedWaterBodyId,
      filePath,
      `${path}.connectivity[${String(index)}].connectedWaterBodyId`,
    );
    if (!connected.ok) return connected;
    connectivity.push({ ...connection, connectedWaterBodyId: connected.value });
  }
  return persistenceSuccess({
    ...dto,
    entityId: entityId.value,
    sourceClassificationAspectId: aspectId.value,
    componentId: componentId.value,
    enclosedByLandmassIds: enclosed.value,
    adjacentLandmassIds: adjacent.value,
    connectivity,
  });
}

function coastlineFromDto(
  dto: CoastlineOutputDto,
  filePath: string,
  path: string,
): PersistenceResult<unknown> {
  const rings = [];
  for (const [ringIndex, ring] of dto.rings.entries()) {
    const ringPath = `${path}.rings[${String(ringIndex)}]`;
    const ringId = id('coastline-ring', ring.ringId, filePath, `${ringPath}.ringId`);
    if (!ringId.ok) return ringId;
    const landmassId = id('entity', ring.landmassId, filePath, `${ringPath}.landmassId`);
    if (!landmassId.ok) return landmassId;
    const waterBodyIds = idList('entity', ring.waterBodyIds, filePath, `${ringPath}.waterBodyIds`);
    if (!waterBodyIds.ok) return waterBodyIds;
    const points = planetPoints(ring.points, filePath, `${ringPath}.points`);
    if (!points.ok) return points;
    rings.push({
      ...ring,
      ringId: ringId.value,
      landmassId: landmassId.value,
      waterBodyIds: waterBodyIds.value,
      points: points.value,
    });
  }
  return persistenceSuccess({ ...dto, rings });
}

function coastlineAppearanceFromDto(
  dto: CoastlineAppearanceOutputDto,
  filePath: string,
  path: string,
): PersistenceResult<unknown> {
  const style = styleFromDto(dto.style, filePath, `${path}.style`);
  if (!style.ok) return style;
  const ringDecisions = [];
  for (const [index, decision] of dto.ringDecisions.entries()) {
    const ringId = id(
      'coastline-ring',
      decision.sourceRingId,
      filePath,
      `${path}.ringDecisions[${String(index)}].sourceRingId`,
    );
    if (!ringId.ok) return ringId;
    ringDecisions.push({ ...decision, sourceRingId: ringId.value });
  }
  return persistenceSuccess({ ...dto, style: style.value, ringDecisions });
}

function waterDecorationFromDto(
  dto: WaterDecorationOutputDto,
  filePath: string,
  path: string,
): PersistenceResult<unknown> {
  const style = styleFromDto(dto.style, filePath, `${path}.style`);
  if (!style.ok) return style;
  const paths = [];
  for (const [index, decoration] of dto.paths.entries()) {
    const decorationPath = `${path}.paths[${String(index)}]`;
    const sourceEntityId = id(
      'entity',
      decoration.sourceEntityId,
      filePath,
      `${decorationPath}.sourceEntityId`,
    );
    if (!sourceEntityId.ok) return sourceEntityId;
    const sourceRingId = optionalId(
      'coastline-ring',
      decoration.sourceRingId,
      filePath,
      `${decorationPath}.sourceRingId`,
    );
    if (!sourceRingId.ok) return sourceRingId;
    const relatedSourceIds = idList(
      'entity',
      decoration.relatedSourceIds,
      filePath,
      `${decorationPath}.relatedSourceIds`,
    );
    if (!relatedSourceIds.ok) return relatedSourceIds;
    const points = planetPoints(decoration.points, filePath, `${decorationPath}.points`);
    if (!points.ok) return points;
    paths.push({
      ...decoration,
      sourceEntityId: sourceEntityId.value,
      ...(sourceRingId.value === undefined ? {} : { sourceRingId: sourceRingId.value }),
      relatedSourceIds: relatedSourceIds.value,
      points: points.value,
    });
  }
  return persistenceSuccess({ ...dto, style: style.value, paths });
}

function paperTreatmentFromDto(
  dto: PaperTreatmentOutputDto,
  filePath: string,
  path: string,
): PersistenceResult<unknown> {
  const style = styleFromDto(dto.style, filePath, `${path}.style`);
  return style.ok ? persistenceSuccess({ ...dto, style: style.value }) : style;
}

function styleFromDto(dto: StyleDto, filePath: string, path: string): PersistenceResult<unknown> {
  const styleId = parseCoreValue(parseSemanticKey(dto.styleId), filePath, `${path}.styleId`);
  return styleId.ok ? persistenceSuccess({ ...dto, styleId: styleId.value }) : styleId;
}

function planetPoints(
  values: readonly PlanetPointDto[],
  filePath: string,
  path: string,
): PersistenceResult<readonly unknown[]> {
  const points = [];
  for (const [index, point] of values.entries()) {
    const parsed = parseCoreValue(parsePlanetPoint(point), filePath, `${path}[${String(index)}]`);
    if (!parsed.ok) return parsed;
    points.push(parsed.value);
  }
  return persistenceSuccess(points);
}

function id<Kind extends StableIdKind>(
  kind: Kind,
  value: unknown,
  filePath: string,
  path: string,
): PersistenceResult<StableIdByKind[Kind]> {
  return parseCoreValue(parseStableId(kind, value), filePath, path);
}

function optionalId<Kind extends StableIdKind>(
  kind: Kind,
  value: unknown,
  filePath: string,
  path: string,
): PersistenceResult<StableIdByKind[Kind] | undefined> {
  return value === undefined ? persistenceSuccess(undefined) : id(kind, value, filePath, path);
}

function idList<Kind extends StableIdKind>(
  kind: Kind,
  values: readonly unknown[],
  filePath: string,
  path: string,
): PersistenceResult<readonly StableIdByKind[Kind][]> {
  const parsed: StableIdByKind[Kind][] = [];
  for (const [index, value] of values.entries()) {
    const item = id(kind, value, filePath, `${path}[${String(index)}]`);
    if (!item.ok) return item;
    parsed.push(item.value);
  }
  return persistenceSuccess(parsed);
}

interface AppearanceParametersDto {
  readonly parameterSchemaVersion: 1;
  readonly styleId: string;
  readonly styleBehaviorVersion: 1;
}

interface MembershipDto {
  readonly classificationVersion: 1;
  readonly fingerprint: string;
  readonly sampleCount: number;
  readonly sphericalAreaWeight: number;
  readonly sampleRanges: readonly {
    readonly startIndex: number;
    readonly endIndexExclusive: number;
  }[];
}

interface LandmassOutputDto {
  readonly entityId: string;
  readonly sourceClassificationAspectId: string;
  readonly componentId: string;
  readonly membership: MembershipDto;
  readonly kind: 'continent' | 'island' | 'majorIsland';
  readonly containingWaterBodyId?: string;
  readonly adjacentWaterBodyIds: readonly string[];
}

interface IslandGroupOutputDto {
  readonly entityId: string;
  readonly kind: 'archipelago' | 'islandChain';
  readonly memberLandmassIds: readonly string[];
}

interface WaterBodyOutputDto {
  readonly entityId: string;
  readonly sourceClassificationAspectId: string;
  readonly componentId: string;
  readonly membership: MembershipDto;
  readonly kind: 'oceanBasin' | 'sea';
  readonly enclosure: 'enclosed' | 'open-marine';
  readonly enclosedByLandmassIds: readonly string[];
  readonly adjacentLandmassIds: readonly string[];
  readonly connectivity: readonly {
    readonly connectedWaterBodyId: string;
    readonly kind: 'open-marine-neck';
  }[];
}

interface PlanetPointDto {
  readonly longitudeTicks: number;
  readonly latitudeTicks: number;
}

interface CoastlineOutputDto extends Readonly<Record<string, unknown>> {
  readonly rings: readonly {
    readonly ringId: string;
    readonly sourceBoundaryFingerprint: string;
    readonly landmassId: string;
    readonly waterBodyIds: readonly string[];
    readonly points: readonly PlanetPointDto[];
  }[];
}

interface StyleDto {
  readonly styleId: string;
  readonly styleBehaviorVersion: 1;
}

interface CoastlineAppearanceOutputDto extends Readonly<Record<string, unknown>> {
  readonly style: StyleDto;
  readonly ringDecisions: readonly ({
    readonly sourceRingId: string;
  } & Readonly<Record<string, unknown>>)[];
}

interface WaterDecorationOutputDto extends Readonly<Record<string, unknown>> {
  readonly style: StyleDto;
  readonly paths: readonly ({
    readonly decorationId: string;
    readonly sourceEntityId: string;
    readonly sourceRingId?: string;
    readonly relatedSourceIds: readonly string[];
    readonly points: readonly PlanetPointDto[];
  } & Readonly<Record<string, unknown>>)[];
}

interface PaperTreatmentOutputDto extends Readonly<Record<string, unknown>> {
  readonly style: StyleDto;
}
