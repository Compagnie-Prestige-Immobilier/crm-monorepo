import type { ProspectType } from '@/lib/data/console';
import type { ModeEpargne, TypeContrat } from '@/lib/data/grand-public';

export type Champ =
  | 'employeur'
  | 'contrat'
  | 'anciennete'
  | 'banque'
  | 'syndicat'
  | 'lieu'
  | 'epargne'
  | 'pays'
  | 'whatsapp'
  | 'relais';

/**
 * Ce que chaque situation demande, en plus de l'identité, de la profession, du
 * revenu et de la provenance. La MÊME table commande l'affichage et le vidage :
 * un champ montré ailleurs partirait sinon avec la fiche suivante.
 */
export const CHAMPS: Record<ProspectType, readonly Champ[]> = {
  FONCTIONNAIRE: ['employeur', 'syndicat', 'banque', 'anciennete'],
  SECTEUR_PRIVE: ['employeur', 'contrat', 'banque', 'anciennete'],
  INFORMEL: ['lieu', 'epargne'],
  DIASPORA: ['pays', 'whatsapp', 'relais', 'banque'],
};

export interface Situation {
  employeurId: string | null;
  employeur: string;
  typeContrat: TypeContrat | null;
  ancienneteMois: string;
  lieuActivite: string;
  modeEpargne: ModeEpargne | null;
  paysResidenceId: string | null;
  villeResidence: string;
  whatsapp: string;
  relaisNom: string;
  relaisPhone: string;
  banqueId: string | null;
  syndicatId: string | null;
}

export const SITUATION_VIDE: Situation = {
  employeurId: null,
  employeur: '',
  typeContrat: null,
  ancienneteMois: '',
  lieuActivite: '',
  modeEpargne: null,
  paysResidenceId: null,
  villeResidence: '',
  whatsapp: '',
  relaisNom: '',
  relaisPhone: '',
  banqueId: null,
  syndicatId: null,
};

const montre = (type: ProspectType | null, champ: Champ): boolean =>
  type !== null && CHAMPS[type].includes(champ);

/** Le champ qui commande chaque colonne : deux colonnes peuvent dépendre du même. */
const CHAMP_PAR_CLE: Record<keyof Situation, Champ> = {
  employeurId: 'employeur',
  employeur: 'employeur',
  typeContrat: 'contrat',
  ancienneteMois: 'anciennete',
  lieuActivite: 'lieu',
  modeEpargne: 'epargne',
  paysResidenceId: 'pays',
  villeResidence: 'pays',
  whatsapp: 'whatsapp',
  relaisNom: 'relais',
  relaisPhone: 'relais',
  banqueId: 'banque',
  syndicatId: 'syndicat',
};

/** Ne garde que ce que la nouvelle situation demande, vide le reste. */
export function pourSituation(type: ProspectType | null, actuel: Situation): Situation {
  const suivant = { ...actuel };
  for (const [cle, champ] of Object.entries(CHAMP_PAR_CLE)) {
    if (montre(type, champ)) continue;
    const nom = cle as keyof Situation;
    Object.assign(suivant, { [nom]: SITUATION_VIDE[nom] });
  }
  return suivant;
}

/** Un entier de mois, ou `null` : le serveur refuse tout le reste. */
export function anciennete(saisie: string): number | null {
  const propre = saisie.trim();
  const valeur = Number(propre);
  if (propre === '' || !Number.isInteger(valeur) || valeur < 0 || valeur > 840) return null;
  return valeur;
}
