import {
  type AcceptedAspectRecord,
  ASPECT_DEPENDENCY_PROVENANCE_KINDS,
  ATLAS_PHYSICAL_DOCUMENT_COMMAND_KIND,
  ATLAS_PHYSICAL_DOCUMENT_OPERATION_MODES,
  collectWorldFeatureNameSources,
  commitAtlasPhysicalProposal,
  computeInheritedContextSemanticChecksum,
  createAspectDependencyGraph,
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
  type WorldDocument,
  type WorldFeatureNameContent,
  type WorldFeatureNameParameters,
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

describe('accepted M3 physical atlas integration', () => {
  beforeAll(async () => {
    const m2 = await commitGeneratedAtlas('initial-atlas');
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
    const supplied = withSuppliedPoleContext(physical.document);
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
});

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
