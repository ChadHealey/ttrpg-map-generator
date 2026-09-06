/** Exact local body fractions; these do not claim detached-owner payment. */
export const QUOTAS = Object.freeze([
  0.13106846473029043 * 0.9905,
  0.10494186046511626 * 0.9905,
  0.06666666666666667 * 0.984,
]);
export const CERTIFICATE_OPTIONS = Object.freeze({
  nominalClearance: 0.05,
  collarWidthUpperMode: 'root-and-far',
});
export function inputs() {
  return QUOTAS.flatMap((quota, quotaIndex) =>
    [
      [0, 0],
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ].flatMap((anatomy, anatomyIndex) =>
      [0, 1, 2, 3].map((variation) => ({
        id: `quota-${quotaIndex}/anatomy-${anatomyIndex}/variation-${variation}`,
        quotaIndex,
        anatomyIndex,
        quota,
        anatomy: [...anatomy],
        variation,
      })),
    ),
  );
}
