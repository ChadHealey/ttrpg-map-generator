/** Finite, investigation-only explicit anatomy. All fitting precedes placement. */
import { stream } from '../issue-164/morphology.mjs';
import { certifyCandidate } from './certificates.mjs';
import { polygonArea, scaleCandidate, stitchBody } from './geometry.mjs';

export const TEMPLATE_REVISION = 'issue-169-explicit-r1';
export const TEMPLATE_LIMIT = 8;
// Each row gives root width, collar height and terminal-head lateral expansion.
export const TEMPLATE_TABLE = Object.freeze([
  [0.12, 0.065, 2.25],
  [0.115, 0.065, 2.5],
  [0.125, 0.07, 2.2],
  [0.11, 0.065, 2.6],
  [0.13, 0.07, 2.1],
  [0.12, 0.075, 2.5],
  [0.115, 0.07, 2.8],
  [0.125, 0.065, 2.5],
]);
export function controlRecipe(controls) {
  const c = controls;
  const percents = [
    'targetWaterCoveragePercent',
    'fragmentationPercent',
    'islandAbundancePercent',
    'archipelagoAbundancePercent',
  ];
  if (
    !Number.isInteger(c.worldCircumferenceKm) ||
    c.worldCircumferenceKm < 10000 ||
    c.worldCircumferenceKm > 80000 ||
    c.worldCircumferenceKm % 1000 !== 0 ||
    !Number.isInteger(c.continentCountIntent) ||
    c.continentCountIntent < 1 ||
    c.continentCountIntent > 8 ||
    percents.some((key) => !Number.isInteger(c[key]) || c[key] < 0 || c[key] > 100) ||
    c.targetWaterCoveragePercent < 45 ||
    c.targetWaterCoveragePercent > 80 ||
    !['balanced', 'varied', 'oneDominant'].includes(c.continentDistribution) ||
    !['singleGlobal', 'connectedMajority', 'multipleBasins'].includes(c.oceanConnectivity) ||
    !['neutral', 'landBiased', 'oceanBiased'].includes(c.polarCharacter)
  )
    throw new RangeError('Invalid controls');
  return {
    physicalKmPerRadian: c.worldCircumferenceKm / (2 * Math.PI),
    landFraction: 1 - c.targetWaterCoveragePercent / 100,
    ownerCount: c.continentCountIntent,
    distribution: c.continentDistribution,
    fragmentationBand: Math.min(3, Math.floor(c.fragmentationPercent / 26)),
    islandCount: c.islandAbundancePercent === 0 ? 0 : Math.ceil(c.islandAbundancePercent / 25),
    archipelagoCount:
      c.archipelagoAbundancePercent === 0
        ? 0
        : Math.max(2, Math.ceil(c.archipelagoAbundancePercent / 15)),
    islandShare: (c.islandAbundancePercent / 100) * 0.04,
    archipelagoShare: (c.archipelagoAbundancePercent / 100) * 0.04,
    oceanConnectivity: c.oceanConnectivity,
    polarCharacter: c.polarCharacter,
    // Finite local outline change, paid before normalization. No scalar polar override.
    polarStretch:
      c.polarCharacter === 'landBiased' ? 1.04 : c.polarCharacter === 'oceanBiased' ? 0.96 : 1,
  };
}
function attachment(id, kind, root, area, collarHeight, expansion) {
  const [a, b] = root,
    w = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const t = [(b[0] - a[0]) / w, (b[1] - a[1]) / w],
    n = [t[1], -t[0]];
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const coefficients = [
    [-0.5, 0],
    [-expansion, 0.14],
    [-expansion * 1.02, 0.7],
    [-expansion * 0.6, 1],
    [expansion * 0.55, 0.94],
    [expansion, 0.65],
    [expansion, 0.12],
    [0.5, 0],
  ];
  const coefficient = polygonArea(coefficients);
  const height = (area - w * collarHeight) / (w * coefficient);
  if (height <= 0) throw new RangeError('Feature reserve below collar area');
  const transform = ([x, y]) => [
    m[0] + x * w * t[0] + (collarHeight + height * y) * n[0],
    m[1] + x * w * t[1] + (collarHeight + height * y) * n[1],
  ];
  return { id, kind, root, collarHeight, polygon: [a, ...coefficients.map(transform), b] };
}
function island(id, kind, center, area, phase) {
  const raw = Array.from({ length: 7 }, (_, j) => {
    const a = phase + (j * 2 * Math.PI) / 7,
      r = 1 + 0.12 * Math.sin(j * 2.3 + phase);
    return [r * Math.cos(a), r * 0.68 * Math.sin(a)];
  });
  const scale = Math.sqrt(area / polygonArea(raw));
  return { id, kind, polygon: raw.map(([x, y]) => [center[0] + x * scale, center[1] + y * scale]) };
}
export function constructTemplate({
  id = 'owner-0',
  primary = true,
  quota,
  recipe,
  templateIndex = 0,
}) {
  const [width, h, expansion] = TEMPLATE_TABLE[templateIndex];
  const fragment = recipe.fragmentationBand;
  const bayMouth = [
    [0.42, 0],
    [0.66, 0],
  ];
  const pocket = [bayMouth[0], [0.385, 0.195 + fragment * 0.003], [0.56, 0.245], bayMouth[1]];
  const pRoot = [
    [0.64, 0.34],
    [0.64, 0.34 + width],
  ];
  const l1Root = [
      [-0.08, 0.63],
      [-0.37, 0.55],
    ],
    l2Root = [
      [-0.6, -0.24],
      [-0.43, -0.46],
    ];
  let interior = [
    pRoot[0],
    pRoot[1],
    [0.5, 0.57],
    [0.23, 0.66],
    ...l1Root,
    [-0.57, 0.4],
    [-0.69, 0.13],
    [-0.68, -0.08],
    ...l2Root,
    [-0.19, -0.59],
    [0.09, -0.62],
    [0.32, -0.48],
    [0.48, -0.26],
    ...pocket,
    [0.64, 0.18],
  ];
  if (!primary)
    interior = [
      [0.64, 0.18],
      [0.56, 0.49],
      [0.23, 0.66],
      [-0.08, 0.63],
      [-0.37, 0.55],
      [-0.57, 0.4],
      [-0.69, 0.13],
      [-0.68, -0.08],
      [-0.43, -0.46],
      [-0.19, -0.59],
      [0.09, -0.62],
      [0.32, -0.48],
      [0.48, -0.26],
    ];
  for (const point of new Set(interior)) point[1] *= recipe.polarStretch;
  const q = polygonArea(interior) / (primary ? 0.7 : 1);
  const attachments = primary
    ? [
        attachment(`${id}/lobe-1`, 'lobe', l1Root, 0.15 * q, 0.075, 1.25),
        attachment(`${id}/lobe-2`, 'lobe', l2Root, 0.09 * q, 0.075, 1.1),
        attachment(`${id}/peninsula`, 'peninsula', pRoot, 0.06 * q, h, expansion),
      ]
    : [];
  const bodyBoundary = stitchBody(interior, attachments);
  const reserveShare = recipe.islandShare + recipe.archipelagoShare;
  const ownerArea = q / (1 - reserveShare);
  const islands = [];
  for (const [kind, count, share, phase] of [
    ['island', recipe.islandCount, recipe.islandShare, 0.25],
    ['archipelago', recipe.archipelagoCount, recipe.archipelagoShare, 1.35],
  ]) {
    const weights = Array.from({ length: count }, (_, i) => 1 / (1 + i * 0.65));
    const total = weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < count; i++) {
      const angle = phase + i * (kind === 'island' ? 0.64 : 0.15);
      const radius = kind === 'island' ? 0.94 : 0.98 + i * 0.014;
      islands.push(
        island(
          `${id}/${kind}-${i}`,
          kind,
          [radius * Math.cos(angle), -radius * Math.sin(angle)],
          (ownerArea * share * weights[i]) / total,
          angle,
        ),
      );
    }
  }
  const candidate = {
    id,
    primary,
    interior,
    interiorWitness: [-0.1, 0.02],
    attachments,
    bay: primary
      ? { polygon: pocket, mouth: bayMouth, witness: [0.48, 0.2 * recipe.polarStretch] }
      : null,
    islands,
    bodyBoundary,
  };
  // Leave the bay on the exact chart axis; placement owns deterministic orientation.
  return scaleCandidate(
    candidate,
    Math.sqrt(
      (4 * Math.PI * quota) / (q + islands.reduce((s, i) => s + polygonArea(i.polygon), 0)),
    ),
  );
}
export function constructOwners(input) {
  let recipe;
  try {
    if (typeof input?.seed !== 'string' || input.seed.length === 0)
      throw new RangeError('Seed must be a nonempty string without coercion.');
    recipe = controlRecipe(input.controls);
  } catch (error) {
    return {
      ok: false,
      owners: [],
      failures: [{ code: 'invalid-input', message: error.message }],
      receipts: [],
    };
  }
  const primaryCount = Math.min(
    recipe.ownerCount,
    1 + Math.floor(stream(input.seed, 'primary-count')() * 3),
  );
  const sizes = Array.from({ length: recipe.ownerCount }, (_, i) =>
    recipe.distribution === 'balanced'
      ? 0.9
      : recipe.distribution === 'oneDominant'
        ? i === 0
          ? 1
          : 0.55
        : i < primaryCount
          ? 0.95
          : 0.55,
  );
  const sum = sizes.reduce((a, s) => a + s * s, 0);
  const owners = [],
    failures = [],
    receipts = [];
  for (let i = 0; i < sizes.length; i++) {
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
          templateIndex: index,
          seed: input.seed,
        });
        certificate = certifyCandidate(candidate, { quota, nominalClearance: 0.05 });
      } catch (error) {
        certificate = { ok: false, failures: [{ code: 'construction', message: error.message }] };
      }
      receipts.push({
        ownerId: id,
        templateIndex: index,
        quota,
        ok: certificate.ok,
        failures: certificate.failures,
      });
      if (certificate.ok) {
        accepted = {
          id,
          quota,
          size: sizes[i],
          primary,
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
  return {
    ok: failures.length === 0,
    owners,
    failures,
    receipts,
    recipe,
    revision: TEMPLATE_REVISION,
  };
}
