import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

/** Les écrans qui partagent le moteur de composition. */
export const DASHBOARD_ECRANS = ['visites', 'chues', 'grand-public'] as const;
export type DashboardEcran = (typeof DASHBOARD_ECRANS)[number];

/** Le registre des visites. */
const SOURCES_VISITES = [
  'total-visites',
  'moyenne-journaliere',
  'jour-le-plus-charge',
  'par-entreprise',
  'par-objet',
  'par-direction',
  'par-destinataire',
  'par-jour',
  'par-mois',
  'par-heure',
  'par-jour-semaine',
  'par-heure-jour-semaine',
  'par-agent',
  'par-entreprise-objet',
  'par-destinataire-direction',
  'par-objet-mois',
  'visiteurs-recurrents',
  'avec-telephone',
  'qualite-de-saisie',
] as const;

/**
 * La qualification des représentants : elle n'existe QUE dans CHUES, où un
 * enseignant relais donne les contacts de ses collègues.
 */
const SOURCES_QUALIFICATION = [
  'taux-de-contact',
  'taux-de-joignabilite-representants',
  'taux-d-acceptation',
  'taux-de-rappel',
  'repartition-statuts-qualification',
  'joints-non-joints',
  'statuts-par-famille',
  'joignabilite-par-creneau',
  'taux-d-exploitation',
  'exploitation-par-campagne',
  'representants-par-departement',
  'representants-par-ief',
  'representants-jamais-appeles',
  'representants-injoignables',
] as const;

/**
 * Le travail d'appel et la vente, communs à CHUES et au Grand Public.
 *
 * Volontairement COURTE : un écran de pilotage se lit d'un coup d'œil, et un
 * mur de tuiles ne se lit pas. Ajouter une source, c'est une entrée ici, une
 * règle de marque dans `dashboard-layout.ts` et un extracteur côté web.
 * `reste-a-appeler` n'a plus d'extracteur web (Plan.md D3 la redéfinira).
 */
const SOURCES_PROSPECTS = [
  'taux-de-joignabilite',
  'prospects-notes',
  'adhesions',
  'reste-a-appeler',
  'fiches-ouvertes',
  'taux-de-qualification',
  'duree-moyenne-sur-la-fiche',
  'duree-moyenne-de-communication',
  'appels-par-jour',
  'par-teleconseiller',
  'couverture-derniere-campagne',
  'hors-attribution-derniere-campagne',
  'encaisse',
  'de-l-appel-a-l-encaissement',
  'methodes-d-adhesion',
  'par-banque',
  'delais-medians',
  'rendement-par-departement',
] as const;

/**
 * La phase d'enrôlement, lue sur les plateformes externes. Elle ne parle qu'à
 * la cellule pilotage : le catalogue web la retire à tout rôle autre qu'ADMIN,
 * et l'API qui l'alimente refuse les autres rôles de son côté.
 */
const SOURCES_ENROLEMENT = [
  'enrolement-inscriptions',
  'enrolement-taux-rapprochement',
  'enrolement-taux-conversion',
  'enrolement-par-jour',
  'enrolement-par-etape',
  'enrolement-par-teleconseiller',
] as const;

export const DASHBOARD_SOURCES = [
  ...SOURCES_VISITES,
  ...SOURCES_QUALIFICATION,
  ...SOURCES_PROSPECTS,
  ...SOURCES_ENROLEMENT,
] as const;

export type DashboardSource = (typeof DASHBOARD_SOURCES)[number];

export const SOURCES_PAR_ECRAN: Record<DashboardEcran, readonly DashboardSource[]> = {
  visites: SOURCES_VISITES,
  chues: [...SOURCES_QUALIFICATION, ...SOURCES_PROSPECTS, ...SOURCES_ENROLEMENT],
  'grand-public': [...SOURCES_PROSPECTS, ...SOURCES_ENROLEMENT],
};

/**
 * Les montants ne s'offrent qu'à la direction. Ce n'est pas un cloisonnement :
 * `GET /api/v1/analytics/funnel` reste ouvert à la supervision. C'est un choix
 * d'écran, pour que le pilotage d'équipe parle d'appels et pas de recette.
 */
export const SOURCES_DIRECTION: readonly DashboardSource[] = [
  'encaisse',
  'de-l-appel-a-l-encaissement',
];

export const DASHBOARD_MARQUES = [
  'barres-verticales',
  'barres-horizontales',
  'barres-empilees',
  'barres-100',
  'barres-groupees',
  'courbe',
  'aire',
  'escalier',
  'anneau',
  'camembert',
  'aire-polaire',
  'radar',
  'nuage',
  'bulles',
  'mixte',
  'jauge',
  'carte-de-chaleur',
  'tableau',
  'tuile',
  'tuile-courbe',
] as const;

export type DashboardMarque = (typeof DASHBOARD_MARQUES)[number];

export const DASHBOARD_TAILLES = ['demi', 'pleine'] as const;
export type DashboardTaille = (typeof DASHBOARD_TAILLES)[number];

export const DASHBOARD_PRESETS = ['essentiel', 'affluence', 'organisation', 'complet'] as const;
export type DashboardPreset = (typeof DASHBOARD_PRESETS)[number];

@ValidatorConstraint({ name: 'uniqueDispositionSources', async: false })
export class UniqueDispositionSourcesConstraint implements ValidatorConstraintInterface {
  validate(widgets: unknown): boolean {
    if (!Array.isArray(widgets)) return true;
    const sources = new Set<string>();
    for (const widget of widgets as { source?: unknown }[]) {
      if (typeof widget.source === 'string') sources.add(widget.source);
    }
    return sources.size === widgets.length;
  }

  defaultMessage(): string {
    return 'Chaque source ne peut apparaître qu’une seule fois dans la disposition.';
  }
}

export class DispositionPresentationDto {
  @ApiPropertyOptional({ enum: ['neutre', 'serie', 'categorielle'] })
  @IsOptional()
  @IsIn(['neutre', 'serie', 'categorielle'])
  palette?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  valeurs?: boolean;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  legende?: boolean;

  @ApiPropertyOptional({ enum: ['valeur-desc', 'valeur-asc', 'alphabetique'] })
  @IsOptional()
  @IsIn(['valeur-desc', 'valeur-asc', 'alphabetique'])
  tri?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  autresApres?: number;
}

export class DispositionWidgetDto {
  @ApiProperty({ enum: DASHBOARD_SOURCES, enumName: 'DashboardSource' })
  @IsIn(DASHBOARD_SOURCES)
  source!: DashboardSource;

  @ApiPropertyOptional({ enum: DASHBOARD_MARQUES, enumName: 'DashboardMarque' })
  @IsOptional()
  @IsIn(DASHBOARD_MARQUES)
  marque?: DashboardMarque;

  @ApiPropertyOptional({ enum: DASHBOARD_TAILLES, enumName: 'DashboardTaille' })
  @IsOptional()
  @IsIn(DASHBOARD_TAILLES)
  taille?: DashboardTaille;

  @ApiPropertyOptional({ type: () => DispositionPresentationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DispositionPresentationDto)
  presentation?: DispositionPresentationDto;
}

export class UpdateDispositionDto {
  @ApiPropertyOptional({ enum: DASHBOARD_PRESETS, enumName: 'DashboardPreset' })
  @IsOptional()
  @IsIn(DASHBOARD_PRESETS)
  preset?: DashboardPreset;

  @ApiProperty({
    type: () => [DispositionWidgetDto],
    description:
      'Les éléments du tableau de bord. `version` est fixé par le serveur et refusé s’il est transmis.',
  })
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => DispositionWidgetDto)
  @Validate(UniqueDispositionSourcesConstraint)
  widgets!: DispositionWidgetDto[];
}

export class DispositionResponseDto {
  @ApiProperty({ type: () => [DispositionWidgetDto] }) widgets!: DispositionWidgetDto[];
  @ApiProperty({ enum: DASHBOARD_PRESETS, enumName: 'DashboardPreset' }) preset!: DashboardPreset;

  @ApiProperty({
    enum: ['utilisateur', 'defaut', 'usine'],
    description:
      'D’où vient la disposition rendue : la sienne, celle fixée par l’administrateur, ou celle d’usine.',
  })
  source!: 'utilisateur' | 'defaut' | 'usine';

  @ApiProperty({ type: String, format: 'date-time', nullable: true }) updatedAt!: string | null;
}
