import type {
  Donnees,
  EntreeCatalogue,
  LigneEquipe,
  Scalaire,
} from '@/components/tableau-de-bord/sources';
import { dureeAffichee } from '@/components/supervision/colonnes';
import type {
  ChiffresActivite,
  ChiffresBanques,
  ChiffresCampagne,
  ChiffresCampagnes,
  ChiffresCreneaux,
  ChiffresDelais,
  ChiffresEnrolement,
  ChiffresEntonnoir,
  ChiffresMethodes,
  ChiffresOuvertures,
  ChiffresRendement,
  ChiffresRepresentants,
} from '@/lib/data/chiffres';
import { lignesActivite } from '@/lib/data/activite-agregats';
import { formatDecimal, formatNumber, formatShortDate, formatXof } from '@/lib/format';

/** Une requête, et les cartes qui en vivent. Rien d'autre n'est lancé. */
export type Jeu =
  | 'activite'
  | 'entonnoir'
  | 'delais'
  | 'rendement'
  | 'methodes'
  | 'banques'
  | 'campagne'
  | 'campagnes'
  | 'creneaux'
  | 'representants'
  | 'ouvertures'
  | 'enrolement';

export interface Jeux {
  activite?: ChiffresActivite;
  entonnoir?: ChiffresEntonnoir;
  delais?: ChiffresDelais;
  rendement?: ChiffresRendement;
  methodes?: ChiffresMethodes;
  banques?: ChiffresBanques;
  campagne?: ChiffresCampagne;
  campagnes?: ChiffresCampagnes;
  creneaux?: ChiffresCreneaux;
  representants?: ChiffresRepresentants;
  ouvertures?: ChiffresOuvertures;
  enrolement?: ChiffresEnrolement;
}

export interface SourceChiffre extends EntreeCatalogue {
  jeu: Jeu;
  description: string;
  groupe: string;
  /** `null` tant que le jeu n'est pas arrivé : la carte montre son squelette. */
  extraire: (jeux: Jeux) => Donnees | null;
}

export const tauxTexte = (valeur: number | null): string =>
  valeur === null ? 'Sans objet' : `${formatDecimal(valeur)} %`;

/** Même arrondi que le serveur : un taux d'équipe se relit sur les sommes. */
export const part = (valeur: number, total: number): number | null =>
  total === 0 ? null : Math.round((valeur / total) * 1000) / 10;

export const scalaire = (libelle: string, valeur: number): Donnees => ({
  forme: 'scalaire',
  donnee: { libelle, valeur },
});

/** Un taux en tuile : « Sans objet » sans dénominateur, jamais « 0 % ». */
export const scalaireTaux = (
  valeur: number | null,
  libelle: string,
  sansDenominateur: string,
): Donnees => ({
  forme: 'scalaire',
  donnee: {
    libelle: valeur === null ? sansDenominateur : libelle,
    valeur: valeur ?? 0,
    affichage: tauxTexte(valeur),
  } satisfies Scalaire,
});

/** Une durée en tuile : le texte remplace le nombre, « Sans objet » sans mesure. */
export const scalaireDuree = (secondes: number | null, libelle: string): Donnees => ({
  forme: 'scalaire',
  donnee: { libelle, valeur: secondes ?? 0, affichage: dureeAffichee(secondes) },
});

/** `formatXof` lit une suite de chiffres, pas un flottant de fin d'interpolation. */
export const francs = (montant: number): string => formatXof(String(Math.round(montant)));

const COLONNES_CHUES = [
  'Appels représentants',
  'Joignabilité',
  'Acceptés',
  'À rappeler',
  'Acceptation',
  'Prospects saisis',
  'Méthodes obtenues',
] as const;

const COLONNES_GRAND_PUBLIC = [
  'Appels prospects',
  'Joignabilité',
  'Prospects saisis',
  'Méthodes obtenues',
] as const;

type Cumul = {
  repCalls: number;
  repFiches: number;
  repFichesJointes: number;
  repFichesAcceptees: number;
  repFichesARappeler: number;
  repFichesEligibles: number;
  calls: number;
  fiches: number;
  fichesJointes: number;
  prospectsCreated: number;
  methodObtained: number;
};

const CUMUL_VIDE: Cumul = {
  repCalls: 0,
  repFiches: 0,
  repFichesJointes: 0,
  repFichesAcceptees: 0,
  repFichesARappeler: 0,
  repFichesEligibles: 0,
  calls: 0,
  fiches: 0,
  fichesJointes: 0,
  prospectsCreated: 0,
  methodObtained: 0,
};

function cellules(cumul: Cumul, chues: boolean): LigneEquipe['cellules'] {
  const textes = chues
    ? [
        formatNumber(cumul.repCalls),
        tauxTexte(part(cumul.repFichesJointes, cumul.repFiches)),
        formatNumber(cumul.repFichesAcceptees),
        formatNumber(cumul.repFichesARappeler),
        tauxTexte(part(cumul.repFichesAcceptees, cumul.repFichesEligibles)),
        formatNumber(cumul.prospectsCreated),
        formatNumber(cumul.methodObtained),
      ]
    : [
        formatNumber(cumul.calls),
        tauxTexte(part(cumul.fichesJointes, cumul.fiches)),
        formatNumber(cumul.prospectsCreated),
        formatNumber(cumul.methodObtained),
      ];
  const colonnes = chues ? COLONNES_CHUES : COLONNES_GRAND_PUBLIC;
  return textes.map((texte, index) => ({ cle: colonnes[index] ?? String(index), texte }));
}

/**
 * Les lignes se somment par téléconseiller sur la fenêtre demandée, y compris
 * les fiches : une fiche n'est attribuée qu'une fois, à qui a posé son dernier
 * statut. Le pied reprend `totals`, calculé par le serveur.
 */
export function tableauEquipe(activite: ChiffresActivite, chues: boolean): Donnees {
  const cumul = new Map<string, Cumul>();
  for (const ligne of activite.items ?? []) {
    const courant = cumul.get(ligne.teleconseillerId) ?? { ...CUMUL_VIDE };
    for (const cle of Object.keys(CUMUL_VIDE) as (keyof Cumul)[]) courant[cle] += ligne[cle];
    cumul.set(ligne.teleconseillerId, courant);
  }

  return {
    forme: 'equipe',
    donnee: {
      colonnes: [...(chues ? COLONNES_CHUES : COLONNES_GRAND_PUBLIC)],
      lignes: (activite.teleconseillers ?? []).map((personne) => ({
        id: personne.id,
        nom: personne.fullName,
        cellules: cellules(cumul.get(personne.id) ?? CUMUL_VIDE, chues),
      })),
      pied: { id: 'equipe', nom: 'Équipe', cellules: cellules(activite.totals, chues) },
    },
  };
}

/** Le compte se lit par téléconseiller ET par jour, jamais cumulé. */
export function matriceOuvertures(lignes: ChiffresOuvertures): Donnees {
  const jours = [...new Set(lignes.map((ligne) => ligne.jour))].sort();
  const noms = new Map(lignes.map((ligne) => [ligne.openedById, ligne.openedByName]));
  const comptes = new Map(
    lignes.map((ligne) => [`${ligne.openedById}|${ligne.jour}`, ligne.ouvertures]),
  );

  return {
    forme: 'matrice',
    donnee: {
      lignes: [...noms.values()],
      colonnes: jours.map((jour) => formatShortDate(jour)),
      cellules: [...noms.entries()].flatMap(([id, nom]) =>
        jours.map((jour) => ({
          ligne: nom,
          colonne: formatShortDate(jour),
          value: comptes.get(`${id}|${jour}`) ?? 0,
        })),
      ),
    },
  };
}

/** Une ligne par téléconseiller, une colonne par créneau, la joignabilité dans la case. */
export function matriceCreneaux(creneaux: ChiffresCreneaux): Donnees {
  const lignes = creneaux.activites.map((activite) => lignesActivite(activite));
  const noms = [...new Set(lignes.flat().map((ligne) => ligne.name))].sort();
  const colonnes = creneaux.creneaux.map(
    (creneau) => `${creneau.label} ${creneau.start}–${creneau.end}`,
  );
  return {
    forme: 'matrice',
    donnee: {
      lignes: noms,
      colonnes,
      cellules: noms.flatMap((nom) =>
        colonnes.map((colonne, index) => ({
          ligne: nom,
          colonne,
          value: lignes[index]?.find((ligne) => ligne.name === nom)?.repReachabilityRate ?? 0,
        })),
      ),
    },
  };
}

export const sommeOuvertures = (
  lignes: ChiffresOuvertures,
  cle: 'ouvertures' | 'qualifiees' | 'liberees',
): number => lignes.reduce((total, ligne) => total + ligne[cle], 0);

/** DMT d'équipe pondérée par les fiches qualifiées, jamais une moyenne de moyennes. */
export function dureeMoyenneSurLaFiche(lignes: ChiffresOuvertures): number | null {
  const mesurees = lignes.filter((ligne) => ligne.dureeMoyenneSecondes !== null);
  const poids = sommeOuvertures(mesurees, 'qualifiees');
  if (poids === 0) return null;
  const total = mesurees.reduce(
    (cumul, ligne) => cumul + (ligne.dureeMoyenneSecondes ?? 0) * ligne.qualifiees,
    0,
  );
  return Math.round(total / poids);
}

export const partsStock = (
  parts: NonNullable<ChiffresRepresentants['parDepartement']>,
): Donnees => ({
  forme: 'classement',
  donnee: parts
    .filter((p) => p.count > 0)
    .map((p) => ({ id: p.id, label: p.label, value: p.count })),
});
