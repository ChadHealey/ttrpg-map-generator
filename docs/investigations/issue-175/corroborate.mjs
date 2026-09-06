/** Numeric examples for the wedge design; not a rounded geometric acceptance predicate. */
import assert from 'node:assert/strict';

import {
  edges,
  isSimplePolygon,
  pointLocation,
  polygonArea,
  samePoint,
  stitchBody,
} from '../issue-169/geometry.mjs';
import { certifyCandidate } from '../issue-174/certificates.mjs';

const a = [0.65, -0.12],
  b = [0.65, 0.12],
  witness = [0.42, 0],
  det = (u, v) => u[0] * v[1] - u[1] * v[0];
const forms = (u) => [
  det(a, u) / Math.hypot(...a),
  det(u, b) / Math.hypot(...b),
  -det([b[0] - a[0], b[1] - a[1]], [u[0] - a[0], u[1] - a[1]]) /
    Math.hypot(b[0] - a[0], b[1] - a[1]),
];
/** Ordinary floating-point closed clipping solely to corroborate the explicit examples. */
function intersection(u, v) {
  let lo = 0,
    hi = 1;
  const first = forms(u),
    last = forms(v);
  for (let i = 0; i < 3; i++) {
    const delta = last[i] - first[i];
    if (delta === 0) {
      if (first[i] < 0) return null;
      continue;
    }
    const root = -first[i] / delta;
    if (delta > 0) lo = Math.max(lo, root);
    else hi = Math.min(hi, root);
    if (lo > hi) return null;
  }
  return [lo, hi];
}
const B = [
  [-0.6, -0.45],
  [0.85, -0.35],
  a,
  [0.38, -0.08],
  [0.34, 0.09],
  b,
  [0.9, 0.4],
  [-0.55, 0.5],
];
const E = [a, b, [0.34, 0.09], [0.38, -0.08]];
assert(isSimplePolygon(B) && isSimplePolygon(E));
const B0 = stitchBody(B, [{ polygon: E }]);
assert(isSimplePolygon(B0));
assert.equal(pointLocation(witness, E), 1);
assert.equal(pointLocation(witness, B), -1);
const boundary = edges(B).map(([u, v]) => {
  const hit = intersection(u, v);
  const shoulder =
    samePoint(u, a) || samePoint(u, b) ? u : samePoint(v, a) || samePoint(v, b) ? v : null;
  if (!shoulder) {
    assert.equal(hit, null);
    return { u, v, intersection: hit };
  }
  const other = samePoint(shoulder, u) ? v : u;
  const active = samePoint(shoulder, a) ? [0, 2] : [1, 2];
  const outward = active.some((i) => forms(other)[i] < -1e-10);
  assert(outward);
  return { u, v, intersection: hit, structuralShoulder: shoulder, activeFaceExclusion: true };
});
const candidate = {
  id: 'owner-0',
  primary: false,
  interior: B,
  interiorWitness: [0, 0],
  bodyBoundary: B,
  attachments: [],
  islands: [],
  bay: { mouthKind: 'supporting-geodesic', polygon: E, mouth: [a, b], witness },
};
const old = certifyCandidate(candidate, { quota: polygonArea(B) / (4 * Math.PI) });
assert(old.failures.some((f) => f.code === 'bay-positive-support'));
assert(old.failures.every((f) => f.code === 'bay-positive-support'));
const radius = Math.max(...B.map((p) => Math.hypot(...p))),
  alpha = 2 * Math.asin(radius / 2),
  c = Math.cos(alpha / 2),
  w = 0.24;
const sufficient = {
  angularRadius: alpha,
  openingLower: c * w,
  openingUpper: w / c,
  depthLower: c * (0.65 - 0.42),
  removedAreaLower: polygonArea(E),
};
sufficient.ratioLower = sufficient.depthLower / sufficient.openingUpper;
assert(
  alpha < 1.4 &&
    sufficient.openingLower > 0.12 &&
    sufficient.openingUpper < 0.3 &&
    sufficient.depthLower > 0.15 &&
    sufficient.ratioLower > 0.5,
);
assert(sufficient.removedAreaLower > 0.02 * 4 * Math.PI * 0.13106846473029043 * (1 - 0.0095));
const crossing = { u: [0.8, -0.3], v: [0.8, 0.3] };
assert(forms(crossing.u).some((f) => f < 0) && forms(crossing.v).some((f) => f < 0));
crossing.intersection = intersection(crossing.u, crossing.v);
assert(crossing.intersection !== null);
const intrusion = { u: [0.6505, -0.001], v: [0.651, 0.001] };
intrusion.intersection = intersection(intrusion.u, intrusion.v);
assert.deepEqual(intrusion.intersection, [0, 1]);
const contact = { u: [0.8, (0.8 * 0.12) / 0.65], v: [0.9, 0.3] };
contact.intersection = intersection(contact.u, contact.v);
assert(contact.intersection !== null);
const shift = [a[0] + b[0], a[1] + b[1]];
const derivative = [det(a, shift), det(shift, b), -det([b[0] - a[0], b[1] - a[1]], shift)];
assert(derivative.every((v) => v > 0));
console.log(
  JSON.stringify(
    {
      scope:
        'Binary64 example corroboration, not a formal interval certificate or accepted constructor',
      positive: {
        a,
        b,
        witness,
        B,
        E,
        B0,
        bodyArea: polygonArea(B),
        pocketArea: polygonArea(E),
        precutArea: polygonArea(B0),
        boundary,
        globalSupportFailures: old.failures,
        sufficient,
      },
      negative: {
        crossingWithBothEndpointsOutside: crossing,
        lensIntrusion: intrusion,
        radialFaceContact: contact,
      },
      unboundedRay: { direction: shift, unnormalizedFaceDerivatives: derivative },
    },
    null,
    2,
  ),
);
