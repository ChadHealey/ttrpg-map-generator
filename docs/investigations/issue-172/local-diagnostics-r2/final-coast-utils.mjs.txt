export const add = (a, b, s = 1) => [a[0] + s * b[0], a[1] + s * b[1]];
export function cubic(a, b, c, d, steps = 4) {
  return Array.from({ length: steps }, (_, i) => {
    const t = (i + 1) / steps,
      u = 1 - t;
    return i === steps - 1
      ? d
      : [0, 1].map(
          (k) => u * u * u * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t * t * t * d[k],
        );
  });
}
