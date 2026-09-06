import { corpus } from '../issue-180/corpus.mjs';
export const retainedInputs = [
  {
    id: 'normal-01',
    seed: '1',
    controls: {
      worldCircumferenceKm: 40000,
      targetWaterCoveragePercent: 65,
      continentCountIntent: 4,
      continentDistribution: 'varied',
      fragmentationPercent: 35,
      islandAbundancePercent: 35,
      archipelagoAbundancePercent: 25,
      oceanConnectivity: 'singleGlobal',
      polarCharacter: 'neutral',
    },
  },
  {
    id: 'normal-02',
    seed: '2',
    controls: {
      worldCircumferenceKm: 40000,
      targetWaterCoveragePercent: 65,
      continentCountIntent: 4,
      continentDistribution: 'varied',
      fragmentationPercent: 35,
      islandAbundancePercent: 35,
      archipelagoAbundancePercent: 25,
      oceanConnectivity: 'singleGlobal',
      polarCharacter: 'neutral',
    },
  },
  {
    id: 'normal-03',
    seed: '3',
    controls: {
      worldCircumferenceKm: 40000,
      targetWaterCoveragePercent: 65,
      continentCountIntent: 4,
      continentDistribution: 'varied',
      fragmentationPercent: 35,
      islandAbundancePercent: 35,
      archipelagoAbundancePercent: 25,
      oceanConnectivity: 'singleGlobal',
      polarCharacter: 'neutral',
    },
  },
  {
    id: 'normal-04',
    seed: '4',
    controls: {
      worldCircumferenceKm: 40000,
      targetWaterCoveragePercent: 65,
      continentCountIntent: 4,
      continentDistribution: 'varied',
      fragmentationPercent: 35,
      islandAbundancePercent: 35,
      archipelagoAbundancePercent: 25,
      oceanConnectivity: 'singleGlobal',
      polarCharacter: 'neutral',
    },
  },
  {
    id: 'connected-majority',
    seed: '1085102592571150095',
    controls: {
      worldCircumferenceKm: 40000,
      targetWaterCoveragePercent: 60,
      continentCountIntent: 6,
      continentDistribution: 'balanced',
      fragmentationPercent: 55,
      islandAbundancePercent: 55,
      archipelagoAbundancePercent: 50,
      oceanConnectivity: 'connectedMajority',
      polarCharacter: 'neutral',
    },
  },
  {
    id: 'fragmented-islands',
    seed: '18364758544493064720',
    controls: {
      worldCircumferenceKm: 40000,
      targetWaterCoveragePercent: 70,
      continentCountIntent: 5,
      continentDistribution: 'varied',
      fragmentationPercent: 90,
      islandAbundancePercent: 95,
      archipelagoAbundancePercent: 95,
      oceanConnectivity: 'singleGlobal',
      polarCharacter: 'neutral',
    },
  },
];
export function probes() {
  return [
    ...retainedInputs.map((input) => ({ cohort: 'retained-six', input })),
    ...corpus().filter((p) => p.cohort === 'additional-default'),
  ];
}
export function worldInputs() {
  return [
    ...retainedInputs,
    ...['default-001', 'default-004', 'default-006'].map(
      (id) => corpus().find((p) => p.input.id === id).input,
    ),
  ];
}
