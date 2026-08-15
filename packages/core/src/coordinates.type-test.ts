import {
  composeCoordinateTransforms,
  createPlanetRegionalTransform,
  createProofInputPoint,
  proofInputToPlanetTransform,
} from './coordinate-transforms.js';
import {
  createPlanetPoint,
  createRegionalPoint,
  createWorldRadius,
  type PlanetPoint,
  type RegionalPoint,
} from './coordinates.js';
import type { RenderPoint } from './index.js';

// @ts-expect-error Raw tick records cannot bypass canonical planet parsing.
const unparsedPlanetPoint: PlanetPoint = { longitudeTicks: 0, latitudeTicks: 0 };
// @ts-expect-error Raw millimeter records cannot bypass canonical regional parsing.
const unparsedRegionalPoint: RegionalPoint = { xMillimeters: 0, yMillimeters: 0 };

const planet = createPlanetPoint(0, 0);
const regional = createRegionalPoint(0, 0);
const radius = createWorldRadius(1_000);
const proof = createProofInputPoint(5_000, 5_000);

if (planet.ok && regional.ok && radius.ok && proof.ok) {
  const transform = createPlanetRegionalTransform(planet.value, radius.value);
  transform.forward(planet.value);
  transform.inverse(regional.value);
  composeCoordinateTransforms(proofInputToPlanetTransform, transform).forward(proof.value);

  const renderPoint: RenderPoint = { xPx: 0, yPx: 0 };
  // @ts-expect-error Render pixels are not authoritative planet geometry.
  transform.forward(renderPoint);
  // @ts-expect-error Planet points are not regional physical coordinates.
  transform.inverse(planet.value);
  // @ts-expect-error Transform composition requires matching intermediate coordinate types.
  composeCoordinateTransforms(transform, proofInputToPlanetTransform);

  void renderPoint;
}

void [unparsedPlanetPoint, unparsedRegionalPoint];
