/** Exact published D3 appendix. Never select rows from observed outcomes. */
export const DEFAULTS = Object.freeze({
  worldCircumferenceKm: 40000,
  targetWaterCoveragePercent: 65,
  continentCountIntent: 4,
  continentDistribution: 'varied',
  fragmentationPercent: 35,
  islandAbundancePercent: 35,
  archipelagoAbundancePercent: 25,
  oceanConnectivity: 'singleGlobal',
  polarCharacter: 'neutral',
});
export const SEEDS = Object.freeze(['1', '180000000000000001']);
export const BUDGET = Object.freeze({
  rows: 30,
  constructorCalls: 28,
  placementCalls: 28,
  templateAttempts: 3584,
  uniqueFieldCalls: 18,
  scalarEvaluations: 37711908,
  partitions: 18,
  semanticCalls: 28,
  profile: 'world-atlas-full-v1',
  anchorsPerField: 2095106,
  passes: 1,
  replayPasses: 1,
  previews: 0,
  images: 0,
});
const pairs = [
  ['baseline', {}],
  ['ocean-majority', { oceanConnectivity: 'connectedMajority' }],
  ['ocean-multiple', { oceanConnectivity: 'multipleBasins' }],
  ['polar-ocean', { polarCharacter: 'oceanBiased' }],
  ['polar-land', { polarCharacter: 'landBiased' }],
  ['fragmentation-0', { fragmentationPercent: 0 }],
  ['fragmentation-100', { fragmentationPercent: 100 }],
];
const boundaries = [
  ...[45, 58, 59, 80].map((w) => [
    `count1-water${w}`,
    { continentCountIntent: 1, targetWaterCoveragePercent: w },
  ]),
  ...[45, 80].map((w) => [
    `count8-water${w}`,
    { continentCountIntent: 8, targetWaterCoveragePercent: w },
  ]),
  ...[45, 80].map((w) => [`water${w}`, { targetWaterCoveragePercent: w }]),
  ['distribution-balanced', { continentDistribution: 'balanced' }],
  ['distribution-dominant', { continentDistribution: 'oneDominant' }],
  ['islands-zero', { islandAbundancePercent: 0 }],
  ['archipelagos-zero', { archipelagoAbundancePercent: 0 }],
  ['both-zero', { islandAbundancePercent: 0, archipelagoAbundancePercent: 0 }],
  ['circumference-min', { worldCircumferenceKm: 10000 }],
  ['circumference-max', { worldCircumferenceKm: 80000 }],
  ['both-abundances-max', { islandAbundancePercent: 100, archipelagoAbundancePercent: 100 }],
];
export function corpus() {
  return [
    ...SEEDS.flatMap((seed, i) =>
      pairs.map(([name, patch]) => ({
        id: `paired-${i + 1}-${name}`,
        seed,
        controls: { ...DEFAULTS, ...patch },
      })),
    ),
    ...boundaries.map(([name, patch]) => ({
      id: `boundary-${name}`,
      seed: SEEDS[0],
      controls: { ...DEFAULTS, ...patch },
    })),
  ];
}
export function expectedDuplicate(id) {
  const pair = /^paired-([12])-(ocean-(majority|multiple)|fragmentation-(0|100))$/.exec(id);
  if (pair) return `paired-${pair[1]}-baseline`;
  if (['boundary-circumference-min', 'boundary-circumference-max'].includes(id))
    return 'paired-1-baseline';
  return null;
}
export function capacity(controls) {
  const maximum = (1 - Math.cos(1.4)) / 2;
  const quota = 1 - controls.targetWaterCoveragePercent / 100;
  return controls.continentCountIntent === 1 && quota > maximum
    ? {
        reasonCode: 'unsupported-family-capacity',
        theorem: 'q <= (1-cos(1.4))/2',
        maximumOwnerFraction: maximum,
        requiredOwnerFraction: quota,
        deficit: quota - maximum,
        includes: 'whole primary body plus paid detached islands',
        constructorAttempted: false,
        targetImpossibilityClaim: false,
      }
    : null;
}
