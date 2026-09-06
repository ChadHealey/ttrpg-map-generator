/** Bounded pointwise spherical structured score; never modifies accepted geography. */
import { noise, smooth } from './noise.mjs';
import { dot, placeOwners } from './placement.mjs';
import { streams } from './streams.mjs';
const tau = 2 * Math.PI;
const lerp = (interval, u) => interval[0] + (interval[1] - interval[0]) * u;
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const gaussian = (x, y, w) => Math.exp(-(x * x + y * y) / (w * w));
export function quotas(input, p, context) {
  const draw = context.stream('global.quotas', 8);
  const weights = Array.from({ length: input.controls.continentCountIntent }, (_, i) => {
    const size = lerp(p.variedSize, draw());
    return input.controls.continentDistribution === 'balanced'
      ? 1
      : input.controls.continentDistribution === 'oneDominant'
        ? i === 0
          ? p.dominantWeight
          : 1
        : size * size;
  });
  const total = weights.reduce((a, b) => a + b, 0),
    land = 1 - input.controls.targetWaterCoveragePercent / 100;
  return weights.map((w, i) => ({ id: `owner${i}`, quota: (land * w) / total }));
}
function rotateToPole(owners, hemisphere) {
  const source = [...owners].sort((a, b) => b.quota - a.quota)[0].center;
  const target = [0, 0, hemisphere],
    axis = cross(source, target),
    c = dot(source, target);
  const rotate = (v) => {
    if (c < -1 + 1e-12) return [v[0], -v[1], -v[2]];
    const first = cross(axis, v),
      second = cross(axis, first);
    return v.map((x, i) => x + first[i] + second[i] / (1 + c));
  };
  return owners.map((o) => ({
    ...o,
    center: rotate(o.center),
    east: rotate(o.east),
    north: rotate(o.north),
  }));
}
function structure(owner, p, context) {
  const r = context.stream(`${owner.id}.structure`, 24);
  const draws = Array.from({ length: 24 }, r);
  const bearing = tau * draws[1],
    separation = lerp(p.lobeBearingSeparation, draws[2]);
  return {
    ...owner,
    guard: owner.radius - p.clearanceRad,
    elongation: lerp(p.elongation, draws[0]),
    lobes: [0, 1].map((i) => ({
      bearing: bearing + i * separation,
      distance: lerp(p.lobeDistance, draws[3 + i]),
      width: lerp(p.lobeWidth, draws[5 + i]),
      weight: lerp(i === 0 ? p.lobeWeightLarge : p.lobeWeightSmall, draws[7 + i]),
    })),
    ridge: {
      bearing: tau * draws[9],
      root: lerp(p.peninsulaRootFraction, draws[10]),
      extent: lerp(p.peninsulaExtentRad, draws[11]),
      width: lerp(p.peninsulaWidthRad, draws[12]),
      curve: lerp(p.peninsulaCurveRad, draws[13]),
    },
    bay: {
      bearing: tau * draws[14],
      depth: lerp(p.bayDepthRad, draws[15]),
      opening: lerp(p.bayOpeningRad, draws[16]),
      curve: lerp(p.bayCurveRad, draws[17]),
    },
    noiseKeys: draws.slice(18, 22).map((u) => Math.floor(u * 2 ** 32)),
    groupBearing: tau * draws[22],
  };
}
function marginCaps(owner, input, p, context) {
  const categories = [
    [
      'island',
      input.controls.islandAbundancePercent,
      p.islandSlotsAt100,
      p.islandQuotaFractionAt100,
    ],
    [
      'archipelagoMember',
      input.controls.archipelagoAbundancePercent,
      p.archipelagoSlotsAt100,
      p.archipelagoQuotaFractionAt100,
    ],
  ];
  const caps = [],
    reserve = [];
  for (const [name, percent, slots, fraction] of categories) {
    const count = Math.ceil((slots * percent) / 100),
      allowance = (owner.quota * fraction * percent) / 100;
    const members = Array.from({ length: count }, (_, i) => {
      const r = context.stream(`${owner.id}.${name}${i}`, 3);
      const bearing = name === 'island' ? tau * r() : owner.groupBearing + (r() - 0.5) * 1.2;
      return {
        bearing,
        distance: lerp(p.islandMarginFraction, r()) * owner.guard,
        weight: 0.3 + r(),
      };
    });
    const total = members.reduce((a, m) => a + m.weight, 0);
    let supportArea = 0;
    for (const m of members) {
      const radius = Math.min(
        Math.acos(1 - (2 * allowance * m.weight) / total),
        owner.guard - m.distance,
      );
      const center = owner.center.map(
        (v, i) =>
          v * Math.cos(m.distance) +
          (owner.east[i] * Math.cos(m.bearing) + owner.north[i] * Math.sin(m.bearing)) *
            Math.sin(m.distance),
      );
      supportArea += (1 - Math.cos(radius)) / 2;
      caps.push({ category: name, center, radius });
    }
    reserve.push({ category: name, count, allowance, supportArea });
  }
  return { caps, reserve };
}
export function createField(input, p) {
  const context = streams(input.seed),
    allocated = quotas(input, p, context);
  if (allocated.some((o) => o.quota * p.capacityFactor >= 1))
    return { ok: false, failures: ['capacity.invalid'], allocated, ledger: context.ledger };
  const placement = placeOwners(
    allocated.map((o) => ({
      ...o,
      radius: Math.acos(1 - 2 * o.quota * p.capacityFactor) + p.clearanceRad,
    })),
    context,
  );
  if (!placement.ok)
    return {
      ok: false,
      failures: ['placement.no-proposal'],
      allocated,
      placement,
      ledger: context.ledger,
    };
  const polarDraw = context.stream('global.polar', 2);
  const polar = {
    realized: polarDraw() < p.polarProbability[input.controls.polarCharacter],
    hemisphere: polarDraw() < 0.5 ? -1 : 1,
  };
  const placed = polar.realized
    ? rotateToPole(placement.owners, polar.hemisphere)
    : placement.owners;
  const owners = placed.map((o) => structure(o, p, context));
  for (const owner of owners) Object.assign(owner, marginCaps(owner, input, p, context));
  let evaluations = 0;
  function score(point) {
    evaluations++;
    for (let i = 0; i < owners.length; i++) {
      const owner = owners[i],
        cos = dot(point, owner.center);
      if (cos <= Math.cos(owner.guard)) continue;
      const distance = Math.acos(Math.max(-1, Math.min(1, cos)));
      const factor = distance < 1e-12 ? 1 : distance / Math.sin(distance);
      const u = dot(point, owner.east) * factor,
        v = dot(point, owner.north) * factor;
      const w = p.warpWavelengthRad;
      const x = u + p.warpAmplitudeRad * noise(u / w, v / w, owner.noiseKeys[0]);
      const y = v + p.warpAmplitudeRad * noise(u / w, v / w, owner.noiseKeys[1]);
      const a = p.envelopeScale * owner.guard * Math.sqrt(owner.elongation),
        b = (p.envelopeScale * owner.guard) / Math.sqrt(owner.elongation);
      let log = -p.envelopeExponent * ((x / a) ** 2 + (y / b) ** 2);
      for (const l of owner.lobes)
        log +=
          l.weight *
          gaussian(
            x - l.distance * owner.guard * Math.cos(l.bearing),
            y - l.distance * owner.guard * Math.sin(l.bearing),
            l.width * owner.guard,
          );
      const ridge = owner.ridge,
        along =
          x * Math.cos(ridge.bearing) + y * Math.sin(ridge.bearing) - ridge.root * owner.guard;
      const side =
        -x * Math.sin(ridge.bearing) +
        y * Math.cos(ridge.bearing) -
        ridge.curve * (along / ridge.extent) ** 2;
      log +=
        p.peninsulaWeight *
        Math.exp(-((side / (ridge.width / 2)) ** 2)) *
        smooth(1 + along / (ridge.width / 2)) *
        smooth((ridge.extent - along) / (ridge.width / 2));
      const bay = owner.bay,
        radial = x * Math.cos(bay.bearing) + y * Math.sin(bay.bearing);
      const inward = owner.guard - radial;
      const lateral =
        -x * Math.sin(bay.bearing) +
        y * Math.cos(bay.bearing) -
        bay.curve * (inward / bay.depth) ** 2;
      log -=
        (p.bayWeight + (p.bayFragmentationGain * input.controls.fragmentationPercent) / 100) *
        Math.exp(-((lateral / (bay.opening / 2)) ** 2)) *
        smooth((bay.depth - inward) / bay.depth + 0.5);
      for (let j = 0; j < 2; j++)
        log +=
          p.noiseAmplitudes[j] *
          noise(x / p.noiseWavelengthsRad[j], y / p.noiseWavelengthsRad[j], owner.noiseKeys[2 + j]);
      if (input.controls.polarCharacter === 'oceanBiased')
        log -=
          p.oceanPolarDepression *
          smooth(
            (Math.abs(point[2]) - Math.cos(p.polarRadiusRad)) / (1 - Math.cos(p.polarRadiusRad)),
          );
      let value = Math.exp(log);
      for (const cap of owner.caps)
        value +=
          p.islandScore *
          smooth((dot(point, cap.center) - Math.cos(cap.radius)) / (1 - Math.cos(cap.radius)));
      if (polar.realized)
        value +=
          p.polarScore *
          smooth(
            (point[2] * polar.hemisphere - Math.cos(p.polarRadiusRad)) /
              (1 - Math.cos(p.polarRadiusRad)),
          );
      return { owner: i, score: value * smooth((owner.guard - distance) / p.guardFadeRad) };
    }
    return { owner: -1, score: 0 };
  }
  return {
    ok: true,
    allocated,
    owners,
    placement,
    polar,
    ledger: context.ledger,
    score,
    evaluations: () => evaluations,
    raw(point, cutoffs) {
      const s = score(point);
      return s.owner < 0 ? -1 : (s.score - cutoffs[s.owner]) / (s.score + cutoffs[s.owner]);
    },
  };
}
