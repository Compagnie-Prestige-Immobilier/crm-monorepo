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
