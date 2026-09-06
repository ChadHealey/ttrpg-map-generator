/** One fixed phase of 18 preview/full and 128 preview-only outcomes. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { createField } from './field.mjs';
import { calibrate, identities, lattice, tickHash } from './lattice.mjs';
import { measure } from './measure.mjs';
import { half, png, raster } from './raster.mjs';
const hash = (x) => createHash('sha256').update(x).digest('hex');
const cooperation = { cooperate: () => Promise.resolve(false) };
export async function evaluate(runtime, p, inputs, onRow) {
  const g = runtime.generation;
  const grids = {
    preview: lattice(runtime, g.WORLD_ATLAS_PREVIEW_PROFILE),
    full: lattice(runtime, g.WORLD_ATLAS_FULL_PROFILE),
  };
  const reports = [];
  let evaluations = 0,
    builds = 0;
  for (const { input, full } of inputs) {
    builds++;
    const field = createField(input, p),
      failures = [...(field.failures ?? [])];
    const report = {
      input,
      full,
      placement: field.placement ?? null,
      allocated: field.allocated,
      failures,
      ledger: field.ledger,
      threshold: null,
      preview: null,
      fullProfile: null,
      identities: null,
    };
    let images;
    if (field.ok) {
      report.polar = field.polar;
      report.geometry = field.owners;
      const calibration = calibrate(field, grids.preview);
      report.calibration = calibration;
      failures.push(...calibration.failures);
      if (calibration.ok) {
        const adapter = runtime.policy.adapter((point) => field.raw(point, calibration.cutoffs));
        const pre = await g.sampleAtlasMacroElevationField(
          grids.preview.profile,
          adapter,
          cooperation,
        );
        assert.equal(pre.status, 'completed');
        const selection = await g.selectAtlasLandWaterThreshold(
          pre.field,
          input.controls,
          cooperation,
        );
        assert.equal(selection.status, 'completed');
        report.threshold = selection.selection;
        let fullField;
        for (const name of full ? ['preview', 'full'] : ['preview']) {
          const sampled =
            name === 'preview'
              ? pre
              : await g.sampleAtlasMacroElevationField(grids.full.profile, adapter, cooperation);
          assert.equal(sampled.status, 'completed');
          if (name === 'full') fullField = sampled.field;
          const c = await g.classifyAtlasLandWater(
            sampled.field,
            selection.selection.contourLevel,
            input.controls.targetWaterCoveragePercent,
            cooperation,
          );
          assert.equal(c.status, 'completed');
          const metrics = measure(field, grids[name], c.output.samples);
          report[name === 'full' ? 'fullProfile' : name] = {
            tickSha256: tickHash(sampled.field),
            coverageErrorBp: c.output.absoluteWaterCoverageErrorBasisPoints,
            waterPercent: c.output.realizedWaterCoveragePercent,
            ...metrics,
          };
          if (c.output.absoluteWaterCoverageErrorBasisPoints > p.coverageToleranceBp)
            failures.push(`${name}.coverage`);
          if (metrics.outsideOwnerLandAnchors > 0) failures.push(`${name}.outside-guard`);
          if (metrics.gap.minimumRad !== null && metrics.gap.minimumRad < 0.05)
            failures.push(`${name}.gap`);
          if (metrics.owners.some((o) => o.errorBp > p.quotaToleranceBpTotal / field.owners.length))
            failures.push(`${name}.owner-quota`);
          if (name === 'full') {
            const native = raster(c.output.samples, grids.full.profile, 1600, 800);
            images = { native: native.image, half: half(native.mask) };
          }
        }
        report.identities = identities(runtime, pre.field, fullField);
      }
      report.fieldEvaluations = field.evaluations();
      evaluations += field.evaluations();
    } else report.fieldEvaluations = 0;
    if (full && !images) {
      images = {
        native: png(new Uint8Array(1600 * 800), 1600, 800),
        half: png(new Uint8Array(800 * 400), 800, 400),
      };
      report.placeholderImages = true;
    }
    if (images) report.images = { native: hash(images.native), half: hash(images.half) };
    report.outcome = failures.length ? 'no-proposal' : 'sampled-candidate';
    reports.push(report);
    await onRow(report, images);
    assert(evaluations <= 75836012);
  }
  return { reports, counts: { builds, fieldEvaluations: evaluations, reservedMaximum: 75836012 } };
}
