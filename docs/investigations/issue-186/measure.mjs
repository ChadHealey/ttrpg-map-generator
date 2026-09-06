/** One evaluation per canonical anchor; arrays stay ephemeral and are shared by both policies. */
import assert from 'node:assert/strict';

import { fixedRoleDiagnostics, simplificationDisplacement } from './diagnostics.mjs';
import { hash } from './runtime.mjs';
export function canonicalBytes(values, kind) {
  const size = kind === 'f64' ? 8 : kind === 'i32' ? 4 : 1,
    bytes = Buffer.alloc(values.length * size);
  values.forEach((value, index) => {
    if (kind === 'f64') bytes.writeDoubleLE(value, index * size);
    else if (kind === 'i32') bytes.writeInt32LE(value, index * size);
    else bytes[index] = value;
  });
  return bytes;
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const stable = (core, x) => core.roundTiesAwayFromZero(x * 1e6) / 1e6 || 0;
export function sampleProfile(report, profile, loaded, field, geometry) {
  const components = [],
    componentIndices = report.placement.owners.map((o) => {
      const first = components.length;
      components.push({ ownerId: o.id, id: o.id + '/body', kind: 'body', landAnchorCount: 0 });
      const islands = o.candidate.islands.map((island) => {
        const index = components.length;
        components.push({ ownerId: o.id, id: island.id, kind: island.kind, landAnchorCount: 0 });
        return {
          index,
          polygon: island.polygon,
          bounds: [
            Math.min(...island.polygon.map((p) => p[0])),
            Math.max(...island.polygon.map((p) => p[0])),
            Math.min(...island.polygon.map((p) => p[1])),
            Math.max(...island.polygon.map((p) => p[1])),
          ],
        };
      });
      return { first, islands };
    });
  const { generation: g, core, policy } = loaded,
    count = g.getAtlasSampleAnchorCount(profile),
    ticks = new Int32Array(count),
    normalized = new Float64Array(count),
    land = new Uint8Array(count),
    ownerByAnchor = new Int8Array(count).fill(-1),
    componentByAnchor = new Int16Array(count).fill(-1),
    ownerWeights = report.placement.owners.map(() => 0);
  let saturationNegative = 0,
    saturationPositive = 0,
    zeroCount = 0,
    totalWeight = 0,
    ambiguousOwners = 0;
  for (let y = 0; y <= profile.latitudeBandCount; y++) {
    const pole = y === 0 || y === profile.latitudeBandCount,
      latitude = core.planetPointToAngles(g.getAtlasGridVertex(profile, 0, y)).latitudeRad,
      weight = pole ? 0 : core.roundTiesAwayFromZero(Math.cos(latitude) * 2 ** 20);
    for (let x = 0; x < (pole ? 1 : profile.longitudeCellCount); x++) {
      const index = g.getAtlasSampleStorageIndex(profile, x, y),
        point = g.getAtlasGridVertex(profile, x, y),
        angles = core.planetPointToAngles(point),
        vector = [
          Math.cos(angles.latitudeRad) * Math.cos(angles.longitudeRad),
          Math.cos(angles.latitudeRad) * Math.sin(angles.longitudeRad),
          Math.sin(angles.latitudeRad),
        ];
      const value = field.evaluate(vector);
      normalized[index] = policy.normalize(value);
      ticks[index] = policy.quantize(value);
      if (value < -1) saturationNegative++;
      if (value > 1) saturationPositive++;
      if (ticks[index] === 0) zeroCount++;
      land[index] = ticks[index] > 0 ? 1 : 0;
      totalWeight += weight;
      if (land[index]) {
        const owners = report.placement.owners.flatMap((o, i) =>
          Math.acos(Math.max(-1, Math.min(1, dot(o.center, vector)))) < o.radius ? [i] : [],
        );
        if (owners.length !== 1) ambiguousOwners++;
        else {
          ownerByAnchor[index] = owners[0];
          ownerWeights[owners[0]] += weight;
          const owner = report.placement.owners[owners[0]],
            local = geometry.forwardLambert([
              dot(owner.east, vector),
              dot(owner.north, vector),
              dot(owner.center, vector),
            ]),
            declared = componentIndices[owners[0]];
          const islands = declared.islands.filter(
            ({ bounds, polygon }) =>
              local[0] >= bounds[0] &&
              local[0] <= bounds[1] &&
              local[1] >= bounds[2] &&
              local[1] <= bounds[3] &&
              geometry.pointLocation(local, polygon) >= 0,
          );
          if (islands.length > 1) ambiguousOwners++;
          else {
            const component = islands[0]?.index ?? declared.first;
            componentByAnchor[index] = component;
            components[component].landAnchorCount++;
          }
        }
      }
    }
  }
  const owners = report.placement.owners.map((o, i) => {
    const percent = stable(core, (ownerWeights[i] / totalWeight) * 100);
    return {
      id: o.id,
      quota: o.quota,
      weightedPercent: percent,
      unroundedWeightedPercent: (ownerWeights[i] / totalWeight) * 100,
      errorPercentagePoints: Math.abs(percent - 100 * o.quota),
      previewLimitPercentagePoints: 0.25 / report.placement.owners.length,
    };
  });
  return {
    profile,
    ticks,
    normalized,
    land,
    ownerByAnchor,
    componentByAnchor,
    components,
    summary: {
      profileId: profile.profileId,
      uniqueAnchorCount: count,
      normalizedFloat64LESha256: hash(canonicalBytes(normalized, 'f64')),
      ticksInt32LESha256: hash(canonicalBytes(ticks, 'i32')),
      landUint8Sha256: hash(land),
      ownerInt8Sha256: hash(ownerByAnchor),
      originalComponents: components,
      componentInt32LESha256: hash(canonicalBytes(componentByAnchor, 'i32')),
      zeroCount,
      saturationNegative,
      saturationPositive,
      ambiguousOwners,
      owners,
    },
  };
}
export function sharedAnchors(preview, full, g) {
  let checked = 0,
    mismatches = 0,
    firstMismatch = null;
  const p = g.WORLD_ATLAS_PREVIEW_PROFILE;
  for (let y = 0; y <= p.latitudeBandCount; y++)
    for (let x = 0; x < (y === 0 || y === p.latitudeBandCount ? 1 : p.longitudeCellCount); x++) {
      const i = g.getAtlasSampleStorageIndex(p, x, y),
        address = g.getFullProfileAddressForPreview(x, y),
        j = g.getAtlasSampleStorageIndex(
          g.WORLD_ATLAS_FULL_PROFILE,
          address.longitudeIndex,
          address.latitudeIndex,
        );
      if (preview.ticks[i] !== full.ticks[j] || preview.normalized[i] !== full.normalized[j]) {
        mismatches++;
        firstMismatch ??= {
          previewIndex: i,
          fullIndex: j,
          previewTick: preview.ticks[i],
          fullTick: full.ticks[j],
          previewScalar: preview.normalized[i],
          fullScalar: full.normalized[j],
        };
      }
      checked++;
    }
  return { checked, exact: mismatches === 0, mismatches, firstMismatch };
}
export function ringOwnerProvenance(result, samples, report) {
  if (!result.extraction) return [];
  return result.extraction.rings.map((ring, i) => {
    const ids = [
      ...new Set(
        (ring.sourceTransitions ?? []).map((t) => samples.ownerByAnchor[t.landSampleIndex]),
      ),
    ].sort((a, b) => a - b);
    return {
      rawIndex: i,
      originalComponentIndices: [
        ...new Set(
          (ring.sourceTransitions ?? []).map((t) => samples.componentByAnchor[t.landSampleIndex]),
        ),
      ].sort((a, b) => a - b),
      rawComponentKey: result.correspondence.rings[i]?.componentKey ?? null,
      rawPredecessorKey: result.correspondence.rings[i]?.rawPredecessorKey ?? null,
      ownerIndices: ids,
      ownerIds: ids.map((k) => report.placement.owners[k]?.id ?? null),
      unambiguous: ids.length === 1 && ids[0] >= 0,
    };
  });
}
export function errorLedger(report, profile, policy) {
  const quantum = 1 / 2 ** 24,
    beta = 0.01,
    extension = 0.02;
  const upperLipschitz = Math.max(
    ...report.placement.owners.map((o) => 1 / Math.cos((o.radius + extension) / 2)),
  );
  const diameter = (2 * Math.PI) / profile.longitudeCellCount + Math.PI / profile.latitudeBandCount;
  const coordinateError = (2 * Math.PI) / 2 ** 32;
  const scalarResidual =
    upperLipschitz * diameter +
    quantum / 2 +
    (policy === 'H' ? quantum / 2 : 0) +
    upperLipschitz * coordinateError;
  const oneSided =
    diameter + (policy === 'H' ? (quantum * upperLipschitz) / 2 : 0) + coordinateError;
  const simplificationGeneric = (Math.SQRT2 * 524288 * 2 * Math.PI) / 2 ** 32;
  const delta = oneSided + simplificationGeneric;
  const owners = report.placement.owners.map((o) => {
    const m = o.certificate.metrics,
      c = Math.cos((m.angularRadius + beta) / 2);
    return {
      id: o.id,
      primary: o.primary,
      originalAngularRadius: m.angularRadius,
      guardRadius: o.radius,
      localCosine: c,
      convexEvaluationCap: o.radius + extension < Math.PI / 2,
      certifiedContainmentMargin: o.radius - m.angularRadius,
      positiveHalfTickBelowGuardMargin: quantum / 2 < o.radius - m.angularRadius,
      strictBandConditions: {
        clippingInactive: beta / c < extension,
        guardInactive: o.radius - m.angularRadius - beta > beta / c,
        otherOwnersExcluded:
          o.radius - m.angularRadius + (report.placement.minimumGap ?? 0) - beta > beta / c,
      },
      interiorDiskSlack: m.interior.radiusLower - (o.primary ? 0.15 : 0.075),
      conditionalInteriorDiskAfterDelta: m.interior.radiusLower - delta,
      roleMargins: m.roles.map((role) => ({
        id: role.id,
        kind: role.kind,
        originalShare: role.share,
        shareSlack: role.share - (role.kind === 'lobe' ? 0.08 : 0.05),
        diskSlack: role.firstDiskRadiusLower - (role.kind === 'lobe' ? 0.05 : 0.04),
        widthLowerSlack: role.widthLower - (role.kind === 'lobe' ? 0.1 : 0.08),
        widthUpperSlack: role.kind === 'peninsula' ? 0.16 - role.widthUpper : null,
        extentLowerSlack: role.kind === 'peninsula' ? role.extentLower - 0.2 : null,
        extentUpperSlack: role.kind === 'peninsula' ? 0.45 - role.extentUpper : null,
        conditionalDiskSlackAfterDelta:
          role.firstDiskRadiusLower - delta - (role.kind === 'lobe' ? 0.05 : 0.04),
        conditionalWidthLowerSlackAfterDelta:
          role.widthLower - 2 * delta - (role.kind === 'lobe' ? 0.1 : 0.08),
        conditionalWidthUpperSlackAfterDelta:
          role.kind === 'peninsula' ? 0.16 - role.widthUpper - 2 * delta : null,
        conditionalExtentUpperSlackAfterDelta:
          role.kind === 'peninsula' ? 0.45 - role.extentUpper - 2 * delta : null,
        conditionalExtentLowerSlackAfterDelta:
          role.kind === 'peninsula' ? role.extentLower - 2 * delta - 0.2 : null,
        conditionalRatioAfterDelta:
          role.kind === 'peninsula'
            ? (role.extentLower - 2 * delta) / (role.widthUpper + 2 * delta)
            : null,
      })),
      bayOriginalSlacks: o.primary
        ? {
            openingLower: m.bay.openingLower - 0.12,
            openingUpper: 0.3 - m.bay.openingUpper,
            depth: m.bay.depthLower - 0.15,
            removedShare: m.bay.removedBodyShareLower - 0.02,
          }
        : null,
      roleCorrespondence:
        'not-established; perturbed metric rows are conditional, not new certificates',
    };
  });
  return {
    normalizationRealZeroSetDisplacement: 0,
    realArithmeticGlobalUpperLipschitz: upperLipschitz,
    scalarInverseClippingThreshold: extension,
    conditionalCellScalarResidualUpper: scalarResidual,
    scalarResidualWithinInverseDomain: scalarResidual < extension,
    conditionalScalarAngularTransfer: scalarResidual * upperLipschitz,
    rawToOriginalCoordinateAffineAngularUpper: oneSided,
    rawToOriginalShortestGeodesicAngularUpper:
      2 * diameter + (policy === 'H' ? (quantum * upperLipschitz) / 2 : 0) + coordinateError,
    originalToRawAngularUpper: null,
    coastDistanceTargetRad: beta,
    rawOneSidedBoundWithinTarget: oneSided <= beta,
    genericSimplificationCoordinateAffineAngularUpper: simplificationGeneric,
    conditionalSimplifiedOneSidedAngularUpper: delta,
    conditionalSimplifiedBoundWithinTarget: delta <= beta,
    quantizerFieldErrorUpper: quantum / 2,
    contourFieldBias: policy === 'H' ? quantum / 2 : 0,
    conservativeCellPathDiameterRad: diameter,
    planetCoordinateRoundingAngularSumUpper: coordinateError,
    simplificationCoordinateToleranceTicks: 524288,
    owners,
    extractedRoleCertification: 'unproved',
    limitingObligations: [
      ...(oneSided > beta ? ['preview-cell-bound-exceeds-D'] : []),
      'original-to-extracted-direction-unproved',
      'fixed-role-cut-correspondence-unproved',
      'binary64-residual-unbounded',
    ],
    boundScope:
      'Real arithmetic; coordinate-affine and shortest-geodesic interpretations are separately labelled. Metric perturbations require two-way role correspondence, which this ledger does not establish.',
  };
}
export function evaluatePolicies(evaluate) {
  return ['Z', 'H'].map((policy) => {
    try {
      return { policy, attempted: true, value: evaluate(policy), error: null };
    } catch (error) {
      return {
        policy,
        attempted: true,
        value: null,
        error: { name: error.name, message: error.message },
      };
    }
  });
}
export async function evaluateProfile(report, profile, loaded, field, geometry) {
  const samples = sampleProfile(report, profile, loaded, field, geometry),
    quantized = loaded.policy.fieldFromTicks(profile, samples.ticks);
  let classification = null,
    classificationError = null;
  try {
    classification = await loaded.policy.classify(
      quantized,
      report.input.controls.targetWaterCoveragePercent,
    );
    const reference = loaded.policy.coverageReference(
      quantized,
      report.input.controls.targetWaterCoveragePercent,
    );
    assert.equal(
      classification.realizedWaterCoveragePercent,
      reference.realizedWaterCoveragePercent,
    );
    assert.equal(
      classification.absoluteWaterCoverageErrorBasisPoints,
      reference.absoluteWaterCoverageErrorBasisPoints,
    );
    for (let i = 0; i < samples.land.length; i++)
      assert.equal(
        classification.samples.at(i) === 'land',
        samples.land[i] === 1,
        'Public sample bits changed',
      );
  } catch (error) {
    classificationError = { name: error.name, message: error.message };
  }
  const outcomes = evaluatePolicies((name) => {
    const result = loaded.policy.extractPolicy(quantized, name, hash),
      provenance = ringOwnerProvenance(result, samples, report),
      failures = [...result.failures];
    if (classificationError) failures.push('classification-failure');
    if (classification?.absoluteWaterCoverageErrorBasisPoints > 25) failures.push('total-coverage');
    if (samples.summary.ambiguousOwners || provenance.some((p) => !p.unambiguous))
      failures.push('owner-correspondence');
    if (
      profile.profileId === 'world-atlas-preview-v1' &&
      samples.summary.owners.some((o) => o.errorPercentagePoints > o.previewLimitPercentagePoints)
    )
      failures.push('private-preview-owner-coverage');
    if (samples.components.some((c) => c.landAnchorCount === 0))
      failures.push('original-component-without-land-anchor');
    if (
      provenance.some(
        (p) => p.originalComponentIndices.length !== 1 || p.originalComponentIndices[0] < 0,
      )
    )
      failures.push('original-components-merged-or-ambiguous');
    const rawByOriginal = new Map();
    for (const p of provenance) {
      for (const i of p.originalComponentIndices) {
        if (!rawByOriginal.has(i)) rawByOriginal.set(i, new Set());
        rawByOriginal.get(i).add(p.rawComponentKey);
      }
    }
    if ([...rawByOriginal.values()].some((s) => s.size > 1))
      failures.push('original-component-split');
    failures.push('extracted-role-certification-unproved');
    const displacements =
      result.extraction?.rings.map((ring, index) =>
        simplificationDisplacement(ring, result.simplified[index].ring, loaded.generation),
      ) ?? [];
    if (
      displacements.some(
        (d) =>
          !d.valid ||
          d.maxConsecutiveRemoved > 1 ||
          d.rawVertexToPredecessorChordMaxTicks > 524288 + 1e-6,
      )
    )
      failures.push('simplification-displacement-contract');
    const roleDiagnostics = fixedRoleDiagnostics(result, samples, report, loaded, geometry);
    const ringData = result.extraction
      ? {
          raw: result.extraction.rings,
          simplified: result.simplified.map((s) => s.ring),
          correspondence: result.correspondence,
          ownerProvenance: provenance,
        }
      : null;
    return {
      rings: { policy: name, rings: ringData },
      summary: {
        policy: name,
        attempted: true,
        versions: loaded.policy.POLICY_VERSIONS[name],
        extractionStatus: result.status,
        proposalEligible: false,
        failures: [...new Set(failures)],
        preflight: result.preflight,
        rawSegmentCount: result.extraction?.segmentCount ?? null,
        rawRingCount: result.extraction?.rings.length ?? null,
        rawVertexCount: result.extraction?.rings.reduce((n, r) => n + r.points.length, 0) ?? null,
        simplifiedVertexCount:
          result.simplified?.reduce((n, s) => n + s.ring.points.length, 0) ?? null,
        componentCount: result.correspondence?.components.length ?? null,
        ringDataSha256: hash(JSON.stringify(ringData)),
        ownerProvenance: provenance,
        displacements,
        roleDiagnostics,
        errorLedger: errorLedger(report, profile, name),
      },
    };
  });
  const policies = outcomes.map(
    (o) =>
      o.value?.summary ?? {
        policy: o.policy,
        attempted: o.attempted,
        proposalEligible: false,
        extractionStatus: 'policy-exception',
        failures: ['policy-exception'],
        error: o.error,
      },
  );
  const rawPolicies = outcomes.map((o) => o.value?.rings ?? { policy: o.policy, rings: null });
  return {
    samples,
    summary: {
      input: report.input,
      checkpointRowId: report.input.id,
      ...samples.summary,
      classification: classificationError
        ? { status: 'failed', error: classificationError }
        : {
            status: 'completed',
            realizedWaterCoveragePercent: classification.realizedWaterCoveragePercent,
            absoluteWaterCoverageErrorBasisPoints:
              classification.absoluteWaterCoverageErrorBasisPoints,
            totalCoveragePass: classification.absoluteWaterCoverageErrorBasisPoints <= 25,
          },
      policies,
    },
    rings: rawPolicies,
  };
}
