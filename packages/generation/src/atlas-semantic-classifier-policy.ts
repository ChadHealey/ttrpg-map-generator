/** Explicit compatibility policy for Milestone 2 landmass, island-group, and water semantics. */

import {
  ATLAS_CONNECTED_MAJORITY_MINIMUM_PERCENT,
  ATLAS_SEMANTIC_AREA_WEIGHT_SCALE,
} from '@ttrpg-map/core';

export const ATLAS_SEMANTIC_GENERATOR_MANIFEST_VERSION = 1 as const;
export const ATLAS_SEMANTIC_PARAMETER_SCHEMA_VERSION = 1 as const;
export const ATLAS_SEMANTIC_POLICY_VERSION = 1 as const;

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

/** Canonical persisted version-1 policy parameters; executable helpers derive from this object. */
export const ATLAS_SEMANTIC_CLASSIFICATION_PARAMETERS: AtlasSemanticClassificationParameters =
  Object.freeze({
    parameterSchemaVersion: ATLAS_SEMANTIC_PARAMETER_SCHEMA_VERSION,
    policyVersion: ATLAS_SEMANTIC_POLICY_VERSION,
    continentMinimumLandAreaBasisPoints: 2_000,
    majorIslandMinimumLandAreaBasisPoints: 200,
    minimumRetainedIslandSampleCount: 1,
    openMarineClearanceCells: 16,
    minimumRetainedSeaSampleCount: 1,
    connectedMajorityMinimumPercent: ATLAS_CONNECTED_MAJORITY_MINIMUM_PERCENT,
    archipelagoMaximumCentroidSeparationMilliRad: 750,
    islandChainMaximumNeighborSeparationMilliRad: 1_800,
    identityDerivationVersion: 1,
  });

export const ATLAS_SEMANTIC_POLICY = Object.freeze({
  policyVersion: ATLAS_SEMANTIC_POLICY_VERSION,
  /** Integer cosine row weights use 2^20 units, matching #58 realization measurement. */
  sphericalAreaWeightScale: ATLAS_SEMANTIC_AREA_WEIGHT_SCALE,
  /** A land component owning at least 20% of retained land is a continent. */
  continentMinimumLandAreaPercent:
    ATLAS_SEMANTIC_CLASSIFICATION_PARAMETERS.continentMinimumLandAreaBasisPoints / 100,
  /** A non-continent owning at least 2% of retained land is a major island. */
  majorIslandMinimumLandAreaPercent:
    ATLAS_SEMANTIC_CLASSIFICATION_PARAMETERS.majorIslandMinimumLandAreaBasisPoints / 100,
  /** All smaller accepted land components remain explicit islands; #59 never edits #58's mask. */
  minimumRetainedIslandSampleCount:
    ATLAS_SEMANTIC_CLASSIFICATION_PARAMETERS.minimumRetainedIslandSampleCount,
  /** Water farther than 16 graph edges from land forms an open-marine clearance core. */
  openMarineClearanceCells: ATLAS_SEMANTIC_CLASSIFICATION_PARAMETERS.openMarineClearanceCells,
  /** Every accepted water component remains owned; lake suppression belongs upstream of #59. */
  minimumRetainedSeaSampleCount:
    ATLAS_SEMANTIC_CLASSIFICATION_PARAMETERS.minimumRetainedSeaSampleCount,
  connectedMajorityMinimumPercent:
    ATLAS_SEMANTIC_CLASSIFICATION_PARAMETERS.connectedMajorityMinimumPercent,
  /** Candidate group membership is bounded by the accepted archipelago-abundance percentage. */
  islandGroupBudgetRounding: 'floor' as const,
  /** Compact member pairs at or below 0.75 rad seed archipelagos. */
  archipelagoMaximumCentroidSeparationRad:
    ATLAS_SEMANTIC_CLASSIFICATION_PARAMETERS.archipelagoMaximumCentroidSeparationMilliRad / 1_000,
  /** Chain members may span at most 1.8 rad between consecutive ordered centroids. */
  islandChainMaximumNeighborSeparationRad:
    ATLAS_SEMANTIC_CLASSIFICATION_PARAMETERS.islandChainMaximumNeighborSeparationMilliRad / 1_000,
  /** A four-member budget may realize one compact group and one ordered chain. */
  minimumBudgetForBothIslandGroupKinds: 4,
  componentFingerprintVersion: 1,
  identityDerivationVersion: 1,
});

export type AtlasSemanticPolicy = typeof ATLAS_SEMANTIC_POLICY;
