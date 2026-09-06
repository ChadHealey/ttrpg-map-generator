/** Ordinary binary64 arithmetic corroboration; not a new geometric certificate. */
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  isSimplePolygon,
  minBoundaryDistance,
  polygonArea,
  stitchBody,
} from '../issue-169/geometry.mjs';
import { certifyCandidate } from '../issue-176/certificates.mjs';

const bodyArea = 4 * Math.PI * 0.13106846473029043 * (1 - 0.0095);
const peninsulaFloor = 0.05 * bodyArea;
const straightBound = 0.16 * Math.sin(0.45);
assert(straightBound < peninsulaFloor);
const restricted = {
  bodyArea,
  peninsulaFloor,
  rootNormalStripBound: straightBound,
  requiredOverStripBoundMinusOne: peninsulaFloor / straightBound - 1,
  flatProductBound: 0.16 * 0.45,
  sampleLambertFactor: 0.88,
  sampleCertifiedPlanarStripBound: 0.072 * 0.88 ** 2,
};

const r = 0.25,
  h = 0.079,
  baseArea = 0.085,
  tailLength = 0.05;
const phi = baseArea / (2 * Math.sin(r) * Math.sin(h)),
  spineLength = phi * Math.sin(r);
const tailStartPhi = phi - tailLength / Math.sin(r);
const innerEndpointDistance = (theta, angle) =>
  Math.acos(
    Math.cos(theta) * Math.cos(r - h) + Math.sin(theta) * Math.sin(r - h) * Math.cos(angle),
  );
const areaLossUpper = 2 * Math.sin(h) * tailLength * (1 - Math.PI / 4);
const curved = {
  scope: 'Standalone spherical tapered peninsula; no polygon owner, placement or visual claim.',
  r,
  h,
  baseArea,
  tailLength,
  phi,
  spineLength,
  tailStartPhi,
  areaLossUpper,
  areaLower: baseArea - areaLossUpper,
  width: 2 * h,
  extentLower: innerEndpointDistance(r + h, tailStartPhi),
  extentUpper: innerEndpointDistance(r + h, phi),
  collarDiskBoundaryLower: Math.min(h, Math.asin(Math.sin(r) * Math.sin(0.25))),
};
curved.extentWidthRatioLower = curved.extentLower / curved.width;
assert(curved.areaLower > peninsulaFloor);
assert(curved.width >= 0.08 && curved.width <= 0.16);
assert(curved.extentLower >= 0.2 && curved.extentUpper <= 0.45);
assert(curved.extentWidthRatioLower >= 2 && curved.collarDiskBoundaryLower > 0.04);

const feature = [
  [0.25, 0],
  [0.06, 0.3],
  [0, 0.35],
  [-0.06, 0.3],
  [-0.25, 0],
];
const collar = [
    [0.25, 0],
    [0.06, 0.3],
    [-0.06, 0.3],
    [-0.25, 0],
  ],
  c = 0.9;
const planar = {
  scope:
    'Standalone trapezoidal collar and tapered feature, evaluated within a declared containing cap.',
  feature,
  collar,
  disk: [0, 0.17],
  containingAngularBound: 2 * Math.acos(c),
  c,
  simple: isSimplePolygon(feature) && isSimplePolygon(collar),
  area: polygonArea(feature),
  rootLength: 0.5,
  farLength: 0.12,
  chainDistance: 0.12,
  widthLower: c * 0.12,
  rootUpper: 0.5 / c,
  farUpper: 0.12 / c,
  firstDiskRadiusLower: c * minBoundaryDistance([0, 0.17], collar),
  extentLower: c * 0.35,
  extentUpper: 0.35 / c,
};
planar.extentWidthRatioLower = planar.extentLower / planar.farUpper;
assert(planar.simple && planar.area > peninsulaFloor);
assert(planar.rootUpper > 0.16 && planar.farUpper < 0.16 && planar.widthLower > 0.08);
assert(
  planar.firstDiskRadiusLower > 0.04 &&
    planar.extentUpper < 0.45 &&
    planar.extentWidthRatioLower > 2,
);

// The parent-supplied B+P witness exercises every old full-owner check under honest subordinate status.
const rootA = [0.2, -0.3],
  rootB = [0.2, 0.3],
  farA = [0.48, -0.06],
  farB = [0.48, 0.06];
const interior = [[-0.5, -0.5], [0.2, -0.5], rootA, rootB, [0.2, 0.5], [-0.5, 0.5]];
const attachment = {
  id: 'local/peninsula-0',
  kind: 'peninsula',
  root: [rootA, rootB],
  polygon: [rootA, farA, [0.52, 0], farB, rootB],
  collar: { far: [farA, farB], disk: [0.3, 0] },
};
const candidate = {
  id: 'local',
  primary: false,
  interior,
  interiorWitness: [-0.1, 0],
  attachments: [attachment],
  islands: [],
  bodyBoundary: stitchBody(interior, [attachment]),
};
const quota = (polygonArea(interior) + polygonArea(attachment.polygon)) / (4 * Math.PI);
const oldCertificate = certifyCandidate(candidate, { quota });
assert.deepEqual(
  oldCertificate.failures.map((f) => f.code),
  ['peninsula-width-max', 'peninsula-ratio'],
);
const factor = Math.cos(oldCertificate.metrics.angularRadius / 2),
  role = oldCertificate.metrics.roles[0];
const farUpperWithExistingSlack =
  (Math.hypot(farB[0] - farA[0], farB[1] - farA[1]) + 2e-10) / factor;
const subordinate = {
  scope:
    'Complete B+P subordinate under the frozen certificate; proposed far-bound numbers are diagnostics, not a new-mode certificate.',
  candidate,
  quota,
  oldCertificate,
  absolutePeninsulaArea: polygonArea(attachment.polygon),
  exceedsLargestPrimaryAbsoluteFloor: polygonArea(attachment.polygon) > peninsulaFloor,
  proposedFarUpper: farUpperWithExistingSlack,
  proposedExtentWidthRatioLower: role.extentLower / farUpperWithExistingSlack,
};
assert(subordinate.exceedsLargestPrimaryAbsoluteFloor);
assert(
  farUpperWithExistingSlack < 0.16 - 1e-9 && subordinate.proposedExtentWidthRatioLower > 2 + 1e-9,
);

const report = {
  assurance: 'binary64 arithmetic corroboration, not formal interval certification',
  restricted,
  curved,
  planar,
  subordinate,
};
const output = new URL('./corroboration.json', import.meta.url);
if (process.argv.includes('--write'))
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
else process.stdout.write(JSON.stringify(report, null, 2) + '\n');
if (process.argv.includes('--write'))
  process.stdout.write(`Wrote ${fileURLToPath(output).split('/').at(-1)}\n`);
