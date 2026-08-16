<script lang="ts">
  import type { RenderNode, RenderPoint, RenderScene } from '@ttrpg-map/core';
  import { renderSceneToCanvas } from '@ttrpg-map/render';
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

  export let scene: RenderScene | undefined;

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
  let selectedNodeId = 'milestone-one-proof-outline';
  let dragState: DragState | undefined;
  let hasDragged = false;

  $: selectedNode = scene?.nodes.find(({ id }) => id === selectedNodeId) ?? scene?.nodes[1];
  $: if (canvasContext !== undefined) redrawCanvas(scene);

  onMount(() => {
    canvasContext = canvasElement.getContext('2d') ?? undefined;
    if (canvasContext === undefined) throw new Error('Canvas 2D rendering is not available');
    redrawCanvas(scene);
  });

  function redrawCanvas(nextScene: RenderScene | undefined): void {
    if (canvasContext === undefined) return;
    canvasContext.save();
    canvasContext.setTransform(1, 0, 0, 1, 0, 0);
    canvasContext.clearRect(0, 0, canvasElement.width, canvasElement.height);
    if (nextScene !== undefined) {
      canvasContext.setTransform(
        viewport.zoomRatio,
        0,
        0,
        viewport.zoomRatio,
        viewport.offsetXPx,
        viewport.offsetYPx,
      );
      renderSceneToCanvas(canvasContext, nextScene);
    }
    canvasContext.restore();
  }

  function updateViewport(nextViewport: ViewportState): void {
    viewport = nextViewport;
    redrawCanvas(scene);
  }

  function panBy(deltaXPx: number, deltaYPx: number): void {
    updateViewport(panViewport(viewport, deltaXPx, deltaYPx));
  }

  function zoomBy(factor: number): void {
    if (scene === undefined) return;
    updateViewport(zoomViewport(viewport, factor, scene, MIN_ZOOM_RATIO, MAX_ZOOM_RATIO));
  }

  function resetViewport(): void {
    updateViewport(INITIAL_VIEWPORT);
  }

  function onCanvasPointerDown(event: PointerEvent): void {
    if (scene === undefined) return;
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
    if (canvasElement.hasPointerCapture(event.pointerId)) {
      canvasElement.releasePointerCapture(event.pointerId);
    }
    dragState = undefined;
    if (!hasDragged) selectNodeAt(event);
  }

  function onCanvasWheel(event: WheelEvent): void {
    if (event.deltaY === 0 || scene === undefined) return;
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR);
  }

  function onCanvasKeyDown(event: KeyboardEvent): void {
    if (scene === undefined) return;
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
    if (scene === undefined) return;
    const selected = findTopmostNodeAt(
      scene,
      scenePointFromCanvasPoint(toCanvasPoint(event), viewport),
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

  function describeNode(node: RenderNode): string {
    switch (node.kind) {
      case 'rectangle':
        return `Rectangle · ${String(node.widthPx)} × ${String(node.heightPx)} px`;
      case 'polygon':
        return `Polygon · ${String(node.points.length)} anchor points`;
      case 'compoundPath':
        return `Land fill · ${String(node.subpaths.length)} closed paths`;
      case 'polyline':
        return `Ink path · ${String(node.points.length)} anchor points`;
      case 'label':
        return `Label · “${node.text}”`;
    }
  }
</script>

<div class="viewport-card">
  <div class="viewport-toolbar" aria-label="Map viewport controls">
    <div class="pan-controls" aria-label="Pan map">
      <button
        aria-label="Pan left"
        disabled={scene === undefined}
        onclick={() => {
          panBy(-PAN_STEP_PX, 0);
        }}
        type="button">←</button
      >
      <button
        aria-label="Pan right"
        disabled={scene === undefined}
        onclick={() => {
          panBy(PAN_STEP_PX, 0);
        }}
        type="button">→</button
      >
    </div>
    <div class="zoom-controls">
      <button
        aria-label="Zoom out"
        disabled={scene === undefined}
        onclick={() => {
          zoomBy(1 / ZOOM_FACTOR);
        }}
        type="button">−</button
      >
      <output aria-live="polite">{Math.round(viewport.zoomRatio * 100)}%</output>
      <button
        aria-label="Zoom in"
        disabled={scene === undefined}
        onclick={() => {
          zoomBy(ZOOM_FACTOR);
        }}
        type="button">+</button
      >
      <button disabled={scene === undefined} onclick={resetViewport} type="button">Reset</button>
    </div>
  </div>
  <figure>
    <figcaption>
      Shared Canvas preview — accepted PlanetPoints mapped through one RenderScene.
    </figcaption>
    <canvas
      bind:this={canvasElement}
      aria-describedby="viewport-instructions"
      aria-label="Milestone 1 outline and marker composition"
      height={600}
      onkeydown={onCanvasKeyDown}
      onpointerdown={onCanvasPointerDown}
      onpointermove={onCanvasPointerMove}
      onpointerup={onCanvasPointerUp}
      onwheel={onCanvasWheel}
      tabindex="0"
      width={960}
    ></canvas>
    {#if scene === undefined}<div class="closed-overlay" aria-live="polite">
        No accepted document or RenderScene is loaded.
      </div>{/if}
    <p class="sr-only" id="viewport-instructions">
      Use arrow keys to pan, plus and minus to zoom, or zero to reset the map view.
    </p>
  </figure>
</div>

<aside aria-labelledby="selection-heading" class="selection-card">
  <p class="eyebrow">Render inspection</p>
  <h2 id="selection-heading">Scene node</h2>
  <label class="field-label" for="scene-node">Ordered node</label>
  <select bind:value={selectedNodeId} disabled={scene === undefined} id="scene-node">
    {#each scene?.nodes ?? [] as node (node.id)}<option value={node.id}>{node.id}</option>{/each}
  </select>
  {#if selectedNode !== undefined}
    <p class="selection-title">{describeNode(selectedNode)}</p>
    <dl>
      <div>
        <dt>Render node</dt>
        <dd>{selectedNode.id}</dd>
      </div>
      <div>
        <dt>Source entity</dt>
        <dd>{selectedNode.sourceId}</dd>
      </div>
      <div>
        <dt>Kind</dt>
        <dd>{selectedNode.kind}</dd>
      </div>
    </dl>
  {/if}
</aside>
