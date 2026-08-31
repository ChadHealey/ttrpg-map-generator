/** Clipped field, geometry-anchor, portal, and named-anchor validation. */

import {
  ATLAS_FULL_LATITUDE_BAND_COUNT,
  ATLAS_FULL_LONGITUDE_CELL_COUNT,
  ATLAS_FULL_SAMPLE_COUNT,
} from './atlas-geography-model.js';
import { atlasStorageAddress } from './atlas-geography-surface-topology.js';
import { parseBehaviorVersion, parseVariantRevision } from './compatibility.js';
import {
  parsePlanetPoint,
  parseRegionalPoint,
  PLANET_LATITUDE_MAX_TICKS,
  PLANET_LATITUDE_MIN_TICKS,
  PLANET_LONGITUDE_MIN_TICKS,
  PLANET_TICKS_PER_TURN,
} from './coordinates.js';
import { parseSemanticKey, parseStableId } from './identity.js';
import {
  INHERITED_CONTEXT_PORTAL_ORDER,
  type InheritedContextBoundaryPortal,
  type InheritedContextDiagnostic,
  type InheritedContextField,
  type InheritedContextFieldSample,
  type InheritedContextGeometryAnchor,
  type InheritedContextNamedAnchor,
} from './inherited-context-model.js';
import {
  compareAscii,
  diagnostic,
  hasExactKeys,
  isInsideExtent,
  isRecord,
  isStrictlyOrdered,
  type RegionalExtentLike,
  type RegionalPointLike,
  sameValues,
} from './inherited-context-validation-support.js';
import type { createRegionalFootprintTransform } from './regional-footprint-validation.js';

const HEX_SHA256 = /^[0-9a-f]{64}$/;
const DISPLAY_NAME = /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/;
const FIELD_KINDS = new Set([
  'macro-elevation',
  'land-water-classification',
  'temperature',
  'prevailing-winds-direction',
  'prevailing-winds-speed',
  'moisture',
  'climate-zones',
  'biome-belts',
  'watershed-assignment',
]);
const FIELD_COMPONENTS = new Set(['value', 'x', 'y', 'z', 'speed']);
const FIELD_VALUE_ENCODINGS = new Set([
  'entity-id',
  'integer-ticks',
  'land-water-class',
  'semantic-key',
]);
const REQUIRED_FIELD_KEYS = Object.freeze([
  'biome-belts/value',
  'climate-zones/value',
  'land-water-classification/value',
  'macro-elevation/value',
  'moisture/value',
  'prevailing-winds-direction/x',
  'prevailing-winds-direction/y',
  'prevailing-winds-direction/z',
  'prevailing-winds-speed/speed',
  'temperature/value',
  'watershed-assignment/value',
]);
const GEOMETRY_ANCHOR_KINDS = new Set([
  'biome-belt',
  'coastline',
  'major-lake',
  'major-river',
  'mountain-system',
  'watershed-divide',
]);
const PORTAL_KINDS = new Set([
  'coastline',
  'lake',
  'mountain-ridge',
  'river',
  'route',
  'watershed-divide',
]);
const NAME_KINDS = new Set([
  'island-group',
  'lake',
  'landmass',
  'mountain-system',
  'river',
  'water-body',
  'watershed',
]);

export function validateFields(
  values: readonly unknown[],
  collar: RegionalExtentLike | undefined,
  transform: ReturnType<typeof createRegionalFootprintTransform>,
): readonly InheritedContextDiagnostic[] {
  if (values.some((value) => !hasValidFieldShape(value))) {
    return [diagnostic('invalidRecord', 'fields', 'Clipped field records are not canonical.')];
  }
  const fields = values as readonly InheritedContextField[];
  if (!sameValues(fields.map(fieldKey), REQUIRED_FIELD_KEYS)) {
    return [
      diagnostic(
        'invalidOrdering',
        'fields',
        'Clipped fields must contain the complete unique version-1 field/component set in canonical order.',
      ),
    ];
  }
  const first = fields[0];
  if (first === undefined || first.samples.length === 0) {
    return [diagnostic('invalidRecord', 'fields', 'Clipped fields require accepted samples.')];
  }
  for (const field of fields) {
    if (
      !hasValidFieldEncoding(field) ||
      !isStrictlyOrdered(field.samples, ({ sampleIndex }) =>
        String(sampleIndex).padStart(10, '0'),
      ) ||
      !sameSampleAnchors(field.samples, first.samples)
    ) {
      return [
        diagnostic(
          'invalidOrdering',
          'fields.samples',
          'Every field must use the same non-empty, unique, sample-index-ordered root anchors.',
        ),
      ];
    }
    if (field.samples.some((sample) => !isPointInsideCollar(sample.rootPoint, collar, transform))) {
      return [
        diagnostic(
          'outsideCollar',
          'fields.samples.rootPoint',
          'Every clipped field sample must lie inside the declared collar.',
        ),
      ];
    }
  }
  return [];
}

export function validateGeometryAnchors(
  values: readonly unknown[],
  collar: RegionalExtentLike | undefined,
  transform: ReturnType<typeof createRegionalFootprintTransform>,
): readonly InheritedContextDiagnostic[] {
  if (
    values.some(
      (value) =>
        !isRecord(value) ||
        !hasExactKeys(value, [
          'anchorKind',
          'paths',
          'sourceAnchorId',
          'sourceAspectId',
          'sourceEntityId',
          'sourceMapId',
        ]) ||
        !parseStableId('map', value.sourceMapId).ok ||
        !parseStableId('entity', value.sourceEntityId).ok ||
        !parseStableId('aspect', value.sourceAspectId).ok ||
        (!parseStableId('entity', value.sourceAnchorId).ok &&
          !parseStableId('coastline-ring', value.sourceAnchorId).ok) ||
        !GEOMETRY_ANCHOR_KINDS.has(String(value.anchorKind)) ||
        !Array.isArray(value.paths) ||
        value.paths.length === 0 ||
        value.paths.some(
          (path) =>
            !Array.isArray(path) ||
            path.length === 0 ||
            path.some(
              (point) =>
                !parsePlanetPoint(point).ok || !isPointInsideCollar(point, collar, transform),
            ),
        ),
    )
  ) {
    return [
      diagnostic(
        'outsideCollar',
        'geometryAnchors',
        'Geometry anchors require canonical references and planet points inside the collar.',
      ),
    ];
  }
  const anchors = values as readonly InheritedContextGeometryAnchor[];
  if (new Set(anchors.map(({ sourceAnchorId }) => sourceAnchorId)).size !== anchors.length) {
    return [
      diagnostic('invalidOrdering', 'geometryAnchors', 'Geometry anchor IDs must be unique.'),
    ];
  }
  return isStrictlyOrdered(
    anchors,
    (value) => `${String(value.sourceAnchorId)}\n${value.anchorKind}`,
  )
    ? []
    : [
        diagnostic(
          'invalidOrdering',
          'geometryAnchors',
          'Geometry anchors must be unique and stable-anchor-ID ordered.',
        ),
      ];
}

export function validateBoundaryPortals(
  values: readonly unknown[],
  footprint: RegionalExtentLike,
  collar: RegionalExtentLike | undefined,
  transform: ReturnType<typeof createRegionalFootprintTransform>,
): readonly InheritedContextDiagnostic[] {
  if (values.some((value) => !hasValidPortalShape(value))) {
    return [diagnostic('invalidPortal', 'boundaryPortals', 'Boundary portal records are invalid.')];
  }
  const portals = values as readonly InheritedContextBoundaryPortal[];
  if (new Set(portals.map(({ portalId }) => portalId)).size !== portals.length) {
    return [
      diagnostic('invalidOrdering', 'boundaryPortals', 'Boundary portal IDs must be unique.'),
    ];
  }
  for (const portal of portals) {
    if (
      portalPerimeterOffset(portal.localPoint, footprint) === undefined ||
      !isPointInsideCollar(portal.rootPoint, collar, transform) ||
      !rootAndLocalPointAgree(portal, transform)
    ) {
      return [
        diagnostic(
          'invalidPortal',
          'boundaryPortals',
          'Every portal must lie on the footprint boundary and agree with its planet-native point.',
        ),
      ];
    }
  }
  return arePortalsStrictlyOrdered(portals, footprint)
    ? []
    : [
        diagnostic(
          'invalidOrdering',
          'boundaryPortals',
          `Boundary portals must be unique in ${INHERITED_CONTEXT_PORTAL_ORDER} order.`,
        ),
      ];
}

export function validateNamedAnchors(
  values: readonly unknown[],
): readonly InheritedContextDiagnostic[] {
  if (values.some((value) => !hasValidNamedAnchor(value))) {
    return [diagnostic('invalidRecord', 'namedAnchors', 'Named-anchor provenance is invalid.')];
  }
  return isStrictlyOrdered(values as readonly InheritedContextNamedAnchor[], (value) =>
    String(value.sourceEntityId),
  )
    ? []
    : [
        diagnostic(
          'invalidOrdering',
          'namedAnchors',
          'Named anchors must be unique and stable-entity-ID ordered.',
        ),
      ];
}

function hasValidFieldShape(value: unknown): value is InheritedContextField {
  if (!isRecord(value)) return false;
  if (
    !hasExactKeys(
      value,
      [
        'component',
        'fieldKind',
        'samples',
        'sourceAspectId',
        'sourceEntityId',
        'sourceMapId',
        'valueEncoding',
      ],
      ['sourceFingerprint'],
    ) ||
    !parseStableId('map', value.sourceMapId).ok ||
    !parseStableId('entity', value.sourceEntityId).ok ||
    !parseStableId('aspect', value.sourceAspectId).ok ||
    !FIELD_KINDS.has(String(value.fieldKind)) ||
    !FIELD_COMPONENTS.has(String(value.component)) ||
    !FIELD_VALUE_ENCODINGS.has(String(value.valueEncoding)) ||
    (value.sourceFingerprint !== undefined &&
      (typeof value.sourceFingerprint !== 'string' || !HEX_SHA256.test(value.sourceFingerprint))) ||
    !Array.isArray(value.samples)
  ) {
    return false;
  }
  return value.samples.every(
    (sample) =>
      isRecord(sample) &&
      hasExactKeys(sample, ['rootPoint', 'sampleIndex', 'values']) &&
      isCanonicalAtlasSampleAnchor(sample.sampleIndex, sample.rootPoint) &&
      Array.isArray(sample.values) &&
      sample.values.length > 0,
  );
}

function isCanonicalAtlasSampleAnchor(sampleIndex: unknown, rootPoint: unknown): boolean {
  if (
    !Number.isSafeInteger(sampleIndex) ||
    Number(sampleIndex) < 0 ||
    Number(sampleIndex) >= ATLAS_FULL_SAMPLE_COUNT
  ) {
    return false;
  }
  const point = parsePlanetPoint(rootPoint);
  if (!point.ok) return false;
  if (sampleIndex === 0) {
    return (
      point.value.longitudeTicks === 0 && point.value.latitudeTicks === PLANET_LATITUDE_MIN_TICKS
    );
  }
  if (sampleIndex === ATLAS_FULL_SAMPLE_COUNT - 1) {
    return (
      point.value.longitudeTicks === 0 && point.value.latitudeTicks === PLANET_LATITUDE_MAX_TICKS
    );
  }
  const { longitudeIndex, latitudeIndex } = atlasStorageAddress(Number(sampleIndex));
  return (
    point.value.longitudeTicks ===
      PLANET_LONGITUDE_MIN_TICKS +
        longitudeIndex * (PLANET_TICKS_PER_TURN / ATLAS_FULL_LONGITUDE_CELL_COUNT) &&
    point.value.latitudeTicks ===
      PLANET_LATITUDE_MIN_TICKS +
        latitudeIndex * (PLANET_TICKS_PER_TURN / 2 / ATLAS_FULL_LATITUDE_BAND_COUNT)
  );
}

function hasValidFieldEncoding(field: InheritedContextField): boolean {
  const expected = expectedFieldPolicy(field.fieldKind, field.component);
  if (
    expected === undefined ||
    expected !== field.valueEncoding ||
    (field.fieldKind !== 'macro-elevation' && field.fieldKind !== 'land-water-classification') !==
      (field.sourceFingerprint !== undefined)
  ) {
    return false;
  }
  return field.samples.every((sample) =>
    sample.values.every((value) => validFieldValue(value, expected)),
  );
}

function expectedFieldPolicy(
  fieldKind: InheritedContextField['fieldKind'],
  component: InheritedContextField['component'],
): InheritedContextField['valueEncoding'] | undefined {
  if (fieldKind === 'prevailing-winds-direction') {
    return component === 'x' || component === 'y' || component === 'z'
      ? 'integer-ticks'
      : undefined;
  }
  if (fieldKind === 'prevailing-winds-speed')
    return component === 'speed' ? 'integer-ticks' : undefined;
  if (component !== 'value') return undefined;
  if (fieldKind === 'land-water-classification') return 'land-water-class';
  if (fieldKind === 'climate-zones' || fieldKind === 'biome-belts') return 'semantic-key';
  if (fieldKind === 'watershed-assignment') return 'entity-id';
  return 'integer-ticks';
}

function validFieldValue(
  value: string | number,
  encoding: InheritedContextField['valueEncoding'],
): boolean {
  if (encoding === 'integer-ticks') {
    return typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0);
  }
  if (encoding === 'land-water-class') return value === 'land' || value === 'water';
  if (encoding === 'semantic-key') return parseSemanticKey(value).ok;
  return parseStableId('entity', value).ok;
}

function hasValidPortalShape(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'localPoint',
      'portalId',
      'portalKind',
      'rootPoint',
      'sourceAspectId',
      'sourceEntityId',
      'sourceMapId',
    ]) &&
    parseStableId('boundary-portal', value.portalId).ok &&
    parseStableId('map', value.sourceMapId).ok &&
    parseStableId('entity', value.sourceEntityId).ok &&
    parseStableId('aspect', value.sourceAspectId).ok &&
    PORTAL_KINDS.has(String(value.portalKind)) &&
    parsePlanetPoint(value.rootPoint).ok &&
    parseRegionalPoint(value.localPoint).ok
  );
}

function hasValidNamedAnchor(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'displayName',
      'lexiconVersion',
      'nameContentBehaviorVersion',
      'nameKind',
      'origin',
      'sourceAspectId',
      'sourceEntityId',
      'sourceMapId',
      'variantRevision',
    ]) &&
    parseStableId('map', value.sourceMapId).ok &&
    parseStableId('entity', value.sourceEntityId).ok &&
    parseStableId('aspect', value.sourceAspectId).ok &&
    NAME_KINDS.has(String(value.nameKind)) &&
    (value.origin === 'generated' || value.origin === 'manual-override') &&
    typeof value.displayName === 'string' &&
    DISPLAY_NAME.test(value.displayName) &&
    parseBehaviorVersion(value.nameContentBehaviorVersion).ok &&
    parseBehaviorVersion(value.lexiconVersion).ok &&
    parseVariantRevision(value.variantRevision).ok
  );
}

function isPointInsideCollar(
  input: unknown,
  collar: RegionalExtentLike | undefined,
  transform: ReturnType<typeof createRegionalFootprintTransform>,
): boolean {
  if (collar === undefined) return false;
  const point = parsePlanetPoint(input);
  if (!point.ok) return false;
  const local = transform.forward(point.value);
  return local.ok && isInsideExtent(local.value, collar);
}

function rootAndLocalPointAgree(
  portal: InheritedContextBoundaryPortal,
  transform: ReturnType<typeof createRegionalFootprintTransform>,
): boolean {
  const projected = transform.forward(portal.rootPoint);
  return (
    projected.ok &&
    Math.abs(projected.value.xMillimeters - portal.localPoint.xMillimeters) <= 1 &&
    Math.abs(projected.value.yMillimeters - portal.localPoint.yMillimeters) <= 1
  );
}

function portalPerimeterOffset(
  point: RegionalPointLike,
  extent: RegionalExtentLike,
): bigint | undefined {
  const width = BigInt(extent.maxXMillimeters) - BigInt(extent.minXMillimeters);
  const height = BigInt(extent.maxYMillimeters) - BigInt(extent.minYMillimeters);
  if (point.yMillimeters === extent.minYMillimeters)
    return BigInt(point.xMillimeters) - BigInt(extent.minXMillimeters);
  if (point.xMillimeters === extent.maxXMillimeters)
    return width + BigInt(point.yMillimeters) - BigInt(extent.minYMillimeters);
  if (point.yMillimeters === extent.maxYMillimeters)
    return width + height + BigInt(extent.maxXMillimeters) - BigInt(point.xMillimeters);
  if (point.xMillimeters === extent.minXMillimeters)
    return 2n * width + height + BigInt(extent.maxYMillimeters) - BigInt(point.yMillimeters);
  return undefined;
}

function arePortalsStrictlyOrdered(
  portals: readonly InheritedContextBoundaryPortal[],
  extent: RegionalExtentLike,
): boolean {
  for (let index = 1; index < portals.length; index += 1) {
    const previous = portals[index - 1];
    const current = portals[index];
    if (
      previous === undefined ||
      current === undefined ||
      comparePortals(previous, current, extent) >= 0
    )
      return false;
  }
  return true;
}

function comparePortals(
  left: InheritedContextBoundaryPortal,
  right: InheritedContextBoundaryPortal,
  extent: RegionalExtentLike,
): number {
  const leftOffset = portalPerimeterOffset(left.localPoint, extent) ?? -1n;
  const rightOffset = portalPerimeterOffset(right.localPoint, extent) ?? -1n;
  if (leftOffset < rightOffset) return -1;
  if (leftOffset > rightOffset) return 1;
  return (
    left.rootPoint.longitudeTicks - right.rootPoint.longitudeTicks ||
    left.rootPoint.latitudeTicks - right.rootPoint.latitudeTicks ||
    compareAscii(left.sourceEntityId, right.sourceEntityId) ||
    compareAscii(left.portalId, right.portalId)
  );
}

function fieldKey(field: InheritedContextField): string {
  return `${field.fieldKind}/${field.component}`;
}

function sameSampleAnchors(
  left: readonly InheritedContextFieldSample[],
  right: readonly InheritedContextFieldSample[],
): boolean {
  return (
    left.length === right.length &&
    left.every((sample, index) => {
      const expected = right[index];
      return (
        sample.sampleIndex === expected?.sampleIndex &&
        sample.rootPoint.longitudeTicks === expected.rootPoint.longitudeTicks &&
        sample.rootPoint.latitudeTicks === expected.rootPoint.latitudeTicks
      );
    })
  );
}
