/** Test-only Node side of the real native Milestone 1 desktop workflow bridge. */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';

import type { WorldDocument } from '@ttrpg-map/core';
import {
  createMilestoneOneProofDocument,
  MILESTONE_ONE_PROOF_SEED,
  type MilestoneOneProofSeed,
  rerollMilestoneOneMarkers,
} from '@ttrpg-map/generation';

import type { NativeMapworldInvoke } from '../src/mapworld-native-boundary.js';
import {
  type MilestoneOneProofGenerationPort,
  MilestoneOneProofWorkflow,
} from '../src/milestone-one-proof-workflow.js';

const targetPath = requiredArgument(2);
const requestDirectory = requiredArgument(3);
const input = createInterface({ input: process.stdin, crlfDelay: Number.POSITIVE_INFINITY });
const responses = input[Symbol.asyncIterator]();
let generationAllowed = true;
let generationCalls = 0;
let requestSequence = 0;

const generation: MilestoneOneProofGenerationPort = Object.freeze({
  createBaseline(seed: MilestoneOneProofSeed) {
    assertGenerationAllowed();
    generationCalls += 1;
    return createMilestoneOneProofDocument(seed);
  },
  rerollMarkers(document: WorldDocument) {
    assertGenerationAllowed();
    generationCalls += 1;
    return rerollMilestoneOneMarkers(document);
  },
});

const nativeInvoke: NativeMapworldInvoke = async (command, arguments_) => {
  const sequence = requestSequence;
  requestSequence += 1;
  await writeNativeRequest(sequence, command, arguments_);
  process.stdout.write(`CALL\t${String(sequence)}\t${command}\n`);
  const response = await responses.next();
  if (response.done) throw new Error('Native workflow bridge ended before returning a response.');
  return response.value;
};

try {
  const workflow = new MilestoneOneProofWorkflow(generation);
  assertOk(workflow.generate(MILESTONE_ONE_PROOF_SEED));
  assertOk(workflow.rerollMarkers());
  assertOk(await workflow.save(nativeInvoke, targetPath));
  assertOk(workflow.close());
  if (workflow.snapshot.document !== undefined || workflow.snapshot.scene !== undefined) {
    throw new Error('Close did not unload accepted document and RenderScene state.');
  }
  generationAllowed = false;
  assertOk(await workflow.reopen(nativeInvoke));
  const snapshot = workflow.snapshot;
  if (
    snapshot.phase !== 'reopened' ||
    snapshot.reopen?.passed !== true ||
    snapshot.reopenGenerationInvocationCount !== 0 ||
    generationCalls !== 2 ||
    snapshot.savedManifestSha256 !== snapshot.reopenedManifestSha256 ||
    snapshot.evidence === undefined
  ) {
    throw new Error(`Native workflow evidence failed: ${JSON.stringify(snapshot)}`);
  }
  process.stdout.write(
    [
      'DONE',
      'PASS',
      String(snapshot.reopenGenerationInvocationCount),
      snapshot.reopenedManifestSha256,
      snapshot.evidence.canonicalSvgSha256,
    ].join('\t') + '\n',
  );
} catch (error) {
  process.stdout.write(`DONE\tFAIL\t${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  input.close();
}

async function writeNativeRequest(
  sequence: number,
  command: string,
  arguments_: Readonly<Record<string, unknown>>,
): Promise<void> {
  const directory = resolve(requestDirectory, String(sequence));
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'command.txt'), `${command}\n`);
  if (command === 'mapworld_native_save_base64') {
    const relativePaths = stringArray(arguments_.relativePaths, 'relativePaths');
    const fileBytes = stringArray(arguments_.fileBytesBase64, 'fileBytesBase64').map(
      canonicalBase64Bytes,
    );
    if (relativePaths.length !== fileBytes.length) throw new Error('Native save arrays disagree.');
    await writeFile(
      resolve(directory, 'metadata.txt'),
      [
        stringValue(arguments_.targetPath, 'targetPath'),
        stringValue(arguments_.operation, 'operation'),
        nullableString(arguments_.expectedPreviousManifestSha256),
        nullableString(arguments_.expectedPreviousObservationToken),
        stringValue(arguments_.candidateManifestSha256, 'candidateManifestSha256'),
      ].join('\n') + '\n',
    );
    await writeFile(
      resolve(directory, 'marker.bin'),
      canonicalBase64Bytes(stringValue(arguments_.markerBase64, 'markerBase64')),
    );
    await writeFile(resolve(directory, 'paths.txt'), relativePaths.join('\n') + '\n');
    const filesDirectory = resolve(directory, 'files');
    await mkdir(filesDirectory, { recursive: true });
    await Promise.all(
      fileBytes.map((bytes, index) =>
        writeFile(resolve(filesDirectory, `${String(index)}.bin`), Uint8Array.from(bytes)),
      ),
    );
    return;
  }
  if (command === 'mapworld_native_snapshot') {
    await writeFile(
      resolve(directory, 'metadata.txt'),
      `${stringValue(arguments_.targetPath, 'targetPath')}\n`,
    );
    return;
  }
  throw new Error(`Unexpected native command ${command}.`);
}

function assertGenerationAllowed(): void {
  if (!generationAllowed) throw new Error('generator-free reopen tripwire fired');
}

function assertOk(result: {
  readonly ok: boolean;
  readonly code?: string;
  readonly message?: string;
}): void {
  if (!result.ok) throw new Error(`${result.code ?? 'unknown'}: ${result.message ?? 'failed'}`);
}

function requiredArgument(index: number): string {
  const value = process.argv[index];
  if (value === undefined || value.length === 0)
    throw new Error(`Missing bridge argument ${String(index)}.`);
  return value;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.includes('\n')) throw new Error(`Invalid ${label}.`);
  return value;
}

function nullableString(value: unknown): string {
  return value === null ? '-' : stringValue(value, 'nullable string');
}

function stringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`Invalid ${label}.`);
  }
  return value;
}

function canonicalBase64Bytes(value: string): Uint8Array {
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) throw new Error('Invalid canonical base64 bytes.');
  return bytes;
}
