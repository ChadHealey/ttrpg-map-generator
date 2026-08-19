/** Deterministic, dependency-free snapshots for plain persistence-ready domain values. */

import type { DeepReadonly } from './generated-aspects.js';

export type ImmutableDomainSnapshotResult<Value> =
  { readonly ok: true; readonly value: DeepReadonly<Value> } | { readonly ok: false };

const immutableDomainSnapshots = new WeakSet<object>();

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

/** Copy an array-like value into an owned immutable array later snapshot boundaries can reuse. */
export function createImmutableDomainArray<Value>(
  values: ArrayLike<Value>,
): ImmutableDomainSnapshotResult<readonly Value[]> {
  if (!Number.isSafeInteger(values.length) || values.length < 0) return { ok: false };
  const snapshot = Array.from(values) as unknown[];
  const ancestors = new Set<object>();
  for (let index = 0; index < snapshot.length; index += 1) {
    const value = snapshot[index];
    if (
      value === null ||
      value === undefined ||
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      snapshot[index] = value;
      continue;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return { ok: false };
      snapshot[index] = value;
      continue;
    }
    const item = snapshotValue(value, ancestors);
    if (!item.ok) return item;
    snapshot[index] = item.value;
  }
  const frozen = Object.freeze(snapshot);
  immutableDomainSnapshots.add(frozen);
  return { ok: true, value: frozen as DeepReadonly<readonly Value[]> };
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
  if (immutableDomainSnapshots.has(value)) return { ok: true, value };

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
  const frozen = Object.freeze(snapshot);
  immutableDomainSnapshots.add(frozen);
  return { ok: true, value: frozen };
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
  const frozen = Object.freeze(snapshot);
  immutableDomainSnapshots.add(frozen);
  return { ok: true, value: frozen };
}

/** True only for an object graph node created and owned by this snapshot boundary. */
export function isImmutableDomainSnapshot(value: object): boolean {
  return immutableDomainSnapshots.has(value);
}

/** Mark a project-owned immutable value that intentionally is not plain persistence data. */
export function registerImmutableDomainSnapshot<Value extends object>(value: Value): Value {
  immutableDomainSnapshots.add(value);
  return value;
}

function compareAscii(left: string, right: string): -1 | 0 | 1 {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
