export interface VisiteReferentielSeed {
  code: string;
  label: string;
  sortOrder: number;
}

/** Les quatre listes deroulantes du classeur, dans leur ordre d'origine. */
export const VISITE_ENTREPRISES: readonly VisiteReferentielSeed[] = [
  { code: 'CPI', label: 'CPI', sortOrder: 1 },
  { code: 'SANTARGILE', label: 'SANTARGILE', sortOrder: 2 },
  { code: 'MAKE_UP_ADDICTION', label: 'MAKE-UP ADDICTION', sortOrder: 3 },
] as const;

/** Services ET etages, melanges comme au classeur sous « DIRECTIONS &/OU NIVEAU ». */
export const VISITE_DIRECTIONS: readonly VisiteReferentielSeed[] = [
  { code: 'COMMERCIALE', label: 'COMMERCIALE', sortOrder: 1 },
  { code: 'FINANCE_COMPTABILITE', label: 'FINANCE & COMPTABILITE', sortOrder: 2 },
  { code: 'FONCIERE', label: 'FONCIERE', sortOrder: 3 },
  { code: 'GENERALE', label: 'GENERALE', sortOrder: 4 },
  { code: 'INFORMATIQUE', label: 'INFORMATIQUE', sortOrder: 5 },
  { code: 'MARKETING_COMMUNICATION', label: 'MARKETING COMMUNICATION', sortOrder: 6 },
  { code: 'RESSOURCES_HUMAINES', label: 'RESSOURCES HUMAINES', sortOrder: 7 },
  { code: 'SANTARGILE', label: 'SANTARGILE', sortOrder: 8 },
  { code: 'MAKE_UP_ADDICTION', label: 'MAKE-UP ADDICTION', sortOrder: 9 },
  { code: 'RDC_CPI', label: 'RDC CPI', sortOrder: 10 },
  { code: 'ETAGE_1_CPI', label: '1ER. ETAGE CPI', sortOrder: 11 },
  { code: 'ETAGE_2_CPI', label: '2EME. ETAGE CPI', sortOrder: 12 },
  { code: 'TERRASSE_CPI', label: 'TERRASSE CPI', sortOrder: 13 },
  { code: 'RDC_VILLA', label: 'RDC VILLA', sortOrder: 14 },
  { code: 'ETAGE_1_VILLA', label: '1ER. ETAGE VILLA', sortOrder: 15 },
  { code: 'ETAGE_2_VILLA', label: '2EME. ETAGE VILLA', sortOrder: 16 },
  { code: 'TERRASSE_VILLA', label: 'TERRASSE VILLA', sortOrder: 17 },
] as const;

/** Le role figure au libelle : l'accueil reconnait par lui autant que par le nom. */
export const VISITE_DESTINATAIRES: readonly VisiteReferentielSeed[] = [
  { code: 'NDOYE', label: 'MME. NDOYE (RESP. COMM.)', sortOrder: 1 },
  { code: 'LY_SEYNABOU', label: 'MME. LY SEYNABOU (CAISSIERE)', sortOrder: 2 },
  { code: 'FALL', label: 'M. FALL (COMMERCIAL)', sortOrder: 3 },
  { code: 'SY', label: 'MME. SY (AG)', sortOrder: 4 },
  { code: 'SAMB', label: 'M. SAMB (DG)', sortOrder: 5 },
  { code: 'GUEYE_KHADY', label: 'MME. GUEYE KHADY (SECRETAIRE)', sortOrder: 6 },
  { code: 'SALANE_DIAMA', label: 'MME. SALANE DIAMA (SECRETAIRE)', sortOrder: 7 },
  { code: 'FAYE_SIDI', label: 'M. FAYE SIDI (JURISTE)', sortOrder: 8 },
  { code: 'SANE_ANSOUMANA', label: 'M. SANE ANSOUMANA (FONCIER)', sortOrder: 9 },
  { code: 'BA_DOUDOU', label: 'M. BA DOUDOU (ASSISTANT)', sortOrder: 10 },
  { code: 'SARR_IBRAHIMA', label: 'M. SARR IBRAHIMA (TRESORIER)', sortOrder: 11 },
  { code: 'NDONGO_OUSMANE', label: 'M. NDONGO OUSMANE (COMPTABLE)', sortOrder: 12 },
  { code: 'SAMB_RAMATA', label: 'MME. SAMB RAMATA (RESP. RH)', sortOrder: 13 },
  { code: 'DIOUM_YAMA', label: 'MME. DIOUM YAMA (Ass Rh et Commerciale Argile)', sortOrder: 14 },
  { code: 'DIEDHIOU_YORO', label: 'M. DIEDHIOU YORO (HELPDESK)', sortOrder: 15 },
  { code: 'AUTRE', label: 'AUTRE', sortOrder: 900 },
] as const;

export const VISITE_OBJETS: readonly VisiteReferentielSeed[] = [
  { code: 'ACHAT_TERRAIN', label: 'ACHAT TERRAIN', sortOrder: 1 },
  { code: 'VERSEMENT_ECHEANCE', label: 'VERSEMENT ECHEANCE', sortOrder: 2 },
  { code: 'DEMANDE_INFORMATIONS', label: 'DEMANDE D’INFORMATIONS', sortOrder: 3 },
  {
    code: 'ACHAT_PRODUITS',
    label: 'ACHAT PRODUITS SANTARGILE ET/OU MAKE-UP',
    sortOrder: 4,
  },
  { code: 'APPORTEUR_AFFAIRES', label: 'APPORTEUR D’AFFAIRES', sortOrder: 5 },
  { code: 'CONSEIL_DOMANIAL', label: 'CONSEIL DOMANIAL', sortOrder: 6 },
  { code: 'CONSULTANTS', label: 'CONSULTANTS', sortOrder: 7 },
  { code: 'ENTRETIENS_RECRUTEMENT', label: 'ENTRETIENS DE RECRUTEMENT', sortOrder: 8 },
  { code: 'ENTRETIENS_TRAVAUX', label: 'ENTRETIENS OU TRAVAUX', sortOrder: 9 },
  { code: 'LOCATION_VERSEMENT_LOYER', label: 'LOCATION ET VERSEMENT LOYER', sortOrder: 10 },
  { code: 'PARTENARIAT', label: 'PARTENARIAT', sortOrder: 11 },
  { code: 'PERSONNEL', label: 'PERSONNEL', sortOrder: 12 },
  { code: 'PROPRIETAIRE_BAILLEUR', label: 'PROPRIETAIRE SITES ET/OU BAILLEUR', sortOrder: 13 },
  { code: 'RECLAMATIONS', label: 'RECLAMATIONS', sortOrder: 14 },
  { code: 'SUIVI_DOSSIER', label: 'SUIVI DE DOSSIER', sortOrder: 15 },
  { code: 'VISITE_TERRAIN', label: 'VISITE DE TERRAIN', sortOrder: 16 },
] as const;
