import { ApiProperty } from '@nestjs/swagger';

/**
 * L'entonnoir complet — du prospect à l'argent encaissé.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI CET OBJET EXISTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le tableau de bord ne montrait que la prospection : combien de prospects,
 * combien de représentants, combien de téléconseillers. Autrement dit l'effort,
 * jamais le résultat.
 *
 * Or la chaîne ne s'arrête pas là. Elle va :
 *
 *   prospect saisi
 *     → méthode d'enrôlement obtenue        (phase 2)
 *       → dossier bancaire ouvert           (Banque & Finance)
 *         → dossier ENCAISSÉ                ← la seule étape qui rapporte
 *
 * Une direction qui ne voit que le haut de l'entonnoir pilote à l'aveugle :
 * elle peut féliciter une équipe qui saisit beaucoup et ne convertit rien.
 *
 * Les montants sont exposés en CHAÎNE : XOF est stocké en `Decimal(18,0)` et
 * un entier JSON perd de la précision au-delà de 2^53. Six milliards de francs
 * passent encore, mais le format ne doit pas dépendre de la taille du chiffre.
 */
export class FunnelStageDto {
  @ApiProperty({ description: 'Nom de l’étape, prêt à afficher.' })
  label!: string;

  @ApiProperty({ type: Number })
  count!: number;

  @ApiProperty({
    type: Number,
    description:
      'Part de l’étape précédente, en pourcentage. Vaut 100 pour la première. ' +
      'C’est le taux qui montre OÙ la chaîne se casse, et non le taux global qui ' +
      'noie la marche défaillante dans la moyenne.',
  })
  tauxEtapePrecedente!: number;

  @ApiProperty({
    type: Number,
    description: 'Part du sommet de l’entonnoir, en pourcentage.',
  })
  tauxGlobal!: number;
}

export class AnalyticsFinanceDto {
  // ── Argent ────────────────────────────────────────────────────────────────

  @ApiProperty({
    type: String,
    description: 'Total encaissé, en francs CFA. Chaîne : XOF est un Decimal(18,0).',
    example: '22000000',
  })
  montantEncaisse!: string;

  @ApiProperty({
    type: String,
    description: 'Montant des dossiers encore ouverts, à l’instant. Chaîne.',
    example: '0',
  })
  montantEnCours!: string;

  @ApiProperty({
    type: String,
    description: 'Encaissement moyen par dossier encaissé. Chaîne.',
    example: '3142857',
  })
  encaissementMoyen!: string;

  @ApiProperty({
    type: String,
    description: 'Total encaissé sur les 30 derniers jours. Chaîne.',
    example: '8500000',
  })
  montantEncaisse30Jours!: string;

  // ── Dossiers ──────────────────────────────────────────────────────────────

  @ApiProperty({ type: Number }) dossiers!: number;
  @ApiProperty({ type: Number, description: 'Dossiers encore ouverts.' }) dossiersOuverts!: number;
  @ApiProperty({ type: Number }) dossiersEncaisses!: number;
  @ApiProperty({ type: Number }) dossiersRejetes!: number;

  @ApiProperty({
    type: Number,
    description:
      'Part des dossiers clos qui ont été rejetés, en pourcentage. Calculée sur ' +
      'les dossiers CLOS et non sur tous : inclure les dossiers en cours ferait ' +
      'baisser le taux simplement parce qu’on ouvre des dossiers.',
  })
  tauxRejet!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Délai moyen en jours entre l’ouverture d’un dossier et son issue. Nul ' +
      'tant qu’aucun dossier n’est clos.',
  })
  delaiMoyenJours!: number | null;
}

export class AnalyticsFunnelDto {
  @ApiProperty({
    type: () => [FunnelStageDto],
    description: 'Les quatre étapes, du prospect saisi au dossier encaissé.',
  })
  etapes!: FunnelStageDto[];

  @ApiProperty({ type: () => AnalyticsFinanceDto })
  finance!: AnalyticsFinanceDto;
}
