/** Stable user-facing descriptions derived from accepted AtlasWorkflow state. */

import type {
  AtlasInspectionEntity,
  AtlasRerollChangeSet,
  AtlasRerollKind,
} from './atlas-workflow.js';
import type { AcceptedAtlasState } from './atlas-workflow-generation.js';

export function atlasRerollChangeSet(kind: AtlasRerollKind): AtlasRerollChangeSet {
  return kind === 'geography'
    ? Object.freeze({
        kind,
        remainsFixed: Object.freeze([
          'world seed and atlas controls',
          'paper treatment and style parameters',
          'document/map/singleton identities',
          'constraints and locks',
        ]),
        changes: Object.freeze([
          'macro elevation revision and output',
          'dependent land/water and semantic classifications',
          'canonical coastline and coastline-dependent ink',
        ]),
      })
    : Object.freeze({
        kind,
        remainsFixed: Object.freeze([
          'all semantic geography records',
          'canonical coastline bytes',
          'world seed, controls, ownership, constraints, and locks',
        ]),
        changes: Object.freeze([
          'coastline appearance revision/output',
          'water decoration revision/output',
          'paper treatment revision/output',
        ]),
      });
}

export function atlasInspectionEntities(
  accepted: AcceptedAtlasState | undefined,
): readonly AtlasInspectionEntity[] {
  if (accepted === undefined) return Object.freeze([]);
  return Object.freeze(
    [
      ...accepted.geography.landmasses.map((landmass) =>
        Object.freeze({
          entityId: landmass.entityId,
          kind: landmass.kind,
          relationshipSummary: `${String(landmass.adjacentWaterBodyIds.length)} adjacent water bodies`,
        }),
      ),
      ...accepted.geography.waterBodies.map((waterBody) =>
        Object.freeze({
          entityId: waterBody.entityId,
          kind: waterBody.kind,
          relationshipSummary: `${waterBody.enclosure}; ${String(waterBody.connectivity.length)} marine links`,
        }),
      ),
    ].sort((left, right) =>
      left.entityId < right.entityId ? -1 : left.entityId > right.entityId ? 1 : 0,
    ),
  );
}
