/** Exactly the eight reviewed fixtures; sparse supports use the real preview profile. */
export const IDS = [
  'quantizer-boundaries',
  'plateau',
  'anchor-crossing',
  'saddles',
  'seam',
  'poles',
  'neck-and-island',
  'tangent-contact',
];
export function syntheticTicks(id, generation) {
  if (!IDS.slice(1).includes(id)) throw new RangeError('Unknown declared lattice fixture');
  const profile = generation.WORLD_ATLAS_PREVIEW_PROFILE,
    ticks = new Int32Array(generation.getAtlasSampleAnchorCount(profile)).fill(-16);
  const set = (x, y, value) => {
    ticks[generation.getAtlasSampleStorageIndex(profile, x, y)] = value;
  };
  const block = (x, y, rows) =>
    rows.forEach((row, j) => row.forEach((value, i) => set(x + i, y + j, value)));
  if (id === 'plateau')
    block(100, 100, [
      [16, 16, 16, 16],
      [16, 0, 0, 16],
      [16, 0, 0, 16],
      [16, 16, 16, 16],
    ]);
  if (id === 'anchor-crossing')
    block(100, 100, [
      [-16, 0, 16],
      [-16, 0, 16],
      [-16, 0, 16],
    ]);
  if (id === 'saddles') {
    block(100, 100, [
      [16, -16],
      [-16, 16],
    ]);
    block(110, 100, [
      [32, -16],
      [-16, 16],
    ]);
    block(120, 100, [
      [17, -16],
      [-16, 17],
    ]);
  }
  if (id === 'seam')
    for (const x of [510, 511, 0, 1]) for (const y of [127, 128, 129]) set(x, y, 16);
  if (id === 'poles') {
    set(0, 0, 16);
    set(0, 256, 16);
    for (let x = 0; x < 512; x++) for (const y of [1, 2, 254, 255]) set(x, y, 16);
  }
  if (id === 'neck-and-island') {
    block(100, 100, [
      [16, 16, -16, -16, -16, 16, 16],
      [16, 16, 16, 16, 16, 16, 16],
      [16, 16, -16, -16, -16, 16, 16],
    ]);
    set(112, 101, 16);
  }
  if (id === 'tangent-contact') set(100, 100, 0);
  return { profile, ticks };
}
export async function evaluateSynthetics({ policy, generation }, digest) {
  const Q = 2 ** 24,
    values = [-2, -1, -1 / (2 * Q), -1 / (4 * Q), -0, 0, 1 / (4 * Q), 1 / (2 * Q), 1, 2];
  const records = [
    {
      id: IDS[0],
      normalized: values.map(policy.normalize),
      ticks: values.map(policy.quantize),
      saturationCount: values.filter((x) => Math.abs(x) > 1).length,
    },
  ];
  for (const id of IDS.slice(1)) {
    const { profile, ticks } = syntheticTicks(id, generation),
      field = policy.fieldFromTicks(profile, ticks),
      classification = await policy.classify(field, 50),
      reference = policy.coverageReference(field, 50);
    records.push({
      id,
      classification: {
        realizedWaterCoveragePercent: classification.realizedWaterCoveragePercent,
        absoluteWaterCoverageErrorBasisPoints: classification.absoluteWaterCoverageErrorBasisPoints,
      },
      reference,
      policies: ['Z', 'H'].map((name) => {
        const result = policy.extractPolicy(field, name, digest);
        return {
          policy: name,
          status: result.status,
          preflight: result.preflight,
          failures: result.failures,
          rawRingCount: result.extraction?.rings.length ?? null,
          rawVertexCount: result.extraction?.rings.reduce((n, r) => n + r.points.length, 0) ?? null,
          simplifiedVertexCount:
            result.simplified?.reduce((n, r) => n + r.ring.points.length, 0) ?? null,
          correspondence: result.correspondence,
        };
      }),
    });
  }
  return records;
}
