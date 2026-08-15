import type {
  AcceptedAspectRecord,
  AspectDependencyReference,
  AspectName,
  AspectReference,
  GenerationStatus,
} from './generated-aspects.js';
import type { MapEntitySeedInput } from './seed-input.js';

declare const accepted: AcceptedAspectRecord<
  { readonly markerCount: number },
  { readonly markers: readonly { readonly x: number }[] },
  MapEntitySeedInput
>;
declare const reference: AspectReference;
declare const dependency: AspectDependencyReference;

const acceptedStatus: GenerationStatus = accepted.generationStatus;
const proposedStatus: GenerationStatus = 'proposed';

// @ts-expect-error Raw labels cannot bypass aspect-name parsing.
const unparsedAspectName: AspectName = 'proof.markers';
// @ts-expect-error Accepted record metadata cannot be replaced by a generator.
accepted.variantRevision = 1;
// @ts-expect-error Accepted parameters are deeply readonly.
accepted.parameters.markerCount = 4;
// @ts-expect-error Accepted child output collections are deeply readonly.
accepted.acceptedOutput.markers[0] = { x: 4 };
// @ts-expect-error Seed metadata is deeply readonly.
accepted.seedMetadata.worldSeed = 1n;
// @ts-expect-error Opaque references contain an aspect ID, not a descriptive aspect name.
reference.aspectName = unparsedAspectName;
// @ts-expect-error Dependency identity cannot be replaced by a descriptive label.
dependency.aspectId = unparsedAspectName;
// @ts-expect-error Cross-map provenance is immutable accepted metadata.
dependency.contextProvenance = undefined;

void [acceptedStatus, proposedStatus, reference, dependency, unparsedAspectName];
