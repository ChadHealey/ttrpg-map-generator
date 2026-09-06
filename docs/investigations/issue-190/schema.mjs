/** Pure input validation: no sampler, constructor or geometry imports. */
export function validateInput(id, options) {
  if (
    typeof id !== 'string' ||
    !id ||
    !options ||
    !Array.isArray(options.anatomy) ||
    options.anatomy.length !== 2 ||
    !options.anatomy.every((x) => Number.isFinite(x) && x >= -1 && x <= 1) ||
    !Number.isInteger(options.variation) ||
    Object.is(options.variation, -0) ||
    options.variation < 0 ||
    options.variation > 3
  )
    throw new RangeError('Invalid fixed anatomy/variation');
  const amplitude = [1, 0.85, 0.6, 0.3][options.variation];
  return { u: amplitude * options.anatomy[0], v: amplitude * options.anatomy[1] };
}
