import { type AcceptedAspectDto } from './accepted-aspect-dto-schema.js';
import { type MapDocumentDto } from './map-document-dto-schema.js';
import { type MapworldManifestDto, type WorldIndexDto } from './package-dto-schemas.js';

export function orderManifestDto(dto: MapworldManifestDto): MapworldManifestDto {
  return {
    ...dto,
    authoritativeFiles: [...dto.authoritativeFiles].sort((left, right) =>
      compareAuthoritativePaths(left.path, right.path),
    ),
  };
}

export function orderWorldIndexDto(dto: WorldIndexDto): WorldIndexDto {
  return {
    ...dto,
    mapFiles: [...dto.mapFiles].sort((left, right) => {
      if (left.mapKind !== right.mapKind) return left.mapKind === 'world' ? -1 : 1;
      return compareText(left.mapId, right.mapId);
    }),
  };
}

export function orderMapDocumentDto(dto: MapDocumentDto): MapDocumentDto {
  return {
    ...dto,
    entities: [...dto.entities].sort((left, right) => compareText(left.entityId, right.entityId)),
    aspects: [...dto.aspects]
      .map(orderAcceptedAspectDto)
      .sort((left, right) => compareText(left.aspectId, right.aspectId)),
    constraints: [...dto.constraints].sort((left, right) =>
      compareText(left.constraintId, right.constraintId),
    ),
    locks: [...dto.locks].sort((left, right) => compareText(left.lockId, right.lockId)),
    decoration: {
      aspectReferences: [...dto.decoration.aspectReferences].sort((left, right) =>
        compareText(left.aspectId, right.aspectId),
      ),
    },
    layout: {
      aspectReferences: [...dto.layout.aspectReferences].sort((left, right) =>
        compareText(left.aspectId, right.aspectId),
      ),
    },
  };
}

export function orderAcceptedAspectDto(dto: AcceptedAspectDto): AcceptedAspectDto {
  const dependencyAspects = [...dto.dependencyAspects].sort((left, right) =>
    compareText(dependencyKey(left), dependencyKey(right)),
  );
  const diagnostics = [...dto.diagnostics].sort((left, right) =>
    compareText(diagnosticKey(left), diagnosticKey(right)),
  );
  if (dto.aspectName === 'proof.markers') {
    const output = dto.acceptedOutput as {
      readonly markers: readonly {
        readonly markerId: string;
        readonly position: { readonly longitudeTicks: number; readonly latitudeTicks: number };
      }[];
    };
    return {
      ...dto,
      dependencyAspects,
      diagnostics,
      acceptedOutput: {
        markers: [...output.markers].sort((left, right) =>
          compareText(left.markerId, right.markerId),
        ),
      },
    };
  }
  return { ...dto, dependencyAspects, diagnostics };
}

function dependencyKey(reference: AcceptedAspectDto['dependencyAspects'][number]): string {
  return [
    reference.aspectId,
    reference.contextProvenance?.kind ?? '',
    reference.contextProvenance?.parentMapId ?? '',
    reference.contextProvenance?.childMapId ?? '',
  ].join('\0');
}

function diagnosticKey(diagnostic: AcceptedAspectDto['diagnostics'][number]): string {
  return [
    diagnostic.target.aspectId,
    diagnostic.code,
    diagnostic.severity,
    diagnostic.message,
    diagnostic.suggestedAction,
  ].join('\0');
}

function compareAuthoritativePaths(left: string, right: string): number {
  if (left === 'world.json') return right === 'world.json' ? 0 : -1;
  if (right === 'world.json') return 1;
  return compareText(left, right);
}

function compareText(left: string, right: string): -1 | 0 | 1 {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
