import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { TopQueryDto } from './dto.js';

/**
 * Productivité des représentants, qualité de la base, provenance des fiches.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI CES OBJETS EXISTENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le classement des représentants existant ne dit qu'une chose : qui a apporté
 * le plus de fiches, depuis toujours. Il ne distingue pas un représentant qui
 * apporte 40 fiches dont 30 aboutissent d'un représentant qui en apporte 60
 * dont aucune, et il continue d'afficher en tête un représentant qui n'a rien
 * apporté depuis huit mois.
 *
 * La qualité de la base répond à la plainte inverse, venue des téléconseillers :
 * une part des numéros ne répond jamais ou n'existe pas. L'information est déjà
 * dans `CallOutcome` (UNREACHABLE, WRONG_NUMBER) ; il manquait seulement de la
 * remonter par représentant et par département, c'est à dire à l'endroit où
 * une décision peut être prise (reprendre une zone, rappeler un représentant).
 *
 * La provenance mesure ce qui entre HORS tournée terrain. `origin` est vide
 * pour l'écrasante majorité des fiches, et c'est justement la minorité
 * renseignée qui intéresse : elle chiffre l'apport des autres canaux.
 */
export class RepresentantProductivityQueryDto extends TopQueryDto {
  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: 3650,
    default: 90,
    description:
      'Ancienneté, en jours, au delà de laquelle un représentant sans nouvel ' +
      'apport est déclaré dormant. Le seuil est un paramètre parce qu’il dépend ' +
      'du rythme de la zone : trois mois de silence n’ont pas le même sens ' +
      'partout.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  dormantDays?: number;
}

export class RepresentantProductivityDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  departementName!: string;

  @ApiProperty({ type: Number })
  prospects!: number;

  @ApiProperty({ type: Number })
  methodObtained!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Méthodes obtenues rapportées aux prospects apportés, en pourcentage. ' +
      'Nul quand le dénominateur est vide : un taux calculé sur zéro observation n’existe pas, et le publier comme 0 le rendrait indistinguable d’un vrai 0 %.',
  })
  conversionRate!: number | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Dernier apport, à la date de saisie terrain.',
  })
  lastProspectAt!: string | null;

  @ApiProperty({
    type: Boolean,
    description: 'Aucun apport depuis le seuil demandé. Calculé en base, jamais côté client.',
  })
  dormant!: boolean;
}

export class RepresentantProductivityListDto {
  @ApiProperty({ type: () => [RepresentantProductivityDto] })
  items!: RepresentantProductivityDto[];

  @ApiProperty({
    type: Number,
    description:
      'Prospects apportés par TOUS les représentants du périmètre filtré, et non ' +
      'seulement par les `items` rendus. `items` est tronqué par `limit` : sommer ' +
      'ses lignes donnerait le total du haut de classement sous un nom qui se lit ' +
      'comme un total de population.',
  })
  total!: number;

  @ApiProperty({ type: Number, description: 'Seuil de dormance retenu, en jours.' })
  dormantDays!: number;
}

export class DataQualityRowDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({ type: Number, description: 'Tentatives d’appel observées.' })
  attempts!: number;

  @ApiProperty({ type: Number })
  unreachable!: number;

  @ApiProperty({ type: Number })
  wrongNumber!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Part des tentatives injoignables ou erronées, en pourcentage. ' +
      'Nul quand le dénominateur est vide : un taux calculé sur zéro observation n’existe pas, et le publier comme 0 le rendrait indistinguable d’un vrai 0 %.',
  })
  badRate!: number | null;
}

export class DataQualityDto {
  @ApiProperty({
    type: () => [DataQualityRowDto],
    description: 'Par représentant apporteur de la fiche appelée.',
  })
  representants!: DataQualityRowDto[];

  @ApiProperty({
    type: () => [DataQualityRowDto],
    description: 'Par département de rattachement du représentant.',
  })
  departements!: DataQualityRowDto[];

  @ApiProperty({ type: Number, description: 'Tentatives observées, toutes lignes confondues.' })
  attempts!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Part globale de numéros inexploitables, en %. ' +
      'Nul quand le dénominateur est vide : un taux calculé sur zéro observation n’existe pas, et le publier comme 0 le rendrait indistinguable d’un vrai 0 %.',
  })
  badRate!: number | null;
}

export class OriginCountDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Clé de provenance. Nulle pour une fiche née d’une tournée terrain.',
  })
  origin!: string | null;

  @ApiProperty({ description: 'Libellé prêt à afficher.' })
  label!: string;

  @ApiProperty({ type: Number })
  prospects!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Part du total filtré, en pourcentage. ' +
      'Nul quand le dénominateur est vide : un taux calculé sur zéro observation n’existe pas, et le publier comme 0 le rendrait indistinguable d’un vrai 0 %.',
  })
  share!: number | null;
}

export class OriginLabelCountDto extends OriginCountDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Détail conservé à la création (nom de la banque demandeuse, par exemple).',
  })
  originLabel!: string | null;
}

export class OriginBreakdownDto {
  @ApiProperty({ type: () => [OriginCountDto], description: 'Premier niveau : la provenance.' })
  items!: OriginCountDto[];

  @ApiProperty({
    type: () => [OriginLabelCountDto],
    description: 'Second niveau : le détail lisible, à provenance égale.',
  })
  byLabel!: OriginLabelCountDto[];

  @ApiProperty({ type: Number })
  total!: number;
}
