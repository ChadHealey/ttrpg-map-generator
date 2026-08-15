import type { PlanetAngles, RegionalKilometers } from './coordinates.js';

interface Vector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface TangentBasis {
  readonly origin: Vector3;
  readonly east: Vector3;
  readonly north: Vector3;
}

function dot(first: Vector3, second: Vector3): number {
  return first.x * second.x + first.y * second.y + first.z * second.z;
}

function cross(first: Vector3, second: Vector3): Vector3 {
  return {
    x: first.y * second.z - first.z * second.y,
    y: first.z * second.x - first.x * second.z,
    z: first.x * second.y - first.y * second.x,
  };
}

function magnitude(vector: Vector3): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function normalize(vector: Vector3): Vector3 {
  const length = magnitude(vector);
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function anglesToVector(angles: PlanetAngles): Vector3 {
  const cosLatitude = Math.cos(angles.latitudeRad);
  return {
    x: cosLatitude * Math.cos(angles.longitudeRad),
    y: cosLatitude * Math.sin(angles.longitudeRad),
    z: Math.sin(angles.latitudeRad),
  };
}

function vectorToAngles(vector: Vector3): PlanetAngles {
  return {
    longitudeRad: Math.atan2(vector.y, vector.x),
    latitudeRad: Math.atan2(vector.z, Math.hypot(vector.x, vector.y)),
  };
}

function createBasis(originAngles: PlanetAngles): TangentBasis {
  const origin = anglesToVector(originAngles);
  const east = {
    x: -Math.sin(originAngles.longitudeRad),
    y: Math.cos(originAngles.longitudeRad),
    z: 0,
  };
  return { origin, east, north: cross(origin, east) };
}

/**
 * Private continuous azimuthal-equidistant projection used to test arithmetic separately from
 * public coordinate quantization.
 */
export function projectPlanetAnglesContinuous(
  originAngles: PlanetAngles,
  targetAngles: PlanetAngles,
  radiusKm: number,
): RegionalKilometers | undefined {
  const basis = createBasis(originAngles);
  const target = anglesToVector(targetAngles);
  const eastComponent = dot(target, basis.east);
  const northComponent = dot(target, basis.north);
  const originComponent = dot(target, basis.origin);
  const sineDistance = Math.hypot(eastComponent, northComponent);
  const centralAngle = Math.atan2(sineDistance, originComponent);

  if (centralAngle > Math.PI / 2) {
    return undefined;
  }

  if (sineDistance === 0) {
    return originComponent > 0 ? { xKm: 0, yKm: 0 } : undefined;
  }

  const radialScale = (radiusKm * centralAngle) / sineDistance;
  return {
    xKm: radialScale * eastComponent,
    yKm: radialScale * northComponent,
  };
}

/** Inverse of the private continuous projection on the accepted closed hemisphere. */
export function inverseRegionalKilometersContinuous(
  originAngles: PlanetAngles,
  regional: RegionalKilometers,
  radiusKm: number,
): PlanetAngles | undefined {
  const radialDistance = Math.hypot(regional.xKm, regional.yKm);
  const centralAngle = radialDistance / radiusKm;
  if (centralAngle > Math.PI / 2) {
    return undefined;
  }

  if (radialDistance === 0) {
    return { ...originAngles };
  }

  const basis = createBasis(originAngles);
  const radialFactor = Math.sin(centralAngle) / radialDistance;
  const reconstructed = normalize({
    x:
      Math.cos(centralAngle) * basis.origin.x +
      radialFactor * (regional.xKm * basis.east.x + regional.yKm * basis.north.x),
    y:
      Math.cos(centralAngle) * basis.origin.y +
      radialFactor * (regional.xKm * basis.east.y + regional.yKm * basis.north.y),
    z:
      Math.cos(centralAngle) * basis.origin.z +
      radialFactor * (regional.xKm * basis.east.z + regional.yKm * basis.north.z),
  });
  return vectorToAngles(reconstructed);
}

/** Seam- and pole-safe angular separation used by transform compatibility tests. */
export function greatCircleAngularDistance(first: PlanetAngles, second: PlanetAngles): number {
  const firstVector = anglesToVector(first);
  const secondVector = anglesToVector(second);
  return Math.atan2(magnitude(cross(firstVector, secondVector)), dot(firstVector, secondVector));
}

export function regionalEuclideanDistanceKm(
  first: RegionalKilometers,
  second: RegionalKilometers,
): number {
  return Math.hypot(first.xKm - second.xKm, first.yKm - second.yKm);
}
