<script lang="ts">
  import type { AtlasWorkflowSnapshot } from './atlas-workflow.js';

  export let atlas: AtlasWorkflowSnapshot;
</script>

<section aria-labelledby="workflow-proof-heading" class="workflow-card">
  <p class="eyebrow">Complete visible proof</p>
  <h2 id="workflow-proof-heading">Workflow and evidence status</h2>
  <ol>
    <li>Cancel and restart a disposable coarse preview.</li>
    <li>Accept a separately generated full atlas and inspect semantic identities.</li>
    <li>Review and commit geography, then appearance, rerolls.</li>
    <li>Save, unload, and reopen the native package with zero generator calls.</li>
    <li>Export deterministic SVG and 8192 × 4096 PNG only from reopened state.</li>
  </ol>
  <dl>
    <div>
      <dt>Accepted checkpoint</dt>
      <dd>{atlas.acceptedCheckpoint ?? '—'}</dd>
    </div>
    <div>
      <dt>Authoritative package fingerprint</dt>
      <dd><code>{atlas.reopenedManifestSha256 ?? atlas.savedManifestSha256 ?? '—'}</code></dd>
    </div>
    <div>
      <dt>Canonical semantic aspects</dt>
      <dd>
        <code
          >{atlas.reopenedEvidence?.canonicalAspectSetSha256 ??
            atlas.savedEvidence?.canonicalAspectSetSha256 ??
            '—'}</code
        >
      </dd>
    </div>
    <div>
      <dt>Canonical accepted outputs</dt>
      <dd>
        <code
          >{atlas.reopenedEvidence?.canonicalOutputSetSha256 ??
            atlas.savedEvidence?.canonicalOutputSetSha256 ??
            '—'}</code
        >
      </dd>
    </div>
    <div>
      <dt>Canonical coastline output</dt>
      <dd>
        <code
          >{atlas.reopenedEvidence?.canonicalCoastlineOutputSha256 ??
            atlas.savedEvidence?.canonicalCoastlineOutputSha256 ??
            '—'}</code
        >
      </dd>
    </div>
    <div>
      <dt>Generator calls during reopen</dt>
      <dd>{atlas.reopenGenerationInvocationCount ?? '—'}</dd>
    </div>
    <div>
      <dt>Reopen evidence</dt>
      <dd>{atlas.reopenComparison?.passed === true ? 'PASS' : 'PENDING'}</dd>
    </div>
  </dl>
</section>
