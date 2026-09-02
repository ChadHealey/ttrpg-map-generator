/** Disposable desktop assembly of one inherited-context snapshot and its atlas overlay. */

import {
  type AcceptedAspectRecord,
  type InheritedContextSnapshot,
  isAtlasLabelAcceptedAspectName,
  WORLD_FEATURE_NAME_ASPECT_NAME,
  type WorldFeatureNameContent,
  type WorldFeatureNameParameters,
} from '@ttrpg-map/core';
import { buildInheritedContext } from '@ttrpg-map/generation';

import type {
  AtlasFootprintCandidate,
  AtlasFootprintOverlayPath,
} from './atlas-footprint-selector.js';
import { projectAtlasFootprintOverlay } from './atlas-footprint-selector.js';
import type { AcceptedAtlasState } from './atlas-workflow-generation.js';

export const INHERITED_CONTEXT_PREVIEW_COLLAR_PADDING_MILLIMETERS = 100_000;

export const INHERITED_CONTEXT_PREVIEW_DIAGNOSTIC_CODES = Object.freeze({
  sourceMissing: 'atlas.inherited-context-preview.source.missing',
  sourceInvalid: 'atlas.inherited-context-preview.source.invalid',
} as const);

export interface AtlasInheritedContextPreview {
  readonly sourceDocument: AcceptedAtlasState['document'];
  readonly sourceScene: AcceptedAtlasState['scene'];
  readonly sourceCandidate: AtlasFootprintCandidate;
  readonly snapshot: InheritedContextSnapshot;
  readonly overlayPaths: readonly AtlasFootprintOverlayPath[];
}

export interface AtlasInheritedContextPreviewDiagnostic {
  readonly code: string;
  readonly message: string;
}

export type BuildAtlasInheritedContextPreviewResult =
  | { readonly status: 'built'; readonly preview: AtlasInheritedContextPreview }
  | { readonly status: 'invalid'; readonly diagnostic: AtlasInheritedContextPreviewDiagnostic };

/** Build one disposable preview directly from accepted name aspects and a canonical candidate. */
export function buildAtlasInheritedContextPreview(
  accepted: AcceptedAtlasState | undefined,
  candidate: AtlasFootprintCandidate | undefined,
): BuildAtlasInheritedContextPreviewResult {
  if (accepted === undefined || candidate === undefined) {
    return invalid(
      INHERITED_CONTEXT_PREVIEW_DIAGNOSTIC_CODES.sourceMissing,
      'Select a footprint on an accepted complete M3 atlas before requesting inherited context.',
    );
  }
  const root = accepted.document.maps.find(({ mapId }) => mapId === accepted.document.rootMapId);
  if (root?.mapKind !== 'world') {
    return invalid(
      INHERITED_CONTEXT_PREVIEW_DIAGNOSTIC_CODES.sourceInvalid,
      'The accepted atlas has no root world map for inherited-context assembly.',
    );
  }
  const result = buildInheritedContext({
    document: inheritedContextSourceDocument(accepted.document),
    footprint: candidate.footprint,
    collarPaddingMillimeters: INHERITED_CONTEXT_PREVIEW_COLLAR_PADDING_MILLIMETERS,
    acceptedNameAspects: acceptedNameAspects(root.aspects),
  });
  if (result.status !== 'built') {
    const diagnostic = result.diagnostics[0];
    return invalid(
      diagnostic?.code ?? INHERITED_CONTEXT_PREVIEW_DIAGNOSTIC_CODES.sourceInvalid,
      diagnostic?.message ?? 'The accepted atlas could not build inherited context.',
    );
  }
  return {
    status: 'built',
    preview: Object.freeze({
      sourceDocument: accepted.document,
      sourceScene: accepted.scene,
      sourceCandidate: candidate,
      snapshot: result.snapshot,
      overlayPaths: projectAtlasFootprintOverlay(result.snapshot.footprint, accepted.scene),
    }),
  };
}

/** A snapshot is usable only while both its accepted source and selected footprint still match. */
export function isCurrentAtlasInheritedContextPreview(
  preview: AtlasInheritedContextPreview,
  accepted: AcceptedAtlasState | undefined,
  candidate: AtlasFootprintCandidate | undefined,
): boolean {
  return preview.sourceScene === accepted?.scene && preview.sourceCandidate === candidate;
}

function invalid(code: string, message: string): BuildAtlasInheritedContextPreviewResult {
  return Object.freeze({ status: 'invalid', diagnostic: Object.freeze({ code, message }) });
}

function acceptedNameAspects(
  aspects: AcceptedAtlasState['document']['maps'][number]['aspects'],
): readonly AcceptedAspectRecord<WorldFeatureNameParameters, WorldFeatureNameContent>[] {
  return aspects
    .filter(({ aspectName }) => aspectName === WORLD_FEATURE_NAME_ASPECT_NAME)
    .map(
      (aspect) =>
        aspect as AcceptedAspectRecord<WorldFeatureNameParameters, WorldFeatureNameContent>,
    );
}

/**
 * #145 receives accepted names separately. Remove accepted label records from a disposable source
 * document so their aspect envelopes do not appear twice during source-version assembly.
 */
function inheritedContextSourceDocument(
  document: AcceptedAtlasState['document'],
): AcceptedAtlasState['document'] {
  const rootIndex = document.maps.findIndex(({ mapId }) => mapId === document.rootMapId);
  const root = document.maps[rootIndex];
  if (root === undefined) return document;
  const aspects = Object.freeze(
    root.aspects.filter(({ aspectName }) => !isAtlasLabelAcceptedAspectName(aspectName)),
  );
  const aspectIds = new Set(aspects.map(({ aspectId }) => aspectId));
  const entityIds = new Set(aspects.map(({ entityId }) => entityId));
  const sourceRoot = Object.freeze({
    ...root,
    entities: Object.freeze(root.entities.filter(({ entityId }) => entityIds.has(entityId))),
    aspects,
    decoration: Object.freeze({
      aspectReferences: Object.freeze(
        root.decoration.aspectReferences.filter(({ aspectId }) => aspectIds.has(aspectId)),
      ),
    }),
  });
  return Object.freeze({
    ...document,
    maps: Object.freeze(
      document.maps.map((map, index) => (index === rootIndex ? sourceRoot : map)),
    ),
  });
}
