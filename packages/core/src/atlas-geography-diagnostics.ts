/** Stable accepted-geography diagnostic vocabulary shared by core validators. */

export const ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES = {
  ambiguousClassification: 'atlas-geography.classification.ambiguous',
  brokenConnectivity: 'atlas-geography.connectivity.broken',
  brokenContainment: 'atlas-geography.containment.broken',
  disconnectedComponent: 'atlas-geography.component.disconnected',
  identityCollision: 'atlas-geography.identity.collision',
  impossibleControls: 'atlas-geography.controls.impossible',
  invalidClassification: 'atlas-geography.classification.invalid',
  invalidClassificationVersion: 'atlas-geography.classification.version.invalid',
  invalidCoastlineReference: 'atlas-geography.coastline.reference.invalid',
  invalidCoastlineVersion: 'atlas-geography.coastline.version.invalid',
  invalidControls: 'atlas-geography.controls.invalid',
  invalidFieldMetadata: 'atlas-geography.field.metadata.invalid',
  invalidFieldVersionPair: 'atlas-geography.field.version-pair.invalid',
  invalidFieldValue: 'atlas-geography.field.value.invalid',
  invalidOrdering: 'atlas-geography.ordering.invalid',
  invalidRelationship: 'atlas-geography.relationship.invalid',
  overlappingOwnership: 'atlas-geography.ownership.overlap',
  policyMisclassification: 'atlas-geography.policy.misclassified',
  unownedSample: 'atlas-geography.ownership.missing',
} as const;

export type AtlasGeographyDiagnosticCode =
  (typeof ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES)[keyof typeof ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES];

export interface AtlasGeographyDiagnostic {
  readonly code: AtlasGeographyDiagnosticCode;
  readonly message: string;
}
