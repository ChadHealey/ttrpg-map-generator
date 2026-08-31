import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { arch, cpus, platform, release, tmpdir, totalmem } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), '../../..');
const fixtureRoot = resolve(
  repositoryRoot,
  'fixtures/saved-projects/v1/milestone-2-atlas-proof/appearance-rerolled.mapworld',
);
const mapId = 'a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7';
const mapPath = `maps/${mapId}.json`;
const perFileLimit = 128 * 1024 * 1024;
const packageLimit = 192 * 1024 * 1024;
const options = ['binary-chunks', 'canonical-json-files', 'compact-dictionary-json'];

const [mode, ...arguments_] = process.argv.slice(2);
if (mode === 'encode') {
  const [option, sourceDirectory, candidateDirectory] = arguments_;
  process.stdout.write(
    `${JSON.stringify(encodeCandidate(option, sourceDirectory, candidateDirectory))}\n`,
  );
} else if (mode === 'decode') {
  const [option, candidateDirectory] = arguments_;
  process.stdout.write(`${JSON.stringify(decodeCandidate(option, candidateDirectory))}\n`);
} else if (mode === undefined || mode === '--output') {
  if (mode === '--output' && arguments_[0] === undefined) {
    throw new Error('--output requires a repository-relative receipt path.');
  }
  await orchestrate(mode === '--output' ? arguments_[0] : undefined);
} else {
  throw new Error(`Unknown mode: ${mode}`);
}

async function orchestrate(outputPath) {
  const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'ttrpg-mapworld-v2-storage-'));
  try {
    const sourceDirectory = resolve(temporaryRoot, 'source');
    mkdirSync(sourceDirectory);
    const source = spawnSync(
      'corepack',
      [
        'pnpm',
        'exec',
        'vitest',
        'run',
        'docs/investigations/issue-152/storage-source.test.mjs',
        '--reporter=dot',
      ],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: { ...process.env, ISSUE_152_SOURCE_DIR: sourceDirectory },
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    if (source.status !== 0) {
      throw new Error(`Source generation failed:\n${source.stdout}\n${source.stderr}`);
    }

    const selectedOption = process.env.ISSUE_152_OPTION;
    if (selectedOption !== undefined) assertOption(selectedOption);
    const measurements = [];
    for (const option of selectedOption === undefined ? options : [selectedOption]) {
      const repeats = [];
      for (let repeat = 1; repeat <= 2; repeat += 1) {
        const candidateDirectory = resolve(temporaryRoot, `${option}-${String(repeat)}`);
        const encoded = await observeChild(['encode', option, sourceDirectory, candidateDirectory]);
        const decoded = await observeChild(['decode', option, candidateDirectory]);
        repeats.push({ repeat, encode: encoded, decode: decoded });
      }
      const first = repeats[0];
      const second = repeats[1];
      if (
        first.encode.result.packageFingerprint !== second.encode.result.packageFingerprint ||
        first.encode.result.packageBytes !== second.encode.result.packageBytes ||
        first.encode.result.fileSetFingerprint !== second.encode.result.fileSetFingerprint ||
        first.encode.result.logicalFieldSetFingerprint !==
          second.encode.result.logicalFieldSetFingerprint
      ) {
        throw new Error(`${option} did not repeat byte-for-byte.`);
      }
      if (
        first.encode.result.logicalFieldSetFingerprint !==
          first.decode.result.logicalFieldSetFingerprint ||
        second.encode.result.logicalFieldSetFingerprint !==
          second.decode.result.logicalFieldSetFingerprint
      ) {
        throw new Error(`${option} decode did not reconstruct the encoded logical fields.`);
      }
      measurements.push(measurementReceipt(option, repeats));
    }

    const fixtureFiles = listFiles(fixtureRoot);
    const fixtureBytes = fixtureFiles.reduce(
      (sum, path) => sum + statSync(resolve(fixtureRoot, path)).size,
      0,
    );
    const acceptedMapBytes = statSync(resolve(fixtureRoot, mapPath)).size;
    const sampleCount = 2_095_106;
    const watershedValuesLowerBoundBytes = 38 * sampleCount + (sampleCount - 1) + 2;
    const result = {
      issue: 152,
      measurementSchemaVersion: 1,
      candidateCommit: commandOutput('git', ['rev-parse', 'HEAD']),
      host: hostReceipt(),
      toolchain: {
        node: process.versions.node,
        pnpm: commandOutput('corepack', ['pnpm', '--version']),
      },
      measurementSources: [
        'docs/investigations/issue-152/storage-measurement.mjs',
        'docs/investigations/issue-152/storage-source.test.mjs',
      ].map((path) => ({ path, sha256: sha256(readFileSync(resolve(repositoryRoot, path))) })),
      memoryMeasurement: {
        source: 'process.resourceUsage().maxRSS',
        sourceUnit: 'KiB',
        receiptUnit: 'bytes',
        peakIncludesInputLoadAndOutputWrite: true,
      },
      source: {
        fixtureId: 'milestone-2-atlas-proof',
        sampleCount,
        m2PackageBytes: fixtureBytes,
        m2AcceptedMapBytes: acceptedMapBytes,
        watershedValuesLowerBoundBytes,
        issueLowerBoundMapBytes: acceptedMapBytes + watershedValuesLowerBoundBytes,
        perFileLimitBytes: perFileLimit,
        packageLimitBytes: packageLimit,
      },
      measurements,
    };
    const receipt = `${JSON.stringify(result, null, 2)}\n`;
    if (outputPath === undefined) {
      process.stdout.write(receipt);
    } else {
      const target = resolve(repositoryRoot, outputPath);
      const repositoryRelativePath = relative(repositoryRoot, target);
      if (repositoryRelativePath.startsWith('../') || repositoryRelativePath === '..') {
        throw new Error('Receipt output must stay inside the repository.');
      }
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, receipt);
      process.stdout.write(`Wrote ${repositoryRelativePath.split('\\').join('/')}\n`);
    }
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
  }
}

function encodeCandidate(option, sourceDirectory, candidateDirectory) {
  assertOption(option);
  const started = performance.now();
  mkdirSync(candidateDirectory, { recursive: true });
  cpSync(resolve(fixtureRoot, 'world.json'), resolve(candidateDirectory, 'world.json'));
  const metadata = JSON.parse(readFileSync(resolve(sourceDirectory, 'metadata.json'), 'utf8'));
  const aspectReferences = [];
  const logicalFields = [];

  for (const aspect of metadata.aspects) {
    const transformed = replaceSourceFields(aspect, (sourceField) => {
      const field = required(metadata.fields.find(({ key }) => key === sourceField.key));
      const descriptor = encodeField(
        option,
        sourceDirectory,
        candidateDirectory,
        field,
        aspect.aspectId,
      );
      logicalFields.push({ key: field.key, sha256: descriptor.logicalSha256 });
      const persistedDescriptor = { ...descriptor };
      delete persistedDescriptor.logicalSha256;
      return persistedDescriptor;
    });
    const aspectPath = `data/${mapId}/aspects/${aspect.aspectId}.json`;
    writeCandidateFile(candidateDirectory, aspectPath, canonicalJson(transformed));
    aspectReferences.push({
      acceptedAspectSchemaVersion: 2,
      aspectId: aspect.aspectId,
      aspectName: aspect.aspectName,
      path: aspectPath,
    });
  }

  const baselineMap = JSON.parse(readFileSync(resolve(fixtureRoot, mapPath), 'utf8'));
  const map = {
    ...baselineMap,
    mapDocumentSchemaVersion: 2,
    aspects: baselineMap.aspects.map((aspect) => ({
      ...aspect,
      acceptedAspectSchemaVersion: 2,
    })),
    externalAcceptedAspects: aspectReferences,
  };
  writeCandidateFile(candidateDirectory, mapPath, canonicalJson(map));

  const authoritativePaths = [
    'world.json',
    mapPath,
    ...listFiles(resolve(candidateDirectory, 'data'))
      .map((path) => `data/${path}`)
      .sort(comparePaths),
  ];
  const authoritativeFiles = authoritativePaths.map((path) => ({
    checksumAlgorithm: 'sha256',
    path,
    sha256: sha256(readFileSync(resolve(candidateDirectory, path))),
  }));
  const manifest = {
    applicationCompatibility: { maximumVersionExclusive: '0.3.0', minimumVersion: '0.2.0' },
    authoritativeFiles,
    packageVersion: 2,
    recordSchemaVersions: {
      acceptedAspect: 2,
      externalFieldFile: 1,
      mapDocument: 2,
      worldIndex: 1,
    },
    recovery: { mode: 'none' },
    schemaVersion: 2,
  };
  const manifestBytes = canonicalJson(manifest);
  writeCandidateFile(candidateDirectory, 'manifest.json', manifestBytes);

  const files = listFiles(candidateDirectory);
  const fileReceipts = files.map((path) => {
    const bytes = readFileSync(resolve(candidateDirectory, path));
    return { path, bytes: bytes.byteLength, sha256: sha256(bytes) };
  });
  const packageBytes = fileReceipts.reduce((sum, file) => sum + file.bytes, 0);
  const largestFile = [...fileReceipts].sort((left, right) => right.bytes - left.bytes)[0];
  return {
    elapsedMs: roundMilliseconds(performance.now() - started),
    peakRssBytes: process.resourceUsage().maxRSS * 1024,
    packageBytes,
    packageHeadroomBytes: packageLimit - packageBytes,
    withinPackageLimit: packageBytes <= packageLimit,
    largestFile,
    perFileHeadroomBytes: perFileLimit - largestFile.bytes,
    withinPerFileLimit: largestFile.bytes <= perFileLimit,
    fileCount: fileReceipts.length,
    files: fileReceipts,
    fileSetFingerprint: digestRecords(fileReceipts),
    packageFingerprint: sha256(manifestBytes),
    logicalFieldSetFingerprint: digestRecords(
      logicalFields.sort((left, right) => comparePaths(left.key, right.key)),
    ),
  };
}

function measurementReceipt(option, repeats) {
  const firstResult = repeats[0].encode.result;
  return {
    option,
    packageBytes: firstResult.packageBytes,
    packageHeadroomBytes: firstResult.packageHeadroomBytes,
    withinPackageLimit: firstResult.withinPackageLimit,
    largestFile: firstResult.largestFile,
    perFileHeadroomBytes: firstResult.perFileHeadroomBytes,
    withinPerFileLimit: firstResult.withinPerFileLimit,
    fileCount: firstResult.fileCount,
    packageFingerprint: firstResult.packageFingerprint,
    fileSetFingerprint: firstResult.fileSetFingerprint,
    logicalFieldSetFingerprint: firstResult.logicalFieldSetFingerprint,
    files: firstResult.files,
    repeats: repeats.map(({ repeat, encode, decode }) => ({
      repeat,
      encodeElapsedMs: encode.result.elapsedMs,
      encodeWallMs: encode.wallMs,
      encodePeakRssBytes: encode.result.peakRssBytes,
      packageFingerprint: encode.result.packageFingerprint,
      fileSetFingerprint: encode.result.fileSetFingerprint,
      encodedLogicalFieldSetFingerprint: encode.result.logicalFieldSetFingerprint,
      decodeElapsedMs: decode.result.elapsedMs,
      decodeWallMs: decode.wallMs,
      decodePeakRssBytes: decode.result.peakRssBytes,
      decodedLogicalFieldSetFingerprint: decode.result.logicalFieldSetFingerprint,
      decodedAspectCount: decode.result.decodedAspectCount,
      decodedFieldCount: decode.result.decodedFieldCount,
      generatorInvocations: decode.result.generatorInvocations,
    })),
  };
}

function encodeField(option, sourceDirectory, candidateDirectory, field, aspectId) {
  const source = readSourceField(sourceDirectory, field);
  const logicalSha256 = logicalValuesSha256(source.values);
  const basePath = `data/${mapId}/fields/${aspectId}.${field.key}`;
  if (option === 'binary-chunks') {
    const encoded = encodeBinaryField(field, source.values);
    const path = `${basePath}.mwf`;
    writeCandidateFile(candidateDirectory, path, encoded.bytes);
    return {
      byteOrder: 'little-endian',
      fieldFileSchemaVersion: 1,
      logicalSha256,
      path,
      sampleCount: field.sampleCount,
      storageKind: 'mapworld-field-binary',
      valueEncoding: encoded.valueEncoding,
      ...(encoded.dictionary === undefined ? {} : { dictionary: encoded.dictionary }),
    };
  }
  const compact = option === 'compact-dictionary-json';
  const dictionary =
    field.kind === 'string' && compact ? sortedDictionary(source.values) : undefined;
  const values =
    dictionary === undefined
      ? source.values
      : source.values.map((value) => required(dictionary.indexByValue.get(value)));
  const record = {
    fieldFileSchemaVersion: 1,
    sampleCount: field.sampleCount,
    valueEncoding: dictionary === undefined ? field.kind : 'dictionary-index',
    ...(dictionary === undefined ? {} : { dictionary: dictionary.values }),
    values,
  };
  const path = `${basePath}.${compact ? 'compact.json' : 'json'}`;
  writeCandidateFile(
    candidateDirectory,
    path,
    compact ? Buffer.from(`${JSON.stringify(orderValue(record))}\n`) : canonicalJson(record),
  );
  return {
    fieldFileSchemaVersion: 1,
    logicalSha256,
    path,
    sampleCount: field.sampleCount,
    storageKind: compact ? 'mapworld-field-compact-json' : 'mapworld-field-canonical-json',
    valueEncoding: record.valueEncoding,
  };
}

function encodeBinaryField(field, values) {
  if (field.kind === 'string') {
    const dictionary = sortedDictionary(values);
    const width = dictionary.values.length <= 256 ? 1 : dictionary.values.length <= 65_536 ? 2 : 4;
    const payload = Buffer.allocUnsafe(values.length * width);
    values.forEach((value, index) => {
      const code = required(dictionary.indexByValue.get(value));
      if (width === 1) payload.writeUInt8(code, index);
      else if (width === 2) payload.writeUInt16LE(code, index * 2);
      else payload.writeUInt32LE(code, index * 4);
    });
    return {
      bytes: binaryFile(
        width === 1 ? 5 : width === 2 ? 6 : 7,
        values.length,
        dictionary.values.length,
        payload,
      ),
      dictionary: dictionary.values,
      valueEncoding: `dictionary-u${String(width * 8)}`,
    };
  }
  const valueEncoding = numericEncoding(field.key);
  const width = valueEncoding.endsWith('16') ? 2 : 4;
  const payload = Buffer.allocUnsafe(values.length * width);
  values.forEach((value, index) => writeNumeric(payload, index * width, value, valueEncoding));
  const code = { i16: 1, i32: 2, u16: 3, u32: 4 }[valueEncoding];
  return { bytes: binaryFile(code, values.length, 0, payload), valueEncoding };
}

function binaryFile(code, sampleCount, dictionaryCount, payload) {
  const header = Buffer.alloc(32);
  header.write('MWFIELD2', 0, 'ascii');
  header.writeUInt16LE(1, 8);
  header.writeUInt8(code, 10);
  header.writeUInt8(0, 11);
  header.writeUInt32LE(sampleCount, 12);
  header.writeUInt32LE(dictionaryCount, 16);
  header.writeUInt32LE(payload.byteLength, 20);
  return Buffer.concat([header, payload]);
}

function decodeCandidate(option, candidateDirectory) {
  assertOption(option);
  const started = performance.now();
  const manifestBytes = readFileSync(resolve(candidateDirectory, 'manifest.json'));
  const manifest = parseCanonicalJson(manifestBytes, false);
  if (manifest.packageVersion !== 2 || manifest.schemaVersion !== 2) {
    throw new Error('Unknown package or manifest schema version.');
  }
  const paths = manifest.authoritativeFiles.map(({ path }) => path);
  if (
    paths.some((path, index) => index > 0 && compareAuthoritativePaths(paths[index - 1], path) >= 0)
  ) {
    throw new Error('Authoritative paths are not strictly ordered.');
  }
  for (const entry of manifest.authoritativeFiles) {
    const bytes = readFileSync(resolve(candidateDirectory, entry.path));
    if (sha256(bytes) !== entry.sha256) throw new Error(`Checksum mismatch: ${entry.path}`);
  }
  const map = parseCanonicalJson(readFileSync(resolve(candidateDirectory, mapPath)), false);
  if (map.mapDocumentSchemaVersion !== 2) throw new Error('Unknown map-document version.');

  const logicalFields = [];
  for (const reference of map.externalAcceptedAspects) {
    const aspect = parseCanonicalJson(
      readFileSync(resolve(candidateDirectory, reference.path)),
      false,
    );
    if (
      aspect.acceptedAspectSchemaVersion !== 2 ||
      aspect.aspectId !== reference.aspectId ||
      aspect.aspectName !== reference.aspectName
    ) {
      throw new Error(`Invalid external aspect reference: ${reference.path}`);
    }
    visitFieldDescriptors(aspect.acceptedOutput, (descriptor) => {
      const values = decodeField(option, candidateDirectory, descriptor);
      logicalFields.push({
        key: fieldKeyFromPath(descriptor.path),
        sha256: logicalValuesSha256(values),
      });
    });
  }
  logicalFields.sort((left, right) => comparePaths(left.key, right.key));
  return {
    elapsedMs: roundMilliseconds(performance.now() - started),
    peakRssBytes: process.resourceUsage().maxRSS * 1024,
    generatorInvocations: 0,
    decodedAspectCount: map.externalAcceptedAspects.length,
    decodedFieldCount: logicalFields.length,
    logicalFieldSetFingerprint: digestRecords(logicalFields),
  };
}

function decodeField(option, candidateDirectory, descriptor) {
  const bytes = readFileSync(resolve(candidateDirectory, descriptor.path));
  if (option === 'binary-chunks') return decodeBinaryField(bytes, descriptor);
  const record = parseCanonicalJson(bytes, option === 'compact-dictionary-json');
  if (record.fieldFileSchemaVersion !== 1 || record.sampleCount !== descriptor.sampleCount) {
    throw new Error(`Invalid field record: ${descriptor.path}`);
  }
  const values =
    record.dictionary === undefined
      ? record.values
      : record.values.map((index) => {
          if (!Number.isSafeInteger(index) || index < 0 || index >= record.dictionary.length) {
            throw new Error(`Invalid dictionary index: ${descriptor.path}`);
          }
          return record.dictionary[index];
        });
  if (values.length !== descriptor.sampleCount)
    throw new Error(`Wrong sample count: ${descriptor.path}`);
  return values;
}

function decodeBinaryField(bytes, descriptor) {
  if (bytes.subarray(0, 8).toString('ascii') !== 'MWFIELD2' || bytes.readUInt16LE(8) !== 1) {
    throw new Error(`Unknown binary field version: ${descriptor.path}`);
  }
  const code = bytes.readUInt8(10);
  const sampleCount = bytes.readUInt32LE(12);
  const dictionaryCount = bytes.readUInt32LE(16);
  const payloadLength = bytes.readUInt32LE(20);
  if (sampleCount !== descriptor.sampleCount || payloadLength !== bytes.byteLength - 32) {
    throw new Error(`Invalid binary field length: ${descriptor.path}`);
  }
  const widths = { 1: 2, 2: 4, 3: 2, 4: 4, 5: 1, 6: 2, 7: 4 };
  const width = widths[code];
  if (width === undefined || payloadLength !== sampleCount * width) {
    throw new Error(`Invalid binary field encoding: ${descriptor.path}`);
  }
  const values = new Array(sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    const offset = 32 + index * width;
    const encoded =
      code === 1
        ? bytes.readInt16LE(offset)
        : code === 2
          ? bytes.readInt32LE(offset)
          : code === 3
            ? bytes.readUInt16LE(offset)
            : code === 4
              ? bytes.readUInt32LE(offset)
              : code === 5
                ? bytes.readUInt8(offset)
                : code === 6
                  ? bytes.readUInt16LE(offset)
                  : bytes.readUInt32LE(offset);
    if (code >= 5) {
      if (dictionaryCount !== descriptor.dictionary.length || encoded >= dictionaryCount) {
        throw new Error(`Invalid binary dictionary index: ${descriptor.path}`);
      }
      values[index] = descriptor.dictionary[encoded];
    } else {
      values[index] = encoded;
    }
  }
  return values;
}

function readSourceField(sourceDirectory, field) {
  const bytes = readFileSync(resolve(sourceDirectory, field.path));
  if (field.kind === 'string') return { values: JSON.parse(bytes.toString('utf8')) };
  if (bytes.byteLength !== field.sampleCount * 4)
    throw new Error(`Invalid source field: ${field.key}`);
  const values = new Array(field.sampleCount);
  for (let index = 0; index < field.sampleCount; index += 1)
    values[index] = bytes.readInt32LE(index * 4);
  return { values };
}

function replaceSourceFields(value, replace) {
  if (Array.isArray(value)) return value.map((item) => replaceSourceFields(item, replace));
  if (value === null || typeof value !== 'object') return value;
  if (value.sourceFieldSchemaVersion === 1 && typeof value.key === 'string') return replace(value);
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, replaceSourceFields(item, replace)]),
  );
}

function visitFieldDescriptors(value, visit) {
  if (Array.isArray(value)) {
    value.forEach((item) => visitFieldDescriptors(item, visit));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  if (value.fieldFileSchemaVersion === 1 && typeof value.path === 'string') {
    visit(value);
    return;
  }
  Object.values(value).forEach((item) => visitFieldDescriptors(item, visit));
}

function numericEncoding(key) {
  if (key === 'temperature') return 'i16';
  if (key === 'prevailing-winds-speed') return 'u16';
  if (key === 'moisture') return 'u32';
  return 'i32';
}

function writeNumeric(buffer, offset, value, encoding) {
  if (!Number.isSafeInteger(value)) throw new Error('Numeric field contains a non-integer.');
  if (encoding === 'i16') buffer.writeInt16LE(value, offset);
  else if (encoding === 'i32') buffer.writeInt32LE(value, offset);
  else if (encoding === 'u16') buffer.writeUInt16LE(value, offset);
  else buffer.writeUInt32LE(value, offset);
}

function sortedDictionary(values) {
  const dictionary = [...new Set(values)].sort(comparePaths);
  return {
    values: dictionary,
    indexByValue: new Map(dictionary.map((value, index) => [value, index])),
  };
}

function logicalValuesSha256(values) {
  const hash = createHash('sha256');
  for (const value of values)
    hash.update(`${typeof value === 'number' ? 'n' : 's'}${JSON.stringify(value)}\n`);
  return hash.digest('hex');
}

function canonicalJson(value) {
  return Buffer.from(`${JSON.stringify(orderValue(value), null, 2)}\n`);
}

function parseCanonicalJson(bytes, compact) {
  const parsed = JSON.parse(bytes.toString('utf8'));
  const canonical = compact
    ? Buffer.from(`${JSON.stringify(orderValue(parsed))}\n`)
    : canonicalJson(parsed);
  if (!bytes.equals(canonical)) throw new Error('Noncanonical JSON bytes.');
  return parsed;
}

function orderValue(value) {
  if (Array.isArray(value)) return value.map(orderValue);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort(comparePaths)
      .map((key) => [key, orderValue(value[key])]),
  );
}

function writeCandidateFile(root, path, bytes) {
  const target = resolve(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);
}

function listFiles(root, base = root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(path, base));
    else if (entry.isFile()) files.push(relative(base, path).split('\\').join('/'));
    else throw new Error(`Unexpected file kind: ${path}`);
  }
  return files.sort(comparePaths);
}

async function observeChild(arguments_) {
  const started = performance.now();
  const child = spawn(process.execPath, [scriptPath, ...arguments_], {
    cwd: repositoryRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => (stdout += chunk));
  child.stderr.on('data', (chunk) => (stderr += chunk));
  const exitCode = await new Promise((resolveExit) => child.once('close', resolveExit));
  if (exitCode !== 0) throw new Error(`Child failed (${String(exitCode)}): ${stderr || stdout}`);
  return {
    wallMs: roundMilliseconds(performance.now() - started),
    result: JSON.parse(stdout),
  };
}

function fieldKeyFromPath(path) {
  const filename = path.slice(path.lastIndexOf('/') + 1);
  return filename.slice(filename.indexOf('.') + 1).replace(/\.(?:mwf|json|compact\.json)$/, '');
}

function digestRecords(records) {
  return sha256(Buffer.from(`${JSON.stringify(records)}\n`));
}

function commandOutput(command, arguments_) {
  const result = spawnSync(command, arguments_, { cwd: repositoryRoot, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function optionalCommandOutput(command, arguments_) {
  const result = spawnSync(command, arguments_, { cwd: repositoryRoot, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function hostReceipt() {
  const currentPlatform = platform();
  const base = {
    platform: currentPlatform,
    architecture: arch(),
    osRelease: release(),
    kernelDescription: optionalCommandOutput('uname', ['-srm']) ?? 'unknown',
    processor: cpus()[0]?.model ?? 'unknown',
    logicalCpuCount: cpus().length,
    memoryBytes: totalmem(),
    repositoryFilesystem: repositoryFilesystem(currentPlatform),
  };
  if (currentPlatform === 'darwin') {
    return {
      ...base,
      macosVersion: optionalCommandOutput('sw_vers', ['-productVersion']) ?? 'unknown',
      macosBuild: optionalCommandOutput('sw_vers', ['-buildVersion']) ?? 'unknown',
      modelIdentifier: macModelIdentifier(),
    };
  }
  if (currentPlatform === 'linux') {
    return { ...base, linuxDistribution: linuxDistribution() };
  }
  return base;
}

function repositoryFilesystem(currentPlatform) {
  if (currentPlatform !== 'darwin') {
    return optionalCommandOutput('stat', ['-f', '-c', '%T', repositoryRoot]) ?? 'unknown';
  }
  const df = optionalCommandOutput('df', [repositoryRoot]);
  const device = df?.split('\n').at(-1)?.trim().split(/\s+/)[0];
  const mounts = optionalCommandOutput('mount', []);
  const mountLine = mounts
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

function linuxDistribution() {
  try {
    const lines = readFileSync('/etc/os-release', 'utf8').split('\n');
    const prettyName = lines.find((line) => line.startsWith('PRETTY_NAME='));
    return prettyName === undefined
      ? 'unknown'
      : prettyName.slice('PRETTY_NAME='.length).replace(/^"|"$/g, '');
  } catch {
    return 'unknown';
  }
}

function comparePaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareAuthoritativePaths(left, right) {
  const rank = (path) => (path === 'world.json' ? 0 : path.startsWith('maps/') ? 1 : 2);
  const rankDifference = rank(left) - rank(right);
  return rankDifference === 0 ? comparePaths(left, right) : rankDifference;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function roundMilliseconds(value) {
  return Math.round(value * 1000) / 1000;
}

function required(value) {
  if (value === undefined) throw new Error('Required value is missing.');
  return value;
}

function assertOption(option) {
  if (!options.includes(option)) throw new Error(`Unknown storage option: ${String(option)}`);
}
