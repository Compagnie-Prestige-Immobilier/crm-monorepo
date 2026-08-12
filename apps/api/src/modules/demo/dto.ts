import { ApiProperty } from '@nestjs/swagger';

/** Décompte de ce que le mode démonstration a réellement créé. */
export class DemoCountsDto {
  @ApiProperty() users!: number;
  @ApiProperty() representants!: number;
  @ApiProperty() prospects!: number;
  @ApiProperty() campaigns!: number;
  /**
   * Rattachements commercial↔campagne. Sans intérêt pour l'interface, mais
   * compté quand même : l'invariant « le registre compte exactement autant de
   * lignes que la somme des compteurs » est ce qui garantit qu'aucune entité
   * n'a été créée sans être tracée — donc qu'aucune ne survivra à la
   * désactivation.
   */
  @ApiProperty() campaignCommerciaux!: number;
  @ApiProperty() callTasks!: number;
  @ApiProperty() callAttempts!: number;
  @ApiProperty() bankCases!: number;
  @ApiProperty() bankCaseTransitions!: number;
}

export class DemoStatusDto {
  @ApiProperty({ description: 'Vrai si des données de démonstration sont actuellement en place.' })
  enabled!: boolean;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Date du dernier ensemencement, nulle si le mode n’a jamais été activé.',
  })
  seededAt!: string | null;

  @ApiProperty({
    description:
      'Faux quand l’environnement interdit la bascule : en production, tant que ' +
      'DEMO_MODE_ALLOWED ne vaut pas true. L’interface doit afficher `reason`, ' +
      'pas se contenter de griser le bouton.',
  })
  canToggle!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Explication lisible quand canToggle est faux.',
  })
  reason!: string | null;

  @ApiProperty({ type: () => DemoCountsDto })
  counts!: DemoCountsDto;
}
