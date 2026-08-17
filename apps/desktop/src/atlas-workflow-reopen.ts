/** Generator-free accepted-atlas reconstruction after canonical package validation. */

import { RESTRAINED_INK_ATLAS_STYLE } from '@ttrpg-map/assets';
import {
  type AtlasAppearanceRecords,
  type AtlasGeographyRecords,
  reconstructAcceptedAtlas,
  type WorldDocument,
} from '@ttrpg-map/core';
import { type AtlasRenderScene, composeAtlasRenderScene } from '@ttrpg-map/render';

export interface ReopenedAcceptedAtlas {
  readonly document: WorldDocument;
  readonly geography: AtlasGeographyRecords;
  readonly appearance: AtlasAppearanceRecords;
  readonly scene: AtlasRenderScene;
}

export type ReopenAcceptedAtlasResult =
  | { readonly ok: true; readonly accepted: ReopenedAcceptedAtlas }
  | {
      readonly ok: false;
      readonly diagnosticCodes: readonly string[];
      readonly message: string;
    };

/** Rebuild only disposable scene state from already validated accepted records. */
export function reopenAcceptedAtlas(document: WorldDocument): ReopenAcceptedAtlasResult {
  const reconstructed = reconstructAcceptedAtlas(document);
  if (reconstructed.status !== 'accepted') {
    const diagnostics = reconstructed.status === 'invalid' ? reconstructed.diagnostics : [];
    return Object.freeze({
      ok: false,
      diagnosticCodes: Object.freeze(
        diagnostics.length === 0
          ? ['atlas-reopen.accepted-atlas-required']
          : diagnostics.map(({ code }) => code),
      ),
      message:
        diagnostics[0]?.message ??
        'The reopened world document does not contain a complete accepted Milestone 2 atlas.',
    });
  }
  const scene = composeAtlasRenderScene(
    reconstructed.value.geography,
    reconstructed.value.appearance,
    RESTRAINED_INK_ATLAS_STYLE,
  );
  if (!scene.ok) {
    return Object.freeze({
      ok: false,
      diagnosticCodes: Object.freeze(scene.diagnostics.map(({ code }) => code)),
      message: scene.diagnostics[0]?.message ?? 'Disposable atlas scene reconstruction failed.',
    });
  }
  return Object.freeze({
    ok: true,
    accepted: Object.freeze({
      document,
      geography: reconstructed.value.geography,
      appearance: reconstructed.value.appearance,
      scene: scene.value,
    }),
  });
}
