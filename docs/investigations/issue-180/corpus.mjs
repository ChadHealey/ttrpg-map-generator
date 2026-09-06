/** Declared once before execution. IDs/seeds are never selected using probe results. */
export const DEFAULT_CONTROLS = Object.freeze({
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
const controls = [
  ['baseline', {}],
  ['circumference-min', { worldCircumferenceKm: 10000 }],
  ['circumference-max', { worldCircumferenceKm: 80000 }],
  ['water-min', { targetWaterCoveragePercent: 45 }],
  ['water-max', { targetWaterCoveragePercent: 80 }],
  ['count-min', { continentCountIntent: 1 }],
  ['count-max', { continentCountIntent: 8 }],
  ['distribution-balanced', { continentDistribution: 'balanced' }],
  ['distribution-dominant', { continentDistribution: 'oneDominant' }],
  ...[0, 25, 26, 51, 52, 77, 78, 100].map((fragmentationPercent) => [
    `fragmentation-${fragmentationPercent}`,
    { fragmentationPercent },
  ]),
  ...[0, 1, 100].map((islandAbundancePercent) => [
    `islands-${islandAbundancePercent}`,
    { islandAbundancePercent },
  ]),
  ...[0, 1, 100].map((archipelagoAbundancePercent) => [
    `archipelagos-${archipelagoAbundancePercent}`,
    { archipelagoAbundancePercent },
  ]),
  ['ocean-majority', { oceanConnectivity: 'connectedMajority' }],
  ['ocean-multiple', { oceanConnectivity: 'multipleBasins' }],
  ['polar-land', { polarCharacter: 'landBiased' }],
  ['polar-ocean', { polarCharacter: 'oceanBiased' }],
  [
    'combined-min',
    {
      worldCircumferenceKm: 10000,
      targetWaterCoveragePercent: 45,
      continentCountIntent: 1,
      continentDistribution: 'balanced',
      fragmentationPercent: 0,
      islandAbundancePercent: 0,
      archipelagoAbundancePercent: 0,
      polarCharacter: 'landBiased',
    },
  ],
  [
    'combined-max',
    {
      worldCircumferenceKm: 80000,
      targetWaterCoveragePercent: 80,
      continentCountIntent: 8,
      continentDistribution: 'oneDominant',
      fragmentationPercent: 100,
      islandAbundancePercent: 100,
      archipelagoAbundancePercent: 100,
      oceanConnectivity: 'multipleBasins',
      polarCharacter: 'oceanBiased',
    },
  ],
  [
    'eight-balanced-low-water',
    { continentCountIntent: 8, continentDistribution: 'balanced', targetWaterCoveragePercent: 45 },
  ],
  [
    'eight-balanced-high-water',
    { continentCountIntent: 8, continentDistribution: 'balanced', targetWaterCoveragePercent: 80 },
  ],
  ['both-abundances-max', { islandAbundancePercent: 100, archipelagoAbundancePercent: 100 }],
];
export function corpus() {
  const defaults = Array.from({ length: 128 }, (_, i) => ({
    cohort: 'additional-default',
    input: {
      id: `default-${String(i + 1).padStart(3, '0')}`,
      seed: String(180000000000000001n + BigInt(i)),
      controls: { ...DEFAULT_CONTROLS },
    },
  }));
  return [
    ...defaults,
    ...controls.map(([name, patch]) => ({
      cohort: 'control',
      input: { id: `control-${name}`, seed: '1', controls: { ...DEFAULT_CONTROLS, ...patch } },
    })),
  ];
}
