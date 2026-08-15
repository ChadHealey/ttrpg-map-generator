import { z } from 'zod';

import {
  MAPWORLD_NATIVE_LIMITS,
  MAPWORLD_RECOVERY_PROTOCOL_VERSION,
} from './mapworld-recovery-model.js';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const byteSchema = z.number().int().min(0).max(255);
const observationSchema = z.strictObject({ observationToken: sha256Schema });
const osContextSchema = z.strictObject({
  primitive: z.string().min(1),
  osErrorNumber: z.number().int().nullable(),
  osErrorName: z.string().min(1).nullable(),
});

const absentSchema = observationSchema.extend({ kind: z.literal('absent') }).strict();
const emptyDirectorySchema = observationSchema
  .extend({ kind: z.literal('empty-directory') })
  .strict();
const symlinkSchema = observationSchema.extend({ kind: z.literal('symlink') }).strict();
const specialSchema = observationSchema.extend({ kind: z.literal('special') }).strict();
const unreadableSchema = observationSchema
  .extend({ kind: z.literal('unreadable'), osContext: osContextSchema })
  .strict();

const packageEntrySchema = z.strictObject({
  path: z.string().superRefine((path, context) => {
    if (!isSafeRelativePackagePath(path)) {
      context.addIssue({ code: 'custom', message: 'Invalid bounded package-relative path.' });
    }
  }),
  bytes: z.array(byteSchema).max(MAPWORLD_NATIVE_LIMITS.maximumFileBytes),
});

const packageDirectorySchema = observationSchema
  .extend({
    kind: z.literal('directory'),
    entries: z.array(packageEntrySchema).min(1).max(MAPWORLD_NATIVE_LIMITS.maximumPackageFiles),
  })
  .strict()
  .superRefine(({ entries }, context) => {
    let previousPath: string | undefined;
    let totalBytes = 0;
    for (const [index, entry] of entries.entries()) {
      if (previousPath !== undefined && compareUnicodeScalar(previousPath, entry.path) >= 0) {
        context.addIssue({
          code: 'custom',
          path: ['entries', index, 'path'],
          message: 'Package entries must be unique and sorted by code point.',
        });
      }
      previousPath = entry.path;
      totalBytes += entry.bytes.length;
    }
    if (totalBytes > MAPWORLD_NATIVE_LIMITS.maximumPackageBytes) {
      context.addIssue({
        code: 'custom',
        path: ['entries'],
        message: 'Package snapshot exceeds the aggregate native byte limit.',
      });
    }
  });

const directoryPathSchema = z.string().superRefine((path, context) => {
  if (!isSafeRelativePackagePath(path)) {
    context.addIssue({ code: 'custom', message: 'Invalid bounded directory-relative path.' });
  }
});

const invalidPackageDirectorySchema = observationSchema
  .extend({
    kind: z.literal('invalid-directory'),
    entries: z.array(packageEntrySchema).max(MAPWORLD_NATIVE_LIMITS.maximumPackageFiles),
    directories: z.array(directoryPathSchema).min(1).max(512),
  })
  .strict()
  .superRefine(({ directories, entries }, context) => {
    let totalBytes = 0;
    let previousEntryPath: string | undefined;
    for (const [index, entry] of entries.entries()) {
      if (
        previousEntryPath !== undefined &&
        compareUnicodeScalar(previousEntryPath, entry.path) >= 0
      ) {
        context.addIssue({
          code: 'custom',
          path: ['entries', index, 'path'],
          message: 'Invalid-package entries must be unique and sorted by Unicode scalar value.',
        });
      }
      previousEntryPath = entry.path;
      totalBytes += entry.bytes.length;
    }
    if (totalBytes > MAPWORLD_NATIVE_LIMITS.maximumPackageBytes) {
      context.addIssue({
        code: 'custom',
        path: ['entries'],
        message: 'Invalid package tree exceeds the aggregate native byte limit.',
      });
    }
    for (const [index, path] of directories.entries()) {
      const previous = directories[index - 1];
      if (previous !== undefined && compareUnicodeScalar(previous, path) >= 0) {
        context.addIssue({
          code: 'custom',
          path: ['directories', index],
          message: 'Directory paths must be unique and sorted by Unicode scalar value.',
        });
      }
    }
  });

const wrongKindRegularFileSchema = observationSchema
  .extend({
    kind: z.literal('regular-file'),
    bytes: z.array(byteSchema).max(MAPWORLD_NATIVE_LIMITS.maximumFileBytes),
  })
  .strict();

export const nativeMapworldPackageRoleSchema = z.union([
  absentSchema,
  emptyDirectorySchema,
  packageDirectorySchema,
  invalidPackageDirectorySchema,
  wrongKindRegularFileSchema,
  symlinkSchema,
  specialSchema,
  unreadableSchema,
]);

const markerRegularFileSchema = observationSchema
  .extend({
    kind: z.literal('regular-file'),
    bytes: z.array(byteSchema).max(MAPWORLD_NATIVE_LIMITS.maximumMarkerBytes),
  })
  .strict();

const wrongKindMarkerDirectorySchema = observationSchema
  .extend({
    kind: z.literal('directory'),
    entries: z.array(packageEntrySchema).max(MAPWORLD_NATIVE_LIMITS.maximumPackageFiles),
  })
  .strict()
  .superRefine(({ entries }, context) => {
    const totalBytes = entries.reduce((total, entry) => total + entry.bytes.length, 0);
    if (totalBytes > MAPWORLD_NATIVE_LIMITS.maximumPackageBytes) {
      context.addIssue({
        code: 'custom',
        path: ['entries'],
        message: 'Marker-directory snapshot exceeds the aggregate native byte limit.',
      });
    }
  });

export const nativeMapworldMarkerRoleSchema = z.union([
  absentSchema,
  markerRegularFileSchema,
  emptyDirectorySchema,
  wrongKindMarkerDirectorySchema,
  symlinkSchema,
  specialSchema,
  unreadableSchema,
]);

export const nativeMapworldRecoverySnapshotSchema = z.strictObject({
  targetName: z.string().superRefine((targetName, context) => {
    if (!isValidTargetName(targetName)) {
      context.addIssue({ code: 'custom', message: 'Invalid bounded mapworld target basename.' });
    }
  }),
  snapshotId: sha256Schema,
  target: nativeMapworldPackageRoleSchema,
  temporary: nativeMapworldPackageRoleSchema,
  backup: nativeMapworldPackageRoleSchema,
  marker: nativeMapworldMarkerRoleSchema,
});

export type NativeMapworldRecoverySnapshotDto = z.infer<
  typeof nativeMapworldRecoverySnapshotSchema
>;
export type NativeMapworldPackageRoleDto = z.infer<typeof nativeMapworldPackageRoleSchema>;
export type NativeMapworldMarkerRoleDto = z.infer<typeof nativeMapworldMarkerRoleSchema>;

const markerBaseSchema = z.strictObject({
  backupName: z.string(),
  candidateManifestSha256: sha256Schema,
  checksumAlgorithm: z.literal('sha256'),
  operation: z.enum(['first-save', 'replacement-save']),
  previousManifestSha256: sha256Schema.nullable(),
  protocol: z.literal('mapworld-directory-commit'),
  protocolVersion: z.number().int(),
  targetName: z.string(),
  temporaryName: z.string(),
});

export const mapworldRecoveryMarkerVersionSchema = z.looseObject({
  protocolVersion: z.number().int(),
});

export const mapworldRecoveryMarkerSchema = markerBaseSchema.superRefine((marker, context) => {
  if (marker.protocolVersion !== MAPWORLD_RECOVERY_PROTOCOL_VERSION) {
    context.addIssue({
      code: 'custom',
      path: ['protocolVersion'],
      message: 'Unsupported recovery protocol version.',
    });
  }
  const hasCorrectPrevious =
    (marker.operation === 'first-save' && marker.previousManifestSha256 === null) ||
    (marker.operation === 'replacement-save' && marker.previousManifestSha256 !== null);
  if (!hasCorrectPrevious) {
    context.addIssue({
      code: 'custom',
      path: ['previousManifestSha256'],
      message: 'Previous fingerprint does not match the marker operation.',
    });
  }
});

export type MapworldRecoveryMarkerDto = z.infer<typeof mapworldRecoveryMarkerSchema>;

function isSafeRelativePackagePath(path: string): boolean {
  if (
    path.length === 0 ||
    path.includes('\0') ||
    path.includes('\\') ||
    path.startsWith('/') ||
    new TextEncoder().encode(path).byteLength > MAPWORLD_NATIVE_LIMITS.maximumRelativePathBytes
  ) {
    return false;
  }
  const segments = path.split('/');
  return (
    segments.length - 1 <= MAPWORLD_NATIVE_LIMITS.maximumDirectoryDepth &&
    segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
  );
}

function isValidTargetName(targetName: string): boolean {
  return (
    targetName.length > 0 &&
    targetName !== '.' &&
    targetName !== '..' &&
    targetName.endsWith('.mapworld') &&
    !targetName.includes('/') &&
    !targetName.includes('\0') &&
    new TextEncoder().encode(targetName).byteLength <= MAPWORLD_NATIVE_LIMITS.maximumBasenameBytes
  );
}

function compareUnicodeScalar(left: string, right: string): number {
  const leftScalars = Array.from(left, (value) => value.codePointAt(0) ?? 0);
  const rightScalars = Array.from(right, (value) => value.codePointAt(0) ?? 0);
  for (let index = 0; index < Math.min(leftScalars.length, rightScalars.length); index += 1) {
    const difference = (leftScalars[index] ?? 0) - (rightScalars[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return leftScalars.length - rightScalars.length;
}
