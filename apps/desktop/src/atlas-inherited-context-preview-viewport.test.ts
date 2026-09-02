import { describe, expect, it } from 'vitest';

import viewportSource from './ProofViewport.svelte?raw';

describe('inherited-context preview viewport contract', () => {
  it('renders traceable snapshot members rather than aggregate counts', () => {
    expect(viewportSource).toMatch(/<h3>Source lineage<\/h3>/u);
    expect(viewportSource).toMatch(/<h3>Inherited fields<\/h3>/u);
    expect(viewportSource).toMatch(/<h3>Clipped geometry anchors<\/h3>/u);
    expect(viewportSource).toMatch(/<h3>Boundary portals and water continuations<\/h3>/u);
    expect(viewportSource).toMatch(/\{field\.sourceAspectId\}/u);
    expect(viewportSource).toMatch(/\{anchor\.sourceAnchorId\}/u);
    expect(viewportSource).toMatch(/\{portal\.portalId\}/u);
  });

  it('keeps diagnostics visible with an active preview and announces them accessibly', () => {
    expect(viewportSource).toMatch(
      /\{#if activeInheritedContextDiagnostic !== undefined\}[\s\S]*?aria-live="polite"[\s\S]*?Inherited context diagnostic/u,
    );
    expect(viewportSource).toMatch(
      /\{:else if activeInheritedContextDiagnostic !== undefined\}[\s\S]*?aria-live="polite"/u,
    );
  });

  it('keeps preview controls and Escape cancellation wired to the viewport', () => {
    expect(viewportSource).toContain('Preview inherited context');
    expect(viewportSource).toContain('Dismiss inherited context');
    expect(viewportSource).toMatch(/case 'Escape':[\s\S]*?cancelFootprintSelection\(\);/u);
  });
});
