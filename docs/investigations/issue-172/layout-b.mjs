/** Fixed direct coast layout B: southwest mass, northeast lobe, northwest peninsula. */
function cubic(a, b, c, d, steps = 4) {
  return Array.from({ length: steps }, (_, i) => {
    if (i === steps - 1) return d;
    const t = (i + 1) / steps,
      u = 1 - t;
    return [0, 1].map(
      (k) => u ** 3 * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t ** 3 * d[k],
    );
  });
}

export function buildCoast(id) {
  const pa = [-0.35, 0.3],
    pb = [-0.28, 0.4];
  const a1 = [0.1, -0.48],
    b1 = [-0.4, -0.12];
  const a2 = [0.15, 0.48],
    b2 = [0.54, 0.2];
  const f1a = [-0.02, -0.65],
    f1b = [-0.57, -0.29];
  const f2a = [0.3, 0.61],
    f2b = [0.65, 0.32];
  const fpa = [-0.52, 0.38],
    fpb = [-0.41, 0.56];
  const mouth = [
      [0.44, 0],
      [0.677, 0],
    ],
    tip = [0.4, 0.235];
  const pocket = [
    mouth[0],
    ...cubic(mouth[0], [0.36, 0.06], [0.32, 0.17], tip, 8),
    ...cubic(tip, [0.46, 0.23], [0.58, 0.05], mouth[1], 8),
  ];
  const lobe1 = [
    a1,
    ...cubic(a1, [0.02, -0.47], [-0.01, -0.61], f1a),
    ...cubic(f1a, [-0.11, -0.75], [-0.29, -0.81], [-0.39, -0.7]),
    ...cubic([-0.39, -0.7], [-0.47, -0.65], [-0.64, -0.53], [-0.62, -0.43]),
    ...cubic([-0.62, -0.43], [-0.61, -0.36], [-0.59, -0.32], f1b, 2),
    ...cubic(f1b, [-0.51, -0.2], [-0.45, -0.17], b1),
  ];
  const lobe2 = [
    a2,
    ...cubic(a2, [0.2, 0.47], [0.22, 0.61], f2a),
    ...cubic(f2a, [0.43, 0.64], [0.55, 0.58], [0.59, 0.49]),
    ...cubic([0.59, 0.49], [0.63, 0.43], [0.69, 0.4], f2b),
    ...cubic(f2b, [0.6, 0.26], [0.53, 0.28], b2),
  ];
  const peninsula = [
    pa,
    ...cubic(pa, [-0.42, 0.31], [-0.48, 0.34], fpa),
    ...cubic(fpa, [-0.6, 0.43], [-0.68, 0.41], [-0.66, 0.47]),
    ...cubic([-0.66, 0.47], [-0.64, 0.54], [-0.55, 0.645], [-0.49, 0.625]),
    ...cubic([-0.49, 0.625], [-0.45, 0.6], [-0.43, 0.59], fpb, 2),
    ...cubic(fpb, [-0.36, 0.5], [-0.36, 0.38], pb),
  ];
  const interior = [
    pb,
    ...cubic(pb, [-0.16, 0.47], [-0.03, 0.5], a2, 6),
    b2,
    ...cubic(b2, [0.78, 0.2], [0.86, -0.08], mouth[1], 12),
    ...pocket.toReversed().slice(1),
    ...cubic(mouth[0], [0.48, -0.06], [0.56, -0.14], [0.64, -0.23]),
    ...cubic([0.64, -0.23], [0.68, -0.34], [0.62, -0.51], [0.48, -0.57]),
    ...cubic([0.48, -0.57], [0.35, -0.61], [0.18, -0.49], a1),
    b1,
    ...cubic(b1, [-0.35, -0.07], [-0.28, 0.25], pa),
  ];
  // Fixed pre-fit peninsula proportions; apply the same map to its declared witnesses.
  const narrow = (p) => {
    const x = p[0] + 0.315,
      y = p[1] - 0.35;
    const along = (0.07 * x + 0.1 * y) / 0.0149;
    const outward = (-0.1 * x + 0.07 * y) / 0.0149;
    return [
      -0.315 + 0.98 * along * 0.07 - 0.923 * outward * 0.1,
      0.35 + 0.98 * along * 0.1 + 0.923 * outward * 0.07,
    ];
  };
  const finalPa = narrow(pa),
    finalPb = narrow(pb);
  return {
    interior: interior.map((p) => (p === pa ? finalPa : p === pb ? finalPb : p)),
    interiorWitness: [0, -0.03],
    attachments: [
      {
        id: `${id}/lobe-1`,
        kind: 'lobe',
        root: [a1, b1],
        polygon: lobe1,
        collar: { far: [f1a, f1b], disk: [-0.26, -0.4] },
      },
      {
        id: `${id}/lobe-2`,
        kind: 'lobe',
        root: [a2, b2],
        polygon: lobe2,
        collar: { far: [f2a, f2b], disk: [0.41, 0.43] },
      },
      {
        id: `${id}/peninsula`,
        kind: 'peninsula',
        root: [finalPa, finalPb],
        polygon: peninsula.map(narrow),
        collar: { far: [fpa, fpb].map(narrow), disk: narrow([-0.402, 0.408]) },
      },
    ],
    bay: { polygon: pocket, mouth, witness: [0.415, 0.21] },
    islandAnchorEdges: [1, 3, 5, 8, 10, 11].map((offset) => {
      const i = interior.indexOf(mouth[0]) + offset;
      return [interior[i + 1], interior[i]];
    }),
  };
}
