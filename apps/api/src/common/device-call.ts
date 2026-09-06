import { ApiProperty } from '@nestjs/swagger';
import type { Prisma } from '@crm/database';

/// Ce que le journal d'appels Android rapporte pour une tentative lancée depuis
/// une fiche. Vocabulaire du mobile, jamais dérivé d'un numéro hors CRM.
export const DEVICE_CALL_TYPES = [
  'sortant',
  'entrant',
  'manque',
  'rejete',
  'bloque',
  'messagerie',
  'externe',
  'inconnu',
] as const;

export type DeviceCallType = (typeof DEVICE_CALL_TYPES)[number];

export const DEVICE_CALL_MAX_DURATION_SECONDS = 24 * 3600;

/** Le même vocabulaire, tel qu'il se lit dans une notification. */
export const DEVICE_CALL_LABELS: Record<DeviceCallType, string> = {
  sortant: 'sortant',
  entrant: 'entrant',
  manque: 'manqué',
  rejete: 'rejeté',
  bloque: 'bloqué',
  messagerie: 'vers la messagerie',
  externe: 'externe',
  inconnu: 'de type inconnu',
};

/** Écart toléré entre l'heure du journal d'appels et celle de la tentative. */
const DETECTION_MATCH_MS = 120_000;

/**
 * Délai laissé au téléconseiller pour consigner un appel qu'il vient de passer.
 * Au-delà, la détection reste orpheline et alimente l'alerte de supervision.
 */
const DETECTION_LOOKAHEAD_MS = 2 * 60 * 60 * 1000;

interface Borne {
  gte: Date;
  lte: Date;
}

/**
 * La tentative qui consigne un appel détecté à `deviceCallAt` : même heure au
 * journal, ou saisie dans les deux heures qui suivent l'appel. Se pose en `OR`
 * sur `call_attempts` comme sur `rep_call_attempts`.
 */
export const fenetreTentative = (
  deviceCallAt: Date,
): ({ deviceCallAt: Borne } | { clientCreatedAt: Borne })[] => [
  {
    deviceCallAt: {
      gte: new Date(deviceCallAt.getTime() - DETECTION_MATCH_MS),
      lte: new Date(deviceCallAt.getTime() + DETECTION_MATCH_MS),
    },
  },
  {
    clientCreatedAt: {
      gte: deviceCallAt,
      lte: new Date(deviceCallAt.getTime() + DETECTION_LOOKAHEAD_MS),
    },
  },
];

export interface RattachementTentative {
  performedById: string;
  representantId?: string;
  prospectId?: string;
  attemptId: string;
  clientCreatedAt: Date;
  deviceCallAt?: Date | null;
}

/**
 * Rattache à une tentative qu'on vient d'écrire les appels que le téléphone
 * avait déjà remontés pour la même fiche. Sans ce geste, un appel consigné
 * après coup resterait compté comme non consigné.
 */
export async function rattacherDetections(
  tx: Prisma.TransactionClient,
  lien: RattachementTentative,
): Promise<number> {
  const fenetres: Prisma.DeviceCallDetectionWhereInput[] = [
    {
      deviceCallAt: {
        gte: new Date(lien.clientCreatedAt.getTime() - DETECTION_LOOKAHEAD_MS),
        lte: lien.clientCreatedAt,
      },
    },
  ];
  if (lien.deviceCallAt) {
    fenetres.push({
      deviceCallAt: {
        gte: new Date(lien.deviceCallAt.getTime() - DETECTION_MATCH_MS),
        lte: new Date(lien.deviceCallAt.getTime() + DETECTION_MATCH_MS),
      },
    });
  }

  const { count } = await tx.deviceCallDetection.updateMany({
    where: {
      performedById: lien.performedById,
      attemptId: null,
      ...(lien.representantId === undefined ? {} : { representantId: lien.representantId }),
      ...(lien.prospectId === undefined ? {} : { prospectId: lien.prospectId }),
      OR: fenetres,
    },
    data: { attemptId: lien.attemptId },
  });
  return count;
}

export class DeviceCallDetectionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;

  @ApiProperty({ format: 'uuid', description: 'Le compte dont le téléphone a relevé l’appel.' })
  performedById!: string;

  @ApiProperty({ description: 'Nom du téléconseiller.' }) performedByName!: string;

  @ApiProperty({ enum: DEVICE_CALL_TYPES }) deviceCallType!: string;

  @ApiProperty({ type: Number, description: 'Durée en secondes lue au journal d’appels.' })
  deviceCallDurationSeconds!: number;

  @ApiProperty({
    format: 'date-time',
    description: 'Heure de l’appel, telle que le journal la donne.',
  })
  deviceCallAt!: string;

  @ApiProperty({
    format: 'date-time',
    description: 'Heure à laquelle le téléphone a relevé l’appel.',
  })
  detectedAt!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'La tentative qui consigne cet appel. `null` : appel non consigné.',
  })
  attemptId!: string | null;
}

export class DeviceCallDetectionListDto {
  @ApiProperty({
    type: () => [DeviceCallDetectionDto],
    description: 'Du plus récent au plus ancien.',
  })
  items!: DeviceCallDetectionDto[];
}

/** Les appels relevés sur une fiche, du plus récent au plus ancien. */
export async function listerDetections(
  prisma: Prisma.TransactionClient,
  cible: { representantId: string } | { prospectId: string },
): Promise<DeviceCallDetectionListDto> {
  const rows = await prisma.deviceCallDetection.findMany({
    where: cible,
    orderBy: [{ deviceCallAt: 'desc' }, { id: 'desc' }],
    take: 100,
    select: {
      id: true,
      performedById: true,
      deviceCallType: true,
      deviceCallDurationSeconds: true,
      deviceCallAt: true,
      detectedAt: true,
      attemptId: true,
      performedBy: { select: { fullName: true } },
    },
  });

  return {
    items: rows.map((row) => ({
      id: row.id,
      performedById: row.performedById,
      performedByName: row.performedBy.fullName,
      deviceCallType: row.deviceCallType,
      deviceCallDurationSeconds: row.deviceCallDurationSeconds,
      deviceCallAt: row.deviceCallAt.toISOString(),
      detectedAt: row.detectedAt.toISOString(),
      attemptId: row.attemptId,
    })),
  };
}
