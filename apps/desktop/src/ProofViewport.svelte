<script lang="ts">
  import type { RenderNode, RenderPoint, RenderScene } from '@ttrpg-map/core';
  import type { AtlasLandWaterPreview } from '@ttrpg-map/generation';
  import { type AtlasRenderScene, renderSceneToCanvas } from '@ttrpg-map/render';
  import { onMount, tick } from 'svelte';

  import {
    activateAtlasFootprintSelector,
    ATLAS_FOOTPRINT_SELECTOR_CURSOR_STEP_PX,
    type AtlasFootprintSelectorSource,
    cancelAtlasFootprintSelector,
    moveAtlasFootprintSelectorCursor,
    selectAtlasFootprintAt,
  } from './atlas-footprint-selector.js';
  import { findTopmostNodeAt } from './scene-selection.js';
  import {
    canvasBackingStoreDimensions,
    INITIAL_VIEWPORT,
    panViewport,
    scaleClientDeltaToCanvas,
    scenePointFromCanvasPoint,
    type ViewportState,
    zoomViewport,
  } from './viewport.js';

  export let scene: RenderScene | undefined;
  export let preview: AtlasLandWaterPreview | undefined = undefined;
  export let footprintSelectorSource: AtlasFootprintSelectorSource | undefined = undefined;

  const PAN_STEP_PX = 64;
  const ZOOM_FACTOR = 1.2;
  const MIN_ZOOM_RATIO = 0.5;
  const MAX_ZOOM_RATIO = 3;
  const PREVIEW_CANVAS_WIDTH_PX = 1_600;
  const PREVIEW_CANVAS_HEIGHT_PX = 800;
  const PREVIEW_CANVAS_DIMENSIONS = Object.freeze({
    widthPx: PREVIEW_CANVAS_WIDTH_PX,
    heightPx: PREVIEW_CANVAS_HEIGHT_PX,
  });

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
  let footprintSelector = cancelAtlasFootprintSelector();

  $: selectedNode = scene?.nodes.find(({ id }) => id === selectedNodeId) ?? scene?.nodes[1];
  $: atlasLabels = (scene as AtlasRenderScene | undefined)?.vectorLabels?.nodes ?? [];
  $: footprintSelectionAvailable =
    scene !== undefined && preview === undefined && footprintSelectorSource !== undefined;
  $: if (!footprintSelectionAvailable && footprintSelector.mode !== 'inactive') {
    footprintSelector = cancelAtlasFootprintSelector();
  }

  // Updating a canvas width or height clears its backing store. Draw only after Svelte applies those
  // attributes so a newly accepted scene is not cleared after rendering.
  $: if (canvasContext !== undefined) {
    void redrawAfterCanvasResize(scene, preview, footprintSelector);
  }

  onMount(() => {
    canvasContext = canvasElement.getContext('2d') ?? undefined;
    if (canvasContext === undefined) throw new Error('Canvas 2D rendering is not available');
    redrawCanvas(scene, preview, footprintSelector);
  });

  function redrawCanvas(
    nextScene: RenderScene | undefined,
    nextPreview: AtlasLandWaterPreview | undefined,
    nextSelector: typeof footprintSelector,
  ): void {
    if (canvasContext === undefined) return;
    canvasContext.save();
    canvasContext.setTransform(1, 0, 0, 1, 0, 0);
    canvasContext.clearRect(0, 0, canvasElement.width, canvasElement.height);
    if (nextPreview !== undefined) {
      drawDisposablePreview(canvasContext, nextPreview);
    } else if (nextScene !== undefined) {
      canvasContext.setTransform(
        viewport.zoomRatio,
        0,
        0,
        viewport.zoomRatio,
        viewport.offsetXPx,
        viewport.offsetYPx,
      );
      renderSceneToCanvas(canvasContext, nextScene);
      drawFootprintSelector(canvasContext, nextSelector);
    }
    canvasContext.restore();
  }

  async function redrawAfterCanvasResize(
    nextScene: RenderScene | undefined,
    nextPreview: AtlasLandWaterPreview | undefined,
    nextSelector: typeof footprintSelector,
  ): Promise<void> {
    await tick();
    if (nextScene !== scene || nextPreview !== preview || nextSelector !== footprintSelector)
      return;
    redrawCanvas(nextScene, nextPreview, nextSelector);
  }

  function updateViewport(nextViewport: ViewportState): void {
    viewport = nextViewport;
    redrawCanvas(scene, preview, footprintSelector);
  }

  function panBy(deltaXPx: number, deltaYPx: number): void {
    updateViewport(panViewport(viewport, deltaXPx, deltaYPx));
  }

  function zoomBy(factor: number): void {
    if (scene === undefined || preview !== undefined) return;
    updateViewport(zoomViewport(viewport, factor, scene, MIN_ZOOM_RATIO, MAX_ZOOM_RATIO));
  }

  function resetViewport(): void {
    updateViewport(INITIAL_VIEWPORT);
  }

  function onCanvasPointerDown(event: PointerEvent): void {
    if (scene === undefined || preview !== undefined) return;
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
    if (!hasDragged) {
      if (footprintSelector.mode === 'active') selectFootprintAtCanvasPoint(toCanvasPoint(event));
      else selectNodeAt(event);
    }
  }

  function onCanvasWheel(event: WheelEvent): void {
    if (event.deltaY === 0 || scene === undefined || preview !== undefined) return;
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR);
  }

  function onCanvasKeyDown(event: KeyboardEvent): void {
    if (scene === undefined || preview !== undefined) return;
    if (footprintSelector.mode === 'active') {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          moveFootprintCursor(0, ATLAS_FOOTPRINT_SELECTOR_CURSOR_STEP_PX);
          return;
        case 'ArrowLeft':
          event.preventDefault();
          moveFootprintCursor(-ATLAS_FOOTPRINT_SELECTOR_CURSOR_STEP_PX, 0);
          return;
        case 'ArrowRight':
          event.preventDefault();
          moveFootprintCursor(ATLAS_FOOTPRINT_SELECTOR_CURSOR_STEP_PX, 0);
          return;
        case 'ArrowUp':
          event.preventDefault();
          moveFootprintCursor(0, -ATLAS_FOOTPRINT_SELECTOR_CURSOR_STEP_PX);
          return;
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (footprintSelector.cursor !== undefined) {
            selectFootprintAtScenePoint(footprintSelector.cursor);
          }
          return;
        case 'Escape':
          event.preventDefault();
          cancelFootprintSelection();
          return;
      }
    }
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
    if (scene === undefined || preview !== undefined) return;
    const selected = findTopmostNodeAt(
      scene,
      scenePointFromCanvasPoint(toCanvasPoint(event), viewport),
    );
    if (selected !== undefined) selectedNodeId = selected.id;
  }

  function activateFootprintSelection(): void {
    if (scene === undefined || footprintSelectorSource === undefined || preview !== undefined)
      return;
    footprintSelector = activateAtlasFootprintSelector(scene);
  }

  function cancelFootprintSelection(): void {
    footprintSelector = cancelAtlasFootprintSelector();
  }

  function moveFootprintCursor(deltaXPx: number, deltaYPx: number): void {
    if (scene === undefined) return;
    footprintSelector = moveAtlasFootprintSelectorCursor(
      footprintSelector,
      deltaXPx,
      deltaYPx,
      scene,
    );
  }

  function selectFootprintAtCanvasPoint(canvasPoint: RenderPoint): void {
    selectFootprintAtScenePoint(scenePointFromCanvasPoint(canvasPoint, viewport));
  }

  function selectFootprintAtScenePoint(scenePoint: RenderPoint): void {
    if (scene === undefined || footprintSelectorSource === undefined) return;
    footprintSelector = selectAtlasFootprintAt(
      footprintSelector,
      footprintSelectorSource,
      scene,
      scenePoint,
    );
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

  function drawDisposablePreview(
    context: CanvasRenderingContext2D,
    value: AtlasLandWaterPreview,
  ): void {
    const image = context.createImageData(value.longitudeCellCount, value.latitudeBandCount);
    for (let y = 0; y < value.latitudeBandCount; y += 1) {
      const latitudeIndex = Math.round(
        (y * value.latitudeBandCount) / (value.latitudeBandCount - 1),
      );
      for (let x = 0; x < value.longitudeCellCount; x += 1) {
        const sourceIndex =
          latitudeIndex === 0
            ? 0
            : latitudeIndex === value.latitudeBandCount
              ? value.landWaterSamples.length - 1
              : 1 + (latitudeIndex - 1) * value.longitudeCellCount + x;
        const isLand = value.landWaterSamples[sourceIndex] === 'land';
        const pixelIndex = (y * value.longitudeCellCount + x) * 4;
        image.data[pixelIndex] = isLand ? 220 : 180;
        image.data[pixelIndex + 1] = isLand ? 207 : 202;
        image.data[pixelIndex + 2] = isLand ? 171 : 199;
        image.data[pixelIndex + 3] = 255;
      }
    }
    const buffer = document.createElement('canvas');
    buffer.width = value.longitudeCellCount;
    buffer.height = value.latitudeBandCount;
    buffer.getContext('2d')?.putImageData(image, 0, 0);
    context.imageSmoothingEnabled = false;
    context.drawImage(buffer, 0, 0, canvasElement.width, canvasElement.height);
  }

  function drawFootprintSelector(
    context: CanvasRenderingContext2D,
    selector: typeof footprintSelector,
  ): void {
    if (selector.mode !== 'active') return;
    const cursor = selector.cursor;
    if (cursor !== undefined) {
      context.save();
      context.strokeStyle = '#2d6170';
      context.lineWidth = 2 / viewport.zoomRatio;
      context.beginPath();
      context.moveTo(cursor.xPx - 12 / viewport.zoomRatio, cursor.yPx);
      context.lineTo(cursor.xPx + 12 / viewport.zoomRatio, cursor.yPx);
      context.moveTo(cursor.xPx, cursor.yPx - 12 / viewport.zoomRatio);
      context.lineTo(cursor.xPx, cursor.yPx + 12 / viewport.zoomRatio);
      context.stroke();
      context.restore();
    }
    const candidate = selector.candidate;
    if (candidate === undefined) return;
    context.save();
    context.strokeStyle = '#9f3d2d';
    context.lineWidth = 3 / viewport.zoomRatio;
    context.setLineDash([10 / viewport.zoomRatio, 6 / viewport.zoomRatio]);
    for (const path of candidate.overlayPaths) {
      const first = path.points[0];
      if (first === undefined) continue;
      context.beginPath();
      context.moveTo(first.xPx, first.yPx);
      for (const point of path.points.slice(1)) context.lineTo(point.xPx, point.yPx);
      if (path.isClosed) context.closePath();
      context.stroke();
    }
    context.restore();
  }
</script>

<div class="viewport-card">
  <div class="viewport-toolbar" aria-label="Map viewport controls">
    <div class="pan-controls" aria-label="Pan map">
      <button
        aria-label="Pan left"
        disabled={scene === undefined || preview !== undefined}
        onclick={() => {
          panBy(-PAN_STEP_PX, 0);
        }}
        type="button">←</button
      >
      <button
        aria-label="Pan right"
        disabled={scene === undefined || preview !== undefined}
        onclick={() => {
          panBy(PAN_STEP_PX, 0);
        }}
        type="button">→</button
      >
    </div>
    <div class="zoom-controls">
      <button
        aria-pressed={footprintSelector.mode === 'active'}
        disabled={!footprintSelectionAvailable}
        onclick={activateFootprintSelection}
        type="button">Select footprint</button
      >
      {#if footprintSelector.mode === 'active'}<button
          onclick={cancelFootprintSelection}
          type="button">Cancel selection</button
        >{/if}
      <button
        aria-label="Zoom out"
        disabled={scene === undefined || preview !== undefined}
        onclick={() => {
          zoomBy(1 / ZOOM_FACTOR);
        }}
        type="button">−</button
      >
      <output aria-live="polite">{Math.round(viewport.zoomRatio * 100)}%</output>
      <button
        aria-label="Zoom in"
        disabled={scene === undefined || preview !== undefined}
        onclick={() => {
          zoomBy(ZOOM_FACTOR);
        }}
        type="button">+</button
      >
      <button
        disabled={scene === undefined || preview !== undefined}
        onclick={resetViewport}
        type="button">Reset</button
      >
    </div>
  </div>
  <figure>
    <figcaption>
      {preview === undefined
        ? 'Accepted atlas — canonical PlanetPoints mapped through one RenderScene.'
        : 'DISPOSABLE COARSE PREVIEW — not accepted, saveable, or promotable.'}
    </figcaption>
    <canvas
      bind:this={canvasElement}
      aria-describedby="viewport-instructions"
      aria-label={preview === undefined
        ? footprintSelector.mode === 'active'
          ? 'Accepted whole-world ink atlas footprint selector'
          : 'Accepted whole-world ink atlas'
        : 'Disposable coarse atlas preview'}
      height={canvasBackingStoreDimensions(scene, PREVIEW_CANVAS_DIMENSIONS).heightPx}
      onkeydown={onCanvasKeyDown}
      onpointerdown={onCanvasPointerDown}
      onpointermove={onCanvasPointerMove}
      onpointerup={onCanvasPointerUp}
      onwheel={onCanvasWheel}
      tabindex="0"
      width={canvasBackingStoreDimensions(scene, PREVIEW_CANVAS_DIMENSIONS).widthPx}
    ></canvas>
    {#if scene === undefined && preview === undefined}<div
        class="closed-overlay"
        aria-live="polite"
      >
        No accepted document or RenderScene is loaded.
      </div>{/if}
    <p class="sr-only" id="viewport-instructions">
      {footprintSelector.mode === 'active'
        ? 'Use arrow keys to move the footprint cursor, Enter or Space to select, Escape to cancel, and plus, minus, or zero to change the view.'
        : 'Use arrow keys to pan, plus and minus to zoom, or zero to reset the map view.'}
    </p>
    {#if preview === undefined && atlasLabels.length > 0}
      <ul aria-label="Accepted atlas labels" class="sr-only">
        {#each atlasLabels as label (label.placementId)}
          <li data-placement-id={label.placementId}>{label.accessibilityText}</li>
        {/each}
      </ul>
    {/if}
  </figure>
</div>

<aside aria-labelledby="selection-heading" class="selection-card">
  <p class="eyebrow">Render inspection</p>
  <h2 id="selection-heading">{preview === undefined ? 'Scene node' : 'Preview boundary'}</h2>
  <label class="field-label" for="scene-node">Ordered node</label>
  <select
    bind:value={selectedNodeId}
    disabled={scene === undefined || preview !== undefined}
    id="scene-node"
  >
    {#each scene?.nodes ?? [] as node (node.id)}<option value={node.id}>{node.id}</option>{/each}
  </select>
  {#if preview !== undefined}
    <p class="selection-title">Disposable {preview.profileId}</p>
    <p>
      No accepted aspect IDs, revisions, semantic entities, or package paths exist in preview state.
    </p>
  {/if}
  {#if footprintSelector.mode === 'active'}
    <p class="selection-title">Footprint selector active</p>
    {#if footprintSelector.candidate !== undefined}
      <dl>
        <div>
          <dt>Transient footprint</dt>
          <dd>{footprintSelector.candidate.entityId}</dd>
        </div>
        <div>
          <dt>Origin ticks</dt>
          <dd>
            {footprintSelector.candidate.footprint.origin.longitudeTicks},
            {footprintSelector.candidate.footprint.origin.latitudeTicks}
          </dd>
        </div>
      </dl>
    {:else if footprintSelector.diagnostic !== undefined}
      <p><code>{footprintSelector.diagnostic.code}</code></p>
      <p>{footprintSelector.diagnostic.message}</p>
    {:else}
      <p>Choose an atlas location with the pointer or keyboard cursor.</p>
    {/if}
  {:else if preview === undefined && selectedNode !== undefined}
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
