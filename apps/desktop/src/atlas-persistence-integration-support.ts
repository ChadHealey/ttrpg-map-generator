import type { WorldDocument } from '@ttrpg-map/core';
import type { canonicalAspectBytes, MapworldPackage } from '@ttrpg-map/persistence';

export function reverseOrderInsensitiveCollections(document: WorldDocument): WorldDocument {
  const root = document.maps[0];
  if (root?.mapKind !== 'world') throw new Error('Missing root map.');
  return {
    ...document,
    maps: [
      {
        ...root,
        entities: [...root.entities].reverse(),
        aspects: [...root.aspects].reverse().map((aspect) => ({
          ...aspect,
          dependencyAspects: [...aspect.dependencyAspects].reverse(),
          diagnostics: [...aspect.diagnostics].reverse(),
        })),
        constraints: [...root.constraints].reverse(),
        locks: [...root.locks].reverse(),
        decoration: { aspectReferences: [...root.decoration.aspectReferences].reverse() },
        layout: { aspectReferences: [...root.layout.aspectReferences].reverse() },
      },
    ],
  };
}

export function reverseOrderInsensitiveAtlasOutput(aspectName: string, value: unknown): unknown {
  const output = value as Record<string, unknown>;
  switch (aspectName) {
    case 'landmass.classification':
      return {
        ...output,
        membership: reverseMembership(output.membership),
        adjacentWaterBodyIds: reversed(output.adjacentWaterBodyIds),
      };
    case 'islandGroup.classification':
      return output.kind === 'archipelago'
        ? { ...output, memberLandmassIds: reversed(output.memberLandmassIds) }
        : output;
    case 'waterBody.classification':
      return {
        ...output,
        membership: reverseMembership(output.membership),
        enclosedByLandmassIds: reversed(output.enclosedByLandmassIds),
        adjacentLandmassIds: reversed(output.adjacentLandmassIds),
        connectivity: reversed(output.connectivity),
      };
    case 'worldCoastline.geometry':
      return {
        ...output,
        rings: reversed(output.rings).map((ring) => ({
          ...(ring as Record<string, unknown>),
          waterBodyIds: reversed((ring as Record<string, unknown>).waterBodyIds),
        })),
      };
    case 'atlas.coastlineAppearance':
      return { ...output, ringDecisions: reversed(output.ringDecisions) };
    case 'atlas.waterDecoration':
      return {
        ...output,
        paths: reversed(output.paths).map((path) => ({
          ...(path as Record<string, unknown>),
          relatedSourceIds: reversed((path as Record<string, unknown>).relatedSourceIds),
        })),
      };
    default:
      return value;
  }
}

function reverseMembership(value: unknown): unknown {
  const membership = value as Record<string, unknown>;
  return { ...membership, sampleRanges: reversed(membership.sampleRanges) };
}

function reversed(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error('Expected an order-insensitive atlas collection.');
  return Array.from(value as readonly unknown[]).reverse();
}

export function mutateAspect(
  document: WorldDocument,
  aspectName: string,
  mutate: (
    aspect: WorldDocument['maps'][number]['aspects'][number],
  ) => WorldDocument['maps'][number]['aspects'][number],
): WorldDocument {
  const root = document.maps[0];
  if (root?.mapKind !== 'world') throw new Error('Missing root map.');
  return {
    ...document,
    maps: [
      {
        ...root,
        aspects: root.aspects.map((aspect) =>
          aspect.aspectName === aspectName ? mutate(aspect) : aspect,
        ),
      },
    ],
  };
}

export function equalPackages(left: MapworldPackage, right: MapworldPackage): boolean {
  return (
    left.files.length === right.files.length &&
    left.files.every((file, index) => {
      const other = right.files[index];
      return other?.path === file.path && equalBytes(file.bytes, other.bytes);
    })
  );
}

export function aspectBytes(result: ReturnType<typeof canonicalAspectBytes>): Uint8Array {
  return required(result);
}

export function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  return left.every((value, index) => value === right[index]);
}

export function required<Value>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly diagnostics: readonly unknown[] },
): Value {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}
