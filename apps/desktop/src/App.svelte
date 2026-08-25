<script lang="ts">
  import { type AtlasControls, DEFAULT_ATLAS_CONTROLS } from '@ttrpg-map/core';
  import { onMount } from 'svelte';
  import {
    installObserverCommandChannelBridge,
    OBSERVER_COMMAND_CHANNEL_COMPILED,
  } from 'virtual:observer-command-channel-entry';

  import {
    AtlasWorkflow,
    isAtlasEditingPhase,
    MILESTONE_TWO_ATLAS_PROOF_SEED,
  } from './atlas-workflow.js';
  import { createAtlasAcceptedEvidence } from './atlas-workflow-evidence.js';
  import AtlasWorkflowEvidencePanel from './AtlasWorkflowEvidencePanel.svelte';
  import type { ObserverCommandAuthorities } from './observer-command-channel-bridge.js';
  import {
    type GatedAtlasFixture,
    gatedAtlasFixture,
    type GatedAtlasFixtureId,
    installPackagedAtlasObserverDispatch,
    PACKAGED_ATLAS_OBSERVER_RECEIPT_LABEL,
    PACKAGED_GENERATION_CANCELLATION_RECEIPT_LABEL,
    packagedAtlasObserverReceipt,
    type PackagedGenerationCancellationContext,
    type PackagedGenerationCancellationDependencies,
    type PackagedGenerationCancellationState,
    type PackagedGenerationCancellationTrial,
    requestExactFixtureGenerationCancellation,
    requestExactFixturePreview,
    requestGenerationCancellationAftermath,
    requestProductionFullAtlas,
  } from './packaged-atlas-observer-dispatch.js';
  import {
    installPackagedExportObserverDispatch,
    PACKAGED_EXPORT_OBSERVER_RECEIPT_LABEL,
    type PackagedExportObserverCompletion,
    packagedExportObserverReceipt,
    type PackagedExportObserverState,
    requestExactFixtureExport,
    requestExactFixtureReopen,
  } from './packaged-export-observer-dispatch.js';
  import {
    installPackagedPreviewDispatch,
    requestProductionCoarsePreview,
  } from './packaged-preview-dispatch.js';
  import ProofViewport from './ProofViewport.svelte';

  const workflow = new AtlasWorkflow();
  let atlas = workflow.snapshot;
  let seed: string = MILESTONE_TWO_ATLAS_PROOF_SEED;
  let controls: AtlasControls = { ...DEFAULT_ATLAS_CONTROLS };
  let selectedEntityId = '';
  let targetPath = '';
  let observerFixtureId: GatedAtlasFixtureId | undefined;
  let exportObserverCompletion: PackagedExportObserverCompletion | undefined;
  let generationCancellationContext: PackagedGenerationCancellationContext | undefined;
  const packagedAtlasObserverEnabled =
    import.meta.env.VITE_PACKAGED_ATLAS_OBSERVER_DISPATCH === '1';
  const packagedExportObserverEnabled =
    import.meta.env.VITE_PACKAGED_EXPORT_OBSERVER_DISPATCH === '1';

  onMount(() => {
    let mounted = true;
    const componentIsMounted = () => mounted;
    let removeObserverCommandChannel: () => void = () => undefined;
    const removePreviewDispatch = installPackagedPreviewDispatch(
      window,
      import.meta.env.VITE_PACKAGED_PREVIEW_OBSERVER_DISPATCH === '1',
      () => void preview(),
    );
    const removeAtlasDispatch = installPackagedAtlasObserverDispatch(
      window,
      packagedAtlasObserverEnabled,
      configureObserverFixture,
      () => ({ fixtureId: observerFixtureId, worldSeed: seed, controls }),
      () => void preview(),
      () => void acceptFull(),
      (trial) => void startGenerationCancellationTrial(trial),
      () => void completeGenerationCancellationAftermath(),
    );
    const removeExportDispatch = installPackagedExportObserverDispatch(
      window,
      import.meta.env.VITE_PACKAGED_EXPORT_OBSERVER_DISPATCH === '1',
      exportObserverState,
      prepareExportObserverReopenedAtlas,
      (exportTargetPath) => run(workflow.exportSvg(exportTargetPath)),
      (exportTargetPath) => run(workflow.exportPng(exportTargetPath)),
      (completion) => {
        exportObserverCompletion = completion;
      },
    );
    if (OBSERVER_COMMAND_CHANNEL_COMPILED) {
      void Promise.resolve()
        .then(async () => {
          if (!mounted) return;
          const remove = await installObserverCommandChannelBridge(
            observerCommandAuthorities(),
            componentIsMounted,
          );
          if (!componentIsMounted()) {
            remove();
            return;
          }
          removeObserverCommandChannel = remove;
        })
        .catch(() => undefined);
    }
    return () => {
      mounted = false;
      removeObserverCommandChannel();
      removePreviewDispatch();
      removeAtlasDispatch();
      removeExportDispatch();
    };
  });

  $: controlsAreAccepted = sameControls(controls, atlas.controls);
  $: editingIsEnabled = isAtlasEditingPhase(atlas.phase) && !atlas.isBusy;
  $: selectedEntity =
    atlas.inspectionEntities.find(({ entityId }) => entityId === selectedEntityId) ??
    atlas.inspectionEntities[0];
  $: observerReceipt = packagedAtlasObserverEnabled
    ? packagedAtlasObserverReceipt(observerFixtureId, seed, controls, {
        workflowPhase: atlas.phase,
        isBusy: atlas.isBusy,
        hasPreview: atlas.preview !== undefined,
        hasAcceptedAtlas: atlas.accepted !== undefined,
        acceptedCheckpoint: atlas.acceptedCheckpoint,
        sceneKind: atlas.scene?.sceneKind,
        acceptedWorldSeed:
          atlas.accepted === undefined ? undefined : String(atlas.accepted.document.worldSeed),
        acceptedControls: atlas.accepted?.geography.controls,
      })
    : undefined;
  $: exportObserverReceipt = packagedExportObserverEnabled
    ? packagedExportObserverReceipt(exportObserverState(), exportObserverCompletion)
    : undefined;

  async function preview(): Promise<void> {
    await requestProductionCoarsePreview(
      (nextSeed, nextControls) => workflow.requestPreview(nextSeed, nextControls),
      seed,
      controls,
      run,
    );
  }

  async function acceptFull(): Promise<void> {
    await requestProductionFullAtlas(() => workflow.acceptFull(seed, controls), run);
  }

  function generationCancellationState(): PackagedGenerationCancellationState {
    return {
      fixtureId: observerFixtureId,
      worldSeed: seed,
      controls,
      workflowPhase: atlas.phase,
      isBusy: atlas.isBusy,
      hasPreview: atlas.preview !== undefined,
      acceptedCheckpoint: atlas.acceptedCheckpoint,
      acceptedIdentity: atlas.accepted,
      acceptedWorldSeed:
        atlas.accepted === undefined ? undefined : String(atlas.accepted.document.worldSeed),
      acceptedControls: atlas.accepted?.geography.controls,
      progress: atlas.progress,
      diagnosticCodes: atlas.diagnosticCodes,
    };
  }

  async function startGenerationCancellationTrial(
    trial: PackagedGenerationCancellationTrial,
  ): Promise<PackagedGenerationCancellationContext | undefined> {
    generationCancellationContext = undefined;
    return requestExactFixtureGenerationCancellation(trial, cancellationDependencies());
  }

  async function completeGenerationCancellationAftermath(): Promise<
    PackagedGenerationCancellationContext | undefined
  > {
    return requestGenerationCancellationAftermath(
      generationCancellationContext,
      cancellationDependencies(),
    );
  }

  function workflowCancellationState(): PackagedGenerationCancellationState {
    atlas = workflow.snapshot;
    return generationCancellationState();
  }

  function configureObserverFixture(fixture: GatedAtlasFixture): void {
    generationCancellationContext = undefined;
    if (
      atlas.isBusy ||
      atlas.phase !== 'empty' ||
      atlas.preview !== undefined ||
      atlas.accepted !== undefined
    ) {
      observerFixtureId = undefined;
      return;
    }
    seed = fixture.worldSeed;
    controls = { ...fixture.controls };
    observerFixtureId = fixture.fixtureId;
  }

  function exportObserverState(): PackagedExportObserverState {
    return {
      fixtureId: observerFixtureId,
      worldSeed: seed,
      controls,
      workflowPhase: atlas.phase,
      isBusy: atlas.isBusy,
      hasPreview: atlas.preview !== undefined,
      acceptedCheckpoint: atlas.acceptedCheckpoint,
      acceptedIdentity: atlas.accepted,
      acceptedWorldSeed:
        atlas.accepted === undefined ? undefined : String(atlas.accepted.document.worldSeed),
      acceptedControls: atlas.accepted?.geography.controls,
      savedEvidence: atlas.savedEvidence,
      reopenedEvidence: atlas.reopenedEvidence,
      reopenComparison: atlas.reopenComparison,
      savedManifestSha256: atlas.savedManifestSha256,
      reopenedManifestSha256: atlas.reopenedManifestSha256,
      reopenGenerationInvocationCount: atlas.reopenGenerationInvocationCount,
      saveTargetPath: atlas.targetPath.length === 0 ? targetPath : atlas.targetPath,
      svgExportReceipt: atlas.svgExportReceipt,
      pngExportReceipt: atlas.pngExportReceipt,
    };
  }

  async function prepareExportObserverReopenedAtlas(): Promise<void> {
    planReroll('geography');
    await commitReroll();
    planReroll('appearance');
    await commitReroll();
    await save();
    close();
    await reopen();
  }

  function observerCommandAuthorities(): ObserverCommandAuthorities {
    return {
      configureFixture: configureObserverCommandFixture,
      requestPreview: requestObserverCommandPreview,
      requestFull: requestObserverCommandFull,
      requestCancellation: requestObserverCommandCancellation,
      requestCancellationAftermath: requestObserverCommandCancellationAftermath,
      prepareReopen: prepareObserverCommandReopen,
      requestExport: requestObserverCommandExport,
      cancelActiveOperation: cancelObserverCommandOperation,
    };
  }

  function configureObserverCommandFixture(fixtureId: GatedAtlasFixtureId) {
    refresh();
    configureObserverFixture(gatedAtlasFixture(fixtureId));
    refresh();
    return currentPackagedAtlasObserverReceipt();
  }

  async function requestObserverCommandPreview() {
    let operation: Promise<void> | undefined;
    const accepted = requestExactFixturePreview(
      { fixtureId: observerFixtureId, worldSeed: seed, controls },
      () => {
        operation = preview();
      },
    );
    if (!accepted || operation === undefined) return undefined;
    await operation;
    return currentPackagedAtlasObserverReceipt();
  }

  async function requestObserverCommandFull() {
    await acceptFull();
    return currentPackagedAtlasObserverReceipt();
  }

  async function requestObserverCommandCancellation(trial: PackagedGenerationCancellationTrial) {
    const context = await startGenerationCancellationTrial(trial);
    return context?.receipt.status === 'cancelled' ? context.receipt : undefined;
  }

  async function requestObserverCommandCancellationAftermath() {
    const context = await completeGenerationCancellationAftermath();
    return context?.receipt.status === 'aftermath-complete' ? context.receipt : undefined;
  }

  async function prepareObserverCommandReopen(privateSavePath: string) {
    targetPath = privateSavePath;
    exportObserverCompletion = undefined;
    const accepted = await requestExactFixtureReopen(
      exportObserverState(),
      prepareExportObserverReopenedAtlas,
    );
    return accepted
      ? packagedExportObserverReceipt(exportObserverState(), exportObserverCompletion)
      : undefined;
  }

  async function requestObserverCommandExport(format: 'svg' | 'png') {
    exportObserverCompletion = undefined;
    const completion = await requestExactFixtureExport(
      format,
      exportObserverState(),
      (exportTargetPath) =>
        run(
          format === 'svg'
            ? workflow.exportSvg(exportTargetPath)
            : workflow.exportPng(exportTargetPath),
        ),
      exportObserverState,
    );
    exportObserverCompletion = completion;
    return completion === undefined
      ? undefined
      : packagedExportObserverReceipt(exportObserverState(), completion);
  }

  function currentPackagedAtlasObserverReceipt() {
    refresh();
    return packagedAtlasObserverReceipt(observerFixtureId, seed, controls, {
      workflowPhase: atlas.phase,
      isBusy: atlas.isBusy,
      hasPreview: atlas.preview !== undefined,
      hasAcceptedAtlas: atlas.accepted !== undefined,
      acceptedCheckpoint: atlas.acceptedCheckpoint,
      sceneKind: atlas.scene?.sceneKind,
      acceptedWorldSeed:
        atlas.accepted === undefined ? undefined : String(atlas.accepted.document.worldSeed),
      acceptedControls: atlas.accepted?.geography.controls,
    });
  }

  function cancellationDependencies(): PackagedGenerationCancellationDependencies {
    return {
      currentState: () => workflowCancellationState(),
      requestPreview: preview,
      requestFull: acceptFull,
      cancelActiveOperation: () => workflow.cancelActiveOperation(),
      acceptedEvidence: async (accepted) => {
        const result = await createAtlasAcceptedEvidence(accepted, 'baseline');
        return result.ok ? result.evidence : undefined;
      },
      record: (context: PackagedGenerationCancellationContext | undefined) => {
        generationCancellationContext = context;
        refresh();
      },
      nowEpochMilliseconds: () => performance.timeOrigin + performance.now(),
    };
  }

  function cancelObserverCommandOperation(): void {
    refresh();
    if (atlas.isBusy && atlas.isCancellationAllowed) workflow.cancelActiveOperation();
    refresh();
  }

  function discardPreview(): void {
    workflow.discardPreview();
    refresh();
    controls = { ...atlas.controls };
  }

  function planReroll(kind: 'geography' | 'appearance'): void {
    workflow.planReroll(kind);
    refresh();
  }

  async function commitReroll(): Promise<void> {
    await run(workflow.commitPlannedReroll());
  }

  async function exportSvg(): Promise<void> {
    await run(workflow.exportSvg());
  }

  async function exportPng(): Promise<void> {
    await run(workflow.exportPng());
  }

  async function save(): Promise<void> {
    await run(workflow.save(targetPath));
  }

  function close(): void {
    workflow.close();
    refresh();
  }

  async function reopen(): Promise<void> {
    await run(workflow.reopen());
  }

  function cancel(): void {
    workflow.cancelActiveOperation();
    refresh();
  }

  async function run(operation: Promise<unknown>): Promise<void> {
    refresh();
    const timer = globalThis.setInterval(refresh, 100);
    try {
      await operation;
    } finally {
      globalThis.clearInterval(timer);
      refresh();
    }
  }

  function refresh(): void {
    atlas = workflow.snapshot;
    if (selectedEntityId.length === 0 && atlas.inspectionEntities[0] !== undefined) {
      selectedEntityId = atlas.inspectionEntities[0].entityId;
    }
  }

  function sameControls(left: AtlasControls, right: AtlasControls): boolean {
    return (
      left.worldCircumferenceKm === right.worldCircumferenceKm &&
      left.targetWaterCoveragePercent === right.targetWaterCoveragePercent &&
      left.continentCountIntent === right.continentCountIntent &&
      left.continentDistribution === right.continentDistribution &&
      left.fragmentationPercent === right.fragmentationPercent &&
      left.islandAbundancePercent === right.islandAbundancePercent &&
      left.archipelagoAbundancePercent === right.archipelagoAbundancePercent &&
      left.oceanConnectivity === right.oceanConnectivity &&
      left.polarCharacter === right.polarCharacter
    );
  }
</script>

<svelte:head
  ><meta name="description" content="Milestone 2 deterministic whole-world atlas" /></svelte:head
>

<main>
  {#if observerReceipt !== undefined}
    <p aria-label={PACKAGED_ATLAS_OBSERVER_RECEIPT_LABEL} class="sr-only">
      {JSON.stringify(observerReceipt)}
    </p>
  {/if}
  {#if generationCancellationContext !== undefined}
    <p aria-label={PACKAGED_GENERATION_CANCELLATION_RECEIPT_LABEL} class="sr-only">
      {JSON.stringify(generationCancellationContext.receipt)}
    </p>
  {/if}
  {#if exportObserverReceipt !== undefined}
    <p aria-label={PACKAGED_EXPORT_OBSERVER_RECEIPT_LABEL} class="sr-only">
      {JSON.stringify(exportObserverReceipt)}
    </p>
  {/if}
  <section aria-labelledby="app-title" class="proof-shell atlas-shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Milestone 2 — Whole-world atlas</p>
        <h1 id="app-title">Atlas workshop</h1>
      </div>
      <p class="summary">
        Configure atlas-scale intent, inspect a disposable coarse preview, then accept one
        separately generated full-resolution geography transaction. Selective rerolls state their
        isolation boundary before they can commit.
      </p>
    </header>

    <form
      aria-label="Whole-world atlas controls"
      class="atlas-controls"
      onsubmit={(event) => {
        event.preventDefault();
      }}
    >
      <div class="input-group seed-field">
        <label class="field-label" for="world-seed">World seed · unsigned 64-bit integer</label>
        <input
          bind:value={seed}
          disabled={!editingIsEnabled || atlas.accepted !== undefined}
          id="world-seed"
          inputmode="numeric"
          spellcheck="false"
        />
      </div>
      <div class="input-group">
        <label class="field-label" for="circumference">Circumference · km</label><input
          bind:value={controls.worldCircumferenceKm}
          disabled={!editingIsEnabled}
          id="circumference"
          max="80000"
          min="10000"
          step="1000"
          type="number"
        />
      </div>
      <div class="input-group">
        <label class="field-label" for="water-coverage">Water coverage · %</label><input
          bind:value={controls.targetWaterCoveragePercent}
          disabled={!editingIsEnabled}
          id="water-coverage"
          max="80"
          min="45"
          step="1"
          type="number"
        />
      </div>
      <div class="input-group">
        <label class="field-label" for="continent-count">Continent-count intent · count</label
        ><input
          bind:value={controls.continentCountIntent}
          disabled={!editingIsEnabled}
          id="continent-count"
          max="8"
          min="1"
          step="1"
          type="number"
        />
      </div>
      <div class="input-group">
        <label class="field-label" for="continent-distribution">Continent distribution</label
        ><select
          bind:value={controls.continentDistribution}
          disabled={!editingIsEnabled}
          id="continent-distribution"
          ><option value="balanced">Balanced</option><option value="varied">Varied</option><option
            value="oneDominant">One dominant</option
          ></select
        >
      </div>
      <div class="input-group">
        <label class="field-label" for="fragmentation">Fragmentation · %</label><input
          bind:value={controls.fragmentationPercent}
          disabled={!editingIsEnabled}
          id="fragmentation"
          max="100"
          min="0"
          step="1"
          type="number"
        />
      </div>
      <div class="input-group">
        <label class="field-label" for="island-abundance">Island abundance · %</label><input
          bind:value={controls.islandAbundancePercent}
          disabled={!editingIsEnabled}
          id="island-abundance"
          max="100"
          min="0"
          step="1"
          type="number"
        />
      </div>
      <div class="input-group">
        <label class="field-label" for="archipelago-abundance">Archipelago abundance · %</label
        ><input
          bind:value={controls.archipelagoAbundancePercent}
          disabled={!editingIsEnabled}
          id="archipelago-abundance"
          max="100"
          min="0"
          step="1"
          type="number"
        />
      </div>
      <div class="input-group">
        <label class="field-label" for="ocean-connectivity">Ocean connectivity</label><select
          bind:value={controls.oceanConnectivity}
          disabled={!editingIsEnabled}
          id="ocean-connectivity"
          ><option value="singleGlobal">Single global</option><option value="connectedMajority"
            >Connected majority</option
          ><option value="multipleBasins">Multiple basins</option></select
        >
      </div>
      <div class="input-group">
        <label class="field-label" for="polar-character">Polar character</label><select
          bind:value={controls.polarCharacter}
          disabled={!editingIsEnabled}
          id="polar-character"
          ><option value="oceanBiased">Ocean biased</option><option value="neutral">Neutral</option
          ><option value="landBiased">Land biased</option></select
        >
      </div>
    </form>

    <div aria-label="Atlas generation operations" class="workflow-card atlas-actions">
      <button
        disabled={atlas.isBusy || !editingIsEnabled}
        onclick={() => void preview()}
        type="button">Generate coarse preview</button
      >
      <button
        disabled={atlas.isBusy || !editingIsEnabled || atlas.preview === undefined}
        onclick={() => void acceptFull()}
        type="button">Accept full atlas</button
      >
      <button
        disabled={atlas.isBusy || atlas.preview === undefined}
        onclick={discardPreview}
        type="button">Discard preview</button
      >
      <button
        disabled={!atlas.isBusy || !atlas.isCancellationAllowed}
        onclick={cancel}
        type="button">Cancel active work</button
      >
      <button
        disabled={atlas.isBusy ||
          atlas.phase !== 'accepted' ||
          atlas.accepted === undefined ||
          atlas.preview !== undefined ||
          !controlsAreAccepted}
        onclick={() => {
          planReroll('geography');
        }}
        type="button">Preview geography reroll</button
      >
      <button
        disabled={atlas.isBusy ||
          atlas.phase !== 'accepted' ||
          atlas.accepted === undefined ||
          atlas.preview !== undefined ||
          !controlsAreAccepted}
        onclick={() => {
          planReroll('appearance');
        }}
        type="button">Preview appearance reroll</button
      >
      <button
        disabled={atlas.isBusy ||
          atlas.phase !== 'accepted' ||
          atlas.pendingReroll === undefined ||
          !controlsAreAccepted}
        onclick={() => void commitReroll()}
        type="button">Commit reviewed reroll</button
      >
      <button
        disabled={atlas.isBusy ||
          atlas.phase !== 'accepted' ||
          atlas.preview !== undefined ||
          atlas.acceptedCheckpoint !== 'appearance-rerolled' ||
          !controlsAreAccepted}
        onclick={() => void save()}
        type="button">Save accepted .mapworld</button
      >
      <button disabled={atlas.isBusy || atlas.phase !== 'saved'} onclick={close} type="button"
        >Unload accepted atlas</button
      >
      <button
        disabled={atlas.isBusy || atlas.phase !== 'closed'}
        onclick={() => void reopen()}
        type="button">Reopen saved atlas</button
      >
      <button
        disabled={atlas.isBusy || atlas.phase !== 'reopened' || atlas.preview !== undefined}
        onclick={() => void exportPng()}
        type="button">Export 8192 × 4096 PNG</button
      >
      <button
        disabled={atlas.isBusy || atlas.phase !== 'reopened' || atlas.preview !== undefined}
        onclick={() => void exportSvg()}
        type="button">Export deterministic SVG</button
      >
    </div>

    <div class="input-group save-field">
      <label class="field-label" for="mapworld-target"
        >Save target · fresh absolute .mapworld path</label
      >
      <input
        bind:value={targetPath}
        disabled={atlas.isBusy ||
          atlas.phase === 'saved' ||
          atlas.phase === 'closed' ||
          atlas.phase === 'reopened'}
        id="mapworld-target"
        placeholder="/existing-parent/My-Atlas.mapworld"
        spellcheck="false"
      />
    </div>

    <div aria-live="polite" class="status-line" data-phase={atlas.phase}>
      <span>{atlas.preview === undefined ? atlas.phase : 'preview · disposable'}</span>
      <p>{atlas.statusMessage}</p>
    </div>
    {#if atlas.progress !== undefined}
      <div class="progress-row">
        <label class="field-label" for="atlas-progress">{atlas.progress.stage}</label>
        <progress
          id="atlas-progress"
          max={atlas.progress.totalWork}
          value={atlas.progress.completedWork}
        ></progress>
        <output
          >{Math.round((atlas.progress.completedWork / atlas.progress.totalWork) * 100)}%</output
        >
      </div>
    {/if}

    {#if atlas.pendingReroll !== undefined}
      <section aria-labelledby="reroll-impact-heading" class="impact-card">
        <p class="eyebrow">Required change-set preview</p>
        <h2 id="reroll-impact-heading">{atlas.pendingReroll.kind} reroll impact</h2>
        <div class="impact-grid">
          <div>
            <h3>Remains fixed</h3>
            <ul>
              {#each atlas.pendingReroll.remainsFixed as item (item)}<li>{item}</li>{/each}
            </ul>
          </div>
          <div>
            <h3>Will change</h3>
            <ul>
              {#each atlas.pendingReroll.changes as item (item)}<li>{item}</li>{/each}
            </ul>
          </div>
        </div>
      </section>
    {/if}

    {#if atlas.pngExportReceipt !== undefined}
      <section aria-labelledby="png-export-heading" class="workflow-card">
        <p class="eyebrow">atlas-png-v1 · verified native export</p>
        <h2 id="png-export-heading">PNG export complete</h2>
        <p>{atlas.pngExportReceipt.targetPath}</p>
        <dl>
          <div>
            <dt>Pixel size</dt>
            <dd>{atlas.pngExportReceipt.widthPx} × {atlas.pngExportReceipt.heightPx} px</dd>
          </div>
          <div>
            <dt>Bytes</dt>
            <dd>{atlas.pngExportReceipt.byteLength}</dd>
          </div>
          <div>
            <dt>SHA-256</dt>
            <dd><code>{atlas.pngExportReceipt.sha256}</code></dd>
          </div>
        </dl>
      </section>
    {/if}

    {#if atlas.svgExportReceipt !== undefined}
      <section aria-labelledby="svg-export-heading" class="workflow-card">
        <p class="eyebrow">atlas-svg-v1 · verified native export</p>
        <h2 id="svg-export-heading">SVG export complete</h2>
        <p>{atlas.svgExportReceipt.targetPath}</p>
        <dl>
          <div>
            <dt>Physical size</dt>
            <dd>
              {atlas.svgExportReceipt.widthMillimeters} × {atlas.svgExportReceipt.heightMillimeters} mm
            </dd>
          </div>
          <div>
            <dt>Bytes</dt>
            <dd>{atlas.svgExportReceipt.byteLength}</dd>
          </div>
          <div>
            <dt>SHA-256</dt>
            <dd><code>{atlas.svgExportReceipt.sha256}</code></dd>
          </div>
        </dl>
      </section>
    {/if}

    <AtlasWorkflowEvidencePanel {atlas} />

    <div class="proof-grid">
      <div class="map-stack"><ProofViewport preview={atlas.preview} scene={atlas.scene} /></div>
      <aside aria-labelledby="semantic-inspector-heading" class="evidence-card semantic-inspector">
        <p class="eyebrow">Semantic inspection</p>
        <h2 id="semantic-inspector-heading">Landmass or water body</h2>
        <label class="field-label" for="semantic-entity">Stable source identity</label>
        <select
          bind:value={selectedEntityId}
          disabled={atlas.inspectionEntities.length === 0 || atlas.preview !== undefined}
          id="semantic-entity"
        >
          {#each atlas.inspectionEntities as entity (entity.entityId)}<option
              value={entity.entityId}>{entity.kind} · {entity.entityId}</option
            >{/each}
        </select>
        {#if atlas.preview !== undefined}
          <p>
            The accepted atlas remains unchanged, but disposable preview state exposes no semantic
            identities.
          </p>
        {:else if selectedEntity !== undefined}
          <dl>
            <div>
              <dt>Entity ID</dt>
              <dd>{selectedEntity.entityId}</dd>
            </div>
            <div>
              <dt>Semantic kind</dt>
              <dd>{selectedEntity.kind}</dd>
            </div>
            <div>
              <dt>Relationships</dt>
              <dd>{selectedEntity.relationshipSummary}</dd>
            </div>
          </dl>
        {:else}
          <p>Accept a full atlas to inspect stable semantic identities.</p>
        {/if}
        {#if atlas.diagnosticCodes.length > 0}
          <h3>Diagnostics</h3>
          <ul class="diagnostic-list">
            {#each atlas.diagnosticCodes as code (code)}<li><code>{code}</code></li>{/each}
          </ul>
        {/if}
      </aside>
    </div>
  </section>
</main>
