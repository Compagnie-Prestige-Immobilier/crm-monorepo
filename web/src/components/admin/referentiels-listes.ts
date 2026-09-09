import type { ReferentielEntree, ReferentielItem } from '@/lib/data/referentiels';

/** Les colonnes propres d'une liste, telles que la carte figée du serveur les accepte. */
export interface ChampReferentiel {
  nom: keyof ReferentielEntree;
  libelle: string;
  type: 'texte' | 'nombre' | 'booleen' | 'liste' | 'referentiel';
  obligatoire?: boolean;
  options?: readonly { value: string; label: string }[];
  /** Le référentiel où la valeur se choisit, pour `type: 'referentiel'`. */
  source?: string;
}

export interface ListeReferentiel {
  kind: string;
  titre: string;
  nouveau: string;
  modifier: string;
  champs: readonly ChampReferentiel[];
  /** Colonnes lues seulement : le serveur refuse toute écriture sur ces listes. */
  lectureSeule?: boolean;
  /** Colonnes affichées en plus des champs, jamais saisies. */
  lues?: readonly { nom: keyof ReferentielItem; libelle: string }[];
}

const TYPES_EMPLOYEUR = [
  { value: 'MINISTERE', label: 'Ministère' },
  { value: 'ENTREPRISE', label: 'Entreprise' },
  { value: 'AUTRE', label: 'Autre' },
] as const;

const code = (libelle = 'Code'): ChampReferentiel => ({
  nom: 'code',
  libelle,
  type: 'texte',
  obligatoire: true,
});

const label: ChampReferentiel = {
  nom: 'label',
  libelle: 'Libellé',
  type: 'texte',
  obligatoire: true,
};

export const LISTES_REFERENTIEL: readonly ListeReferentiel[] = [
  {
    kind: 'banques',
    titre: 'Banques',
    nouveau: 'Nouvelle banque',
    modifier: 'Modifier la banque',
    champs: [
      { nom: 'name', libelle: 'Nom', type: 'texte', obligatoire: true },
      { nom: 'shortName', libelle: 'Nom court', type: 'texte', obligatoire: true },
    ],
  },
  {
    kind: 'syndicats',
    titre: 'Syndicats',
    nouveau: 'Nouveau syndicat',
    modifier: 'Modifier le syndicat',
    champs: [
      { nom: 'name', libelle: 'Nom', type: 'texte', obligatoire: true },
      { nom: 'sigle', libelle: 'Sigle', type: 'texte', obligatoire: true },
      { nom: 'secteur', libelle: 'Secteur', type: 'texte' },
    ],
  },
  {
    kind: 'departements',
    titre: 'Départements',
    nouveau: 'Nouveau département',
    modifier: 'Modifier le département',
    champs: [
      code(),
      { nom: 'name', libelle: 'Nom', type: 'texte', obligatoire: true },
      {
        nom: 'regionId',
        libelle: 'Région',
        type: 'referentiel',
        obligatoire: true,
        source: 'regions',
      },
    ],
    lues: [{ nom: 'regionName', libelle: 'Région' }],
  },
  {
    kind: 'professions',
    titre: 'Professions',
    nouveau: 'Nouvelle profession',
    modifier: 'Modifier la profession',
    champs: [code(), label, { nom: 'isTeaching', libelle: 'Enseignante', type: 'booleen' }],
  },
  {
    kind: 'employeurs',
    titre: 'Employeurs',
    nouveau: 'Nouvel employeur',
    modifier: 'Modifier l’employeur',
    champs: [
      code(),
      label,
      {
        nom: 'type',
        libelle: 'Type',
        type: 'liste',
        obligatoire: true,
        options: TYPES_EMPLOYEUR,
      },
    ],
  },
  {
    kind: 'income-bands',
    titre: 'Revenus',
    nouveau: 'Nouvelle tranche',
    modifier: 'Modifier la tranche',
    champs: [
      code(),
      label,
      { nom: 'minXof', libelle: 'Minimum FCFA', type: 'nombre' },
      { nom: 'maxXof', libelle: 'Maximum FCFA', type: 'nombre' },
    ],
  },
  {
    kind: 'offers',
    titre: 'Offres',
    nouveau: 'Nouvelle offre',
    modifier: 'Modifier l’offre',
    champs: [code(), label, { nom: 'description', libelle: 'Description', type: 'texte' }],
  },
  {
    kind: 'canaux-provenance',
    titre: 'Canaux de provenance',
    nouveau: 'Nouveau canal',
    modifier: 'Modifier le canal',
    champs: [code(), label],
  },
  {
    kind: 'pays',
    titre: 'Pays',
    nouveau: '',
    modifier: '',
    lectureSeule: true,
    champs: [code(), label],
    lues: [{ nom: 'indicatif', libelle: 'Indicatif' }],
  },
  {
    kind: 'regions',
    titre: 'Régions',
    nouveau: '',
    modifier: '',
    lectureSeule: true,
    champs: [code(), { nom: 'name', libelle: 'Nom', type: 'texte' }],
  },
  {
    kind: 'iefs',
    titre: 'IEF',
    nouveau: '',
    modifier: '',
    lectureSeule: true,
    champs: [code(), { nom: 'name', libelle: 'Nom', type: 'texte' }],
    lues: [
      { nom: 'departementName', libelle: 'Département' },
      { nom: 'regionName', libelle: 'Région' },
    ],
  },
  {
    kind: 'bank-rejection-reasons',
    titre: 'Motifs de rejet bancaire',
    nouveau: '',
    modifier: '',
    lectureSeule: true,
    champs: [code(), label],
  },
];

export const ONGLET_STATUTS = 'statutsQualification';

export function listeParOnglet(onglet: string | undefined): ListeReferentiel | null {
  return LISTES_REFERENTIEL.find((liste) => liste.kind === onglet) ?? null;
}

/** La valeur affichée d'une colonne, `ReferentielsItem` portant toutes les listes. */
export function valeurAffichee(item: ReferentielItem, nom: keyof ReferentielItem): string {
  const valeur = item[nom];
  if (valeur === null || valeur === undefined || valeur === '') return '–';
  if (typeof valeur === 'boolean') return valeur ? 'Oui' : 'Non';
  return String(valeur);
}
