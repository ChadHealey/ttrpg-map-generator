import type { AcceptedAspectRecord, WorldDocument } from '@ttrpg-map/core';

import type {
  AtlasLandWaterGenerationRuntime,
  AtlasLandWaterPreview,
  AtlasMacroElevationParameters,
} from './atlas-land-water-generator-contract.js';

declare const preview: AtlasLandWaterPreview;
declare const macroParameters: AtlasMacroElevationParameters;
declare const runtime: AtlasLandWaterGenerationRuntime;

declare function acceptAspect(value: AcceptedAspectRecord): void;
declare function acceptDocument(value: WorldDocument): void;

// @ts-expect-error Disposable preview is not an accepted aspect record.
acceptAspect(preview);
// @ts-expect-error Preview cannot carry accepted aspect identity.
void preview.aspectId;
// @ts-expect-error Preview cannot carry accepted revision metadata.
void preview.variantRevision;
// @ts-expect-error Classification-only controls cannot enter macro parameters.
void macroParameters.targetWaterCoveragePercent;
// @ts-expect-error Runtime observation exposes no WorldDocument mutation capability.
acceptDocument(runtime);
