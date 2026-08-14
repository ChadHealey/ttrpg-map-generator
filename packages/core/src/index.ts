/**
 * Framework-free domain contracts shared by the generator, persistence, rendering, assets,
 * and desktop orchestration layers.
 */

/** A point in the fixed render-pixel coordinate space of a {@link RenderScene}. */
export interface RenderPoint {
  readonly xPx: number;
  readonly yPx: number;
}

/** A style-neutral link from a render node to the record that supplied it. */
export type RenderSourceId = string;

/** An ink and fill treatment shared by Canvas and SVG renderers. */
export interface RenderPaint {
  readonly fillColor: string;
  readonly strokeColor: string;
  readonly strokeWidthPx: number;
}

/** A filled rectangular render node. */
export interface RenderRectangle {
  readonly id: string;
  readonly kind: 'rectangle';
  readonly sourceId: RenderSourceId;
  readonly xPx: number;
  readonly yPx: number;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly fillColor: string;
}

/** A closed, filled polygon with an optional ink outline. */
export interface RenderPolygon {
  readonly id: string;
  readonly kind: 'polygon';
  readonly sourceId: RenderSourceId;
  readonly points: readonly RenderPoint[];
  readonly paint: RenderPaint;
}

/** An open ink path. */
export interface RenderPolyline {
  readonly id: string;
  readonly kind: 'polyline';
  readonly sourceId: RenderSourceId;
  readonly points: readonly RenderPoint[];
  readonly strokeColor: string;
  readonly strokeWidthPx: number;
}

/** A text label drawn in render-pixel coordinates. */
export interface RenderLabel {
  readonly id: string;
  readonly kind: 'label';
  readonly sourceId: RenderSourceId;
  readonly text: string;
  readonly position: RenderPoint;
  readonly fontFamily: string;
  readonly fontSizePx: number;
  readonly fontWeight: number;
  readonly fillColor: string;
  readonly textAnchor: 'start' | 'middle' | 'end';
}

/** A single renderer-neutral drawing instruction. */
export type RenderNode = RenderRectangle | RenderPolygon | RenderPolyline | RenderLabel;

/**
 * An ordered, immutable description of visual output in fixed render-pixel coordinates.
 * Renderers must interpret nodes in array order and may not reconstruct semantic geometry.
 */
export interface RenderScene {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly nodes: readonly RenderNode[];
}

/**
 * The fixed Milestone 0 scene used to prove renderer parity. It is render-only demonstration
 * content, not accepted world data or a generator output.
 */
export const inkedProofScene: RenderScene = {
  widthPx: 960,
  heightPx: 600,
  nodes: [
    {
      id: 'proof-paper',
      kind: 'rectangle',
      sourceId: 'proof:paper',
      xPx: 0,
      yPx: 0,
      widthPx: 960,
      heightPx: 600,
      fillColor: '#f3e7c6',
    },
    {
      id: 'proof-island',
      kind: 'polygon',
      sourceId: 'proof:island',
      points: [
        { xPx: 124, yPx: 341 },
        { xPx: 202, yPx: 228 },
        { xPx: 334, yPx: 169 },
        { xPx: 507, yPx: 185 },
        { xPx: 677, yPx: 128 },
        { xPx: 843, yPx: 229 },
        { xPx: 814, yPx: 365 },
        { xPx: 694, yPx: 457 },
        { xPx: 528, yPx: 429 },
        { xPx: 365, yPx: 488 },
        { xPx: 201, yPx: 432 },
      ],
      paint: {
        fillColor: '#cbd7a2',
        strokeColor: '#2c2a20',
        strokeWidthPx: 5,
      },
    },
    {
      id: 'proof-river',
      kind: 'polyline',
      sourceId: 'proof:river',
      points: [
        { xPx: 639, yPx: 171 },
        { xPx: 609, yPx: 222 },
        { xPx: 625, yPx: 269 },
        { xPx: 584, yPx: 318 },
        { xPx: 596, yPx: 380 },
        { xPx: 564, yPx: 427 },
      ],
      strokeColor: '#2d6170',
      strokeWidthPx: 7,
    },
    {
      id: 'proof-title',
      kind: 'label',
      sourceId: 'proof:label',
      text: 'The Verdant Reach',
      position: { xPx: 480, yPx: 550 },
      fontFamily: 'Georgia, serif',
      fontSizePx: 35,
      fontWeight: 600,
      fillColor: '#302d21',
      textAnchor: 'middle',
    },
  ],
};
