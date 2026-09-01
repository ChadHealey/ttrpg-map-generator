/** Pure accepted-world to inherited-context snapshot assembly for issue #145. */

import {
  type AcceptedAspectRecord,
  ATLAS_FULL_LATITUDE_BAND_COUNT,
  ATLAS_FULL_LONGITUDE_CELL_COUNT,
  computeInheritedContextSemanticChecksum,
  createRegionalFootprintTransform,
  deriveRegionalFootprintEntityId,
  INHERITED_CONTEXT_COLLAR_VERSION,
  INHERITED_CONTEXT_CONTRACT_VERSION,
  INHERITED_CONTEXT_ROOT_REFINEMENT_NAMESPACE_VERSION,
  type InheritedContextSnapshot,
  type InheritedContextSnapshotContent,
  parseInheritedContextSnapshot,
  parseRegionalExtent,
  parseRegionalPoint,
  parseRegionalRectangleFootprint,
  reconstructAcceptedAtlas,
  type RegionalExtent,
  type RegionalRectangleFootprint,
  validateRoundTripSafeRegionalExtent,
  type WorldDocument,
  type WorldFeatureNameContent,
  type WorldFeatureNameParameters,
} from '@ttrpg-map/core';

import {
  getAtlasGridVertex,
  getAtlasSampleStorageIndex,
  WORLD_ATLAS_FULL_PROFILE,
} from './atlas-sampling-profiles.js';
import {
  type AcceptedBuildSource,
  assembleAcceptedContextMembers,
  type SelectedInheritedContextAnchor,
} from './inherited-context-source-assembly.js';

export const INHERITED_CONTEXT_BUILDER_DIAGNOSTIC_CODES = Object.freeze({
  inputInvalid: 'inherited-context-builder.input.invalid',
  acceptedStateInvalid: 'inherited-context-builder.accepted-state.invalid',
  physicalStateMissing: 'inherited-context-builder.physical-state.missing',
  footprintMismatch: 'inherited-context-builder.footprint.mismatch',
  collarInvalid: 'inherited-context-builder.collar.invalid',
  sourceInvalid: 'inherited-context-builder.source.invalid',
  nameSourceInvalid: 'inherited-context-builder.name-source.invalid',
  clippingInvalid: 'inherited-context-builder.clipping.invalid',
  snapshotInvalid: 'inherited-context-builder.snapshot.invalid',
} as const);

export type InheritedContextBuilderDiagnosticCode =
  (typeof INHERITED_CONTEXT_BUILDER_DIAGNOSTIC_CODES)[keyof typeof INHERITED_CONTEXT_BUILDER_DIAGNOSTIC_CODES];

export interface InheritedContextBuilderDiagnostic {
  readonly code: InheritedContextBuilderDiagnosticCode;
  readonly subject: string;
  readonly message: string;
}

export interface BuildInheritedContextInput {
  readonly document: WorldDocument;
  readonly footprint: RegionalRectangleFootprint;
  readonly collarPaddingMillimeters: number;
  readonly acceptedNameAspects: readonly AcceptedAspectRecord<
    WorldFeatureNameParameters,
    WorldFeatureNameContent
  >[];
}

export type BuildInheritedContextResult =
  | { readonly status: 'built'; readonly snapshot: InheritedContextSnapshot }
  | {
      readonly status: 'invalid';
      readonly diagnostics: readonly InheritedContextBuilderDiagnostic[];
    };

/** Build one exact snapshot from accepted state without generation, mutation, persistence, or UI. */
export function buildInheritedContext(
  input: BuildInheritedContextInput,
): BuildInheritedContextResult {
  if (!isPositiveSafeInteger(input.collarPaddingMillimeters)) {
    return invalid(
      'inputInvalid',
      'collarPaddingMillimeters',
      'Collar padding must be a positive safe integer number of millimeters.',
    );
  }
  const footprint = parseRegionalRectangleFootprint(input.footprint);
  if (!footprint.ok) {
    return invalid('inputInvalid', 'footprint', footprint.diagnostic.message);
  }
  const root = input.document.maps.find(({ mapId }) => mapId === input.document.rootMapId);
  if (root?.mapKind !== 'world') {
    return invalid(
      'acceptedStateInvalid',
      'document.rootMapId',
      'Inherited context requires one accepted root world map.',
    );
  }
  if (
    footprint.value.rootSurfaceId !== root.coordinateSystem.rootSurfaceId ||
    footprint.value.worldRadius.radiusMillimeters !== root.coordinateSystem.radius.radiusMillimeters
  ) {
    return invalid(
      'footprintMismatch',
      'footprint',
      'Footprint root surface and world radius must exactly match the accepted root world.',
    );
  }
  const accepted = reconstructAcceptedAtlas(input.document);
  if (accepted.status !== 'accepted') {
    return invalid(
      'acceptedStateInvalid',
      'document',
      accepted.status === 'invalid'
        ? (accepted.diagnostics[0]?.message ?? 'Accepted atlas state is invalid.')
        : 'The document does not contain accepted atlas state.',
    );
  }
  if (accepted.value.physical === undefined) {
    return invalid(
      'physicalStateMissing',
      'document',
      'All nine accepted Milestone 3 physical aspects are required.',
    );
  }
  return buildInheritedContextFromAcceptedSource(
    {
      rootMap: root,
      worldSeed: input.document.worldSeed,
      geography: accepted.value.geography,
      physical: accepted.value.physical,
      acceptedNameAspects: input.acceptedNameAspects,
    },
    footprint.value,
    input.collarPaddingMillimeters,
  );
}

/** Internal accepted-record seam used by focused tests after the high-level reconstruction gate. */
export function buildInheritedContextFromAcceptedSource(
  source: AcceptedBuildSource,
  footprint: RegionalRectangleFootprint,
  collarPaddingMillimeters: number,
): BuildInheritedContextResult {
  const collar = expandAndValidateCollar(footprint, collarPaddingMillimeters);
  if (collar === undefined) {
    return invalid(
      'collarInvalid',
      'collar',
      'Expanded collar overflows or leaves the transform round-trip-safe domain.',
    );
  }
  const anchors = selectFieldAnchors(footprint, collar);
  if (anchors.length === 0) {
    return invalid(
      'sourceInvalid',
      'fields',
      'The accepted full-profile lattice has no sample inside the requested collar.',
    );
  }
  const members = assembleAcceptedContextMembers(source, footprint, collar, anchors);
  if (!members.ok) {
    const code =
      members.category === 'name'
        ? 'nameSourceInvalid'
        : members.category === 'clipping'
          ? 'clippingInvalid'
          : 'sourceInvalid';
    return invalid(code, members.subject, members.message);
  }
  const content: InheritedContextSnapshotContent = {
    contractVersion: INHERITED_CONTEXT_CONTRACT_VERSION,
    rootMapId: source.rootMap.mapId,
    parentMapId: source.rootMap.mapId,
    footprintId: deriveRegionalFootprintEntityId(footprint),
    footprint,
    rootRefinementNamespace: {
      namespaceVersion: INHERITED_CONTEXT_ROOT_REFINEMENT_NAMESPACE_VERSION,
      rootSurfaceId: footprint.rootSurfaceId,
      seedScope: 'root-coordinate',
    },
    collar: { collarVersion: INHERITED_CONTEXT_COLLAR_VERSION, extent: collar },
    sourceLineage: members.sourceLineage,
    sourceAspectVersions: members.sourceAspectVersions,
    fields: members.fields,
    geometryAnchors: members.geometryAnchors,
    boundaryPortals: members.boundaryPortals,
    namedAnchors: members.namedAnchors,
  };
  const candidate = {
    ...content,
    semanticChecksum: computeInheritedContextSemanticChecksum(content),
  };
  const parsed = parseInheritedContextSnapshot(candidate);
  if (!parsed.ok) {
    return invalid(
      'snapshotInvalid',
      parsed.diagnostics[0]?.subject ?? 'snapshot',
      parsed.diagnostics[0]?.message ?? 'Completed inherited context is invalid.',
    );
  }
  return { status: 'built', snapshot: parsed.value };
}

function expandAndValidateCollar(
  footprint: RegionalRectangleFootprint,
  padding: number,
): RegionalExtent | undefined {
  if (!isPositiveSafeInteger(padding)) return undefined;
  const values = {
    minXMillimeters: footprint.extent.minXMillimeters - padding,
    maxXMillimeters: footprint.extent.maxXMillimeters + padding,
    minYMillimeters: footprint.extent.minYMillimeters - padding,
    maxYMillimeters: footprint.extent.maxYMillimeters + padding,
  };
  if (Object.values(values).some((value) => !Number.isSafeInteger(value))) return undefined;
  const parsed = parseRegionalExtent(values);
  if (!parsed.ok) return undefined;
  const transform = createRegionalFootprintTransform(footprint);
  if (!validateRoundTripSafeRegionalExtent(parsed.value, transform).ok) return undefined;
  for (const point of extentCorners(parsed.value)) {
    const regionalPoint = parseRegionalPoint(point);
    if (!regionalPoint.ok || !transform.inverse(regionalPoint.value).ok) return undefined;
  }
  return parsed.value;
}

function selectFieldAnchors(
  footprint: RegionalRectangleFootprint,
  collar: RegionalExtent,
): readonly SelectedInheritedContextAnchor[] {
  const transform = createRegionalFootprintTransform(footprint);
  const selected: SelectedInheritedContextAnchor[] = [];
  for (let latitudeIndex = 0; latitudeIndex <= ATLAS_FULL_LATITUDE_BAND_COUNT; latitudeIndex += 1) {
    const longitudeCount =
      latitudeIndex === 0 || latitudeIndex === ATLAS_FULL_LATITUDE_BAND_COUNT
        ? 1
        : ATLAS_FULL_LONGITUDE_CELL_COUNT;
    for (let longitudeIndex = 0; longitudeIndex < longitudeCount; longitudeIndex += 1) {
      const rootPoint = getAtlasGridVertex(WORLD_ATLAS_FULL_PROFILE, longitudeIndex, latitudeIndex);
      const local = transform.forward(rootPoint);
      if (!local.ok || !inside(local.value, collar)) continue;
      selected.push(
        Object.freeze({
          sampleIndex: getAtlasSampleStorageIndex(
            WORLD_ATLAS_FULL_PROFILE,
            longitudeIndex,
            latitudeIndex,
          ),
          rootPoint,
        }),
      );
    }
  }
  return Object.freeze(selected);
}

function extentCorners(extent: RegionalExtent) {
  return [
    { xMillimeters: extent.minXMillimeters, yMillimeters: extent.minYMillimeters },
    { xMillimeters: extent.minXMillimeters, yMillimeters: extent.maxYMillimeters },
    { xMillimeters: extent.maxXMillimeters, yMillimeters: extent.minYMillimeters },
    { xMillimeters: extent.maxXMillimeters, yMillimeters: extent.maxYMillimeters },
  ] as const;
}

function inside(
  point: { readonly xMillimeters: number; readonly yMillimeters: number },
  extent: RegionalExtent,
) {
  return (
    point.xMillimeters >= extent.minXMillimeters &&
    point.xMillimeters <= extent.maxXMillimeters &&
    point.yMillimeters >= extent.minYMillimeters &&
    point.yMillimeters <= extent.maxYMillimeters
  );
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function invalid(
  code: keyof typeof INHERITED_CONTEXT_BUILDER_DIAGNOSTIC_CODES,
  subject: string,
  message: string,
): BuildInheritedContextResult {
  return {
    status: 'invalid',
    diagnostics: Object.freeze([
      Object.freeze({ code: INHERITED_CONTEXT_BUILDER_DIAGNOSTIC_CODES[code], subject, message }),
    ]),
  };
}
