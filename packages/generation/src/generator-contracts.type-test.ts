import {
  type AspectId,
  type AspectName,
  type EntityId,
  type GenerationDiagnosticCode,
  type GeneratorId,
  type MapEntitySeedInput,
  type MapId,
  type ParameterSchemaVersion,
  type VariantRevision,
} from '@ttrpg-map/core';

import type {
  GenerationContext,
  GenerationInput,
  GenerationPlan,
  GenerationProposal,
  GeneratorManifest,
} from './generator-contracts.js';

declare const aspectId: AspectId;
declare const aspectName: AspectName;
declare const diagnosticCode: GenerationDiagnosticCode;
declare const entityId: EntityId;
declare const generatorId: GeneratorId;
declare const mapId: MapId;
declare const parameterSchemaVersion: ParameterSchemaVersion;
declare const variantRevision: VariantRevision;

declare const manifest: GeneratorManifest;
declare const context: GenerationContext<
  { readonly points: readonly number[] },
  MapEntitySeedInput
>;
declare const input: GenerationInput<{ readonly points: readonly number[] }>;
declare const plan: GenerationPlan;
declare const proposal: GenerationProposal<
  { readonly markerCount: number },
  { readonly markers: readonly { readonly x: number }[] },
  MapEntitySeedInput
>;

// @ts-expect-error Generator manifests are readonly declarations.
manifest.seedScope = 'root-coordinate';
// @ts-expect-error Generation input collections cannot be replaced.
context.inputs = [];
// @ts-expect-error Accepted dependency output is deeply readonly.
input.acceptedOutput.points[0] = 4;
// @ts-expect-error Explicit seed metadata is deeply readonly.
context.seedMetadata.seedDerivationVersion = 2;
// @ts-expect-error Plans cannot redirect their target after planning.
plan.target.aspect = { aspectId };
// @ts-expect-error Proposal parameters are deeply readonly.
proposal.parameters.markerCount = 4;
// @ts-expect-error Proposed child output collections are deeply readonly.
proposal.output.markers[0] = { x: 4 };

void [
  aspectName,
  diagnosticCode,
  entityId,
  generatorId,
  mapId,
  parameterSchemaVersion,
  variantRevision,
];
