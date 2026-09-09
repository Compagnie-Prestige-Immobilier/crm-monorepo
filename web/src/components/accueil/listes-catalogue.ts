import type { AdaptateurFiltres } from '@/lib/filtres-url';
import { lireTexte } from '@/lib/filtres-url';

export interface Liste {
  /** Le genre attendu par `/referentiels/{kind}`. */
  kind: string;
  onglet: string;
  titre: string;
  description: string;
  creation: string;
  vide: string;
}

export const LISTES: readonly Liste[] = [
  {
    kind: 'visite-entreprises',
    onglet: 'Entreprises',
    titre: 'Entreprises',
    description: 'La société ou l’organisme visité.',
    creation: 'Nouvelle entreprise',
    vide: 'Aucune entreprise enregistrée.',
  },
  {
    kind: 'visite-directions',
    onglet: 'Directions',
    titre: 'Directions',
    description: 'Le service concerné par la visite, quand il est connu.',
    creation: 'Nouvelle direction',
    vide: 'Aucune direction enregistrée.',
  },
  {
    kind: 'visite-destinataires',
    onglet: 'Destinataires',
    titre: 'Destinataires',
    description: 'La personne demandée par le visiteur.',
    creation: 'Nouveau destinataire',
    vide: 'Aucun destinataire enregistré.',
  },
  {
    kind: 'visite-objets',
    onglet: 'Objets de visite',
    titre: 'Objets de visite',
    description: 'Le motif de la visite.',
    creation: 'Nouvel objet',
    vide: 'Aucun objet de visite enregistré.',
  },
];

const DEFAUT = 'visite-entreprises';

export interface FiltresListes {
  onglet: string;
  recherche: string;
}

export const ADAPTATEUR_LISTES: AdaptateurFiltres<FiltresListes> = {
  lire: (params) => {
    const brut = lireTexte(params, 'onglet');
    const connu = brut !== null && LISTES.some((liste) => liste.kind === brut);
    return {
      onglet: connu ? brut : DEFAUT,
      recherche: lireTexte(params, 'recherche') ?? '',
    };
  },
  ecrire: (filtres) => {
    const params = new URLSearchParams();
    if (filtres.onglet !== DEFAUT) params.set('onglet', filtres.onglet);
    if (filtres.recherche.trim() !== '') params.set('recherche', filtres.recherche.trim());
    return params;
  },
  efface: (courant) => ({ onglet: courant.onglet, recherche: '' }),
};
