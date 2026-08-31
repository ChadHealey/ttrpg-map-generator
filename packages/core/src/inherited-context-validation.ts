/** Trust-boundary orchestration for the version-1 inherited-context domain contract. */

import { parseStableId } from './identity.js';
import { createImmutableDomainSnapshot } from './immutable-domain-snapshot.js';
import {
  computeInheritedContextSemanticChecksum,
  inheritedContextSnapshotContent,
} from './inherited-context-checksum.js';
import {
  validateBoundaryPortals,
  validateFields,
  validateGeometryAnchors,
  validateNamedAnchors,
} from './inherited-context-member-validation.js';
import {
  INHERITED_CONTEXT_CONTRACT_VERSION,
  type InheritedContextBoundaryPortal,
  type InheritedContextDiagnostic,
  type InheritedContextField,
  type InheritedContextGeometryAnchor,
  type InheritedContextNamedAnchor,
  type InheritedContextParseResult,
  type InheritedContextSnapshot,
  type InheritedContextSourceAspectVersion,
  type InheritedContextSourceLineage,
} from './inherited-context-model.js';
import { validateInheritedContextReferences } from './inherited-context-reference-validation.js';
import {
  hasValidSemanticChecksumRecord,
  validateCollar,
  validateLineage,
  validateRootRefinementNamespace,
  validateSourceVersions,
} from './inherited-context-structure-validation.js';
import {
  array,
  diagnostic,
  failed,
  hasExactKeys,
  isRecord,
  orderDiagnostics,
} from './inherited-context-validation-support.js';
import { deriveRegionalFootprintEntityId } from './regional-footprint-identity.js';
import {
  createRegionalFootprintTransform,
  parseRegionalRectangleFootprint,
} from './regional-footprint-validation.js';

/** Parse unknown/imported data without defaulting, reordering, deduplicating, or repairing it. */
export function parseInheritedContextSnapshot(input: unknown): InheritedContextParseResult {
  const immutable = createImmutableDomainSnapshot(input);
  if (!immutable.ok || !isRecord(immutable.value)) {
    return failed(
      diagnostic(
        'invalidRecord',
        'snapshot',
        'Inherited context must be a plain recursively immutable domain record.',
      ),
    );
  }
  const candidate = immutable.value;
  if (
    !hasExactKeys(candidate, [
      'boundaryPortals',
      'collar',
      'contractVersion',
      'fields',
      'footprint',
      'footprintId',
      'geometryAnchors',
      'namedAnchors',
      'parentMapId',
      'rootMapId',
      'rootRefinementNamespace',
      'semanticChecksum',
      'sourceAspectVersions',
      'sourceLineage',
    ])
  ) {
    return failed(
      diagnostic('invalidRecord', 'snapshot', 'Inherited context fields are missing or unknown.'),
    );
  }

  const diagnostics: InheritedContextDiagnostic[] = [];
  if (candidate.contractVersion !== INHERITED_CONTEXT_CONTRACT_VERSION) {
    diagnostics.push(
      diagnostic('invalidVersion', 'contractVersion', 'Inherited-context version 1 is required.'),
    );
  }
  const rootMapId = parseStableId('map', candidate.rootMapId);
  const parentMapId = parseStableId('map', candidate.parentMapId);
  const footprintId = parseStableId('entity', candidate.footprintId);
  const footprint = parseRegionalRectangleFootprint(candidate.footprint);
  if (!rootMapId.ok || !parentMapId.ok || !footprintId.ok || !footprint.ok) {
    diagnostics.push(
      diagnostic(
        'invalidReference',
        'snapshot',
        'Root, parent, footprint, and root-surface references must be canonical and compatible.',
      ),
    );
  } else if (deriveRegionalFootprintEntityId(footprint.value) !== footprintId.value) {
    diagnostics.push(
      diagnostic(
        'invalidReference',
        'footprintId',
        'Footprint ID must be derived from the complete canonical footprint tuple.',
      ),
    );
  }
  if (!hasValidSemanticChecksumRecord(candidate.semanticChecksum)) {
    diagnostics.push(
      diagnostic(
        'invalidVersion',
        'semanticChecksum',
        'Semantic checksum must use the inherited-context SHA-256 version-1 contract.',
      ),
    );
  }
  if (!footprint.ok) return failed(...diagnostics);

  const transform = createRegionalFootprintTransform(footprint.value);
  const collar = validateCollar(candidate.collar, footprint.value.extent, transform);
  if (!collar.ok) diagnostics.push(collar.diagnostic);

  const lineage = array(candidate.sourceLineage);
  const sourceVersions = array(candidate.sourceAspectVersions);
  const fields = array(candidate.fields);
  const anchors = array(candidate.geometryAnchors);
  const portals = array(candidate.boundaryPortals);
  const names = array(candidate.namedAnchors);
  if (
    lineage === undefined ||
    sourceVersions === undefined ||
    fields === undefined ||
    anchors === undefined ||
    portals === undefined ||
    names === undefined
  ) {
    diagnostics.push(
      diagnostic(
        'invalidRecord',
        'members',
        'Inherited-context member collections must be arrays.',
      ),
    );
    return failed(...diagnostics);
  }

  const lineageDiagnostics = validateLineage(lineage);
  const sourceVersionDiagnostics = validateSourceVersions(sourceVersions);
  const fieldDiagnostics = validateFields(fields, collar.ok ? collar.extent : undefined, transform);
  const anchorDiagnostics = validateGeometryAnchors(
    anchors,
    collar.ok ? collar.extent : undefined,
    transform,
  );
  const portalDiagnostics = validateBoundaryPortals(
    portals,
    footprint.value.extent,
    collar.ok ? collar.extent : undefined,
    transform,
  );
  const nameDiagnostics = validateNamedAnchors(names);
  diagnostics.push(
    ...lineageDiagnostics,
    ...sourceVersionDiagnostics,
    ...fieldDiagnostics,
    ...anchorDiagnostics,
    ...portalDiagnostics,
    ...nameDiagnostics,
  );
  if (
    rootMapId.ok &&
    parentMapId.ok &&
    lineageDiagnostics.length === 0 &&
    sourceVersionDiagnostics.length === 0 &&
    fieldDiagnostics.length === 0 &&
    anchorDiagnostics.length === 0 &&
    portalDiagnostics.length === 0 &&
    nameDiagnostics.length === 0
  ) {
    diagnostics.push(
      ...validateInheritedContextReferences(
        rootMapId.value,
        parentMapId.value,
        lineage as readonly InheritedContextSourceLineage[],
        sourceVersions as readonly InheritedContextSourceAspectVersion[],
        fields as readonly InheritedContextField[],
        anchors as readonly InheritedContextGeometryAnchor[],
        portals as readonly InheritedContextBoundaryPortal[],
        names as readonly InheritedContextNamedAnchor[],
      ),
    );
  }
  if (
    !validateRootRefinementNamespace(
      candidate.rootRefinementNamespace,
      footprint.value.rootSurfaceId,
    )
  ) {
    diagnostics.push(
      diagnostic(
        'invalidReference',
        'rootRefinementNamespace',
        'Root refinement must use the footprint root surface and root-coordinate seed scope.',
      ),
    );
  }

  const ordered = orderDiagnostics(diagnostics);
  if (ordered.length > 0) return { ok: false, diagnostics: ordered };

  const snapshot = candidate as unknown as InheritedContextSnapshot;
  let expectedChecksum;
  try {
    expectedChecksum = computeInheritedContextSemanticChecksum(
      inheritedContextSnapshotContent(snapshot),
    );
  } catch {
    return failed(
      diagnostic(
        'invalidRecord',
        'semanticChecksum',
        'Inherited-context semantic checksum input is not canonical plain domain data.',
      ),
    );
  }
  if (snapshot.semanticChecksum.value !== expectedChecksum.value) {
    return failed(
      diagnostic(
        'checksumMismatch',
        'semanticChecksum.value',
        'Inherited-context semantic checksum does not match the canonical snapshot content.',
      ),
    );
  }
  return { ok: true, value: snapshot };
}

export function validateInheritedContextSnapshot(
  snapshot: InheritedContextSnapshot,
): InheritedContextParseResult {
  return parseInheritedContextSnapshot(snapshot);
}
