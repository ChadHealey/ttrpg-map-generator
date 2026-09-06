/** Numeric corroboration of issue-173 analytic equations; NOT a geometric certificate. */
import assert from 'node:assert/strict';

import {
  inverseLambert,
  isSimplePolygon,
  pointLocation,
  signedArea,
  stitchBody,
} from '../issue-169/geometry.mjs';

const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a) => Math.hypot(...a);
const unit = (a) => a.map((v) => v / norm(a));
const angle = (a, b) => Math.atan2(norm(cross(a, b)), dot(a, b));
function correction(a, b) {
  const det = a[0] * b[1] - a[1] * b[0];
  const sa = Math.sqrt(1 - dot(a, a) / 4),
    sb = Math.sqrt(1 - dot(b, b) / 4);
  const triangle = 2 * Math.atan2(det, 4 * sa * sb + dot(a, b));
  return { triangle, planarTriangle: det / 2, correction: triangle - det / 2 };
}
function depth(a, b, x) {
  const A = inverseLambert(a),
    B = inverseLambert(b),
    X = inverseLambert(x);
  const n = unit(cross(A, B)),
    p = X.map((v, i) => v - dot(X, n) * n[i]),
    h = norm(p);
  if (h === 0) return { depth: Math.PI / 2, projection: 'normal' };
  const Y = unit(p),
    interior = dot(cross(A, Y), n) >= 0 && dot(cross(Y, B), n) >= 0;
  return {
    depth: interior ? Math.atan2(Math.abs(dot(X, n)), h) : Math.min(angle(X, A), angle(X, B)),
    projection: interior ? 'interior' : 'endpoint',
  };
}
function sampledTriangle(a, b, count) {
  const A = inverseLambert(a),
    B = inverseLambert(b),
    beta = angle(A, B);
  const points = [[0, 0]];
  for (let i = 0; i <= count; i++) {
    const t = i / count,
      V = A.map(
        (v, k) => (Math.sin((1 - t) * beta) * v + Math.sin(t * beta) * B[k]) / Math.sin(beta),
      );
    const scale = Math.sqrt(2 / (1 + V[2]));
    points.push([scale * V[0], scale * V[1]]);
  }
  return signedArea(points);
}
const a = [0.65, -0.12],
  b = [0.65, 0.12],
  witness = [0.42, 0];
const interior = [
  [-0.6, -0.45],
  [0.35, -0.5],
  a,
  [0.38, -0.08],
  [0.34, 0.09],
  b,
  [0.35, 0.52],
  [-0.55, 0.5],
];
const pocket = [a, b, [0.34, 0.09], [0.38, -0.08]];
const forward = correction(a, b),
  reverse = correction(b, a);
assert.equal(forward.correction, -reverse.correction);
assert.equal(correction([0.4, 0], [0.65, 0]).correction, 0);
const known = correction([0.5, 0], [0, 0.5]);
assert(Math.abs(known.triangle - 0.13313632755164764) < 1e-15);
const convergence = [16, 64, 256].map((count) => ({
  count,
  area: sampledTriangle([0.5, 0], [0, 0.5], count),
}));
assert(
  Math.abs(convergence[2].area - known.triangle) < Math.abs(convergence[1].area - known.triangle),
);
assert(
  Math.abs(convergence[1].area - known.triangle) < Math.abs(convergence[0].area - known.triangle),
);
const beta = angle(inverseLambert(a), inverseLambert(b)),
  d = depth(a, b, witness);
const area = signedArea(pocket) + forward.correction;
assert(isSimplePolygon(interior) && isSimplePolygon(pocket));
assert.equal(pointLocation(witness, pocket), 1);
assert.equal(pointLocation(witness, interior), -1);
const filled = stitchBody(interior, [{ polygon: pocket }]);
assert(Math.abs(signedArea(filled) - signedArea(interior) - signedArea(pocket)) < 1e-14);
const radius = Math.max(...interior.map((p) => norm(p)));
const alpha = 2 * Math.asin(radius / 2),
  c = Math.cos(alpha / 2),
  width = norm(a.map((v, i) => v - b[i]));
const sufficient = {
  angularCap: alpha,
  metricFactor: c,
  openingLower: c * width,
  openingUpper: width / c,
  depthLower: c * (0.65 - witness[0]),
  removedAreaLower: signedArea(pocket),
};
sufficient.ratioLower = sufficient.depthLower / sufficient.openingUpper;
assert(sufficient.openingLower > 0.12 && sufficient.openingUpper < 0.3);
assert(sufficient.depthLower > 0.15 && sufficient.ratioLower > 0.5);
assert(sufficient.removedAreaLower > 0.02 * 4 * Math.PI * 0.13106846473029043 * (1 - 0.0095));
assert(beta > 0.12 && beta < 0.3 && d.depth > 0.15 && d.depth / beta > 0.5);
assert(area > 0.02 * 4 * Math.PI * 0.13106846473029043 * (1 - 0.0095));
const endpoint = depth(a, b, [0.55, 0.4]);
assert.equal(endpoint.projection, 'endpoint');
console.log(
  JSON.stringify(
    {
      scope: 'Binary64 equation corroboration only; not a continuous or interval certificate',
      known,
      convergence,
      positive: {
        a,
        b,
        witness,
        interior,
        pocket,
        opening: beta,
        ...d,
        ...forward,
        planarPocketArea: signedArea(pocket),
        curvedPocketArea: area,
        positiveInteriorArea: signedArea(interior),
        sufficient,
        requiredLargestRetainedRemovedArea: 0.02 * 4 * Math.PI * 0.13106846473029043 * (1 - 0.0095),
      },
      endpointCase: { witness: [0.55, 0.4], ...endpoint },
    },
    null,
    2,
  ),
);
