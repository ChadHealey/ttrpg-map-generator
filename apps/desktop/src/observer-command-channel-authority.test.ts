import { describe, expect, it } from 'vitest';

import appSource from './App.svelte?raw';
import bridgeSource from './observer-command-channel-bridge.ts?raw';

describe('observer command channel canonical authority wiring', () => {
  it('keeps the bridge orchestration-only and independent of focus or synthesized input', () => {
    expect(bridgeSource).not.toMatch(
      /AtlasWorkflow|fixture-definition|keydown|KeyboardEvent|\.focus\(|dispatchEvent|Accessibility/u,
    );
    expect(bridgeSource).toMatch(/GATED_ATLAS_FIXTURE_IDS/u);
    expect(bridgeSource).toMatch(/authorities\.configureFixture/u);
    expect(bridgeSource).toMatch(/authorities\.requestCancellation/u);
    expect(bridgeSource).toMatch(/authorities\.prepareReopen/u);
    expect(bridgeSource).toMatch(/authorities\.requestExport/u);
  });

  it('delegates fixture, preview, full, and cancellation operations to existing authorities', () => {
    expect(appSource).toMatch(
      /configureObserverCommandFixture[\s\S]*?configureObserverFixture\(gatedAtlasFixture\(fixtureId\)\)/u,
    );
    expect(appSource).toMatch(/requestObserverCommandPreview[\s\S]*?requestExactFixturePreview/u);
    expect(appSource).toMatch(
      /requestObserverCommandFull[\s\S]*?await acceptFull\(\)[\s\S]*?currentPackagedAtlasObserverReceipt/u,
    );
    expect(appSource).toMatch(
      /requestObserverCommandCancellation[\s\S]*?startGenerationCancellationTrial/u,
    );
    expect(appSource).toMatch(
      /requestObserverCommandCancellationAftermath[\s\S]*?completeGenerationCancellationAftermath/u,
    );
  });

  it('passes the private save path only into the existing reopen authority', () => {
    expect(appSource).toMatch(
      /prepareObserverCommandReopen\(privateSavePath: string\)[\s\S]*?targetPath = privateSavePath[\s\S]*?requestExactFixtureReopen\([\s\S]*?exportObserverState\(\),[\s\S]*?prepareExportObserverReopenedAtlas/u,
    );
    expect(appSource.match(/privateSavePath/gu)).toHaveLength(2);
  });

  it('delegates both export opcodes through the existing validated export authority', () => {
    expect(appSource).toMatch(
      /requestObserverCommandExport[\s\S]*?requestExactFixtureExport\([\s\S]*?workflow\.exportSvg\(exportTargetPath\)[\s\S]*?workflow\.exportPng\(exportTargetPath\)[\s\S]*?packagedExportObserverReceipt/u,
    );
  });
});
