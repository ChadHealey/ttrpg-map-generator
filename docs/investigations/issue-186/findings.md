# Issue 186 findings

**D1 stops with explicit insufficiency; neither Z nor H is selected.** Both policies preserve the shared quantized land classification on this checkpoint. They do not preserve its complete paid-component structure at preview, and the original role certificates have not been transferred to the extracted and simplified boundaries.

## Fixed execution and successful checks

The [frozen policy](policy.md) evaluated six retained issue184 comparison-r1 fields at the actual preview and full profiles: 12 sampled profiles and 24 policy attempts. Preview has 130,562 unique anchors and full has 2,095,106. The pass evaluates 13,354,008 scalar anchors; the single computational replay repeats that exact work and matches all retained artifacts. No constructor, threshold search, extra policy, extra lattice fixture or diagnostic image was added.

All 12 public total-coverage gates pass the 25 basis-point limit. The largest error is 2.1598 bp (normal-02 preview); the largest preview per-owner error is approximately 0.012123047 percentage points. All six pairs have exactly matching normalized values and quantized ticks at their 130,562 shared anchors. No checkpoint sample saturates the declared clamp and no sampling, classification or policy exception occurs. The outside-range synthetic still exercises the normalization contract.

Z extracts 11 profiles and H extracts all 12. Every actual extraction passes the public raw/simplified topology checks, exact transition coverage, component/predecessor association and guarded simplification checks. These results do not imply preservation of the original components.

## Component outcomes

The following counts use H. Z has the same sampled-component and ring counts on the 11 admitted profiles; its balanced full case is rejected before extraction. Original components count each paid body and detached island. A sampled group may have multiple rings, so ring count is not a component count. “Merged sampled groups” counts distinct raw source-anchor component keys whose boundary provenance includes more than one original component.

| Row / profile                                                               | Water error (bp) | Original components | Sampled components | Raw rings | Merged sampled groups |
| --------------------------------------------------------------------------- | ---------------: | ------------------: | -----------------: | --------: | --------------------: |
| [normal-01 / preview](evidence-r1/normal-01-preview.json)                   |           1.1259 |                  20 |                 19 |        20 |                     1 |
| [normal-01 / full](evidence-r1/normal-01-full.json)                         |            0.049 |                  20 |                 20 |        20 |                     0 |
| [normal-02 / preview](evidence-r1/normal-02-preview.json)                   |           2.1598 |                  20 |                 19 |        19 |                     1 |
| [normal-02 / full](evidence-r1/normal-02-full.json)                         |           0.0252 |                  20 |                 20 |        20 |                     0 |
| [normal-03 / preview](evidence-r1/normal-03-preview.json)                   |           0.2337 |                  20 |                 19 |        21 |                     1 |
| [normal-03 / full](evidence-r1/normal-03-full.json)                         |           0.0337 |                  20 |                 20 |        20 |                     0 |
| [normal-04 / preview](evidence-r1/normal-04-preview.json)                   |           1.0377 |                  20 |                 19 |        20 |                     1 |
| [normal-04 / full](evidence-r1/normal-04-full.json)                         |           0.0135 |                  20 |                 19 |        19 |                     1 |
| [connected-majority / preview](evidence-r1/connected-majority-preview.json) |            0.303 |                  48 |                 42 |        42 |                     5 |
| [connected-majority / full](evidence-r1/connected-majority-full.json)       |           0.1787 |                  48 |                 48 |        48 |                     0 |
| [fragmented-islands / preview](evidence-r1/fragmented-islands-preview.json) |           0.1279 |                  60 |                 43 |        43 |                    10 |
| [fragmented-islands / full](evidence-r1/fragmented-islands-full.json)       |           0.0536 |                  60 |                 54 |        57 |                     6 |

All these mergers occur in the sampled land graph under the declared edge/diagonal decisions, before simplification. They do not show that the original polygons overlap, invalidate their whole-owner/collar certificates, or merge separate owner guards. The observed groups remain within their original owners. Simplification retains the same external component association rather than renaming the result.

In [fragmented preview](evidence-r1/fragmented-islands-preview.json), `owner-3/archipelago-5`, `owner-3/archipelago-6` and `owner-4/archipelago-6` have zero land anchors. The other 57 original components supply anchors but produce only 43 sampled land components. This is a concrete sampling-survival failure for these paid pieces.

### Exact affected IDs and raw ring indices

The following IDs and zero-based ring indices come from each linked receipt's H `ownerProvenance`. The admitted Z cases have the same groups. Multiple ring indices on one line belong to the same sampled component; none is counted as a second merger.

### normal-01 / preview

- `owner-0/island-0` + `owner-0/island-1`; raw ring indices 15, 16.

### normal-02 / preview

- `owner-0/island-0` + `owner-0/island-1`; raw ring indices 12.

### normal-03 / preview

- `owner-1/body` + `owner-1/island-0`; raw ring indices 15, 18, 19.

### normal-04 / preview

- `owner-0/body` + `owner-0/island-0`; raw ring indices 0, 2.

### normal-04 / full

- `owner-0/body` + `owner-0/island-0`; raw ring indices 0.

### connected-majority / preview

- `owner-0/island-0` + `owner-0/island-1`; raw ring indices 1.
- `owner-3/body` + `owner-3/island-0`; raw ring indices 18.
- `owner-5/island-1` + `owner-5/island-2` + `owner-5/archipelago-0`; raw ring indices 20.
- `owner-0/island-2` + `owner-0/archipelago-3`; raw ring indices 36.
- `owner-2/island-1` + `owner-2/island-2`; raw ring indices 39.

### fragmented-islands / preview

- `owner-0/island-2` + `owner-0/archipelago-5`; raw ring indices 20.
- `owner-0/island-0` + `owner-0/archipelago-4`; raw ring indices 22.
- `owner-3/archipelago-0` + `owner-3/archipelago-2`; raw ring indices 24.
- `owner-3/island-1` + `owner-3/island-2`; raw ring indices 26.
- `owner-3/archipelago-3` + `owner-3/archipelago-4`; raw ring indices 29.
- `owner-2/archipelago-1` + `owner-2/archipelago-4`; raw ring indices 31.
- `owner-1/island-0` + `owner-1/archipelago-3` + `owner-1/archipelago-5`; raw ring indices 34.
- `owner-2/island-1` + `owner-2/island-2` + `owner-2/archipelago-6`; raw ring indices 35.
- `owner-2/island-0` + `owner-2/archipelago-3` + `owner-2/archipelago-5`; raw ring indices 37.
- `owner-1/archipelago-0` + `owner-1/archipelago-1` + `owner-1/archipelago-4`; raw ring indices 38.

### fragmented-islands / full

- `owner-0/island-2` + `owner-0/archipelago-5`; raw ring indices 21, 22.
- `owner-0/island-0` + `owner-0/archipelago-4`; raw ring indices 24, 25.
- `owner-3/archipelago-0` + `owner-3/archipelago-2`; raw ring indices 27, 28.
- `owner-3/island-0` + `owner-3/archipelago-5`; raw ring indices 29.
- `owner-3/island-1` + `owner-3/island-2`; raw ring indices 30.
- `owner-1/island-0` + `owner-1/archipelago-5`; raw ring indices 41.

## Zero degeneracy and genuine-zero scope

[Connected-majority full](evidence-r1/connected-majority-full.json) contains two quantized zero anchors; the first canonical index is 687854. Z rejects the entire profile as predeclared, with no saddle tie, zero cast, skipped anchor or H fallback. H completes using the released positive half-quantum contour. This is a failure of Z's explicitly restricted regular domain on one actual row, not proof that every genuine-zero topology design is impossible. A general zero treatment would require a separately reviewed contract.

## Displacement and role limits

The strongest tractable [source-level error ledger](error-budget.md) gives an ideal coordinate-affine raw-to-original bound of about 0.024543727 radians at preview and 0.006135958 at full. Adding the generic guarded-simplification allowance gives about 0.025628415 and 0.007220646 respectively. Preview exceeds D=0.01; full's one-sided proximity bound fits D but supplies neither original-to-output survival nor complete role correspondence. The shortest-geodesic interpretation has its own larger bound. Neither interpretation gains an interval certificate for binary64 evaluation.

Even assuming the missing two-way correspondence, normal-01's narrowest peninsula upper-width headroom (0.008240834) is below the full bound's two-chain allowance (about 0.014441295). Balanced and fragmented minimum disk headrooms (0.001417983 and 0.005249065) are below the generic full displacement. These are failures of this conservative transfer route, not measured violations of extracted peninsula widths or disks.

Measured raw-vertex displacement to its actual simplified predecessor chord is smaller: the largest coordinate-affine angular upper estimate across all extracted rings is 0.001080586486176868 radians. All fixed interior/collar witnesses remain classified as land and bay witnesses as water in the raw and simplified vertex-mapped chart-chord diagnostic, with no multiple/missing original role membership among measured source anchors. Those finite observations do not reconstruct internal cuts, certify their areas/widths/extents or replace the missing theorem. The diagnostic explicitly excludes internal collar cuts from exposed coast measurements.

## Disposition and next contract

The finite experiment establishes actual sampled mergers and missing paid components as well as a concrete limitation of the proposed error-transfer route. A successor must first define and prove the required sampling survival/separation and two-way original-role to extracted-boundary correspondence, including poles, segment interpretation and numerical residuals. The retained failures provide fixed counterexamples for that design. It must not silently redraw roots, discard islands, substitute semantic IDs, raise profile budgets or weaken adopted targets.

The proposed normalization, generator/field, fixed-policy realization and Z geometry version implications remain unaccepted alternatives in the policy. No persistence migration, compatibility dispatch, production classifier change, semantic basin policy or selected v3 family was implemented. The sampled component keys are transient provenance, not semantic EntityIds.
