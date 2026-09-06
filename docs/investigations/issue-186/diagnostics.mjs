/** Measured predecessor displacement and fixed original-role diagnostics; not role certificates. */
const TURN = 2 ** 32;
const pointSegment = (p, a, b) => {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    t = Math.max(
      0,
      Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)),
    );
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
export function simplificationDisplacement(raw, simple, generation) {
  const token = (r, i) => JSON.stringify([r.points[i], r.sourceTransitions?.[i]]),
    indices = new Map(raw.points.map((_, i) => [token(raw, i), i])),
    kept = simple.points.map((_, i) => indices.get(token(simple, i)));
  if (kept.some((i) => i === undefined)) return { valid: false };
  const unwrapped = generation.unwrapPlanetRing(raw),
    n = raw.points.length,
    winding = unwrapped[n].longitudeTicks - unwrapped[0].longitudeTicks;
  const at = (i) => [
    unwrapped[i % n].longitudeTicks + Math.floor(i / n) * winding,
    unwrapped[i % n].latitudeTicks,
  ];
  let maximumTicks = 0,
    removedVertices = 0,
    maxSkipped = 0;
  for (let i = 0; i < kept.length; i++) {
    const start = kept[i],
      end = kept[(i + 1) % kept.length] + (kept[(i + 1) % kept.length] <= start ? n : 0),
      a = at(start),
      b = at(end);
    maxSkipped = Math.max(maxSkipped, end - start - 1);
    for (let j = start + 1; j < end; j++) {
      removedVertices++;
      maximumTicks = Math.max(maximumTicks, pointSegment(at(j), a, b));
    }
  }
  return {
    valid: true,
    removedVertices,
    maxConsecutiveRemoved: maxSkipped,
    rawVertexToPredecessorChordMaxTicks: maximumTicks,
    coordinateAffineAngularUpper: (Math.SQRT2 * maximumTicks * 2 * Math.PI) / TURN,
    scope:
      'Raw vertices to their actual replacement chord in unwrapped tick coordinates; no original-field or role correspondence claimed.',
  };
}
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const vector = (point, core) => {
  const a = core.planetPointToAngles(point);
  return [
    Math.cos(a.latitudeRad) * Math.cos(a.longitudeRad),
    Math.cos(a.latitudeRad) * Math.sin(a.longitudeRad),
    Math.sin(a.latitudeRad),
  ];
};
export function fixedRoleDiagnostics(result, samples, report, loaded, geometry) {
  if (!result.extraction) return [];
  const g = loaded.generation,
    p = samples.profile,
    records = [];
  for (let oi = 0; oi < report.placement.owners.length; oi++) {
    const o = report.placement.owners[oi],
      rings = result.extraction.rings.filter((r) =>
        (r.sourceTransitions ?? []).every((t) => samples.ownerByAnchor[t.landSampleIndex] === oi),
      );
    const local = (point) => {
      const v = vector(point, loaded.core);
      return geometry.forwardLambert([dot(o.east, v), dot(o.north, v), dot(o.center, v)]);
    };
    const raw = rings.map((r) => r.points.map(local)),
      simple = result.simplified
        .filter(
          (_, i) =>
            result.extraction.rings[i] &&
            (result.extraction.rings[i].sourceTransitions ?? []).every(
              (t) => samples.ownerByAnchor[t.landSampleIndex] === oi,
            ),
        )
        .map((s) => s.ring.points.map(local));
    const anchors = [
        ...new Set(rings.flatMap((r) => r.sourceTransitions?.map((t) => t.landSampleIndex) ?? [])),
      ].sort((a, b) => a - b),
      membership = {};
    let contacts = 0;
    for (const index of anchors) {
      const y =
          index === 0
            ? 0
            : index === samples.ticks.length - 1
              ? p.latitudeBandCount
              : Math.floor((index - 1) / p.longitudeCellCount) + 1,
        x = y === 0 || y === p.latitudeBandCount ? 0 : (index - 1) % p.longitudeCellCount,
        point = local(g.getAtlasGridVertex(p, x, y)),
        roles = [
          { id: 'interior', polygon: o.candidate.interior },
          ...o.candidate.attachments,
          ...o.candidate.islands,
        ];
      const ids = roles
        .filter((r) => geometry.pointLocation(point, r.polygon) >= 0)
        .map((r) => r.id);
      if (ids.length !== 1) contacts++;
      for (const id of ids) membership[id] = (membership[id] ?? 0) + 1;
    }
    const witnesses = [
      { id: 'interior', point: o.candidate.interiorWitness },
      ...o.candidate.attachments.map((a) => ({ id: a.id, point: a.collar.disk })),
      ...(o.primary ? [{ id: 'bay-water', point: o.candidate.bay.witness }] : []),
    ];
    const measure = (point, polys) => ({
      chartChordBoundaryDistance: polys.length
        ? Math.min(...polys.map((poly) => geometry.minBoundaryDistance(point, poly)))
        : null,
      evenOddLand:
        polys.reduce((n, poly) => n + (geometry.pointLocation(point, poly) > 0 ? 1 : 0), 0) % 2 ===
        1,
    });
    records.push({
      ownerId: o.id,
      sourceLandAnchorCount: anchors.length,
      originalRoleMembershipCounts: membership,
      multipleOrMissingRoleMemberships: contacts,
      witnesses: witnesses.map((w) => ({
        id: w.id,
        raw: measure(w.point, raw),
        simplified: measure(w.point, simple),
      })),
      scope:
        'Fixed original witnesses and role memberships only. Distances use vertex-mapped LAEA chords, omit internal collar cuts and do not certify extracted roles.',
    });
  }
  return records;
}
