/** Two fixed component fixtures, not complete primary owners. */
export const options = Object.freeze({
  nominalClearance: 0.05,
  collarWidthUpperMode: 'root-and-far',
  bayCoastMode: 'whole-body',
});
export function inputs() {
  return [{ id: 'peninsula-bank' }, { id: 'lobe-bank' }];
}
