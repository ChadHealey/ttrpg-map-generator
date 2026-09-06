/** Stage retention and finite accounting; runtime injected only after source authority. */
import assert from 'node:assert/strict';

import { BUDGET, capacity, corpus, expectedDuplicate, SEEDS } from './corpus.mjs';
import { digest, fragmentation, polarComparison } from './metrics.mjs';
export class Budget {
  constructor() {
    this.counts = Object.fromEntries(
      [
        'constructorCalls',
        'placementCalls',
        'templateAttempts',
        'uniqueFieldCalls',
        'scalarEvaluations',
        'partitions',
        'semanticCalls',
      ].map((k) => [k, 0]),
    );
  }
  charge(key, amount = 1) {
    assert(
      Object.hasOwn(this.counts, key) && Number.isSafeInteger(amount) && amount >= 0,
      'Invalid budget charge',
    );
    assert(this.counts[key] + amount <= BUDGET[key], `Budget exceeded: ${key}`);
    this.counts[key] += amount;
  }
}
const failure = (e) => ({
  name: e.name ?? 'Error',
  message: String(e.message ?? e).replaceAll(
    /(?:\/Users\/|\/private\/tmp\/|\/tmp\/)[^\s)]+/g,
    '[local path]',
  ),
});
export function constructRows(runtime, budget, inputs = corpus()) {
  return inputs.map((input) => {
    const before = digest(input),
      row = {
        input,
        stages: [],
        failures: [],
        construction: null,
        placement: null,
        fieldKey: null,
        proposalPresent: false,
        geometryValid: false,
      };
    let stage = 'input-validation';
    try {
      const parsed = runtime.core.parseAtlasControls(input.controls);
      row.inputValid = parsed.ok;
      if (!parsed.ok) {
        row.failures.push({ code: 'invalid-public-controls', diagnostics: parsed.diagnostics });
        row.status = 'invalid-input';
        return row;
      }
      const diagnostics = runtime.core.validateAtlasControls(parsed.value);
      assert.equal(diagnostics.length, 0);
      row.stages.push({ stage, status: 'completed' });
      const analytic = capacity(parsed.value);
      row.capacity = analytic;
      if (analytic) {
        row.status = 'unsupported-family-capacity';
        row.stages.push({ stage: 'construction', status: 'not-attempted-analytic' });
        return row;
      }
      stage = 'construction';
      budget.charge('constructorCalls');
      row.stages.push({ stage, status: 'attempted' });
      row.construction = runtime.constructOwners(input);
      budget.charge('templateAttempts', row.construction.receipts.length);
      const issues = runtime.checkConstruction(input, row.construction, runtime);
      row.failures.push(...issues);
      if (issues.length) {
        row.status = 'construction-audit-failure';
        return row;
      }
      if (!row.construction.ok) {
        row.status = 'construction-no-proposal';
        return row;
      }
      row.fragmentation = fragmentation(row.construction.owners);
      stage = 'placement';
      budget.charge('placementCalls');
      row.stages.push({ stage, status: 'attempted' });
      row.placement = runtime.placeOwners(row.construction.owners, input.seed);
      const placed = runtime.checkPlacement(row.construction, row.placement, runtime);
      row.failures.push(...placed);
      row.geometryValid = placed.length === 0 && row.placement.ok;
      row.status = placed.length
        ? 'placement-audit-failure'
        : row.placement.ok
          ? 'geometry-pass'
          : 'placement-no-proposal';
    } catch (e) {
      row.status = `${stage}-exception`;
      row.failures.push({ code: row.status, error: failure(e) });
    } finally {
      if (digest(input) !== before) {
        row.status = 'input-mutated';
        row.failures.push({ code: 'input-mutated' });
      }
    }
    return row;
  });
}
/** Exact projection: exclusions occur only at construction.recipe, never in owners. */
export function fieldInput(row) {
  assert.equal(row.status, 'geometry-pass');
  assert(row.placement.owners.length > 0);
  const construction = structuredClone(row.construction);
  for (const key of ['physicalKmPerRadian', 'fragmentationBand', 'oceanConnectivity'])
    delete construction.recipe[key];
  return { fieldRevision: 'issue-169-fixed-zero-v1', construction, placement: row.placement };
}
export function groupFields(rows) {
  const map = new Map(),
    failures = [];
  for (const row of rows) {
    if (row.status !== 'geometry-pass') continue;
    const value = fieldInput(row),
      text = JSON.stringify(value),
      key = digest(value);
    const duplicate = expectedDuplicate(row.input.id),
      other = rows.find((r) => r.input.id === duplicate);
    if (
      duplicate &&
      other?.status === 'geometry-pass' &&
      JSON.stringify(fieldInput(other)) !== text
    )
      failures.push({ code: 'expected-dedup-mismatch', id: row.input.id, reference: duplicate });
    if (map.has(key)) assert.equal(map.get(key).text, text, 'Digest collision');
    else map.set(key, { key, text, rows: [] });
    map.get(key).rows.push(row);
    row.fieldKey = key;
  }
  if (map.size > BUDGET.uniqueFieldCalls)
    failures.push({
      code: 'unique-field-budget',
      actual: map.size,
      maximum: BUDGET.uniqueFieldCalls,
    });
  return {
    groups: failures.length ? [] : [...map.values()],
    failures,
    prospectiveUniqueFields: map.size,
  };
}
export async function evaluateRows(runtime, budget, visit, inputs = corpus()) {
  const rows = constructRows(runtime, budget, inputs),
    grouped = groupFields(rows);
  if (grouped.failures.length)
    for (const row of rows)
      if (row.status === 'geometry-pass') {
        row.status = 'dedup-no-proposal';
        row.failures.push(...grouped.failures);
      }
  const fields = [];
  for (const group of grouped.groups) {
    const key = group.key,
      source = group.rows[0];
    let sampled,
      stage = 'sampling';
    try {
      budget.charge('uniqueFieldCalls');
      sampled = await runtime.sampleField(source, runtime, budget);
    } catch (e) {
      sampled = {
        ok: false,
        summary: { key, status: `${stage}-exception`, error: failure(e) },
        bits: Buffer.alloc(0),
      };
    }
    // Artifact I/O failures abort; never overwrite an earlier retained file in a recovery path.
    await visit(`field-${key}.json`, sampled.summary);
    await visit(`field-${key}.bits`, sampled.bits);
    fields.push({ key, summary: sampled.summary });
    if (!sampled.ok) {
      for (const row of group.rows) {
        row.fieldSummary = sampled.summary;
        row.status = 'field-no-proposal';
        row.failures.push({ code: sampled.summary.status, error: sampled.summary.error });
        row.stages.push({ stage: 'semantic', status: 'not-attempted-field-failure' });
      }
      continue;
    }
    for (const row of group.rows) {
      row.fieldSummary = sampled.summary;
      row.stages.push({
        stage: 'sampling',
        status: row === source ? 'completed' : 'shared-exact-field',
        sourceRow: source.input.id,
      });
      try {
        budget.charge('semanticCalls');
        row.stages.push({ stage: 'semantic', status: 'attempted' });
        row.semantic = runtime.semantic(sampled, row.input.controls.oceanConnectivity, runtime);
        row.status =
          row.semantic.predicate.pass && sampled.summary.coverage.totalCoveragePass
            ? 'diagnostics-completed'
            : 'control-no-proposal';
      } catch (e) {
        row.status = 'semantic-exception';
        row.failures.push({ code: 'semantic-exception', error: failure(e) });
      }
    }
  }
  for (const row of rows) {
    const { fieldSummary, ...receipt } = row;
    await visit(`${row.input.id}.json`, {
      ...receipt,
      fieldSummary: fieldSummary
        ? {
            key: row.fieldKey,
            status: fieldSummary.status,
            coverage: fieldSummary.coverage ?? null,
            polar: fieldSummary.polar ?? null,
          }
        : null,
    });
  }
  const pairs = pairReports(rows);
  const decision = {
    revision: 'issue-189-D3-r1',
    selectedProposal: null,
    fullPublicDomainSupported: false,
    counts: budget.counts,
    dedupFailures: grouped.failures,
    fields: fields.map((f) => f.key),
    rows: rows.map((r) => ({
      id: r.input.id,
      inputValid: r.inputValid,
      status: r.status,
      fieldKey: r.fieldKey,
      failures: r.failures,
      semantic: r.semantic?.predicate ?? null,
    })),
    pairs,
    limitations: [
      'D1 sampled-component survival and extracted-role correspondence remain unproved',
      'Rejected visual family is not selected',
      'Semantic keys are transient analysis indices, not EntityIds',
    ],
  };
  await visit('decision.json', decision);
  return decision;
}

export function pairPrerequisites(rows) {
  const details = rows.map((row) => ({
    id: row?.input.id ?? null,
    geometryValid: row?.geometryValid === true,
    completedField: row?.fieldSummary?.status === 'completed',
    totalCoveragePass: row?.fieldSummary?.coverage?.totalCoveragePass === true,
    semanticOutcomePass: row?.semantic?.predicate?.pass === true,
  }));
  return {
    rows: details,
    measurementEligible: details.every(
      (r) => r.geometryValid && r.completedField && r.totalCoveragePass,
    ),
    semanticOutcomesPass: details.every((r) => r.semanticOutcomePass),
  };
}
export function pairReports(rows) {
  return SEEDS.map((seed, i) => {
    const get = (name) => rows.find((r) => r.input.id === `paired-${i + 1}-${name}`),
      baseline = get('baseline'),
      lo = get('fragmentation-0'),
      hi = get('fragmentation-100');
    const polarRows = [get('polar-ocean'), baseline, get('polar-land')],
      polarPrerequisites = pairPrerequisites(polarRows),
      rawPolar = polarComparison(...polarRows.map((r) => r?.fieldSummary?.polar));
    const fPrerequisites = pairPrerequisites([lo, baseline, hi]);
    const fAvailable = !!(lo?.fragmentation && baseline?.fragmentation && hi?.fragmentation);
    const sourceIncrease =
      fAvailable &&
      lo.fragmentation.quotaWeightedHullDeficit < baseline.fragmentation.quotaWeightedHullDeficit &&
      baseline.fragmentation.quotaWeightedHullDeficit < hi.fragmentation.quotaWeightedHullDeficit;
    return {
      seed,
      polar: {
        rawComparison: rawPolar,
        prerequisites: polarPrerequisites,
        necessaryDirectionPass:
          polarPrerequisites.measurementEligible && rawPolar.necessaryDirectionPass === true,
        completeControlDiagnosticPass:
          polarPrerequisites.measurementEligible &&
          polarPrerequisites.semanticOutcomesPass &&
          rawPolar.necessaryDirectionPass === true,
      },
      fragmentation: {
        status: fAvailable ? 'source-diagnostic-evaluated' : 'not-evaluated-incomplete-source',
        low: lo?.fragmentation ?? null,
        neutral: baseline?.fragmentation ?? null,
        high: hi?.fragmentation ?? null,
        sourceStrictIncrease: sourceIncrease,
        exactBodyEquality:
          fAvailable &&
          digest(lo.fragmentation) === digest(baseline.fragmentation) &&
          digest(hi.fragmentation) === digest(baseline.fragmentation),
        prerequisites: fPrerequisites,
        completeControlDiagnosticPass:
          fPrerequisites.measurementEligible &&
          fPrerequisites.semanticOutcomesPass &&
          sourceIncrease,
      },
    };
  });
}
