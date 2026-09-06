/** Bounded investigation checks; binary64 evidence, not formal interval arithmetic. */
import {
  distanceToSegment,
  edges,
  EPS,
  hasEdge,
  isSimplePolygon,
  minBoundaryDistance,
  pointLocation,
  polygonArea,
  samePoint,
  segmentRelation,
  sharedEdge,
  stitchBody,
} from './geometry.mjs';

const SPHERE = 4 * Math.PI;
const SLACK = 1e-9;
const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const pointValid = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
const validRing = (p) =>
  Array.isArray(p) && p.length >= 3 && p.length <= 256 && p.every(pointValid);

/** Any intersection except the explicitly listed shared edges and their endpoints rejects. */
function pairConflict(first, second, allowed = []) {
  const allowedPoints = allowed.flat();
  for (const [a, b] of edges(first)) {
    for (const [c, d] of edges(second)) {
      const relation = segmentRelation(a, b, c, d);
      if (relation === 'none') continue;
      if (
        relation === 'overlap' &&
        allowed.some(([e, f]) => sharedEdge(a, b, e, f) && sharedEdge(c, d, e, f))
      )
        continue;
      const common = [a, b].filter((p) => samePoint(p, c) || samePoint(p, d));
      if (
        relation === 'touch' &&
        common.length === 1 &&
        allowedPoints.some((p) => samePoint(p, common[0]))
      )
        continue;
      return true;
    }
  }
  for (const [ring, other] of [
    [first, second],
    [second, first],
  ]) {
    if (ring.some((p) => pointLocation(p, other) === 1)) return true;
    if (edges(ring).some(([a, b]) => pointLocation(midpoint(a, b), other) === 1)) return true;
  }
  return false;
}

export function certifyCandidate(candidate, { quota, nominalClearance = 0.05 }) {
  const failures = [];
  const fail = (code, featureId, actual, required) =>
    failures.push({ code, featureId, actual, required });
  const metrics = {
    area: null,
    bodyArea: null,
    quotaError: null,
    angularRadius: null,
    guardRadius: null,
    roles: [],
    vertexCount: null,
  };
  const result = () => ({ ok: failures.length === 0, failures, metrics });
  const minimum = (value, target, code, id) => {
    if (!Number.isFinite(value) || value < target + SLACK)
      fail(code, id, value, `>= ${target} with numeric slack`);
  };
  const maximum = (value, target, code, id) => {
    if (!Number.isFinite(value) || value > target - SLACK)
      fail(code, id, value, `<= ${target} with numeric slack`);
  };
  if (
    !candidate ||
    typeof candidate.id !== 'string' ||
    typeof candidate.primary !== 'boolean' ||
    !Array.isArray(candidate.attachments) ||
    candidate.attachments.length > 8 ||
    candidate.attachments.some((a) => !a || typeof a !== 'object') ||
    !Array.isArray(candidate.islands) ||
    candidate.islands.length > 11 ||
    candidate.islands.some((a) => !a || typeof a !== 'object') ||
    !pointValid(candidate.interiorWitness) ||
    !Number.isFinite(quota) ||
    quota <= 0 ||
    quota >= 1 ||
    nominalClearance !== 0.05
  ) {
    fail(
      'invalid-input',
      candidate?.id ?? 'owner',
      null,
      'bounded candidate and positive quota; clearance .05',
    );
    return result();
  }
  const id = candidate.id;
  const named = [
    { id: 'interior', polygon: candidate.interior },
    ...candidate.attachments,
    ...(candidate.bay ? [{ id: 'bay', polygon: candidate.bay.polygon }] : []),
    ...candidate.islands,
    { id: 'body', polygon: candidate.bodyBoundary },
  ];
  if (
    named.some((p) => !validRing(p.polygon)) ||
    candidate.attachments.some(
      (a) =>
        typeof a.id !== 'string' ||
        !['lobe', 'peninsula'].includes(a.kind) ||
        !Array.isArray(a.root) ||
        a.root.length !== 2 ||
        !a.root.every(pointValid) ||
        !Number.isFinite(a.collarHeight) ||
        a.collarHeight <= 0,
    ) ||
    candidate.islands.some(
      (a) => typeof a.id !== 'string' || !['island', 'archipelago'].includes(a.kind),
    ) ||
    (candidate.bay &&
      (!Array.isArray(candidate.bay.mouth) ||
        candidate.bay.mouth.length !== 2 ||
        !candidate.bay.mouth.every(pointValid) ||
        !pointValid(candidate.bay.witness)))
  ) {
    fail('invalid-geometry', id, null, 'finite polygons, roots and witnesses');
    return result();
  }
  const featureIds = [
    id,
    ...candidate.attachments.map((a) => a.id),
    ...candidate.islands.map((a) => a.id),
  ];
  if (new Set(featureIds).size !== featureIds.length)
    fail('duplicate-id', id, featureIds, 'unique stable feature IDs');
  const points = named.flatMap((p) => p.polygon);
  metrics.vertexCount = new Set(points.map((p) => `${p[0]},${p[1]}`)).size;
  if (metrics.vertexCount > 256)
    fail('vertex-budget', id, metrics.vertexCount, '<= 256 unique boundary vertices');
  for (const p of named)
    if (!isSimplePolygon(p.polygon))
      fail('non-simple-polygon', p.id, null, 'simple nondegenerate ring');
  const radius = Math.max(...points.map((p) => Math.hypot(...p)));
  if (radius >= 2) fail('chart-domain', id, radius, 'all chart radii < 2');
  if (failures.length) return result();
  metrics.angularRadius = 2 * Math.asin(radius / 2);
  metrics.guardRadius = metrics.angularRadius + nominalClearance;
  if (metrics.guardRadius + 0.02 >= Math.PI)
    fail('chart-extension', id, metrics.guardRadius, 'guard+.02 < pi');
  const c = Math.cos(metrics.angularRadius / 2);
  const bodyPlanar =
    polygonArea(candidate.interior) +
    candidate.attachments.reduce((s, a) => s + polygonArea(a.polygon), 0);
  metrics.bodyArea = bodyPlanar / SPHERE;
  metrics.area =
    metrics.bodyArea + candidate.islands.reduce((s, a) => s + polygonArea(a.polygon) / SPHERE, 0);
  if (metrics.area - metrics.bodyArea > quota)
    fail('island-floor', id, metrics.area - metrics.bodyArea, `<= owner quota ${quota}`);
  metrics.quotaError = metrics.area - quota;
  if (Math.abs(metrics.quotaError) > 1e-12)
    fail('quota-residual', id, metrics.quotaError, '|binary64 residual| <= 1e-12');
  try {
    const expected = stitchBody(candidate.interior, candidate.attachments);
    if (
      expected.length !== candidate.bodyBoundary.length ||
      edges(expected).some(([a, b]) => !hasEdge(candidate.bodyBoundary, a, b))
    )
      fail('body-boundary-mismatch', id, null, 'stitched declared role union');
  } catch {
    fail('body-topology', id, null, 'one simple stitched body');
  }
  const interiorRadius = c * minBoundaryDistance(candidate.interiorWitness, candidate.interior);
  if (pointLocation(candidate.interiorWitness, candidate.interior) !== 1)
    fail('interior-witness', id, candidate.interiorWitness, 'strictly inside surviving B');
  minimum(interiorRadius, candidate.primary ? 0.15 : 0.075, 'interior-radius', id);
  const interiorShare = polygonArea(candidate.interior) / bodyPlanar;
  if (candidate.primary) minimum(interiorShare, 0.55, 'interior-share', id);
  metrics.interior = {
    radiusLower: interiorRadius,
    area: polygonArea(candidate.interior) / SPHERE,
    share: interiorShare,
  };
  for (const attachment of candidate.attachments) {
    const [a, b] = attachment.root;
    if (
      !hasEdge(candidate.interior, a, b) ||
      !hasEdge(attachment.polygon, a, b) ||
      pairConflict(candidate.interior, attachment.polygon, [[a, b]])
    )
      fail(
        'attachment-topology',
        attachment.id,
        null,
        'one shared B root and otherwise disjoint interiors',
      );
    const w = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (w <= EPS) {
      fail('root-degenerate', attachment.id, w, 'positive root');
      continue;
    }
    const middle = midpoint(a, b),
      h = attachment.collarHeight;
    let normal = [(b[1] - a[1]) / w, -(b[0] - a[0]) / w];
    const probe = [middle[0] + (normal[0] * h) / 2, middle[1] + (normal[1] * h) / 2];
    if (pointLocation(probe, attachment.polygon) !== 1) normal = normal.map((v) => -v);
    const firstDisk = [middle[0] + normal[0] * h, middle[1] + normal[1] * h];
    const corner = (p) => [p[0] + normal[0] * h, p[1] + normal[1] * h];
    const cornerAt = (p) =>
      attachment.polygon.find((v) => Math.hypot(v[0] - corner(p)[0], v[1] - corner(p)[1]) <= EPS);
    const endA = cornerAt(a),
      endB = cornerAt(b);
    if (
      !endA ||
      !endB ||
      !hasEdge(attachment.polygon, a, endA) ||
      !hasEdge(attachment.polygon, b, endB)
    )
      fail('collar-coast', attachment.id, null, 'two exposed rectangular collar sides');
    if (
      attachment.polygon.some(
        (p) =>
          ![a, b, endA, endB].some((v) => v && samePoint(p, v)) &&
          (p[0] - middle[0]) * normal[0] + (p[1] - middle[1]) * normal[1] < h + SLACK,
      )
    )
      fail(
        'head-enters-collar',
        attachment.id,
        null,
        'all nonbase head vertices strictly beyond collar',
      );
    const requiredWidth = attachment.kind === 'lobe' ? 0.1 : 0.08;
    const diskRadius = c * minBoundaryDistance(firstDisk, attachment.polygon);
    if (
      pointLocation(firstDisk, attachment.polygon) !== 1 ||
      diskRadius < requiredWidth / 2 + SLACK
    )
      fail(
        'first-disk',
        attachment.id,
        diskRadius,
        `>= ${requiredWidth / 2} inside declared feature`,
      );
    const widthLower = c * (w - 2 * EPS),
      widthUpper = (w + 2 * EPS) / c;
    minimum(widthLower, requiredWidth, 'attachment-width', attachment.id);
    const role = {
      id: attachment.id,
      kind: attachment.kind,
      area: polygonArea(attachment.polygon) / SPHERE,
      share: polygonArea(attachment.polygon) / bodyPlanar,
      widthLower,
      widthUpper,
      firstDiskRadiusLower: diskRadius,
    };
    if (attachment.kind === 'peninsula') {
      const extent = Math.max(...attachment.polygon.map((p) => distanceToSegment(p, a, b)));
      role.extentLower = c * extent;
      role.extentUpper = extent / c;
      role.extentWidthRatioLower = role.extentLower / widthUpper;
      minimum(role.extentLower, 0.2, 'peninsula-extent-min', attachment.id);
      maximum(role.extentUpper, 0.45, 'peninsula-extent-max', attachment.id);
      maximum(widthUpper, 0.16, 'peninsula-width-max', attachment.id);
      minimum(role.extentWidthRatioLower, 2, 'peninsula-ratio', attachment.id);
    }
    metrics.roles.push(role);
  }
  for (let i = 0; i < candidate.attachments.length; i++)
    for (let j = i + 1; j < candidate.attachments.length; j++) {
      if (pairConflict(candidate.attachments[i].polygon, candidate.attachments[j].polygon))
        fail(
          'role-overlap',
          candidate.attachments[j].id,
          candidate.attachments[i].id,
          'disjoint exteriors with distinct roots',
        );
    }
  const lobes = metrics.roles.filter((a) => a.kind === 'lobe'),
    peninsulas = metrics.roles.filter((a) => a.kind === 'peninsula');
  if (candidate.primary) {
    if (lobes.length < 2) fail('missing-lobes', id, lobes.length, '>= 2 declared lobes');
    else {
      for (const lobe of lobes.slice(0, 2)) minimum(lobe.share, 0.08, 'lobe-share', lobe.id);
      minimum(lobes[0].share + lobes[1].share, 0.2, 'lobe-share-sum', id);
      minimum(
        Math.max(lobes[0].area, lobes[1].area) / Math.min(lobes[0].area, lobes[1].area),
        1.5,
        'lobe-ratio',
        id,
      );
    }
    if (!peninsulas.length) fail('missing-peninsula', id, 0, '>= 1 declared peninsula');
    else minimum(peninsulas[0].share, 0.05, 'peninsula-share', peninsulas[0].id);
    if (!candidate.bay) fail('missing-bay', id, null, 'declared protected bay');
  }
  if (candidate.bay) {
    const bay = candidate.bay,
      [a, b] = bay.mouth;
    const ra = Math.hypot(...a),
      rb = Math.hypot(...b);
    const mouthEdges = edges(bay.polygon).filter(([e, f]) => !sharedEdge(a, b, e, f));
    if (
      !hasEdge(bay.polygon, a, b) ||
      mouthEdges.some(([e, f]) => !hasEdge(candidate.interior, e, f)) ||
      pairConflict(candidate.interior, bay.polygon, mouthEdges)
    )
      fail('bay-coast', 'bay', null, 'all nonmouth edges coincide with surviving B coast');
    if (ra <= EPS || rb <= EPS || a[0] * b[1] - a[1] * b[0] !== 0 || a[0] * b[0] + a[1] * b[1] <= 0)
      fail('bay-mouth-not-radial', 'bay', null, 'distinct shoulders on one radial ray');
    const opening = Math.abs(2 * Math.asin(ra / 2) - 2 * Math.asin(rb / 2));
    const depthLower = c * distanceToSegment(bay.witness, a, b);
    const removedArea = polygonArea(bay.polygon) / SPHERE;
    metrics.bay = {
      opening,
      depthLower,
      removedArea,
      removedBodyShare: removedArea / metrics.bodyArea,
    };
    minimum(opening, 0.12, 'bay-opening-min', 'bay');
    maximum(opening, 0.3, 'bay-opening-max', 'bay');
    minimum(depthLower, 0.15, 'bay-depth', 'bay');
    minimum(depthLower / opening, 0.5, 'bay-ratio', 'bay');
    if (candidate.primary)
      minimum(removedArea / metrics.bodyArea, 0.02, 'bay-removed-share', 'bay');
    if (
      pointLocation(bay.witness, bay.polygon) !== 1 ||
      pointLocation(bay.witness, candidate.interior) !== -1
    )
      fail('bay-witness', 'bay', bay.witness, 'strictly inside protected pocket and outside B');
    try {
      const before = stitchBody(candidate.interior, [{ polygon: bay.polygon }]);
      if (
        Math.abs(polygonArea(before) - polygonArea(candidate.interior) - polygonArea(bay.polygon)) >
        1e-12
      )
        fail('bay-precut-area', 'bay', null, 'simple pre-cut B0=B union E');
    } catch {
      fail('bay-precut-topology', 'bay', null, 'one simple pre-cut interior');
    }
    for (const attachment of candidate.attachments)
      if (pairConflict(bay.polygon, attachment.polygon))
        fail(
          'water-intrusion',
          attachment.id,
          'bay',
          'protected bay disjoint from every positive term',
        );
  }
  for (let i = 0; i < candidate.islands.length; i++) {
    const island = candidate.islands[i];
    if (pairConflict(candidate.bodyBoundary, island.polygon))
      fail('island-body-contact', island.id, null, 'detached from body');
    if (candidate.bay && pairConflict(candidate.bay.polygon, island.polygon))
      fail('water-intrusion', island.id, 'bay', 'protected bay');
    for (let j = 0; j < i; j++)
      if (pairConflict(candidate.islands[j].polygon, island.polygon))
        fail('island-contact', island.id, candidate.islands[j].id, 'disjoint retained components');
  }
  return result();
}
