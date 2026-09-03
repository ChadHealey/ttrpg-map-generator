import { ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_PACK } from '@ttrpg-map/assets';
import {
  type AcceptedAspectRecord,
  ASPECT_DEPENDENCY_PROVENANCE_KINDS,
  type AspectReplacementProposal,
  ATLAS_LABEL_DOCUMENT_COMMAND_KIND,
  ATLAS_LABEL_DOCUMENT_OPERATION_MODES,
  ATLAS_PHYSICAL_DOCUMENT_COMMAND_KIND,
  ATLAS_PHYSICAL_DOCUMENT_OPERATION_MODES,
  type AtlasLabelPlacement,
  type AtlasLabelPlacementProposal,
  collectWorldFeatureNameSources,
  commitAtlasLabelProposal,
  commitAtlasPhysicalProposal,
  computeInheritedContextSemanticChecksum,
  createAspectDependencyGraph,
  createAtlasGlyphMetricSnapshot,
  createBehaviorVersion,
  createParameterSchemaVersion,
  createVariantRevision,
  createWorldFeatureNameProposals,
  DEFAULT_WORLD_PHYSICAL_CONTEXT_CONTROLS,
  deriveAtlasSingletonEntityIds,
  deriveRegionalFootprintEntityId,
  formatWorldSeed,
  getTransitiveAspectInvalidation,
  type InheritedContextField,
  type InheritedContextSnapshot,
  type InheritedContextSnapshotContent,
  isAtlasLabelAcceptedAspectName,
  MAP_COORDINATE_SYSTEM_KINDS,
  MAP_KINDS,
  MAP_RELATIONSHIP_KINDS,
  MAP_SCALE_CLASSES,
  parseAspectName,
  parseGeneratorId,
  parsePlanetPoint,
  parseRegionalExtent,
  parseRegionalRectangleFootprint,
  parseSeedInput,
  parseStableId,
  reconstructAcceptedAtlas,
  rerollWorldFeatureName,
  resolveAtlasLabelPlacements,
  type WorldDocument,
  type WorldFeatureNameContent,
  type WorldFeatureNameParameters,
  type WorldFeatureNameProposal,
  type WorldPhysicalContextRecords,
} from '@ttrpg-map/core';
import {
  buildInheritedContext,
  generateAtlasAtmosphere,
  generateAtlasEcology,
  generateAtlasHydrology,
  generateAtlasMountainSystems,
} from '@ttrpg-map/generation';
import {
  canonicalAspectBytes,
  canonicalAspectOutputBytes,
  createMapworldV2Candidate,
  decodeMapworld,
} from '@ttrpg-map/persistence';
import { beforeAll, describe, expect, it } from 'vitest';

import type { AcceptedAtlasState } from './atlas-workflow-generation.js';
import { commitGeneratedAtlas } from './atlas-workflow-generation-integration-test-support.js';

interface PhysicalFixture {
  readonly m2: AcceptedAtlasState;
  readonly physical: Extract<ReturnType<typeof commitAtlasPhysicalProposal>, { readonly ok: true }>;
}

let fixture: PhysicalFixture | undefined;

const PHYSICAL_ASPECT_NAMES = new Set([
  'worldTerrain.mountainSystems',
  'worldClimate.temperature',
  'worldClimate.prevailingWinds',
  'worldClimate.moisture',
  'worldClimate.zones',
  'worldEcology.biomeBelts',
  'worldHydrology.watersheds',
  'worldHydrology.majorRivers',
  'worldHydrology.majorLakes',
]);

describe('accepted M3 physical atlas integration', () => {
  beforeAll(async () => {
    const m2 = m2Fixture(await commitGeneratedAtlas('initial-atlas'));
    const proposals = physicalProposals(m2, 0);
    const result = commitAtlasPhysicalProposal(m2.document, command(m2.document, proposals, []));
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    fixture = { m2, physical: result };
  }, 300_000);

  it('commits all nine aspects atomically and rejects partial or misaddressed proposals', () => {
    const { m2, physical } = requiredFixture();
    expect(physical.committedAspectIds).toHaveLength(9);
    expect(physical.document.maps[0]?.aspects).toHaveLength(
      (m2.document.maps[0]?.aspects.length ?? 0) + 9,
    );
    const reconstructed = reconstructAcceptedAtlas(physical.document);
    expect(reconstructed.status).toBe('accepted');
    if (reconstructed.status !== 'accepted') throw new Error('Expected accepted physical atlas.');
    expect(reconstructed.value.physical).toMatchObject({
      controls: DEFAULT_WORLD_PHYSICAL_CONTEXT_CONTROLS,
    });

    const proposals = physicalProposals(m2, 0);
    const invalidParameterSets = [
      'worldTerrain.mountainSystems',
      'worldClimate.temperature',
      'worldClimate.moisture',
      'worldHydrology.watersheds',
    ].map((aspectName) =>
      proposals.map((proposal) =>
        proposal.target.aspectName === aspectName
          ? { ...proposal, parameters: { ...proposal.parameters, unsupportedParameter: true } }
          : proposal,
      ),
    );
    for (const invalid of [
      proposals.slice(0, -1) as unknown as typeof proposals,
      proposals.map((proposal, index) =>
        index === 0
          ? { ...proposal, target: { ...proposal.target, mapId: m2.document.worldDocumentId } }
          : proposal,
      ),
      proposals.map((proposal, index) =>
        index === 0
          ? {
              ...proposal,
              target: {
                ...proposal.target,
                entityId: m2.document.worldDocumentId as unknown as typeof proposal.target.entityId,
              },
            }
          : proposal,
      ),
      proposals.map((proposal, index) =>
        index === 0 ? { ...proposal, dependencyAspects: [] } : proposal,
      ),
      ...invalidParameterSets,
    ]) {
      const rejected = commitAtlasPhysicalProposal(
        m2.document,
        command(m2.document, invalid as unknown as typeof proposals, []),
      );
      expect(rejected.ok).toBe(false);
      expect(rejected.document).toBe(m2.document);
      expect(m2.document.maps[0]?.aspects).toHaveLength(
        (physical.document.maps[0]?.aspects.length ?? 9) - 9,
      );
    }
    const staleCommand = command(m2.document, proposals, []);
    const stale = commitAtlasPhysicalProposal(m2.document, {
      ...staleCommand,
      expectedAspectRevisions: staleCommand.expectedAspectRevisions.slice(1),
    });
    expect(stale.ok).toBe(false);
    expect(stale.document).toBe(m2.document);
    if (stale.ok) throw new Error('Stale physical proposal unexpectedly committed.');
    expect(stale.diagnostics.map(({ code }) => code)).toContain('atlas-transaction.input.stale');
  }, 120_000);

  it('builds inherited context through the public accepted-document gate without mutation', () => {
    const { physical } = requiredFixture();
    const reconstructed = reconstructAcceptedAtlas(physical.document);
    if (reconstructed.status !== 'accepted' || reconstructed.value.physical === undefined) {
      throw new Error('Expected accepted physical atlas state.');
    }
    const root = physical.document.maps.find(({ mapId }) => mapId === physical.document.rootMapId);
    if (root?.mapKind !== MAP_KINDS.world) throw new Error('Expected accepted root world map.');
    const names = createWorldFeatureNameProposals({
      mapId: root.mapId,
      worldSeed: physical.document.worldSeed,
      sources: collectWorldFeatureNameSources(
        reconstructed.value.geography,
        reconstructed.value.physical,
      ),
    });
    if (!names.ok) throw new Error(JSON.stringify(names.diagnostics));
    const acceptedNames = names.proposals.map(
      (proposal): AcceptedAspectRecord<WorldFeatureNameParameters, WorldFeatureNameContent> => ({
        mapId: proposal.target.mapId,
        entityId: proposal.target.entityId,
        aspectId: proposal.target.aspect.aspectId,
        aspectName: proposal.target.aspectName,
        generatorId: proposal.generatorId,
        generatorVersion: proposal.generatorVersion,
        parameterSchemaVersion: proposal.parameterSchemaVersion,
        parameters: proposal.parameters,
        seedScope: proposal.seedScope,
        seedMetadata: proposal.seedMetadata,
        variantRevision: proposal.target.variantRevision,
        dependencyAspects: proposal.dependencyAspects,
        generationStatus: 'accepted',
        diagnostics: proposal.diagnostics,
        acceptedOutput: proposal.output,
      }),
    );
    const footprint = required(
      parseRegionalRectangleFootprint({
        shapeVersion: 'regional-rectangle-v1',
        rootSurfaceId: root.coordinateSystem.rootSurfaceId,
        worldRadius: root.coordinateSystem.radius,
        origin: required(parsePlanetPoint({ longitudeTicks: 0, latitudeTicks: -(2 ** 30) })),
        extent: {
          minXMillimeters: -100_000,
          maxXMillimeters: 100_000,
          minYMillimeters: -100_000,
          maxYMillimeters: 100_000,
        },
        transformId: 'planet-regional-azimuthal-equidistant',
        transformVersion: 1,
      }),
    );
    const acceptedNameOrder = acceptedNames.map(({ aspectId }) => aspectId);
    const documentMaps = physical.document.maps;
    const rootAspects = root.aspects;
    const acceptedAspectReferences = [...root.aspects];
    const result = buildInheritedContext({
      document: physical.document,
      footprint,
      collarPaddingMillimeters: 100_000,
      acceptedNameAspects: acceptedNames,
    });

    expect(result.status).toBe('built');
    if (result.status !== 'built') throw new Error(JSON.stringify(result.diagnostics));
    expect(result.snapshot.fields.every(({ samples }) => samples.length > 0)).toBe(true);
    expect(physical.document.maps).toBe(documentMaps);
    expect(physical.document.maps.find(({ mapId }) => mapId === root.mapId)).toBe(root);
    expect(root.aspects).toBe(rootAspects);
    expect(root.aspects.every((aspect, index) => aspect === acceptedAspectReferences[index])).toBe(
      true,
    );
    expect(acceptedNames.map(({ aspectId }) => aspectId)).toStrictEqual(acceptedNameOrder);
  }, 120_000);

  it('keeps every M2 aspect byte-identical across a focused physical reroll', () => {
    const { m2, physical } = requiredFixture();
    const rerolledProposals = physicalProposals(
      {
        ...m2,
        document: physical.document,
      },
      1,
    );
    const mountainId = rerolledProposals[0].target.aspect.aspectId;
    const rerolled = commitAtlasPhysicalProposal(
      physical.document,
      command(physical.document, rerolledProposals, [mountainId], 'reroll'),
    );
    expect(rerolled.ok).toBe(true);
    if (!rerolled.ok) throw new Error(JSON.stringify(rerolled.diagnostics));
    const beforeM2 = m2.document.maps[0]?.aspects ?? [];
    const afterById = new Map(
      rerolled.document.maps[0]?.aspects.map((aspect) => [aspect.aspectId, aspect]),
    );
    for (const before of beforeM2) {
      expect(requiredAspect(afterById, before.aspectId)).toBe(before);
    }
  }, 300_000);

  it('keeps unrelated accepted state across a control replacement and rejects a locked target', () => {
    const { m2, physical } = requiredFixture();
    const acceptedWithPhysical = { ...m2, document: physical.document };
    const proposals = physicalProposals(acceptedWithPhysical, 0, 'extreme');
    const controls = {
      ...DEFAULT_WORLD_PHYSICAL_CONTEXT_CONTROLS,
      climateCharacter: 'extreme',
    } as const;
    const replaced = commitAtlasPhysicalProposal(
      physical.document,
      command(physical.document, proposals, [], 'controls', controls),
    );
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) throw new Error(JSON.stringify(replaced.diagnostics));
    const afterById = new Map(
      replaced.document.maps[0]?.aspects.map((aspect) => [aspect.aspectId, aspect]),
    );
    for (const before of m2.document.maps[0]?.aspects ?? []) {
      expect(afterById.get(before.aspectId)).toBe(before);
    }
    const mountainBefore = aspect(
      physical.document.maps[0]?.aspects ?? [],
      'worldTerrain.mountainSystems',
    );
    expect(afterById.get(mountainBefore.aspectId)).toBe(mountainBefore);

    const lockId = required(parseStableId('lock', '83628e5e-72bb-4d22-8102-d49d70d13c9a'));
    const temperature = aspect(
      physical.document.maps[0]?.aspects ?? [],
      'worldClimate.temperature',
    );
    const lockedDocument = {
      ...physical.document,
      maps: physical.document.maps.map((map) =>
        map.mapId === physical.document.rootMapId
          ? {
              ...map,
              locks: [...map.locks, { lockId, target: { aspectId: temperature.aspectId } }],
            }
          : map,
      ),
    };
    const rejected = commitAtlasPhysicalProposal(
      lockedDocument,
      command(lockedDocument, proposals, [], 'controls', controls),
    );
    expect(rejected.ok).toBe(false);
    expect(rejected.document).toBe(lockedDocument);
    if (rejected.ok) throw new Error('Locked physical proposal unexpectedly committed.');
    expect(rejected.diagnostics.map(({ code }) => code)).toContain(
      'atlas-transaction.lock.conflict',
    );

    const constraintId = required(
      parseStableId('constraint', '8cc70673-f69a-4dde-aed3-10ddf0ed6621'),
    );
    const constrainedDocument = {
      ...physical.document,
      maps: physical.document.maps.map((map) =>
        map.mapId === physical.document.rootMapId
          ? {
              ...map,
              constraints: [
                ...map.constraints,
                {
                  constraintId,
                  constraintKind: 'proof.keep-within-extent' as const,
                  target: { aspectId: temperature.aspectId },
                  parameters: {},
                },
              ],
            }
          : map,
      ),
    };
    const constrained = commitAtlasPhysicalProposal(
      constrainedDocument,
      command(constrainedDocument, proposals, [], 'controls', controls),
    );
    expect(constrained.ok).toBe(false);
    expect(constrained.document).toBe(constrainedDocument);
    if (constrained.ok) throw new Error('Constrained physical proposal unexpectedly committed.');
    expect(constrained.diagnostics.map(({ code }) => code)).toContain(
      'atlas-transaction.constraint.conflict',
    );
  }, 300_000);

  it('round-trips a supplied pole context and reports source drift without mutating child state', () => {
    const { physical } = requiredFixture();
    const supplied = withSuppliedPoleContext(
      acceptedLabelDocument(physical.document, labelProposals(physical.document)),
    );
    const candidate = required(createMapworldV2Candidate(supplied));
    const reopened = required(decodeMapworld(candidate));
    const beforeRegion = regional(supplied);
    const afterRegion = regional(reopened);
    expect(afterRegion.parent.inheritedContext).toStrictEqual(beforeRegion.parent.inheritedContext);

    const reconstructed = reconstructAcceptedAtlas(reopened);
    expect(reconstructed.status).toBe('accepted');
    if (reconstructed.status !== 'accepted' || reconstructed.value.physical === undefined) {
      throw new Error('Expected generator-free accepted physical reconstruction.');
    }
    expect(labelAspectRecords(reopened)).toStrictEqual(labelAspectRecords(supplied));
    expect(reopened.maps[0]?.decoration).toStrictEqual(supplied.maps[0]?.decoration);
    const expectedLabels = reconstructAcceptedAtlas(supplied);
    if (
      expectedLabels.status !== 'accepted' ||
      expectedLabels.value.labels === undefined ||
      reconstructed.value.labels === undefined
    ) {
      throw new Error('Expected generator-free accepted sparse label reconstruction.');
    }
    expect(reconstructed.value.labels).toStrictEqual(expectedLabels.value.labels);
    expect(
      candidate.files.filter(({ path }) =>
        labelAspectRecords(supplied).some(({ aspectId }) => path.includes(aspectId)),
      ),
    ).toHaveLength(labelAspectRecords(supplied).length);
    const sourcePhysical = reconstructAcceptedAtlas(physical.document);
    if (sourcePhysical.status !== 'accepted' || sourcePhysical.value.physical === undefined) {
      throw new Error('Expected source physical reconstruction.');
    }
    expect(reconstructed.value.physical.temperature.provenance.fingerprint).toBe(
      sourcePhysical.value.physical.temperature.provenance.fingerprint,
    );
    expect(reconstructed.value.physical.watersheds.provenance.fingerprint).toBe(
      sourcePhysical.value.physical.watersheds.provenance.fingerprint,
    );

    const root = reopened.maps.find(({ mapId }) => mapId === reopened.rootMapId);
    if (root?.mapKind !== MAP_KINDS.world) throw new Error('Expected reopened root map.');
    const source = aspect(root.aspects, 'worldClimate.temperature');
    const graph = createAspectDependencyGraph(reopened);
    expect(graph.ok).toBe(true);
    if (!graph.ok) throw new Error(JSON.stringify(graph.diagnostics));
    const invalidation = getTransitiveAspectInvalidation(graph.graph, [source.aspectId], []);
    expect(invalidation.staleContexts).toHaveLength(1);
    expect(invalidation.staleContexts[0]).toMatchObject({
      regionalMapId: afterRegion.mapId,
      contextStatusAspectId: afterRegion.parent.contextStatusAspectId,
      status: 'stale',
    });
    expect(invalidation.staleContexts[0]?.invalidatedParentAspectIds).toContain(source.aspectId);
    const inheritedContext = afterRegion.parent.inheritedContext;
    if (inheritedContext === undefined) throw new Error('Expected reopened inherited context.');
    for (const sourceVersion of inheritedContext.sourceAspectVersions) {
      const sourceInvalidation = getTransitiveAspectInvalidation(
        graph.graph,
        [sourceVersion.sourceAspectId],
        [],
      );
      expect(sourceInvalidation.staleContexts).toHaveLength(1);
      expect(sourceInvalidation.staleContexts[0]).toMatchObject({
        regionalMapId: afterRegion.mapId,
        contextStatusAspectId: afterRegion.parent.contextStatusAspectId,
        status: 'stale',
      });
      expect(sourceInvalidation.staleContexts[0]?.invalidatedParentAspectIds).toContain(
        sourceVersion.sourceAspectId,
      );
    }
    expect(regional(reopened).parent.inheritedContext).toStrictEqual(
      beforeRegion.parent.inheritedContext,
    );
    expect(regional(reopened).aspects).toStrictEqual(beforeRegion.aspects);

    const snapshot = beforeRegion.parent.inheritedContext;
    if (snapshot === undefined) throw new Error('Expected supplied inherited context.');
    const corrupted = replaceRegionalContext(supplied, {
      ...snapshot,
      semanticChecksum: {
        ...snapshot.semanticChecksum,
        value: '0'.repeat(64) as typeof snapshot.semanticChecksum.value,
      },
    });
    expect(createMapworldV2Candidate(corrupted).ok).toBe(false);

    const { semanticChecksum: _semanticChecksum, ...snapshotContent } = snapshot;
    const unsupportedLineage = {
      ...snapshotContent,
      sourceLineage: [
        ...snapshot.sourceLineage,
        {
          sourceMapId: required(parseStableId('map', 'ffffffff-ffff-4fff-bfff-ffffffffffff')),
          sourceEntityId: required(parseStableId('entity', 'ffffffff-ffff-4fff-bfff-ffffffffffff')),
        },
      ],
    } satisfies InheritedContextSnapshotContent;
    expect(
      createMapworldV2Candidate(
        replaceRegionalContext(supplied, {
          ...unsupportedLineage,
          semanticChecksum: computeInheritedContextSemanticChecksum(unsupportedLineage),
        }),
      ).ok,
    ).toBe(false);
  }, 300_000);

  it.skipIf(process.env.ISSUE_138_MEASUREMENT_MODE !== 'encode')(
    'emits the issue 138 measurement candidate',
    async () => {
      const candidateDirectory = process.env.ISSUE_138_CANDIDATE_DIRECTORY;
      const resultPath = process.env.ISSUE_138_RESULT_PATH;
      if (candidateDirectory === undefined || resultPath === undefined) {
        throw new Error('Issue 138 measurement paths are required.');
      }
      const { createHash } = await import('node:crypto');
      const { mkdirSync, writeFileSync } = await import('node:fs');
      const supplied = withSuppliedPoleContext(requiredFixture().physical.document);
      const started = performance.now();
      const candidate = required(createMapworldV2Candidate(supplied));
      const elapsedMs = performance.now() - started;
      const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
      const files = candidate.files.map(({ path, bytes }) => ({
        path,
        bytes: bytes.byteLength,
        sha256: sha256(bytes),
      }));
      for (const file of candidate.files) {
        const target = `${candidateDirectory}/${file.path}`;
        mkdirSync(target.slice(0, target.lastIndexOf('/')), { recursive: true });
        writeFileSync(target, file.bytes);
      }
      const physicalAspects = supplied.maps
        .flatMap(({ aspects }) => aspects)
        .filter(({ aspectName }) =>
          [
            'worldClimate.moisture',
            'worldClimate.prevailingWinds',
            'worldClimate.temperature',
            'worldClimate.zones',
            'worldEcology.biomeBelts',
            'worldHydrology.majorLakes',
            'worldHydrology.majorRivers',
            'worldHydrology.watersheds',
            'worldTerrain.mountainSystems',
          ].includes(aspectName),
        );
      const framedEvidence = physicalAspects
        .map((item) => {
          const complete = required(canonicalAspectBytes(item));
          const output = required(canonicalAspectOutputBytes(item));
          return {
            aspectId: item.aspectId,
            completeBytes: complete.byteLength,
            completeSha256: sha256(complete),
            outputBytes: output.byteLength,
            outputSha256: sha256(output),
          };
        })
        .sort((left, right) => left.aspectId.localeCompare(right.aspectId));
      const accepted = reconstructAcceptedAtlas(supplied);
      if (accepted.status !== 'accepted' || accepted.value.physical === undefined) {
        throw new Error('Expected accepted physical measurement source.');
      }
      const snapshot = regional(supplied).parent.inheritedContext;
      if (snapshot === undefined) throw new Error('Expected pole snapshot.');
      const largestFile = [...files].sort((left, right) => right.bytes - left.bytes)[0];
      writeFileSync(
        resultPath,
        `${JSON.stringify(
          {
            elapsedMs,
            peakRssBytes: process.resourceUsage().maxRSS * 1024,
            packageBytes: files.reduce((sum, file) => sum + file.bytes, 0),
            fileCount: files.length,
            largestFile,
            manifestSha256: files.find(({ path }) => path === 'manifest.json')?.sha256,
            files,
            framedEvidence,
            logicalFingerprints: physicalFingerprints(accepted.value.physical),
            inheritedContextChecksum: snapshot.semanticChecksum.value,
          },
          null,
          2,
        )}\n`,
      );
    },
    300_000,
  );

  it('accepts complete dense placement state with generated and manual names', () => {
    const { physical } = requiredFixture();
    const dense = acceptedLabelDocument(
      physical.document,
      completeM3MeasurementLabelProposals(physical.document),
    );
    const denseLabels = reconstructAcceptedAtlas(dense);
    if (denseLabels.status !== 'accepted' || denseLabels.value.labels === undefined) {
      throw new Error('Expected dense complete M3 label state.');
    }
    expect(denseLabels.value.labels.placements).toHaveLength(denseLabels.value.labels.names.length);
    expect(denseLabels.value.labels.names.some(({ origin }) => origin === 'manual-override')).toBe(
      true,
    );
    expect(denseLabels.value.labels.names.some(({ origin }) => origin === 'generated')).toBe(true);
  }, 300_000);

  it.skipIf(process.env.ISSUE_151_MEASUREMENT_MODE !== 'encode')(
    'emits the issue 151 complete M3 measurement candidate',
    async () => {
      const candidateDirectory = process.env.ISSUE_151_CANDIDATE_DIRECTORY;
      const resultPath = process.env.ISSUE_151_RESULT_PATH;
      if (candidateDirectory === undefined || resultPath === undefined) {
        throw new Error('Issue 151 measurement paths are required.');
      }
      const { createHash } = await import('node:crypto');
      const { mkdirSync, readFileSync, writeFileSync } = await import('node:fs');
      const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
      const physicalContextCompatibility = physicalV2Compatibility(
        requiredFixture().physical.document,
        readFileSync,
        sha256,
      );
      const supplied = completeM3MeasurementDocument(requiredFixture().physical.document);
      const started = performance.now();
      const candidate = required(createMapworldV2Candidate(supplied));
      const elapsedMs = performance.now() - started;
      const files = candidate.files.map(({ path, bytes }) => ({
        path,
        bytes: bytes.byteLength,
        sha256: sha256(bytes),
      }));
      for (const file of candidate.files) {
        const target = `${candidateDirectory}/${file.path}`;
        mkdirSync(target.slice(0, target.lastIndexOf('/')), { recursive: true });
        writeFileSync(target, file.bytes);
      }
      const accepted = reconstructAcceptedAtlas(supplied);
      if (
        accepted.status !== 'accepted' ||
        accepted.value.physical === undefined ||
        accepted.value.labels === undefined
      ) {
        throw new Error('Expected accepted complete M3 measurement source.');
      }
      const externalAspects = supplied.maps
        .flatMap(({ aspects }) => aspects)
        .filter(
          ({ aspectName }) =>
            PHYSICAL_ASPECT_NAMES.has(aspectName) || isAtlasLabelAcceptedAspectName(aspectName),
        );
      const framedEvidence = externalAspects
        .map((item) => {
          const complete = required(canonicalAspectBytes(item));
          const output = required(canonicalAspectOutputBytes(item));
          return {
            aspectId: item.aspectId,
            aspectName: item.aspectName,
            completeBytes: complete.byteLength,
            completeSha256: sha256(complete),
            outputBytes: output.byteLength,
            outputSha256: sha256(output),
          };
        })
        .sort((left, right) => compareCodePointText(left.aspectId, right.aspectId));
      const snapshot = regional(supplied).parent.inheritedContext;
      if (snapshot === undefined) throw new Error('Expected pole snapshot.');
      const largestFile = [...files].sort((left, right) => right.bytes - left.bytes)[0];
      writeFileSync(
        resultPath,
        `${JSON.stringify(
          {
            elapsedMs,
            peakRssBytes: process.resourceUsage().maxRSS * 1024,
            packageBytes: files.reduce((sum, file) => sum + file.bytes, 0),
            fileCount: files.length,
            largestFile,
            manifestSha256: files.find(({ path }) => path === 'manifest.json')?.sha256,
            files,
            framedEvidence,
            physicalFingerprints: physicalFingerprints(accepted.value.physical),
            labelAcceptedStateSha256: sha256(
              new TextEncoder().encode(
                framedEvidence
                  .filter(({ aspectName }) => isAtlasLabelAcceptedAspectName(aspectName))
                  .map(({ aspectId, completeSha256 }) => `${aspectId}\0${completeSha256}`)
                  .join('\n'),
              ),
            ),
            inheritedContextChecksum: snapshot.semanticChecksum.value,
            nameCount: accepted.value.labels.names.length,
            placementCount: accepted.value.labels.placements.length,
            manualOverrideCount: accepted.value.labels.names.filter(
              ({ origin }) => origin === 'manual-override',
            ).length,
            physicalContextCompatibility,
          },
          null,
          2,
        )}\n`,
      );
    },
    300_000,
  );

  it('accepts and reconstructs a complete deterministic name set and placement subset', () => {
    const { physical } = requiredFixture();
    const proposals = labelProposals(physical.document);
    const accepted = commitAtlasLabelProposal(
      physical.document,
      labelCommand(physical.document, proposals),
    );
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new Error(JSON.stringify(accepted.diagnostics));

    const reconstructed = reconstructAcceptedAtlas(accepted.document);
    expect(reconstructed.status).toBe('accepted');
    if (reconstructed.status !== 'accepted' || reconstructed.value.labels === undefined) {
      throw new Error('Expected accepted atlas names and placements.');
    }
    const before = reconstructAcceptedAtlas(physical.document);
    if (before.status !== 'accepted' || before.value.physical === undefined) {
      throw new Error('Expected accepted physical atlas source.');
    }
    expect(reconstructed.value.labels.names).toHaveLength(
      collectWorldFeatureNameSources(before.value.geography, before.value.physical).length,
    );
    expect(reconstructed.value.labels.placements).toHaveLength(4);
    expect(accepted.addedEntityIds.length).toBeGreaterThan(0);
    expect(createAspectDependencyGraph(accepted.document).ok).toBe(true);

    const reversed = commitAtlasLabelProposal(
      physical.document,
      labelCommand(physical.document, [...proposals].reverse()),
    );
    expect(reversed.ok).toBe(true);
    if (!reversed.ok) throw new Error(JSON.stringify(reversed.diagnostics));
    expect(reconstructAcceptedAtlas(reversed.document)).toStrictEqual(reconstructed);

    const incomplete = commitAtlasLabelProposal(
      physical.document,
      labelCommand(
        physical.document,
        proposals.filter((proposal, index) =>
          proposal.target.aspectName === 'worldFeature.nameContent' && index === 0 ? false : true,
        ),
      ),
    );
    expect(incomplete.ok).toBe(false);
    if (incomplete.ok) throw new Error('Expected incomplete label proposal rejection.');
    expect(incomplete.document).toBe(physical.document);

    const nameProposals = proposals.filter(
      ({ target }) => target.aspectName === 'worldFeature.nameContent',
    ) as readonly WorldFeatureNameProposal[];
    const duplicateSource = nameProposals.find((candidate, index) =>
      nameProposals
        .slice(index + 1)
        .some(({ output }) => output.nameKind === candidate.output.nameKind),
    );
    const duplicateTarget =
      duplicateSource === undefined
        ? undefined
        : nameProposals.find(
            (candidate) =>
              candidate !== duplicateSource &&
              candidate.output.nameKind === duplicateSource.output.nameKind,
          );
    if (duplicateSource === undefined || duplicateTarget === undefined) {
      throw new Error('Expected two names in one uniqueness domain.');
    }
    const duplicateNames = proposals.map((proposal) =>
      proposal === duplicateTarget
        ? {
            ...duplicateTarget,
            output: {
              ...duplicateTarget.output,
              displayName: duplicateSource.output.displayName,
              comparisonKey: duplicateSource.output.comparisonKey,
            },
          }
        : proposal,
    );
    const duplicate = commitAtlasLabelProposal(
      physical.document,
      labelCommand(physical.document, duplicateNames),
    );
    expect(duplicate.ok).toBe(false);
    expect(duplicate.document).toBe(physical.document);

    const badSeed: AspectReplacementProposal[] = [...proposals];
    const seeded = badSeed[0];
    if (seeded === undefined) throw new Error('Expected one label proposal.');
    badSeed[0] = {
      ...seeded,
      seedMetadata: { ...seeded.seedMetadata, seedDerivationVersion: 999 },
    } as unknown as AspectReplacementProposal;
    const invalidSeed = commitAtlasLabelProposal(
      physical.document,
      labelCommand(physical.document, badSeed),
    );
    expect(invalidSeed.ok).toBe(false);
    expect(invalidSeed.document).toBe(physical.document);

    const malformedSeed = [...proposals] as AspectReplacementProposal[];
    malformedSeed[0] = { ...seeded, seedMetadata: null } as unknown as AspectReplacementProposal;
    const malformedSeedResult = commitAtlasLabelProposal(
      physical.document,
      labelCommand(physical.document, malformedSeed),
    );
    expect(malformedSeedResult.ok).toBe(false);
    expect(malformedSeedResult.document).toBe(physical.document);

    const ineligibleEntityId = required(
      parseStableId('entity', '08ff4d2d-5403-4bad-98f5-4fb6bd02c980'),
    );
    const ineligible = [...proposals] as AspectReplacementProposal[];
    ineligible[0] = {
      ...seeded,
      target: { ...seeded.target, entityId: ineligibleEntityId },
    };
    const ineligibleResult = commitAtlasLabelProposal(
      physical.document,
      labelCommand(physical.document, ineligible),
    );
    expect(ineligibleResult.ok).toBe(false);
    expect(ineligibleResult.document).toBe(physical.document);

    const invalidDependency = proposals.map((proposal) =>
      proposal.target.aspectName === 'label.placement'
        ? { ...proposal, dependencyAspects: [] }
        : proposal,
    );
    const orphaned = commitAtlasLabelProposal(
      physical.document,
      labelCommand(physical.document, invalidDependency),
    );
    expect(orphaned.ok).toBe(false);
    expect(orphaned.document).toBe(physical.document);

    const unsafe = proposals.map((proposal) =>
      proposal.target.aspectName === 'label.placement'
        ? {
            ...proposal,
            output: { ...(proposal as AtlasLabelPlacementProposal).output, priority: Infinity },
          }
        : proposal,
    );
    const unsafeResult = commitAtlasLabelProposal(
      physical.document,
      labelCommand(physical.document, unsafe),
    );
    expect(unsafeResult.ok).toBe(false);
    expect(unsafeResult.document).toBe(physical.document);

    const placementIndexes = proposals
      .map((proposal, index) => ({ proposal, index }))
      .filter(({ proposal }) => proposal.target.aspectName === 'label.placement');
    const mixedPack = [...proposals];
    const mixedIndex = placementIndexes[1]?.index;
    const placement = mixedIndex === undefined ? undefined : mixedPack[mixedIndex];
    if (mixedIndex === undefined || placement === undefined) {
      throw new Error('Expected two placement proposals.');
    }
    const typedPlacement = placement as AtlasLabelPlacementProposal;
    mixedPack[mixedIndex] = {
      ...typedPlacement,
      parameters: { ...typedPlacement.parameters, glyphPackSha256: 'b'.repeat(64) },
      output: { ...typedPlacement.output, glyphPackSha256: 'b'.repeat(64) },
    };
    const mixed = commitAtlasLabelProposal(
      physical.document,
      labelCommand(physical.document, mixedPack),
    );
    expect(mixed.ok).toBe(false);
    if (mixed.ok) throw new Error('Expected mixed-pack label proposal rejection.');
    expect(mixed.document).toBe(physical.document);

    const stale = commitAtlasLabelProposal(physical.document, {
      ...labelCommand(physical.document, proposals),
      expectedAspectRevisions: [],
    });
    expect(stale.ok).toBe(false);
    if (stale.ok) throw new Error('Expected stale label proposal rejection.');
    expect(stale.document).toBe(physical.document);

    const corruptDocument = {
      ...accepted.document,
      maps: accepted.document.maps.map((map) =>
        map.mapId === accepted.document.rootMapId
          ? {
              ...map,
              aspects: map.aspects.map((aspect) =>
                aspect.aspectName === 'label.placement'
                  ? { ...aspect, acceptedOutput: null }
                  : aspect,
              ),
            }
          : map,
      ),
    } as WorldDocument;
    expect(reconstructAcceptedAtlas(corruptDocument).status).toBe('invalid');

    const acceptedRoot = accepted.document.maps[0];
    if (acceptedRoot?.mapKind !== 'world') throw new Error('Expected accepted root world map.');
    const acceptedNameAspect = acceptedRoot.aspects.find(
      ({ aspectName }) => aspectName === 'worldFeature.nameContent',
    );
    const acceptedPlacementAspect = acceptedRoot.aspects.find(
      ({ aspectName }) => aspectName === 'label.placement',
    );
    if (acceptedNameAspect === undefined || acceptedPlacementAspect === undefined) {
      throw new Error('Expected accepted name and placement aspects.');
    }
    const corruptions: readonly WorldDocument[] = [
      replaceAcceptedAspect(accepted.document, acceptedNameAspect.aspectId, {
        seedMetadata: null,
      }),
      replaceAcceptedAspect(accepted.document, acceptedNameAspect.aspectId, {
        diagnostics: null,
      }),
      replaceAcceptedAspect(accepted.document, acceptedNameAspect.aspectId, {
        dependencyAspects: null,
      }),
      replaceAcceptedAspect(accepted.document, acceptedNameAspect.aspectId, {
        acceptedOutput: {
          ...(acceptedNameAspect.acceptedOutput as WorldFeatureNameContent),
          origin: 'imported',
        },
      }),
      replaceAcceptedAspect(accepted.document, acceptedPlacementAspect.aspectId, {
        acceptedOutput: {
          ...(acceptedPlacementAspect.acceptedOutput as AtlasLabelPlacementProposal['output']),
          glyphAssetId: 'atlas-glyphs.unreleased',
        },
      }),
      replaceAcceptedAspect(accepted.document, acceptedPlacementAspect.aspectId, {
        variantRevision: Infinity,
        seedMetadata: { ...acceptedPlacementAspect.seedMetadata, variantRevision: Infinity },
        acceptedOutput: {
          ...(acceptedPlacementAspect.acceptedOutput as AtlasLabelPlacementProposal['output']),
          variantRevision: Infinity,
        },
      }),
    ];
    for (const corrupted of corruptions) {
      expect(reconstructAcceptedAtlas(corrupted).status).toBe('invalid');
    }

    const forgedFingerprint = 'b'.repeat(64);
    const uniformlyForged = {
      ...accepted.document,
      maps: accepted.document.maps.map((map) =>
        map.mapId === accepted.document.rootMapId
          ? {
              ...map,
              aspects: map.aspects.map((aspect) =>
                aspect.aspectName === 'label.placement'
                  ? {
                      ...aspect,
                      parameters: {
                        ...(aspect.parameters as Readonly<Record<string, unknown>>),
                        glyphPackSha256: forgedFingerprint,
                      },
                      acceptedOutput: {
                        ...(aspect.acceptedOutput as AtlasLabelPlacementProposal['output']),
                        glyphPackSha256: forgedFingerprint,
                      },
                    }
                  : aspect,
              ),
            }
          : map,
      ),
    } as WorldDocument;
    expect(reconstructAcceptedAtlas(uniformlyForged).status).toBe('invalid');

    const acceptedMap = accepted.document.maps[0];
    if (acceptedMap?.mapKind !== 'world') throw new Error('Expected accepted root world map.');
    const currentLabels = reconstructed.value.labels;
    const selected = currentLabels.names.find(
      (name) =>
        !currentLabels.placements.some(({ sourceEntityId }) => sourceEntityId === name.entityId),
    );
    if (selected === undefined) throw new Error('Expected one unplaced accepted name.');
    const addedPlacementProposal = placementProposalForAcceptedName(
      accepted.document,
      selected,
      currentLabels.placements,
    );
    const addedPlacement = commitAtlasLabelProposal(
      accepted.document,
      labelCommand(
        accepted.document,
        [
          ...acceptedMap.aspects
            .filter(
              ({ aspectName }) =>
                aspectName === 'worldFeature.nameContent' || aspectName === 'label.placement',
            )
            .map(proposalFromAccepted),
          addedPlacementProposal,
        ],
        'replacement',
        [addedPlacementProposal.target.aspect.aspectId],
      ),
    );
    expect(addedPlacement.ok).toBe(true);
    if (!addedPlacement.ok) throw new Error(JSON.stringify(addedPlacement.diagnostics));
    const addedLabels = reconstructAcceptedAtlas(addedPlacement.document);
    expect(addedLabels.status).toBe('accepted');
    if (addedLabels.status !== 'accepted' || addedLabels.value.labels === undefined) {
      throw new Error('Expected the added placement to reconstruct.');
    }
    expect(addedLabels.value.labels.placements).toHaveLength(currentLabels.placements.length + 1);

    const addedMap = addedPlacement.document.maps[0];
    if (addedMap?.mapKind !== 'world') throw new Error('Expected accepted root world map.');
    const removedPlacement = commitAtlasLabelProposal(
      addedPlacement.document,
      labelCommand(
        addedPlacement.document,
        addedMap.aspects
          .filter(
            ({ aspectName, aspectId }) =>
              (aspectName === 'worldFeature.nameContent' || aspectName === 'label.placement') &&
              aspectId !== addedPlacementProposal.target.aspect.aspectId,
          )
          .map(proposalFromAccepted),
        'replacement',
        [addedPlacementProposal.target.aspect.aspectId],
      ),
    );
    expect(removedPlacement.ok).toBe(true);
    if (!removedPlacement.ok) throw new Error(JSON.stringify(removedPlacement.diagnostics));
    const removedLabels = reconstructAcceptedAtlas(removedPlacement.document);
    expect(removedLabels.status).toBe('accepted');
    if (removedLabels.status !== 'accepted' || removedLabels.value.labels === undefined) {
      throw new Error('Expected the removed placement set to reconstruct.');
    }
    expect(removedLabels.value.labels.placements).toHaveLength(currentLabels.placements.length);

    const rerolled = rerollWorldFeatureName({
      mapId: accepted.document.rootMapId,
      worldSeed: accepted.document.worldSeed,
      current: selected,
      otherNames: currentLabels.names.filter(({ entityId }) => entityId !== selected.entityId),
    });
    if (!rerolled.ok) throw new Error(JSON.stringify(rerolled.diagnostics));
    const selectedProposal = rerolled.proposals[0];
    if (selectedProposal === undefined) throw new Error('Expected selected name proposal.');
    const replacementProposals = acceptedMap.aspects
      .filter(
        ({ aspectName }) =>
          aspectName === 'worldFeature.nameContent' || aspectName === 'label.placement',
      )
      .map((aspect) =>
        aspect.aspectId === selectedProposal.target.aspect.aspectId
          ? selectedProposal
          : proposalFromAccepted(aspect),
      );
    const preserved = acceptedMap.aspects.find(
      ({ aspectName }) => aspectName === 'worldTerrain.macroElevation',
    );
    const labelLockId = required(parseStableId('lock', '587f19b3-e3ed-4db5-845b-f9e0ae66ab5d'));
    const lockedLabels = {
      ...accepted.document,
      maps: accepted.document.maps.map((map) =>
        map.mapId === accepted.document.rootMapId
          ? {
              ...map,
              locks: [
                ...map.locks,
                {
                  lockId: labelLockId,
                  target: { aspectId: selectedProposal.target.aspect.aspectId },
                },
              ],
            }
          : map,
      ),
    } as WorldDocument;
    const lockedReplacement = commitAtlasLabelProposal(
      lockedLabels,
      labelCommand(lockedLabels, replacementProposals, 'replacement', [
        selectedProposal.target.aspect.aspectId,
      ]),
    );
    expect(lockedReplacement.ok).toBe(false);
    expect(lockedReplacement.document).toBe(lockedLabels);
    if (lockedReplacement.ok) throw new Error('Expected locked label rejection.');
    expect(lockedReplacement.diagnostics.map(({ code }) => code)).toContain(
      'atlas-transaction.lock.conflict',
    );

    const labelConstraintId = required(
      parseStableId('constraint', 'e8351ce7-c1e1-45df-a477-035631f62c82'),
    );
    const constrainedLabels = {
      ...accepted.document,
      maps: accepted.document.maps.map((map) =>
        map.mapId === accepted.document.rootMapId
          ? {
              ...map,
              constraints: [
                ...map.constraints,
                {
                  constraintId: labelConstraintId,
                  constraintKind: 'proof.keep-within-extent' as const,
                  target: { aspectId: selectedProposal.target.aspect.aspectId },
                  parameters: {},
                },
              ],
            }
          : map,
      ),
    } as WorldDocument;
    const constrainedReplacement = commitAtlasLabelProposal(
      constrainedLabels,
      labelCommand(constrainedLabels, replacementProposals, 'replacement', [
        selectedProposal.target.aspect.aspectId,
      ]),
    );
    expect(constrainedReplacement.ok).toBe(false);
    expect(constrainedReplacement.document).toBe(constrainedLabels);
    if (constrainedReplacement.ok) throw new Error('Expected constrained label rejection.');
    expect(constrainedReplacement.diagnostics.map(({ code }) => code)).toContain(
      'atlas-transaction.constraint.conflict',
    );

    const replaced = commitAtlasLabelProposal(
      accepted.document,
      labelCommand(accepted.document, replacementProposals, 'replacement', [
        selectedProposal.target.aspect.aspectId,
      ]),
    );
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) throw new Error(JSON.stringify(replaced.diagnostics));
    expect(
      replaced.document.maps[0]?.aspects.find(
        ({ aspectName }) => aspectName === 'worldTerrain.macroElevation',
      ),
    ).toBe(preserved);

    const placedName = currentLabels.names.find((name) =>
      currentLabels.placements.some(({ sourceEntityId }) => sourceEntityId === name.entityId),
    );
    if (placedName === undefined) throw new Error('Expected one placed accepted name.');
    const staleName = rerollWorldFeatureName({
      mapId: accepted.document.rootMapId,
      worldSeed: accepted.document.worldSeed,
      current: placedName,
      otherNames: currentLabels.names.filter(({ entityId }) => entityId !== placedName.entityId),
    });
    if (!staleName.ok) throw new Error(JSON.stringify(staleName.diagnostics));
    const staleNameProposal = staleName.proposals[0];
    if (staleNameProposal === undefined) throw new Error('Expected placed-name reroll proposal.');
    const stalePlacement = commitAtlasLabelProposal(
      accepted.document,
      labelCommand(
        accepted.document,
        acceptedMap.aspects
          .filter(
            ({ aspectName }) =>
              aspectName === 'worldFeature.nameContent' || aspectName === 'label.placement',
          )
          .map((aspect) =>
            aspect.aspectId === staleNameProposal.target.aspect.aspectId
              ? staleNameProposal
              : proposalFromAccepted(aspect),
          ),
        'replacement',
        [staleNameProposal.target.aspect.aspectId],
      ),
    );
    expect(stalePlacement.ok).toBe(false);
    if (stalePlacement.ok) throw new Error('Expected stale placement linkage rejection.');
    expect(stalePlacement.document).toBe(accepted.document);

    const removedForReroll = currentLabels.placements.find(
      ({ sourceEntityId }) => sourceEntityId === placedName.entityId,
    );
    if (removedForReroll === undefined) throw new Error('Expected placed-name placement.');
    const rerolledWithoutPlacement = commitAtlasLabelProposal(
      accepted.document,
      labelCommand(
        accepted.document,
        acceptedMap.aspects
          .filter(
            ({ aspectName, aspectId }) =>
              (aspectName === 'worldFeature.nameContent' || aspectName === 'label.placement') &&
              aspectId !== removedForReroll.placementId,
          )
          .map((aspect) =>
            aspect.aspectId === staleNameProposal.target.aspect.aspectId
              ? staleNameProposal
              : proposalFromAccepted(aspect),
          ),
        'replacement',
        [staleNameProposal.target.aspect.aspectId, removedForReroll.placementId],
      ),
    );
    expect(rerolledWithoutPlacement.ok).toBe(true);
    if (!rerolledWithoutPlacement.ok) {
      throw new Error(JSON.stringify(rerolledWithoutPlacement.diagnostics));
    }
    const rerolledLabels = reconstructAcceptedAtlas(rerolledWithoutPlacement.document);
    expect(rerolledLabels.status).toBe('accepted');
    if (rerolledLabels.status !== 'accepted' || rerolledLabels.value.labels === undefined) {
      throw new Error('Expected rerolled labels without the stale placement.');
    }
    expect(
      rerolledLabels.value.labels.placements.some(
        ({ sourceEntityId }) => sourceEntityId === placedName.entityId,
      ),
    ).toBe(false);
  }, 300_000);
});

function labelProposals(document: WorldDocument) {
  const accepted = reconstructAcceptedAtlas(document);
  if (accepted.status !== 'accepted' || accepted.value.physical === undefined) {
    throw new Error('Expected accepted physical atlas source.');
  }
  const names = createWorldFeatureNameProposals({
    mapId: document.rootMapId,
    worldSeed: document.worldSeed,
    sources: collectWorldFeatureNameSources(accepted.value.geography, accepted.value.physical),
  });
  if (!names.ok) throw new Error(JSON.stringify(names.diagnostics));
  const metrics = createAtlasGlyphMetricSnapshot(ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_PACK);
  if (!metrics.ok) throw new Error(JSON.stringify(metrics.diagnostics));
  const revision = required(createVariantRevision(0));
  const placements = resolveAtlasLabelPlacements({
    mapId: document.rootMapId,
    worldSeed: document.worldSeed,
    sceneExtent: {
      minXTicks: 0,
      minYTicks: 0,
      maxXTicks: 2_048 * 1_024,
      maxYTicks: 1_024 * 1_024,
    },
    metrics: metrics.value,
    candidates: names.proposals.slice(0, 4).map((proposal, index) => ({
      nameContent: proposal.output,
      placementVariantRevision: revision,
      glyphPackSha256: metrics.value.packSha256,
      priority: 100 - index,
      fontSizeTicks: 24 * 1_024,
      anchor: { xTicks: (200 + index * 450) * 1_024, yTicks: 300 * 1_024 },
      variants: [{ variantKey: 'center', baselineOffset: { xTicks: 0, yTicks: 0 } }],
    })),
  });
  if (!placements.ok) throw new Error(JSON.stringify(placements.diagnostics));
  return [...names.proposals, ...placements.proposals];
}

function completeM3MeasurementDocument(document: WorldDocument): WorldDocument {
  return withSuppliedPoleContext(
    acceptedLabelDocument(document, completeM3MeasurementLabelProposals(document)),
  );
}

function physicalV2Compatibility(
  document: WorldDocument,
  readFile: (path: string, encoding: 'utf8') => string,
  sha256: (bytes: Uint8Array) => string,
) {
  const baselinePath = 'docs/investigations/issue-138/macos-results.json';
  const baseline = JSON.parse(readFile(baselinePath, 'utf8')) as {
    readonly canonicalEvidence: {
      readonly manifestSha256: string;
      readonly files: readonly {
        readonly path: string;
        readonly bytes: number;
        readonly sha256: string;
      }[];
    };
  };
  const candidate = required(createMapworldV2Candidate(withSuppliedPoleContext(document)));
  const files = candidate.files.map(({ path, bytes }) => ({
    path,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
  }));
  expect(files).toStrictEqual(baseline.canonicalEvidence.files);
  const manifestSha256 = files.find(({ path }) => path === 'manifest.json')?.sha256;
  expect(manifestSha256).toBe(baseline.canonicalEvidence.manifestSha256);
  return {
    baselinePath,
    baselineManifestSha256: baseline.canonicalEvidence.manifestSha256,
    manifestSha256,
    fileCount: files.length,
  };
}

function acceptedLabelDocument(
  document: WorldDocument,
  proposals: readonly AspectReplacementProposal[],
): WorldDocument {
  const accepted = commitAtlasLabelProposal(document, labelCommand(document, proposals));
  if (!accepted.ok) throw new Error(JSON.stringify(accepted.diagnostics));
  return accepted.document;
}

function completeM3MeasurementLabelProposals(document: WorldDocument) {
  const accepted = reconstructAcceptedAtlas(document);
  if (accepted.status !== 'accepted' || accepted.value.physical === undefined) {
    throw new Error('Expected accepted physical atlas measurement source.');
  }
  const generated = createWorldFeatureNameProposals({
    mapId: document.rootMapId,
    worldSeed: document.worldSeed,
    sources: collectWorldFeatureNameSources(accepted.value.geography, accepted.value.physical),
  });
  if (!generated.ok) throw new Error(JSON.stringify(generated.diagnostics));
  const manualIndex = generated.proposals.length - 1;
  const names: readonly WorldFeatureNameProposal[] = generated.proposals.map((proposal, index) => {
    if (index !== manualIndex) return proposal;
    const output: WorldFeatureNameContent = {
      ...proposal.output,
      origin: 'manual-override',
      displayName: 'Codex Meridian',
      comparisonKey: 'codex meridian',
    };
    return Object.freeze({ ...proposal, output: Object.freeze(output) });
  });
  const metrics = createAtlasGlyphMetricSnapshot(ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_PACK);
  if (!metrics.ok) throw new Error(JSON.stringify(metrics.diagnostics));
  const revision = required(createVariantRevision(0));
  const placements = resolveAtlasLabelPlacements({
    mapId: document.rootMapId,
    worldSeed: document.worldSeed,
    sceneExtent: {
      minXTicks: 0,
      minYTicks: 0,
      maxXTicks: 2_048 * 1_024,
      maxYTicks: 1_024 * 1_024,
    },
    metrics: metrics.value,
    candidates: names.map((proposal, index) => ({
      nameContent: proposal.output,
      placementVariantRevision: revision,
      glyphPackSha256: metrics.value.packSha256,
      priority: 10_000 - index,
      fontSizeTicks: 10 * 1_024,
      anchor: {
        xTicks: (32 + (index % 8) * 250) * 1_024,
        yTicks: (32 + Math.floor(index / 8) * 48) * 1_024,
      },
      variants: [{ variantKey: 'dense-grid', baselineOffset: { xTicks: 0, yTicks: 0 } }],
    })),
  });
  if (
    !placements.ok ||
    placements.diagnostics.length > 0 ||
    placements.proposals.length !== names.length
  ) {
    throw new Error(JSON.stringify(placements));
  }
  return Object.freeze([...names, ...placements.proposals]);
}

function labelAspectRecords(document: WorldDocument): readonly AcceptedAspectRecord[] {
  return document.maps
    .flatMap(({ aspects }) => aspects)
    .filter(({ aspectName }) => isAtlasLabelAcceptedAspectName(aspectName))
    .sort((left, right) => compareCodePointText(left.aspectId, right.aspectId));
}

function labelCommand(
  document: WorldDocument,
  proposals: readonly AspectReplacementProposal[],
  operation: 'initial' | 'replacement' = 'initial',
  explicitlyChangedAspectIds: readonly AcceptedAspectRecord['aspectId'][] = [],
) {
  return {
    kind: ATLAS_LABEL_DOCUMENT_COMMAND_KIND,
    operationMode:
      operation === 'initial'
        ? ATLAS_LABEL_DOCUMENT_OPERATION_MODES.initial
        : ATLAS_LABEL_DOCUMENT_OPERATION_MODES.replacement,
    targetMapId: document.rootMapId,
    expectedWorldSeed: document.worldSeed,
    expectedAspectRevisions:
      document.maps[0]?.aspects.map(({ aspectId, variantRevision }) => ({
        aspectId,
        variantRevision,
      })) ?? [],
    proposedAspects: proposals,
    explicitlyChangedAspectIds,
  } as const;
}

function placementProposalForAcceptedName(
  document: WorldDocument,
  nameContent: WorldFeatureNameContent,
  acceptedPeerPlacements: readonly AtlasLabelPlacement[],
): AtlasLabelPlacementProposal {
  const metrics = createAtlasGlyphMetricSnapshot(ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_PACK);
  if (!metrics.ok) throw new Error(JSON.stringify(metrics.diagnostics));
  const placement = resolveAtlasLabelPlacements({
    mapId: document.rootMapId,
    worldSeed: document.worldSeed,
    sceneExtent: {
      minXTicks: 0,
      minYTicks: 0,
      maxXTicks: 2_048 * 1_024,
      maxYTicks: 1_024 * 1_024,
    },
    metrics: metrics.value,
    acceptedPeerPlacements,
    candidates: [
      {
        nameContent,
        placementVariantRevision: required(createVariantRevision(0)),
        glyphPackSha256: metrics.value.packSha256,
        priority: 50,
        fontSizeTicks: 24 * 1_024,
        anchor: { xTicks: 200 * 1_024, yTicks: 700 * 1_024 },
        variants: [{ variantKey: 'center', baselineOffset: { xTicks: 0, yTicks: 0 } }],
      },
    ],
  });
  if (!placement.ok) throw new Error(JSON.stringify(placement.diagnostics));
  const proposal = placement.proposals[0];
  if (proposal === undefined) throw new Error('Expected one added placement proposal.');
  return proposal;
}

function replaceAcceptedAspect(
  document: WorldDocument,
  aspectId: AcceptedAspectRecord['aspectId'],
  replacement: Readonly<Record<string, unknown>>,
): WorldDocument {
  return {
    ...document,
    maps: document.maps.map((map) =>
      map.mapId === document.rootMapId
        ? {
            ...map,
            aspects: map.aspects.map((aspect) =>
              aspect.aspectId === aspectId ? { ...aspect, ...replacement } : aspect,
            ),
          }
        : map,
    ),
  };
}

function proposalFromAccepted(aspect: AcceptedAspectRecord): AspectReplacementProposal {
  return {
    status: 'proposed',
    target: {
      mapId: aspect.mapId,
      entityId: aspect.entityId,
      aspect: { aspectId: aspect.aspectId },
      aspectName: aspect.aspectName,
      variantRevision: aspect.variantRevision,
    },
    generatorId: aspect.generatorId,
    generatorVersion: aspect.generatorVersion,
    parameterSchemaVersion: aspect.parameterSchemaVersion,
    parameters: aspect.parameters,
    seedScope: aspect.seedScope,
    seedMetadata: aspect.seedMetadata,
    dependencyAspects: aspect.dependencyAspects,
    output: aspect.acceptedOutput,
    diagnostics: aspect.diagnostics,
  };
}

function physicalProposals(
  accepted: AcceptedAtlasState,
  mountainRevision: number,
  climateCharacter: 'temperate' | 'varied' | 'extreme' = 'varied',
) {
  const map = accepted.document.maps[0];
  if (map?.mapKind !== 'world') throw new Error('Expected accepted world atlas.');
  const singleton = deriveAtlasSingletonEntityIds(map.mapId);
  const macro = aspect(map.aspects, 'worldTerrain.macroElevation');
  const partition = aspect(map.aspects, 'worldSurface.landWaterClassification');
  const revision = required(createVariantRevision(mountainRevision));
  const unchanged = required(createVariantRevision(0));
  const mountain = generateAtlasMountainSystems({
    worldSeed: accepted.document.worldSeed,
    worldMapId: map.mapId,
    worldSurfaceEntityId: singleton.worldSurfaceEntityId,
    macroElevationAspectId: macro.aspectId,
    landWaterClassificationAspectId: partition.aspectId,
    mountainSystemsVariantRevision: revision,
    mountainCharacter: 'varied',
    records: accepted.geography,
  });

  if (mountain.status !== 'proposed') throw new Error(JSON.stringify(mountain.diagnostics));
  const atmosphere = generateAtlasAtmosphere({
    worldSeed: accepted.document.worldSeed,
    worldMapId: map.mapId,
    worldSurfaceEntityId: singleton.worldSurfaceEntityId,
    macroElevationAspectId: macro.aspectId,
    landWaterClassificationAspectId: partition.aspectId,
    temperatureVariantRevision: unchanged,
    prevailingWindsVariantRevision: unchanged,
    climateCharacter,
    records: accepted.geography,
    mountainSystems: mountain.proposal.output,
  });
  if (atmosphere.status !== 'proposed') throw new Error(JSON.stringify(atmosphere.diagnostics));
  const ecology = generateAtlasEcology({
    worldSeed: accepted.document.worldSeed,
    worldMapId: map.mapId,
    worldSurfaceEntityId: singleton.worldSurfaceEntityId,
    macroElevationAspectId: macro.aspectId,
    landWaterClassificationAspectId: partition.aspectId,
    moistureVariantRevision: unchanged,
    climateZonesVariantRevision: unchanged,
    biomeBeltsVariantRevision: unchanged,
    records: accepted.geography,
    mountainSystems: mountain.proposal.output,
    atmosphere: atmosphere.patch,
  });
  if (ecology.status !== 'proposed') throw new Error(JSON.stringify(ecology.diagnostics));
  const hydrology = generateAtlasHydrology({
    worldSeed: accepted.document.worldSeed,
    worldMapId: map.mapId,
    worldSurfaceEntityId: singleton.worldSurfaceEntityId,
    macroElevationAspectId: macro.aspectId,
    landWaterClassificationAspectId: partition.aspectId,
    watershedsVariantRevision: unchanged,
    majorRiversVariantRevision: unchanged,
    majorLakesVariantRevision: unchanged,
    records: accepted.geography,
    mountainSystems: mountain.proposal.output,
    ecology: ecology.patch,
  });
  if (hydrology.status !== 'proposed') throw new Error(JSON.stringify(hydrology.diagnostics));
  return [
    mountain.proposal,
    atmosphere.patch.temperature,
    atmosphere.patch.prevailingWinds,
    ecology.patch.moisture,
    ecology.patch.climateZones,
    ecology.patch.biomeBelts,
    hydrology.patch.watersheds,
    hydrology.patch.majorRivers,
    hydrology.patch.majorLakes,
  ] as const;
}

function m2Fixture(accepted: AcceptedAtlasState): AcceptedAtlasState {
  const root = accepted.document.maps.find(({ mapId }) => mapId === accepted.document.rootMapId);
  if (root?.mapKind !== 'world') throw new Error('Expected accepted world atlas.');
  const aspects = root.aspects.filter(
    ({ aspectName }) =>
      !PHYSICAL_ASPECT_NAMES.has(aspectName) && !isAtlasLabelAcceptedAspectName(aspectName),
  );
  const aspectIds = new Set(aspects.map(({ aspectId }) => aspectId));
  const ownerIds = new Set(aspects.map(({ entityId }) => entityId));
  const m2Root = Object.freeze({
    ...root,
    entities: Object.freeze(root.entities.filter(({ entityId }) => ownerIds.has(entityId))),
    aspects: Object.freeze(aspects),
    decoration: Object.freeze({
      aspectReferences: Object.freeze(
        root.decoration.aspectReferences.filter(({ aspectId }) => aspectIds.has(aspectId)),
      ),
    }),
  });
  return Object.freeze({
    ...accepted,
    document: Object.freeze({ ...accepted.document, maps: Object.freeze([m2Root]) }),
  });
}

function withSuppliedPoleContext(document: WorldDocument): WorldDocument {
  const accepted = reconstructAcceptedAtlas(document);
  if (accepted.status !== 'accepted' || accepted.value.physical === undefined) {
    throw new Error('Expected accepted M3 state for the supplied context fixture.');
  }
  const root = document.maps.find(({ mapId }) => mapId === document.rootMapId);
  if (root?.mapKind !== MAP_KINDS.world) throw new Error('Expected root world map.');
  const physical = accepted.value.physical;
  const origin = required(parsePlanetPoint({ longitudeTicks: 0, latitudeTicks: -(2 ** 30) }));
  const extent = required(
    parseRegionalExtent({
      minXMillimeters: -100_000,
      maxXMillimeters: 100_000,
      minYMillimeters: -100_000,
      maxYMillimeters: 100_000,
    }),
  );
  const footprint = {
    shapeVersion: 'regional-rectangle-v1' as const,
    rootSurfaceId: root.coordinateSystem.rootSurfaceId,
    worldRadius: root.coordinateSystem.radius,
    origin,
    extent,
    transformId: 'planet-regional-azimuthal-equidistant' as const,
    transformVersion: 1 as const,
  };
  const sourceByName = new Map<string, AcceptedAspectRecord>(
    root.aspects.map((acceptedAspect) => [acceptedAspect.aspectName, acceptedAspect] as const),
  );
  const source = (name: string) => {
    const found = sourceByName.get(name);
    if (found === undefined) throw new Error(`Missing supplied-context source ${name}.`);
    return found;
  };
  const field = (
    fieldKind: InheritedContextField['fieldKind'],
    component: InheritedContextField['component'],
    valueEncoding: InheritedContextField['valueEncoding'],
    value: InheritedContextField['samples'][number]['values'][number],
    sourceAspect: AcceptedAspectRecord,
    sourceFingerprint?: string,
  ): InheritedContextField => ({
    sourceMapId: root.mapId,
    sourceEntityId: sourceAspect.entityId,
    sourceAspectId: sourceAspect.aspectId,
    fieldKind,
    component,
    valueEncoding,
    ...(sourceFingerprint === undefined ? {} : { sourceFingerprint }),
    samples: [{ sampleIndex: 0, rootPoint: origin, values: [value] }],
  });
  const sources = {
    biome: source('worldEcology.biomeBelts'),
    climate: source('worldClimate.zones'),
    landWater: source('worldSurface.landWaterClassification'),
    macro: source('worldTerrain.macroElevation'),
    moisture: source('worldClimate.moisture'),
    winds: source('worldClimate.prevailingWinds'),
    temperature: source('worldClimate.temperature'),
    watershed: source('worldHydrology.watersheds'),
  };
  const fields: readonly InheritedContextField[] = [
    field(
      'biome-belts',
      'value',
      'semantic-key',
      requiredValue(physical.biomeBelts.values.at(0)),
      sources.biome,
      physical.biomeBelts.provenance.fingerprint,
    ),
    field(
      'climate-zones',
      'value',
      'semantic-key',
      requiredValue(physical.climateZones.values.at(0)),
      sources.climate,
      physical.climateZones.provenance.fingerprint,
    ),
    field(
      'land-water-classification',
      'value',
      'land-water-class',
      requiredValue(accepted.value.geography.landWaterClassification.samples.at(0)),
      sources.landWater,
    ),
    field(
      'macro-elevation',
      'value',
      'integer-ticks',
      requiredValue(accepted.value.geography.macroElevation.values.at(0)),
      sources.macro,
    ),
    field(
      'moisture',
      'value',
      'integer-ticks',
      requiredValue(physical.moisture.values.at(0)),
      sources.moisture,
      physical.moisture.provenance.fingerprint,
    ),
    field(
      'prevailing-winds-direction',
      'x',
      'integer-ticks',
      requiredValue(physical.prevailingWinds.xComponents.values.at(0)),
      sources.winds,
      physical.prevailingWinds.xComponents.provenance.fingerprint,
    ),
    field(
      'prevailing-winds-direction',
      'y',
      'integer-ticks',
      requiredValue(physical.prevailingWinds.yComponents.values.at(0)),
      sources.winds,
      physical.prevailingWinds.yComponents.provenance.fingerprint,
    ),
    field(
      'prevailing-winds-direction',
      'z',
      'integer-ticks',
      requiredValue(physical.prevailingWinds.zComponents.values.at(0)),
      sources.winds,
      physical.prevailingWinds.zComponents.provenance.fingerprint,
    ),
    field(
      'prevailing-winds-speed',
      'speed',
      'integer-ticks',
      requiredValue(physical.prevailingWinds.speed.values.at(0)),
      sources.winds,
      physical.prevailingWinds.speed.provenance.fingerprint,
    ),
    field(
      'temperature',
      'value',
      'integer-ticks',
      requiredValue(physical.temperature.values.at(0)),
      sources.temperature,
      physical.temperature.provenance.fingerprint,
    ),
    field(
      'watershed-assignment',
      'value',
      'entity-id',
      requiredValue(physical.watersheds.values.at(0)),
      sources.watershed,
      physical.watersheds.provenance.fingerprint,
    ),
  ];
  const sourceAspects = [
    ...new Map(Object.values(sources).map((item) => [item.aspectId, item])).values(),
  ].sort((left, right) => left.aspectId.localeCompare(right.aspectId));
  const content: InheritedContextSnapshotContent = {
    contractVersion: 1,
    rootMapId: root.mapId,
    parentMapId: root.mapId,
    footprintId: deriveRegionalFootprintEntityId(footprint),
    footprint,
    rootRefinementNamespace: {
      namespaceVersion: 1,
      rootSurfaceId: root.coordinateSystem.rootSurfaceId,
      seedScope: 'root-coordinate',
    },
    collar: {
      collarVersion: 1,
      extent: required(
        parseRegionalExtent({
          minXMillimeters: -200_000,
          maxXMillimeters: 200_000,
          minYMillimeters: -200_000,
          maxYMillimeters: 200_000,
        }),
      ),
    },
    sourceLineage: [{ sourceMapId: root.mapId, sourceEntityId: physical.worldSurfaceEntityId }],
    sourceAspectVersions: sourceAspects.map((item) => ({
      sourceMapId: root.mapId,
      sourceEntityId: item.entityId,
      sourceAspectId: item.aspectId,
      aspectName: item.aspectName,
      generatorVersion: item.generatorVersion,
      parameterSchemaVersion: item.parameterSchemaVersion,
      variantRevision: item.variantRevision,
    })),
    fields,
    geometryAnchors: [],
    boundaryPortals: [],
    namedAnchors: [],
  };
  const snapshot: InheritedContextSnapshot = {
    ...content,
    semanticChecksum: computeInheritedContextSemanticChecksum(content),
  };
  const regionMapId = required(parseStableId('map', '71456929-0ee6-4142-84ed-4a777d8f63d3'));
  const regionEntityId = required(parseStableId('entity', '383a9b67-6a5a-410a-bbaf-f8d5858976e4'));
  const contextStatusAspectId = required(
    parseStableId('aspect', '60fe7cc8-882d-45ec-9aed-ca49f8fa1406'),
  );
  const childGeographyAspectId = required(
    parseStableId('aspect', 'f4305105-1d46-42a0-931e-cb979482d1bb'),
  );
  const contextStatus = acceptedRegionalAspect(
    document,
    regionMapId,
    regionEntityId,
    contextStatusAspectId,
    'regional.inheritedContextStatus',
    sourceAspects.map((sourceAspect) => ({
      aspectId: sourceAspect.aspectId,
      contextProvenance: {
        kind: ASPECT_DEPENDENCY_PROVENANCE_KINDS.inheritedContext,
        parentMapId: root.mapId,
        childMapId: regionMapId,
      },
    })),
    { status: 'current' },
  );
  const childGeography = acceptedRegionalAspect(
    document,
    regionMapId,
    regionEntityId,
    childGeographyAspectId,
    'regional.geography',
    [{ aspectId: contextStatusAspectId }],
    { retainedValue: 'child-owned-geography' },
  );
  return {
    ...document,
    maps: [
      ...document.maps,
      {
        mapId: regionMapId,
        mapKind: MAP_KINDS.regional,
        scaleClass: MAP_SCALE_CLASSES.regional,
        displayName: 'Supplied south-pole context',
        parent: {
          parentMapId: root.mapId,
          rootMapId: root.mapId,
          relationshipKind: MAP_RELATIONSHIP_KINDS.worldToRegional,
          contextStatusAspectId,
          inheritedContext: snapshot,
        },
        coordinateSystem: {
          kind: MAP_COORDINATE_SYSTEM_KINDS.regionalAzimuthalEquidistant,
          rootSurfaceId: root.coordinateSystem.rootSurfaceId,
          transformId: 'planet-regional-azimuthal-equidistant',
          transformVersion: 1,
          origin,
          radius: root.coordinateSystem.radius,
        },
        extent,
        entities: [{ entityId: regionEntityId, displayName: 'Supplied south-pole context' }],
        aspects: [contextStatus, childGeography],
        constraints: [],
        locks: [],
        decoration: { aspectReferences: [] },
        layout: { aspectReferences: [] },
      },
    ],
  };
}

function acceptedRegionalAspect(
  document: WorldDocument,
  mapId: ReturnType<typeof regional>['mapId'],
  entityId: ReturnType<typeof regional>['entities'][number]['entityId'],
  aspectId: AcceptedAspectRecord['aspectId'],
  name: string,
  dependencyAspects: AcceptedAspectRecord['dependencyAspects'],
  acceptedOutput: AcceptedAspectRecord['acceptedOutput'],
): AcceptedAspectRecord {
  const aspectName = required(parseAspectName(name));
  const generatorId = required(parseGeneratorId(name));
  const generatorVersion = required(createBehaviorVersion(1));
  const parameterSchemaVersion = required(createParameterSchemaVersion(1));
  const variantRevision = required(createVariantRevision(0));
  const seedMetadata = required(
    parseSeedInput({
      seedDerivationVersion: 1,
      deterministicStreamVersion: 1,
      seedScope: 'map/entity',
      worldSeed: formatWorldSeed(document.worldSeed),
      generatorId,
      generatorVersion,
      aspectName,
      variantRevision,
      mapId,
      entityId,
    }),
  );
  if (seedMetadata.seedScope !== 'map/entity') throw new Error('Expected map/entity seed.');
  return {
    mapId,
    entityId,
    aspectId,
    aspectName,
    generatorId,
    generatorVersion,
    parameterSchemaVersion,
    parameters: {},
    seedScope: 'map/entity',
    seedMetadata,
    variantRevision,
    dependencyAspects,
    generationStatus: 'accepted',
    diagnostics: [],
    acceptedOutput,
  };
}

function regional(document: WorldDocument) {
  const found = document.maps.find(({ mapKind }) => mapKind === MAP_KINDS.regional);
  if (found?.mapKind !== MAP_KINDS.regional) throw new Error('Expected regional map.');
  return found;
}

function replaceRegionalContext(
  document: WorldDocument,
  inheritedContext: InheritedContextSnapshot,
): WorldDocument {
  const target = regional(document);
  return {
    ...document,
    maps: document.maps.map((map) =>
      map.mapId === target.mapId
        ? { ...target, parent: { ...target.parent, inheritedContext } }
        : map,
    ),
  };
}

function requiredValue<Value>(value: Value | undefined): Value {
  if (value === undefined) throw new Error('Expected supplied-context sample value.');
  return value;
}

function physicalFingerprints(records: WorldPhysicalContextRecords) {
  return {
    biomeBelts: records.biomeBelts.provenance.fingerprint,
    climateZones: records.climateZones.provenance.fingerprint,
    moisture: records.moisture.provenance.fingerprint,
    prevailingWindsSpeed: records.prevailingWinds.speed.provenance.fingerprint,
    prevailingWindsX: records.prevailingWinds.xComponents.provenance.fingerprint,
    prevailingWindsY: records.prevailingWinds.yComponents.provenance.fingerprint,
    prevailingWindsZ: records.prevailingWinds.zComponents.provenance.fingerprint,
    temperature: records.temperature.provenance.fingerprint,
    watersheds: records.watersheds.provenance.fingerprint,
  };
}

function compareCodePointText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function command(
  document: AcceptedAtlasState['document'],
  proposals: ReturnType<typeof physicalProposals>,
  explicitlyIncrementedAspectIds: readonly ReturnType<
    typeof physicalProposals
  >[number]['target']['aspect']['aspectId'][],
  operation: 'controls' | 'initial' | 'reroll' = 'initial',
  controls = DEFAULT_WORLD_PHYSICAL_CONTEXT_CONTROLS,
) {
  return {
    kind: ATLAS_PHYSICAL_DOCUMENT_COMMAND_KIND,
    operationMode:
      operation === 'initial'
        ? ATLAS_PHYSICAL_DOCUMENT_OPERATION_MODES.initial
        : operation === 'controls'
          ? ATLAS_PHYSICAL_DOCUMENT_OPERATION_MODES.controls
          : ATLAS_PHYSICAL_DOCUMENT_OPERATION_MODES.aspectReroll,
    targetMapId: document.rootMapId,
    expectedWorldSeed: document.worldSeed,
    expectedAspectRevisions:
      document.maps[0]?.aspects.map(({ aspectId, variantRevision }) => ({
        aspectId,
        variantRevision,
      })) ?? [],
    controls,
    proposedAspects: proposals,
    explicitlyIncrementedAspectIds,
  } as const;
}

function aspect(aspects: readonly AcceptedAspectRecord[], name: string): AcceptedAspectRecord {
  const found = aspects.find(({ aspectName }) => aspectName === name);
  if (found === undefined) throw new Error(`Missing aspect ${name}.`);
  return found;
}

function requiredAspect(
  byId: ReadonlyMap<string, AcceptedAspectRecord>,
  aspectId: string,
): AcceptedAspectRecord {
  const found = byId.get(aspectId);
  if (found === undefined) throw new Error(`Missing accepted aspect ${aspectId}.`);
  return found;
}

function requiredFixture(): PhysicalFixture {
  if (fixture === undefined) throw new Error('Physical integration fixture was not created.');
  return fixture;
}

function required<Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false },
): Value {
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.value;
}
