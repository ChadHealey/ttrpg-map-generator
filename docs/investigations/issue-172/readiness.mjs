/** Pre-comparison rejection checks for this issue's declared local evidence gates. */
import { GAP_RAD } from '../issue-170/placement.mjs';

/** Necessary conditions only; lower radii weaken demands without inventing feasibility. */
export function packingFailures(radii, inputId) {
  const sorted = [...radii].sort((a, b) => a - b);
  const failures = [];
  const reject = (code, requested, bound) =>
    failures.push({
      code,
      inputId,
      minimumRequiredPairDistance: requested,
      maximumPossibleMinimumDistance: bound,
    });
  if (sorted.length >= 2 && sorted.at(-1) + sorted.at(-2) + GAP_RAD > Math.PI + 1e-12)
    reject('packing-antipodal-bound', sorted.at(-1) + sorted.at(-2) + GAP_RAD, Math.PI);
  if (sorted.length === 4) {
    const small = sorted[0],
      pair = sorted[2],
      triple = sorted[1];
    if (2 * pair + GAP_RAD <= Math.PI && 2 * small + GAP_RAD <= Math.PI) {
      const bound = Math.acos(-Math.cos(pair + GAP_RAD / 2) * Math.cos(small + GAP_RAD / 2));
      if (pair + small + GAP_RAD > bound + 1e-12)
        reject('packing-two-plus-two-bound', pair + small + GAP_RAD, bound);
    }
    if (2 * triple + GAP_RAD > (2 * Math.PI) / 3 + 1e-12)
      reject('packing-primary-triple-bound', 2 * triple + GAP_RAD, (2 * Math.PI) / 3);
    else {
      const square = (1 + 2 * Math.cos(2 * triple + GAP_RAD)) / 3;
      const bound = Math.acos(-Math.sqrt(Math.max(0, square)));
      if (triple + small + GAP_RAD > bound + 1e-12)
        reject('packing-three-plus-one-bound', triple + small + GAP_RAD, bound);
    }
  }
  if (sorted.length >= 5 && sorted[0] + sorted[1] + GAP_RAD > Math.PI / 2 + 1e-12)
    reject('packing-obtuse-bound', sorted[0] + sorted[1] + GAP_RAD, Math.PI / 2);
  return failures;
}

export function assessReadiness(reports) {
  const failures = [];
  const layouts = new Set();
  for (const { input, construction } of reports) {
    const owners = construction.owners;
    const complete =
      construction.ok &&
      owners.length === input.controls.continentCountIntent &&
      new Set(owners.map((owner) => owner.id)).size === owners.length &&
      owners.every(
        (owner) => owner.certificate.ok && Number.isFinite(owner.radius) && owner.radius > 0,
      ) &&
      owners.some((owner) => owner.candidate.primary);
    if (!complete) failures.push({ code: 'incomplete-certified-owner-set', inputId: input.id });
    for (const owner of owners)
      if (
        /^normal-0[1-4]$/.test(input.id) &&
        owner.candidate.primary &&
        Number.isInteger(owner.candidate.layoutIndex)
      )
        layouts.add(owner.candidate.layoutIndex);
    failures.push(
      ...packingFailures(
        owners.map((owner) => owner.radius),
        input.id,
      ),
    );
  }
  if (layouts.size < 3)
    failures.push({
      code: 'accepted-layout-diversity',
      observedLayouts: [...layouts].sort((a, b) => a - b),
      requiredLayoutCount: 3,
      scope: 'issue-172 declared construction inventory; not a human visual judgment',
    });
  return { readyForComparison: failures.length === 0, failures };
}
