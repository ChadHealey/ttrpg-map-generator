import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import {
  GATED_ATLAS_FIXTURE_IDS,
  type GatedAtlasFixtureId,
  type PackagedGenerationCancellationTrial,
} from './packaged-atlas-observer-dispatch.js';
import type { PackagedExportFormat } from './packaged-export-observer-dispatch.js';

export interface ObserverCommandEvent {
  readonly payload: unknown;
}

export interface ObserverCommandTransport {
  readonly listen: (
    eventName: string,
    listener: (event: ObserverCommandEvent) => void,
  ) => Promise<() => void>;
  readonly invoke: (
    command: string,
    arguments_?: Readonly<Record<string, unknown>>,
  ) => Promise<unknown>;
}

type ObserverAuthorityReceipt = Readonly<object>;
type ObserverAuthorityResult =
  ObserverAuthorityReceipt | undefined | Promise<ObserverAuthorityReceipt | undefined>;

export interface ObserverCommandAuthorities {
  readonly configureFixture: (fixtureId: GatedAtlasFixtureId) => ObserverAuthorityResult;
  readonly requestPreview: () => ObserverAuthorityResult;
  readonly requestFull: () => ObserverAuthorityResult;
  readonly requestCancellation: (
    trial: PackagedGenerationCancellationTrial,
  ) => ObserverAuthorityResult;
  readonly requestCancellationAftermath: () => ObserverAuthorityResult;
  readonly prepareReopen: (privateSavePath: string) => ObserverAuthorityResult;
  readonly requestExport: (format: PackagedExportFormat) => ObserverAuthorityResult;
  readonly cancelActiveOperation: () => void;
}

interface ObserverCommandPayload {
  readonly sequence: number;
  readonly opcode: number;
  readonly bodyHex: string;
}

type ObserverOpcode =
  0x10 | 0x11 | 0x12 | 0x13 | 0x14 | 0x15 | 0x16 | 0x17 | 0x18 | 0x19 | 0x1a | 0x1b | 0x1c;

interface DecodedObserverCommand {
  readonly sequence: number;
  readonly cancellable: boolean;
  readonly execute: (authorities: ObserverCommandAuthorities) => ObserverAuthorityResult;
}

interface InFlightCommand {
  readonly sequence: number;
  readonly cancellable: boolean;
}

const COMMAND_EVENT = 'observer://command';
const FRONTEND_READY_COMMAND = 'observer_frontend_ready';
const STARTED_COMMAND = 'observer_command_started';
const COMPLETED_COMMAND = 'observer_command_completed';
const AUTHORITY_REJECTED_DIAGNOSTIC = 'observer.authority-rejected';
const OPERATION_FAILED_DIAGNOSTIC = 'observer.operation-failed';
const LIFECYCLE_DIAGNOSTIC = 'observer.lifecycle';
const MAXIMUM_PREPARE_PATH_BYTES = 1_024;
const EMPTY_BODY_OPCODES = new Set<ObserverOpcode>([
  0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1b, 0x1c,
]);

export function createObserverCommandChannelBridge(transport: ObserverCommandTransport) {
  let installed = false;
  let terminal = false;
  let expectedSequence = 1;
  let inFlight: InFlightCommand | undefined;
  let removeListener: (() => void) | undefined;

  async function install(
    authorities: ObserverCommandAuthorities,
    isMounted: () => boolean = () => true,
  ): Promise<() => void> {
    if (installed) {
      failClosed(authorities);
      throw new Error(LIFECYCLE_DIAGNOSTIC);
    }
    installed = true;
    try {
      const unlisten = await transport.listen(COMMAND_EVENT, (event) => {
        receive(event.payload, authorities);
      });
      let listenerPresent = true;
      removeListener = () => {
        if (!listenerPresent) return;
        listenerPresent = false;
        unlisten();
      };
      if (terminal) {
        removeListener();
        throw new Error(LIFECYCLE_DIAGNOSTIC);
      }
      if (!isMounted()) {
        failClosed(authorities);
        return teardown;
      }
      await transport.invoke(FRONTEND_READY_COMMAND);
      if (!isMounted()) failClosed(authorities);
      return teardown;
    } catch {
      failClosed(authorities);
      throw new Error(LIFECYCLE_DIAGNOSTIC);
    }

    function teardown(): void {
      failClosed(authorities);
    }
  }

  function receive(payload: unknown, authorities: ObserverCommandAuthorities): void {
    if (terminal || inFlight !== undefined) {
      failClosed(authorities);
      return;
    }
    const command = decodeCommand(payload, expectedSequence);
    if (command === undefined) {
      failClosed(authorities);
      return;
    }
    inFlight = { sequence: command.sequence, cancellable: command.cancellable };
    void execute(command, authorities);
  }

  async function execute(
    command: DecodedObserverCommand,
    authorities: ObserverCommandAuthorities,
  ): Promise<void> {
    try {
      await transport.invoke(STARTED_COMMAND, { sequence: command.sequence });
    } catch {
      failClosed(authorities);
      return;
    }
    if (!isCurrent(command.sequence)) return;

    let receipt: ObserverAuthorityReceipt | undefined;
    try {
      receipt = await command.execute(authorities);
    } catch {
      await complete(command.sequence, 2, OPERATION_FAILED_DIAGNOSTIC, authorities);
      return;
    }
    if (!isCurrent(command.sequence)) return;
    if (receipt === undefined) {
      await complete(command.sequence, 1, AUTHORITY_REJECTED_DIAGNOSTIC, authorities);
      return;
    }
    let serializedReceipt: string;
    try {
      serializedReceipt = JSON.stringify(receipt);
    } catch {
      await complete(command.sequence, 2, OPERATION_FAILED_DIAGNOSTIC, authorities);
      return;
    }
    await complete(command.sequence, 0, serializedReceipt, authorities);
  }

  async function complete(
    sequence: number,
    status: 0 | 1 | 2,
    receipt: string,
    authorities: ObserverCommandAuthorities,
  ): Promise<void> {
    if (!isCurrent(sequence)) return;
    try {
      await transport.invoke(COMPLETED_COMMAND, { sequence, status, receipt });
    } catch {
      failClosed(authorities);
      return;
    }
    if (!isCurrent(sequence)) return;
    inFlight = undefined;
    if (sequence === Number.MAX_SAFE_INTEGER) {
      failClosed(authorities);
      return;
    }
    expectedSequence = sequence + 1;
  }

  function isCurrent(sequence: number): boolean {
    return !terminal && inFlight?.sequence === sequence;
  }

  function failClosed(authorities: ObserverCommandAuthorities): void {
    if (terminal) return;
    terminal = true;
    const shouldCancel = inFlight?.cancellable === true;
    inFlight = undefined;
    removeListener?.();
    if (shouldCancel) {
      try {
        authorities.cancelActiveOperation();
      } catch {
        // The channel is already terminal; teardown must not create a second acknowledgement path.
      }
    }
  }

  return { install };
}

const tauriTransport: ObserverCommandTransport = {
  invoke: (command, arguments_) => invoke(command, arguments_),
  listen: (eventName, listener) =>
    listen<unknown>(eventName, (event) => {
      listener({ payload: event.payload });
    }),
};

const observerCommandChannelBridge = createObserverCommandChannelBridge(tauriTransport);

export function installObserverCommandChannelBridge(
  authorities: ObserverCommandAuthorities,
  isMounted: () => boolean,
): Promise<() => void> {
  return observerCommandChannelBridge.install(authorities, isMounted);
}

function decodeCommand(
  payload: unknown,
  expectedSequence: number,
): DecodedObserverCommand | undefined {
  if (!isCommandPayload(payload) || payload.sequence !== expectedSequence) return undefined;
  const opcode = decodeOpcode(payload.opcode);
  if (opcode === undefined || !validBodyHex(payload.bodyHex)) return undefined;
  const body = decodeHex(payload.bodyHex);
  if (body === undefined) return undefined;

  switch (opcode) {
    case 0x10: {
      if (body.length !== 1) return undefined;
      const fixtureId = GATED_ATLAS_FIXTURE_IDS[body[0] ?? -1];
      if (fixtureId === undefined) return undefined;
      return command(payload.sequence, false, (authorities) =>
        authorities.configureFixture(fixtureId),
      );
    }
    case 0x11:
      return emptyCommand(payload, opcode, true, (authorities) => authorities.requestPreview());
    case 0x12:
      return emptyCommand(payload, opcode, true, (authorities) => authorities.requestFull());
    case 0x13:
      return cancellationCommand(payload, opcode, 'preview', 'early');
    case 0x14:
      return cancellationCommand(payload, opcode, 'preview', 'middle');
    case 0x15:
      return cancellationCommand(payload, opcode, 'preview', 'late');
    case 0x16:
      return cancellationCommand(payload, opcode, 'full', 'early');
    case 0x17:
      return cancellationCommand(payload, opcode, 'full', 'middle');
    case 0x18:
      return cancellationCommand(payload, opcode, 'full', 'late');
    case 0x19:
      return emptyCommand(payload, opcode, true, (authorities) =>
        authorities.requestCancellationAftermath(),
      );
    case 0x1a: {
      const privateSavePath = decodePreparePath(body);
      if (privateSavePath === undefined) return undefined;
      return command(payload.sequence, true, (authorities) =>
        authorities.prepareReopen(privateSavePath),
      );
    }
    case 0x1b:
      return emptyCommand(payload, opcode, false, (authorities) =>
        authorities.requestExport('svg'),
      );
    case 0x1c:
      return emptyCommand(payload, opcode, false, (authorities) =>
        authorities.requestExport('png'),
      );
    default:
      assertNever(opcode);
      return undefined;
  }
}

function decodeOpcode(opcode: number): ObserverOpcode | undefined {
  switch (opcode) {
    case 0x10:
    case 0x11:
    case 0x12:
    case 0x13:
    case 0x14:
    case 0x15:
    case 0x16:
    case 0x17:
    case 0x18:
    case 0x19:
    case 0x1a:
    case 0x1b:
    case 0x1c:
      return opcode;
    default:
      return undefined;
  }
}

function command(
  sequence: number,
  cancellable: boolean,
  execute: DecodedObserverCommand['execute'],
): DecodedObserverCommand {
  return { sequence, cancellable, execute };
}

function emptyCommand(
  payload: ObserverCommandPayload,
  opcode: ObserverOpcode,
  cancellable: boolean,
  execute: DecodedObserverCommand['execute'],
): DecodedObserverCommand | undefined {
  return EMPTY_BODY_OPCODES.has(opcode) && payload.bodyHex.length === 0
    ? command(payload.sequence, cancellable, execute)
    : undefined;
}

function cancellationCommand(
  payload: ObserverCommandPayload,
  opcode: ObserverOpcode,
  operation: PackagedGenerationCancellationTrial['operation'],
  safePoint: PackagedGenerationCancellationTrial['safePoint'],
): DecodedObserverCommand | undefined {
  return emptyCommand(payload, opcode, true, (authorities) =>
    authorities.requestCancellation({ operation, safePoint }),
  );
}

function isCommandPayload(payload: unknown): payload is ObserverCommandPayload {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return false;
  const record = payload as Readonly<Record<string, unknown>>;
  const keys = Object.keys(record).sort();
  return (
    keys.length === 3 &&
    keys[0] === 'bodyHex' &&
    keys[1] === 'opcode' &&
    keys[2] === 'sequence' &&
    Number.isSafeInteger(record.sequence) &&
    (record.sequence as number) > 0 &&
    Number.isInteger(record.opcode) &&
    typeof record.bodyHex === 'string'
  );
}

function validBodyHex(bodyHex: string): boolean {
  return (
    bodyHex.length <= MAXIMUM_PREPARE_PATH_BYTES * 2 &&
    bodyHex.length % 2 === 0 &&
    /^[a-f0-9]*$/u.test(bodyHex)
  );
}

function decodeHex(bodyHex: string): Uint8Array | undefined {
  if (!validBodyHex(bodyHex)) return undefined;
  const body = new Uint8Array(bodyHex.length / 2);
  for (let index = 0; index < body.length; index += 1) {
    body[index] = Number.parseInt(bodyHex.slice(index * 2, index * 2 + 2), 16);
  }
  return body;
}

function decodePreparePath(body: Uint8Array): string | undefined {
  if (body.length === 0 || body.length > MAXIMUM_PREPARE_PATH_BYTES) return undefined;
  let path: string;
  try {
    path = new TextDecoder('utf-8', { fatal: true }).decode(body);
  } catch {
    return undefined;
  }
  return path.startsWith('/') && path.endsWith('.mapworld') && !path.includes('\0')
    ? path
    : undefined;
}

function assertNever(value: never): void {
  void value;
}
