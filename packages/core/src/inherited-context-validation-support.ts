/** Shared deterministic helpers for inherited-context trust-boundary validation. */

import {
  INHERITED_CONTEXT_DIAGNOSTIC_CODES,
  type InheritedContextDiagnostic,
  type InheritedContextParseResult,
} from './inherited-context-model.js';

export type UnknownRecord = Readonly<Record<string, unknown>>;

export type RegionalExtentLike = Readonly<{
  minXMillimeters: number;
  maxXMillimeters: number;
  minYMillimeters: number;
  maxYMillimeters: number;
}>;

export type RegionalPointLike = Readonly<{ xMillimeters: number; yMillimeters: number }>;

export function array(value: unknown): readonly unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hasExactKeys(
  value: UnknownRecord,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const keys = Object.keys(value).sort(compareAscii);
  const allowed = [...required, ...optional].sort(compareAscii);
  return (
    Reflect.ownKeys(value).length === keys.length &&
    required.every((key) => Object.hasOwn(value, key)) &&
    keys.every((key) => allowed.includes(key))
  );
}

export function isStrictlyOrdered<Value>(
  values: readonly Value[],
  key: (value: Value) => string,
): boolean {
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (previous === undefined || current === undefined || key(previous) >= key(current))
      return false;
  }
  return true;
}

export function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function extentCorners(extent: RegionalExtentLike): readonly RegionalPointLike[] {
  return [
    { xMillimeters: extent.minXMillimeters, yMillimeters: extent.minYMillimeters },
    { xMillimeters: extent.minXMillimeters, yMillimeters: extent.maxYMillimeters },
    { xMillimeters: extent.maxXMillimeters, yMillimeters: extent.minYMillimeters },
    { xMillimeters: extent.maxXMillimeters, yMillimeters: extent.maxYMillimeters },
  ];
}

export function isInsideExtent(point: RegionalPointLike, extent: RegionalExtentLike): boolean {
  return (
    point.xMillimeters >= extent.minXMillimeters &&
    point.xMillimeters <= extent.maxXMillimeters &&
    point.yMillimeters >= extent.minYMillimeters &&
    point.yMillimeters <= extent.maxYMillimeters
  );
}

export function diagnostic(
  key: keyof typeof INHERITED_CONTEXT_DIAGNOSTIC_CODES,
  subject: string,
  message: string,
): InheritedContextDiagnostic {
  return { code: INHERITED_CONTEXT_DIAGNOSTIC_CODES[key], subject, message };
}

export function failed(
  ...diagnostics: readonly InheritedContextDiagnostic[]
): InheritedContextParseResult {
  return { ok: false, diagnostics: orderDiagnostics(diagnostics) };
}

export function orderDiagnostics(
  diagnostics: readonly InheritedContextDiagnostic[],
): readonly InheritedContextDiagnostic[] {
  return Object.freeze(
    [...diagnostics].sort(
      (left, right) =>
        compareAscii(left.code, right.code) ||
        compareAscii(left.subject, right.subject) ||
        compareAscii(left.message, right.message),
    ),
  );
}

export function compareAscii(left: string, right: string): -1 | 0 | 1 {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
