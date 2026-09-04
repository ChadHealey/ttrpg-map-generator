import { beforeAll, describe, expect, it } from 'vitest';

import {
  activateAtlasFootprintSelector,
  type AtlasFootprintCandidate,
  selectAtlasFootprintAt,
} from './atlas-footprint-selector.js';
import {
  buildAtlasInheritedContextPreview,
  INHERITED_CONTEXT_PREVIEW_COLLAR_PADDING_MILLIMETERS,
  INHERITED_CONTEXT_PREVIEW_DIAGNOSTIC_CODES,
  isCurrentAtlasInheritedContextPreview,
} from './atlas-inherited-context-preview.js';
import type { AcceptedAtlasState } from './atlas-workflow-generation.js';
import { commitGeneratedAtlas } from './atlas-workflow-generation-integration-test-support.js';

let accepted: AcceptedAtlasState | undefined;

describe('disposable inherited-context preview', () => {
  beforeAll(async () => {
    accepted = await commitGeneratedAtlas('initial-atlas');
  }, 120_000);

  it('builds a provenance-bearing immutable snapshot from accepted names, never placements', () => {
    const source = requiredAccepted();
    const candidate = requiredCandidate(source, { xPx: 1_024, yPx: 512 });
    const documentMaps = source.document.maps;
    const rootAspects = source.document.maps[0]?.aspects;
    const result = buildAtlasInheritedContextPreview(source, candidate);

    if (result.status !== 'built') throw new Error(JSON.stringify(result.diagnostic));
    expect(result.status).toBe('built');
    expect(result.preview.snapshot.footprintId).toBe(candidate.entityId);
    expect(result.preview.snapshot.collar.extent.minXMillimeters).toBe(
      candidate.footprint.extent.minXMillimeters -
        INHERITED_CONTEXT_PREVIEW_COLLAR_PADDING_MILLIMETERS,
    );
    expect(
      result.preview.snapshot.sourceAspectVersions.some(
        ({ aspectName }) => aspectName === 'label.placement',
      ),
    ).toBe(false);
    expect(result.preview.snapshot.namedAnchors.length).toBeGreaterThan(0);
    expect(result.preview.snapshot.fields.every(({ samples }) => samples.length > 0)).toBe(true);
    expect(result.preview.snapshot.sourceLineage.length).toBeGreaterThan(0);
    expect(
      result.preview.snapshot.sourceAspectVersions.every(({ sourceAspectId }) => sourceAspectId),
    ).toBe(true);
    expect(result.preview.snapshot.fields.every(({ sourceAspectId }) => sourceAspectId)).toBe(true);
    expect(
      new Set(
        result.preview.snapshot.fields.map(
          ({ sourceAspectId, fieldKind, component }) =>
            `${sourceAspectId}:${fieldKind}:${component}`,
        ),
      ).size,
    ).toBe(result.preview.snapshot.fields.length);
    expect(
      result.preview.snapshot.geometryAnchors.every(({ sourceAnchorId }) => sourceAnchorId),
    ).toBe(true);
    expect(result.preview.snapshot.boundaryPortals.every(({ portalId }) => portalId)).toBe(true);
    expect(Object.isFrozen(result.preview.snapshot)).toBe(true);
    expect(source.document.maps).toBe(documentMaps);
    expect(source.document.maps[0]?.aspects).toBe(rootAspects);
  }, 30_000);

  it.each([
    ['ordinary', { xPx: 1_024, yPx: 512 }],
    ['seam', { xPx: 2_047, yPx: 300 }],
    ['near-pole', { xPx: 640, yPx: 128 }],
  ] as const)(
    'builds a display-safe overlay for a %s candidate',
    (_caseId, point) => {
      const source = requiredAccepted();
      const candidate = requiredCandidate(source, point);
      const result = buildAtlasInheritedContextPreview(source, candidate);

      if (result.status !== 'built') throw new Error(JSON.stringify(result.diagnostic));
      expect(result.status).toBe('built');
      expect(result.preview.overlayPaths.length).toBeGreaterThan(0);
      for (const path of result.preview.overlayPaths) {
        for (let index = 1; index < path.points.length; index += 1) {
          const prior = path.points[index - 1];
          const point = path.points[index];
          if (prior === undefined || point === undefined)
            throw new Error('Expected an overlay segment.');
          expect(Math.abs(point.xPx - prior.xPx)).toBeLessThanOrEqual(source.scene.widthPx / 2);
        }
      }
    },
    30_000,
  );

  it('rejects missing sources and invalidates snapshots after candidate or atlas replacement', () => {
    const source = requiredAccepted();
    const candidate = requiredCandidate(source, { xPx: 1_024, yPx: 512 });
    const result = buildAtlasInheritedContextPreview(source, candidate);

    expect(buildAtlasInheritedContextPreview(undefined, candidate)).toEqual({
      status: 'invalid',
      diagnostic: {
        code: INHERITED_CONTEXT_PREVIEW_DIAGNOSTIC_CODES.sourceMissing,
        message:
          'Select a footprint on an accepted complete M3 atlas before requesting inherited context.',
      },
    });
    if (result.status !== 'built') throw new Error(JSON.stringify(result.diagnostic));
    expect(result.status).toBe('built');
    expect(isCurrentAtlasInheritedContextPreview(result.preview, source, candidate)).toBe(true);
    expect(
      isCurrentAtlasInheritedContextPreview(
        result.preview,
        Object.freeze({
          ...source,
          document: Object.freeze({
            ...source.document,
            maps: Object.freeze([...source.document.maps]),
          }),
        }),
        candidate,
      ),
    ).toBe(true);
    expect(
      isCurrentAtlasInheritedContextPreview(
        result.preview,
        Object.freeze({ ...source, scene: Object.freeze({ ...source.scene }) }),
        candidate,
      ),
    ).toBe(false);
    expect(
      isCurrentAtlasInheritedContextPreview(
        result.preview,
        source,
        requiredCandidate(source, { xPx: 1_088, yPx: 448 }),
      ),
    ).toBe(false);
    expect(isCurrentAtlasInheritedContextPreview(result.preview, undefined, candidate)).toBe(false);
  }, 30_000);
});

function requiredAccepted(): AcceptedAtlasState {
  if (accepted === undefined) throw new Error('Expected an accepted complete M3 atlas.');
  return accepted;
}

function requiredCandidate(
  accepted: AcceptedAtlasState,
  point: { readonly xPx: number; readonly yPx: number },
): AtlasFootprintCandidate {
  const root = accepted.document.maps.find(({ mapId }) => mapId === accepted.document.rootMapId);
  if (root?.mapKind !== 'world') throw new Error('Expected an accepted root world atlas.');
  const selected = selectAtlasFootprintAt(
    activateAtlasFootprintSelector(accepted.scene),
    {
      rootSurfaceId: root.coordinateSystem.rootSurfaceId,
      worldRadius: root.coordinateSystem.radius,
    },
    accepted.scene,
    point,
  );
  if (selected.candidate === undefined) throw new Error('Expected a valid footprint candidate.');
  return selected.candidate;
}
