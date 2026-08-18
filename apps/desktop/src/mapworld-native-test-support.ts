import {
  createMapworldSavePlan,
  decodeMapworld,
  type MapworldSavePlan,
} from '@ttrpg-map/persistence';

import fixtureManifest from '../../../fixtures/saved-projects/v1/milestone-1-kernel-proof/rerolled.mapworld/manifest.json?raw';
import fixtureMap from '../../../fixtures/saved-projects/v1/milestone-1-kernel-proof/rerolled.mapworld/maps/a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7.json?raw';
import fixtureWorld from '../../../fixtures/saved-projects/v1/milestone-1-kernel-proof/rerolled.mapworld/world.json?raw';

const TARGET_NAME = 'World.mapworld';
const TARGET_PATH = `/maps/${TARGET_NAME}`;
const PREVIOUS_FINGERPRINT = '1'.repeat(64);
const PREVIOUS_OBSERVATION = '3'.repeat(64);
const ENCODER = new TextEncoder();

/** Return mutable source arrays so boundary tests can prove the production adapter takes ownership. */
export function validNativeSaveRequest(
  operation: 'first-save' | 'replacement-save' = 'first-save',
) {
  const plan = value(
    createMapworldSavePlan(
      value(
        decodeMapworld({
          files: [
            { path: 'manifest.json', bytes: ENCODER.encode(fixtureManifest) },
            { path: 'world.json', bytes: ENCODER.encode(fixtureWorld) },
            {
              path: 'maps/a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7.json',
              bytes: ENCODER.encode(fixtureMap),
            },
          ],
        }),
      ),
      operation === 'first-save'
        ? { operation, targetName: TARGET_NAME, previousManifestSha256: null }
        : {
            operation,
            targetName: TARGET_NAME,
            previousManifestSha256: PREVIOUS_FINGERPRINT,
          },
    ),
  );
  return requestFromPlan(plan, operation);
}

function requestFromPlan(plan: MapworldSavePlan, operation: 'first-save' | 'replacement-save') {
  return {
    targetPath: TARGET_PATH,
    operation,
    expectedPreviousManifestSha256: plan.expectedPreviousManifestSha256,
    expectedPreviousObservationToken:
      operation === 'replacement-save' ? PREVIOUS_OBSERVATION : null,
    candidateManifestSha256: plan.candidateManifestSha256,
    markerBase64: plan.markerBase64,
    files: plan.files.map(({ bytesBase64, path }) => ({ bytesBase64, path })),
  };
}

function value<Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false },
): Value {
  if (!result.ok) throw new Error(`Expected success: ${JSON.stringify(result)}`);
  return result.value;
}
