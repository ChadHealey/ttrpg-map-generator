<script lang="ts">
  import { MILESTONE_ONE_PROOF_SEED } from '@ttrpg-map/generation';
  import { renderSceneToSvg } from '@ttrpg-map/render';

  import { MilestoneOneProofWorkflow } from './milestone-one-proof-workflow.js';
  import ProofEvidencePanel from './ProofEvidencePanel.svelte';
  import ProofViewport from './ProofViewport.svelte';
  import { tauriMapworldInvoke } from './tauri-mapworld-invoke.js';

  const workflow = new MilestoneOneProofWorkflow();
  let proof = workflow.snapshot;
  let seed = MILESTONE_ONE_PROOF_SEED;
  let targetPath = '/tmp/Milestone-One.mapworld';
  let isBusy = false;

  $: svgExportHref =
    proof.scene === undefined
      ? undefined
      : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderSceneToSvg(proof.scene))}`;

  function generate(): void {
    workflow.generate(seed);
    refresh();
  }

  function rerollMarkers(): void {
    workflow.rerollMarkers();
    refresh();
  }

  async function save(): Promise<void> {
    isBusy = true;
    await workflow.save(tauriMapworldInvoke, targetPath);
    isBusy = false;
    refresh();
  }

  function closeProof(): void {
    workflow.close();
    refresh();
  }

  async function reopen(): Promise<void> {
    isBusy = true;
    await workflow.reopen(tauriMapworldInvoke);
    isBusy = false;
    refresh();
  }

  function refresh(): void {
    proof = workflow.snapshot;
  }
</script>

<svelte:head
  ><meta name="description" content="Milestone 1 deterministic kernel proof" /></svelte:head
>

<main>
  <section aria-labelledby="app-title" class="proof-shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Milestone 1 — Deterministic kernel</p>
        <h1 id="app-title">Selective reroll proof</h1>
      </div>
      <p class="summary">
        Generate the registered composition, reroll only its markers, then save, unload, and reopen
        authoritative state through the native <code>.mapworld</code> boundary.
      </p>
    </header>

    <form
      class="workflow-card"
      onsubmit={(event) => {
        event.preventDefault();
      }}
    >
      <div class="input-group seed-field">
        <label class="field-label" for="world-seed">Registered world seed</label>
        <input bind:value={seed} id="world-seed" inputmode="numeric" spellcheck="false" />
      </div>
      <button
        disabled={isBusy || proof.phase === 'saved' || proof.phase === 'closed'}
        onclick={generate}
        type="button">Generate baseline</button
      >
      <button disabled={isBusy || proof.phase !== 'baseline'} onclick={rerollMarkers} type="button"
        >Reroll markers</button
      >
      <div class="input-group path-field">
        <label class="field-label" for="target-path">Fresh native save target</label>
        <input bind:value={targetPath} id="target-path" spellcheck="false" />
      </div>
      <button
        disabled={isBusy || proof.phase !== 'rerolled'}
        onclick={() => void save()}
        type="button">Save .mapworld</button
      >
      <button disabled={isBusy || proof.phase !== 'saved'} onclick={closeProof} type="button"
        >Close proof</button
      >
      <button
        disabled={isBusy || proof.phase !== 'closed'}
        onclick={() => void reopen()}
        type="button">Reopen proof</button
      >
    </form>

    <p aria-live="polite" class="status-line" data-phase={proof.phase}>
      <span>{proof.phase}</span>{proof.statusMessage}
    </p>

    <div class="proof-grid">
      <div class="map-stack">
        <ProofViewport scene={proof.scene} />
        {#if svgExportHref !== undefined}<a
            class="export-link"
            download={`milestone-one-${proof.phase}.svg`}
            href={svgExportHref}>Export current SVG</a
          >{/if}
      </div>
      <ProofEvidencePanel {proof} />
    </div>
  </section>
</main>
