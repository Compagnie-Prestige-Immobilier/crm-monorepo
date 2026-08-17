import { ApiProperty } from '@nestjs/swagger';

import { DEMO_EXEMPTIONS_SENTENCE } from '../../common/decorators/demo-writable.decorator.js';

export class DemoCountsDto {
  @ApiProperty() users!: number;
  @ApiProperty() representants!: number;
  @ApiProperty() prospects!: number;
  @ApiProperty() campaigns!: number;
  // Sans intérêt pour l'interface, compté pour que la somme des compteurs égale le registre :
  // c'est ce qui prouve qu'aucune entité n'a été créée sans être tracée.
  @ApiProperty() campaignCommerciaux!: number;
  @ApiProperty() callTasks!: number;
  @ApiProperty() callAttempts!: number;
  @ApiProperty() bankCases!: number;
  @ApiProperty() bankCaseTransitions!: number;
}

export class DemoStatusDto {
  @ApiProperty({
    description:
      'Vrai si des données de démonstration sont actuellement en place ET visibles. ' +
      'ATTENTION, ce booléen a une SECONDE conséquence, que l’interface doit annoncer ' +
      'avant la bascule : tant qu’il vaut vrai, la plateforme est en LECTURE SEULE. ' +
      'Toute requête POST, PATCH, PUT ou DELETE est refusée en 409 avec le code ' +
      '`DEMO_MODE_READ_ONLY`. Restent ouvertes, et ce sont les seules : ' +
      `${DEMO_EXEMPTIONS_SENTENCE}. ` +
      'Les lignes créées par ces chemins sont du travail RÉEL : elles sont écrites ' +
      '`isDemo: false` et survivent à l’extinction.',
  })
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
