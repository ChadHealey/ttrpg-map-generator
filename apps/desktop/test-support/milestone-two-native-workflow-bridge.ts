/** Test-only Node side of the real native Milestone 2 persistence and recovery workflow. */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';

import { DEFAULT_ATLAS_CONTROLS, type WorldDocument } from '@ttrpg-map/core';

import { MILESTONE_TWO_ATLAS_PROOF_SEED } from '../src/atlas-workflow.js';
import { productionAtlasWorkflowGeneration } from '../src/atlas-workflow-generation.js';
import { reopenAcceptedAtlas } from '../src/atlas-workflow-reopen.js';
import type { NativeMapworldInvoke } from '../src/mapworld-native-boundary.js';
import {
  recoverMapworldDocument,
  saveMapworldDocument,
} from '../src/mapworld-persistence-orchestrator.js';

const targetPath = requiredArgument(2);
const requestDirectory = requiredArgument(3);
const targetName = targetPath.slice(targetPath.lastIndexOf('/') + 1);
const input = createInterface({ input: process.stdin, crlfDelay: Number.POSITIVE_INFINITY });
const responses = input[Symbol.asyncIterator]();
let requestSequence = 0;
let generationAllowed = true;
let generationCalls = 0;

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
  assertGenerationAllowed();
  generationCalls += 1;
  const generated = await productionAtlasWorkflowGeneration.commit(
    {
      operationId: 'native-m2-persistence',
      operation: 'initial-atlas',
      worldSeed: MILESTONE_TWO_ATLAS_PROOF_SEED,
      controls: DEFAULT_ATLAS_CONTROLS,
      accepted: undefined,
    },
    {
      isCancellationRequested: () => false,
      reportProgress: () => undefined,
      yieldControl: () => Promise.resolve(),
    },
  );
  if (!generated.ok) throw new Error(JSON.stringify(generated));
  const accepted = generated.accepted;
  const expectedScene = JSON.stringify(accepted.scene);

  const firstSave = await saveMapworldDocument(nativeInvoke, targetPath, accepted.document, {
    operation: 'first-save',
    targetName,
    previousManifestSha256: null,
    expectedPreviousObservationToken: null,
  });
  assertOk(firstSave);

  const clean = await recoverMapworldDocument(nativeInvoke, targetPath);
  assertOk(clean);
  if (clean.value.kind !== 'ready' || clean.value.selected?.classification !== 'valid') {
    throw new Error('First native atlas save did not reopen as one clean valid target.');
  }
  const previousFingerprint = clean.value.selected.fingerprint;
  if (previousFingerprint === undefined)
    throw new Error('Clean target has no manifest fingerprint.');
  const previousObservationToken = clean.value.snapshot.target.observationToken;
  const replacementDocument: WorldDocument = Object.freeze({
    ...accepted.document,
    displayName: `${accepted.document.displayName} recovered replacement`,
  });
  const interrupted = await saveMapworldDocument(nativeInvoke, targetPath, replacementDocument, {
    operation: 'replacement-save',
    targetName,
    previousManifestSha256: previousFingerprint,
    expectedPreviousObservationToken: previousObservationToken,
    overwriteAuthority: 'replace-last-opened',
  });
  if (interrupted.ok) throw new Error('Injected interrupted replacement unexpectedly completed.');

  generationAllowed = false;
  const recovered = await recoverMapworldDocument(nativeInvoke, targetPath);
  assertOk(recovered);
  if (recovered.value.kind !== 'ready' || recovered.value.selected?.classification !== 'valid') {
    throw new Error('Interrupted native atlas replacement did not recover to one valid target.');
  }
  const recoveredDocument = recovered.value.selected.document;
  if (recoveredDocument === undefined) throw new Error('Recovered target has no decoded document.');
  const reopened = reopenAcceptedAtlas(recoveredDocument);
  if (!reopened.ok) throw new Error(JSON.stringify(reopened));
  if (
    reopened.accepted.document.displayName !== replacementDocument.displayName ||
    JSON.stringify(reopened.accepted.scene) !== expectedScene ||
    generationCalls !== 1
  ) {
    throw new Error('Recovered atlas did not reconstruct the exact generator-free scene.');
  }
  process.stdout.write(
    [
      'DONE',
      'PASS',
      String(generationCalls - 1),
      recovered.value.selected.fingerprint,
      reopened.accepted.document.displayName,
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
    for (const [index, bytes] of fileBytes.entries()) {
      await writeFile(resolve(filesDirectory, `${String(index)}.bin`), bytes);
    }
    return;
  }
  if (command === 'mapworld_native_snapshot') {
    await writeFile(
      resolve(directory, 'metadata.txt'),
      `${stringValue(arguments_.targetPath, 'targetPath')}\n`,
    );
    return;
  }
  if (command === 'mapworld_native_apply') {
    await writeFile(
      resolve(directory, 'metadata.txt'),
      [
        stringValue(arguments_.targetPath, 'targetPath'),
        stringValue(arguments_.expectedSnapshotId, 'expectedSnapshotId'),
        nullableString(arguments_.selectedRole),
        nullableString(arguments_.selectedObservationToken),
        nullableString(arguments_.selectedManifestSha256),
      ].join('\n') + '\n',
    );
    await writeFile(
      resolve(directory, 'steps.txt'),
      stringArray(arguments_.steps, 'steps').join('\n') + '\n',
    );
    await writeFile(
      resolve(directory, 'confirmations.txt'),
      stringArray(arguments_.confirmationTokens, 'confirmationTokens').join('\n') + '\n',
    );
    return;
  }
  throw new Error(`Unexpected native command ${command}.`);
}

function assertGenerationAllowed(): void {
  if (!generationAllowed) throw new Error('generator-free reopen tripwire fired');
}

function assertOk<Value>(result: {
  readonly ok: boolean;
  readonly value?: Value;
}): asserts result is {
  readonly ok: true;
  readonly value: Value;
} {
  if (!result.ok) throw new Error(`Operation failed: ${JSON.stringify(result)}`);
}

function requiredArgument(index: number): string {
  const value = process.argv[index];
  if (value === undefined || value.length === 0)
    throw new Error(`Missing argument ${String(index)}.`);
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
