import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DESKTOP_ROOT = resolve(import.meta.dirname, '..');
const OBSERVER_SURFACES = [
  'observer://command',
  'observer_frontend_ready',
  'observer_command_started',
  'observer_command_completed',
  'observer.authority-rejected',
  'observer.operation-failed',
];
const ORDINARY_FORBIDDEN_SURFACES = [
  ...OBSERVER_SURFACES,
  'VITE_OBSERVER_COMMAND_CHANNEL',
  'observer-command-channel-bridge',
  'installObserverCommandChannelBridge',
];

describe('observer command channel frontend bundle gate', () => {
  const outputRoot = mkdtempSync(resolve(tmpdir(), 'ttrpg-observer-frontend-bundles-'));
  let ordinaryBundle = '';
  let inexactGateBundle = '';
  let observerBundle = '';

  beforeAll(async () => {
    ordinaryBundle = await buildBundle(resolve(outputRoot, 'ordinary'), undefined);
    inexactGateBundle = await buildBundle(resolve(outputRoot, 'inexact'), 'true');
    observerBundle = await buildBundle(resolve(outputRoot, 'observer'), '1');
  }, 60_000);

  afterAll(() => {
    rmSync(outputRoot, { force: true, recursive: true });
  });

  it('removes the complete listener, opcode, lifecycle-command, and diagnostic surface ordinarily', () => {
    for (const surface of ORDINARY_FORBIDDEN_SURFACES) {
      expect(ordinaryBundle).not.toContain(surface);
      expect(inexactGateBundle).not.toContain(surface);
    }
  });

  it('includes the bridge only when VITE_OBSERVER_COMMAND_CHANNEL is compiled as one', () => {
    for (const surface of OBSERVER_SURFACES) expect(observerBundle).toContain(surface);
  });
});

async function buildBundle(outputDirectory: string, gate: string | undefined): Promise<string> {
  const previousGate = process.env.VITE_OBSERVER_COMMAND_CHANNEL;
  if (gate === undefined) delete process.env.VITE_OBSERVER_COMMAND_CHANNEL;
  else process.env.VITE_OBSERVER_COMMAND_CHANNEL = gate;
  try {
    await build({
      root: DESKTOP_ROOT,
      logLevel: 'silent',
      build: {
        emptyOutDir: true,
        outDir: outputDirectory,
      },
    });
  } finally {
    if (previousGate === undefined) delete process.env.VITE_OBSERVER_COMMAND_CHANNEL;
    else process.env.VITE_OBSERVER_COMMAND_CHANNEL = previousGate;
  }
  return readFiles(outputDirectory).join('\n');
}

function readFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? readFiles(path) : [entry.name, readFileSync(path, 'utf8')];
  });
}
