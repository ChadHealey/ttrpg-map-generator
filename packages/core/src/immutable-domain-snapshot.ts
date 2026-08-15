/** Deterministic, dependency-free snapshots for plain persistence-ready domain values. */

import type { DeepReadonly } from './generated-aspects.js';

export type ImmutableDomainSnapshotResult<Value> =
  { readonly ok: true; readonly value: DeepReadonly<Value> } | { readonly ok: false };

/**
 * Clone and recursively freeze a plain-data value without freezing or retaining its source.
 * Accessors, symbols, sparse arrays, exotic prototypes, functions, and cyclic graphs are not
 * persistence-ready domain values, so the boundary rejects them instead of invoking or aliasing
 * caller-owned behavior.
 */
export function createImmutableDomainSnapshot<Value>(
  value: Value,
): ImmutableDomainSnapshotResult<Value> {
  const result = snapshotValue(value, new Set<object>());
  return result.ok ? { ok: true, value: result.value as DeepReadonly<Value> } : { ok: false };
}

type SnapshotResult = { readonly ok: true; readonly value: unknown } | { readonly ok: false };

function snapshotValue(value: unknown, ancestors: Set<object>): SnapshotResult {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return { ok: true, value };
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? { ok: true, value } : { ok: false };
  }
  if (typeof value !== 'object' || ancestors.has(value)) return { ok: false };

  ancestors.add(value);
  const result = Array.isArray(value)
    ? snapshotArray(value, ancestors)
    : snapshotRecord(value, ancestors);
  ancestors.delete(value);
  return result;
}

function snapshotArray(value: readonly unknown[], ancestors: Set<object>): SnapshotResult {
  const keys = Object.keys(value);
  if (
    keys.length !== value.length ||
    keys.some((key, index) => key !== String(index)) ||
    Reflect.ownKeys(value).length !== value.length + 1
  ) {
    return { ok: false };
  }

  const snapshot: unknown[] = [];
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !('value' in descriptor)) return { ok: false };
    const item = snapshotValue(descriptor.value, ancestors);
    if (!item.ok) return item;
    snapshot.push(item.value);
  }
  return { ok: true, value: Object.freeze(snapshot) };
}

function snapshotRecord(value: object, ancestors: Set<object>): SnapshotResult {
  const prototype = Object.getPrototypeOf(value) as unknown;
  if (prototype !== Object.prototype && prototype !== null) return { ok: false };

  const keys = Object.keys(value).sort(compareAscii);
  if (Reflect.ownKeys(value).length !== keys.length) return { ok: false };

  const snapshot: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !('value' in descriptor)) return { ok: false };
    const property = snapshotValue(descriptor.value, ancestors);
    if (!property.ok) return property;
    Object.defineProperty(snapshot, key, {
      configurable: false,
      enumerable: true,
      value: property.value,
      writable: false,
    });
  }
  return { ok: true, value: Object.freeze(snapshot) };
}

function compareAscii(left: string, right: string): -1 | 0 | 1 {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
