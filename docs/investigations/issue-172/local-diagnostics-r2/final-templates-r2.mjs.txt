/** Investigation-only direct authoritative coast polygons with internal role witnesses. */
import { stream } from '../issue-164/morphology.mjs';
import {
  edges,
  pointLocation,
  polygonArea,
  segmentRelation,
  stitchBody,
} from '../issue-169/geometry.mjs';
import { controlRecipe } from '../issue-170/templates.mjs';
import { certifyCandidate } from './certificates.mjs';
import { add, cubic } from './coast-utils.mjs';
import { buildCoast as buildA } from './layout-r2-a.mjs';
import { buildCoast as buildB } from './layout-r2-b.mjs';
import { buildCoast as buildC } from './layout-r2-c.mjs';
export { controlRecipe };
export const TEMPLATE_REVISION = 'issue-172-continuous-r2';
export const TEMPLATE_LIMIT = 12;
export const BALANCED_GUARD_CEILING = (Math.PI / 2 - 0.05) / 2;
function mapCandidate(candidate, point) {
  const poly = (p) => p.map(point);
  return {
    ...candidate,
    interior: poly(candidate.interior),
    interiorWitness: point(candidate.interiorWitness),
    bodyBoundary: poly(candidate.bodyBoundary),
    attachments: candidate.attachments.map((a) => ({
      ...a,
      root: poly(a.root),
      polygon: poly(a.polygon),
      collar: { far: poly(a.collar.far), disk: point(a.collar.disk) },
    })),
    bay: candidate.bay
      ? {
          polygon: poly(candidate.bay.polygon),
          mouth: poly(candidate.bay.mouth),
          witness: point(candidate.bay.witness),
        }
      : null,
    islands: [],
    islandAnchorEdges: candidate.islandAnchorEdges?.map(poly),
  };
}
const scaleCandidate = (candidate, scale) =>
  mapCandidate(candidate, (p) => p.map((x) => x * scale));
function conflict(a, b) {
  return (
    edges(a).some(([p, q]) => edges(b).some(([r, s]) => segmentRelation(p, q, r, s) !== 'none')) ||
    a.some((p) => pointLocation(p, b) >= 0) ||
    b.some((p) => pointLocation(p, a) >= 0)
  );
}
const ISLAND_SHAPES = Object.freeze([
  [
    [-0.75, -0.36],
    [-0.18, -0.71],
    [0.57, -0.48],
    [0.78, 0.08],
    [0.24, 0.63],
    [-0.56, 0.48],
  ],
  [
    [-0.68, -0.43],
    [0.09, -0.57],
    [0.61, -0.26],
    [0.53, 0.29],
    [0.13, 0.68],
    [-0.43, 0.5],
    [-0.76, 0.04],
  ],
  [
    [-0.58, -0.66],
    [0.14, -0.49],
    [0.64, -0.09],
    [0.47, 0.5],
    [-0.11, 0.63],
    [-0.72, 0.15],
  ],
]);
function islandPolygon(area, angle, shapeIndex) {
  const raw = ISLAND_SHAPES[shapeIndex];
  const s = Math.sqrt(area / polygonArea(raw)),
    cs = Math.cos(angle),
    sn = Math.sin(angle);
  return raw.map(([x, y]) => [s * (cs * x - sn * y), s * (sn * x + cs * y)]);
}
export function constructTemplate({
  id = 'owner-0',
  primary = true,
  quota,
  recipe,
  seed = '1',
  templateIndex = 0,
}) {
  if (
    typeof seed !== 'string' ||
    !seed ||
    typeof id !== 'string' ||
    !id ||
    typeof primary !== 'boolean' ||
    !Number.isFinite(quota) ||
    quota <= 0 ||
    quota >= 1 ||
    !Number.isInteger(templateIndex) ||
    templateIndex < 0 ||
    templateIndex >= TEMPLATE_LIMIT
  )
    throw new RangeError('Invalid direct template input');
  if (
    !recipe ||
    !Number.isInteger(recipe.fragmentationBand) ||
    recipe.fragmentationBand < 0 ||
    recipe.fragmentationBand > 3 ||
    !Number.isFinite(recipe.polarStretch) ||
    ![0.96, 1, 1.04].includes(recipe.polarStretch) ||
    !Number.isInteger(recipe.islandCount) ||
    recipe.islandCount < 0 ||
    recipe.islandCount > 4 ||
    !Number.isInteger(recipe.archipelagoCount) ||
    recipe.archipelagoCount < 0 ||
    recipe.archipelagoCount > 7 ||
    !Number.isFinite(recipe.islandShare) ||
    recipe.islandShare < 0 ||
    recipe.islandShare > 0.02 ||
    !Number.isFinite(recipe.archipelagoShare) ||
    recipe.archipelagoShare < 0 ||
    recipe.archipelagoShare > 0.01 ||
    (recipe.islandCount === 0) !== (recipe.islandShare === 0) ||
    (recipe.archipelagoCount === 0) !== (recipe.archipelagoShare === 0)
  )
    throw new RangeError('Invalid direct template recipe');
  const random = stream(seed, `issue-172-r2/anatomy/${id}`),
    first = Math.floor(random() * 3),
    anatomy = [2 * random() - 1, 2 * random() - 1];
  const layoutIndex = (first + Math.floor(templateIndex / 4)) % 3,
    variation = templateIndex % 4;
  let { interior, interiorWitness, attachments, bay, islandAnchorEdges } = [buildA, buildB, buildC][
    layoutIndex
  ](id, { fragmentationBand: recipe.fragmentationBand, variation, seed, anatomy });
  if (!primary) {
    const anchors = [
      [0.56, 0.08],
      [0.4, 0.4],
      [-0.1, 0.55],
      [-0.5, 0.3],
      [-0.6, -0.1],
      [-0.27, -0.5],
      [0.23, -0.49],
    ];
    interior = [];
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i],
        b = anchors[(i + 1) % anchors.length],
        prev = anchors[(i + 6) % 7],
        next = anchors[(i + 2) % 7];
      interior.push(
        ...cubic(a, add(a, add(b, prev, -1), 0.14), add(b, add(next, a, -1), -0.14), b, 5),
      );
    }
    attachments = [];
    bay = null;
  }
  let candidate = {
    id,
    primary,
    layoutIndex,
    variation,
    anatomy,
    interior,
    interiorWitness,
    attachments,
    bay,
    islandAnchorEdges: primary ? islandAnchorEdges : undefined,
    islands: [],
    bodyBoundary: stitchBody(interior, attachments),
  };
  candidate = mapCandidate(candidate, ([x, y]) => [x, y * recipe.polarStretch]);
  const bodyArea = polygonArea(candidate.bodyBoundary),
    f = recipe.islandShare + recipe.archipelagoShare;
  const fitted = scaleCandidate(candidate, Math.sqrt((4 * Math.PI * (1 - f) * quota) / bodyArea));
  const siteRadiusLimit =
    Math.max(...fitted.bodyBoundary.map((p) => Math.hypot(...p))) +
    [0, 0.025, 0.05, 0.09][variation];
  // Six localized actual coast edges and four outward offsets, all chosen before certification.
  const coast = edges(fitted.bodyBoundary),
    lower = coast.filter(([a, b]) => a[1] < -0.2 && b[1] < -0.2 && Math.max(a[0], b[0]) < 0.25);
  const lengths = lower.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1])),
    totalLength = lengths.reduce((a, b) => a + b, 0);
  const anchors =
    fitted.islandAnchorEdges ??
    [0.03, 0.2, 0.39, 0.59, 0.77, 0.97].map((t) => {
      let distance = t * totalLength;
      for (let i = 0; i < lower.length; i++) {
        if (distance <= lengths[i]) return lower[i];
        distance -= lengths[i];
      }
      return lower.at(-1);
    });
  const siteReceipts = [];
  for (const [kind, count, share] of [
    ['island', recipe.islandCount, recipe.islandShare],
    ['archipelago', recipe.archipelagoCount, recipe.archipelagoShare],
  ]) {
    const weights = Array.from({ length: count }, (_, i) => 1 / (1 + i * 1.2) ** 1.4),
      total = weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < count; i++) {
      const area = (4 * Math.PI * quota * share * weights[i]) / total;
      const memberRandom = stream(
          seed,
          `issue-172-r2/island-sites/${id}/${kind}-${i}/layout-${layoutIndex}/variant-${variation}`,
        ),
        start = Math.floor(memberRandom() * 6),
        direction = memberRandom() < 0.5 ? 1 : 5,
        angle = memberRandom() * 2 * Math.PI,
        shapeIndex = Math.floor(memberRandom() * ISLAND_SHAPES.length);
      let placed;
      for (let j = 0; j < 24; j++) {
        const [a, b] = anchors[(start + direction * Math.floor(j / 4)) % 6],
          w = Math.hypot(b[0] - a[0], b[1] - a[1]),
          n = [(b[1] - a[1]) / w, -(b[0] - a[0]) / w],
          offset = [0.015, 0.035, 0.065, 0.1][j % 4];
        const shape = islandPolygon(area, angle, shapeIndex),
          bound = Math.max(...shape.map((p) => Math.hypot(...p)));
        const center = add([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], n, bound + offset),
          polygon = shape.map((p) => add(center, p));
        if (
          polygon.every((p) => Math.hypot(...p) <= siteRadiusLimit) &&
          !conflict(polygon, fitted.bodyBoundary) &&
          (!fitted.bay || !conflict(polygon, fitted.bay.polygon)) &&
          fitted.islands.every((p) => !conflict(polygon, p.polygon))
        ) {
          placed = { id: `${id}/${kind}-${i}`, kind, polygon };
          siteReceipts.push({
            id: placed.id,
            attempt: j + 1,
            anchor: (start + direction * Math.floor(j / 4)) % 6,
            offset,
            shapeIndex,
            angle,
          });
          break;
        }
      }
      if (!placed)
        throw Object.assign(new Error(`island-site-budget-exhausted:${kind}-${i}`), {
          siteReceipts,
        });
      fitted.islands.push(placed);
    }
  }
  return { ...fitted, siteReceipts };
}
export function constructOwners(input) {
  let recipe;
  try {
    if (typeof input?.seed !== 'string' || !input.seed) throw new Error('Invalid seed');
    recipe = controlRecipe(input.controls);
  } catch (error) {
    return {
      ok: false,
      owners: [],
      failures: [{ code: 'invalid-input', message: error.message }],
      receipts: [],
    };
  }
  const count = recipe.ownerCount,
    primaryCount = Math.min(count, 1 + Math.floor(stream(input.seed, 'primary-count')() * 3));
  const sizes = Array.from({ length: count }, (_, i) =>
      recipe.distribution === 'balanced'
        ? 0.9
        : recipe.distribution === 'oneDominant'
          ? i === 0
            ? 1
            : 0.55
          : i < primaryCount
            ? 0.95
            : 0.55,
    ),
    sum = sizes.reduce((s, x) => s + x * x, 0),
    owners = [],
    failures = [],
    receipts = [];
  for (let i = 0; i < count; i++) {
    const id = `owner-${i}`,
      quota = (recipe.landFraction * sizes[i] ** 2) / sum,
      primary = sizes[i] ** 2 >= Math.max(...sizes) ** 2 * 0.5;
    let accepted;
    for (let index = 0; index < TEMPLATE_LIMIT; index++) {
      let candidate, certificate;
      try {
        candidate = constructTemplate({
          id,
          primary,
          quota,
          recipe,
          seed: input.seed,
          templateIndex: index,
        });
        certificate = certifyCandidate(candidate, { quota, nominalClearance: 0.05 });
      } catch (error) {
        certificate = {
          ok: false,
          failures: [
            {
              code: 'construction',
              message: error.message,
              ...(error.siteReceipts ? { siteReceipts: error.siteReceipts } : {}),
            },
          ],
        };
      }
      const selectionFailures =
        certificate.ok &&
        recipe.distribution === 'balanced' &&
        count === 6 &&
        certificate.metrics.guardRadius > BALANCED_GUARD_CEILING
          ? [
              {
                code: 'balanced-guard-preference',
                actual: certificate.metrics.guardRadius,
                maximum: BALANCED_GUARD_CEILING,
              },
            ]
          : [];
      const selected = certificate.ok && selectionFailures.length === 0;
      receipts.push({
        ownerId: id,
        quota,
        templateIndex: index,
        ok: selected,
        certificateOk: certificate.ok,
        failures: [...certificate.failures, ...selectionFailures],
      });
      if (selected) {
        accepted = {
          id,
          quota,
          primary,
          size: sizes[i],
          radius: certificate.metrics.guardRadius,
          candidate,
          certificate,
        };
        break;
      }
    }
    if (accepted) owners.push(accepted);
    else
      failures.push({
        code: 'template-budget-exhausted',
        ownerId: id,
        quota,
        candidateCount: TEMPLATE_LIMIT,
      });
  }
  return { ok: !failures.length, owners, failures, receipts, recipe, revision: TEMPLATE_REVISION };
}
