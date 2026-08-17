import { describe, expect, it } from 'vitest';

import {
  ATLAS_DOCUMENT_COMMAND_KIND,
  ATLAS_DOCUMENT_OPERATION_MODES,
  ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES,
  type CommitAtlasProposalCommand,
} from './atlas-document-transaction-model.js';
import { commitAtlasProposal } from './atlas-document-transactions.js';
import { deriveAtlasWorldRadius } from './atlas-geography-aspects.js';
import { DEFAULT_ATLAS_CONTROLS } from './atlas-geography-model.js';
import { parseStableId } from './identity.js';
import { parseWorldSeed } from './seed-input.js';
import type { WorldDocument } from './world-document.js';

const WORLD_DOCUMENT_ID = value(
  parseStableId('world-document', '78b2157c-4f2c-5ac7-986b-76dc808f377e'),
);
const WORLD_MAP_ID = value(parseStableId('map', 'a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7'));
const ROOT_SURFACE_ID = value(
  parseStableId('root-surface', '9f077a68-4794-5a0f-9ce7-a9d9230451a4'),
);
const WORLD_SEED = value(parseWorldSeed('81985529216486895'));
const RADIUS = value(deriveAtlasWorldRadius(DEFAULT_ATLAS_CONTROLS.worldCircumferenceKm));

describe('complete atlas document transactions', () => {
  it('returns the exact accepted document when complete proposal validation fails', () => {
    const document = shellDocument();
    const result = commitAtlasProposal(document, emptyCommand());

    expect(result.ok).toBe(false);
    expect(result.document).toBe(document);
    if (result.ok) throw new Error('Invalid complete proposal unexpectedly committed.');
    expect(result.diagnostics.map(({ code }) => code)).toContain(
      ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.invalidProposal,
    );
    expect(document.maps[0]?.aspects).toStrictEqual([]);
  });

  it('rejects a stale source snapshot before considering proposed replacement bytes', () => {
    const document = shellDocument();
    const command: CommitAtlasProposalCommand = {
      ...emptyCommand(),
      expectedWorldSeed: value(parseWorldSeed('1')),
    };
    const result = commitAtlasProposal(document, command);

    expect(result.ok).toBe(false);
    expect(result.document).toBe(document);
    if (result.ok) throw new Error('Stale complete proposal unexpectedly committed.');
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(
      ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.staleInput,
    );
  });
});

function emptyCommand(): CommitAtlasProposalCommand {
  return {
    kind: ATLAS_DOCUMENT_COMMAND_KIND,
    operationMode: ATLAS_DOCUMENT_OPERATION_MODES.initial,
    targetMapId: WORLD_MAP_ID,
    expectedWorldSeed: WORLD_SEED,
    expectedAspectRevisions: [],
    controls: DEFAULT_ATLAS_CONTROLS,
    proposedCoordinateSystem: {
      kind: 'planet-sphere',
      rootSurfaceId: ROOT_SURFACE_ID,
      radius: RADIUS,
    },
    proposedEntities: [],
    proposedAspects: [],
    explicitlyIncrementedAspectIds: [],
  };
}

function shellDocument(): WorldDocument {
  return Object.freeze({
    worldDocumentId: WORLD_DOCUMENT_ID,
    displayName: 'Atlas shell',
    worldSeed: WORLD_SEED,
    rootMapId: WORLD_MAP_ID,
    maps: Object.freeze([
      Object.freeze({
        mapId: WORLD_MAP_ID,
        mapKind: 'world',
        scaleClass: 'world',
        displayName: 'Whole world',
        coordinateSystem: Object.freeze({
          kind: 'planet-sphere',
          rootSurfaceId: ROOT_SURFACE_ID,
          radius: RADIUS,
        }),
        extent: Object.freeze({ kind: 'whole-surface' }),
        entities: Object.freeze([]),
        aspects: Object.freeze([]),
        constraints: Object.freeze([]),
        locks: Object.freeze([]),
        decoration: Object.freeze({ aspectReferences: Object.freeze([]) }),
        layout: Object.freeze({ aspectReferences: Object.freeze([]) }),
      }),
    ]),
  });
}

function value<Value>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly diagnostic?: { readonly message: string } },
): Value {
  if (!result.ok) throw new Error(result.diagnostic?.message ?? 'Expected a valid test value.');
  return result.value;
}
