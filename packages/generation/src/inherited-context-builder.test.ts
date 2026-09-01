import { createPlanetPoint } from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import {
  buildInheritedContext,
  buildInheritedContextFromAcceptedSource,
  INHERITED_CONTEXT_BUILDER_DIAGNOSTIC_CODES,
} from './inherited-context-builder.js';
import {
  emptyWorldDocument,
  inheritedContextBuilderFixture,
  withLabelPlacementDecoration,
} from './inherited-context-builder-test-support.js';

describe('accepted inherited-context builder', () => {
  it('assembles the complete immutable version-1 snapshot deterministically', () => {
    const fixture = inheritedContextBuilderFixture(required(createPlanetPoint(0, 0)));
    const first = build(fixture);
    const reordered = build({
      ...fixture,
      source: {
        ...fixture.source,
        acceptedNameAspects: [...fixture.source.acceptedNameAspects].reverse(),
      },
    });
    const withDecoration = build({
      ...fixture,
      source: withLabelPlacementDecoration(fixture.source),
    });

    expect(first).toStrictEqual(reordered);
    expect(first).toStrictEqual(withDecoration);
    expect(first.contractVersion).toBe(1);
    expect(
      first.fields.map(({ fieldKind, component }) => `${fieldKind}/${component}`),
    ).toStrictEqual([
      'biome-belts/value',
      'climate-zones/value',
      'land-water-classification/value',
      'macro-elevation/value',
      'moisture/value',
      'prevailing-winds-direction/x',
      'prevailing-winds-direction/y',
      'prevailing-winds-direction/z',
      'prevailing-winds-speed/speed',
      'temperature/value',
      'watershed-assignment/value',
    ]);
    expect(first.fields.every(({ samples }) => samples.length > 0)).toBe(true);
    expect(
      first.fields.every(({ samples }) =>
        samples.every(
          (sample, index) => sample.sampleIndex === first.fields[0]?.samples[index]?.sampleIndex,
        ),
      ),
    ).toBe(true);
    expect(first.geometryAnchors.map(({ anchorKind }) => anchorKind).sort()).toStrictEqual([
      'biome-belt',
      'coastline',
      'major-lake',
      'major-river',
      'mountain-system',
      'watershed-divide',
    ]);
    expect(first.boundaryPortals.length).toBeGreaterThanOrEqual(10);
    expect(first.namedAnchors).toHaveLength(7);
    expect(first.sourceAspectVersions.map(({ sourceAspectId }) => sourceAspectId)).toStrictEqual(
      [...first.sourceAspectVersions.map(({ sourceAspectId }) => sourceAspectId)].sort(),
    );
    expect(first.semanticChecksum.value).toMatch(/^[0-9a-f]{64}$/u);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.fields[0]?.samples)).toBe(true);
  });

  it('rejects missing accepted names, unsafe collars, and non-atlas documents stably', () => {
    const fixture = inheritedContextBuilderFixture(required(createPlanetPoint(0, 0)));
    const missingName = buildInheritedContextFromAcceptedSource(
      {
        ...fixture.source,
        acceptedNameAspects: fixture.source.acceptedNameAspects.slice(1),
      },
      fixture.footprint,
      1_000,
    );
    expect(code(missingName)).toBe(INHERITED_CONTEXT_BUILDER_DIAGNOSTIC_CODES.nameSourceInvalid);

    const unsafe = buildInheritedContextFromAcceptedSource(
      fixture.source,
      fixture.footprint,
      Number.MAX_SAFE_INTEGER,
    );
    expect(code(unsafe)).toBe(INHERITED_CONTEXT_BUILDER_DIAGNOSTIC_CODES.collarInvalid);

    const invalidDocument = buildInheritedContext({
      document: emptyWorldDocument(fixture.source.rootMap),
      footprint: fixture.footprint,
      collarPaddingMillimeters: 1_000,
      acceptedNameAspects: fixture.source.acceptedNameAspects,
    });
    expect(code(invalidDocument)).toBe(
      INHERITED_CONTEXT_BUILDER_DIAGNOSTIC_CODES.acceptedStateInvalid,
    );
  });

  it('retains a watershed name from assignment samples when its divide misses the collar', () => {
    const fixture = inheritedContextBuilderFixture(required(createPlanetPoint(0, 0)));
    const remoteDivide = [
      required(createPlanetPoint(Math.PI - 0.1, 0)),
      required(createPlanetPoint(Math.PI - 0.05, 0.01)),
    ];
    const snapshot = build({
      ...fixture,
      source: {
        ...fixture.source,
        physical: {
          ...fixture.source.physical,
          watersheds: {
            ...fixture.source.physical.watersheds,
            watersheds: fixture.source.physical.watersheds.watersheds.map((watershed) => ({
              ...watershed,
              divideLines: [remoteDivide],
            })),
          },
        },
      },
    });

    expect(
      snapshot.geometryAnchors.some(({ anchorKind }) => anchorKind === 'watershed-divide'),
    ).toBe(false);
    expect(snapshot.namedAnchors.some(({ nameKind }) => nameKind === 'watershed')).toBe(true);
  });

  it.each([
    ['horizontal seam', required(createPlanetPoint(-Math.PI, 0)), 1_000],
    ['exact north pole', required(createPlanetPoint(0, Math.PI / 2)), 1_000],
    ['near north pole', required(createPlanetPoint(0, Math.PI / 2 - 0.001)), 1_100_000],
  ])('builds approved %s context with canonical field anchors', (_label, origin, padding) => {
    const fixture = inheritedContextBuilderFixture(origin);
    const result = buildInheritedContextFromAcceptedSource(
      fixture.source,
      fixture.footprint,
      padding,
    );
    if (result.status !== 'built') throw new Error(JSON.stringify(result.diagnostics));
    const snapshot = result.snapshot;

    expect(snapshot.fields[0]?.samples.length).toBeGreaterThan(0);
    expect(snapshot.boundaryPortals.length).toBeGreaterThan(0);
    expect(snapshot.semanticChecksum.value).toMatch(/^[0-9a-f]{64}$/u);
  });
});

function build(fixture: ReturnType<typeof inheritedContextBuilderFixture>) {
  const result = buildInheritedContextFromAcceptedSource(fixture.source, fixture.footprint, 1_000);
  if (result.status !== 'built') throw new Error(JSON.stringify(result.diagnostics));
  return result.snapshot;
}

function code(result: ReturnType<typeof buildInheritedContextFromAcceptedSource>) {
  return result.status === 'invalid' ? result.diagnostics[0]?.code : undefined;
}

function required<Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false },
): Value {
  if (!result.ok) throw new Error('Invalid test setup value.');
  return result.value;
}
