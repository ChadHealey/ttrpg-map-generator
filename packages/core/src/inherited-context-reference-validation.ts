/** Cross-record ownership and aspect-kind validation for inherited context. */

import {
  type InheritedContextBoundaryPortal,
  type InheritedContextDiagnostic,
  type InheritedContextField,
  type InheritedContextGeometryAnchor,
  type InheritedContextNamedAnchor,
  type InheritedContextSourceAspectVersion,
  type InheritedContextSourceLineage,
} from './inherited-context-model.js';
import { diagnostic } from './inherited-context-validation-support.js';

export function validateInheritedContextReferences(
  rootMapId: string,
  parentMapId: string,
  lineage: readonly InheritedContextSourceLineage[],
  versions: readonly InheritedContextSourceAspectVersion[],
  fields: readonly InheritedContextField[],
  anchors: readonly InheritedContextGeometryAnchor[],
  portals: readonly InheritedContextBoundaryPortal[],
  names: readonly InheritedContextNamedAnchor[],
): readonly InheritedContextDiagnostic[] {
  const lineageKeys = new Set(lineage.map(lineageKey));
  if (
    !lineage.some(({ sourceMapId }) => sourceMapId === rootMapId) ||
    !lineage.some(({ sourceMapId }) => sourceMapId === parentMapId)
  ) {
    return [
      diagnostic(
        'invalidReference',
        'sourceLineage',
        'Source lineage must include both the root and direct parent map ownership chain.',
      ),
    ];
  }
  const versionByAspect = new Map(versions.map((version) => [version.sourceAspectId, version]));
  if (
    versions.some((version) => !lineageKeys.has(lineageKey(version))) ||
    [...fields, ...anchors, ...portals, ...names].some((member) => {
      const version = versionByAspect.get(member.sourceAspectId);
      return (
        version?.sourceMapId !== member.sourceMapId ||
        version.sourceEntityId !== member.sourceEntityId ||
        !lineageKeys.has(lineageKey(member))
      );
    })
  ) {
    return [
      diagnostic(
        'invalidReference',
        'members',
        'Every member must resolve through one exact source aspect and declared map/entity lineage record.',
      ),
    ];
  }
  if (
    fields.some(
      (field) =>
        versionByAspect.get(field.sourceAspectId)?.aspectName !==
        expectedFieldAspectName(field.fieldKind),
    ) ||
    anchors.some(
      (anchor) =>
        versionByAspect.get(anchor.sourceAspectId)?.aspectName !==
        expectedAnchorAspectName(anchor.anchorKind),
    ) ||
    portals.some(
      (portal) =>
        versionByAspect.get(portal.sourceAspectId)?.aspectName !==
        expectedPortalAspectName(portal.portalKind),
    ) ||
    names.some(
      (name) => versionByAspect.get(name.sourceAspectId)?.aspectName !== 'worldFeature.nameContent',
    )
  ) {
    return [
      diagnostic(
        'invalidReference',
        'sourceAspectVersions',
        'Clipped members must cite the accepted aspect kind that owns their semantic content.',
      ),
    ];
  }
  return [];
}

function expectedFieldAspectName(fieldKind: InheritedContextField['fieldKind']): string {
  const names: Readonly<Record<InheritedContextField['fieldKind'], string>> = {
    'biome-belts': 'worldEcology.biomeBelts',
    'climate-zones': 'worldClimate.zones',
    'land-water-classification': 'worldSurface.landWaterClassification',
    'macro-elevation': 'worldTerrain.macroElevation',
    moisture: 'worldClimate.moisture',
    'prevailing-winds-direction': 'worldClimate.prevailingWinds',
    'prevailing-winds-speed': 'worldClimate.prevailingWinds',
    temperature: 'worldClimate.temperature',
    'watershed-assignment': 'worldHydrology.watersheds',
  };
  return names[fieldKind];
}

function expectedAnchorAspectName(
  anchorKind: InheritedContextGeometryAnchor['anchorKind'],
): string {
  const names: Readonly<Record<InheritedContextGeometryAnchor['anchorKind'], string>> = {
    'biome-belt': 'worldEcology.biomeBelts',
    coastline: 'worldCoastline.geometry',
    'major-lake': 'worldHydrology.majorLakes',
    'major-river': 'worldHydrology.majorRivers',
    'mountain-system': 'worldTerrain.mountainSystems',
    'watershed-divide': 'worldHydrology.watersheds',
  };
  return names[anchorKind];
}

function expectedPortalAspectName(
  portalKind: InheritedContextBoundaryPortal['portalKind'],
): string {
  const names: Readonly<Record<InheritedContextBoundaryPortal['portalKind'], string>> = {
    coastline: 'worldCoastline.geometry',
    lake: 'worldHydrology.majorLakes',
    'mountain-ridge': 'worldTerrain.mountainSystems',
    river: 'worldHydrology.majorRivers',
    route: 'worldTransport.majorRoutes',
    'watershed-divide': 'worldHydrology.watersheds',
  };
  return names[portalKind];
}

function lineageKey(value: {
  readonly sourceMapId: string;
  readonly sourceEntityId: string;
}): string {
  return `${value.sourceMapId}\n${value.sourceEntityId}`;
}
