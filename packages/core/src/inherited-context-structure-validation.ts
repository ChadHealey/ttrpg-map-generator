/** Version, ownership-list, collar, and checksum-record validation for inherited context. */

import {
  parseBehaviorVersion,
  parseParameterSchemaVersion,
  parseVariantRevision,
} from './compatibility.js';
import { validateRoundTripSafeRegionalExtent } from './coordinate-transforms.js';
import { parseRegionalExtent, parseRegionalPoint, type RegionalExtent } from './coordinates.js';
import { parseAspectName } from './generated-aspects.js';
import { parseStableId } from './identity.js';
import { isInheritedContextSemanticChecksum } from './inherited-context-checksum.js';
import {
  INHERITED_CONTEXT_COLLAR_VERSION,
  INHERITED_CONTEXT_ROOT_REFINEMENT_NAMESPACE_VERSION,
  INHERITED_CONTEXT_SEMANTIC_CHECKSUM_ALGORITHM,
  INHERITED_CONTEXT_SEMANTIC_CHECKSUM_VERSION,
  type InheritedContextDiagnostic,
  type InheritedContextSourceAspectVersion,
  type InheritedContextSourceLineage,
} from './inherited-context-model.js';
import {
  diagnostic,
  extentCorners,
  hasExactKeys,
  isRecord,
  isStrictlyOrdered,
  type RegionalExtentLike,
} from './inherited-context-validation-support.js';
import type { createRegionalFootprintTransform } from './regional-footprint-validation.js';

export function validateCollar(
  input: unknown,
  footprintExtent: RegionalExtentLike,
  transform: ReturnType<typeof createRegionalFootprintTransform>,
):
  | { readonly ok: true; readonly extent: RegionalExtent }
  | { readonly ok: false; readonly diagnostic: InheritedContextDiagnostic } {
  if (
    !isRecord(input) ||
    !hasExactKeys(input, ['collarVersion', 'extent']) ||
    input.collarVersion !== INHERITED_CONTEXT_COLLAR_VERSION
  ) {
    return {
      ok: false,
      diagnostic: diagnostic('invalidVersion', 'collar', 'Collar version 1 is required.'),
    };
  }
  const extent = parseRegionalExtent(input.extent);
  if (
    !extent.ok ||
    extent.value.minXMillimeters >= footprintExtent.minXMillimeters ||
    extent.value.maxXMillimeters <= footprintExtent.maxXMillimeters ||
    extent.value.minYMillimeters >= footprintExtent.minYMillimeters ||
    extent.value.maxYMillimeters <= footprintExtent.maxYMillimeters
  ) {
    return {
      ok: false,
      diagnostic: diagnostic(
        'invalidCoordinate',
        'collar.extent',
        'Collar must be a canonical local extent padded beyond every footprint edge.',
      ),
    };
  }
  for (const point of extentCorners(extent.value)) {
    const local = parseRegionalPoint(point);
    if (!local.ok || !transform.inverse(local.value).ok) {
      return {
        ok: false,
        diagnostic: diagnostic(
          'invalidCoordinate',
          'collar.extent',
          'Every collar corner must remain inside the version-1 transform domain.',
        ),
      };
    }
  }
  if (!validateRoundTripSafeRegionalExtent(extent.value, transform).ok) {
    return {
      ok: false,
      diagnostic: diagnostic(
        'invalidCoordinate',
        'collar.extent',
        'Collar must remain inside the declared version-1 round-trip-safe domain.',
      ),
    };
  }
  return { ok: true, extent: extent.value };
}

export function validateLineage(values: readonly unknown[]): readonly InheritedContextDiagnostic[] {
  if (
    values.length === 0 ||
    values.some(
      (value) =>
        !isRecord(value) ||
        !hasExactKeys(value, ['sourceEntityId', 'sourceMapId']) ||
        !parseStableId('map', value.sourceMapId).ok ||
        !parseStableId('entity', value.sourceEntityId).ok,
    )
  ) {
    return [
      diagnostic(
        'invalidReference',
        'sourceLineage',
        'Source lineage requires canonical map/entity references.',
      ),
    ];
  }
  return isStrictlyOrdered(
    values as readonly InheritedContextSourceLineage[],
    (value) => `${String(value.sourceMapId)}\n${String(value.sourceEntityId)}`,
  )
    ? []
    : [
        diagnostic(
          'invalidOrdering',
          'sourceLineage',
          'Source lineage must be unique and ordered by source map then entity ID.',
        ),
      ];
}

export function validateSourceVersions(
  values: readonly unknown[],
): readonly InheritedContextDiagnostic[] {
  if (
    values.length === 0 ||
    values.some(
      (value) =>
        !isRecord(value) ||
        !hasExactKeys(value, [
          'aspectName',
          'generatorVersion',
          'parameterSchemaVersion',
          'sourceAspectId',
          'sourceEntityId',
          'sourceMapId',
          'variantRevision',
        ]) ||
        !parseStableId('map', value.sourceMapId).ok ||
        !parseStableId('entity', value.sourceEntityId).ok ||
        !parseStableId('aspect', value.sourceAspectId).ok ||
        !parseAspectName(value.aspectName).ok ||
        !parseBehaviorVersion(value.generatorVersion).ok ||
        !parseParameterSchemaVersion(value.parameterSchemaVersion).ok ||
        !parseVariantRevision(value.variantRevision).ok,
    )
  ) {
    return [
      diagnostic(
        'invalidReference',
        'sourceAspectVersions',
        'Source aspect versions require canonical ownership and compatibility values.',
      ),
    ];
  }
  return isStrictlyOrdered(values as readonly InheritedContextSourceAspectVersion[], (value) =>
    String(value.sourceAspectId),
  )
    ? []
    : [
        diagnostic(
          'invalidOrdering',
          'sourceAspectVersions',
          'Source aspect versions must be unique and stable-aspect-ID ordered.',
        ),
      ];
}

export function validateRootRefinementNamespace(input: unknown, rootSurfaceId: string): boolean {
  return (
    isRecord(input) &&
    hasExactKeys(input, ['namespaceVersion', 'rootSurfaceId', 'seedScope']) &&
    input.namespaceVersion === INHERITED_CONTEXT_ROOT_REFINEMENT_NAMESPACE_VERSION &&
    input.seedScope === 'root-coordinate' &&
    input.rootSurfaceId === rootSurfaceId &&
    parseStableId('root-surface', input.rootSurfaceId).ok
  );
}

export function hasValidSemanticChecksumRecord(input: unknown): boolean {
  return (
    isRecord(input) &&
    hasExactKeys(input, ['algorithm', 'checksumVersion', 'value']) &&
    input.algorithm === INHERITED_CONTEXT_SEMANTIC_CHECKSUM_ALGORITHM &&
    input.checksumVersion === INHERITED_CONTEXT_SEMANTIC_CHECKSUM_VERSION &&
    isInheritedContextSemanticChecksum(input.value)
  );
}
