/** Construction/placement-only audit. No field evaluation or raster module is imported. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const near = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-12;
export function expectedOwners(input, stream) {
  const controls = input.controls,
    count = controls.continentCountIntent;
  const primaryCount = Math.min(count, 1 + Math.floor(stream(input.seed, 'primary-count')() * 3));
  const sizes = Array.from({ length: count }, (_, i) =>
    controls.continentDistribution === 'balanced'
      ? 0.9
      : controls.continentDistribution === 'oneDominant'
        ? i === 0
          ? 1
          : 0.55
        : i < primaryCount
          ? 0.95
          : 0.55,
  );
  const total = sizes.reduce((s, x) => s + x * x, 0),
    maximum = Math.max(...sizes.map((x) => x * x));
  return sizes.map((size, i) => ({
    id: `owner-${i}`,
    size,
    primary: size * size >= maximum * 0.5,
    quota: ((1 - controls.targetWaterCoveragePercent / 100) * size * size) / total,
  }));
}
export function checkConstruction(input, construction, runtime) {
  const issues = [],
    expected = expectedOwners(input, runtime.stream),
    seen = new Set();
  const fail = (code, details = {}) => issues.push({ code, ...details });
  if (
    !construction ||
    !Array.isArray(construction.owners) ||
    !Array.isArray(construction.receipts) ||
    !Array.isArray(construction.failures)
  ) {
    fail('audit.construction-shape');
    return issues;
  }
  if (
    construction.ok &&
    (construction.owners.length !== expected.length || construction.failures.length)
  )
    fail('audit.false-construction-success');
  if (!construction.ok && !construction.failures.length)
    fail('audit.unexplained-construction-failure');
  if (construction.receipts.length > expected.length * runtime.TEMPLATE_LIMIT)
    fail('audit.template-budget');
  for (const receipt of construction.receipts) {
    if (
      !expected.some((o) => o.id === receipt.ownerId) ||
      !Number.isInteger(receipt.templateIndex) ||
      receipt.templateIndex < 0 ||
      receipt.templateIndex >= runtime.TEMPLATE_LIMIT
    )
      fail('audit.invalid-template-receipt');
  }
  for (const target of expected) {
    const receipts = construction.receipts.filter((r) => r.ownerId === target.id);
    if (receipts.length > runtime.TEMPLATE_LIMIT || receipts.some((r, i) => r.templateIndex !== i))
      fail('audit.template-order', { ownerId: target.id });
  }
  for (const target of expected) {
    const attempts = construction.receipts.filter((r) => r.ownerId === target.id);
    const owner = construction.owners.find((o) => o.id === target.id);
    const selected = attempts.filter((r) => r.ok);
    if (owner) {
      const last = attempts.at(-1);
      if (
        !last ||
        selected.length !== 1 ||
        !last.ok ||
        !last.certificateOk ||
        last.failures.length ||
        !near(last.quota, owner.quota) ||
        last.layoutIndex !== owner.candidate.layoutIndex
      )
        fail('audit.selection-ledger', { ownerId: target.id });
    } else if (
      attempts.length !== runtime.TEMPLATE_LIMIT ||
      selected.length ||
      !construction.failures.some(
        (f) =>
          f.ownerId === target.id &&
          f.code === 'template-budget-exhausted' &&
          f.candidateCount === runtime.TEMPLATE_LIMIT,
      )
    )
      fail('audit.exhaustion-ledger', { ownerId: target.id });
    if (attempts.some((r) => !near(r.quota, target.quota) || (!r.ok && !r.failures.length)))
      fail('audit.attempt-ledger', { ownerId: target.id });
  }
  const islandShare = (input.controls.islandAbundancePercent * 0.02) / 100,
    archShare = (input.controls.archipelagoAbundancePercent * 0.01) / 100;
  const categories = [
    [
      'island',
      islandShare,
      input.controls.islandAbundancePercent === 0
        ? 0
        : Math.ceil(input.controls.islandAbundancePercent / 25),
    ],
    [
      'archipelago',
      archShare,
      input.controls.archipelagoAbundancePercent === 0
        ? 0
        : Math.max(2, Math.ceil(input.controls.archipelagoAbundancePercent / 15)),
    ],
  ];
  for (const owner of construction.owners) {
    const target = expected.find((o) => o.id === owner.id);
    if (!target || seen.has(owner.id)) {
      fail('audit.owner-identity', { ownerId: owner.id });
      continue;
    }
    seen.add(owner.id);
    if (
      !near(owner.quota, target.quota) ||
      owner.size !== target.size ||
      owner.primary !== target.primary ||
      owner.candidate?.primary !== target.primary
    )
      fail('audit.owner-budget-or-role', { ownerId: owner.id });
    if (!Number.isFinite(owner.radius) || owner.radius <= 0 || owner.candidate?.id !== owner.id)
      fail('audit.owner-guard-or-candidate', { ownerId: owner.id });
    const actual = runtime.certifyCandidate(owner.candidate, {
      quota: target.quota,
      ...runtime.CERTIFICATE_OPTIONS,
    });
    if (!actual.ok)
      fail('audit.uncertified-owner', { ownerId: owner.id, failures: actual.failures });
    if (digest(actual) !== digest(owner.certificate))
      fail('audit.certificate-receipt', { ownerId: owner.id });
    if (!near(owner.radius, actual.metrics.guardRadius) || actual.metrics.vertexCount > 256)
      fail('audit.guard-or-vertex-budget', { ownerId: owner.id });
    if (!near(actual.metrics.bodyArea, target.quota * (1 - islandShare - archShare)))
      fail('audit.body-payment', { ownerId: owner.id });
    for (const [kind, share, count] of categories) {
      const members = owner.candidate.islands.filter((i) => i.kind === kind);
      if (
        members.length !== count ||
        !near(
          members.reduce((s, i) => s + runtime.polygonArea(i.polygon), 0) / (4 * Math.PI),
          target.quota * share,
        )
      )
        fail('audit.detached-payment', { ownerId: owner.id, kind });
    }
    if (
      owner.candidate.islands.length > 11 ||
      owner.candidate.siteReceipts?.some(
        (r) =>
          !Number.isInteger(r.attempt) ||
          r.attempt < 1 ||
          r.attempt > 24 ||
          !Number.isInteger(r.anchor) ||
          r.anchor < 0 ||
          r.anchor > 5,
      )
    )
      fail('audit.island-site-budget', { ownerId: owner.id });
  }
  if (
    construction.ok &&
    !near(
      construction.owners.reduce((s, o) => s + o.quota, 0),
      1 - input.controls.targetWaterCoveragePercent / 100,
    )
  )
    fail('audit.total-quota');
  return issues;
}
export function checkPlacement(construction, placement, runtime) {
  const issues = [],
    fail = (code, details = {}) => issues.push({ code, ...details });
  if (!placement || !Array.isArray(placement.owners) || !Array.isArray(placement.failures)) {
    fail('audit.placement-shape');
    return issues;
  }
  if (
    !Number.isInteger(placement.candidateCount) ||
    placement.candidateCount < 0 ||
    !Number.isInteger(placement.attempts) ||
    placement.attempts < 0 ||
    placement.candidateCount > runtime.MAX_CENTER_EVALUATIONS ||
    placement.attempts > runtime.MAX_ATTEMPTS
  )
    fail('audit.placement-budget');
  if (!placement.ok) {
    if (placement.owners.length || !placement.failures.length)
      fail('audit.false-placement-failure');
    return issues;
  }
  if (
    placement.owners.length !== construction.owners.length ||
    new Set(placement.owners.map((o) => o.id)).size !== placement.owners.length
  )
    fail('audit.false-placement-success');
  for (const owner of placement.owners) {
    const original = construction.owners.find((o) => o.id === owner.id),
      { center, east, north, ...unchanged } = owner;
    if (!original || digest(unchanged) !== digest(original))
      fail('audit.placement-owner-mutated', { ownerId: owner.id });
    if (
      [center, east, north].some(
        (v) =>
          !Array.isArray(v) ||
          v.length !== 3 ||
          !v.every(Number.isFinite) ||
          !near(Math.hypot(...v), 1),
      )
    ) {
      fail('audit.placement-frame', { ownerId: owner.id });
      continue;
    }
    if (
      !near(center[1] * east[2] - center[2] * east[1], north[0]) ||
      !near(center[2] * east[0] - center[0] * east[2], north[1]) ||
      !near(center[0] * east[1] - center[1] * east[0], north[2]) ||
      !near(runtime.dot(center, east), 0) ||
      !near(runtime.dot(center, north), 0) ||
      !near(runtime.dot(east, north), 0)
    )
      fail('audit.placement-frame', { ownerId: owner.id });
  }
  const pairs = [];
  for (let i = 0; i < placement.owners.length; i++)
    for (let j = i + 1; j < placement.owners.length; j++) {
      const a = placement.owners[i],
        b = placement.owners[j],
        distance = runtime.angle(a.center, b.center),
        requiredDistance = a.radius + b.radius + runtime.GAP_RAD;
      if (distance < requiredDistance + runtime.GAP_SLACK_RAD)
        fail('audit.placement-gap', { ownerIds: [a.id, b.id] });
      pairs.push({
        ownerIds: [a.id, b.id],
        distance,
        requiredDistance,
        gap: distance - a.radius - b.radius,
      });
    }
  const pairKey = (ids) => [...ids].sort().join('/');
  const published = new Map((placement.pairs ?? []).map((p) => [pairKey(p.ownerIds), p]));
  if (
    published.size !== pairs.length ||
    placement.pairs?.length !== pairs.length ||
    pairs.some((p) => {
      const q = published.get(pairKey(p.ownerIds));
      return !q || !['distance', 'requiredDistance', 'gap'].every((key) => near(p[key], q[key]));
    })
  )
    fail('audit.placement-pair-receipts');
  const gap = pairs.length ? Math.min(...pairs.map((p) => p.gap)) : null;
  if (gap === null ? placement.minimumGap !== null : !near(gap, placement.minimumGap))
    fail('audit.placement-minimum-gap');
  return issues;
}
export function evaluateProbe(probe, runtime) {
  const before = structuredClone(probe),
    input = probe.input;
  let construction,
    placement = null,
    exception = null;
  const issues = [];
  try {
    construction = runtime.constructOwners(input);
    issues.push(...checkConstruction(input, construction, runtime));
    if (construction.ok && issues.length === 0) {
      placement = runtime.placeOwners(construction.owners, input.seed);
      issues.push(...checkPlacement(construction, placement, runtime));
    }
  } catch (error) {
    exception = { name: error.name, message: error.message };
    issues.push({ code: 'audit.exception' });
  }
  if (digest(before) !== digest(probe)) issues.push({ code: 'audit.input-mutated' });
  const expected = expectedOwners(input, runtime.stream);
  return {
    probe,
    expected,
    construction: construction ?? null,
    placement,
    exception,
    issues,
    status: issues.length
      ? 'audit-failure'
      : !construction.ok
        ? 'construction-no-proposal'
        : !placement?.ok
          ? 'placement-no-proposal'
          : 'geometry-and-placement-pass',
    semanticStatus: 'not-evaluated-unverified',
    geometryFingerprint: construction ? digest(construction.owners) : null,
    placementFingerprint: placement ? digest(placement.owners) : null,
  };
}
export function repeatProbe(probe, runtime) {
  const first = evaluateProbe(structuredClone(probe), runtime),
    second = evaluateProbe(structuredClone(probe), runtime);
  assert.deepEqual(
    second,
    first,
    'Probe repeat differs; no deterministic receipt can be published',
  );
  return {
    result: first,
    repeat: { equal: true, firstSha256: digest(first), secondSha256: digest(second) },
  };
}
export function summarize(rows) {
  const result = {
    total: rows.length,
    cohorts: {},
    statuses: {},
    constructionFailureCodes: {},
    placementFailureCodes: {},
    candidateFailureCodes: {},
    examples: {},
    controlFingerprints: [],
  };
  const add = (map, key) => (map[key] = (map[key] ?? 0) + 1);
  for (const row of rows) {
    const r = row.result,
      cohort = r.probe.cohort;
    result.cohorts[cohort] ??= { total: 0, statuses: {} };
    result.cohorts[cohort].total++;
    add(result.cohorts[cohort].statuses, r.status);
    add(result.statuses, r.status);
    for (const f of r.construction?.failures ?? []) add(result.constructionFailureCodes, f.code);
    for (const receipt of r.construction?.receipts ?? [])
      for (const f of receipt.failures ?? []) add(result.candidateFailureCodes, f.code);
    for (const f of r.placement?.failures ?? []) add(result.placementFailureCodes, f.code);
    if (r.status !== 'geometry-and-placement-pass' && !result.examples[r.status])
      result.examples[r.status] = {
        id: r.probe.input.id,
        seed: r.probe.input.seed,
        failures: r.construction?.failures,
        placementFailures: r.placement?.failures,
        issues: r.issues,
      };
    if (cohort === 'control')
      result.controlFingerprints.push({
        id: r.probe.input.id,
        status: r.status,
        geometry: r.geometryFingerprint,
        placement: r.placementFingerprint,
      });
  }
  return result;
}
