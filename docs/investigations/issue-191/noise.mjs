/** Project-owned 2D integer-hash gradient field with quintic polynomial fade. */
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const mix = (a, b, t) => a + (b - a) * t;
function gradient(x, y, seed, dx, dy) {
  let h = (Math.imul(x, 0x45d9f3b) ^ Math.imul(y, 0x27d4eb2d) ^ seed) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h ^= h >>> 16;
  switch (h & 7) {
    case 0:
      return dx;
    case 1:
      return -dx;
    case 2:
      return dy;
    case 3:
      return -dy;
    case 4:
      return (dx + dy) * Math.SQRT1_2;
    case 5:
      return (dx - dy) * Math.SQRT1_2;
    case 6:
      return (-dx + dy) * Math.SQRT1_2;
    default:
      return (-dx - dy) * Math.SQRT1_2;
  }
}
export function noise(x, y, seed) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    dx = x - ix,
    dy = y - iy;
  return mix(
    mix(gradient(ix, iy, seed, dx, dy), gradient(ix + 1, iy, seed, dx - 1, dy), fade(dx)),
    mix(
      gradient(ix, iy + 1, seed, dx, dy - 1),
      gradient(ix + 1, iy + 1, seed, dx - 1, dy - 1),
      fade(dx),
    ),
    fade(dy),
  );
}
export const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : fade(t));
