import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { RepCallOutcome, RepresentantRelation, WhatsappStatus } from '@crm/database';

import {
  DEVICE_CALL_MAX_DURATION_SECONDS,
  DEVICE_CALL_TYPES,
  type DeviceCallType,
} from '../../common/device-call.js';

import { COMMENT_MAX_LENGTH } from '../phase2/attempt-rules.js';
import { PROFESSION_MAX_LENGTH, RepresentantLookupDto } from '../representants/dto.js';

export class CreateRepCallAttemptDto {
  @ApiProperty({
    format: 'uuid',
    description: 'UUID v7 engendré par le client. Clé d’idempotence.',
  })
  @IsUUID()
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  representantId!: string;

  @ApiProperty({ enum: RepCallOutcome, enumName: 'RepCallOutcome' })
  @IsEnum(RepCallOutcome)
  outcome!: RepCallOutcome;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Statut de qualification recueilli. FACULTATIF : les versions déjà installées ne l’émettent pas, et un refus mettrait leur saisie en échec définitif. Quand il est présent, c’est lui qui commande l’issue enregistrée.',
  })
  @IsOptional()
  @IsUUID()
  statutQualificationId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Ouverture de fiche que cette qualification ferme. Le chronomètre se lit entre son `openedAt` et cette fermeture. Une ouverture inconnue, déjà fermée ou ouverte par un autre est ignorée : la tentative vient du terrain et ne se perd pas pour un verrou.',
  })
  @IsOptional()
  @IsUUID()
  ouvertureId?: string;

  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    maximum: 10_000,
    description: 'Fiches promises. Admis uniquement pour l’issue PROSPECTS_PROMISED.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  promisedProspects?: number;

  @ApiPropertyOptional({
    type: String,
    maxLength: COMMENT_MAX_LENGTH,
    description: 'Obligatoire et non vide si l’issue vaut OTHER.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(COMMENT_MAX_LENGTH)
  comment?: string;

  @ApiPropertyOptional({
    enum: RepresentantRelation,
    enumName: 'RepresentantRelation',
    description:
      'État de la relation tel que l’appel vient de l’apprendre. Absent : le statut ne bouge pas. Identique au statut courant : rien n’est écrit.',
  })
  @IsOptional()
  @IsEnum(RepresentantRelation)
  relationStatus?: RepresentantRelation;

  @ApiPropertyOptional({
    type: String,
    minLength: 6,
    maxLength: 40,
    description:
      'Numéro qu’un représentant qui refuse propose d’appeler à sa place. Saisie libre, normalisé par le serveur. Un numéro illisible refuse la tentative entière : le téléconseiller est sur l’écran au moment où il le tape.',
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  suggestedPhone?: string;

  @ApiPropertyOptional({
    type: String,
    maxLength: 120,
    description: 'Nom du contact suggéré, tel que dicté. Ignoré sans `suggestedPhone`.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  suggestedName?: string;

  @ApiPropertyOptional({
    type: String,
    maxLength: COMMENT_MAX_LENGTH,
    description: 'Ce que le représentant dit du contact. Ignoré sans `suggestedPhone`.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(COMMENT_MAX_LENGTH)
  suggestedNote?: string;

  @ApiPropertyOptional({
    enum: WhatsappStatus,
    enumName: 'WhatsappStatus',
    description:
      'Ce que l’appel apprend du canal WhatsApp. La question ne se pose qu’APRÈS l’engagement : NON_DEMANDE reste donc la réponse honnête tant qu’elle n’a pas été posée. Absent : l’état ne bouge pas.',
  })
  @IsOptional()
  @IsEnum(WhatsappStatus)
  whatsappStatus?: WhatsappStatus;

  @ApiPropertyOptional({
    type: String,
    minLength: 6,
    maxLength: 40,
    description:
      'Numéro WhatsApp DISTINCT du téléphone. Saisie libre, normalisé par le serveur. Admis avec le seul statut AUTRE_NUMERO.',
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  whatsappE164?: string;

  @ApiPropertyOptional({
    type: String,
    maxLength: PROFESSION_MAX_LENGTH,
    description: 'Profession, en texte libre. Chaîne vide : la valeur est effacée.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(PROFESSION_MAX_LENGTH)
  profession?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Script de qualification : l’établissement en fiche est-il confirmé. Faux avec `etablissement` renseigné remplace l’établissement courant.',
  })
  @IsOptional()
  @IsBoolean()
  etablissementConfirme?: boolean;

  @ApiPropertyOptional({
    type: String,
    maxLength: 200,
    description: 'Nouvel établissement, quand `etablissementConfirme` vaut faux.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  etablissement?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Script de qualification : le numéro en fiche est-il confirmé. Faux avec `phone` renseigné remplace le numéro courant, clé de déduplication comprise.',
  })
  @IsOptional()
  @IsBoolean()
  numeroConfirme?: boolean;

  @ApiPropertyOptional({
    type: String,
    minLength: 6,
    maxLength: 40,
    description:
      'Nouveau numéro du représentant, quand `numeroConfirme` vaut faux. Saisie libre, normalisé en E.164 par le serveur.',
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Script de qualification : le représentant déclare avoir déjà été contacté.',
  })
  @IsOptional()
  @IsBoolean()
  contacte?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Script de qualification : le représentant déclare connaître l’UES.',
  })
  @IsOptional()
  @IsBoolean()
  connaitUES?: boolean;

  @ApiPropertyOptional({
    type: String,
    maxLength: 200,
    description: 'Script de qualification : niveau de syndicat déclaré. Texte libre.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  syndicat?: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Horodatage de l’appel sur le terrain, distinct de son arrivée en base.',
  })
  @IsISO8601()
  clientCreatedAt!: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description:
      'Date du rappel promis. Obligatoire pour l’issue CALLBACK, admise avec toute autre : un représentant joint peut demander à être rappelé. C’est elle qui arme la notification côté mobile.',
  })
  @IsOptional()
  @IsISO8601()
  callbackAt?: string;

  @ApiPropertyOptional({
    enum: DEVICE_CALL_TYPES,
    description: 'Type lu dans le journal d’appels Android pour l’appel lancé depuis la fiche.',
  })
  @IsOptional()
  @IsIn(DEVICE_CALL_TYPES)
  deviceCallType?: DeviceCallType;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: DEVICE_CALL_MAX_DURATION_SECONDS,
    description: 'Durée en secondes lue dans le journal d’appels Android.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(DEVICE_CALL_MAX_DURATION_SECONDS)
  deviceCallDurationSeconds?: number;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Heure de l’appel lue dans le journal d’appels Android.',
  })
  @IsOptional()
  @IsISO8601()
  deviceCallAt?: string;
}

export enum RepCallAttemptApplyStatus {
  APPLIED = 'applied',
  DUPLICATE = 'duplicate',
}

export class RepCallAttemptResultDto {
  @ApiProperty({ enum: RepCallAttemptApplyStatus, enumName: 'RepCallAttemptApplyStatus' })
  status!: RepCallAttemptApplyStatus;

  @ApiProperty({ format: 'uuid' }) attemptId!: string;

  @ApiProperty({
    type: () => RepresentantLookupDto,
    nullable: true,
    description:
      'Ce que le numéro suggéré donne dans l’annuaire, dans la forme que la bannière de doublon du mobile sait déjà afficher. Nul si la tentative n’en portait pas.',
  })
  suggestion!: RepresentantLookupDto | null;
}
