import { describe, expect, it } from 'vitest';

import {
  createImmutableDomainArray,
  createImmutableDomainSnapshot,
} from './immutable-domain-snapshot.js';

describe('immutable domain snapshots', () => {
  it('reuses only values previously owned by the snapshot boundary', () => {
    const source = Object.freeze({ values: Object.freeze([1, 2, 3]) });
    const first = createImmutableDomainSnapshot(source);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value).not.toBe(source);
    expect(first.value.values).not.toBe(source.values);

    const repeated = createImmutableDomainSnapshot(first.value);
    expect(repeated).toStrictEqual({ ok: true, value: first.value });
    if (repeated.ok) expect(repeated.value).toBe(first.value);
  });

  it('rejects sparse, accessor-backed, symbol-bearing, and enumerable-extra arrays', () => {
    const sparse = new Array<number>(3);
    sparse[0] = 1;
    sparse[2] = 3;
    const accessor = [1, 2, 3];
    Object.defineProperty(accessor, '1', { enumerable: true, get: () => 2 });
    const symbolBearing = [1, 2, 3];
    Object.defineProperty(symbolBearing, Symbol('metadata'), { value: true });
    const extra = [1, 2, 3] as number[] & { extra?: number };
    extra.extra = 4;

    expect(createImmutableDomainSnapshot(sparse).ok).toBe(false);
    expect(createImmutableDomainSnapshot(accessor).ok).toBe(false);
    expect(createImmutableDomainSnapshot(symbolBearing).ok).toBe(false);
    expect(createImmutableDomainSnapshot(extra).ok).toBe(false);
  });

  it('owns an array-like copy that later snapshot boundaries can reuse', () => {
    const source = [1, 2, 3];
    const result = createImmutableDomainArray(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    source[0] = 9;
    expect(result.value).toStrictEqual([1, 2, 3]);

    const repeated = createImmutableDomainSnapshot(result.value);
    expect(repeated.ok).toBe(true);
    if (repeated.ok) expect(repeated.value).toBe(result.value);
  });
});
