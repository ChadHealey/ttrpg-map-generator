<script lang="ts">
  import { type AtlasControls, DEFAULT_ATLAS_CONTROLS } from '@ttrpg-map/core';

  import { AtlasWorkflow, MILESTONE_TWO_ATLAS_PROOF_SEED } from './atlas-workflow.js';
  import ProofViewport from './ProofViewport.svelte';

  const workflow = new AtlasWorkflow();
  let atlas = workflow.snapshot;
  let seed = MILESTONE_TWO_ATLAS_PROOF_SEED;
  let controls: AtlasControls = { ...DEFAULT_ATLAS_CONTROLS };
  let selectedEntityId = '';

  $: controlsAreAccepted = sameControls(controls, atlas.controls);
  $: selectedEntity =
    atlas.inspectionEntities.find(({ entityId }) => entityId === selectedEntityId) ??
    atlas.inspectionEntities[0];

  async function preview(): Promise<void> {
    await run(workflow.requestPreview(seed, controls));
  }

  async function acceptFull(): Promise<void> {
    await run(workflow.acceptFull(seed, controls));
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
          disabled={atlas.accepted !== undefined}
          id="world-seed"
          inputmode="numeric"
          spellcheck="false"
        />
      </div>
      <div class="input-group">
        <label class="field-label" for="circumference">Circumference · km</label><input
          bind:value={controls.worldCircumferenceKm}
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
          id="continent-count"
          max="8"
          min="1"
          step="1"
          type="number"
        />
      </div>
      <div class="input-group">
        <label class="field-label" for="continent-distribution">Continent distribution</label
        ><select bind:value={controls.continentDistribution} id="continent-distribution"
          ><option value="balanced">Balanced</option><option value="varied">Varied</option><option
            value="oneDominant">One dominant</option
          ></select
        >
      </div>
      <div class="input-group">
        <label class="field-label" for="fragmentation">Fragmentation · %</label><input
          bind:value={controls.fragmentationPercent}
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
          id="ocean-connectivity"
          ><option value="singleGlobal">Single global</option><option value="connectedMajority"
            >Connected majority</option
          ><option value="multipleBasins">Multiple basins</option></select
        >
      </div>
      <div class="input-group">
        <label class="field-label" for="polar-character">Polar character</label><select
          bind:value={controls.polarCharacter}
          id="polar-character"
          ><option value="oceanBiased">Ocean biased</option><option value="neutral">Neutral</option
          ><option value="landBiased">Land biased</option></select
        >
      </div>
    </form>

    <div aria-label="Atlas generation operations" class="workflow-card atlas-actions">
      <button disabled={atlas.isBusy} onclick={() => void preview()} type="button"
        >Generate coarse preview</button
      >
      <button
        disabled={atlas.isBusy || atlas.preview === undefined}
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
          atlas.accepted === undefined ||
          atlas.preview !== undefined ||
          !controlsAreAccepted}
        onclick={() => {
          planReroll('appearance');
        }}
        type="button">Preview appearance reroll</button
      >
      <button
        disabled={atlas.isBusy || atlas.pendingReroll === undefined || !controlsAreAccepted}
        onclick={() => void commitReroll()}
        type="button">Commit reviewed reroll</button
      >
      <button
        disabled={atlas.isBusy || atlas.accepted === undefined || atlas.preview !== undefined}
        onclick={() => void exportPng()}
        type="button">Export 8192 × 4096 PNG</button
      >
      <button
        disabled={atlas.isBusy || atlas.accepted === undefined || atlas.preview !== undefined}
        onclick={() => void exportSvg()}
        type="button">Export deterministic SVG</button
      >
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
