/** Generation metadata projected from the core-owned accepted semantic policy. */

import {
  ATLAS_SEMANTIC_POLICY,
  ATLAS_SEMANTIC_POLICY_VERSION,
  type AtlasSemanticPolicy,
} from '@ttrpg-map/core';

export { ATLAS_SEMANTIC_POLICY, ATLAS_SEMANTIC_POLICY_VERSION, type AtlasSemanticPolicy };

export const ATLAS_SEMANTIC_GENERATOR_MANIFEST_VERSION = 1 as const;
export const ATLAS_SEMANTIC_PARAMETER_SCHEMA_VERSION = 1 as const;

export interface AtlasSemanticClassificationParameters {
  readonly parameterSchemaVersion: typeof ATLAS_SEMANTIC_PARAMETER_SCHEMA_VERSION;
  readonly policyVersion: typeof ATLAS_SEMANTIC_POLICY_VERSION;
  readonly continentMinimumLandAreaBasisPoints: 2_000;
  readonly majorIslandMinimumLandAreaBasisPoints: 200;
  readonly minimumRetainedIslandSampleCount: 1;
  readonly openMarineClearanceCells: 16;
  readonly minimumRetainedSeaSampleCount: 1;
  readonly connectedMajorityMinimumPercent: 90;
  readonly archipelagoMaximumCentroidSeparationMilliRad: 750;
  readonly islandChainMaximumNeighborSeparationMilliRad: 1_800;
  readonly identityDerivationVersion: 1;
}

/** Canonical persisted parameters are derived from the same policy accepted validation executes. */
export const ATLAS_SEMANTIC_CLASSIFICATION_PARAMETERS: AtlasSemanticClassificationParameters =
  Object.freeze({
    parameterSchemaVersion: ATLAS_SEMANTIC_PARAMETER_SCHEMA_VERSION,
    policyVersion: ATLAS_SEMANTIC_POLICY_VERSION,
    continentMinimumLandAreaBasisPoints: ATLAS_SEMANTIC_POLICY.continentMinimumLandAreaBasisPoints,
    majorIslandMinimumLandAreaBasisPoints:
      ATLAS_SEMANTIC_POLICY.majorIslandMinimumLandAreaBasisPoints,
    minimumRetainedIslandSampleCount: ATLAS_SEMANTIC_POLICY.minimumRetainedIslandSampleCount,
    openMarineClearanceCells: ATLAS_SEMANTIC_POLICY.openMarineClearanceCells,
    minimumRetainedSeaSampleCount: ATLAS_SEMANTIC_POLICY.minimumRetainedSeaSampleCount,
    connectedMajorityMinimumPercent: ATLAS_SEMANTIC_POLICY.connectedMajorityMinimumPercent,
    archipelagoMaximumCentroidSeparationMilliRad:
      ATLAS_SEMANTIC_POLICY.archipelagoMaximumCentroidSeparationMilliRad,
    islandChainMaximumNeighborSeparationMilliRad:
      ATLAS_SEMANTIC_POLICY.islandChainMaximumNeighborSeparationMilliRad,
    identityDerivationVersion: ATLAS_SEMANTIC_POLICY.identityDerivationVersion,
  });
