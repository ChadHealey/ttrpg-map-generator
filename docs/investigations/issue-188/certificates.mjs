/** Private whole-body bay mode; legacy calls retain the exact frozen certificate. */
import { certifyCandidate as legacy } from '../issue-178/certificates.mjs';
import { certifyBayTopology, validBay } from './topology.mjs';
import { certifyWholeBodyMouth } from './wedge-mouth.mjs';

const SLACK = 1e-9;
const invalid = (candidate, code, required) => ({
  ok: false,
  failures: [{ code, featureId: candidate?.id ?? 'owner', actual: null, required }],
  metrics: { bayCoastMode: 'whole-body' },
});
export function certifyCandidate(candidate, options = {}) {
  const { bayCoastMode = 'interior' } = options;
  if (bayCoastMode === 'interior') return legacy(candidate, options);
  if (bayCoastMode !== 'whole-body')
    return invalid(candidate, 'invalid-bay-coast-mode', 'interior or whole-body');
  if (!validBay(candidate?.bay))
    return invalid(
      candidate,
      'bay-invalid-geometry',
      'bounded finite wedge bay in whole-body mode',
    );
  const delegated = legacy({ ...candidate, bay: null }, options);
  const intentional = (f) =>
    f.code === 'missing-bay' &&
    f.featureId === candidate.id &&
    f.actual === null &&
    f.required === 'declared protected bay';
  const missing = delegated.failures.filter(intentional);
  const failures = delegated.failures.filter((f) => !intentional(f));
  const metrics = { ...delegated.metrics, bayCoastMode: 'whole-body' };
  const fail = (code, featureId, actual, required) =>
    failures.push({ code, featureId, actual, required });
  if (missing.length !== (candidate.primary === true ? 1 : 0))
    fail(
      'bay-body-delegation',
      candidate.id,
      missing.length,
      'exact intentional missing-bay diagnostic count',
    );
  const result = () => ({ ok: failures.length === 0, failures, metrics });
  if (failures.length) return result();
  const topology = certifyBayTopology(candidate, fail);
  if (!topology || failures.length) return result();
  // Every E vertex is now an exact S vertex; delegated cap and vertex count remain complete.
  const minimum = (actual, required, code, id) => {
    if (!Number.isFinite(actual) || actual < required + SLACK)
      fail(code, id, actual, `>= ${required} with numeric slack`);
  };
  const maximum = (actual, required, code, id) => {
    if (!Number.isFinite(actual) || actual > required - SLACK)
      fail(code, id, actual, `<= ${required} with numeric slack`);
  };
  metrics.bay = certifyWholeBodyMouth(candidate, {
    c: Math.cos(metrics.angularRadius / 2),
    angularRadius: metrics.angularRadius,
    bodyArea: metrics.bodyArea,
    fail,
    minimum,
    maximum,
  });
  metrics.bayTopology = {
    coastEdges: topology.coast.length - 1,
    checkedPairs: topology.pairs,
    precutPolygon: topology.precut,
  };
  return result();
}
