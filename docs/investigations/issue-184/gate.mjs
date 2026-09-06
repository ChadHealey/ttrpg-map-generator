/** Actual certificate/placement gate over the complete declared134-input corpus. */
import { stream } from '../issue-164/morphology.mjs';
import { polygonArea } from '../issue-169/geometry.mjs';
import * as placement from '../issue-170/placement.mjs';
import { certifyCandidate } from '../issue-178/certificates.mjs';
import { repeatProbe } from '../issue-180/audit-final.mjs';
import { probes, retainedInputs } from './corpus.mjs';
import { CERTIFICATE_OPTIONS, TEMPLATE_LIMIT } from './templates.mjs';

export function assessRows(rows) {
  const expected = probes();
  const failures = [];
  if (rows.length !== 134 || new Set(rows.map((r) => r.probe.input.id)).size !== 134)
    failures.push({ code: 'incomplete-corpus' });
  for (const input of expected) {
    const row = rows.find((r) => r.probe.input.id === input.input.id);
    if (
      !row ||
      JSON.stringify(row.probe) !== JSON.stringify(input) ||
      row.status !== 'geometry-and-placement-pass'
    )
      failures.push({ code: 'failed-probe', id: input.input.id, status: row?.status ?? 'missing' });
  }
  const ordinary = new Set(retainedInputs.slice(0, 4).map((i) => i.id));
  const layouts = [
    ...new Set(
      rows
        .filter((r) => ordinary.has(r.probe.input.id))
        .flatMap(
          (r) =>
            r.construction?.owners.filter((o) => o.primary).map((o) => o.candidate.layoutIndex) ??
            [],
        ),
    ),
  ].sort();
  if (![0, 1, 2].every((i) => layouts.includes(i)))
    failures.push({ code: 'missing-ordinary-layout', layouts });
  const recoveredRows = ['default-001', 'default-004', 'default-006'].map((id) => {
    const row = rows.find((r) => r.probe.input.id === id);
    const primaryLayouts = [
      ...new Set(
        row?.construction?.owners.filter((o) => o.primary).map((o) => o.candidate.layoutIndex) ??
          [],
      ),
    ].sort();
    if (
      row?.status !== 'geometry-and-placement-pass' ||
      primaryLayouts.length !== 1 ||
      primaryLayouts[0] !== 3
    )
      failures.push({ code: 'missing-recovered-layout', id });
    return { id, primaryLayouts };
  });
  const recoveredLayouts = [...new Set(recoveredRows.flatMap((r) => r.primaryLayouts))].sort();
  return {
    recoveredRows,
    recoveredLayouts,
    readyForComparison: failures.length === 0,
    completeCohortPassed: failures.length === 0,
    failures,
    layouts,
  };
}
export function fullGate(constructOwners) {
  const runtime = {
    ...placement,
    constructOwners,
    stream,
    polygonArea,
    certifyCandidate,
    CERTIFICATE_OPTIONS,
    TEMPLATE_LIMIT,
  };
  const rows = probes().map((probe) => repeatProbe(probe, runtime).result);
  return {
    ...assessRows(rows),
    exactRepeat: true,
    rows: rows.map((r) => ({
      id: r.probe.input.id,
      seed: r.probe.input.seed,
      status: r.status,
      issues: r.issues,
      constructionFailures: r.construction?.failures,
      placementFailures: r.placement?.failures,
      owners: r.construction?.owners.map((o) => ({
        id: o.id,
        quota: o.quota,
        radius: o.radius,
        primary: o.primary,
        layoutIndex: o.candidate.layoutIndex,
      })),
    })),
  };
}
