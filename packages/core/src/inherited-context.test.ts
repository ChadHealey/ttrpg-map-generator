import { describe, expect, it } from 'vitest';

import {
  ATLAS_FULL_LATITUDE_BAND_COUNT,
  ATLAS_FULL_LONGITUDE_CELL_COUNT,
  atlasStorageIndex,
  computeInheritedContextSemanticChecksum,
  createPlanetPoint,
  createRegionalFootprintTransform,
  deriveRegionalFootprintEntityId,
  encodeInheritedContextSemanticChecksumInput,
  INHERITED_CONTEXT_DIAGNOSTIC_CODES,
  INHERITED_CONTEXT_SEMANTIC_CHECKSUM_ALGORITHM,
  INHERITED_CONTEXT_SEMANTIC_CHECKSUM_VERSION,
  type InheritedContextParseResult,
  type InheritedContextSnapshotContent,
  parseInheritedContextSnapshot,
  parseRegionalRectangleFootprint,
} from './index.js';

const ROOT_MAP_ID = '00000000-0000-4000-8000-000000000101';
const WORLD_ENTITY_ID = '00000000-0000-4000-8000-000000000201';
const WATERSHED_ENTITY_ID = '00000000-0000-4000-8000-000000000202';
const ROOT_SURFACE_ID = '00000000-0000-4000-8000-0000000002ab';
const PORTAL_ID = '00000000-0000-4000-8000-000000000401';
const FINGERPRINT = 'a'.repeat(64);

const ASPECT_IDS = {
  biome: '00000000-0000-4000-8000-000000000301',
  climate: '00000000-0000-4000-8000-000000000302',
  landWater: '00000000-0000-4000-8000-000000000303',
  macro: '00000000-0000-4000-8000-000000000304',
  moisture: '00000000-0000-4000-8000-000000000305',
  windDirection: '00000000-0000-4000-8000-000000000306',
  windSpeed: '00000000-0000-4000-8000-000000000307',
  temperature: '00000000-0000-4000-8000-000000000308',
  watershed: '00000000-0000-4000-8000-000000000309',
  coastline: '00000000-0000-4000-8000-00000000030a',
  name: '00000000-0000-4000-8000-00000000030b',
} as const;

describe('inherited-context domain contract', () => {
  it('round-trips one complete snapshot into owned recursively immutable domain state', () => {
    const input = validSnapshotInput();
    const parsed = required(parseInheritedContextSnapshot(input));

    expect(parsed).toStrictEqual(input);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.footprint)).toBe(true);
    expect(Object.isFrozen(parsed.fields)).toBe(true);
    expect(Object.isFrozen(parsed.fields[0]?.samples[0]?.rootPoint)).toBe(true);

    const mutable = input as MutableSnapshot;
    requiredItem(requiredItem(mutable.fields, 0).samples, 0).values[0] = 'changed';
    expect(parsed.fields[0]?.samples[0]?.values[0]).toBe('temperate-forest');
  });

  it('uses a deterministic domain-separated checksum independent of object property order', () => {
    const input = validSnapshotInput();
    const content = snapshotContent(input);
    const reordered = reverseRecordKeyOrder(content) as InheritedContextSnapshotContent;
    const first = computeInheritedContextSemanticChecksum(content);
    const second = computeInheritedContextSemanticChecksum(reordered);

    expect(first).toStrictEqual(second);
    expect(first.algorithm).toBe(INHERITED_CONTEXT_SEMANTIC_CHECKSUM_ALGORITHM);
    expect(first.checksumVersion).toBe(INHERITED_CONTEXT_SEMANTIC_CHECKSUM_VERSION);
    expect(first.value).toMatch(/^[0-9a-f]{64}$/);
    expect(
      new TextDecoder()
        .decode(encodeInheritedContextSemanticChecksumInput(content))
        .startsWith('ttrpg-map/inherited-context-semantic-checksum/v1\n'),
    ).toBe(true);
  });

  it('covers every top-level semantic category while excluding the checksum field itself', () => {
    const base = validSnapshotInput();
    const original = computeInheritedContextSemanticChecksum(snapshotContent(base)).value;
    const mutations: readonly ((input: MutableSnapshot) => void)[] = [
      (input) => {
        input.contractVersion = 2;
      },
      (input) => {
        input.rootMapId = '00000000-0000-4000-8000-000000000102';
      },
      (input) => {
        input.parentMapId = '00000000-0000-4000-8000-000000000102';
      },
      (input) => {
        input.footprintId = WORLD_ENTITY_ID;
      },
      (input) => {
        input.footprint.extent.maxXMillimeters += 1;
      },
      (input) => {
        input.rootRefinementNamespace.namespaceVersion = 2;
      },
      (input) => {
        input.collar.extent.maxXMillimeters += 1;
      },
      (input) => {
        requiredItem(input.sourceLineage, 0).sourceEntityId = WATERSHED_ENTITY_ID;
      },
      (input) => {
        requiredItem(input.sourceAspectVersions, 0).generatorVersion = 2;
      },
      (input) => {
        requiredItem(requiredItem(input.fields, 0).samples, 0).values[0] = 'tundra';
      },
      (input) => {
        requiredItem(input.geometryAnchors, 0).anchorKind = 'major-river';
      },
      (input) => {
        requiredItem(input.boundaryPortals, 0).portalKind = 'river';
      },
      (input) => {
        requiredItem(input.namedAnchors, 0).displayName = 'Other Reach';
      },
    ];

    for (const mutate of mutations) {
      const changed = structuredClone(base) as MutableSnapshot;
      mutate(changed);
      expect(computeInheritedContextSemanticChecksum(snapshotContent(changed)).value).not.toBe(
        original,
      );
    }

    const checksumOnly = structuredClone(base) as MutableSnapshot;
    checksumOnly.semanticChecksum.value = 'f'.repeat(64);
    expect(computeInheritedContextSemanticChecksum(snapshotContent(checksumOnly)).value).toBe(
      original,
    );
  });

  it('rejects missing, version-invalid, duplicate, misordered, and cross-map members', () => {
    const missing = structuredClone(validSnapshotInput());
    delete missing.fields;
    expectDiagnostic(
      parseInheritedContextSnapshot(missing),
      INHERITED_CONTEXT_DIAGNOSTIC_CODES.invalidRecord,
    );

    const version = structuredClone(validSnapshotInput()) as MutableSnapshot;
    version.contractVersion = 2;
    resign(version);
    expectDiagnostic(
      parseInheritedContextSnapshot(version),
      INHERITED_CONTEXT_DIAGNOSTIC_CODES.invalidVersion,
    );

    const duplicate = structuredClone(validSnapshotInput()) as MutableSnapshot;
    duplicate.sourceLineage.push(structuredClone(requiredItem(duplicate.sourceLineage, 0)));
    resign(duplicate);
    expectDiagnostic(
      parseInheritedContextSnapshot(duplicate),
      INHERITED_CONTEXT_DIAGNOSTIC_CODES.invalidOrdering,
    );

    const misordered = structuredClone(validSnapshotInput()) as MutableSnapshot;
    misordered.fields.reverse();
    resign(misordered);
    expectDiagnostic(
      parseInheritedContextSnapshot(misordered),
      INHERITED_CONTEXT_DIAGNOSTIC_CODES.invalidOrdering,
    );

    const crossMap = structuredClone(validSnapshotInput()) as MutableSnapshot;
    requiredItem(crossMap.fields, 0).sourceMapId = '00000000-0000-4000-8000-000000000102';
    resign(crossMap);
    expectDiagnostic(
      parseInheritedContextSnapshot(crossMap),
      INHERITED_CONTEXT_DIAGNOSTIC_CODES.invalidReference,
    );

    const malformedCollections = {
      boundaryPortals: INHERITED_CONTEXT_DIAGNOSTIC_CODES.invalidPortal,
      fields: INHERITED_CONTEXT_DIAGNOSTIC_CODES.invalidRecord,
      geometryAnchors: INHERITED_CONTEXT_DIAGNOSTIC_CODES.outsideCollar,
      namedAnchors: INHERITED_CONTEXT_DIAGNOSTIC_CODES.invalidRecord,
      sourceAspectVersions: INHERITED_CONTEXT_DIAGNOSTIC_CODES.invalidReference,
      sourceLineage: INHERITED_CONTEXT_DIAGNOSTIC_CODES.invalidReference,
    } as const;
    for (const [collection, code] of Object.entries(malformedCollections)) {
      const malformed = structuredClone(validSnapshotInput());
      malformed[collection] = [null];
      expect(() => parseInheritedContextSnapshot(malformed)).not.toThrow();
      expectDiagnostic(parseInheritedContextSnapshot(malformed), code);
    }
  });

  it('rejects mismatched atlas sample anchors and portal source aspects', () => {
    const mismatchedSample = structuredClone(validSnapshotInput()) as MutableSnapshot;
    requiredItem(requiredItem(mismatchedSample.fields, 0).samples, 0).sampleIndex += 1;
    resign(mismatchedSample);
    expectDiagnostic(
      parseInheritedContextSnapshot(mismatchedSample),
      INHERITED_CONTEXT_DIAGNOSTIC_CODES.invalidRecord,
    );

    const mismatchedPortal = structuredClone(validSnapshotInput()) as MutableSnapshot;
    requiredItem(mismatchedPortal.boundaryPortals, 0).portalKind = 'river';
    resign(mismatchedPortal);
    expectDiagnostic(
      parseInheritedContextSnapshot(mismatchedPortal),
      INHERITED_CONTEXT_DIAGNOSTIC_CODES.invalidReference,
    );
  });

  it('rejects points outside the collar and portals outside canonical perimeter order', () => {
    const outside = structuredClone(validSnapshotInput()) as MutableSnapshot;
    const footprint = required(parseRegionalRectangleFootprint(outside.footprint));
    const transform = createRegionalFootprintTransform(footprint);
    const outsideRoot = required(
      createPlanetPoint((2 * Math.PI) / ATLAS_FULL_LONGITUDE_CELL_COUNT, 0),
    );
    const outsideSampleIndex = atlasStorageIndex(
      ATLAS_FULL_LONGITUDE_CELL_COUNT / 2 + 1,
      ATLAS_FULL_LATITUDE_BAND_COUNT / 2,
    );
    for (const field of outside.fields) {
      const sample = requiredItem(field.samples, 0);
      sample.sampleIndex = outsideSampleIndex;
      sample.rootPoint = outsideRoot;
    }
    resign(outside);
    expectDiagnostic(
      parseInheritedContextSnapshot(outside),
      INHERITED_CONTEXT_DIAGNOSTIC_CODES.outsideCollar,
    );

    const portals = structuredClone(validSnapshotInput()) as MutableSnapshot;
    const eastLocal = { xMillimeters: 1_000, yMillimeters: 0 };
    const eastRoot = required(transform.inverse(eastLocal as never));
    portals.boundaryPortals.unshift({
      ...structuredClone(requiredItem(portals.boundaryPortals, 0)),
      portalId: '00000000-0000-4000-8000-000000000402',
      localPoint: eastLocal,
      rootPoint: eastRoot,
    });
    resign(portals);
    expectDiagnostic(
      parseInheritedContextSnapshot(portals),
      INHERITED_CONTEXT_DIAGNOSTIC_CODES.invalidOrdering,
    );
  });

  it('rejects a mismatched semantic checksum without treating it as a file or fixture hash', () => {
    const input = structuredClone(validSnapshotInput()) as MutableSnapshot;
    input.semanticChecksum.value = '0'.repeat(64);

    expectDiagnostic(
      parseInheritedContextSnapshot(input),
      INHERITED_CONTEXT_DIAGNOSTIC_CODES.checksumMismatch,
    );
  });
});

function validSnapshotInput(): Record<string, unknown> {
  const footprint = required(
    parseRegionalRectangleFootprint({
      shapeVersion: 'regional-rectangle-v1',
      rootSurfaceId: ROOT_SURFACE_ID,
      worldRadius: { radiusMillimeters: 1_000_000_000 },
      origin: { longitudeTicks: 0, latitudeTicks: 0 },
      extent: {
        minXMillimeters: -1_000,
        maxXMillimeters: 1_000,
        minYMillimeters: -1_000,
        maxYMillimeters: 1_000,
      },
      transformId: 'planet-regional-azimuthal-equidistant',
      transformVersion: 1,
    }),
  );
  const transform = createRegionalFootprintTransform(footprint);
  const portalLocal = { xMillimeters: -1_000, yMillimeters: -1_000 };
  const portalRoot = required(transform.inverse(portalLocal as never));
  const rootPoint = footprint.origin;
  const rootSampleIndex = atlasStorageIndex(
    ATLAS_FULL_LONGITUDE_CELL_COUNT / 2,
    ATLAS_FULL_LATITUDE_BAND_COUNT / 2,
  );
  const fieldDefinitions = [
    ['biome-belts', 'value', 'semantic-key', 'temperate-forest', ASPECT_IDS.biome],
    ['climate-zones', 'value', 'semantic-key', 'temperate', ASPECT_IDS.climate],
    ['land-water-classification', 'value', 'land-water-class', 'land', ASPECT_IDS.landWater],
    ['macro-elevation', 'value', 'integer-ticks', 100, ASPECT_IDS.macro],
    ['moisture', 'value', 'integer-ticks', 200, ASPECT_IDS.moisture],
    ['prevailing-winds-direction', 'x', 'integer-ticks', 1, ASPECT_IDS.windDirection],
    ['prevailing-winds-direction', 'y', 'integer-ticks', 2, ASPECT_IDS.windDirection],
    ['prevailing-winds-direction', 'z', 'integer-ticks', 3, ASPECT_IDS.windDirection],
    ['prevailing-winds-speed', 'speed', 'integer-ticks', 4, ASPECT_IDS.windSpeed],
    ['temperature', 'value', 'integer-ticks', 150, ASPECT_IDS.temperature],
    ['watershed-assignment', 'value', 'entity-id', WATERSHED_ENTITY_ID, ASPECT_IDS.watershed],
  ] as const;
  const aspectNames = new Map<string, string>([
    [ASPECT_IDS.biome, 'worldEcology.biomeBelts'],
    [ASPECT_IDS.climate, 'worldClimate.zones'],
    [ASPECT_IDS.landWater, 'worldSurface.landWaterClassification'],
    [ASPECT_IDS.macro, 'worldTerrain.macroElevation'],
    [ASPECT_IDS.moisture, 'worldClimate.moisture'],
    [ASPECT_IDS.windDirection, 'worldClimate.prevailingWinds'],
    [ASPECT_IDS.windSpeed, 'worldClimate.prevailingWinds'],
    [ASPECT_IDS.temperature, 'worldClimate.temperature'],
    [ASPECT_IDS.watershed, 'worldHydrology.watersheds'],
    [ASPECT_IDS.coastline, 'worldCoastline.geometry'],
    [ASPECT_IDS.name, 'worldFeature.nameContent'],
  ]);
  const content = {
    contractVersion: 1,
    rootMapId: ROOT_MAP_ID,
    parentMapId: ROOT_MAP_ID,
    footprintId: deriveRegionalFootprintEntityId(footprint),
    footprint,
    rootRefinementNamespace: {
      namespaceVersion: 1,
      rootSurfaceId: ROOT_SURFACE_ID,
      seedScope: 'root-coordinate',
    },
    collar: {
      collarVersion: 1,
      extent: {
        minXMillimeters: -2_000,
        maxXMillimeters: 2_000,
        minYMillimeters: -2_000,
        maxYMillimeters: 2_000,
      },
    },
    sourceLineage: [{ sourceMapId: ROOT_MAP_ID, sourceEntityId: WORLD_ENTITY_ID }],
    sourceAspectVersions: [...aspectNames]
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([sourceAspectId, aspectName]) => ({
        sourceMapId: ROOT_MAP_ID,
        sourceEntityId: WORLD_ENTITY_ID,
        sourceAspectId,
        aspectName,
        generatorVersion: 1,
        parameterSchemaVersion: 1,
        variantRevision: 0,
      })),
    fields: fieldDefinitions.map(
      ([fieldKind, component, valueEncoding, value, sourceAspectId]) => ({
        sourceMapId: ROOT_MAP_ID,
        sourceEntityId: WORLD_ENTITY_ID,
        sourceAspectId,
        fieldKind,
        component,
        valueEncoding,
        ...(fieldKind === 'macro-elevation' || fieldKind === 'land-water-classification'
          ? {}
          : { sourceFingerprint: FINGERPRINT }),
        samples: [{ sampleIndex: rootSampleIndex, rootPoint, values: [value] }],
      }),
    ),
    geometryAnchors: [
      {
        sourceMapId: ROOT_MAP_ID,
        sourceEntityId: WORLD_ENTITY_ID,
        sourceAspectId: ASPECT_IDS.coastline,
        sourceAnchorId: WORLD_ENTITY_ID,
        anchorKind: 'coastline',
        paths: [[rootPoint]],
      },
    ],
    boundaryPortals: [
      {
        portalId: PORTAL_ID,
        portalKind: 'coastline',
        sourceMapId: ROOT_MAP_ID,
        sourceEntityId: WORLD_ENTITY_ID,
        sourceAspectId: ASPECT_IDS.coastline,
        rootPoint: portalRoot,
        localPoint: portalLocal,
      },
    ],
    namedAnchors: [
      {
        sourceMapId: ROOT_MAP_ID,
        sourceEntityId: WORLD_ENTITY_ID,
        sourceAspectId: ASPECT_IDS.name,
        nameKind: 'landmass',
        displayName: 'Verdant Reach',
        nameContentBehaviorVersion: 1,
        lexiconVersion: 1,
        variantRevision: 0,
        origin: 'generated',
      },
    ],
  };
  return {
    ...content,
    semanticChecksum: computeInheritedContextSemanticChecksum(
      content as unknown as InheritedContextSnapshotContent,
    ),
  };
}

function snapshotContent(input: Record<string, unknown>): InheritedContextSnapshotContent {
  const { semanticChecksum: _semanticChecksum, ...content } = input;
  return content as unknown as InheritedContextSnapshotContent;
}

function resign(input: MutableSnapshot): void {
  input.semanticChecksum = computeInheritedContextSemanticChecksum(snapshotContent(input));
}

function reverseRecordKeyOrder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => reverseRecordKeyOrder(item));
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, item]) => [key, reverseRecordKeyOrder(item)]),
  );
}

function required<Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false },
): Value {
  if (!result.ok) throw new Error('Expected valid inherited-context test input.');
  return result.value;
}

function requiredItem<Value>(values: readonly Value[], index: number): Value {
  const value = values[index];
  if (value === undefined) throw new Error('Expected inherited-context test array item.');
  return value;
}

function expectDiagnostic(result: InheritedContextParseResult, code: string): void {
  if (result.ok) throw new Error('Expected inherited-context validation to fail.');
  expect(result.diagnostics.some((diagnostic) => diagnostic.code === code)).toBe(true);
}

interface MutableSnapshot extends Record<string, unknown> {
  contractVersion: number;
  rootMapId: string;
  parentMapId: string;
  footprintId: string;
  footprint: { extent: { maxXMillimeters: number } };
  rootRefinementNamespace: { namespaceVersion: number };
  collar: { extent: { maxXMillimeters: number } };
  sourceLineage: { sourceMapId: string; sourceEntityId: string }[];
  sourceAspectVersions: { generatorVersion: number }[];
  fields: {
    sourceMapId: string;
    samples: { rootPoint: unknown; sampleIndex: number; values: (string | number)[] }[];
  }[];
  geometryAnchors: { anchorKind: string }[];
  boundaryPortals: {
    portalId: string;
    portalKind: string;
    rootPoint: unknown;
    localPoint: { xMillimeters: number; yMillimeters: number };
  }[];
  namedAnchors: { displayName: string }[];
  semanticChecksum: { algorithm: string; checksumVersion: number; value: string };
}
