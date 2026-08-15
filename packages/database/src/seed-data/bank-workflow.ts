/**
 * Workflow Banque & Finance : état initial.
 *
 * Les trois étapes marquées `isSystem` portent des règles financières fixes et
 * ne peuvent être ni supprimées ni désactivées par l'admin :
 *   - l'étape initiale est le point d'entrée de tout dossier ;
 *   - « Encaissé » exige un montant strictement positif ;
 *   - « Rejeté » force le montant à zéro et exige un motif.
 *
 * Seules les étapes OPEN intermédiaires sont configurables : ajout, renommage,
 * réordonnancement, désactivation.
 *
 * Les couleurs sont des rôles du design system (docs/design.md), pas des hex :
 * changer la palette ne doit pas demander une migration de données.
 */

export interface BankStageSeed {
  code: string;
  label: string;
  position: number;
  color: string;
  type: 'OPEN' | 'CASHED' | 'REJECTED';
  isInitial: boolean;
  isSystem: boolean;
}

export const BANK_STAGES: readonly BankStageSeed[] = [
  {
    code: 'A_TRAITER',
    label: 'À traiter',
    position: 1,
    color: 'info',
    type: 'OPEN',
    isInitial: true,
    isSystem: true,
  },
  {
    code: 'EN_TRAITEMENT_BANQUE',
    label: 'En traitement banque',
    position: 2,
    color: 'warning',
    type: 'OPEN',
    isInitial: false,
    isSystem: false,
  },
  {
    code: 'ENCAISSE',
    label: 'Encaissé',
    position: 100,
    color: 'success',
    type: 'CASHED',
    isInitial: false,
    isSystem: true,
  },
  {
    code: 'REJETE',
    label: 'Rejeté',
    position: 101,
    color: 'destructive',
    type: 'REJECTED',
    isInitial: false,
    isSystem: true,
  },
] as const;

/**
 * Motifs de rejet : référentiel plutôt que texte libre.
 *
 * Le tableau de bord affiche une répartition des motifs : sur du texte saisi à
 * la main, ce graphique serait illisible dès la centième ligne. Le champ
 * `rejectionDetail` du dossier reste disponible pour la précision libre, et
 * « Autre » l'exige.
 */
export interface BankRejectionReasonSeed {
  code: string;
  label: string;
  sortOrder: number;
}

export const BANK_REJECTION_REASONS: readonly BankRejectionReasonSeed[] = [
  { code: 'SOLDE_INSUFFISANT', label: 'Solde insuffisant', sortOrder: 1 },
  { code: 'DOCUMENT_MANQUANT', label: 'Document manquant', sortOrder: 2 },
  { code: 'DOCUMENT_NON_CONFORME', label: 'Document non conforme', sortOrder: 3 },
  { code: 'CLIENT_INJOIGNABLE', label: 'Client injoignable', sortOrder: 4 },
  { code: 'REFUS_CLIENT', label: 'Refus du client', sortOrder: 5 },
  { code: 'REFUS_BANQUE', label: 'Refus de la banque', sortOrder: 6 },
  { code: 'COMPTE_CLOTURE', label: 'Compte clôturé', sortOrder: 7 },
  { code: 'IDENTITE_NON_CONFORME', label: 'Identité non conforme', sortOrder: 8 },
  { code: 'DOSSIER_DOUBLON', label: 'Dossier en doublon', sortOrder: 9 },
  { code: 'AUTRE', label: 'Autre motif', sortOrder: 900 },
] as const;
