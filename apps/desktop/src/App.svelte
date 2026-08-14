<script lang="ts">
  import { inkedProofScene } from '@ttrpg-map/core';
  import { renderSceneToCanvas, renderSceneToSvg } from '@ttrpg-map/render';
  import { onMount } from 'svelte';

  const milestone = 'Milestone 0 — App and rendering proof';
  const svgMarkup = renderSceneToSvg(inkedProofScene);
  const svgExportHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;

  let canvasElement: HTMLCanvasElement;

  onMount(() => {
    const context = canvasElement.getContext('2d');

    if (context === null) {
      throw new Error('Canvas 2D rendering is not available in this desktop webview');
    }

    renderSceneToCanvas(context, inkedProofScene);
  });
</script>

<svelte:head>
  <meta name="description" content="Offline world-to-region fantasy map generator and editor" />
</svelte:head>

<main>
  <section aria-labelledby="app-title">
    <p class="eyebrow">{milestone}</p>
    <h1 id="app-title">TTRPG Map Generator</h1>
    <p class="summary">
      A single render scene drives the Canvas preview and deterministic SVG export.
    </p>
    <div class="scene-grid">
      <figure>
        <figcaption>Canvas preview</figcaption>
        <canvas
          bind:this={canvasElement}
          aria-label="Canvas rendering of the inked proof scene"
          height={inkedProofScene.heightPx}
          width={inkedProofScene.widthPx}
        ></canvas>
      </figure>
      <figure>
        <figcaption>SVG preview</figcaption>
        <img alt="SVG rendering of the inked proof scene" src={svgExportHref} />
      </figure>
    </div>
    <a class="export-link" download="inked-proof-scene.svg" href={svgExportHref}>Export SVG</a>
  </section>
</main>
