<script lang="ts">
  import { PROOF_MARKER_ASPECT_ID, PROOF_OUTLINE_ASPECT_ID } from '@ttrpg-map/generation';

  import type { MilestoneOneWorkflowSnapshot } from './milestone-one-proof-workflow.js';

  export let proof: MilestoneOneWorkflowSnapshot;

  $: evidence = proof.evidence ?? proof.rerolledEvidence ?? proof.baselineEvidence;
</script>

<aside aria-labelledby="evidence-heading" class="evidence-card">
  <p class="eyebrow">Canonical evidence</p>
  <h2 id="evidence-heading">{evidence?.checkpoint ?? 'Awaiting baseline'}</h2>

  <div class="aspect-card">
    <div class="aspect-heading">
      <h3>Outline</h3>
      <span>revision {evidence?.outline.revision ?? '—'}</span>
    </div>
    <p class="stable-id">{PROOF_OUTLINE_ASPECT_ID}</p>
    <dl>
      <div>
        <dt>Aspect SHA-256</dt>
        <dd>{evidence?.outline.canonicalAspectSha256 ?? '—'}</dd>
      </div>
      <div>
        <dt>Output SHA-256</dt>
        <dd>{evidence?.outline.canonicalOutputSha256 ?? '—'}</dd>
      </div>
    </dl>
  </div>

  <div class="aspect-card">
    <div class="aspect-heading">
      <h3>Markers</h3>
      <span>revision {evidence?.markers.revision ?? '—'}</span>
    </div>
    <p class="stable-id">{PROOF_MARKER_ASPECT_ID}</p>
    <dl>
      <div>
        <dt>Aspect SHA-256</dt>
        <dd>{evidence?.markers.canonicalAspectSha256 ?? '—'}</dd>
      </div>
      <div>
        <dt>Output SHA-256</dt>
        <dd>{evidence?.markers.canonicalOutputSha256 ?? '—'}</dd>
      </div>
    </dl>
  </div>

  <div class="comparison-grid">
    <div>
      <span>Marker-only isolation</span><strong class:pass={proof.isolation?.passed}
        >{proof.isolation === undefined
          ? 'PENDING'
          : proof.isolation.passed
            ? 'PASS'
            : 'FAIL'}</strong
      >
    </div>
    <div>
      <span>Native reopen equality</span><strong class:pass={proof.reopen?.passed}
        >{proof.reopen === undefined ? 'PENDING' : proof.reopen.passed ? 'PASS' : 'FAIL'}</strong
      >
    </div>
    <div>
      <span>Generator calls on reopen</span><strong
        class:pass={proof.reopenGenerationInvocationCount === 0}
        >{proof.reopenGenerationInvocationCount ?? '—'}</strong
      >
    </div>
    <div>
      <span>Native manifest fingerprint</span><code
        >{proof.reopenedManifestSha256 ?? proof.savedManifestSha256 ?? '—'}</code
      >
    </div>
    <div><span>Render SVG SHA-256</span><code>{evidence?.canonicalSvgSha256 ?? '—'}</code></div>
  </div>
</aside>
