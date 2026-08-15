import type {
  AcceptedAspectRecord,
  AspectName,
  AspectReference,
  GenerationStatus,
} from './generated-aspects.js';

declare const accepted: AcceptedAspectRecord<
  { readonly markerCount: number },
  { readonly markers: readonly { readonly x: number }[] },
  { readonly worldSeed: string }
>;
declare const reference: AspectReference;

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
accepted.seedMetadata.worldSeed = 'changed';
// @ts-expect-error Opaque references contain an aspect ID, not a descriptive aspect name.
reference.aspectName = unparsedAspectName;

void [acceptedStatus, proposedStatus, reference, unparsedAspectName];
