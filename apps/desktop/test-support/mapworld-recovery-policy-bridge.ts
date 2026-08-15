/** Test-only line bridge from native filesystem snapshots to the released persistence policy. */

import { createInterface } from 'node:readline';

import {
  type ClassifiedMapworldPackageCandidate,
  classifyMapworldRecoverySnapshot,
  decideMapworldRecovery,
} from '@ttrpg-map/persistence';

const NO_VALUE = '-';
const FIELD_SEPARATOR = '\t';
const LIST_SEPARATOR = ',';

const lines = createInterface({ input: process.stdin, crlfDelay: Number.POSITIVE_INFINITY });

for await (const line of lines) {
  process.stdout.write(`${evaluateSnapshot(line)}\n`);
}

function evaluateSnapshot(line: string): string {
  let input: unknown;
  try {
    input = JSON.parse(line) as unknown;
  } catch {
    return response('error', 'bridge.invalid-json');
  }
  if (!isRecord(input) || input.ok !== true || !Object.hasOwn(input, 'snapshot')) {
    return response('error', 'bridge.invalid-envelope');
  }
  const classified = classifyMapworldRecoverySnapshot(input.snapshot);
  if (!classified.ok) return response('error', classified.error.code);
  const decision = decideMapworldRecovery(classified.value);
  const selected = selectedIdentity(decision.selected);
  switch (decision.kind) {
    case 'apply':
      return response(
        'apply',
        NO_VALUE,
        selected.role,
        selected.fingerprint,
        selected.observationToken,
        decision.plan.steps.join(LIST_SEPARATOR),
        decision.plan.confirmationTokens.join(LIST_SEPARATOR),
      );
    case 'attention':
      return response(
        'attention',
        decision.code,
        selected.role,
        selected.fingerprint,
        selected.observationToken,
      );
    case 'clean':
      return response(
        'clean',
        NO_VALUE,
        selected.role,
        selected.fingerprint,
        selected.observationToken,
      );
  }
}

function selectedIdentity(candidate: ClassifiedMapworldPackageCandidate | null): {
  readonly role: string;
  readonly fingerprint: string;
  readonly observationToken: string;
} {
  return candidate === null
    ? { role: NO_VALUE, fingerprint: NO_VALUE, observationToken: NO_VALUE }
    : {
        role: candidate.role,
        fingerprint: candidate.fingerprint ?? NO_VALUE,
        observationToken: candidate.observationToken,
      };
}

function response(
  kind: string,
  code = NO_VALUE,
  role = NO_VALUE,
  fingerprint = NO_VALUE,
  observationToken = NO_VALUE,
  steps = '',
  confirmations = '',
): string {
  return [kind, code, role, fingerprint, observationToken, steps, confirmations].join(
    FIELD_SEPARATOR,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
