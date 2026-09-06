/** Fixed-budget binary64 diagnostics for issue-175's continuous exclusion proof. */
import { EPS, samePoint } from '../issue-169/geometry.mjs';

export const PARAMETER_SLACK = 1e-12;
const det = (a, b) => a[0] * b[1] - a[1] * b[0];

/** Caller establishes a nondegenerate, origin-facing ordered mouth. */
export function wedgeFunctions(a, b) {
  const ar = Math.hypot(...a),
    br = Math.hypot(...b);
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    width = Math.hypot(dx, dy);
  return [
    (p) => det(a, p) / ar,
    (p) => det(p, b) / br,
    (p) => -(dx * (p[1] - a[1]) - dy * (p[0] - a[0])) / width,
  ];
}

/** Clip a segment against gi >= -EPS. Omitted near-parallel constraints enlarge it. */
export function clipExpandedWedge(p, q, functions) {
  let lower = 0,
    upper = 1;
  for (const g of functions) {
    const A = g(p),
      B = g(q),
      slope = B - A;
    if (![A, B, slope].every(Number.isFinite)) return { excluded: false, reason: 'nonfinite' };
    if (Math.max(A, B) < -EPS) return { excluded: true, reason: 'outside-face' };
    if (Math.abs(slope) <= EPS) continue;
    const t = (-EPS - A) / slope;
    if (!Number.isFinite(t)) return { excluded: false, reason: 'nonfinite' };
    if (slope > 0) lower = Math.max(lower, t);
    else upper = Math.min(upper, t);
  }
  return {
    excluded: lower > upper + PARAMETER_SLACK,
    reason: lower > upper + PARAMETER_SLACK ? 'empty-clip' : 'contact-or-unresolved',
    interval: [lower, upper],
  };
}

/** Structural contacts use an active face proof on the entire edge, never an endpoint waiver. */
export function excludesWedgeSegment(
  p,
  q,
  a,
  b,
  { structuralShoulders = false, functions = wedgeFunctions(a, b) } = {},
) {
  const endpoint = (u) => (samePoint(u, a) ? 0 : samePoint(u, b) ? 1 : -1);
  const pi = endpoint(p),
    qi = endpoint(q);
  if (structuralShoulders && (pi >= 0 || qi >= 0)) {
    if (pi >= 0 && qi >= 0) return { excluded: false, reason: 'two-shoulder-edge' };
    const shoulder = pi >= 0 ? pi : qi,
      other = pi >= 0 ? q : p;
    // These faces vanish exactly at the identified shoulder. Their value at t is t*g(other).
    const values = [functions[shoulder](other), functions[2](other)];
    if (!values.every(Number.isFinite)) return { excluded: false, reason: 'nonfinite' };
    return {
      excluded: values.some((value) => value < -EPS),
      reason: values.some((value) => value < -EPS) ? 'active-face' : 'shoulder-direction',
    };
  }
  return clipExpandedWedge(p, q, functions);
}
