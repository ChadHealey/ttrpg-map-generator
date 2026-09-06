/** Pre-comparison rejection checks for this issue's declared local evidence gates. */
import { GAP_RAD } from './placement.mjs';

export function assessReadiness(reports) {
  const failures = [];
  const layouts = new Set();
  for (const { input, construction } of reports) {
    const owners = construction.owners;
    const complete =
      construction.ok &&
      owners.length === input.controls.continentCountIntent &&
      new Set(owners.map((owner) => owner.id)).size === owners.length &&
      owners.every((owner) => owner.certificate.ok) &&
      owners.some((owner) => owner.candidate.primary);
    if (!complete) failures.push({ code: 'incomplete-certified-owner-set', inputId: input.id });
    for (const owner of owners)
      if (
        /^normal-0[1-4]$/.test(input.id) &&
        owner.candidate.primary &&
        Number.isInteger(owner.candidate.layoutIndex)
      )
        layouts.add(owner.candidate.layoutIndex);
    const radii = owners.map((owner) => owner.radius).sort((a, b) => a - b);
    if (radii.length >= 5 && radii[0] + radii[1] + GAP_RAD > Math.PI / 2 + 1e-12)
      failures.push({
        code: 'packing-obtuse-bound',
        inputId: input.id,
        minimumRequiredPairDistance: radii[0] + radii[1] + GAP_RAD,
        maximumPossibleMinimumDistance: Math.PI / 2,
        proof: 'five unit vectors in three dimensions cannot all have negative pairwise dots',
      });
  }
  if (layouts.size < 3)
    failures.push({
      code: 'accepted-layout-diversity',
      observedLayouts: [...layouts].sort((a, b) => a - b),
      requiredLayoutCount: 3,
      scope: 'issue-170 declared construction inventory; not a human visual judgment',
    });
  return { readyForComparison: failures.length === 0, failures };
}
