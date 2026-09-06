/** Finite, investigation-only explicit anatomy. All fitting precedes placement. */
import { stream } from '../issue-164/morphology.mjs';
import { certifyCandidate } from '../issue-169/certificates.mjs';
import { polygonArea, scaleCandidate, stitchBody } from '../issue-169/geometry.mjs';

export const TEMPLATE_REVISION = 'issue-170-curved-r1';
export const TEMPLATE_LIMIT = 12;
export const PARTITION = Object.freeze([0.727, 0.135, 0.085, 0.053]);
export const TEMPLATE_TABLE = Object.freeze([
  [0.105, 0.07, 1],
  [0.1, 0.07, 1.05],
  [0.11, 0.075, 1.05],
  [0.102, 0.075, 1.1],
]);
export const LAYOUTS = Object.freeze([
  {
    p: [0.32, -0.39],
    l1: [
      [0.23, 0.26],
      [-0.13, 0.3],
    ],
    l2: [
      [-0.38, 0.06],
      [-0.39, -0.28],
    ],
    bottom: [0, -0.67],
  },
  {
    p: [0.31, -0.42],
    l1: [
      [0.28, 0.29],
      [-0.04, 0.31],
    ],
    l2: [
      [-0.27, 0.2],
      [-0.27, -0.2],
    ],
    bottom: [-0.02, -0.66],
  },
  {
    p: [0.26, -0.36],
    l1: [
      [0.21, 0.28],
      [-0.15, 0.23],
    ],
    l2: [
      [-0.36, 0.03],
      [-0.33, -0.3],
    ],
    bottom: [0.04, -0.65],
  },
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
    islandShare: (c.islandAbundancePercent / 100) * 0.02,
    archipelagoShare: (c.archipelagoAbundancePercent / 100) * 0.01,
    oceanConnectivity: c.oceanConnectivity,
    polarCharacter: c.polarCharacter,
    // Finite local outline change, paid before normalization. No scalar polar override.
    polarStretch:
      c.polarCharacter === 'landBiased' ? 1.04 : c.polarCharacter === 'oceanBiased' ? 0.96 : 1,
  };
}
const add = (a, b, s = 1) => [a[0] + s * b[0], a[1] + s * b[1]];
const normal = ([a, b]) => {
  const w = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [(b[1] - a[1]) / w, -(b[0] - a[0]) / w];
};
function cubic(a, b, c, d, steps = 5) {
  return Array.from({ length: steps }, (_, i) => {
    const t = (i + 1) / steps,
      u = 1 - t;
    return i === steps - 1
      ? d
      : [0, 1].map(
          (k) => u * u * u * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t * t * t * d[k],
        );
  });
}
function headCoefficients(kind, expansion, skew) {
  const a = [-0.5, 0],
    tip = [kind === 'peninsula' ? 0.75 + skew : 0.18 + skew, 1],
    b = [0.5, 0];
  const lower = kind === 'peninsula' ? -1.25 * expansion : -0.62 * expansion;
  const upper = kind === 'peninsula' ? 1.65 * expansion : 0.68 * expansion;
  const left = [lower, 0.52],
    right = [upper, 0.5];
  return [
    a,
    ...cubic(a, [-0.5, 0.16], [lower, 0.24], left),
    ...cubic(
      left,
      [lower, 0.83],
      [kind === 'peninsula' ? 0.45 + skew : -0.4 + skew, kind === 'peninsula' ? 0.85 : 0.89],
      tip,
    ),
    ...cubic(
      tip,
      [kind === 'peninsula' ? 0.95 + skew : 0.85 + skew, kind === 'peninsula' ? 0.84 : 0.77],
      [upper, 0.78],
      right,
    ),
    ...cubic(right, [upper, 0.28], [0.5, 0.16], b),
  ];
}
function attachment(id, kind, root, area, collarHeight, expansion, skew) {
  const [a, b] = root,
    w = Math.hypot(b[0] - a[0], b[1] - a[1]),
    t = [(b[0] - a[0]) / w, (b[1] - a[1]) / w],
    n = normal(root),
    m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const coefficients = headCoefficients(kind, expansion, skew),
    coefficient = polygonArea(coefficients);
  const height = (area - w * collarHeight) / (w * coefficient);
  if (height <= 0) throw new RangeError('Feature reserve below collar area');
  const transform = ([x, y]) => [
    m[0] + x * w * t[0] + (collarHeight + height * y) * n[0],
    m[1] + x * w * t[1] + (collarHeight + height * y) * n[1],
  ];
  return { id, kind, root, collarHeight, polygon: [a, ...coefficients.map(transform), b] };
}
function island(id, kind, center, area, phase) {
  const raw = Array.from({ length: 9 }, (_, j) => {
    const a = phase + (j * 2 * Math.PI) / 9,
      r = 1 + 0.12 * Math.sin(j * 2.3 + phase);
    const radial = 0.45 * r * Math.cos(a),
      tangent = 1.2 * r * Math.sin(a);
    return [
      radial * Math.cos(phase) + tangent * Math.sin(phase),
      -radial * Math.sin(phase) + tangent * Math.cos(phase),
    ];
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
  seed = '1',
}) {
  const shapeRandom = stream(seed, `issue-170-r1/anatomy/${id}`);
  const firstLayout = Math.floor(shapeRandom() * LAYOUTS.length);
  const layoutIndex = (firstLayout + Math.floor(templateIndex / 4)) % LAYOUTS.length;
  const rawLayout = LAYOUTS[layoutIndex];
  const layout = {
    p: add(rawLayout.p, [0.1, 0]),
    l1: rawLayout.l1.map((p) => add(p, [0, 0.1])),
    l2: rawLayout.l2.map((p) => add(p, [-0.1, 0])),
    bottom: add(rawLayout.bottom, [0, -0.03]),
  };
  const [width, h, expansion] = TEMPLATE_TABLE[templateIndex % 4];
  const skew = (shapeRandom() - 0.5) * 0.12;
  const fragment = recipe.fragmentationBand;
  const bayMouth = [
    [0.25, 0],
    [0.45, 0],
  ];
  const pocket = [
    bayMouth[0],
    ...cubic(bayMouth[0], [0.25, 0.13], [0.21, 0.21], [0.27, 0.23 + fragment * 0.003], 4),
    ...cubic([0.27, 0.23 + fragment * 0.003], [0.37, 0.23], [0.44, 0.11], bayMouth[1], 5),
  ];
  const pRoot = [
    [layout.p[0], layout.p[1]],
    [
      layout.p[0] + (layoutIndex === 2 ? Math.sin(0.55) * width : 0),
      layout.p[1] + (layoutIndex === 2 ? Math.cos(0.55) * width : width),
    ],
  ];
  const l1Root = layout.l1.map((p) => [...p]),
    l2Root = layout.l2.map((p) => [...p]);
  const np = normal(pRoot),
    n1 = normal(l1Root),
    n2 = normal(l2Root);
  let interior = [
    ...pRoot,
    ...cubic(pRoot[1], add(pRoot[1], np, -0.1), [0.33, -0.1], bayMouth[0]),
    ...pocket.slice(1),
    ...cubic(bayMouth[1], [0.59, 0.12], add(l1Root[0], n1, -0.18), l1Root[0], 8),
    l1Root[1],
    ...cubic(l1Root[1], add(l1Root[1], n1, -0.04), add(l2Root[0], n2, -0.04), l2Root[0]),
    l2Root[1],
    ...cubic(l2Root[1], add(l2Root[1], n2, -0.16), add(layout.bottom, [-0.5, 0]), layout.bottom),
    ...cubic(layout.bottom, add(layout.bottom, [0.45, 0]), add(pRoot[0], np, -0.1), pRoot[0]).slice(
      0,
      -1,
    ),
  ];
  if (!primary) {
    const anchors = [
      [0.58, 0.06],
      [0.39, 0.43],
      [-0.12, 0.61],
      [-0.53, 0.24],
      [-0.58, -0.17],
      [-0.2, -0.58],
      [0.35, -0.48],
    ];
    interior = [];
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i],
        b = anchors[(i + 1) % anchors.length],
        prev = anchors[(i + anchors.length - 1) % anchors.length],
        next = anchors[(i + 2) % anchors.length];
      const tangentA = [(b[0] - prev[0]) * 0.14, (b[1] - prev[1]) * 0.14],
        tangentB = [(next[0] - a[0]) * 0.14, (next[1] - a[1]) * 0.14];
      const vary = 1 + (layoutIndex - 1) * 0.07;
      interior.push(...cubic(a, add(a, tangentA, vary), add(b, tangentB, -vary), b, 6));
    }
  }
  for (const p of new Set(interior)) p[1] *= recipe.polarStretch;
  const q = polygonArea(interior) / (primary ? PARTITION[0] : 1);
  const attachments = primary
    ? [
        attachment(
          `${id}/lobe-1`,
          'lobe',
          l1Root,
          PARTITION[layoutIndex === 1 ? 2 : 1] * q,
          0.085,
          1,
          skew,
        ),
        attachment(
          `${id}/lobe-2`,
          'lobe',
          l2Root,
          PARTITION[layoutIndex === 1 ? 1 : 2] * q,
          0.085,
          1,
          -skew,
        ),
        attachment(`${id}/peninsula`, 'peninsula', pRoot, PARTITION[3] * q, h, expansion, skew),
      ]
    : [];
  const bodyBoundary = stitchBody(interior, attachments);
  const reserveShare = recipe.islandShare + recipe.archipelagoShare;
  const ownerArea = q / (1 - reserveShare);
  const islands = [];
  for (const [kind, count, share] of [
    ['island', recipe.islandCount, recipe.islandShare],
    ['archipelago', recipe.archipelagoCount, recipe.archipelagoShare],
  ]) {
    const weights = Array.from({ length: count }, (_, i) => 1 / (1 + i * 0.65));
    const total = weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < count; i++) {
      const site =
        kind === 'island'
          ? [
              [0.1, -0.75],
              [-0.14, -0.75],
              [-0.37, -0.69],
              [-0.5, -0.76],
            ][i]
          : [
              [0.77, 0.1],
              [0.76, -0.04],
              [0.82, 0.045],
              [0.8, -0.16],
              [0.83, -0.065],
              [0.82, 0.155],
              [0.85, -0.18],
            ][i];
      const factor = primary ? 1 : 0.86;
      const center =
        !primary && kind === 'island'
          ? [
              [0.45, -0.56],
              [0.64, -0.33],
              [0.19, -0.69],
              [-0.1, -0.7],
            ][i]
          : site.map((x) => x * factor);
      const angle = -Math.atan2(center[1], center[0]);
      islands.push(
        island(`${id}/${kind}-${i}`, kind, center, (ownerArea * share * weights[i]) / total, angle),
      );
    }
  }
  const candidate = {
    id,
    primary,
    layoutIndex,
    curveSkew: skew,
    interior,
    interiorWitness: [-0.1, 0.02],
    attachments,
    bay: primary
      ? { polygon: pocket, mouth: bayMouth, witness: [0.29, 0.195 * recipe.polarStretch] }
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
