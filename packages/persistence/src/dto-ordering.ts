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
  return orderAtlasAspectDto({ ...dto, dependencyAspects, diagnostics });
}

function orderAtlasAspectDto(dto: AcceptedAspectDto): AcceptedAspectDto {
  switch (dto.aspectName) {
    case 'landmass.classification': {
      const output = dto.acceptedOutput as unknown as LandmassOutputDto;
      return {
        ...dto,
        acceptedOutput: {
          ...output,
          membership: orderMembership(output.membership),
          adjacentWaterBodyIds: [...output.adjacentWaterBodyIds].sort(compareText),
        },
      } as AcceptedAspectDto;
    }
    case 'islandGroup.classification': {
      const output = dto.acceptedOutput as unknown as IslandGroupOutputDto;
      return {
        ...dto,
        acceptedOutput: {
          ...output,
          memberLandmassIds:
            output.kind === 'archipelago'
              ? [...output.memberLandmassIds].sort(compareText)
              : output.memberLandmassIds,
        },
      };
    }
    case 'waterBody.classification': {
      const output = dto.acceptedOutput as unknown as WaterBodyOutputDto;
      return {
        ...dto,
        acceptedOutput: {
          ...output,
          membership: orderMembership(output.membership),
          enclosedByLandmassIds: [...output.enclosedByLandmassIds].sort(compareText),
          adjacentLandmassIds: [...output.adjacentLandmassIds].sort(compareText),
          connectivity: [...output.connectivity].sort((left, right) =>
            compareText(left.connectedWaterBodyId, right.connectedWaterBodyId),
          ),
        },
      } as AcceptedAspectDto;
    }
    case 'worldCoastline.geometry': {
      const output = dto.acceptedOutput as CoastlineOutputDto;
      return {
        ...dto,
        acceptedOutput: {
          ...output,
          rings: [...output.rings]
            .map((ring) => ({
              ...ring,
              waterBodyIds: [...ring.waterBodyIds].sort(compareText),
            }))
            .sort((left, right) => compareText(left.ringId, right.ringId)),
        },
      };
    }
    case 'atlas.coastlineAppearance': {
      const output = dto.acceptedOutput as unknown as CoastlineAppearanceOutputDto;
      return {
        ...dto,
        acceptedOutput: {
          ...output,
          ringDecisions: [...output.ringDecisions].sort((left, right) =>
            compareText(left.sourceRingId, right.sourceRingId),
          ),
        },
      } as AcceptedAspectDto;
    }
    case 'atlas.waterDecoration': {
      const output = dto.acceptedOutput as unknown as WaterDecorationOutputDto;
      return {
        ...dto,
        acceptedOutput: {
          ...output,
          paths: [...output.paths]
            .map((path) => ({
              ...path,
              relatedSourceIds: [...path.relatedSourceIds].sort(compareText),
            }))
            .sort((left, right) => compareText(left.decorationId, right.decorationId)),
        },
      } as AcceptedAspectDto;
    }
    default:
      return dto;
  }
}

function orderMembership(membership: MembershipDto): MembershipDto {
  return {
    ...membership,
    sampleRanges: [...membership.sampleRanges].sort(
      (left, right) =>
        left.startIndex - right.startIndex || left.endIndexExclusive - right.endIndexExclusive,
    ),
  };
}

interface MembershipDto {
  readonly classificationVersion: number;
  readonly fingerprint: string;
  readonly sampleCount: number;
  readonly sphericalAreaWeight: number;
  readonly sampleRanges: readonly {
    readonly startIndex: number;
    readonly endIndexExclusive: number;
  }[];
}

interface LandmassOutputDto {
  readonly entityId: string;
  readonly sourceClassificationAspectId: string;
  readonly componentId: string;
  readonly membership: MembershipDto;
  readonly kind: string;
  readonly containingWaterBodyId?: string;
  readonly adjacentWaterBodyIds: readonly string[];
}

interface IslandGroupOutputDto {
  readonly entityId: string;
  readonly kind: 'archipelago' | 'islandChain';
  readonly memberLandmassIds: readonly string[];
}

interface WaterBodyOutputDto {
  readonly entityId: string;
  readonly sourceClassificationAspectId: string;
  readonly componentId: string;
  readonly membership: MembershipDto;
  readonly kind: string;
  readonly enclosure: string;
  readonly enclosedByLandmassIds: readonly string[];
  readonly adjacentLandmassIds: readonly string[];
  readonly connectivity: readonly {
    readonly connectedWaterBodyId: string;
    readonly kind: 'open-marine-neck';
  }[];
}

interface CoastlineOutputDto {
  readonly geometryBehaviorVersion: number;
  readonly extractionAlgorithmVersion: number;
  readonly simplificationPolicyVersion: number;
  readonly simplificationToleranceTicks: number;
  readonly topologyValidationVersion: number;
  readonly winding: string;
  readonly repairPolicy: string;
  readonly rings: readonly {
    readonly ringId: string;
    readonly sourceBoundaryFingerprint: string;
    readonly landmassId: string;
    readonly waterBodyIds: readonly string[];
    readonly points: readonly { readonly longitudeTicks: number; readonly latitudeTicks: number }[];
  }[];
}

interface CoastlineAppearanceOutputDto {
  readonly appearanceBehaviorVersion: number;
  readonly style: Readonly<Record<string, unknown>>;
  readonly ringDecisions: readonly ({ readonly sourceRingId: string } & Readonly<
    Record<string, unknown>
  >)[];
}

interface WaterDecorationOutputDto {
  readonly decorationBehaviorVersion: number;
  readonly style: Readonly<Record<string, unknown>>;
  readonly paths: readonly ({
    readonly decorationId: string;
    readonly relatedSourceIds: readonly string[];
  } & Readonly<Record<string, unknown>>)[];
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
