import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { arch, cpus, platform, release, tmpdir, totalmem } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), '../../..');
const perFileLimitBytes = 128 * 1024 * 1024;
const packageLimitBytes = 192 * 1024 * 1024;
const outputArgument = process.argv[2];

if (outputArgument !== undefined && outputArgument !== '--output') {
  throw new Error('Usage: node physical-context-measurement.mjs [--output]');
}

const receipt = measure();
const bytes = `${JSON.stringify(receipt, null, 2)}\n`;
if (outputArgument === '--output') {
  const outputPath = resolve(dirname(scriptPath), 'macos-results.json');
  writeFileSync(outputPath, bytes);
  process.stdout.write(`Wrote ${relative(repositoryRoot, outputPath)}\n`);
} else {
  process.stdout.write(bytes);
}

function measure() {
  const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'ttrpg-mapworld-issue-138-'));
  try {
    const repeats = [];
    for (let repeat = 1; repeat <= 2; repeat += 1) {
      const candidateDirectory = resolve(temporaryRoot, `candidate-${String(repeat)}`);
      const encodeResultPath = resolve(temporaryRoot, `encode-${String(repeat)}.json`);
      const decodeResultPath = resolve(temporaryRoot, `decode-${String(repeat)}.json`);
      mkdirSync(candidateDirectory);
      const encodeWallMs = runVitest(
        [
          'apps/desktop/src/atlas-physical-accepted-state.integration.test.ts',
          '-t',
          'emits the issue 138 measurement candidate',
        ],
        {
          ISSUE_138_MEASUREMENT_MODE: 'encode',
          ISSUE_138_CANDIDATE_DIRECTORY: candidateDirectory,
          ISSUE_138_RESULT_PATH: encodeResultPath,
        },
      );
      const decodeWallMs = runVitest(
        ['apps/desktop/src/atlas-physical-context-decode-measurement.test.ts'],
        {
          ISSUE_138_CANDIDATE_DIRECTORY: candidateDirectory,
          ISSUE_138_RESULT_PATH: decodeResultPath,
        },
      );
      repeats.push({
        repeat,
        encodeWallMs,
        decodeWallMs,
        encode: JSON.parse(readFileSync(encodeResultPath, 'utf8')),
        decode: JSON.parse(readFileSync(decodeResultPath, 'utf8')),
      });
    }
    validateRepeats(repeats);
    const first = repeats[0];
    const largestFile = first.encode.largestFile;
    return {
      issue: 138,
      measurementSchemaVersion: 1,
      candidateBaseCommit: commandOutput('git', ['rev-parse', 'HEAD']),
      host: hostReceipt(),
      toolchain: {
        node: process.versions.node,
        pnpm: commandOutput('corepack', ['pnpm', '--version']),
      },
      measurementSources: [
        'apps/desktop/src/atlas-physical-accepted-state.integration.test.ts',
        'apps/desktop/src/atlas-physical-context-decode-measurement.test.ts',
        'docs/investigations/issue-138/physical-context-measurement.mjs',
        'packages/persistence/src/mapworld-v2-codec.ts',
      ].map((path) => ({ path, sha256: sha256(readFileSync(resolve(repositoryRoot, path))) })),
      memoryMeasurement: {
        source: 'process.resourceUsage().maxRSS',
        sourceUnit: 'KiB',
        receiptUnit: 'bytes',
        encodePeakIncludesFullDeterministicM2AndM3SourceGeneration: true,
        decodeRunsInFreshGeneratorFreeProcess: true,
      },
      source: {
        fixtureId: 'milestone-2-atlas-proof-plus-supplied-south-pole-context',
        physicalAspectCount: 9,
        logicalFieldCount: 9,
        inheritedContextContractVersion: 1,
        inheritedContextLocation: 'regional parent.inheritedContext',
      },
      limits: {
        perFileLimitBytes,
        packageLimitBytes,
        packageBytes: first.encode.packageBytes,
        packageHeadroomBytes: packageLimitBytes - first.encode.packageBytes,
        withinPackageLimit: first.encode.packageBytes <= packageLimitBytes,
        largestFile,
        perFileHeadroomBytes: perFileLimitBytes - largestFile.bytes,
        withinPerFileLimit: largestFile.bytes <= perFileLimitBytes,
      },
      canonicalEvidence: {
        manifestSha256: first.encode.manifestSha256,
        files: first.encode.files,
        framedAspects: first.encode.framedEvidence,
        logicalFingerprints: first.encode.logicalFingerprints,
        inheritedContextChecksum: first.encode.inheritedContextChecksum,
      },
      repeats: repeats.map((item) => ({
        repeat: item.repeat,
        encodeElapsedMs: round(item.encode.elapsedMs),
        encodeWallMs: round(item.encodeWallMs),
        encodePeakRssBytes: item.encode.peakRssBytes,
        decodeElapsedMs: round(item.decode.elapsedMs),
        decodeWallMs: round(item.decodeWallMs),
        decodePeakRssBytes: item.decode.peakRssBytes,
        generatorInvocationsDuringDecode: item.decode.generatorInvocations,
        decodedAspectCount: item.decode.decodedAspectCount,
        manifestSha256: item.encode.manifestSha256,
        inheritedContextChecksum: item.decode.inheritedContextChecksum,
      })),
      linuxCorroboration: {
        status: 'deferred',
        requirement:
          'Matching canonical bytes, checksums, fingerprints, and limit results are required before production v2 writer release.',
      },
    };
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
  }
}

function runVitest(testArguments, environment) {
  const started = performance.now();
  const child = spawnSync(
    'corepack',
    ['pnpm', 'exec', 'vitest', 'run', ...testArguments, '--reporter=dot'],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: { ...process.env, ...environment },
      maxBuffer: 16 * 1024 * 1024,
      timeout: 600_000,
    },
  );
  if (child.status !== 0) {
    throw new Error(`Measurement child failed:\n${child.stdout}\n${child.stderr}`);
  }
  return performance.now() - started;
}

function validateRepeats(repeats) {
  const first = repeats[0];
  const second = repeats[1];
  if (first === undefined || second === undefined) throw new Error('Two repeats are required.');
  for (const item of repeats) {
    if (
      item.encode.packageBytes > packageLimitBytes ||
      item.encode.largestFile.bytes > perFileLimitBytes ||
      item.decode.generatorInvocations !== 0 ||
      item.decode.decodedAspectCount !== 9 ||
      JSON.stringify(item.encode.framedEvidence) !== JSON.stringify(item.decode.framedEvidence) ||
      JSON.stringify(item.encode.logicalFingerprints) !==
        JSON.stringify(item.decode.logicalFingerprints) ||
      item.encode.inheritedContextChecksum !== item.decode.inheritedContextChecksum
    ) {
      throw new Error(`Repeat ${String(item.repeat)} failed decode or limit validation.`);
    }
  }
  for (const key of [
    'files',
    'framedEvidence',
    'logicalFingerprints',
    'inheritedContextChecksum',
    'manifestSha256',
    'packageBytes',
  ]) {
    if (JSON.stringify(first.encode[key]) !== JSON.stringify(second.encode[key])) {
      throw new Error(`Encode evidence ${key} did not repeat exactly.`);
    }
  }
}

function hostReceipt() {
  const receipt = {
    platform: platform(),
    architecture: arch(),
    osRelease: release(),
    processor: cpus()[0]?.model ?? 'unknown',
    logicalCpuCount: cpus().length,
    memoryBytes: totalmem(),
    repositoryFilesystem: repositoryFilesystem(),
  };
  if (platform() !== 'darwin') return receipt;
  return {
    ...receipt,
    macosVersion: commandOutput('sw_vers', ['-productVersion']),
    macosBuild: commandOutput('sw_vers', ['-buildVersion']),
    modelIdentifier: macModelIdentifier(),
  };
}

function repositoryFilesystem() {
  if (platform() !== 'darwin') {
    return optionalCommandOutput('stat', ['-f', '-c', '%T', repositoryRoot]) ?? 'unknown';
  }
  const device = optionalCommandOutput('df', [repositoryRoot])
    ?.split('\n')
    .at(-1)
    ?.trim()
    .split(/\s+/)[0];
  const mountLine = optionalCommandOutput('mount', [])
    ?.split('\n')
    .find((line) => device !== undefined && line.startsWith(`${device} on `));
  return mountLine?.match(/\(([^,]+)/)?.[1]?.toUpperCase() ?? 'unknown';
}

function macModelIdentifier() {
  const output = optionalCommandOutput('system_profiler', ['SPHardwareDataType', '-json']);
  if (output === undefined) return 'unknown';
  try {
    return JSON.parse(output).SPHardwareDataType?.[0]?.machine_model ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function commandOutput(command, arguments_) {
  const result = spawnSync(command, arguments_, {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${arguments_.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function optionalCommandOutput(command, arguments_) {
  const result = spawnSync(command, arguments_, {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function round(value) {
  return Math.round(value * 1_000) / 1_000;
}
