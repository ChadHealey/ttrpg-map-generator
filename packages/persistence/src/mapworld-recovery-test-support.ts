import { decodeBase64Bytes } from './base64-bytes.js';
import { canonicalJsonBytes } from './canonical-json.js';
import { classifyMapworldRecoverySnapshot } from './mapworld-recovery-classification.js';
import { createMapworldSavePlan } from './mapworld-recovery-marker.js';
import type { MapworldSavePlan } from './mapworld-recovery-model.js';
import { createProofDocument } from './mapworld-test-support.js';

export const TARGET_NAME = 'World.mapworld';
export const ABSENT_TARGET = absent('1');
export const ABSENT_TEMPORARY = absent('2');
export const ABSENT_BACKUP = absent('3');
export const ABSENT_MARKER = absent('4');

export const OLD_PLAN: MapworldSavePlan = savePlan(0, 'first-save');
export const FIRST_PLAN = savePlan(1, 'first-save');
export const REPLACEMENT_PLAN = savePlan(1, 'replacement-save', OLD_PLAN.candidateManifestSha256);
export const THIRD_PLAN = savePlan(2, 'first-save');
export const OLD_PACKAGE = directory('a', OLD_PLAN);
export const NEW_PACKAGE = directory('b', REPLACEMENT_PLAN);
export const NEW_DUPLICATE = directory('c', REPLACEMENT_PLAN);
export const THIRD_PACKAGE = directory('d', THIRD_PLAN);
export const FIRST_MARKER = regular('e', planMarkerBytes(FIRST_PLAN));
export const REPLACEMENT_MARKER = regular('f', planMarkerBytes(REPLACEMENT_PLAN));

export function rawSnapshot(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    targetName: TARGET_NAME,
    snapshotId: token('0'),
    target: ABSENT_TARGET,
    temporary: ABSENT_TEMPORARY,
    backup: ABSENT_BACKUP,
    marker: ABSENT_MARKER,
    ...overrides,
  };
}

export function absent(character: string) {
  return { kind: 'absent', observationToken: token(character) };
}

export function emptyDirectory(character: string) {
  return { kind: 'empty-directory', observationToken: token(character) };
}

export function regular(character: string, bytes: readonly number[]) {
  return { kind: 'regular-file', observationToken: token(character), bytes: [...bytes] };
}

export function wrongKind(character: string, kind: 'special' | 'symlink') {
  return { kind, observationToken: token(character) };
}

export function unreadable(
  character: string,
  primitive: string,
  osErrorNumber: number,
  osErrorName: string,
) {
  return {
    kind: 'unreadable',
    observationToken: token(character),
    osContext: { primitive, osErrorNumber, osErrorName },
  };
}

export function invalidDirectory(character: string) {
  return directoryEntries(character, [{ path: 'manifest.json', bytes: [0x7b] }]);
}

export function directory(character: string, plan: MapworldSavePlan) {
  return directoryEntries(
    character,
    plan.files.map(({ path, bytesBase64 }) => ({
      path,
      bytes: Array.from(requiredBase64(bytesBase64)),
    })),
  );
}

export function directoryEntries(
  character: string,
  entries: readonly { readonly path: string; readonly bytes: readonly number[] }[],
) {
  return {
    kind: 'directory',
    observationToken: token(character),
    entries: [...entries].sort(({ path: left }, { path: right }) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  };
}

export function markerBytesWith(overrides: Readonly<Record<string, unknown>>): readonly number[] {
  const marker = JSON.parse(
    new TextDecoder().decode(requiredBase64(FIRST_PLAN.markerBase64)),
  ) as Record<string, unknown>;
  return canonicalBytes({ ...marker, ...overrides });
}

export function planMarkerBytes(plan: MapworldSavePlan): readonly number[] {
  return Array.from(requiredBase64(plan.markerBase64));
}

function requiredBase64(value: string): Uint8Array {
  const bytes = decodeBase64Bytes(value, Number.MAX_SAFE_INTEGER);
  if (bytes === null) throw new Error('Test save plan contains invalid canonical base64.');
  return bytes;
}

export function canonicalBytes(value: unknown): readonly number[] {
  const result = canonicalJsonBytes(value, 'marker');
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return Array.from(result.value);
}

export function token(character: string): string {
  return character.repeat(64);
}

export function classified(input: unknown) {
  return value(classifyMapworldRecoverySnapshot(input));
}

export function savePlan(
  revision: number,
  operation: 'first-save' | 'replacement-save',
  previousManifestSha256: string | null = null,
  targetName = TARGET_NAME,
): MapworldSavePlan {
  if (operation === 'first-save') {
    return value(
      createMapworldSavePlan(createProofDocument(revision), {
        operation,
        targetName,
        previousManifestSha256: null,
      }),
    );
  }
  if (previousManifestSha256 === null) {
    throw new Error('Replacement test plans require the previous manifest fingerprint.');
  }
  return value(
    createMapworldSavePlan(createProofDocument(revision), {
      operation,
      targetName,
      previousManifestSha256,
    }),
  );
}

function value<Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false },
): Value {
  if (!result.ok) throw new Error(`Expected success: ${JSON.stringify(result)}`);
  return result.value;
}
