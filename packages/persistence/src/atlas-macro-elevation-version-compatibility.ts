import { type AdditionalVersionMismatch } from './canonical-dto-decoding.js';

const SUPPORTED_MACRO_ELEVATION_VERSIONS = Object.freeze([1, 2] as const);

/** Find a present but unsupported macro-elevation version before strict DTO validation. */
export function findUnsupportedAtlasMacroElevationVersion(
  value: unknown,
): AdditionalVersionMismatch | undefined {
  if (!isRecord(value) || !Array.isArray(value.aspects)) return undefined;

  for (const [index, candidate] of value.aspects.entries()) {
    if (!isRecord(candidate) || candidate.aspectName !== 'worldTerrain.macroElevation') continue;
    const aspectPath = `$.aspects[${String(index)}]`;
    const checks: readonly VersionValue[] = [
      { path: `${aspectPath}.generatorVersion`, value: candidate.generatorVersion },
      {
        path: `${aspectPath}.seedMetadata.generatorVersion`,
        value: isRecord(candidate.seedMetadata)
          ? candidate.seedMetadata.generatorVersion
          : undefined,
      },
      {
        path: `${aspectPath}.parameters.fieldBehaviorVersion`,
        value: isRecord(candidate.parameters)
          ? candidate.parameters.fieldBehaviorVersion
          : undefined,
      },
      {
        path: `${aspectPath}.acceptedOutput.provenance.fieldBehaviorVersion`,
        value:
          isRecord(candidate.acceptedOutput) && isRecord(candidate.acceptedOutput.provenance)
            ? candidate.acceptedOutput.provenance.fieldBehaviorVersion
            : undefined,
      },
    ];
    for (const check of checks) {
      if (check.value !== undefined && !isSupportedVersion(check.value)) {
        return {
          actual: check.value,
          expectedDescription: '1 or 2',
          path: check.path,
        };
      }
    }
  }
  return undefined;
}

interface VersionValue {
  readonly path: string;
  readonly value: unknown;
}

function isSupportedVersion(value: unknown): value is 1 | 2 {
  return SUPPORTED_MACRO_ELEVATION_VERSIONS.some((version) => value === version);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
