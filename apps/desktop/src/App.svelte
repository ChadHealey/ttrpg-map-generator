<script lang="ts">
  import { inkedProofScene, type RenderNode, type RenderPoint } from '@ttrpg-map/core';
  import { renderSceneToCanvas, renderSceneToSvg } from '@ttrpg-map/render';
  import { onMount } from 'svelte';

  import { findTopmostNodeAt } from './scene-selection.js';
  import {
    INITIAL_VIEWPORT,
    panViewport,
    scaleClientDeltaToCanvas,
    scenePointFromCanvasPoint,
    type ViewportState,
    zoomViewport,
  } from './viewport.js';

  const milestone = 'Milestone 0 — App and rendering proof';
  const svgExportHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderSceneToSvg(inkedProofScene))}`;
  const PAN_STEP_PX = 64;
  const ZOOM_FACTOR = 1.2;
  const MIN_ZOOM_RATIO = 0.5;
  const MAX_ZOOM_RATIO = 3;

  interface DragState {
    readonly pointerId: number;
    readonly startClientX: number;
    readonly startClientY: number;
    readonly startViewport: ViewportState;
  }

  let canvasElement: HTMLCanvasElement;
  let canvasContext: CanvasRenderingContext2D | undefined;
  let viewport = INITIAL_VIEWPORT;
  let selectedNodeId = 'proof-island';
  let dragState: DragState | undefined;
  let hasDragged = false;

  $: selectedNode = findNodeById(selectedNodeId) ?? inkedProofScene.nodes[0];

  onMount(() => {
    canvasContext = canvasElement.getContext('2d') ?? undefined;
    if (canvasContext === undefined) throw new Error('Canvas 2D rendering is not available');
    redrawCanvas();
  });

  function redrawCanvas(): void {
    if (canvasContext === undefined) return;
    canvasContext.save();
    canvasContext.setTransform(1, 0, 0, 1, 0, 0);
    canvasContext.clearRect(0, 0, inkedProofScene.widthPx, inkedProofScene.heightPx);
    canvasContext.setTransform(
      viewport.zoomRatio,
      0,
      0,
      viewport.zoomRatio,
      viewport.offsetXPx,
      viewport.offsetYPx,
    );
    renderSceneToCanvas(canvasContext, inkedProofScene);
    canvasContext.restore();
  }

  function updateViewport(nextViewport: ViewportState): void {
    viewport = nextViewport;
    redrawCanvas();
  }

  function panBy(deltaXPx: number, deltaYPx: number): void {
    updateViewport(panViewport(viewport, deltaXPx, deltaYPx));
  }

  function zoomBy(factor: number): void {
    updateViewport(zoomViewport(viewport, factor, inkedProofScene, MIN_ZOOM_RATIO, MAX_ZOOM_RATIO));
  }

  function resetViewport(): void {
    updateViewport(INITIAL_VIEWPORT);
  }

  function onCanvasPointerDown(event: PointerEvent): void {
    canvasElement.setPointerCapture(event.pointerId);
    dragState = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startViewport: viewport,
    };
    hasDragged = false;
  }

  function onCanvasPointerMove(event: PointerEvent): void {
    const activeDrag = dragState;
    if (activeDrag?.pointerId !== event.pointerId) return;
    const clientDeltaXPx = event.clientX - activeDrag.startClientX;
    const clientDeltaYPx = event.clientY - activeDrag.startClientY;
    hasDragged ||= Math.abs(clientDeltaXPx) > 3 || Math.abs(clientDeltaYPx) > 3;
    const bounds = canvasElement.getBoundingClientRect();
    const canvasDelta = scaleClientDeltaToCanvas(
      clientDeltaXPx,
      clientDeltaYPx,
      canvasElement.width,
      canvasElement.height,
      bounds.width,
      bounds.height,
    );
    updateViewport(panViewport(activeDrag.startViewport, canvasDelta.xPx, canvasDelta.yPx));
  }

  function onCanvasPointerUp(event: PointerEvent): void {
    if (dragState?.pointerId !== event.pointerId) return;
    if (canvasElement.hasPointerCapture(event.pointerId))
      canvasElement.releasePointerCapture(event.pointerId);
    dragState = undefined;
    if (!hasDragged) selectNodeAt(event);
  }

  function onCanvasWheel(event: WheelEvent): void {
    if (event.deltaY === 0) return;
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR);
  }

  function onCanvasKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        panBy(0, -PAN_STEP_PX);
        return;
      case 'ArrowLeft':
        event.preventDefault();
        panBy(-PAN_STEP_PX, 0);
        return;
      case 'ArrowRight':
        event.preventDefault();
        panBy(PAN_STEP_PX, 0);
        return;
      case 'ArrowUp':
        event.preventDefault();
        panBy(0, PAN_STEP_PX);
        return;
      case '+':
      case '=':
        event.preventDefault();
        zoomBy(ZOOM_FACTOR);
        return;
      case '-':
      case '_':
        event.preventDefault();
        zoomBy(1 / ZOOM_FACTOR);
        return;
      case '0':
        event.preventDefault();
        resetViewport();
        return;
    }
  }

  function selectNodeAt(event: PointerEvent): void {
    const canvasPoint = toCanvasPoint(event);
    const selected = findTopmostNodeAt(
      inkedProofScene,
      scenePointFromCanvasPoint(canvasPoint, viewport),
    );
    if (selected !== undefined) selectedNodeId = selected.id;
  }

  function toCanvasPoint(event: PointerEvent): RenderPoint {
    const bounds = canvasElement.getBoundingClientRect();
    return {
      xPx: (event.clientX - bounds.left) * (canvasElement.width / bounds.width),
      yPx: (event.clientY - bounds.top) * (canvasElement.height / bounds.height),
    };
  }

  function findNodeById(id: string): RenderNode | undefined {
    return inkedProofScene.nodes.find((node) => node.id === id);
  }

  function describeNode(node: RenderNode): string {
    switch (node.kind) {
      case 'rectangle':
        return `Rectangle · ${String(node.widthPx)} × ${String(node.heightPx)} px`;
      case 'polygon':
        return `Polygon · ${String(node.points.length)} anchor points`;
      case 'polyline':
        return `Ink path · ${String(node.points.length)} anchor points`;
      case 'label':
        return `Label · “${node.text}”`;
    }
  }
</script>

<svelte:head
  ><meta
    name="description"
    content="Offline world-to-region fantasy map generator and editor"
  /></svelte:head
>

<main>
  <section aria-labelledby="app-title">
    <p class="eyebrow">{milestone}</p>
    <h1 id="app-title">TTRPG Map Generator</h1>
    <p class="summary">
      Navigate the proof scene, select an element, and inspect the same renderer-neutral content
      that powers the SVG export.
    </p>
    <div class="workspace">
      <div class="map-column">
        <div class="viewport-toolbar" aria-label="Map viewport controls">
          <div class="pan-controls" aria-label="Pan map">
            <button
              aria-label="Pan up"
              onclick={() => {
                panBy(0, PAN_STEP_PX);
              }}
              type="button">↑</button
            ><button
              aria-label="Pan left"
              onclick={() => {
                panBy(-PAN_STEP_PX, 0);
              }}
              type="button">←</button
            ><button
              aria-label="Pan right"
              onclick={() => {
                panBy(PAN_STEP_PX, 0);
              }}
              type="button">→</button
            ><button
              aria-label="Pan down"
              onclick={() => {
                panBy(0, -PAN_STEP_PX);
              }}
              type="button">↓</button
            >
          </div>
          <div class="zoom-controls">
            <button
              aria-label="Zoom out"
              onclick={() => {
                zoomBy(1 / ZOOM_FACTOR);
              }}
              type="button">−</button
            ><output aria-live="polite">{Math.round(viewport.zoomRatio * 100)}%</output><button
              aria-label="Zoom in"
              onclick={() => {
                zoomBy(ZOOM_FACTOR);
              }}
              type="button">+</button
            ><button onclick={resetViewport} type="button">Reset</button>
          </div>
        </div>
        <figure>
          <figcaption>
            Canvas preview — drag to pan; scroll or use +/− to zoom; click a feature to inspect it.
          </figcaption>
          <canvas
            bind:this={canvasElement}
            aria-describedby="viewport-instructions"
            aria-label="Interactive Canvas rendering of the inked proof scene"
            height={inkedProofScene.heightPx}
            onkeydown={onCanvasKeyDown}
            onpointerdown={onCanvasPointerDown}
            onpointermove={onCanvasPointerMove}
            onpointerup={onCanvasPointerUp}
            onwheel={onCanvasWheel}
            tabindex="0"
            width={inkedProofScene.widthPx}
          ></canvas>
          <p class="sr-only" id="viewport-instructions">
            Use arrow keys to pan, plus and minus to zoom, or zero to reset the map view.
          </p>
        </figure>
      </div>
      <aside aria-labelledby="inspector-heading" class="inspector">
        <p class="eyebrow">Selection</p>
        <h2 id="inspector-heading">Inspector</h2>
        <label class="node-picker" for="scene-node">Select proof-scene element</label>
        <select bind:value={selectedNodeId} id="scene-node">
          {#each inkedProofScene.nodes as node (node.id)}<option value={node.id}>{node.id}</option
            >{/each}
        </select>
        {#if selectedNode !== undefined}
          <p aria-live="polite" class="inspector-title">{describeNode(selectedNode)}</p>
          <dl>
            <div>
              <dt>Render node</dt>
              <dd>{selectedNode.id}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{selectedNode.sourceId}</dd>
            </div>
            <div>
              <dt>Kind</dt>
              <dd>{selectedNode.kind}</dd>
            </div>
          </dl>
        {/if}
        <p class="inspector-hint">
          The selected item comes from the ordered render scene; no renderer-specific copy is used.
        </p>
      </aside>
    </div>
    <details class="svg-proof">
      <summary>Compare the matching SVG preview</summary><img
        alt="SVG rendering of the inked proof scene"
        src={svgExportHref}
      />
    </details>
    <a class="export-link" download="inked-proof-scene.svg" href={svgExportHref}>Export SVG</a>
  </section>
</main>
