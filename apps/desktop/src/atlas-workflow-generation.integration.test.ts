import { RESTRAINED_INK_ATLAS_STYLE } from '@ttrpg-map/assets';
import {
  ACCEPTED_ATLAS_DIAGNOSTIC_CODES,
  ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES,
  type AtlasControls,
  DEFAULT_ATLAS_CONTROLS,
  parseGenerationDiagnosticCode,
  reconstructAcceptedAtlas,
  type WorldDocument,
} from '@ttrpg-map/core';
import {
  canonicalAspectBytes,
  createMapworldSavePlan,
  decodeMapworld,
  encodeMapworld,
  MAPWORLD_NATIVE_LIMITS,
  type MapworldPackage,
} from '@ttrpg-map/persistence';
import {
  ATLAS_PNG_MAXIMUM_BYTES,
  ATLAS_SVG_MAXIMUM_BYTES,
  exportAtlasSceneToPngAsync,
  exportAtlasSceneToSvg,
} from '@ttrpg-map/render';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  aspectBytes,
  equalBytes,
  equalPackages,
  mutateAspect,
  required,
  reverseOrderInsensitiveAtlasOutput,
  reverseOrderInsensitiveCollections,
} from './atlas-persistence-integration-support.js';
import type { AcceptedAtlasState } from './atlas-workflow-generation.js';
import {
  acceptedAspectRevision,
  addSeamJump,
  addUnknownDecorationKind,
  attemptAtlasGeneration,
  commitGeneratedAtlas,
  invalidStyleId,
  protectPaperTreatment,
  recommitAppearance,
  unsupportedStyleVersion,
  withAcceptedDiagnostic,
} from './atlas-workflow-generation-integration-test-support.js';
import { reopenAcceptedAtlas } from './atlas-workflow-reopen.js';

const PNG_INTEGRATION_DIMENSIONS = Object.freeze({ widthPx: 1_600, heightPx: 800 });

interface GeneratedAtlasStates {
  readonly baseline: AcceptedAtlasState;
  readonly controlled: AcceptedAtlasState;
  readonly geography: AcceptedAtlasState;
  readonly appearance: AcceptedAtlasState;
  readonly changedControls: AtlasControls;
  readonly appearanceProgress: readonly string[];
}

let generatedStates: GeneratedAtlasStates | undefined;

describe('complete Milestone 2 atlas proposal transaction', () => {
  beforeAll(async () => {
    const baseline = await commitGeneratedAtlas('initial-atlas');
    const changedControls = Object.freeze({
      ...DEFAULT_ATLAS_CONTROLS,
      targetWaterCoveragePercent: 66,
    });
    const controlled = await commitGeneratedAtlas(
      'control-driven-replacement',
      baseline,
      changedControls,
    );
    const geography = await commitGeneratedAtlas('geography-reroll', controlled, changedControls);
    const appearanceProgress: string[] = [];
    const appearance = await commitGeneratedAtlas('appearance-reroll', geography, changedControls, {
      isCancellationRequested: () => false,
      reportProgress: ({ stage }) => appearanceProgress.push(stage),
      yieldControl: () => Promise.resolve(),
    });
    generatedStates = Object.freeze({
      baseline,
      controlled,
      geography,
      appearance,
      changedControls,
      appearanceProgress: Object.freeze(appearanceProgress),
    });
  }, 180_000);

  it('accepts control replacement and proves geography/appearance reroll isolation', async () => {
    const { appearance, appearanceProgress, baseline, changedControls, controlled, geography } =
      requiredGeneratedStates();

    expect(acceptedAspectRevision(baseline, 'worldTerrain.macroElevation')).toBe(0);
    expect(acceptedAspectRevision(controlled, 'worldTerrain.macroElevation')).toBe(0);
    expect(acceptedAspectRevision(geography, 'worldTerrain.macroElevation')).toBe(1);
    expect(acceptedAspectRevision(appearance, 'worldTerrain.macroElevation')).toBe(1);
    for (const name of [
      'atlas.coastlineAppearance',
      'atlas.paperTreatment',
      'atlas.waterDecoration',
    ]) {
      expect(acceptedAspectRevision(baseline, name)).toBe(0);
      expect(acceptedAspectRevision(controlled, name)).toBe(0);
      expect(acceptedAspectRevision(geography, name)).toBe(0);
      expect(acceptedAspectRevision(appearance, name)).toBe(1);
    }
    expect(appearance.geography).toEqual(geography.geography);
    expect(geography.appearance.paperTreatment).toEqual(controlled.appearance.paperTreatment);
    expect(controlled.geography.controls.targetWaterCoveragePercent).toBe(66);
    expect(controlled.document.maps[0]?.coordinateSystem.radius).not.toBeUndefined();
    expect(appearanceProgress).toStrictEqual(['validating-proposal', 'completed']);

    const locked = protectPaperTreatment(appearance, 'lock');
    const lockedResult = await attemptAtlasGeneration('appearance-reroll', locked, changedControls);
    expect(lockedResult).toMatchObject({
      ok: false,
      diagnosticCodes: ['atlas-transaction.lock.conflict'],
    });
    expect(locked.document.maps[0]?.locks).toHaveLength(1);

    const constrained = protectPaperTreatment(appearance, 'constraint');
    const constrainedResult = await attemptAtlasGeneration(
      'appearance-reroll',
      constrained,
      changedControls,
    );
    expect(constrainedResult).toMatchObject({
      ok: false,
      diagnosticCodes: ['atlas-transaction.constraint.conflict'],
    });
    expect(constrained.document.maps[0]?.constraints).toHaveLength(1);
  }, 30_000);

  it('accepts a valid unchanged complete proposal through the exported core boundary', () => {
    const { appearance } = requiredGeneratedStates();
    expect(recommitAppearance(appearance, (proposal) => proposal).ok).toBe(true);
  }, 15_000);

  it.each([
    ['an unknown water-decoration kind', addUnknownDecorationKind],
    ['an invalid style semantic key', invalidStyleId],
    ['an unsupported style behavior version', unsupportedStyleVersion],
    ['a seam-jumping decoration segment', addSeamJump],
  ] as const)(
    'rejects %s at commitAtlasProposal',
    (_label, mutate) => {
      const { appearance } = requiredGeneratedStates();
      const result = recommitAppearance(appearance, mutate);

      expect(result.ok).toBe(false);
      expect(result.document).toBe(appearance.document);
      if (result.ok) throw new Error('Invalid runtime appearance unexpectedly committed.');
      expect(result.diagnostics.map(({ code }) => code)).toContain(
        ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.invalidProposal,
      );
    },
    15_000,
  );

  it('round-trips every accepted atlas aspect and rebuilds the scene without generation', () => {
    const accepted = requiredGeneratedStates().appearance;
    const encoded = required(encodeMapworld(accepted.document));
    expect(encoded.files.map(({ path }) => path)).toStrictEqual([
      'manifest.json',
      'world.json',
      `maps/${accepted.document.rootMapId}.json`,
    ]);
    expect(
      encoded.files.some(({ path }) => /cache|preview|scene|raster|hit-test/u.test(path)),
    ).toBe(false);
    expect(Math.max(...encoded.files.map(({ bytes }) => bytes.byteLength))).toBeLessThanOrEqual(
      MAPWORLD_NATIVE_LIMITS.maximumFileBytes,
    );
    expect(
      encoded.files.reduce((total, { bytes }) => total + bytes.byteLength, 0),
    ).toBeLessThanOrEqual(MAPWORLD_NATIVE_LIMITS.maximumPackageBytes);

    const decoded = required(decodeMapworld(encoded));
    const reopened = reopenAcceptedAtlas(decoded);
    expect(reopened.ok, reopened.ok ? undefined : JSON.stringify(reopened)).toBe(true);
    if (!reopened.ok) return;
    expect(reopened.accepted.scene).toStrictEqual(accepted.scene);
    expect(reopened.accepted.geography).toStrictEqual(accepted.geography);
    expect(reopened.accepted.appearance).toStrictEqual(accepted.appearance);
    const originalMap = accepted.document.maps[0];
    const reopenedMap = decoded.maps[0];
    if (originalMap === undefined || reopenedMap === undefined)
      throw new Error('Missing root map.');
    expect(reopenedMap.aspects).toHaveLength(originalMap.aspects.length);
    for (const aspect of originalMap.aspects) {
      const restored = reopenedMap.aspects.find(({ aspectId }) => aspectId === aspect.aspectId);
      if (restored === undefined) throw new Error(`Missing reopened aspect ${aspect.aspectId}.`);
      expect(
        equalBytes(
          aspectBytes(canonicalAspectBytes(restored)),
          aspectBytes(canonicalAspectBytes(aspect)),
        ),
      ).toBe(true);
    }
  }, 90_000);

  it('keeps semantic and canonical SVG evidence separate across both rerolls and reopen', () => {
    const { appearance, controlled, geography } = requiredGeneratedStates();
    const controlledSvg = canonicalSvg(controlled);
    const geographySvg = canonicalSvg(geography);
    const appearanceSvg = canonicalSvg(appearance);
    const repeatedAppearanceSvg = canonicalSvg(appearance);

    expect(geography.geography).not.toEqual(controlled.geography);
    expect(geographySvg).not.toEqual(controlledSvg);
    expect(appearance.geography).toEqual(geography.geography);
    expect(appearanceSvg).not.toEqual(geographySvg);
    expect(repeatedAppearanceSvg).toEqual(appearanceSvg);
    expect(appearanceSvg.byteLength).toBeLessThanOrEqual(ATLAS_SVG_MAXIMUM_BYTES);

    const reopenedDocument = required(
      decodeMapworld(required(encodeMapworld(appearance.document))),
    );
    const reopened = reopenAcceptedAtlas(reopenedDocument);
    expect(reopened.ok, reopened.ok ? undefined : JSON.stringify(reopened)).toBe(true);
    if (!reopened.ok) return;
    expect(canonicalSvg(reopened.accepted)).toEqual(appearanceSvg);
    expect(reopened.accepted.document).toBe(reopenedDocument);
  }, 90_000);

  it('keeps semantic and production PNG evidence separate across transitions and reopen', async () => {
    const { appearance, baseline, controlled, geography } = requiredGeneratedStates();
    const acceptedReferences = Object.freeze({
      document: appearance.document,
      geography: appearance.geography,
      coastline: appearance.geography.coastline,
      appearance: appearance.appearance,
      scene: appearance.scene,
      nodes: appearance.scene.nodes,
    });

    const baselinePng = await canonicalPng(baseline);
    const controlledPng = await canonicalPng(controlled);
    const geographyPng = await canonicalPng(geography);
    const appearancePng = await canonicalPng(appearance);
    const repeatedAppearancePng = await canonicalPng(appearance);

    expect(equalBytes(controlledPng, baselinePng)).toBe(false);
    expect(equalBytes(geographyPng, controlledPng)).toBe(false);
    expect(equalBytes(appearancePng, geographyPng)).toBe(false);
    expect(appearance.geography).toBe(geography.geography);
    expect(appearance.geography.coastline).toBe(geography.geography.coastline);
    expect(equalBytes(repeatedAppearancePng, appearancePng)).toBe(true);

    const reopenedDocument = required(
      decodeMapworld(required(encodeMapworld(appearance.document))),
    );
    const reopened = reopenAcceptedAtlas(reopenedDocument);
    expect(reopened.ok, reopened.ok ? undefined : JSON.stringify(reopened)).toBe(true);
    if (!reopened.ok) return;
    const reopenedPng = await canonicalPng(reopened.accepted);
    expect(equalBytes(reopenedPng, appearancePng)).toBe(true);
    expect(reopened.accepted.document).toBe(reopenedDocument);

    for (const bytes of [
      baselinePng,
      controlledPng,
      geographyPng,
      appearancePng,
      repeatedAppearancePng,
      reopenedPng,
    ]) {
      expect(bytes.byteLength).toBeLessThanOrEqual(ATLAS_PNG_MAXIMUM_BYTES);
    }
    expect(appearance.document).toBe(acceptedReferences.document);
    expect(appearance.geography).toBe(acceptedReferences.geography);
    expect(appearance.geography.coastline).toBe(acceptedReferences.coastline);
    expect(appearance.appearance).toBe(acceptedReferences.appearance);
    expect(appearance.scene).toBe(acceptedReferences.scene);
    expect(appearance.scene.nodes).toBe(acceptedReferences.nodes);
  }, 180_000);

  it('produces identical authoritative bytes for repeated and insertion-varied snapshots', () => {
    const accepted = requiredGeneratedStates().appearance;
    const first = required(encodeMapworld(accepted.document));
    const repeated = required(encodeMapworld(accepted.document));
    const reordered = required(
      encodeMapworld(reverseOrderInsensitiveCollections(accepted.document)),
    );

    expect(equalPackages(repeated, first)).toBe(true);
    expect(equalPackages(reordered, first)).toBe(true);
    for (const aspect of accepted.document.maps[0]?.aspects ?? []) {
      const reorderedAspect = {
        ...aspect,
        acceptedOutput: reverseOrderInsensitiveAtlasOutput(
          aspect.aspectName,
          aspect.acceptedOutput,
        ),
      };
      expect(
        equalBytes(
          aspectBytes(canonicalAspectBytes(reorderedAspect)),
          aspectBytes(canonicalAspectBytes(aspect)),
        ),
      ).toBe(true);
    }
  }, 90_000);

  it('rebuilds identical disposable state after scene/cache deletion', () => {
    const accepted = requiredGeneratedStates().appearance;
    const decoded = required(decodeMapworld(required(encodeMapworld(accepted.document))));
    const first = reopenAcceptedAtlas(decoded);
    const rebuilt = reopenAcceptedAtlas(decoded);
    expect(first.ok).toBe(true);
    expect(rebuilt.ok).toBe(true);
    if (!first.ok || !rebuilt.ok) return;
    expect(rebuilt.accepted.scene).toStrictEqual(first.accepted.scene);
    expect(rebuilt.accepted.document).toBe(decoded);
  }, 90_000);

  it('rejects incomplete accepted atlas content before save', () => {
    const accepted = requiredGeneratedStates().appearance;
    const root = accepted.document.maps[0];
    if (root?.mapKind !== 'world') throw new Error('Missing root map.');
    const incomplete: WorldDocument = {
      ...accepted.document,
      maps: [
        {
          ...root,
          aspects: root.aspects.filter(({ aspectName }) => aspectName !== 'atlas.paperTreatment'),
        },
      ],
    };
    const encoded = encodeMapworld(incomplete);
    expect(encoded.ok).toBe(false);
    if (encoded.ok) return;
    expect(encoded.diagnostics.map(({ code }) => code)).toContain('persistence.atlas.invalid');
  }, 30_000);

  it('rejects incompatible versions, broken dependencies, and style provenance on reconstruction', () => {
    const source = requiredGeneratedStates().appearance.document;
    const broken = [
      mutateAspect(source, 'atlas.waterDecoration', (aspect) => ({
        ...aspect,
        dependencyAspects: aspect.dependencyAspects.slice(1),
      })),
      mutateAspect(source, 'worldCoastline.geometry', (aspect) => ({
        ...aspect,
        generatorVersion: (aspect.generatorVersion + 1) as typeof aspect.generatorVersion,
      })),
      mutateAspect(source, 'atlas.paperTreatment', (aspect) => ({
        ...aspect,
        parameters: { ...(aspect.parameters as object), styleId: 'incompatible-style' },
      })),
    ];
    for (const document of broken) {
      const reconstructed = reconstructAcceptedAtlas(document);
      expect(reconstructed.status).toBe('invalid');
    }
  }, 30_000);

  it('rejects accepted error and cross-aspect diagnostics on reconstruction and persistence', () => {
    const source = requiredGeneratedStates().appearance.document;
    const root = source.maps[0];
    const paper = root?.aspects.find(({ aspectName }) => aspectName === 'atlas.paperTreatment');
    const water = root?.aspects.find(({ aspectName }) => aspectName === 'atlas.waterDecoration');
    if (root?.mapKind !== 'world' || paper === undefined || water === undefined) {
      throw new Error('Missing accepted atlas diagnostic test aspects.');
    }
    const parsedCode = parseGenerationDiagnosticCode('atlas.persistence.review');
    if (!parsedCode.ok) throw new Error(parsedCode.diagnostic.message);
    const mutated = [
      withAcceptedDiagnostic(source, paper.aspectId, 'error', parsedCode.value),
      withAcceptedDiagnostic(source, water.aspectId, 'warning', parsedCode.value),
    ];

    for (const document of mutated) {
      const reconstructed = reconstructAcceptedAtlas(document);
      expect(reconstructed.status).toBe('invalid');
      if (reconstructed.status !== 'invalid') continue;
      expect(reconstructed.diagnostics.map(({ code }) => code)).toStrictEqual([
        ACCEPTED_ATLAS_DIAGNOSTIC_CODES.invalid,
      ]);
      const encoded = encodeMapworld(document);
      expect(encoded.ok).toBe(false);
      if (encoded.ok) continue;
      expect(encoded.diagnostics.map(({ code }) => code)).toContain('persistence.atlas.invalid');
    }
  }, 60_000);

  it('rejects corrupted authoritative atlas bytes by checksum before reconstruction', () => {
    const encoded = required(encodeMapworld(requiredGeneratedStates().appearance.document));
    const corrupted: MapworldPackage = {
      files: encoded.files.map((file) => {
        if (!file.path.startsWith('maps/')) return file;
        const changed = file.bytes.slice();
        const index = Math.floor(changed.length / 2);
        changed[index] = (changed[index] ?? 0) ^ 1;
        return { path: file.path, bytes: changed };
      }),
    };
    const decoded = decodeMapworld(corrupted);
    expect(decoded.ok).toBe(false);
    if (decoded.ok) return;
    expect(decoded.diagnostics.map(({ code }) => code)).toContain('persistence.checksum.mismatch');
  }, 30_000);

  it('creates one bounded immutable native save plan for the complete atlas', () => {
    const planned = createMapworldSavePlan(requiredGeneratedStates().appearance.document, {
      operation: 'first-save',
      targetName: 'Atlas.mapworld',
      previousManifestSha256: null,
    });
    expect(planned.ok, planned.ok ? undefined : JSON.stringify(planned.error)).toBe(true);
    if (!planned.ok) return;
    expect(planned.value.files).toHaveLength(3);
    expect(planned.value.candidateManifestSha256).toMatch(/^[a-f0-9]{64}$/u);
  }, 90_000);
});

function requiredGeneratedStates(): GeneratedAtlasStates {
  if (generatedStates === undefined) throw new Error('Atlas integration setup did not complete.');
  return generatedStates;
}

function canonicalSvg(accepted: Pick<AcceptedAtlasState, 'scene'>): Uint8Array {
  const result = exportAtlasSceneToSvg({
    scene: accepted.scene,
    style: RESTRAINED_INK_ATLAS_STYLE,
  });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value.bytes;
}

async function canonicalPng(accepted: Pick<AcceptedAtlasState, 'scene'>): Promise<Uint8Array> {
  const result = await exportAtlasSceneToPngAsync(
    {
      scene: accepted.scene,
      style: RESTRAINED_INK_ATLAS_STYLE,
      dimensions: PNG_INTEGRATION_DIMENSIONS,
    },
    {
      isCancellationRequested: () => false,
      reportProgress: () => undefined,
      yieldControl: () => Promise.resolve(),
    },
  );
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value.bytes;
}
