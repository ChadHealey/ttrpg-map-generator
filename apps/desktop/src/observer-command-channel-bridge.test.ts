import { describe, expect, it, type Mock, vi } from 'vitest';

import {
  createObserverCommandChannelBridge,
  type ObserverCommandAuthorities,
  type ObserverCommandEvent,
  type ObserverCommandTransport,
} from './observer-command-channel-bridge.js';

const RECEIPT = Object.freeze({ version: 'existing-receipt-v1', phase: 'complete' });

describe('observer command channel frontend bridge', () => {
  it('registers exactly one listener before declaring frontend readiness', async () => {
    const harness = bridgeHarness();

    const teardown = await harness.bridge.install(harness.authorities);

    expect(harness.order).toEqual(['listen:observer://command', 'invoke:observer_frontend_ready']);
    await expect(harness.bridge.install(harness.authorities)).rejects.toThrow('observer.lifecycle');
    expect(harness.listen).toHaveBeenCalledOnce();
    expect(harness.invocations('observer_frontend_ready')).toHaveLength(1);
    expect(harness.unlisten).toHaveBeenCalledOnce();
    teardown();
  });

  it.each([
    [0x10, '00', 'configureFixture', ['milestone-2-atlas-proof']],
    [0x10, '01', 'configureFixture', ['milestone-2-atlas-fragmented-islands']],
    [0x10, '02', 'configureFixture', ['milestone-2-atlas-control-max']],
    [0x11, '', 'requestPreview', []],
    [0x12, '', 'requestFull', []],
    [0x13, '', 'requestCancellation', [{ operation: 'preview', safePoint: 'early' }]],
    [0x14, '', 'requestCancellation', [{ operation: 'preview', safePoint: 'middle' }]],
    [0x15, '', 'requestCancellation', [{ operation: 'preview', safePoint: 'late' }]],
    [0x16, '', 'requestCancellation', [{ operation: 'full', safePoint: 'early' }]],
    [0x17, '', 'requestCancellation', [{ operation: 'full', safePoint: 'middle' }]],
    [0x18, '', 'requestCancellation', [{ operation: 'full', safePoint: 'late' }]],
    [0x19, '', 'requestCancellationAftermath', []],
    [
      0x1a,
      pathHex('/private/tmp/observer/atlas.mapworld'),
      'prepareReopen',
      ['/private/tmp/observer/atlas.mapworld'],
    ],
    [0x1b, '', 'requestExport', ['svg']],
    [0x1c, '', 'requestExport', ['png']],
  ] as const)(
    'strictly dispatches opcode %# to the canonical %s authority',
    async (opcode, bodyHex, authority, expectedArguments) => {
      const harness = bridgeHarness();
      await harness.bridge.install(harness.authorities);

      harness.emit({ sequence: 1, opcode, bodyHex });
      await harness.settle();

      expect(harness.authorities[authority]).toHaveBeenCalledWith(...expectedArguments);
      expect(harness.invocations('observer_command_started')).toEqual([{ sequence: 1 }]);
      expect(harness.invocations('observer_command_completed')).toEqual([
        { sequence: 1, status: 0, receipt: JSON.stringify(RECEIPT) },
      ]);
    },
  );

  it.each([
    null,
    {},
    { sequence: 0, opcode: 0x11, bodyHex: '' },
    { sequence: Number.MAX_SAFE_INTEGER + 1, opcode: 0x11, bodyHex: '' },
    { sequence: 1, opcode: 0x1d, bodyHex: '' },
    { sequence: 1, opcode: 0x10, bodyHex: '' },
    { sequence: 1, opcode: 0x10, bodyHex: '03' },
    { sequence: 1, opcode: 0x11, bodyHex: '00' },
    { sequence: 1, opcode: 0x1a, bodyHex: '0' },
    { sequence: 1, opcode: 0x1a, bodyHex: 'GG' },
    { sequence: 1, opcode: 0x1a, bodyHex: 'ff' },
    { sequence: 1, opcode: 0x1a, bodyHex: '61'.repeat(1_025) },
    { sequence: 1, opcode: 0x1a, bodyHex: pathHex('relative.mapworld') },
    { sequence: 1, opcode: 0x1a, bodyHex: pathHex('/private/tmp/not-a-project') },
    { sequence: 1, opcode: 0x1a, bodyHex: pathHex('/private/tmp/a\0.mapworld') },
  ])(
    'fails closed without acknowledgement for malformed or unsupported payload %#',
    async (payload) => {
      const harness = bridgeHarness();
      await harness.bridge.install(harness.authorities);

      harness.emitRaw(payload);
      await harness.settle();

      expect(harness.invocations('observer_command_started')).toHaveLength(0);
      expect(harness.invocations('observer_command_completed')).toHaveLength(0);
      expect(harness.unlisten).toHaveBeenCalledOnce();
      expect(
        Object.values(harness.authorities).every((authority) => authority.mock.calls.length === 0),
      ).toBe(true);
    },
  );

  it('reports authority rejection and operation failure with stable private-data-free diagnostics', async () => {
    const rejected = bridgeHarness({ requestPreview: vi.fn(() => undefined) });
    await rejected.bridge.install(rejected.authorities);
    rejected.emit({ sequence: 1, opcode: 0x11, bodyHex: '' });
    await rejected.settle();
    expect(rejected.invocations('observer_command_completed')).toEqual([
      { sequence: 1, status: 1, receipt: 'observer.authority-rejected' },
    ]);

    const failed = bridgeHarness({
      requestPreview: vi.fn(() => {
        throw new Error('/private/tmp/observer/secret.mapworld');
      }),
    });
    await failed.bridge.install(failed.authorities);
    failed.emit({ sequence: 1, opcode: 0x11, bodyHex: '' });
    await failed.settle();
    expect(failed.invocations('observer_command_completed')).toEqual([
      { sequence: 1, status: 2, receipt: 'observer.operation-failed' },
    ]);
    expect(JSON.stringify(failed.invoke.mock.calls)).not.toContain('/private/');
  });

  it('fails closed on duplicate, stale, and wrong-sequence events', async () => {
    let resolveAuthority: ((receipt: typeof RECEIPT) => void) | undefined;
    const duplicate = bridgeHarness({
      requestPreview: vi.fn(
        () =>
          new Promise<typeof RECEIPT>((resolve) => {
            resolveAuthority = resolve;
          }),
      ),
    });
    await duplicate.bridge.install(duplicate.authorities);
    duplicate.emit({ sequence: 1, opcode: 0x11, bodyHex: '' });
    await duplicate.settle();
    duplicate.emit({ sequence: 1, opcode: 0x11, bodyHex: '' });
    resolveAuthority?.(RECEIPT);
    await duplicate.settle();
    expect(duplicate.invocations('observer_command_started')).toHaveLength(1);
    expect(duplicate.invocations('observer_command_completed')).toHaveLength(0);
    expect(duplicate.unlisten).toHaveBeenCalledOnce();

    const stale = bridgeHarness();
    await stale.bridge.install(stale.authorities);
    stale.emit({ sequence: 1, opcode: 0x11, bodyHex: '' });
    await stale.settle();
    stale.emit({ sequence: 1, opcode: 0x11, bodyHex: '' });
    await stale.settle();
    expect(stale.invocations('observer_command_started')).toHaveLength(1);
    expect(stale.invocations('observer_command_completed')).toHaveLength(1);
    expect(stale.unlisten).toHaveBeenCalledOnce();

    const wrong = bridgeHarness();
    await wrong.bridge.install(wrong.authorities);
    wrong.emit({ sequence: 2, opcode: 0x11, bodyHex: '' });
    await wrong.settle();
    expect(wrong.invocations('observer_command_started')).toHaveLength(0);
    expect(wrong.invocations('observer_command_completed')).toHaveLength(0);
    expect(wrong.unlisten).toHaveBeenCalledOnce();
  });

  it('tears down deterministically, requests only existing cancellation, and suppresses stale completion', async () => {
    let resolveAuthority: ((receipt: typeof RECEIPT) => void) | undefined;
    const cancelActiveOperation = vi.fn();
    const harness = bridgeHarness({
      requestPreview: vi.fn(
        () =>
          new Promise<typeof RECEIPT>((resolve) => {
            resolveAuthority = resolve;
          }),
      ),
      cancelActiveOperation,
    });
    const teardown = await harness.bridge.install(harness.authorities);
    harness.emit({ sequence: 1, opcode: 0x11, bodyHex: '' });
    await harness.settle();

    teardown();
    teardown();
    resolveAuthority?.(RECEIPT);
    harness.emit({ sequence: 2, opcode: 0x12, bodyHex: '' });
    await harness.settle();

    expect(harness.unlisten).toHaveBeenCalledOnce();
    expect(cancelActiveOperation).toHaveBeenCalledOnce();
    expect(harness.invocations('observer_command_started')).toHaveLength(1);
    expect(harness.invocations('observer_command_completed')).toHaveLength(0);
    expect(harness.authorities.requestFull).not.toHaveBeenCalled();

    const exportHarness = bridgeHarness();
    const removeExportHarness = await exportHarness.bridge.install(exportHarness.authorities);
    exportHarness.emit({ sequence: 1, opcode: 0x1b, bodyHex: '' });
    removeExportHarness();
    await exportHarness.settle();
    expect(exportHarness.authorities.cancelActiveOperation).not.toHaveBeenCalled();
    expect(exportHarness.invocations('observer_command_completed')).toHaveLength(0);
  });

  it('does not declare readiness when the component becomes stale during listener registration', async () => {
    let resolveListen: ((unlisten: () => void) => void) | undefined;
    const unlisten = vi.fn();
    const invoke = vi.fn<ObserverCommandTransport['invoke']>(() => Promise.resolve(undefined));
    const transport: ObserverCommandTransport = {
      listen: vi.fn<ObserverCommandTransport['listen']>(
        () =>
          new Promise<() => void>((resolve) => {
            resolveListen = resolve;
          }),
      ),
      invoke,
    };
    const bridge = createObserverCommandChannelBridge(transport);
    let mounted = true;
    const installed = bridge.install(bridgeHarness().authorities, () => mounted);

    mounted = false;
    resolveListen?.(unlisten);
    await installed;

    expect(unlisten).toHaveBeenCalledOnce();
    expect(invoke).not.toHaveBeenCalled();
  });
});

type AuthorityMocks = {
  [Key in keyof ObserverCommandAuthorities]: Mock<ObserverCommandAuthorities[Key]>;
};

function bridgeHarness(overrides: Partial<AuthorityMocks> = {}) {
  const order: string[] = [];
  let listener: ((event: ObserverCommandEvent) => void) | undefined;
  const unlisten = vi.fn();
  const listen = vi.fn<ObserverCommandTransport['listen']>(
    (eventName: string, nextListener: (event: ObserverCommandEvent) => void) => {
      order.push(`listen:${eventName}`);
      listener = nextListener;
      return Promise.resolve(unlisten);
    },
  );
  const invoke = vi.fn<ObserverCommandTransport['invoke']>((command: string) => {
    order.push(`invoke:${command}`);
    return Promise.resolve(undefined);
  });
  const transport: ObserverCommandTransport = { invoke, listen };
  const authority = <Key extends keyof ObserverCommandAuthorities>(
    _key: Key,
  ): AuthorityMocks[Key] =>
    vi.fn<ObserverCommandAuthorities[Key]>(() => RECEIPT) as AuthorityMocks[Key];
  const authorities = {
    configureFixture: authority('configureFixture'),
    requestPreview: authority('requestPreview'),
    requestFull: authority('requestFull'),
    requestCancellation: authority('requestCancellation'),
    requestCancellationAftermath: authority('requestCancellationAftermath'),
    prepareReopen: authority('prepareReopen'),
    requestExport: authority('requestExport'),
    cancelActiveOperation: vi.fn<ObserverCommandAuthorities['cancelActiveOperation']>(),
    ...overrides,
  } satisfies AuthorityMocks;
  return {
    authorities,
    bridge: createObserverCommandChannelBridge(transport),
    emit(payload: ObserverCommandEvent['payload']) {
      listener?.({ payload });
    },
    emitRaw(payload: unknown) {
      listener?.({ payload });
    },
    invocations(command: string): unknown[] {
      return invoke.mock.calls
        .filter(([invoked]) => invoked === command)
        .map(([, arguments_]) => arguments_);
    },
    invoke,
    listen,
    order,
    settle: async () => {
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    },
    unlisten,
  };
}

function pathHex(path: string): string {
  return [...new TextEncoder().encode(path)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
