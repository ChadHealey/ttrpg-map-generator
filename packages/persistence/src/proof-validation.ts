import {
  type AcceptedAspectRecord,
  deriveStableId,
  type EntityId,
  parseSemanticKey,
  type PlanetPoint,
  type WorldDocument,
} from '@ttrpg-map/core';

import {
  PROOF_MARKER_ASPECT_ID_TEXT,
  PROOF_OUTLINE_ASPECT_ID_TEXT,
} from './accepted-aspect-dto-schema.js';
import { persistenceDiagnostic } from './persistence-diagnostics.js';
import { PERSISTENCE_DIAGNOSTIC_CODES, type PersistenceDiagnostic } from './persistence-model.js';

interface ProofOutlineOutput {
  readonly points: readonly PlanetPoint[];
}

interface ProofMarkerOutput {
  readonly markers: readonly {
    readonly markerId: EntityId;
    readonly position: PlanetPoint;
  }[];
}

export function validateProofRecords(document: WorldDocument): readonly PersistenceDiagnostic[] {
  const diagnostics: PersistenceDiagnostic[] = [];
  for (const map of document.maps) {
    const outline = map.aspects.find((aspect) => aspect.aspectId === PROOF_OUTLINE_ASPECT_ID_TEXT);
    const markers = map.aspects.find((aspect) => aspect.aspectId === PROOF_MARKER_ASPECT_ID_TEXT);
    if (outline !== undefined) validateOutline(outline, diagnostics);
    if (markers !== undefined) validateMarkers(markers, outline, diagnostics);
  }
  return Object.freeze(diagnostics);
}

function validateOutline(aspect: AcceptedAspectRecord, diagnostics: PersistenceDiagnostic[]): void {
  const output = aspect.acceptedOutput as ProofOutlineOutput;
  const points = output.points;
  const isClosed = pointsEqual(points[0], points.at(-1));
  const isCounterclockwise = signedAreaTwice(points) > 0n;
  const isSimple = isSimpleClosedPolygon(points);
  if (points.length !== 9 || !isClosed || !isCounterclockwise || !isSimple) {
    diagnostics.push(
      proofDiagnostic(
        aspect,
        '$.acceptedOutput.points',
        'The proof outline must be a closed, simple, counterclockwise eight-edge polygon.',
      ),
    );
  }
}

function validateMarkers(
  aspect: AcceptedAspectRecord,
  outline: AcceptedAspectRecord | undefined,
  diagnostics: PersistenceDiagnostic[],
): void {
  const output = aspect.acceptedOutput as ProofMarkerOutput;
  const dependency = aspect.dependencyAspects[0];
  if (
    outline?.entityId !== aspect.entityId ||
    dependency?.aspectId !== PROOF_OUTLINE_ASPECT_ID_TEXT ||
    dependency.contextProvenance !== undefined
  ) {
    diagnostics.push(
      proofDiagnostic(
        aspect,
        '$.dependencyAspects',
        'The proof markers must depend on the accepted proof outline in the same map and entity.',
      ),
    );
    return;
  }

  const outlinePoints = (outline.acceptedOutput as ProofOutlineOutput).points;
  const expectedIds = markerIds(aspect.entityId);
  const actualIds = output.markers.map(({ markerId }) => markerId);
  const hasExpectedIds =
    actualIds.length === expectedIds.length &&
    actualIds.every((markerId, index) => markerId === expectedIds[index]);
  const areInside = output.markers.every(({ position }) =>
    isStrictlyInsidePolygon(position, outlinePoints),
  );
  if (!hasExpectedIds || !areInside) {
    diagnostics.push(
      proofDiagnostic(
        aspect,
        '$.acceptedOutput.markers',
        'Proof markers must retain the nine canonical marker IDs in order and lie strictly inside the accepted outline.',
      ),
    );
  }
}

function markerIds(entityId: EntityId): readonly EntityId[] {
  const ids: EntityId[] = [];
  for (let index = 0; index < 9; index += 1) {
    const key = parseSemanticKey(`marker-${String(index).padStart(3, '0')}`);
    if (!key.ok) return [];
    ids.push(deriveStableId('entity', entityId, key.value));
  }
  return ids.sort(compareText);
}

function signedAreaTwice(points: readonly PlanetPoint[]): bigint {
  let area = 0n;
  for (let index = 0; index + 1 < points.length; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    if (current === undefined || next === undefined) return 0n;
    area +=
      BigInt(current.longitudeTicks) * BigInt(next.latitudeTicks) -
      BigInt(next.longitudeTicks) * BigInt(current.latitudeTicks);
  }
  return area;
}

function isSimpleClosedPolygon(points: readonly PlanetPoint[]): boolean {
  const edgeCount = points.length - 1;
  if (edgeCount < 3) return false;
  for (let left = 0; left < edgeCount; left += 1) {
    const leftStart = points[left];
    const leftEnd = points[left + 1];
    if (leftStart === undefined || leftEnd === undefined || pointsEqual(leftStart, leftEnd)) {
      return false;
    }
    for (let right = left + 1; right < edgeCount; right += 1) {
      const areAdjacent = right === left + 1 || (left === 0 && right === edgeCount - 1);
      if (areAdjacent) continue;
      const rightStart = points[right];
      const rightEnd = points[right + 1];
      if (
        rightStart === undefined ||
        rightEnd === undefined ||
        segmentsIntersect(leftStart, leftEnd, rightStart, rightEnd)
      ) {
        return false;
      }
    }
  }
  return true;
}

function segmentsIntersect(
  firstStart: PlanetPoint,
  firstEnd: PlanetPoint,
  secondStart: PlanetPoint,
  secondEnd: PlanetPoint,
): boolean {
  const firstA = orientation(firstStart, firstEnd, secondStart);
  const firstB = orientation(firstStart, firstEnd, secondEnd);
  const secondA = orientation(secondStart, secondEnd, firstStart);
  const secondB = orientation(secondStart, secondEnd, firstEnd);
  return (
    (firstA === 0n && onSegment(secondStart, firstStart, firstEnd)) ||
    (firstB === 0n && onSegment(secondEnd, firstStart, firstEnd)) ||
    (secondA === 0n && onSegment(firstStart, secondStart, secondEnd)) ||
    (secondB === 0n && onSegment(firstEnd, secondStart, secondEnd)) ||
    (oppositeSigns(firstA, firstB) && oppositeSigns(secondA, secondB))
  );
}

function isStrictlyInsidePolygon(point: PlanetPoint, polygon: readonly PlanetPoint[]): boolean {
  let windingNumber = 0;
  for (let index = 0; index + 1 < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[index + 1];
    if (start === undefined || end === undefined || onSegment(point, start, end)) return false;
    const turn = orientation(start, end, point);
    if (start.latitudeTicks <= point.latitudeTicks) {
      if (end.latitudeTicks > point.latitudeTicks && turn > 0n) windingNumber += 1;
    } else if (end.latitudeTicks <= point.latitudeTicks && turn < 0n) {
      windingNumber -= 1;
    }
  }
  return windingNumber !== 0;
}

function orientation(start: PlanetPoint, end: PlanetPoint, point: PlanetPoint): bigint {
  return (
    BigInt(end.longitudeTicks - start.longitudeTicks) *
      BigInt(point.latitudeTicks - start.latitudeTicks) -
    BigInt(end.latitudeTicks - start.latitudeTicks) *
      BigInt(point.longitudeTicks - start.longitudeTicks)
  );
}

function onSegment(point: PlanetPoint, start: PlanetPoint, end: PlanetPoint): boolean {
  return (
    orientation(start, end, point) === 0n &&
    point.longitudeTicks >= Math.min(start.longitudeTicks, end.longitudeTicks) &&
    point.longitudeTicks <= Math.max(start.longitudeTicks, end.longitudeTicks) &&
    point.latitudeTicks >= Math.min(start.latitudeTicks, end.latitudeTicks) &&
    point.latitudeTicks <= Math.max(start.latitudeTicks, end.latitudeTicks)
  );
}

function pointsEqual(left: PlanetPoint | undefined, right: PlanetPoint | undefined): boolean {
  return (
    left !== undefined &&
    left.longitudeTicks === right?.longitudeTicks &&
    left.latitudeTicks === right.latitudeTicks
  );
}

function oppositeSigns(left: bigint, right: bigint): boolean {
  return (left < 0n && right > 0n) || (left > 0n && right < 0n);
}

function proofDiagnostic(
  aspect: AcceptedAspectRecord,
  fieldPath: string,
  message: string,
): PersistenceDiagnostic {
  return persistenceDiagnostic(
    PERSISTENCE_DIAGNOSTIC_CODES.proofInvalid,
    `maps/${aspect.mapId}.json`,
    `$.aspects[${JSON.stringify(aspect.aspectId)}]${fieldPath.slice(1)}`,
    message,
    'Restore the accepted Milestone 1 proof record from a valid package.',
  );
}

function compareText(left: string, right: string): -1 | 0 | 1 {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
